# The Approval Trap walkthrough

This note is for reviewers. It is not copied into the challenge image.

## Setup

- Hardhat accounts come from the fixed `hardhat.config.js`. Account #4
  (`0xf39F…2266`, 12.5 ETH) deploys everything, owns `AirdropClaim`, and runs
  the drainer bot. It is not shown to players. Account #0 (`0xbDA5…197E`) is
  the player's wallet.
- `HamonisToken` (HMS) mints 1,000 HMS to the deployer, who sends all of it to
  Account #0. Account #0 then approves `SwapRouter` for a bounded 50 HMS. That
  is the only approval at launch.
- `AirdropClaim.collector` is `0x…bad1`, an address nobody holds a key for.
  Stolen HMS end up there.
- `server.js` is the challenge API. Besides `/status` and `/check-solved` it
  runs:
  - `POST /wallet/confirm`: sends the wallet request
    (`approve(AirdropClaim, type(uint256).max)` to the token) from Account #0.
    This is the page's **Confirm** button, standing in for a wallet extension.
  - `POST /wallet/reject`: sends nothing.
  - `POST /wallet/revoke {spender}`: sends `approve(spender, 0)` from
    Account #0. Only the two known spenders are accepted. These are the
    **Revoke** buttons on the Approvals tab.
  - **The drainer bot**: a 1-second loop. Once the airdrop approval has been
    live for `SWEEP_DELAY_SECONDS` (default 120), it calls
    `AirdropClaim.sweep(wallet)` from Account #4.
- The countdown is derived from the chain: the block time of the latest
  airdrop approval plus `SWEEP_DELAY_SECONDS`. So it survives page reloads
  and API restarts, and re-approving after a revoke starts a new countdown.

The win check lives in `getstate.js` (`isSolved`). It reads on-chain state
only, live on every request: an `Approval(wallet, AirdropClaim, >0)` event
exists, the airdrop allowance is 0, the balance is still 1,000 HMS, and the
router allowance is still 50 HMS. Nothing latches, so re-approving the airdrop
after solving un-solves it.

## The vulnerability

There's no contract bug here. The weakness is the user. An ERC20 approval
gives a spender standing permission to call `transferFrom` on your wallet. It:

- moves no tokens when signed, so nothing looks wrong,
- stays active until you overwrite it, and
- when "unlimited", covers every token you hold now **and later**.

The airdrop's "claim" is that approval in disguise. Once it's given,
`sweep(wallet)` lets the attacker take everything whenever they like. The
advertised 500 HMS bonus is never paid.

## Solve

**Step 1, Airdrop.** Click **Claim 500 HMS**. It opens the wallet request.

**Step 2, Confirm.** Read the request before clicking. `To` is the token
(`0x5FbD…0aa3`), not the airdrop. The data decodes as:

```
0x095ea7b3                                                         approve(address,uint256)
000000000000000000000000e7f1725e7734ce288f8367e1bb143e90bb3f0512   spender = AirdropClaim
ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff   amount  = unlimited
```

Click **Confirm**. The page shows that no bonus arrived and that you just
approved an unlimited amount. A red banner starts the countdown.

**Step 3, Revoke before the funds are stolen.** On **3 · Approvals**, click
**Revoke** on `AirdropClaim`. Or send the revoke from Account #0 yourself:

```js
// npx hardhat console --network localhost   (default signer is Account #0)
const token = await ethers.getContractAt("HamonisToken", "0x5FbDB2315678afecb367f032d93F642f64180aa3")
await token.approve("0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512", 0)
```

The banner turns green, and the flag shows on the Overview tab and from
`/check-solved`. It's stored only in `challenge/flag.txt`.

Ways to fail:

- Let the countdown run out: the drainer sweeps all 1,000 HMS. The page shows
  "The drainer swept your wallet" and the challenge has to be restarted.
  Revoking after that doesn't bring the HMS back.
- Revoke the router as well. The lesson is to identify the bad spender, not
  to panic-revoke everything.
- Revoke without ever confirming. Nothing was at risk, so that isn't a solve.

## What players should take away

- Before confirming any wallet prompt, read the **spender** and the
  **amount**. A claim, mint or "verification" never needs to spend your tokens.
- Prefer exact-amount approvals over unlimited ones.
- Check and clean up existing approvals with
  [revoke.cash](https://revoke.cash). It lists every spender your address has
  approved, across tokens and chains, and sends the `approve(spender, 0)` (or
  `setApprovalForAll(operator, false)` for NFTs) for you.
- If you clicked something suspicious, revoke first and investigate after.
  Drainer bots act within minutes or seconds.

## Testing it locally

Unit tests (28 cases, no servers needed):

```bash
cd approval-trap/challenge && npm ci && npx hardhat test
```

To play it in a browser, start everything with `./run_challenge.sh` from
`approval-trap/challenge` (it needs a fresh `ignition/deployments`, so
`rm -rf ignition/deployments` first on a re-run), then open
http://localhost:8000. Set `SWEEP_DELAY_SECONDS` before starting to change the
countdown, for example `SWEEP_DELAY_SECONDS=30 ./run_challenge.sh`.

The repo-wide requirement and end-to-end suites are described in
[../TESTING.md](../TESTING.md).
