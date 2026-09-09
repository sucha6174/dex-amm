// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title MockERC20
 * @author KALARI SRISUCHA (sucha6174)
 * @notice Mock ERC-20 token implementation for local testing and testbed deployments.
 * @dev Mints 1,000,000 tokens (18 decimals) to the deployer upon initialization
 *      and exposes a public mint function for test signers.
 */
contract MockERC20 is ERC20 {
    /**
     * @notice Deploys MockERC20 and mints 1,000,000 initial tokens to deployer
     * @param name Name of the ERC-20 token
     * @param symbol Symbol of the ERC-20 token
     */
    constructor(string memory name, string memory symbol)
        ERC20(name, symbol)
    {
        _mint(msg.sender, 1000000 * 10**18);
    }

    /**
     * @notice Mints specified amount of tokens to target address
     * @param to Recipient address
     * @param amount Amount of tokens to mint (in wei)
     */
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
