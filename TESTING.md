# Testing and requirement checklist: The Approval Trap

Covers `approval-trap/` (**The Approval Trap**, easy awareness challenge).

## Requirements

Each request from the client, where it's implemented, and which tests prove it.

| # | Client request | Status | Where | Proved by |
|---|---|---|---|---|
| R1 | An easy "awareness" challenge named **the approval trap** | Done | `approval-trap/` | Requirements R1 (4 checks); every unit and e2e test |
| R2 | **Show all the steps**: the user receives an airdrop, confirms the approval, sees they approved a big amount, then must revoke it before the funds are stolen | Done | Tabs **1 · Airdrop** (Claim button), **2 · Wallet request** (working Confirm and Reject, raw To/Data), **3 · Approvals** (revoke.cash-style list with working Revoke buttons). Red "You approved UNLIMITED HMS" banner with a countdown. A drainer bot sweeps the wallet when the countdown ends. | Requirements R2 (11); unit "step 2", "drainer" and "step 3" groups (13); e2e tests 4–13 |
| R3 | **Point players to revoke.cash** | Done | Overview tab ("In the real world" card), Approvals tab, README, walkthrough | Requirements R3 (2) |
| R4 | **One tab per contract** when a challenge has several | Done | Tabs for `HamonisToken`, `SwapRouter`, `AirdropClaim`, each with address, live allowance, source and ABI | Requirements R4 (3); e2e tests 2 and 3 |
| R5 | **Fixed accounts** in `hardhat.config.js` so the HTML never changes | Done | `hardhat.config.js` carries the standard accounts block exactly. The page lists only the 4 player accounts. | Requirements R5 (6); unit "accounts" (2) |

### How the steps work

| Step | Player sees | What happens on-chain |
|---|---|---|
| Start | 1,000 HMS; one approval (SwapRouter, 50 HMS) | Deploy: token, router, airdrop; wallet funded; router approved |
| 1 · Airdrop | "Your wallet is eligible for 500 HMS", **Claim** | Nothing yet; Claim opens the wallet request |
| 2 · Wallet request | From / To / Value / raw Data, **Confirm** and **Reject** | Confirm sends `approve(AirdropClaim, 2^256-1)` from Account #0 (`POST /wallet/confirm`). Reject sends nothing. |
| After confirming | "Confirmed. You didn't claim anything… unlimited", red banner "You approved UNLIMITED HMS… sweep your wallet in 01:59" | No bonus is paid. The countdown is the approval's block time + `SWEEP_DELAY_SECONDS` (default 120). |
| 3 · Approvals | AirdropClaim **High: unlimited** and SwapRouter **Bounded 50**, each with **Revoke** | Revoke sends `approve(spender, 0)` from Account #0 (`POST /wallet/revoke`), or the player sends it with their own tools |
| Revoked in time | Green banner, flag on the Overview tab | Allowance 0, balance 1,000, router 50: solved |
| Too late | "The drainer swept your wallet" | The server's bot calls `AirdropClaim.sweep(wallet)` from Account #4, the contract's owner. Restart needed. |

### Accounts

| Account | Address | Role |
|---|---|---|
| #0 | `0xbDA5747bFD65F08deb54cb465eB87D40e51B197E` | The player's wallet |
| #1 | `0x70997970C51812dc3A010C7d01b50e0d17dc79C8` | Player |
| #2 | `0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC` | Player |
| #3 | `0x90F79bf6EB2c4f870365E785982E1f101E93b906` | Player |
| #4 | `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266` | Hidden deployer and drainer bot, 12.5 ETH |

Ignition deploys from account #0 by default, which has only 1 ETH. So the
deploy module sets `const deployer = m.getAccount(4)` and passes an explicit
sender on every step. The requirements suite checks that none is missing.

`hardhat.config.js` adds one line to the standard block:
`allowBlocksWithSameTimestamp: true`. Without it, Hardhat adds a second to the
block timestamp for every transaction mined within the same second, so chain
time runs ahead of the real clock. The drainer countdown is measured against
chain time, so it would run long. The accounts are unchanged.

### Extra safeguards (tested)

- **No solution in the player image.** The Dockerfile removes `test/` and
  `solve.js`, both are in `.dockerignore`, and `solve.js` is gitignored.
  (Requirements R6)
- **No flag leaks.** `flag.txt` is `chmod 400`. The API serves only
  whitelisted contract sources, so `/contracts/..%2fflag.txt` returns 404. The
  flag is never written into the page. (Requirements R1 and R6; e2e test 3)
- **The page's wallet endpoints are narrow.** `/wallet/revoke` accepts only
  the two known spenders, so anything else returns 400. `/wallet/confirm`
  only ever sends the one airdrop approval. (e2e test 12)

## Test suites

| Suite | Where | Cases | What it checks |
|---|---|---|---|
| Unit | `approval-trap/challenge/test/ApprovalTrap.js` | 28 | Contract behaviour and the win condition, in-process |
| Requirements | `tests/requirements.test.js` | 31 | R1–R5 and the image safeguards, read straight from the files |
| End-to-end | `tests/e2e.test.js` | 13 | The challenge started exactly like the image and played through the real API, including the drainer bot |

Needs Node 22 with npm, and python3. End-to-end also needs network for
`npm ci`. Run everything (about a minute):

```bash
tests/run-all.sh
```

Or one suite at a time:

```bash
cd approval-trap/challenge && npm ci && npx hardhat test
```

```bash
node --test tests/requirements.test.js
```

```bash
node --test --test-concurrency=1 tests/e2e.test.js
```

How end-to-end runs:
- It copies `approval-trap/challenge` to a temp folder, without the files the
  Dockerfile strips.
- It starts the copy with its own `run_challenge.sh`, with
  `SWEEP_DELAY_SECONDS=6` so the "too late" path takes seconds instead of
  minutes.
- It uses spare ports (RPC 28545, API 23000, page 28000), so an instance on
  8545/3000/8000 isn't affected.
- Every scenario starts from a chain snapshot taken right after deployment.
  After each revert it pins the next block to wall time, because `evm_revert`
  pushes Hardhat's clock ahead.
- `E2E_KEEP=1` keeps the temp folder and its `e2e.log` for debugging.

### Unit tests (28)

| Group | Cases |
|---|---|
| Accounts | Account #0 is `0xbDA5…`. Exactly 5 accounts, in the client's order. |
| Starting state | Wallet holds 1,000 HMS, the deployer holds none. Router approval is 50 HMS. No airdrop approval yet. Starts unsolved. The drainer is owned by hidden account #4. |
| HamonisToken | `approve` overwrites and emits `Approval`. Bounded allowances decrease. Unlimited never decreases. Over-allowance reverts. |
| SwapRouter | Deposit and withdraw within the 50 HMS approval work. 51 HMS reverts. |
| Step 2: wallet request | Sent to the token, not the airdrop. Decodes to `approve(AirdropClaim, unlimited)`. Confirming pays no bonus and grants the unlimited approval. |
| The drainer | The owner's `sweep()` takes everything after an approval. `sweep()` is owner-only. `claim()` drains too. It takes nothing after a revoke, or if the wallet never approved. |
| Step 3: win condition | Confirming then revoking only the airdrop solves it. Each of these doesn't: never confirming, revoking the router too, lowering instead of zeroing, revoking after being drained, moving the HMS away. Re-confirming after a revoke un-solves it until revoked again. |

### End-to-end (13)

| # | Scenario | Expected |
|---|---|---|
| 1 | Fresh start | 1,000 HMS, only the 50 HMS router approval, no countdown, unsolved |
| 2 | Page | Serves Overview, the 3 step tabs, What you signed, 3 contract tabs and Accounts; Claim/Confirm/Reject buttons, approvals table and alert banner exist |
| 3 | API | Source and ABI for each contract. `flag.txt` and path traversal return 404. |
| 4 | Step 2 request | Decodes to `approve(AirdropClaim, unlimited)`, To = token |
| 5 | Step 2 **Reject** | Nothing sent, allowance stays 0 |
| 6 | Step 2 **Confirm** | Unlimited approval, balance still 1,000, countdown running (≤ 6 s), no flag |
| 7 | Step 3 **Revoke** in time (page) | Flag returned. Countdown cleared. Still 1,000 HMS after the countdown would have ended. |
| 8 | Step 3 revoke with the player's own transaction | Flag returned |
| 9 | **Too late**: countdown ends | Drainer sweeps all HMS, `drained: true`, no flag, and revoking afterwards doesn't help |
| 10 | Revoke both approvals | No flag |
| 11 | Revoke without ever confirming | No flag |
| 12 | Revoke an unknown spender | 400 |
| 13 | Player calls the drainer's `sweep()` | Reverts, balance untouched |

## Manual test in a browser

```bash
cd approval-trap/challenge && rm -rf ignition/deployments && ./run_challenge.sh
```

Wait for `Challenge running on http://127.0.0.1:3000`, then open
http://localhost:8000. Use `SWEEP_DELAY_SECONDS=30 ./run_challenge.sh` for a
shorter countdown.

| Try | Do | Page should show |
|---|---|---|
| Step 1 | **1 · Airdrop** → Claim 500 HMS | Opens 2 · Wallet request |
| Reject | Click Reject | Green "Rejected… that's the right call" note; nothing changes |
| Step 2 | Click Confirm | "Confirmed. You didn't claim anything…", red banner with a 2:00 countdown |
| Step 3 | **3 · Approvals** → Revoke on AirdropClaim | Green banner, flag on Overview |
| Too late | Confirm and wait for the countdown | "The drainer swept your wallet", balance 0 |
| Panic-revoke | Revoke both rows | No flag (the router must stay) |

To reset, stop with Ctrl+C and run the start command again. The
`rm -rf ignition/deployments` matters: without it, Ignition reuses the old
deployment record on the new chain.

## Not covered

- **Docker build on `hamonis:base`.** Docker wasn't available. End-to-end
  reproduces what the Dockerfile does (same files stripped, same
  `run_challenge.sh`), but not the image build or the in-container desktop.
- **A real browser wallet extension.** The page's Confirm and Revoke buttons
  sign through the challenge API with Account #0's key, standing in for one.
- **The original Welcome challenge** (`challenge/`) is unchanged. With the
  standard accounts config it would fail to deploy, because it sends 1 ETH
  from account #0, which only has 1 ETH.
