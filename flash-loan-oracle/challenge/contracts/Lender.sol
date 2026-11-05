// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./Asset.sol";
import "./SpotPool.sol";

contract Lender {
    Asset public immutable weth;
    Asset public immutable usd;
    SpotPool public immutable pool;

    mapping(address => uint256) public collateral;
    mapping(address => uint256) public debt;
    uint256 public totalBorrowed;

    constructor(Asset wethToken, Asset usdToken, SpotPool spotPool) {
        weth = wethToken;
        usd = usdToken;
        pool = spotPool;
    }

    function deposit(uint256 amount) external {
        require(amount > 0, "zero");
        usd.transferFrom(msg.sender, address(this), amount);
        collateral[msg.sender] += amount;
    }

    function maxBorrow(address account) public view returns (uint256) {
        uint256 price = pool.wethPrice();
        if (price == 0) return 0;
        uint256 capacity = collateral[account] * 1e18 / price / 2;
        if (capacity <= debt[account]) return 0;
        return capacity - debt[account];
    }

    function borrow(uint256 amount) external {
        require(amount > 0 && amount <= weth.balanceOf(address(this)), "liquidity");
        require(amount <= maxBorrow(msg.sender), "collateral");
        debt[msg.sender] += amount;
        totalBorrowed += amount;
        weth.transfer(msg.sender, amount);
    }

    function solved() external view returns (bool) {
        return totalBorrowed > 0 && weth.balanceOf(address(this)) == 0;
    }
}
