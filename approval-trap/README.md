# The Approval Trap

**Class:** Malicious token approval (wallet hygiene / awareness) · **Category:** Security · **Difficulty:** easy

## Problem statement

The player's wallet (Account #0, `0xbDA5…197E`) holds **1,000 HMS**. Before
the challenge starts it has already signed two approvals on the HMS token:

- **50 HMS** to `SwapRouter`, the DEX the player actually uses.
- **Unlimited** HMS to `AirdropClaim`, a "free 500 HMS airdrop" that asked the
  wallet to "approve once to verify eligibility".

No tokens have moved yet, which is the point: an approval looks harmless when
you sign it. The contract page shows the raw calldata of both signed
transactions, one tab per contract (`HamonisToken`, `SwapRouter`,
`AirdropClaim`), and a pointer to [revoke.cash](https://revoke.cash).

**Objective:** revoke the dangerous approval without losing any HMS and without
touching the legitimate DEX approval. The solve API returns the flag when:

- `allowance(wallet, AirdropClaim) == 0`
- `balanceOf(wallet) >= 1000 HMS`
- `allowance(wallet, SwapRouter) == 50 HMS`

Calling the airdrop's `claim()` is the trap. It sweeps the whole balance to the
attacker and pays no bonus, so the player has to restart the challenge.

## How to solve it

1. Open **What you signed**. Both transactions go to the HMS token, and both
   start with selector `0x095ea7b3`, which is `approve(address,uint256)`.
2. Decode the arguments. The first approves `SwapRouter` for
   `0x2b5e3af16b1880000` (50e18). The second approves `AirdropClaim` for
   `0xfff…fff` (`type(uint256).max`, unlimited).
3. Read `AirdropClaim.sol`. `claim()` and `sweep()` both `transferFrom` your
   whole balance to `collector`. The bonus is never paid.
4. From Account #0, call `HamonisToken.approve(<AirdropClaim>, 0)`.

Full solve and the real-world lesson are in [walkthrough.md](walkthrough.md).
