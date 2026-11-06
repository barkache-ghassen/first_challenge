# The Approval Trap

**Class:** Malicious token approval (wallet hygiene / awareness) · **Category:** Security · **Difficulty:** easy

## Problem statement

An awareness challenge with two habits to learn: **check an approval before
confirming it**, and **revoke the ones you shouldn't have given**, for example
with [revoke.cash](https://revoke.cash).

The player's wallet (Account #0, `0xbDA5…197E`) holds **1,000 HMS**.

- **A request is waiting to be confirmed.** The "HMS Community Airdrop" site's
  *Claim 500 HMS bonus* button has put a transaction in the wallet. The
  **Wallet request** tab shows it the way a wallet does: From, To, Value and
  raw Data. It claims to be a bonus claim. Decoded, it is
  `approve(AirdropClaim, unlimited)`, sent to the HMS token.
- **The wallet already fell for it once.** Before the challenge starts it
  signed two approvals on the HMS token. The **What you signed** tab shows
  their raw calldata:
  - **50 HMS** to `SwapRouter`, the DEX the player actually uses.
  - **Unlimited** HMS to `AirdropClaim`, the same fake airdrop.

No tokens have moved yet, which is the point: an approval looks harmless when
you sign it. Each contract (`HamonisToken`, `SwapRouter`, `AirdropClaim`) has
its own tab with its address, live allowance and source. The overview points
to revoke.cash for real-world clean-up.

**Objective:** don't confirm the pending request, and revoke the existing
dangerous approval without losing any HMS and without touching the legitimate
DEX approval. The solve API returns the flag while all of these hold:

- `allowance(wallet, AirdropClaim) == 0`
- `balanceOf(wallet) >= 1000 HMS`
- `allowance(wallet, SwapRouter) == 50 HMS`

**Ways to lose:**

- Calling the airdrop's `claim()` sweeps the whole balance to the attacker and
  pays no bonus. The page says "Wallet drained" and the challenge has to be
  restarted.
- Confirming the pending request, even after revoking, hands the unlimited
  approval straight back, so the challenge is no longer solved.
- Revoking every approval in a panic fails too: the router approval must stay.

## How to solve it

1. Open **Wallet request**. `To` is the HMS token, not the airdrop. The data
   starts with selector `0x095ea7b3`, which is `approve(address,uint256)`. The
   arguments are the `AirdropClaim` address and `0xfff…fff`
   (`type(uint256).max`, unlimited). A claim never needs that, so don't send it.
2. Open **What you signed**. Both past transactions are the same `approve`
   call. The first gives `SwapRouter` `0x2b5e3af16b1880000` (50e18). The
   second gives `AirdropClaim` unlimited.
3. Read `AirdropClaim.sol`. `claim()` and `sweep()` both `transferFrom` your
   whole balance to `collector`. The bonus is never paid.
4. From Account #0, call `HamonisToken.approve(<AirdropClaim>, 0)`.

Full solve, the real-world lesson and how to test locally are in
[walkthrough.md](walkthrough.md).


docker build -t hamonis:ApprovalTrap .

docker run -d -p 8080:8080 --name Hamonis-ApprovalTrap hamonis:ApprovalTrap

docker save -o ApprovalTrap.tar hamonis:ApprovalTrap
