# Signature Replay

**Class:** ECDSA signature replay · **Category:** Security · **Difficulty:** intermediate

## Problem statement

`SignatureVault` holds **10 ETH** and releases funds to anyone who presents a
withdrawal *voucher* signed by the trusted **operator**. A voucher is the
operator's signature over `keccak256(abi.encodePacked(to, amount))` (EIP-191
prefixed), and `redeem(to, amount, v, r, s)` pays `amount` to `to` after checking
the signature recovers to the operator.

The operator signed **exactly one** voucher — **1 ETH to Account #1** — and that
voucher `(v, r, s)` is handed to the player on the contract page. The operator's
private key is never exposed.

**Objective:** empty the vault. `solved()` returns true (and the flag is
revealed) once `totalReleased > 0 && address(this).balance == 0`.

## How to solve it

`redeem()` verifies the signature but records **no nonce and no
used-signature flag**, so the same voucher is valid forever. Submit the one
published voucher repeatedly:

1. Read `challenge/contracts/Vault.sol` and notice `redeem()` has no replay guard.
2. Call `redeem(0x7099…79C8, 1 ether, v, r, s)` with the published voucher.
3. Repeat the identical call **10 times**. Each pays out 1 ETH until the vault
   is drained to 0.

A single call only moves the 1 ETH the operator authorized; the bug is that the
signature can be *replayed*. Full solve script and the intended fix (nonce /
used-digest mapping / EIP-712 domain binding) are in [walkthrough.md](walkthrough.md).
