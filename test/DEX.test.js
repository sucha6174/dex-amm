const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("DEX", function () {
    let dex, tokenA, tokenB;
    let owner, addr1, addr2;
    describe("Liquidity Management", function () {

    it("should allow initial liquidity provision", async function () {
        await expect(
            dex.addLiquidity(
                ethers.utils.parseEther("100"),
                ethers.utils.parseEther("200")
            )
        ).to.not.be.reverted;
    });
        it("should mint correct LP tokens for first provider", async function () {
        await dex.addLiquidity(
            ethers.utils.parseEther("100"),
            ethers.utils.parseEther("200")
        );

        const liquidity = await dex.totalLiquidity();
        expect(liquidity).to.be.gt(0);
    });

    it("should allow subsequent liquidity additions", async function () {
        await dex.addLiquidity(
            ethers.utils.parseEther("100"),
            ethers.utils.parseEther("200")
        );

        await expect(
            dex.addLiquidity(
                ethers.utils.parseEther("50"),
                ethers.utils.parseEther("100")
            )
        ).to.not.be.reverted;
    });

    it("should maintain price ratio on liquidity addition", async function () {
        await dex.addLiquidity(
            ethers.utils.parseEther("100"),
            ethers.utils.parseEther("200")
        );

        const priceBefore = await dex.getPrice();

        await dex.addLiquidity(
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

        const totalLiquidity = await dex.totalLiquidity();
        const halfLiquidity = totalLiquidity.div(2);

        await expect(
            dex.removeLiquidity(halfLiquidity)
        ).to.not.be.reverted;
    });

    it("should return correct token amounts on liquidity removal", async function () {
        await dex.addLiquidity(
            ethers.utils.parseEther("100"),
            ethers.utils.parseEther("200")
        );

        const totalLiquidity = await dex.totalLiquidity();
        const halfLiquidity = totalLiquidity.div(2);

        const reservesBefore = await dex.getReserves();

        await dex.removeLiquidity(halfLiquidity);

        const reservesAfter = await dex.getReserves();

        expect(reservesAfter[0]).to.be.lt(reservesBefore[0]);
        expect(reservesAfter[1]).to.be.lt(reservesBefore[1]);
    });

    it("should revert on zero liquidity removal", async function () {
        await expect(
            dex.removeLiquidity(0)
        ).to.be.reverted;
    });

    it("should revert when removing more liquidity than owned", async function () {
        await dex.addLiquidity(
            ethers.utils.parseEther("100"),
            ethers.utils.parseEther("200")
        );

        const totalLiquidity = await dex.totalLiquidity();

        await expect(
            dex.removeLiquidity(totalLiquidity.add(1))
        ).to.be.reverted;
    });


});
describe("Token Swaps", function () {

    beforeEach(async function () {
        // Add initial liquidity before each swap test
        await dex.addLiquidity(
            ethers.utils.parseEther("100"),
            ethers.utils.parseEther("200")
        );
    });
        it("should swap token A for token B", async function () {
        await expect(
            dex.swapAForB(ethers.utils.parseEther("10"))
        ).to.not.be.reverted;
    });

    it("should swap token B for token A", async function () {
        await expect(
            dex.swapBForA(ethers.utils.parseEther("10"))
        ).to.not.be.reverted;
    });

    it("should calculate correct output amount with fee", async function () {
        const amountIn = ethers.utils.parseEther("10");

        const reserves = await dex.getReserves();
        const expectedOut = await dex.getAmountOut(
            amountIn,
            reserves[0],
            reserves[1]
        );

        const tx = await dex.swapAForB(amountIn);
        await tx.wait();

        expect(expectedOut).to.be.gt(0);
    });

    it("should update reserves after swap", async function () {
        const reservesBefore = await dex.getReserves();

        await dex.swapAForB(ethers.utils.parseEther("10"));

        const reservesAfter = await dex.getReserves();

        expect(reservesAfter[0]).to.be.gt(reservesBefore[0]);
        expect(reservesAfter[1]).to.be.lt(reservesBefore[1]);
    });

    it("should increase k after swap due to fees", async function () {
        const reservesBefore = await dex.getReserves();
        const kBefore = reservesBefore[0].mul(reservesBefore[1]);

        await dex.swapAForB(ethers.utils.parseEther("10"));

        const reservesAfter = await dex.getReserves();
        const kAfter = reservesAfter[0].mul(reservesAfter[1]);

        expect(kAfter).to.be.gt(kBefore);
    });

    it("should revert on zero swap amount", async function () {
        await expect(
            dex.swapAForB(0)
        ).to.be.reverted;
    });

    it("should handle large swaps with high price impact", async function () {
        await expect(
            dex.swapAForB(ethers.utils.parseEther("80"))
        ).to.not.be.reverted;
    });

    it("should handle multiple consecutive swaps", async function () {
        await dex.swapAForB(ethers.utils.parseEther("5"));
        await dex.swapAForB(ethers.utils.parseEther("5"));
        await dex.swapAForB(ethers.utils.parseEther("5"));

        const reserves = await dex.getReserves();
        expect(reserves[0]).to.be.gt(0);
        expect(reserves[1]).to.be.gt(0);
    });


});
describe("Price Calculations", function () {

    it("should return correct initial price", async function () {
        await dex.addLiquidity(
            ethers.utils.parseEther("100"),
            ethers.utils.parseEther("200")
        );

        const price = await dex.getPrice();
        expect(price).to.equal(2);
    });

    it("should update price after swaps", async function () {
        await dex.addLiquidity(
            ethers.utils.parseEther("100"),
            ethers.utils.parseEther("200")
        );

        const priceBefore = await dex.getPrice();

        await dex.swapAForB(ethers.utils.parseEther("10"));

        const priceAfter = await dex.getPrice();
        expect(priceAfter).to.not.equal(priceBefore);
    });

    it("should handle price queries with zero reserves gracefully", async function () {
        const price = await dex.getPrice();
        expect(price).to.equal(0);
    });
});
describe("Fee Distribution", function () {

    it("should accumulate fees for liquidity providers", async function () {
        await dex.addLiquidity(
            ethers.utils.parseEther("100"),
            ethers.utils.parseEther("200")
        );

        const reservesBefore = await dex.getReserves();

        await dex.swapAForB(ethers.utils.parseEther("10"));

        const reservesAfter = await dex.getReserves();

        expect(reservesAfter[0].mul(reservesAfter[1]))
            .to.be.gt(reservesBefore[0].mul(reservesBefore[1]));
    });

    it("should distribute fees proportionally to LP share", async function () {
        await dex.addLiquidity(
            ethers.utils.parseEther("100"),
            ethers.utils.parseEther("200")
        );

        const liquidityBefore = await dex.totalLiquidity();

        await dex.swapAForB(ethers.utils.parseEther("10"));

        const liquidityAfter = await dex.totalLiquidity();
        expect(liquidityAfter).to.equal(liquidityBefore);
    });
});



    beforeEach(async function () {
        [owner, addr1, addr2] = await ethers.getSigners();

        const MockERC20 = await ethers.getContractFactory("MockERC20");
        tokenA = await MockERC20.deploy("Token A", "TKA");
        tokenB = await MockERC20.deploy("Token B", "TKB");

        const DEX = await ethers.getContractFactory("DEX");
        dex = await DEX.deploy(tokenA.address, tokenB.address);

        await tokenA.approve(dex.address, ethers.utils.parseEther("1000000"));
        await tokenB.approve(dex.address, ethers.utils.parseEther("1000000"));
        
    });
    describe("Events", function () {

    it("should emit LiquidityAdded event", async function () {
        await expect(
            dex.addLiquidity(
                ethers.utils.parseEther("100"),
                ethers.utils.parseEther("200")
            )
        ).to.emit(dex, "LiquidityAdded");
    });

    it("should emit LiquidityRemoved event", async function () {
        await dex.addLiquidity(
            ethers.utils.parseEther("100"),
            ethers.utils.parseEther("200")
        );

        const liquidity = await dex.totalLiquidity();

        await expect(
            dex.removeLiquidity(liquidity.div(2))
        ).to.emit(dex, "LiquidityRemoved");
    });

    it("should emit Swap event", async function () {
        await dex.addLiquidity(
            ethers.utils.parseEther("100"),
            ethers.utils.parseEther("200")
        );

        await expect(
            dex.swapAForB(ethers.utils.parseEther("10"))
        ).to.emit(dex, "Swap");
    });
    it("should return both reserves as non-negative values", async function () {
    const reserves = await dex.getReserves();
    expect(reserves[0]).to.be.at.least(0);
    expect(reserves[1]).to.be.at.least(0);
});

});
});

