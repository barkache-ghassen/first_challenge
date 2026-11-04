// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

/// @title Hamonis Swap router
/// @notice The DEX you actually use. It only pulls the amount you deposit,
///         and you approved it for a bounded 50 HMS.
contract SwapRouter {
    IERC20 public immutable token;
    mapping(address => uint256) public deposits;

    constructor(IERC20 _token) {
        token = _token;
    }

    function deposit(uint256 amount) external {
        token.transferFrom(msg.sender, address(this), amount);
        deposits[msg.sender] += amount;
    }

    function withdraw(uint256 amount) external {
        require(deposits[msg.sender] >= amount, "not enough deposited");
        deposits[msg.sender] -= amount;
        token.transfer(msg.sender, amount);
    }
}
