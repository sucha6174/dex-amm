# DEX AMM Project

A decentralized exchange (DEX) smart contract protocol implementing an Automated Market Maker (AMM) based on the constant-product invariant ($x \cdot y = k$). The protocol features automated liquidity management, token swaps with an integrated 0.3% trading fee, internal LP share accounting, OpenZeppelin `SafeERC20` token safety, `ReentrancyGuard` protection, strict reserve-ratio enforcement for subsequent liquidity additions, and 18-decimal fixed-point price calculations.

Author: **KALARI SRISUCHA** ([@sucha6174](https://github.com/sucha6174))

---

## Overview

This project implements a simplified decentralized exchange using an Automated Market Maker (AMM) model inspired by the constant-product approach. It facilitates peer-to-pool token trading and permissionless liquidity provision without relying on traditional central order books or centralized market makers.

Through the smart contracts, users can:
- **Provide Liquidity**: Deposit pairs of ERC-20 tokens (`Token A` and `Token B`) into the liquidity pool.
- **Receive LP Shares**: Mint liquidity provider (LP) shares that represent proportional ownership of the underlying pool assets.
- **Remove Liquidity**: Burn LP shares at any time to withdraw their proportional share of both tokens, including accumulated trading fees.
- **Swap Tokens**: Execute bidirectional swaps (Token A $\rightarrow$ Token B and Token B $\rightarrow$ Token A) with deterministic on-chain pricing.
- **Earn Trading Fees**: Liquidity providers automatically earn a 0.3% fee on every swap executed through the pool, increasing the redemption value of their LP shares.

*Note: This project is an educational and technical demonstration. It is not professionally audited and is not intended for mainnet financial deployment.*

---

## Features

The repository contains a fully functional, tested AMM protocol implementing the following features:

- **Initial Liquidity Provision**: The first liquidity provider sets the initial pool ratio and price, minting LP tokens based on the geometric mean of deposits.
- **Subsequent Liquidity with Reserve-Ratio Enforcement**: Subsequent deposits must match the exact existing reserve ratio, preventing price manipulation and LP dilution.
- **Internal LP Token Accounting**: Tracks provider shares directly within the contract via `liquidity` mapping and `totalLiquidity` tracking.
- **Proportional Liquidity Removal**: Burns LP shares and distributes proportional shares of both token reserves back to the provider.
- **Bidirectional Token Swaps**: Supports direct swaps from Token A to Token B (`swapAForB`) and Token B to Token A (`swapBForA`).
- **Constant Product AMM Formula**: Enforces the $x \cdot y = k$ invariant across all trades.
- **0.3% Trading Fee**: Deducts 30 basis points ($997/1000$ factor) from input amounts during swaps.
- **Fee Accumulation for LPs**: Retains collected fees within the pool reserves, naturally growing $k$ and increasing the token value backing each LP share.
- **Fixed-Point Price Calculation**: Exposes `getPrice()` scaled by $10^{18}$ to preserve decimal precision, gracefully returning `0` when reserves are uninitialized.
- **Explicit Reserve Tracking**: Tracks `reserveA` and `reserveB` in contract storage to prevent balance-manipulation vulnerabilities.
- **Safe Token Transfers**: Integrates OpenZeppelin's `SafeERC20` library (`safeTransfer` and `safeTransferFrom`) to protect against non-standard ERC-20 tokens.
- **Reentrancy Protection**: Uses OpenZeppelin's `ReentrancyGuard` (`nonReentrant` modifier) following the Checks-Effects-Interactions pattern.
- **Comprehensive Input Validation**: Reverts on zero deposits, zero swaps, zero liquidity burns, invalid ratios, and empty/identical constructor addresses.
- **Event Emission**: Emits `LiquidityAdded`, `LiquidityRemoved`, and `Swap` events with indexed parameters for indexing and frontend tracking.
- **Automated Test Suite**: 33 passing automated tests covering all functional flows, boundary conditions, precision scaling, and security edge cases.
- **Hardhat Deployment Script**: Standalone deployment script for deploying mock tokens and the DEX contract.
- **Docker Support**: Containerized environment via `Dockerfile` and `docker-compose.yml` for reproducible execution.

---

## Architecture

The project is structured into modular components:

```
contracts/
├── DEX.sol           # Core AMM exchange, liquidity, swaps, and math
└── MockERC20.sol     # ERC-20 mock token for local testing and deployment
scripts/
└── deploy.js         # Deployment script for local Hardhat network
test/
└── DEX.test.js       # Comprehensive Hardhat test suite (33 test cases)
```

### Component Responsibilities

1. **`contracts/DEX.sol`**:
   - Manages the core AMM pool reserves (`reserveA` and `reserveB`).
   - Tracks pool ownership using `totalLiquidity` and `liquidity[provider]`.
   - Executes liquidity deposits and withdrawals with ratio checks and safe transfers.
   - Executes token swaps using the constant product formula with fee deduction.
   - Calculates spot price with $10^{18}$ fixed-point scaling.
   - Guards all state-changing functions against reentrancy via `ReentrancyGuard`.

2. **`contracts/MockERC20.sol`**:
   - Implements standard ERC-20 functionality using OpenZeppelin `ERC20`.
   - Mints initial test balances to the deployer and provides a `mint()` function for setting up test accounts.

3. **`test/DEX.test.js`**:
   - Validates all contract behavior using Hardhat, Ethers.js, and Chai.
   - Tests initial and subsequent liquidity, ratio enforcement, swaps, fee accrual, price calculations, edge cases, and events.

4. **`scripts/deploy.js`**:
   - Automates the deployment of `MockERC20` (Token A), `MockERC20` (Token B), and `DEX`.
   - Logs deployed contract addresses and deployer balances.

### Architecture & Interaction Flow

```
                         +-----------------------------------+
                         |               User                |
                         +-----------------+-----------------+
                                           |
                                           v
                         +-----------------------------------+
                         |           DEX Contract            |
                         |   (ReentrancyGuard + SafeERC20)   |
                         +-----------------+-----------------+
                                           |
        +----------------------------------+----------------------------------+
        |                                  |                                  |
        v                                  v                                  v
+-----------------------+      +-----------------------+      +-----------------------+
| Liquidity Management  |      |      Token Swaps      |      |   Price & Reserves    |
| - addLiquidity()      |      | - swapAForB()         |      | - getPrice() (1e18)   |
| - removeLiquidity()   |      | - swapBForA()         |      | - getReserves()       |
| - Ratio Enforcement   |      | - getAmountOut()      |      | - reserveA, reserveB  |
| - LP Minting / Burn   |      | - 0.3% Fee Retained   |      | - totalLiquidity      |
+-----------+-----------+      +-----------+-----------+      +-----------------------+
            |                              |
            +--------------+---------------+
                           |
                           v (safeTransfer / safeTransferFrom)
            +----------------------------------+
            |         MockERC20 Tokens         |
            |     (Token A    /    Token B)    |
            +----------------------------------+
```

### System Interaction Overview

- **Liquidity & Reserves**: When users deposit tokens via `addLiquidity()`, tokens are transferred into the DEX, and `reserveA` and `reserveB` are updated. LP tokens are minted to represent the user's fractional pool share.
- **Swaps & Reserves**: When users swap tokens via `swapAForB()` or `swapBForA()`, the input token is added to the input reserve, the 0.3% fee is deducted, and the output amount is sent to the user from the output reserve.
- **Reserves & LP Ownership**: As swaps occur, fees stay in the reserves, expanding the total asset backing per LP share without increasing `totalLiquidity`.
- **Withdrawal**: When calling `removeLiquidity()`, the user's LP shares are burned, returning their exact fraction of the increased reserves.

---

## Mathematical Implementation

### Constant Product Formula
The AMM maintains the constant product invariant:

$$x \cdot y = k$$

Where:
- $x = \text{reserveA}$ (pool balance of Token A)
- $y = \text{reserveB}$ (pool balance of Token B)
- $k$ = constant product

Reserves determine the relative spot price between tokens. Any swap shifts the reserve balance along the curve, adjusting the marginal price dynamically based on trade size.

---

### Initial Liquidity
When the pool is uninitialized (`totalLiquidity == 0`), the first provider deposits any non-zero amounts of Token A and Token B, establishing the initial pool ratio. LP shares are minted using the geometric mean:

$$\text{liquidityMinted} = \lfloor\sqrt{\text{amountA} \cdot \text{amountB}}\rfloor$$

This ensures that the initial LP share amount is proportional to the geometric scale of the liquidity provided.

---

### Subsequent Liquidity
Once initial liquidity exists (`totalLiquidity > 0`), subsequent liquidity providers must supply tokens matching the current pool reserve ratio:

$$\text{amountBOptimal} = \frac{\text{amountA} \cdot \text{reserveB}}{\text{reserveA}}$$

The contract strictly enforces this reserve ratio in `contracts/DEX.sol`:

```solidity
uint256 amountBOptimal = (amountA * reserveB) / reserveA;
require(amountB >= amountBOptimal, "Insufficient B amount");
require(amountB == amountBOptimal, "Ratio mismatch");
liquidityMinted = (amountA * totalLiquidity) / reserveA;
```

This dual check ensures:
1. The deposit matches the current reserve ratio exactly.
2. The pool price is not altered by liquidity additions.
3. Existing liquidity providers are not diluted.
4. LP shares are minted proportionally to Token A contribution:

$$\text{liquidityMinted} = \frac{\text{amountA} \cdot \text{totalLiquidity}}{\text{reserveA}}$$

---

### Liquidity Removal
When a provider withdraws liquidity, their LP shares are burned in exchange for their proportional share of the current pool reserves:

$$\text{amountA} = \frac{\text{liquidityBurned} \cdot \text{reserveA}}{\text{totalLiquidity}}$$

$$\text{amountB} = \frac{\text{liquidityBurned} \cdot \text{reserveB}}{\text{totalLiquidity}}$$

Because trading fees increase `reserveA` and `reserveB` over time while `totalLiquidity` remains unchanged during swaps, withdrawing providers receive more tokens than they originally contributed.

---

### Swap Formula
Each swap charges a 0.3% fee ($997/1000$ multiplier). The effective input amount after fee deduction is:

$$\text{amountInWithFee} = \text{amountIn} \cdot 997$$

The output amount is calculated by `getAmountOut()`:

$$\text{numerator} = \text{amountInWithFee} \cdot \text{reserveOut}$$

$$\text{denominator} = (\text{reserveIn} \cdot 1000) + \text{amountInWithFee}$$

$$\text{amountOut} = \frac{\text{numerator}}{\text{denominator}}$$

The 0.3% fee remains inside the liquidity pool reserves, ensuring that $k$ strictly increases after each swap ($k_{\text{after}} > k_{\text{before}}$).

---

### Price Calculation
The spot price of Token A in terms of Token B is exposed via `getPrice()`. To eliminate integer division truncation in Solidity when $\text{reserveB} < \text{reserveA}$, the price is scaled by a $10^{18}$ fixed-point multiplier:

$$\text{price} = \frac{\text{reserveB} \cdot 10^{18}}{\text{reserveA}}$$

- Returns a $10^{18}$-scaled fixed-point value representing the price of 1.0 Token A in units of Token B.
- Gracefully returns `0` if $\text{reserveA} == 0$ without reverting.

---

## Security Considerations

The DEX implementation incorporates defensive security practices:

- **OpenZeppelin SafeERC20**: Token transfers use `safeTransfer` and `safeTransferFrom`, protecting against non-standard ERC-20 tokens that return `false` or do not return booleans.
- **ReentrancyGuard**: All state-modifying external functions (`addLiquidity`, `removeLiquidity`, `swapAForB`, `swapBForA`) are protected by OpenZeppelin's `nonReentrant` modifier.
- **Checks-Effects-Interactions (CEI)**: State variables (`reserveA`, `reserveB`, `totalLiquidity`, `liquidity`) are updated before external token transfer calls.
- **Solidity 0.8+ Arithmetic Safety**: Built-in compiler-level overflow and underflow protection on all mathematical operations.
- **Subsequent Liquidity Ratio Enforcement**: Prevents price manipulation and LP dilution by requiring exact reserve ratios on subsequent deposits.
- **Input & Parameter Validation**: Validates non-zero amounts (`Zero amount`, `Zero input`, `Zero liquidity`), non-zero constructor addresses, and non-identical pair addresses (`Identical token addresses`).
- **Reserves Availability**: Reverts swaps if reserves are uninitialized (`No liquidity`) or if requested output exceeds available reserves.

### Known Limitations

- **No Mempool Slippage Protection**: The current base interface (`swapAForB(amountAIn)`) does not accept `minAmountOut` or `deadline` parameters. In a public mempool environment, users would be vulnerable to sandwich and front-running attacks without a router contract providing slippage bounds.
- **Single Trading Pair**: The contract manages a single pair of tokens. It does not include a factory contract or multi-hop routing mechanism.
- **Token Decimals Assumption**: Price scaling assumes standard 18-decimal tokens.
- **Audit Status**: This code has not undergone a formal third-party security audit.

---

## Testing

The project includes an automated test suite executed via Hardhat and Mocha/Chai.

### Verified Test Results

```text
33 passing (14s)
0 failing
```

### Verified Code Coverage

```text
----------------|----------|----------|----------|----------|----------------|
File            |  % Stmts | % Branch |  % Funcs |  % Lines |Uncovered Lines |
----------------|----------|----------|----------|----------|----------------|
 contracts/     |      100 |    75.86 |      100 |      100 |                |
  DEX.sol       |      100 |    75.86 |      100 |      100 |                |
  MockERC20.sol |      100 |      100 |      100 |      100 |                |
----------------|----------|----------|----------|----------|----------------|
All files       |      100 |    75.86 |      100 |      100 |                |
----------------|----------|----------|----------|----------|----------------|
```

### Test Categories Covered

1. **Liquidity Management (10 tests)**:
   - Initial liquidity provision and reserve tracking
   - Correct initial LP token minting using geometric mean
   - Subsequent liquidity provision with reserve matching
   - Maintaining price ratio on liquidity additions
   - Partial and full liquidity removal
   - Accurate proportional token amounts returned on removal
   - Reverts on zero liquidity additions
   - Reverts when withdrawing more liquidity than owned
   - Reverts on zero liquidity removal
   - Reverts when subsequent liquidity does not match the reserve ratio
2. **Token Swaps (9 tests)**:
   - Token A for Token B swaps
   - Token B for Token A swaps
   - Correct output calculation with 0.3% fee applied
   - Reserve updates matching input and output
   - Verified $k$ increase after swaps due to fee retention
   - Reverts on zero swap amounts
   - High price impact handling on large swaps
   - Multiple consecutive swaps maintaining state consistency
   - Reverts when swapping with zero reserves
3. **Price Calculations (4 tests)**:
   - Correct initial price calculation
   - Dynamic price updates following swaps
   - Graceful handling of zero reserves (returns 0)
   - High-precision fixed-point scaling ($10^{18}$) when `reserveB < reserveA`
4. **Fee Distribution (2 tests)**:
   - Fee accumulation benefiting liquidity providers upon withdrawal
   - Proportional fee distribution matching LP shares
5. **Edge Cases (4 tests)**:
   - Minimum liquidity handling (1-wei deposits and sqrt edge cases)
   - Large liquidity deposits without arithmetic overflow
   - Unauthorized access prevention (users with 0 LP cannot withdraw pool assets)
   - Rejection of invalid/identical token addresses during construction
6. **Events (4 tests)**:
   - `LiquidityAdded` event emission with parameters
   - `LiquidityRemoved` event emission with parameters
   - `Swap` event emission with parameters
   - Non-negative reserve validation

---

## Setup Instructions

### Prerequisites

- **Node.js**: v18.x or v20.x
- **npm**: v9.x or v10.x
- **Git**
- **Docker & Docker Compose** (for containerized execution)

---

### Local Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/sucha6174/dex-amm.git
   cd dex-amm
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Compile smart contracts:
   ```bash
   npm run compile
   ```

4. Run the automated test suite:
   ```bash
   npm test
   ```

5. Run code coverage analysis:
   ```bash
   npm run coverage
   ```

6. Deploy to local Hardhat network:
   ```bash
   npm run deploy
   ```

---

### Docker Setup

The project includes container configuration for running in isolated environments:

1. Build and start the container:
   ```bash
   docker-compose up -d --build
   ```

2. Compile contracts inside Docker:
   ```bash
   docker-compose exec app npm run compile
   ```

3. Run test suite inside Docker:
   ```bash
   docker-compose exec app npm test
   ```

4. Run coverage analysis inside Docker:
   ```bash
   docker-compose exec app npm run coverage
   ```

5. Stop container:
   ```bash
   docker-compose down
   ```

---

## Deployment

The deployment script [`scripts/deploy.js`](scripts/deploy.js) automates local contract deployment:

```bash
npm run deploy
```

Sample output on local Hardhat Network (Chain ID: `31337`):

```text
Deploying Mock Token A...
Mock Token A deployed to: 0x5FbDB2315678afecb367f032d93F642f64180aa3

Deploying Mock Token B...
Mock Token B deployed to: 0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512

Deploying DEX contract...
DEX deployed to: 0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0
```

---

## License

MIT License.
