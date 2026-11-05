// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title SignatureVault
/// @notice A vault that pays out ETH to anyone who presents a withdrawal
///         "voucher" signed by the trusted operator. The operator signs a
///         message authorizing a payment of `amount` to `to`, and the vault
///         releases the funds after checking the signature.
///
///         The operator signed exactly one voucher: 1 ether to the player's
///         account. The vault holds far more than that. Your job is to empty it.
contract SignatureVault {
    /// @notice Address whose signatures the vault trusts (the operator).
    address public immutable operator;

    /// @notice Total ETH the vault has paid out across all redemptions.
    uint256 public totalReleased;

    event Redeemed(address indexed to, uint256 amount);

    constructor(address _operator) payable {
        operator = _operator;
    }

    /// @notice Redeem a withdrawal voucher signed by the operator.
    /// @param to      Beneficiary the operator authorized.
    /// @param amount  Amount of ETH the operator authorized.
    /// @param v,r,s   The operator's signature over the voucher.
    function redeem(address to, uint256 amount, uint8 v, bytes32 r, bytes32 s) external {
        // The voucher is a signature over keccak256(abi.encodePacked(to, amount)),
        // using the standard EIP-191 personal-message prefix.
        bytes32 message = keccak256(abi.encodePacked(to, amount));
        bytes32 digest = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", message)
        );

        require(ecrecover(digest, v, r, s) == operator, "bad signature");

        totalReleased += amount;
        (bool ok, ) = to.call{value: amount}("");
        require(ok, "payout failed");

        emit Redeemed(to, amount);
    }

    /// @notice Challenge is solved once the vault has been fully drained.
    function solved() external view returns (bool) {
        return totalReleased > 0 && address(this).balance == 0;
    }

    receive() external payable {}
}
