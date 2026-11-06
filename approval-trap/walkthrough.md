# The Approval Trap walkthrough

This note is for reviewers. It is not copied into the challenge image.

## Setup

- Hardhat accounts come from the fixed `hardhat.config.js`. Account #4
  (`0xf39F…2266`, 12.5 ETH) deploys everything and is not shown to players.
  Account #0 (`0xbDA5…197E`) is the player's wallet.
- `HamonisToken` (HMS) mints 1,000 HMS to the deployer, who sends all of it to
  Account #0.
- Account #0 then signs two approvals during deployment:
  1. `approve(SwapRouter, 50 HMS)`, a bounded approval for a DEX it uses.
  2. `approve(AirdropClaim, type(uint256).max)`, from the phishing "airdrop".
- `AirdropClaim.collector` is `0x…bad1`, an address nobody holds a key for.
- The page's **Wallet request** tab shows one pending request from the airdrop
  site, labelled "Claim 500 HMS bonus". It is built by `buildPendingRequest()`
  in `getstate.js`: `to` = the HMS token, `data` =
  `approve(AirdropClaim, type(uint256).max)`. The page can't sign anything;
  "confirming" it means sending that exact transaction from Account #0.

The win check lives in `getstate.js` (`isSolved`) and reads on-chain state
only, live on every request. Nothing latches, so re-approving the airdrop
after solving un-solves it.

## The vulnerability

There's no contract bug here. The weakness is the user. An ERC20 approval
gives a spender standing permission to call `transferFrom` on your wallet. It:

- moves no tokens when signed, so nothing looks wrong,
- stays active until you overwrite it, and
- when "unlimited", covers every token you hold now **and later**.

`AirdropClaim.claim()` uses the allowance to sweep your full balance to the
collector. `sweep(wallet)` lets the attacker do it whenever they like. The
advertised 500 HMS bonus is never paid.

## Solve

First, check the pending request before confirming it. `To` is the token
(`0x5FbD…0aa3`), not the airdrop, and its data decodes exactly like the
second signed transaction below. It is a request for an unlimited approval,
not a claim, so the right move is to reject it, which means simply not
sending it.

Decode the second signed transaction:

```
0x095ea7b3                                                         approve(address,uint256)
000000000000000000000000e7f1725e7734ce288f8367e1bb143e90bb3f0512   spender = AirdropClaim
ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff   amount  = unlimited
```

Then revoke it from Account #0:

```js
const { ethers } = require("ethers");
const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
const wallet = new ethers.Wallet(
  "0x689af8efa8c651a91ad287602527f3af2fe9f6501a7ac4b061667b5a93e037fd",
  provider
);
const token = new ethers.Contract(
  TOKEN_ADDRESS,
  ["function approve(address,uint256) returns (bool)"],
  wallet
);
await (await token.approve(AIRDROP_ADDRESS, 0)).wait();
```

The page and `/check-solved` then show the flag. It's stored only in
`challenge/flag.txt`.

Ways to fail:

- Calling `claim()` drains the wallet. The page shows "Wallet drained" and the
  challenge has to be restarted.
- Confirming the pending request re-grants the unlimited approval, so the
  check fails again until it's revoked.
- Revoking the router as well fails the check. The lesson is to identify the
  bad spender, not to panic-revoke everything.

## Testing it locally

Unit tests (24 cases, no servers needed):

```bash
cd approval-trap/challenge && npm ci && npx hardhat test
```

To play it in a browser, start everything with `./run_challenge.sh` from
`approval-trap/challenge` (it needs a fresh `ignition/deployments`, so
`rm -rf ignition/deployments` first on a re-run), then open
http://localhost:8000. Send transactions from a second terminal with
`npx hardhat console --network localhost`. Its default signer is Account #0.

```js
const token = await ethers.getContractAt("HamonisToken", "0x5FbDB2315678afecb367f032d93F642f64180aa3")
await token.approve("0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512", 0)   // solve
```

The repo-wide requirement and end-to-end suites are described in
[../TESTING.md](../TESTING.md).

## What players should take away

- Before confirming any wallet prompt, read the **spender** and the
  **amount**. A claim, mint or "verification" never needs to spend your tokens.
- Prefer exact-amount approvals over unlimited ones.
- Check and clean up existing approvals with
  [revoke.cash](https://revoke.cash). It lists every spender your address has
  approved, across tokens and chains, and sends the `approve(spender, 0)` (or
  `setApprovalForAll(operator, false)` for NFTs) for you.
- If you clicked something suspicious, revoke first and investigate after. An
  attacker holding an approval can strike at any time.
