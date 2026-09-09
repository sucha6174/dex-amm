const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("DEX", function () {
  let dex, tokenA, tokenB;
  let owner, addr1, addr2;

  beforeEach(async function () {
    [owner, addr1, addr2] = await ethers.getSigners();

    // Deploy MockERC20 tokens
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    tokenA = await MockERC20.deploy("Token A", "TKA");
    await tokenA.deployed();

    tokenB = await MockERC20.deploy("Token B", "TKB");
    await tokenB.deployed();

    // Deploy DEX contract
    const DEX = await ethers.getContractFactory("DEX");
    dex = await DEX.deploy(tokenA.address, tokenB.address);
    await dex.deployed();

    // Mint tokens to addr1 and addr2
    await tokenA.mint(addr1.address, ethers.utils.parseEther("10000"));
    await tokenB.mint(addr1.address, ethers.utils.parseEther("10000"));
    await tokenA.mint(addr2.address, ethers.utils.parseEther("10000"));
    await tokenB.mint(addr2.address, ethers.utils.parseEther("10000"));

    // Approvals for owner
    await tokenA.approve(dex.address, ethers.constants.MaxUint256);
    await tokenB.approve(dex.address, ethers.constants.MaxUint256);

    // Approvals for addr1
    await tokenA.connect(addr1).approve(dex.address, ethers.constants.MaxUint256);
    await tokenB.connect(addr1).approve(dex.address, ethers.constants.MaxUint256);

    // Approvals for addr2
    await tokenA.connect(addr2).approve(dex.address, ethers.constants.MaxUint256);
    await tokenB.connect(addr2).approve(dex.address, ethers.constants.MaxUint256);
  });

  /* ========================================================================= */
  /*                         LIQUIDITY MANAGEMENT                              */
  /* ========================================================================= */

  describe("Liquidity Management", function () {
    it("should allow initial liquidity provision", async function () {
      const amountA = ethers.utils.parseEther("100");
      const amountB = ethers.utils.parseEther("200");

      const ownerABefore = await tokenA.balanceOf(owner.address);
      const ownerBBefore = await tokenB.balanceOf(owner.address);

      await expect(dex.addLiquidity(amountA, amountB))
        .to.emit(dex, "LiquidityAdded");

      const [rA, rB] = await dex.getReserves();
      expect(rA).to.equal(amountA);
      expect(rB).to.equal(amountB);

      // Verify SafeERC20 token balance changes
      const ownerAAfter = await tokenA.balanceOf(owner.address);
      const ownerBAfter = await tokenB.balanceOf(owner.address);
      expect(ownerABefore.sub(ownerAAfter)).to.equal(amountA);
      expect(ownerBBefore.sub(ownerBAfter)).to.equal(amountB);
      expect(await tokenA.balanceOf(dex.address)).to.equal(amountA);
      expect(await tokenB.balanceOf(dex.address)).to.equal(amountB);
    });

    it("should mint correct LP tokens for first provider", async function () {
      const amountA = ethers.utils.parseEther("100");
      const amountB = ethers.utils.parseEther("100");

      await dex.addLiquidity(amountA, amountB);

      // sqrt(100e18 * 100e18) = 100e18
      const expectedLP = ethers.utils.parseEther("100");
      const totalLiquidity = await dex.totalLiquidity();
      const userLP = await dex.liquidity(owner.address);

      expect(totalLiquidity).to.equal(expectedLP);
      expect(userLP).to.equal(expectedLP);
    });

    it("should allow subsequent liquidity additions", async function () {
      // First provider sets initial ratio (100 Token A : 200 Token B)
      await dex.addLiquidity(
        ethers.utils.parseEther("100"),
        ethers.utils.parseEther("200")
      );

      const totalLPBefore = await dex.totalLiquidity();

      // Subsequent provider adds liquidity at exact current ratio (50 Token A : 100 Token B)
      await expect(
        dex.connect(addr1).addLiquidity(
          ethers.utils.parseEther("50"),
          ethers.utils.parseEther("100")
        )
      ).to.not.be.reverted;

      const [rA, rB] = await dex.getReserves();
      expect(rA).to.equal(ethers.utils.parseEther("150"));
      expect(rB).to.equal(ethers.utils.parseEther("300"));

      // LP minted = (50 * totalLPBefore) / 100 = totalLPBefore / 2
      const addr1LP = await dex.liquidity(addr1.address);
      expect(addr1LP).to.equal(totalLPBefore.div(2));
      expect(await dex.totalLiquidity()).to.equal(totalLPBefore.add(addr1LP));
    });

    it("should maintain price ratio on liquidity addition", async function () {
      await dex.addLiquidity(
        ethers.utils.parseEther("100"),
        ethers.utils.parseEther("200")
      );

      const priceBefore = await dex.getPrice();

      // Subsequent addition preserving reserve ratio (1:2)
      await dex.connect(addr1).addLiquidity(
        ethers.utils.parseEther("50"),
        ethers.utils.parseEther("100")
      );

      const priceAfter = await dex.getPrice();
      expect(priceAfter).to.equal(priceBefore);
    });

    it("should allow partial liquidity removal", async function () {
      await dex.addLiquidity(
        ethers.utils.parseEther("100"),
        ethers.utils.parseEther("200")
      );

      const totalLP = await dex.totalLiquidity();
      const halfLP = totalLP.div(2);

      await expect(dex.removeLiquidity(halfLP))
        .to.emit(dex, "LiquidityRemoved");

      const remainingLP = await dex.liquidity(owner.address);
      expect(remainingLP).to.equal(totalLP.sub(halfLP));
      expect(await dex.totalLiquidity()).to.equal(totalLP.sub(halfLP));

      const [rA, rB] = await dex.getReserves();
      expect(rA).to.equal(ethers.utils.parseEther("50"));
      expect(rB).to.equal(ethers.utils.parseEther("100"));
    });

    it("should return correct token amounts on liquidity removal", async function () {
      await dex.addLiquidity(
        ethers.utils.parseEther("100"),
        ethers.utils.parseEther("200")
      );

      const totalLP = await dex.totalLiquidity();
      const halfLP = totalLP.div(2);

      const balABefore = await tokenA.balanceOf(owner.address);
      const balBBefore = await tokenB.balanceOf(owner.address);

      await dex.removeLiquidity(halfLP);

      const balAAfter = await tokenA.balanceOf(owner.address);
      const balBAfter = await tokenB.balanceOf(owner.address);

      expect(balAAfter.sub(balABefore)).to.equal(ethers.utils.parseEther("50"));
      expect(balBAfter.sub(balBBefore)).to.equal(ethers.utils.parseEther("100"));
    });

    it("should revert on zero liquidity addition", async function () {
      await expect(
        dex.addLiquidity(0, ethers.utils.parseEther("100"))
      ).to.be.revertedWith("Zero amount");

      await expect(
        dex.addLiquidity(ethers.utils.parseEther("100"), 0)
      ).to.be.revertedWith("Zero amount");

      await expect(
        dex.addLiquidity(0, 0)
      ).to.be.revertedWith("Zero amount");
    });

    it("should revert when removing more liquidity than owned", async function () {
      await dex.addLiquidity(
        ethers.utils.parseEther("100"),
        ethers.utils.parseEther("200")
      );

      const ownedLP = await dex.liquidity(owner.address);

      await expect(
        dex.removeLiquidity(ownedLP.add(1))
      ).to.be.revertedWith("Not enough LP");
    });

    it("should revert on zero liquidity removal", async function () {
      await dex.addLiquidity(
        ethers.utils.parseEther("100"),
        ethers.utils.parseEther("200")
      );

      await expect(
        dex.removeLiquidity(0)
      ).to.be.revertedWith("Zero liquidity");
    });

    it("should revert when subsequent liquidity does not match the reserve ratio", async function () {
      // Pool ratio is 100 : 200 (1 Token A = 2 Token B)
      await dex.addLiquidity(
        ethers.utils.parseEther("100"),
        ethers.utils.parseEther("200")
      );

      // Attempting to supply 50 Token A and only 80 Token B (optimal is 100)
      await expect(
        dex.connect(addr1).addLiquidity(
          ethers.utils.parseEther("50"),
          ethers.utils.parseEther("80")
        )
      ).to.be.revertedWith("Insufficient B amount");

      // Attempting to supply 50 Token A and 120 Token B (optimal is 100)
      await expect(
        dex.connect(addr1).addLiquidity(
          ethers.utils.parseEther("50"),
          ethers.utils.parseEther("120")
        )
      ).to.be.revertedWith("Ratio mismatch");
    });
  });

  /* ========================================================================= */
  /*                            TOKEN SWAPS                                    */
  /* ========================================================================= */

  describe("Token Swaps", function () {
    beforeEach(async function () {
      // Add initial pool liquidity: 100 Token A, 200 Token B
      await dex.addLiquidity(
        ethers.utils.parseEther("100"),
        ethers.utils.parseEther("200")
      );
    });

    it("should swap token A for token B", async function () {
      const amountAIn = ethers.utils.parseEther("10");

      const traderBBefore = await tokenB.balanceOf(addr1.address);
      const expectedBOut = await dex.getAmountOut(
        amountAIn,
        ethers.utils.parseEther("100"),
        ethers.utils.parseEther("200")
      );

      await expect(dex.connect(addr1).swapAForB(amountAIn))
        .to.emit(dex, "Swap")
        .withArgs(
          addr1.address,
          tokenA.address,
          tokenB.address,
          amountAIn,
          expectedBOut
        );

      const traderBAfter = await tokenB.balanceOf(addr1.address);
      expect(traderBAfter.sub(traderBBefore)).to.equal(expectedBOut);
    });

    it("should swap token B for token A", async function () {
      const amountBIn = ethers.utils.parseEther("20");

      const traderABefore = await tokenA.balanceOf(addr1.address);
      const expectedAOut = await dex.getAmountOut(
        amountBIn,
        ethers.utils.parseEther("200"),
        ethers.utils.parseEther("100")
      );

      await expect(dex.connect(addr1).swapBForA(amountBIn))
        .to.emit(dex, "Swap")
        .withArgs(
          addr1.address,
          tokenB.address,
          tokenA.address,
          amountBIn,
          expectedAOut
        );

      const traderAAfter = await tokenA.balanceOf(addr1.address);
      expect(traderAAfter.sub(traderABefore)).to.equal(expectedAOut);
    });

    it("should calculate correct output amount with fee", async function () {
      const amountIn = ethers.utils.parseEther("10");
      const reserveIn = ethers.utils.parseEther("100");
      const reserveOut = ethers.utils.parseEther("200");

      // Math: (10e18 * 997 * 200e18) / (100e18 * 1000 + 10e18 * 997)
      // = (10 * 997 * 200e18) / (100000 + 9970) = (1994000e18) / 109970
      const amountInWithFee = amountIn.mul(997);
      const numerator = amountInWithFee.mul(reserveOut);
      const denominator = reserveIn.mul(1000).add(amountInWithFee);
      const expectedAmountOut = numerator.div(denominator);

      const calculatedOut = await dex.getAmountOut(amountIn, reserveIn, reserveOut);
      expect(calculatedOut).to.equal(expectedAmountOut);
    });

    it("should update reserves after swap", async function () {
      const amountAIn = ethers.utils.parseEther("10");
      const [rABefore, rBBefore] = await dex.getReserves();
      const expectedOut = await dex.getAmountOut(amountAIn, rABefore, rBBefore);

      await dex.connect(addr1).swapAForB(amountAIn);

      const [rAAfter, rBAfter] = await dex.getReserves();
      expect(rAAfter).to.equal(rABefore.add(amountAIn));
      expect(rBAfter).to.equal(rBBefore.sub(expectedOut));
    });

    it("should increase k after swap due to fees", async function () {
      const [rABefore, rBBefore] = await dex.getReserves();
      const kBefore = rABefore.mul(rBBefore);

      await dex.connect(addr1).swapAForB(ethers.utils.parseEther("10"));

      const [rAAfter, rBAfter] = await dex.getReserves();
      const kAfter = rAAfter.mul(rBAfter);

      expect(kAfter).to.be.gt(kBefore);
    });

    it("should revert on zero swap amount", async function () {
      await expect(
        dex.connect(addr1).swapAForB(0)
      ).to.be.revertedWith("Zero input");

      await expect(
        dex.connect(addr1).swapBForA(0)
      ).to.be.revertedWith("Zero input");
    });

    it("should handle large swaps with high price impact", async function () {
      // Large swap: 90 Token A against pool reserve of 100 Token A
      const largeAmountIn = ethers.utils.parseEther("90");
      const [rABefore, rBBefore] = await dex.getReserves();

      await expect(dex.connect(addr1).swapAForB(largeAmountIn))
        .to.not.be.reverted;

      const [rAAfter, rBAfter] = await dex.getReserves();
      expect(rAAfter).to.equal(rABefore.add(largeAmountIn));
      expect(rBAfter).to.be.gt(0);
      expect(rBAfter).to.be.lt(rBBefore);
    });

    it("should handle multiple consecutive swaps", async function () {
      const swapAmount = ethers.utils.parseEther("5");

      await dex.connect(addr1).swapAForB(swapAmount);
      await dex.connect(addr2).swapBForA(swapAmount);
      await dex.connect(addr1).swapAForB(swapAmount);

      const [rA, rB] = await dex.getReserves();
      expect(rA).to.be.gt(0);
      expect(rB).to.be.gt(0);
    });

    it("should revert swap when no liquidity exists", async function () {
      // Deploy fresh DEX with 0 liquidity
      const MockERC20 = await ethers.getContractFactory("MockERC20");
      const tk1 = await MockERC20.deploy("T1", "T1");
      const tk2 = await MockERC20.deploy("T2", "T2");
      const DEX = await ethers.getContractFactory("DEX");
      const emptyDex = await DEX.deploy(tk1.address, tk2.address);

      await tk1.approve(emptyDex.address, ethers.constants.MaxUint256);
      await expect(
        emptyDex.swapAForB(ethers.utils.parseEther("1"))
      ).to.be.revertedWith("No liquidity");

      await expect(
        emptyDex.swapBForA(ethers.utils.parseEther("1"))
      ).to.be.revertedWith("No liquidity");
    });
  });

  /* ========================================================================= */
  /*                         PRICE CALCULATIONS                                */
  /* ========================================================================= */

  describe("Price Calculations", function () {
    it("should return correct initial price", async function () {
      // Initial pool: 100 Token A, 200 Token B -> price = (200 * 1e18) / 100 = 2 * 1e18
      await dex.addLiquidity(
        ethers.utils.parseEther("100"),
        ethers.utils.parseEther("200")
      );

      const price = await dex.getPrice();
      expect(price).to.equal(ethers.utils.parseEther("2"));
    });

    it("should update price after swaps", async function () {
      await dex.addLiquidity(
        ethers.utils.parseEther("100"),
        ethers.utils.parseEther("200")
      );

      const priceBefore = await dex.getPrice();

      // Swapping Token A for Token B increases reserveA and decreases reserveB, lowering price
      await dex.connect(addr1).swapAForB(ethers.utils.parseEther("10"));

      const priceAfter = await dex.getPrice();
      expect(priceAfter).to.be.lt(priceBefore);
    });

    it("should handle price queries with zero reserves gracefully", async function () {
      // When reserveA == 0, getPrice() gracefully returns 0 instead of reverting
      const price = await dex.getPrice();
      expect(price).to.equal(0);
    });

    it("should maintain precision when reserveB is less than reserveA", async function () {
      // 200 Token A and 100 Token B: price = (100 * 1e18) / 200 = 0.5 * 1e18
      await dex.addLiquidity(
        ethers.utils.parseEther("200"),
        ethers.utils.parseEther("100")
      );

      const price = await dex.getPrice();
      expect(price).to.equal(ethers.utils.parseEther("0.5"));
    });
  });

  /* ========================================================================= */
  /*                         FEE DISTRIBUTION                                  */
  /* ========================================================================= */

  describe("Fee Distribution", function () {
    it("should accumulate fees for liquidity providers", async function () {
      // Owner deposits 100 Token A and 100 Token B
      await dex.addLiquidity(
        ethers.utils.parseEther("100"),
        ethers.utils.parseEther("100")
      );

      const ownerLP = await dex.liquidity(owner.address);

      // addr1 executes swaps generating 0.3% fees
      await dex.connect(addr1).swapAForB(ethers.utils.parseEther("20"));
      await dex.connect(addr1).swapBForA(ethers.utils.parseEther("20"));

      const balABefore = await tokenA.balanceOf(owner.address);
      const balBBefore = await tokenB.balanceOf(owner.address);

      // Owner withdraws entire liquidity
      await dex.removeLiquidity(ownerLP);

      const balAAfter = await tokenA.balanceOf(owner.address);
      const balBAfter = await tokenB.balanceOf(owner.address);

      // Total withdrawn value exceeds original deposit due to accumulated fees
      const totalTokenAWithdrawn = balAAfter.sub(balABefore);
      const totalTokenBWithdrawn = balBAfter.sub(balBBefore);

      const productWithdrawn = totalTokenAWithdrawn.mul(totalTokenBWithdrawn);
      const originalProduct = ethers.utils.parseEther("100").mul(ethers.utils.parseEther("100"));

      expect(productWithdrawn).to.be.gt(originalProduct);
    });

    it("should distribute fees proportionally to LP share", async function () {
      // Owner adds initial 100 Token A, 100 Token B
      await dex.addLiquidity(
        ethers.utils.parseEther("100"),
        ethers.utils.parseEther("100")
      );

      // addr1 adds equal 100 Token A, 100 Token B (gets equal LP tokens)
      await dex.connect(addr1).addLiquidity(
        ethers.utils.parseEther("100"),
        ethers.utils.parseEther("100")
      );

      const ownerLP = await dex.liquidity(owner.address);
      const addr1LP = await dex.liquidity(addr1.address);
      expect(ownerLP).to.equal(addr1LP);

      // addr2 executes a swap generating fees
      await dex.connect(addr2).swapAForB(ethers.utils.parseEther("20"));

      // Both withdraw full LP positions
      const ownerABefore = await tokenA.balanceOf(owner.address);
      const ownerBBefore = await tokenB.balanceOf(owner.address);
      await dex.removeLiquidity(ownerLP);
      const ownerAGained = (await tokenA.balanceOf(owner.address)).sub(ownerABefore);
      const ownerBGained = (await tokenB.balanceOf(owner.address)).sub(ownerBBefore);

      const addr1ABefore = await tokenA.balanceOf(addr1.address);
      const addr1BBefore = await tokenB.balanceOf(addr1.address);
      await dex.connect(addr1).removeLiquidity(addr1LP);
      const addr1AGained = (await tokenA.balanceOf(addr1.address)).sub(addr1ABefore);
      const addr1BGained = (await tokenB.balanceOf(addr1.address)).sub(addr1BBefore);

      // Proportional fee distribution: both receive equal LP shares and proportional payouts
      expect(ownerLP).to.equal(addr1LP);
      const diffA = ownerAGained.sub(addr1AGained).abs();
      const diffB = ownerBGained.sub(addr1BGained).abs();
      expect(diffA).to.be.lte(1);
      expect(diffB).to.be.lte(1);
    });
  });

  /* ========================================================================= */
  /*                            EDGE CASES                                     */
  /* ========================================================================= */

  describe("Edge Cases", function () {
    it("should handle very small liquidity amounts", async function () {
      // Smallest amounts: 1 wei each (tests sqrt(1) = 1 edge case)
      const smallA = 1;
      const smallB = 1;

      await expect(dex.addLiquidity(smallA, smallB)).to.not.be.reverted;

      const [rA, rB] = await dex.getReserves();
      expect(rA).to.equal(smallA);
      expect(rB).to.equal(smallB);
      expect(await dex.totalLiquidity()).to.equal(1);
    });

    it("should handle very large liquidity amounts", async function () {
      const largeA = ethers.utils.parseEther("500000");
      const largeB = ethers.utils.parseEther("500000");

      await expect(dex.addLiquidity(largeA, largeB)).to.not.be.reverted;

      const [rA, rB] = await dex.getReserves();
      expect(rA).to.equal(largeA);
      expect(rB).to.equal(largeB);
      expect(await dex.totalLiquidity()).to.equal(largeA);
    });

    it("should prevent unauthorized access", async function () {
      await dex.addLiquidity(
        ethers.utils.parseEther("100"),
        ethers.utils.parseEther("100")
      );

      // addr2 has 0 LP tokens; attempting to remove liquidity must revert
      expect(await dex.liquidity(addr2.address)).to.equal(0);

      await expect(
        dex.connect(addr2).removeLiquidity(ethers.utils.parseEther("1"))
      ).to.be.revertedWith("Not enough LP");
    });

    it("should reject deployment with invalid or identical token addresses", async function () {
      const DEX = await ethers.getContractFactory("DEX");

      await expect(
        DEX.deploy(ethers.constants.AddressZero, tokenB.address)
      ).to.be.revertedWith("TokenA zero address");

      await expect(
        DEX.deploy(tokenA.address, ethers.constants.AddressZero)
      ).to.be.revertedWith("TokenB zero address");

      await expect(
        DEX.deploy(tokenA.address, tokenA.address)
      ).to.be.revertedWith("Identical token addresses");
    });
  });

  /* ========================================================================= */
  /*                              EVENTS                                       */
  /* ========================================================================= */

  describe("Events", function () {
    it("should emit LiquidityAdded event", async function () {
      const amountA = ethers.utils.parseEther("100");
      const amountB = ethers.utils.parseEther("200");
      const expectedLP = ethers.BigNumber.from("141421356237309504880"); // sqrt(100e18 * 200e18)

      await expect(dex.addLiquidity(amountA, amountB))
        .to.emit(dex, "LiquidityAdded")
        .withArgs(owner.address, amountA, amountB, expectedLP);
    });

    it("should emit LiquidityRemoved event", async function () {
      await dex.addLiquidity(
        ethers.utils.parseEther("100"),
        ethers.utils.parseEther("200")
      );

      const totalLP = await dex.totalLiquidity();
      const halfLP = totalLP.div(2);

      await expect(dex.removeLiquidity(halfLP))
        .to.emit(dex, "LiquidityRemoved")
        .withArgs(
          owner.address,
          ethers.utils.parseEther("50"),
          ethers.utils.parseEther("100"),
          halfLP
        );
    });

    it("should emit Swap event", async function () {
      await dex.addLiquidity(
        ethers.utils.parseEther("100"),
        ethers.utils.parseEther("200")
      );

      const amountAIn = ethers.utils.parseEther("10");
      const expectedBOut = await dex.getAmountOut(
        amountAIn,
        ethers.utils.parseEther("100"),
        ethers.utils.parseEther("200")
      );

      await expect(dex.swapAForB(amountAIn))
        .to.emit(dex, "Swap")
        .withArgs(
          owner.address,
          tokenA.address,
          tokenB.address,
          amountAIn,
          expectedBOut
        );
    });

    it("should return both reserves as non-negative values", async function () {
      const reservesInitial = await dex.getReserves();
      expect(reservesInitial[0]).to.equal(0);
      expect(reservesInitial[1]).to.equal(0);

      await dex.addLiquidity(
        ethers.utils.parseEther("50"),
        ethers.utils.parseEther("50")
      );

      const reserves = await dex.getReserves();
      expect(reserves[0]).to.be.gt(0);
      expect(reserves[1]).to.be.gt(0);
    });
  });
});
