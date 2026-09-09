const { ethers } = require("hardhat");

async function main() {
  console.log("Starting deployment of DEX AMM system...");

  const [deployer] = await ethers.getSigners();
  console.log("Deployer address:", deployer.address);
  const balance = await deployer.getBalance();
  console.log("Deployer balance:", ethers.utils.formatEther(balance), "ETH");

  // 1. Deploy Token A
  console.log("\nDeploying Mock Token A...");
  const MockERC20 = await ethers.getContractFactory("MockERC20");
  const tokenA = await MockERC20.deploy("Token A", "TKA");
  await tokenA.deployed();
  console.log("Mock Token A deployed to:", tokenA.address);

  // 2. Deploy Token B
  console.log("\nDeploying Mock Token B...");
  const tokenB = await MockERC20.deploy("Token B", "TKB");
  await tokenB.deployed();
  console.log("Mock Token B deployed to:", tokenB.address);

  // 3. Deploy DEX
  console.log("\nDeploying DEX contract...");
  const DEX = await ethers.getContractFactory("DEX");
  const dex = await DEX.deploy(tokenA.address, tokenB.address);
  await dex.deployed();
  console.log("DEX deployed to:", dex.address);

  console.log("\n========================================");
  console.log("Deployment Summary:");
  console.log("Token A address :", tokenA.address);
  console.log("Token B address :", tokenB.address);
  console.log("DEX address     :", dex.address);
  console.log("========================================");

  return { tokenA, tokenB, dex };
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Deployment failed:", error);
    process.exit(1);
  });
