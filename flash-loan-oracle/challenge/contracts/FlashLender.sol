// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./Asset.sol";

interface IFlashBorrower {
    function onFlash(uint256 amount, bytes calldata data) external;
}

contract FlashLender {
    Asset public immutable weth;

    constructor(Asset wethToken) {
        weth = wethToken;
    }

    function flash(uint256 amount, bytes calldata data) external {
        uint256 balanceBefore = weth.balanceOf(address(this));
        require(amount > 0 && amount <= balanceBefore, "liquidity");
        weth.transfer(msg.sender, amount);
        IFlashBorrower(msg.sender).onFlash(amount, data);
        require(weth.balanceOf(address(this)) >= balanceBefore, "repay");
    }
}
