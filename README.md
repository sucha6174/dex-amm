# DEX AMM Project

## Overview
This project implements a simplified **Decentralized Exchange (DEX)** using an **Automated Market Maker (AMM)** model similar to **Uniswap V2**.  
It allows users to provide liquidity, perform token swaps without an order book, and earn trading fees as liquidity providers.

The DEX uses the **constant product formula (x * y = k)** to determine prices and execute swaps in a decentralized and transparent manner.

---

## Features
- Initial and subsequent liquidity provision
- Liquidity removal with proportional share calculation
- Token swaps using constant product AMM formula
- 0.3% trading fee distributed to liquidity providers
- LP token minting and burning (internal accounting)
- On-chain price discovery
- Event emission for all major actions
- Comprehensive test suite with 25+ test cases

---

## Architecture

### Smart Contracts
- **DEX.sol**
  - Core AMM logic
  - Liquidity management
  - Swap functions
  - Fee handling
  - Price calculation
- **MockERC20.sol**
  - Simple ERC-20 token used for testing

### Design Decisions
- Integrated LP token logic using internal accounting (`totalLiquidity` and `liquidity` mapping)
- Solidity `^0.8.x` used for built-in overflow protection
- Fees remain in the pool to benefit liquidity providers
- Reserves tracked explicitly to avoid reliance on token balances

---

## Mathematical Implementation

### Constant Product Formula
The AMM maintains the invariant:


Where:
- `x` = reserve of Token A  
- `y` = reserve of Token B  
- `k` = constant value  

After each swap, `k` remains constant or slightly increases due to fees.

---

### Fee Calculation
A **0.3% trading fee** is applied to each swap.


- Only **99.7%** of the input amount is used for the swap
- The remaining **0.3% stays in the pool**, increasing LP value

---

### LP Token Minting

#### Initial Liquidity

- First liquidity provider sets the initial price

#### Subsequent Liquidity

- Liquidity must be added in the correct ratio

---

### Liquidity Removal
Liquidity providers withdraw their proportional share:

---

## Setup Instructions

### Prerequisites
- Node.js (v18+ recommended)
- Docker & Docker Compose
- Git

---

### Installation (Docker)

```bash
git clone <your-repo-url>
cd dex-amm
docker-compose up -d
docker-compose exec app npm run compile
docker-compose exec app npm test
docker-compose exec app npm run coverage
docker-compose down

