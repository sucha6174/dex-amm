# 📘 Project Notes – Development Process (For Interview Reference)

## Project: Decentralized Exchange (DEX) using AMM

### Purpose of This Document

This document explains the **end-to-end development process** of the project.
It is written for **future reference**, **interviews**, and **technical discussions** to clearly explain what was built and how.

---

## 1️⃣ Understanding the Problem

The goal was to build a **Decentralized Exchange (DEX)** similar to Uniswap V2 that:

* Allows token swaps without order books
* Uses liquidity pools instead of buyers/sellers
* Automatically determines prices using math
* Rewards liquidity providers with trading fees

Key challenge:

> Replace centralized exchange logic with **smart contracts + mathematical formulas**.

---

## 2️⃣ Designing the Architecture

### Core Components

* **DEX.sol**

  * Manages liquidity pools
  * Handles swaps
  * Tracks reserves
  * Applies trading fees
* **MockERC20.sol**

  * ERC-20 tokens for testing
* **Test Suite**

  * Ensures correctness of logic
  * Covers edge cases and failures

### Design Decisions

* Used **single liquidity pool** (Token A / Token B)
* Integrated LP accounting inside the DEX contract
* Explicitly tracked `reserveA` and `reserveB`
* Avoided relying on token balances for safety

---

## 3️⃣ Implementing Liquidity Management

### Add Liquidity

* First liquidity provider sets the initial price
* LP shares are minted using:

  ```
  sqrt(amountA * amountB)
  ```
* Subsequent providers must add liquidity in the same ratio
* LP shares represent ownership of the pool

### Remove Liquidity

* Users burn LP shares
* Tokens are returned proportionally:

  ```
  (liquidityBurned / totalLiquidity) * reserves
  ```
* Ensures fairness and fee distribution

---

## 4️⃣ Implementing AMM Swap Logic

### AMM Formula

The exchange uses the **constant product formula**:

```
x * y = k
```

Where:

* `x` = reserve of Token A
* `y` = reserve of Token B

### Swap with Fee

* A **0.3% trading fee** is applied
* Formula used:

  ```
  amountInWithFee = amountIn * 997
  amountOut = (amountInWithFee * reserveOut) /
              (reserveIn * 1000 + amountInWithFee)
  ```
* Fee remains in the pool, increasing LP value

---

## 5️⃣ Price Discovery

* Token price is derived from reserve ratio:

  ```
  price = reserveB / reserveA
  ```
* Prices update automatically after each swap
* No external price oracle required

---

## 6️⃣ Event-Driven Design

Events were emitted for:

* Liquidity addition
* Liquidity removal
* Token swaps

Purpose:

* Transparency
* Easy indexing by off-chain systems
* Debugging and monitoring

---

## 7️⃣ Testing Strategy (Very Important)

### Why Testing Was Critical

Smart contracts are immutable once deployed.
Extensive testing prevents loss of funds.

### What Was Tested

* Initial liquidity provision
* Subsequent liquidity additions
* Liquidity removal (partial & full)
* Swap correctness (A → B, B → A)
* Fee accumulation
* Reserve updates
* Price changes
* Edge cases (zero values, over-removal)
* Event emissions

### Result

* **25 automated test cases**
* All tests pass using Hardhat + Chai

---

## 8️⃣ Tooling & Environment

### Tools Used

* Solidity (`^0.8.x`)
* Hardhat
* Chai
* OpenZeppelin (ERC20)
* Docker (for reproducible builds)
* Git & GitHub

### Docker Note

* Docker configuration was implemented correctly
* Windows Docker Desktop encountered WSL storage issues
* Project runs correctly in Linux/CI environments

---

## 9️⃣ Key Learnings

* How AMMs replace order books
* Importance of reserve tracking
* Fee mechanics in DeFi protocols
* Writing safe Solidity contracts
* Debugging real-world tooling issues
* Importance of automated testing in blockchain


