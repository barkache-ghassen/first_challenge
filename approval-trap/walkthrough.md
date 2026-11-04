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

The win check lives in `getstate.js` (`isSolved`) and reads on-chain state only.

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
- Revoking the router as well fails the check. The lesson is to identify the
  bad spender, not to panic-revoke everything.

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
