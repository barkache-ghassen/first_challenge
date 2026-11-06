# The Approval Trap

**Class:** Malicious token approval (wallet hygiene / awareness) · **Category:** Security · **Difficulty:** easy

## Problem statement

An awareness challenge that walks the player through a real phishing pattern:
a "free airdrop" that asks for an **approval**, and the clean-up afterwards
with a revoke tool like [revoke.cash](https://revoke.cash).

The player's wallet (Account #0, `0xbDA5…197E`) holds **1,000 HMS**. It starts
with one approval: a bounded **50 HMS** to `SwapRouter`, the DEX the player
actually uses.

The page plays out the attack in three steps, each with its own tab:

1. **Airdrop.** "Congratulations! Your wallet is eligible for 500 HMS." The
   player clicks **Claim 500 HMS**.
2. **Wallet request: Confirm.** The wallet prompt shows what will really be
   sent: From, To, Value and raw Data. It's not a claim. It's
   `approve(AirdropClaim, unlimited)`, sent to the HMS token. The player
   clicks **Confirm**, as most people do without reading. No bonus arrives,
   and the page shows that the player just approved an **unlimited** amount.
3. **Revoke before the funds are stolen.** A red banner starts a
   **countdown** (2 minutes by default). When it reaches zero, the airdrop
   owner's drainer bot calls `sweep()` and takes every HMS. The player opens
   the **Approvals** tab (a revoke.cash-style list of spenders with their
   allowance and risk) and revokes the dangerous approval in time.

**Objective:** the solve API returns the flag once all of these hold:

- the airdrop approval was given (step 2 happened),
- `allowance(wallet, AirdropClaim) == 0` (it was revoked),
- `balanceOf(wallet) >= 1000 HMS` (the drainer didn't get there first),
- `allowance(wallet, SwapRouter) == 50 HMS` (the legitimate approval was left alone).

**Ways to lose:**

- The countdown runs out: the wallet is swept and the challenge has to be
  restarted.
- The player revokes every approval in a panic: the router approval must stay.

The player can revoke from the page's Approvals tab, or from their own tools
by calling `approve(AirdropClaim, 0)` on the token from Account #0. Each
contract (`HamonisToken`, `SwapRouter`, `AirdropClaim`) also has its own tab
with its address, live allowance and source.

## How to solve it

1. **1 · Airdrop**: click **Claim 500 HMS**.
2. **2 · Wallet request**: read the request. `To` is the HMS token. The data
   starts with selector `0x095ea7b3`, which is `approve(address,uint256)`. The
   arguments are the `AirdropClaim` address and `0xfff…fff` (unlimited). Click
   **Confirm**. The countdown starts.
3. **3 · Approvals**: click **Revoke** on `AirdropClaim` (High: unlimited)
   before the countdown ends. Leave `SwapRouter` alone. The banner turns
   green and the flag appears on the Overview tab.

Full solve, the real-world lesson and how to test locally are in
[walkthrough.md](walkthrough.md).


docker build -t hamonis:ApprovalTrap .

docker run -d -p 8080:8080 --name Hamonis-ApprovalTrap hamonis:ApprovalTrap

docker save -o ApprovalTrap.tar hamonis:ApprovalTrap
