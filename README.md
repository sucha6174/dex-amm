# DEX AMM Project

A decentralized exchange (DEX) smart contract protocol implementing an Automated Market Maker (AMM) based on the Uniswap V2 constant product invariant ($x \cdot y = k$) with a 0.3% trading fee, internal LP share accounting, OpenZeppelin `SafeERC20` token transfers, reentrancy protection, strict subsequent liquidity ratio enforcement, and 18-decimal precision price calculation.

Developed by **KALARI SRISUCHA** ([@sucha6174](https://github.com/sucha6174)).

---

## Overview

The DEX AMM protocol facilitates trustless, peer-to-pool token swaps and permissionless liquidity provision without relying on off-chain order books or centralized intermediaries. 

Key design characteristics:
- **Constant Product Market Maker**: Maintains the $x \cdot y = k$ invariant across token swaps.
- **Proportional Fee Accrual**: Imposes a 0.3% fee ($997/1000$ multiplier) on swaps that stays inside the pool reserves, automatically compounding the value of liquidity provider (LP) shares over time.
- **Strict Reserve Ratio Enforcement**: For subsequent liquidity deposits, enforces that deposited tokens match the existing pool reserve ratio ($amountB == (amountA \cdot reserveB) / reserveA$), eliminating pool price manipulation and arbitrary LP dilution.
- **Defensive Security Model**: Protects against reentrancy using OpenZeppelin's `ReentrancyGuard` with Checks-Effects-Interactions (CEI) architecture, and prevents silent ERC-20 transfer failures by using OpenZeppelin's `SafeERC20`.
- **High-Precision Price Discovery**: Computes relative spot prices scaled by $10^{18}$ (`(reserveB * 1e18) / reserveA`), eliminating integer division truncation when $reserveB < reserveA$, and returning `0` gracefully when reserves are empty.

---

## Features

- **Initial Liquidity Provision**: The genesis liquidity provider sets the initial exchange rate between Token A and Token B. LP tokens are minted equal to the geometric mean $\sqrt{amountA \cdot amountB}$.
- **Subsequent Liquidity Provision**: Subsequent providers must contribute tokens matching the current reserve ratio ($amountB == (amountA \cdot reserveB) / reserveA$). LP tokens are minted proportionally to their share of Token A reserves: $(amountA \cdot totalLiquidity) / reserveA$.
- **Liquidity Removal**: Liquidity providers burn their LP tokens to withdraw their proportional share of both underlying token reserves, capturing all accumulated trading fees without external accounting.
- **Constant Product Swaps**: Supports bidirectional swaps (Token A $\rightarrow$ Token B and Token B $\rightarrow$ Token A) with deterministic pricing.
- **0.3% Trading Fee**: A 30 bps fee is deducted from the input token amount during swap execution and added directly into pool reserves.
- **Fee Accumulation**: As trading occurs, reserves grow relative to the circulating LP shares, increasing the redemption value of every minted LP unit.
- **Precision Price Calculation**: On-chain spot price query scaled by $10^{18}$ fixed-point representation.
- **Complete Event Logging**: Comprehensive event emission for `LiquidityAdded`, `LiquidityRemoved`, and `Swap` with indexed addresses for off-chain indexing.

---

## Architecture

```
                      +------------------------------------------+
                      |                 DEX.sol                  |
                      |  - ReentrancyGuard (nonReentrant)        |
                      |  - SafeERC20 (safeTransfer/From)         |
                      +--------------------+---------------------+
                                           |
                +--------------------------+--------------------------+
                |                                                     |
     +----------v----------+                               +----------v----------+
     |     Liquidity       |                               |     Token Swaps     |
     |  - addLiquidity()   |                               |  - swapAForB()      |
     |  - removeLiquidity()|                               |  - swapBForA()      |
     +----------+----------+                               +----------+----------+
                |                                                     |
                +--------------------------+--------------------------+
                                           |
                               +-----------v-----------+
                               |     Pool State        |
                               |  - reserveA, reserveB |
                               |  - totalLiquidity     |
                               |  - liquidity mapping  |
                               +-----------------------+
```

### Smart Contracts

1. **`contracts/DEX.sol`**:
   - Manages pool reserves (`reserveA`, `reserveB`) and LP tokens (`totalLiquidity`, `liquidity[provider]`).
   - Implements `addLiquidity`, `removeLiquidity`, `swapAForB`, `swapBForA`, `getPrice`, `getReserves`, and `getAmountOut`.
   - Inherits `ReentrancyGuard` and applies `nonReentrant` to all state-modifying external methods.
   - Applies `using SafeERC20 for IERC20` to all token movements (`safeTransferFrom`, `safeTransfer`).

2. **`contracts/MockERC20.sol`**:
   - Standard ERC-20 implementation derived from OpenZeppelin `ERC20`.
   - Mints 1,000,000 tokens ($10^{24}$ wei) to the deployer upon construction.
   - Exposes a public `mint(address to, uint256 amount)` helper for testing multi-account scenarios.

### Swap & Liquidity Flow

1. **Liquidity Inflow**:
   - Provider approves tokens $\rightarrow$ Calls `addLiquidity(amountA, amountB)` $\rightarrow$ DEX verifies non-zero inputs $\rightarrow$ If first deposit, mints $\sqrt{amountA \cdot amountB}$; if subsequent, validates $amountB == (amountA \cdot reserveB) / reserveA$ and mints $(amountA \cdot totalLiquidity) / reserveA$ $\rightarrow$ Updates reserves $\rightarrow$ Safely pulls tokens via `safeTransferFrom`.
2. **Liquidity Outflow**:
   - Provider calls `removeLiquidity(liquidityAmount)` $\rightarrow$ Validates provider LP balance $\rightarrow$ Computes proportional shares: $amountA = (liquidity \cdot reserveA) / totalLiquidity$ and $amountB = (liquidity \cdot reserveB) / totalLiquidity$ $\rightarrow$ Updates balances and burns LP shares $\rightarrow$ Safely transfers tokens to provider via `safeTransfer`.
3. **Token Swap**:
   - Trader approves input token $\rightarrow$ Calls `swapAForB(amountAIn)` or `swapBForA(amountBIn)` $\rightarrow$ Computes `amountOut` using `getAmountOut` ($0.3\%$ fee included) $\rightarrow$ Updates pool reserves $\rightarrow$ Emits `Swap` $\rightarrow$ Safely pulls input tokens and transfers output tokens.

---

## Mathematical Implementation

### 1. Constant Product Formula
The core invariant of the pool is:
$$x \cdot y = k$$

Where:
- $x = reserveA$
- $y = reserveB$
- $k$ = constant product value

### 2. Fee Calculation & Swap Pricing
Each swap applies a $0.3\%$ fee ($997/1000$ net factor). For input $\Delta x$:
$$\Delta x_{\text{fee}} = \Delta x \cdot 997$$

The output amount $\Delta y$ is derived from:
$$(x + \Delta x_{\text{net}})(y - \Delta y) = x \cdot y$$

Yielding:
$$\Delta y = \frac{\Delta x \cdot 997 \cdot y}{x \cdot 1000 + \Delta x \cdot 997}$$

Because the deducted $0.3\%$ fee remains in the pool, the product $k$ after each swap strictly increases:
$$k_{\text{after}} > k_{\text{before}}$$

### 3. LP Token Minting

#### Initial Liquidity ($totalLiquidity = 0$)
The genesis liquidity provider defines the initial pricing ratio. LP tokens are minted using the geometric mean:
$$\text{liquidityMinted} = \lfloor\sqrt{amountA \cdot amountB}\rfloor$$

#### Subsequent Liquidity ($totalLiquidity > 0$)
To prevent price manipulation and unfair dilution, subsequent liquidity is constrained by the current reserve ratio:
$$\text{amountBOptimal} = \frac{amountA \cdot reserveB}{reserveA}$$

The contract strictly requires:
$$amountB == \text{amountBOptimal}$$

LP shares are then minted proportionally:
$$\text{liquidityMinted} = \frac{amountA \cdot totalLiquidity}{reserveA}$$

### 4. Liquidity Removal
When burning $L_{\text{burn}}$ LP shares, the user receives their exact fractional share of current reserves:
$$amountA = \frac{L_{\text{burn}} \cdot reserveA}{totalLiquidity}$$
$$amountB = \frac{L_{\text{burn}} \cdot reserveB}{totalLiquidity}$$

Because $reserveA$ and $reserveB$ grow from accumulated swap fees, $(amountA, amountB)$ returned will exceed the original deposits for long-term LPs.

### 5. Spot Price Scaling
To avoid integer division truncation in Solidity when $reserveB < reserveA$, `getPrice()` applies a fixed-point scaling factor of $10^{18}$:
$$\text{Price} = \frac{reserveB \cdot 10^{18}}{reserveA}$$

- Represents the price of $1.0$ Token A in units of Token B (with 18 decimal places).
- Gracefully returns `0` if $reserveA == 0$.

---

## Setup Instructions

### Prerequisites
- [Node.js](https://nodejs.org/) (v18.x or v20.x recommended)
- [npm](https://www.npmjs.com/) (v9.x or v10.x)
- [Docker](https://www.docker.com/) & [Docker Compose](https://docs.docker.com/compose/) (optional, for containerized execution)
- [Git](https://git-scm.com/)

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

4. Run the automated test suite (all 33 tests):
   ```bash
   npm test
   ```

5. Run code coverage analysis:
   ```bash
   npm run coverage
   ```

6. Deploy contracts locally to Hardhat network:
   ```bash
   npm run deploy
   ```

---

## Docker Setup

A production-ready `Dockerfile` and `docker-compose.yml` are provided for reproducible containerized testing.

1. Build and start the container:
   ```bash
   docker-compose up -d --build
   ```

2. Compile contracts inside Docker:
   ```bash
   docker-compose exec app npm run compile
   ```

3. Execute test suite inside Docker:
   ```bash
   docker-compose exec app npm test
   ```

4. Generate coverage inside Docker:
   ```bash
   docker-compose exec app npm run coverage
   ```

5. Stop and clean up containers:
   ```bash
   docker-compose down
   ```

---

## Contract Addresses

This project is configured for local testing and evaluation on the Hardhat Network (Chain ID: `31337`).

Local deployment addresses generated via `npm run deploy`:
- **Mock Token A (`MockERC20`)**: `0x5FbDB2315678afecb367f032d93F642f64180aa3`
- **Mock Token B (`MockERC20`)**: `0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512`
- **DEX (`DEX.sol`)**: `0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0`

*(Note: No testnet or mainnet contracts have been deployed. Real mainnet deployments should only occur after formal security audits).*

---

## Security Considerations

1. **Reentrancy Protection**:
   - Uses OpenZeppelin's `ReentrancyGuard` (`nonReentrant` modifier) on `addLiquidity`, `removeLiquidity`, `swapAForB`, and `swapBForA`.
   - Adheres to Checks-Effects-Interactions (CEI) pattern: internal state variables (`reserveA`, `reserveB`, `liquidity`, `totalLiquidity`) are updated before token transfers are dispatched.

2. **Safe Token Transfers (`SafeERC20`)**:
   - Employs OpenZeppelin's `SafeERC20` wrapper (`safeTransfer`, `safeTransferFrom`) for all token interactions.
   - Prevents vulnerabilities with non-standard ERC-20 tokens that return `false` or return no boolean on transfer instead of reverting.

3. **Subsequent Liquidity Ratio Enforcement**:
   - Rejects unbalanced subsequent liquidity additions that attempt to alter the pool ratio without executing a swap.
   - Enforces $amountB == (amountA \cdot reserveB) / reserveA$, preventing arbitrary price shifts and LP share dilution.

4. **Arithmetic Safety**:
   - Solidity `^0.8.19` provides native compiler-level overflow and underflow checks on all math operations.

5. **Input & State Validation**:
   - Explicit zero-amount validations (`Zero amount`, `Zero input`, `Zero liquidity`).
   - Constructor validates non-zero token addresses and forbids identical token addresses (`Identical token addresses`).
   - Swaps revert when reserves are zero (`No liquidity`) or when output amount exceeds available pool reserves.

---

## Known Limitations

1. **Single Token Pair**:
   - The contract supports one isolated token pair (`Token A` / `Token B`). It does not incorporate a factory pattern or multi-hop routing protocol.
2. **Slippage Protection**:
   - The base assignment interface specifies `swapAForB(uint256 amountAIn)` without a `minAmountOut` parameter. In a public mainnet environment with an open mempool, a router contract with slippage bounds (`minAmountOut`) and transaction expiration deadlines (`deadline`) would be required to prevent front-running and MEV sandwich attacks.
3. **Decimals Assumption**:
   - The price scaling formula assumes 18-decimal tokens for standard 1:1 units. Tokens with non-18 decimals would require dynamic decimal normalization.
4. **Flash Swaps & Concentrated Liquidity**:
   - Features like flash loans, multi-token baskets, or concentrated liquidity (Uniswap V3 ticks) are intentionally omitted to maintain strict adherence to the Uniswap V2 core assignment specifications.

---

## License

MIT License.
