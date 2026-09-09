# 📘 Project Notes – Decentralized Exchange (DEX) with AMM Protocol

**Author:** KALARI SRISUCHA ([@sucha6174](https://github.com/sucha6174))  
**Repository:** [https://github.com/sucha6174/dex-amm](https://github.com/sucha6174/dex-amm)

---

## 1. Project Objectives & Problem Statement

The objective of this project is to build an Automated Market Maker (AMM) decentralized exchange smart contract based on the constant product formula ($x \cdot y = k$).

Traditional centralized financial exchanges rely on limit order books that match buyers and sellers at discrete price levels. On public blockchains, maintaining an on-chain order book incurs prohibitive gas costs and high latency due to block inclusion times and transaction ordering.

The AMM model solves this by replacing counterparty order matching with a deterministic liquidity pool:
- Trades execute directly against on-chain liquidity reserves.
- Prices adjust automatically based on reserve ratios.
- Liquidity providers supply capital to receive trading fee rewards.
- State transitions are mathematically constrained by an invariant curve.

---

## 2. Architecture & Design Decisions

### Core Smart Contract Architecture

The project is organized into two primary Solidity smart contracts:

1. **`contracts/DEX.sol`**:
   - Manages pool reserves (`reserveA` and `reserveB`).
   - Tracks LP ownership via internal mapping (`liquidity`) and total supply (`totalLiquidity`).
   - Implements liquidity management (`addLiquidity`, `removeLiquidity`).
   - Implements swap logic (`swapAForB`, `swapBForA`, `getAmountOut`).
   - Exposes state query functions (`getPrice`, `getReserves`).
   - Applies `ReentrancyGuard` and `SafeERC20` for defensive security.

2. **`contracts/MockERC20.sol`**:
   - Standard ERC-20 implementation based on OpenZeppelin.
   - Deploys test tokens with 18 decimals and an initial mint of 1,000,000 tokens to the deployer.
   - Provides an unrestricted `mint()` method for distributing test balances across multiple accounts.

### Key Architectural Decisions

- **Internal LP Accounting**: Rather than deploying a separate ERC-20 contract for LP tokens, LP shares are tracked internally in `DEX.sol` via `mapping(address => uint256) public liquidity` and `uint256 public totalLiquidity`. This simplifies deployment and reduces cross-contract gas overhead.
- **Explicit Reserve Tracking**: Pool balances are tracked in storage variables (`reserveA` and `reserveB`) rather than querying `balanceOf(address(this))`. This protects the pool from direct transfer balance manipulation.
- **Strict Reserve-Ratio Enforcement**: When subsequent liquidity is added, the contract calculates `amountBOptimal = (amountA * reserveB) / reserveA` and requires `amountB == amountBOptimal`. This prevents users from supplying arbitrary ratios that would alter pool pricing or dilute existing liquidity providers.
- **OpenZeppelin SafeERC20**: Token operations use `safeTransfer` and `safeTransferFrom` to guarantee safety with non-standard ERC-20 tokens that return `false` or do not return booleans.
- **Reentrancy Protection & CEI**: State variables are modified prior to executing external token transfers, combined with OpenZeppelin's `nonReentrant` modifier on all state-modifying functions.

---

## 3. Mathematical Foundations

### 1. Constant Product Formula
The liquidity pool enforces the invariant:

$$x \cdot y = k$$

Where:
- $x$ is the pool reserve of Token A (`reserveA`).
- $y$ is the pool reserve of Token B (`reserveB`).
- $k$ is the invariant product.

### 2. Swap Dynamics with 0.3% Fee
Every swap applies a 0.3% trading fee ($997/1000$ multiplier):

$$\Delta x_{\text{effective}} = \Delta x \cdot 997$$

$$\Delta y = \frac{\Delta x_{\text{effective}} \cdot y}{x \cdot 1000 + \Delta x_{\text{effective}}}$$

Because the 0.3% fee is retained within the pool reserves, the invariant product $k$ increases after every swap:

$$k_{\text{after}} > k_{\text{before}}$$

### 3. Liquidity Provision Mechanics

#### Initial Liquidity ($totalLiquidity == 0$)
The first depositor establishes the initial pool price by depositing arbitrary amounts of Token A and Token B. Initial LP shares are minted using the geometric mean:

$$\text{liquidityMinted} = \lfloor\sqrt{\text{amountA} \cdot \text{amountB}}\rfloor$$

#### Subsequent Liquidity ($totalLiquidity > 0$)
Subsequent depositors must provide tokens matching the current reserve ratio:

$$\text{amountBOptimal} = \frac{\text{amountA} \cdot \text{reserveB}}{\text{reserveA}}$$

$$\text{require}(\text{amountB} == \text{amountBOptimal})$$

LP shares are minted proportionally based on the Token A contribution:

$$\text{liquidityMinted} = \frac{\text{amountA} \cdot \text{totalLiquidity}}{\text{reserveA}}$$

### 4. Proportional Liquidity Removal
When burning $L$ liquidity shares, the provider receives their exact fractional share of the current reserves:

$$\text{amountA} = \frac{L \cdot \text{reserveA}}{\text{totalLiquidity}}$$

$$\text{amountB} = \frac{L \cdot \text{reserveB}}{\text{totalLiquidity}}$$

Because fees accumulate within `reserveA` and `reserveB`, providers withdraw more total token value than they originally deposited.

### 5. Fixed-Point Price Scaling ($10^{18}$)
In Solidity, integer division truncates fractions toward zero. Calculating $\text{reserveB} / \text{reserveA}$ directly results in `0` whenever $\text{reserveB} < \text{reserveA}$.

To preserve decimal precision, `getPrice()` applies a fixed-point scaling factor of $10^{18}$:

$$\text{price} = \frac{\text{reserveB} \cdot 10^{18}}{\text{reserveA}}$$

- Returns the price of 1.0 Token A in units of Token B with 18 decimal places of precision.
- Gracefully returns `0` if $\text{reserveA} == 0$.

---

## 4. Security Engineering & Edge-Case Handling

| Threat / Edge Case | Implemented Mitigation | Verification |
| :--- | :--- | :--- |
| **Reentrancy Attack** | OpenZeppelin `ReentrancyGuard` (`nonReentrant`) applied to `addLiquidity`, `removeLiquidity`, `swapAForB`, `swapBForA`. Checks-Effects-Interactions (CEI) adhered to. | Verified in contract design and test suite. |
| **Non-Standard ERC-20 Tokens** | OpenZeppelin `SafeERC20` used for all token operations (`safeTransfer`, `safeTransferFrom`). | Balances verified before and after operations in tests. |
| **Subsequent Price Manipulation** | Strict ratio validation: rejects unbalanced subsequent liquidity additions with `"Insufficient B amount"` or `"Ratio mismatch"`. | Automated tests verify rejection of non-matching ratios. |
| **Zero-Value Transactions** | Reverts on zero deposits (`"Zero amount"`), zero swaps (`"Zero input"`), and zero burns (`"Zero liquidity"`). | Explicit revert tests for all zero-value inputs. |
| **Empty Pool Swaps** | Reverts with `"No liquidity"` when attempting to swap against zero reserves. | Tested against empty pools. |
| **Over-Withdrawal** | Reverts with `"Not enough LP"` if a user attempts to burn more LP shares than their balance. | Tested with excess burn attempts. |
| **Unauthorized Asset Access** | `liquidity[msg.sender]` ensures users cannot withdraw assets using another account's LP balance. | Tested with non-depositor accounts. |
| **Constructor Invalidation** | Reverts if token addresses are zero (`"TokenA zero address"`, `"TokenB zero address"`) or identical (`"Identical token addresses"`). | Tested with zero addresses and identical address pairs. |
| **Minimum Precision** | Validated with 1-wei deposits where $\sqrt{1 \cdot 1} = 1$. | Tested with minimum integer values. |

---

## 5. Verification & Test Summary

### Automated Test Suite (`test/DEX.test.js`)
- **Framework**: Hardhat, Ethers.js, Chai
- **Test Count**: **33 tests passing** (0 failing)
- **Execution Time**: ~14 seconds

### Code Coverage (`npm run coverage`)
- **Statement Coverage**: **100%**
- **Function Coverage**: **100%**
- **Line Coverage**: **100%**
- **Branch Coverage**: **75.86%**

### Deployment Verification (`scripts/deploy.js`)
- Deploys `MockERC20` Token A (`0x5FbDB2315678afecb367f032d93F642f64180aa3`)
- Deploys `MockERC20` Token B (`0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512`)
- Deploys `DEX` contract (`0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0`)
- Validated on local Hardhat network (Chain ID: `31337`).

---

## 6. Known Limitations

1. **Single Token Pair**: The contract manages an isolated pair (`Token A` / `Token B`). Multiple pairs or multi-hop routing would require a factory and router architecture.
2. **Slippage Bounds**: The base swap functions execute at the current spot curve without `minAmountOut` or `deadline` checks. In public mempool environments, an external router is required to prevent sandwich attacks.
3. **Audit Status**: This project was developed as a technical implementation and has not been audited by a professional security firm.
