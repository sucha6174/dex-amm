# 📘 Project Notes – Development Process (For Interview Reference)

## Project: Decentralized Exchange (DEX) using AMM
**Author:** KALARI SRISUCHA ([@sucha6174](https://github.com/sucha6174))

### Purpose of This Document
This document explains the **end-to-end development process** of the project.
It is written for **future reference**, **interviews**, and **technical discussions** to clearly explain what was built and how.

---

## 1️⃣ Understanding the Problem

The goal was to build a **Decentralized Exchange (DEX)** similar to Uniswap V2 that:
* Allows trustless token swaps without order books.
* Uses automated liquidity pools instead of centralized market makers.
* Determines prices dynamically using the constant product formula ($x \cdot y = k$).
* Rewards liquidity providers proportionally through an integrated 0.3% trading fee.
* Prevents price manipulation by strictly enforcing the reserve ratio for subsequent liquidity additions.

Key challenge:
> Replace centralized exchange order books with **secure smart contracts, mathematical invariants, and robust edge-case validation**.

---

## 2️⃣ Designing the Architecture

### Core Components
* **`DEX.sol`**
  * Manages liquidity pool reserves (`reserveA`, `reserveB`) and LP tokens.
  * Implements `addLiquidity`, `removeLiquidity`, `swapAForB`, `swapBForA`.
  * Computes pricing via `getPrice` (scaled by $10^{18}$) and `getReserves`.
  * Inherits OpenZeppelin `ReentrancyGuard` to eliminate reentrancy vulnerabilities.
  * Employs OpenZeppelin `SafeERC20` for all token transfers.
* **`MockERC20.sol`**
  * Standard ERC-20 test tokens for deploying on local development nodes and test networks.
* **`scripts/deploy.js`**
  * Project-specific deployment script automating Token A, Token B, and DEX contract deployments with address logging.
* **Test Suite (`test/DEX.test.js`)**
  * 33 automated test cases covering 100% statement, line, and function coverage.

---

## 3️⃣ Implementing Liquidity Management

### Add Liquidity
* **First Liquidity Provider**:
  * Free to deposit any ratio of Token A and Token B, establishing the initial market price.
  * LP shares minted using the geometric mean:
    $$\text{liquidityMinted} = \sqrt{amountA \cdot amountB}$$
* **Subsequent Liquidity Providers**:
  * Must strictly supply tokens in the existing reserve ratio:
    $$\text{amountBOptimal} = \frac{amountA \cdot reserveB}{reserveA}$$
    $$amountB == \text{amountBOptimal}$$
  * Rejects deposits with ratio mismatches (`"Insufficient B amount"` / `"Ratio mismatch"`).
  * Mints LP shares proportionally based on Token A contribution:
    $$\text{liquidityMinted} = \frac{amountA \cdot totalLiquidity}{reserveA}$$

### Remove Liquidity
* Providers burn their LP shares to withdraw their proportional share of both underlying token reserves:
  $$amountA = \frac{\text{liquidityBurned} \cdot reserveA}{totalLiquidity}$$
  $$amountB = \frac{\text{liquidityBurned} \cdot reserveB}{totalLiquidity}$$
* Automatically delivers accumulated 0.3% swap fees without explicit accounting tables.

---

## 4️⃣ Implementing AMM Swap Logic

### Constant Product Invariant
The pool maintains the invariant:
$$x \cdot y = k$$

Where $x$ is reserve of Token A, $y$ is reserve of Token B.

### Swap with 0.3% Fee
* Effective input amount after deducting the 0.3% fee:
  $$\text{amountInWithFee} = \text{amountIn} \cdot 997$$
* Output token amount:
  $$\text{amountOut} = \frac{\text{amountInWithFee} \cdot \text{reserveOut}}{\text{reserveIn} \cdot 1000 + \text{amountInWithFee}}$$
* The deducted fee remains in the pool reserves, ensuring $k$ strictly increases after each swap ($k_{\text{after}} > k_{\text{before}}$).

---

## 5️⃣ Price Discovery & High-Precision Scaling

* Price is computed as the spot ratio of reserves.
* To prevent integer division truncation to `0` when $reserveB < reserveA$, `getPrice()` applies an 18-decimal scaling factor:
  $$\text{price} = \frac{reserveB \cdot 10^{18}}{reserveA}$$
* When $reserveA == 0$ (uninitialized pool), `getPrice()` gracefully returns `0` instead of reverting.

---

## 6️⃣ Security & Code Quality

* **SafeERC20**: Replaced raw `transfer` / `transferFrom` calls with `safeTransfer` and `safeTransferFrom` to prevent silent failures with non-standard ERC-20 tokens.
* **ReentrancyGuard**: Added `nonReentrant` modifier to `addLiquidity`, `removeLiquidity`, `swapAForB`, and `swapBForA`.
* **Checks-Effects-Interactions (CEI)**: State variables are updated before external token transfer calls.
* **Input Validation**: Reverts on zero deposits, zero swaps, zero liquidity burns, insufficient balances, and identical/zero token addresses during deployment.
* **NatSpec**: Complete NatSpec documentation (`@notice`, `@param`, `@return`, `@author`) on all public and external functions.

---

## 7️⃣ Testing & Verification Summary

* **Automated Tests**: 33 passing tests (surpassing the 25 required tests).
* **Code Coverage**:
  * **Statements**: 100%
  * **Functions**: 100%
  * **Lines**: 100%
  * **Branches**: 75.86%
* **Deployment Script**: Successfully tested on local Hardhat network (`npm run deploy`).
* **Docker Environment**: Containerized configuration via `Dockerfile`, `docker-compose.yml`, and `.dockerignore`.
