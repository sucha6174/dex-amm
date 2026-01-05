// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract DEX {

    // =====================
    // STATE VARIABLES
    // =====================
    address public tokenA;
    address public tokenB;

    uint256 public reserveA;
    uint256 public reserveB;

    uint256 public totalLiquidity;
    mapping(address => uint256) public liquidity;

    // =====================
    // EVENTS
    // =====================
    event LiquidityAdded(
        address indexed provider,
        uint256 amountA,
        uint256 amountB,
        uint256 liquidityMinted
    );

    event LiquidityRemoved(
        address indexed provider,
        uint256 amountA,
        uint256 amountB,
        uint256 liquidityBurned
    );

    event Swap(
        address indexed trader,
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 amountOut
    );

    // =====================
    // CONSTRUCTOR
    // =====================
    constructor(address _tokenA, address _tokenB) {
        require(_tokenA != address(0), "TokenA zero address");
        require(_tokenB != address(0), "TokenB zero address");
        require(_tokenA != _tokenB, "Same token");

        tokenA = _tokenA;
        tokenB = _tokenB;
    }

    // =====================
    // ADD LIQUIDITY
    // =====================
    function addLiquidity(uint256 amountA, uint256 amountB)
        external
        returns (uint256 liquidityMinted)
    {
        require(amountA > 0 && amountB > 0, "Zero amount");

        if (totalLiquidity == 0) {
            liquidityMinted = _sqrt(amountA * amountB);
        } else {
            require(
                amountB == (amountA * reserveB) / reserveA,
                "Ratio mismatch"
            );
            liquidityMinted = (amountA * totalLiquidity) / reserveA;
        }

        reserveA += amountA;
        reserveB += amountB;

        totalLiquidity += liquidityMinted;
        liquidity[msg.sender] += liquidityMinted;

        emit LiquidityAdded(
            msg.sender,
            amountA,
            amountB,
            liquidityMinted
        );
    }

    // =====================
    // REMOVE LIQUIDITY
    // =====================
    function removeLiquidity(uint256 liquidityAmount)
        external
        returns (uint256 amountA, uint256 amountB)
    {
        require(liquidityAmount > 0, "Zero liquidity");
        require(
            liquidity[msg.sender] >= liquidityAmount,
            "Not enough liquidity"
        );

        amountA = (liquidityAmount * reserveA) / totalLiquidity;
        amountB = (liquidityAmount * reserveB) / totalLiquidity;

        liquidity[msg.sender] -= liquidityAmount;
        totalLiquidity -= liquidityAmount;

        reserveA -= amountA;
        reserveB -= amountB;

        emit LiquidityRemoved(
            msg.sender,
            amountA,
            amountB,
            liquidityAmount
        );
    }

    // =====================
    // AMM MATH (0.3% FEE)
    // =====================
    function getAmountOut(
        uint256 amountIn,
        uint256 reserveIn,
        uint256 reserveOut
    ) public pure returns (uint256 amountOut) {
        require(amountIn > 0, "Zero input");
        require(reserveIn > 0 && reserveOut > 0, "No liquidity");

        uint256 amountInWithFee = amountIn * 997;
        uint256 numerator = amountInWithFee * reserveOut;
        uint256 denominator = (reserveIn * 1000) + amountInWithFee;

        amountOut = numerator / denominator;
    }

    // =====================
    // SWAPS
    // =====================
    function swapAForB(uint256 amountAIn)
        external
        returns (uint256 amountBOut)
    {
        require(amountAIn > 0, "Zero swap");

        amountBOut = getAmountOut(amountAIn, reserveA, reserveB);

        reserveA += amountAIn;
        reserveB -= amountBOut;

        emit Swap(
            msg.sender,
            tokenA,
            tokenB,
            amountAIn,
            amountBOut
        );
    }

    function swapBForA(uint256 amountBIn)
        external
        returns (uint256 amountAOut)
    {
        require(amountBIn > 0, "Zero swap");

        amountAOut = getAmountOut(amountBIn, reserveB, reserveA);

        reserveB += amountBIn;
        reserveA -= amountAOut;

        emit Swap(
            msg.sender,
            tokenB,
            tokenA,
            amountBIn,
            amountAOut
        );
    }
        /// @notice Get current price of token A in terms of token B
    /// @return price Current price (reserveB / reserveA)
    function getPrice() external view returns (uint256 price) {
        if (reserveA == 0) {
            return 0;
        }
        price = reserveB / reserveA;
    }

    /// @notice Get current reserves
    /// @return _reserveA Current reserve of token A
    /// @return _reserveB Current reserve of token B
    function getReserves()
        external
        view
        returns (uint256 _reserveA, uint256 _reserveB)
    {
        _reserveA = reserveA;
        _reserveB = reserveB;
    }


    // =====================
    // SQRT HELPER
    // =====================
    function _sqrt(uint256 y) internal pure returns (uint256 z) {
        if (y > 3) {
            z = y;
            uint256 x = y / 2 + 1;
            while (x < z) {
                z = x;
                x = (y / x + x) / 2;
            }
        } else if (y != 0) {
            z = 1;
        }
    }
}
