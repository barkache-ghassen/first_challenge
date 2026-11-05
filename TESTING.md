# Testing and requirement checklist

This covers the three challenges on the `add-security-challenges` branch:

- `approval-trap/`: **The Approval Trap** (new, easy)
- `flash-loan-oracle/`: **Spot The Lender**
- `signature-replay/`: **Signature Replay**

The original Welcome challenge in `challenge/` is the client's baseline. It is
not covered here (see [Not covered](#not-covered)).

## Requirements

Each request from the client, where it's implemented, and which tests prove it.
Test IDs refer to the suites described under [Test suites](#test-suites).

| # | Client request | Status | Where | Proved by |
|---|---|---|---|---|
| R1 | An easy "awareness" challenge named **the approval trap** | Done | `approval-trap/` | Requirements R1 (4 checks); every unit and e2e test in approval-trap |
| R2 | Explain that users must **check the approval from a malicious contract before confirming** the transaction | Done | Wallet request tab (pending "Claim 500 HMS" prompt with raw To/Data), What you signed tab, overview steps, README, walkthrough | Requirements R2 (5); unit "pending wallet request" (3); e2e tests 4, 5 and 8 |
| R3 | **Point players to revoke.cash** to revoke approvals | Done | Overview tab ("In the real world" card with link), README, walkthrough | Requirements R3 (2) |
| R4 | Challenges with **multiple contracts get one tab per contract** (Spot The Lender was confusing) | Done | Spot The Lender: `Market.sol` split into `Asset`, `SpotPool`, `FlashLender`, `Lender`, each with its own tab. Approval Trap: `HamonisToken`, `SwapRouter`, `AirdropClaim` tabs. Signature Replay has one contract, so no tabs. | Requirements R4 (9); e2e "serves one tab, source and ABI per contract" in both challenges |
| R4b | Match the **bridged token challenge's** tab layout | Not verified | Our tab design is our own. I couldn't view the bridged-token page: its environment opens as a pop-up, which the in-app browser blocks. | Needs a visual check by you |
| R5 | **Fixed accounts** in `hardhat.config.js`, the same addresses every time so the HTML never changes | Done | All three `hardhat.config.js` files carry your accounts block exactly (4 players at 1 ETH, then the 12.5 ETH account). The pages list only the 4 players. | Requirements R5 (16); unit "accounts" (2) |

### Notes on R5 (accounts)

Your snippet has **5** entries: the 4 player accounts plus a 12.5 ETH account.
The 5th (`0xf39F…2266`) is used only as the **deployer** and is never shown on
a page, so players see exactly 4 addresses:

| Account | Address | Role |
|---|---|---|
| #0 | `0xbDA5747bFD65F08deb54cb465eB87D40e51B197E` | Player. The wallet in The Approval Trap. |
| #1 | `0x70997970C51812dc3A010C7d01b50e0d17dc79C8` | Player. The voucher beneficiary in Signature Replay. |
| #2 | `0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC` | Player |
| #3 | `0x90F79bf6EB2c4f870365E785982E1f101E93b906` | Player |
| #4 | `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266` | Hidden deployer, 12.5 ETH |

Hardhat Ignition deploys from account #0 by default. #0 has only 1 ETH, which
can't fund Signature Replay's 10 ETH vault. So every deploy module sets
`const deployer = m.getAccount(4)` and passes `from: deployer` on each step.
The requirements suite checks that no deploy step is missing an explicit sender.

### Extra safeguards (not requested, but tested)

- **No solutions in the player image.** Every Dockerfile removes `test/` and
  `solve.js`, Spot The Lender also removes `Attacker.sol`, and the same files
  are in each `.dockerignore`. `solve.js` is gitignored. Before this branch,
  Signature Replay's image shipped its test file, which contains the solution;
  that's fixed. (Requirements R6, 14 checks)
- **No flag leaks.** `flag.txt` is `chmod 400`. The API serves only
  whitelisted contract sources, so `/contracts/..%2fflag.txt` returns 404. The
  flag is never written into the page. (Requirements R1 and R6; e2e approval-trap test 3)

## Test suites

| Suite | Where | Cases | Needs | What it checks |
|---|---|---|---|---|
| Unit | `<challenge>/challenge/test/` | 24 + 3 + 4 | `npm ci` per challenge | Contract behaviour and the win condition, in-process (no servers) |
| Requirements | `tests/requirements.test.js` | 50 | `npm ci` in `approval-trap/challenge` (for ethers) | The client's requirements (R1–R5) and the image safeguards (R6), read straight from the files |
| End-to-end | `tests/e2e.test.js` | 21 | node/npm, python3, network for `npm ci` | Each challenge started exactly like the image and played through the real API |

### Prerequisites

Node 22 with npm, and python3. On this Mac, Node lives in `~/.local/node/bin`,
which isn't on PATH by default:

```bash
export PATH="$HOME/.local/node/bin:$PATH"
```

### Run everything

```bash
tests/run-all.sh
```

That runs the unit tests for all three challenges, then the requirement checks,
then end-to-end. It takes about 2 minutes. It stops with a non-zero exit at the
first failing suite. To skip end-to-end:

```bash
SKIP_E2E=1 tests/run-all.sh
```

### Run one suite

```bash
cd approval-trap/challenge && npx hardhat test
```

```bash
node --test tests/requirements.test.js
```

```bash
node --test --test-concurrency=1 tests/e2e.test.js
```

### How end-to-end works

For each challenge the suite:

1. Copies `challenge/` to a temp folder without the files its Dockerfile
   strips (`test/`, `solve.js`, `Attacker.sol`) or build output.
2. Starts it with the challenge's own `run_challenge.sh`, with no manual
   steps. That does `npm ci`, starts the Hardhat node, deploys with Ignition,
   and starts the API and page servers. It uses spare ports
   (RPC 28545, API 23000, page 28000), so an instance already running on
   8545/3000/8000 isn't affected.
3. Takes a chain snapshot after deployment and reverts to it before every
   scenario, so each one starts from the real initial state.
4. Plays as a player: plain ethers wallets signing with the keys shown on the
   page, checking `/status` and `/check-solved` after each step.
5. Stops everything and deletes the temp folder.

## What each suite covers

### The Approval Trap

**Unit tests** (`approval-trap/challenge/test/ApprovalTrap.js`, 24):

| Group | Cases |
|---|---|
| Accounts | Account #0 is `0xbDA5…`. Exactly 5 accounts, in the client's order. |
| Starting state | Wallet holds 1,000 HMS, the deployer holds none. Router approval is 50 HMS. Airdrop approval is unlimited. Starts unsolved. |
| HamonisToken | `approve` overwrites and emits `Approval`. Bounded allowances decrease. Unlimited never decreases. Over-allowance reverts. |
| SwapRouter | Deposit and withdraw within the 50 HMS approval work. 51 HMS reverts. |
| AirdropClaim | `claim()` sends everything to the collector and pays no bonus. `sweep()` is collector-only. It's capped by the allowance. It takes nothing after a revoke. |
| Pending request | Sent to the token, not the airdrop. Decodes to `approve(AirdropClaim, unlimited)`. Confirming it after revoking hands the approval back. |
| Win condition | Revoking only the airdrop solves it. Each of these doesn't: revoking the router too, lowering the approval instead of zeroing it, revoking after being drained, moving the HMS away instead of revoking. |

**End-to-end** (11):

| # | Scenario | Expected |
|---|---|---|
| 1 | Fresh start | 1,000 HMS, unlimited and 50 approvals, unsolved, no flag |
| 2 | Page | Serves all 7 tabs (Overview, Wallet request, What you signed, 3 contracts, Accounts) |
| 3 | API | Source and ABI for each contract. `flag.txt` and path traversal return 404. |
| 4 | Pending request | Decodes to `approve(AirdropClaim, unlimited)`, To = token |
| 5 | Signed history | 2 past `approve` transactions from the wallet to the token |
| 6 | **Solve**: revoke the airdrop only | Flag returned |
| 7 | **Trap**: call `claim()` | Balance 0, `drained: true`, no flag |
| 8 | **Trap**: revoke, then confirm the pending request | Approval unlimited again, no flag |
| 9 | Revoke both approvals | No flag |
| 10 | Player calls the attacker's `sweep()` | Reverts, balance untouched |
| 11 | Account #1 revokes its own (non-existent) approval | No flag, since only account #0 counts |

### Spot The Lender

- **Unit** (3): the opening price is 2,000. An honest borrow is capped at 2.5
  WETH and can't solve it. The flash-loan attack drains all 50 WETH and repays
  the flash loan.
- **End-to-end** (6):
  - The opening state is right.
  - The 4 per-contract tabs, sources and ABIs are served. `Attacker.sol` isn't served.
  - The image has no `Attacker.sol`.
  - Each of the 4 player accounts has 1 WETH and 10,000 USD.
  - An honest max borrow doesn't solve it.
  - A player-added attack contract solves it, and the flash lender is repaid.

### Signature Replay

- **Unit** (4): one valid voucher pays once. A forged signer and a tampered
  amount revert. Replaying the voucher 10 times empties the vault.
- **End-to-end** (4):
  - Starts with a 10 ETH vault, funded by the hidden deployer.
  - A tampered amount is rejected.
  - One redeem doesn't solve it.
  - 10 replays empty the vault and return the flag.

## Latest results

Run on 2026-11-05 on macOS (Apple Silicon), Node 22.23.4:

| Suite | Result |
|---|---|
| Unit: approval-trap | 24 passing |
| Unit: flash-loan-oracle | 3 passing |
| Unit: signature-replay | 4 passing |
| Requirements | 50 passing |
| End-to-end | 21 passing (about 55 s) |

The page itself was also checked in a browser for each challenge:
- every tab opens and loads its source,
- the ABI buttons work,
- the flag appears once solved, and "Wallet drained" appears after the trap,
- there are no console errors while the API is up.

## Manual test: The Approval Trap in a browser

```bash
cd approval-trap/challenge && rm -rf ignition/deployments && ./run_challenge.sh
```

Wait for `Challenge running on http://127.0.0.1:3000`, then open
http://localhost:8000. In a second terminal:

```bash
cd approval-trap/challenge && npx hardhat console --network localhost
```

The console's default signer is Account #0 (the wallet). Contract addresses are
the same on every fresh start.

```js
const token = await ethers.getContractAt("HamonisToken", "0x5FbDB2315678afecb367f032d93F642f64180aa3")
const airdrop = await ethers.getContractAt("AirdropClaim", "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512")
const ROUTER = "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0"
```

| Try | Command | Page should show |
|---|---|---|
| Solve | `await token.approve(airdrop, 0)` | "Challenge solved" and the flag within ~3 s |
| Confirm the request after solving | `await token.approve(airdrop, ethers.MaxUint256)` | Flag disappears. Airdrop tab shows `unlimited` again. |
| Panic-revoke | `await token.approve(airdrop, 0); await token.approve(ROUTER, 0)` | No flag |
| Fall for the trap | `await airdrop.claim()` | "Wallet drained. Restart the challenge to try again." |

To reset, stop `run_challenge.sh` with Ctrl+C and run the start command again.
The `rm -rf ignition/deployments` matters: without it, Ignition reuses the old
deployment record on the new chain.

## Not covered

- **Docker build on `hamonis:base`.** Docker isn't installed on this machine
  and the base image isn't available. End-to-end reproduces what the
  Dockerfiles do (same files stripped, same `run_challenge.sh`), but not the
  image build itself or the in-container desktop and Firefox.
- **A real browser wallet.** Players send transactions with Hardhat or ethers;
  no wallet extension was tested.
- **The bridged token tab layout** (R4b above).
- **The original Welcome challenge** (`challenge/`). Not changed. With the new
  accounts config it would fail to deploy, because it sends 1 ETH from
  account #0, which only has 1 ETH. Its page also still lists a 5th key
  (`0x47e1…`) that isn't in the config.

## Known quirks when scripting a player

Under Hardhat automine, an ethers `Wallet` can read a stale nonce right after
a receipt and fail with "nonce has already been used". The end-to-end suite
counts nonces itself to avoid this. Players using `npx hardhat console` or
`npx hardhat run` won't hit it.
