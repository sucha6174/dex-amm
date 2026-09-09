// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title DEX
 * @author KALARI SRISUCHA (sucha6174)
 * @notice Decentralized Exchange implementing an Automated Market Maker (AMM)
 *         based on the constant product formula (x * y = k) with a 0.3% trading fee.
 * @dev Employs OpenZeppelin SafeERC20 for secure token transfers and ReentrancyGuard
 *      for reentrancy attack mitigation following Checks-Effects-Interactions.
 */
contract DEX is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // =========================================================================
    // STATE VARIABLES
    // =========================================================================

    /// @notice Address of the first ERC-20 token in the pair
    address public immutable tokenA;

    /// @notice Address of the second ERC-20 token in the pair
    address public immutable tokenB;

    /// @notice Current pool reserve of Token A
    uint256 public reserveA;

    /// @notice Current pool reserve of Token B
    uint256 public reserveB;

    /// @notice Total supply of liquidity pool (LP) shares minted
    uint256 public totalLiquidity;

    /// @notice LP share balance mapping for each liquidity provider
    mapping(address => uint256) public liquidity;

    // =========================================================================
    // EVENTS
    // =========================================================================

    /**
     * @notice Emitted when liquidity is deposited into the pool
     * @param provider Address of the liquidity provider
     * @param amountA Amount of Token A deposited
     * @param amountB Amount of Token B deposited
     * @param liquidityMinted Amount of LP tokens minted to provider
     */
    event LiquidityAdded(
        address indexed provider,
        uint256 amountA,
        uint256 amountB,
        uint256 liquidityMinted
    );

    /**
     * @notice Emitted when liquidity is withdrawn from the pool
     * @param provider Address of the liquidity provider withdrawing assets
     * @param amountA Amount of Token A returned
     * @param amountB Amount of Token B returned
     * @param liquidityBurned Amount of LP tokens burned
     */
    event LiquidityRemoved(
        address indexed provider,
        uint256 amountA,
        uint256 amountB,
        uint256 liquidityBurned
    );

    /**
     * @notice Emitted upon successful execution of a token swap
     * @param trader Address of the user executing the swap
     * @param tokenIn Address of the token supplied to the pool
     * @param tokenOut Address of the token received from the pool
     * @param amountIn Amount of input token transferred in
     * @param amountOut Amount of output token transferred out
     */
    event Swap(
        address indexed trader,
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 amountOut
    );

    // =========================================================================
    // CONSTRUCTOR
    // =========================================================================

    /**
     * @notice Initializes the DEX with the pair of ERC-20 tokens
     * @param _tokenA Address of Token A contract
     * @param _tokenB Address of Token B contract
     */
    constructor(address _tokenA, address _tokenB) {
        require(_tokenA != address(0), "TokenA zero address");
        require(_tokenB != address(0), "TokenB zero address");
        require(_tokenA != _tokenB, "Identical token addresses");

        tokenA = _tokenA;
        tokenB = _tokenB;
    }

    // =========================================================================
    // LIQUIDITY MANAGEMENT
    // =========================================================================

    /**
     * @notice Deposits Token A and Token B into the pool and mints LP shares
     * @dev For initial liquidity, sets initial price and mints sqrt(amountA * amountB).
     *      For subsequent additions, strictly enforces the current pool reserve ratio
     *      and mints proportional LP shares: (amountA * totalLiquidity) / reserveA.
     * @param amountA Amount of Token A to add
     * @param amountB Amount of Token B to add
     * @return liquidityMinted Amount of LP shares minted to caller
     */
    function addLiquidity(uint256 amountA, uint256 amountB)
        external
        nonReentrant
        returns (uint256 liquidityMinted)
    {
        require(amountA > 0 && amountB > 0, "Zero amount");

        if (totalLiquidity == 0) {
            liquidityMinted = _sqrt(amountA * amountB);
            require(liquidityMinted > 0, "Zero liquidity minted");
        } else {
            // Strict ratio enforcement to prevent pool manipulation and dilution
            uint256 amountBOptimal = (amountA * reserveB) / reserveA;
            require(amountB >= amountBOptimal, "Insufficient B amount");
            require(amountB == amountBOptimal, "Ratio mismatch");
            liquidityMinted = (amountA * totalLiquidity) / reserveA;
            require(liquidityMinted > 0, "Zero liquidity minted");
        }

        // State updates (Checks-Effects)
        reserveA += amountA;
        reserveB += amountB;
        totalLiquidity += liquidityMinted;
        liquidity[msg.sender] += liquidityMinted;

        emit LiquidityAdded(msg.sender, amountA, amountB, liquidityMinted);

        // Safe token transfers (Interactions)
        IERC20(tokenA).safeTransferFrom(msg.sender, address(this), amountA);
        IERC20(tokenB).safeTransferFrom(msg.sender, address(this), amountB);
    }

    /**
     * @notice Burns LP shares to withdraw proportional amounts of Token A and Token B
     * @dev Follows Checks-Effects-Interactions pattern. Withdraws accumulated fees proportionally.
     * @param liquidityAmount Amount of LP shares to burn
     * @return amountA Amount of Token A returned to caller
     * @return amountB Amount of Token B returned to caller
     */
    function removeLiquidity(uint256 liquidityAmount)
        external
        nonReentrant
        returns (uint256 amountA, uint256 amountB)
    {
        require(liquidityAmount > 0, "Zero liquidity");
        require(liquidity[msg.sender] >= liquidityAmount, "Not enough LP");

        amountA = (liquidityAmount * reserveA) / totalLiquidity;
        amountB = (liquidityAmount * reserveB) / totalLiquidity;
        require(amountA > 0 && amountB > 0, "Insufficient liquidity burned");

        // State updates (Checks-Effects)
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

        // Safe token transfers (Interactions)
        IERC20(tokenA).safeTransfer(msg.sender, amountA);
        IERC20(tokenB).safeTransfer(msg.sender, amountB);
    }

    // =========================================================================
    // AMM MATH (0.3% FEE)
    // =========================================================================

    /**
     * @notice Calculates output amount for a given input with 0.3% trading fee applied
     * @dev Standard Uniswap V2 constant product formula:
     *      amountInWithFee = amountIn * 997
     *      numerator = amountInWithFee * reserveOut
     *      denominator = (reserveIn * 1000) + amountInWithFee
     *      amountOut = numerator / denominator
     * @param amountIn Amount of input tokens
     * @param reserveIn Current pool reserve of input token
     * @param reserveOut Current pool reserve of output token
     * @return amountOut Calculated amount of output tokens to receive
     */
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

    // =========================================================================
    // SWAPS
    // =========================================================================

    /**
     * @notice Swaps Token A for Token B using the AMM curve
     * @param amountAIn Amount of Token A provided by the trader
     * @return amountBOut Amount of Token B received by the trader
     */
    function swapAForB(uint256 amountAIn)
        external
        nonReentrant
        returns (uint256 amountBOut)
    {
        require(amountAIn > 0, "Zero input");
        require(reserveA > 0 && reserveB > 0, "No liquidity");

        amountBOut = getAmountOut(amountAIn, reserveA, reserveB);
        require(amountBOut > 0, "Insufficient output");
        require(amountBOut < reserveB, "Insufficient liquidity");

        // State updates (Checks-Effects)
        reserveA += amountAIn;
        reserveB -= amountBOut;

        emit Swap(msg.sender, tokenA, tokenB, amountAIn, amountBOut);

        // Safe token transfers (Interactions)
        IERC20(tokenA).safeTransferFrom(msg.sender, address(this), amountAIn);
        IERC20(tokenB).safeTransfer(msg.sender, amountBOut);
    }

    /**
     * @notice Swaps Token B for Token A using the AMM curve
     * @param amountBIn Amount of Token B provided by the trader
     * @return amountAOut Amount of Token A received by the trader
     */
    function swapBForA(uint256 amountBIn)
        external
        nonReentrant
        returns (uint256 amountAOut)
    {
        require(amountBIn > 0, "Zero input");
        require(reserveA > 0 && reserveB > 0, "No liquidity");

        amountAOut = getAmountOut(amountBIn, reserveB, reserveA);
        require(amountAOut > 0, "Insufficient output");
        require(amountAOut < reserveA, "Insufficient liquidity");

        // State updates (Checks-Effects)
        reserveB += amountBIn;
        reserveA -= amountAOut;

        emit Swap(msg.sender, tokenB, tokenA, amountBIn, amountAOut);

        // Safe token transfers (Interactions)
        IERC20(tokenB).safeTransferFrom(msg.sender, address(this), amountBIn);
        IERC20(tokenA).safeTransfer(msg.sender, amountAOut);
    }

    // =========================================================================
    // VIEW FUNCTIONS
    // =========================================================================

    /**
     * @notice Computes current price of Token A in terms of Token B scaled by 1e18
     * @dev Uses a 1e18 multiplier before division to preserve precision and prevent
     *      integer division truncation when reserveB < reserveA.
     *      Returns 0 gracefully when reserveA == 0.
     * @return price Price of 1 full unit (1e18) of Token A in units of Token B (scaled by 1e18)
     */
    function getPrice() external view returns (uint256 price) {
        if (reserveA == 0) {
            return 0;
        }
        price = (reserveB * 1e18) / reserveA;
    }

    /**
     * @notice Retrieves the current pool reserves for both tokens
     * @return _reserveA Current reserve balance of Token A
     * @return _reserveB Current reserve balance of Token B
     */
    function getReserves()
        external
        view
        returns (uint256 _reserveA, uint256 _reserveB)
    {
        return (reserveA, reserveB);
    }

    // =========================================================================
    // INTERNAL HELPERS
    // =========================================================================

    /**
     * @notice Computes the square root of an integer using the Babylonian method
     * @param y Number to compute square root of
     * @return z Integer square root of y
     */
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
