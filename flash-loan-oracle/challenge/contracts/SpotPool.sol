// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./Asset.sol";

contract SpotPool {
    Asset public immutable weth;
    Asset public immutable usd;

    uint256 public reserveWeth;
    uint256 public reserveUsd;

    constructor(Asset wethToken, Asset usdToken) {
        weth = wethToken;
        usd = usdToken;
    }

    function initialize() external {
        require(reserveWeth == 0 && reserveUsd == 0, "seeded");
        reserveWeth = weth.balanceOf(address(this));
        reserveUsd = usd.balanceOf(address(this));
        require(reserveWeth > 0 && reserveUsd > 0, "empty");
    }

    function wethPrice() public view returns (uint256) {
        return reserveUsd * 1e18 / reserveWeth;
    }

    function swapWethForUsd(uint256 wethIn) external returns (uint256 usdOut) {
        require(reserveWeth > 0 && wethIn > 0, "not ready");
        weth.transferFrom(msg.sender, address(this), wethIn);
        uint256 newWeth = reserveWeth + wethIn;
        uint256 newUsd = ceilDiv(reserveWeth * reserveUsd, newWeth);
        require(newUsd < reserveUsd, "no output");
        usdOut = reserveUsd - newUsd;
        reserveWeth = newWeth;
        reserveUsd = newUsd;
        usd.transfer(msg.sender, usdOut);
    }

    function takeWeth(uint256 wethOut) external returns (uint256 usdIn) {
        require(reserveWeth > wethOut && wethOut > 0, "liquidity");
        uint256 newWeth = reserveWeth - wethOut;
        uint256 newUsd = ceilDiv(reserveWeth * reserveUsd, newWeth);
        usdIn = newUsd - reserveUsd;
        usd.transferFrom(msg.sender, address(this), usdIn);
        reserveWeth = newWeth;
        reserveUsd = newUsd;
        weth.transfer(msg.sender, wethOut);
    }

    function ceilDiv(uint256 a, uint256 b) internal pure returns (uint256) {
        return (a + b - 1) / b;
    }
}
