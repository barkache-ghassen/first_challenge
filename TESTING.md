# Testing and requirement checklist: The Approval Trap

Covers `approval-trap/` (**The Approval Trap**, easy awareness challenge).

## Requirements

Each request from the client, where it's implemented, and which tests prove it.

| # | Client request | Status | Where | Proved by |
|---|---|---|---|---|
| R1 | An easy "awareness" challenge named **the approval trap** | Done | `approval-trap/` | Requirements R1 (4 checks); every unit and e2e test |
| R2 | Explain that users must **check the approval from a malicious contract before confirming** the transaction | Done | Wallet request tab (pending "Claim 500 HMS" prompt with raw To/Data), What you signed tab, overview steps, README, walkthrough | Requirements R2 (5); unit "pending wallet request" (3); e2e tests 4, 5 and 8 |
| R3 | **Point players to revoke.cash** to revoke approvals | Done | Overview tab ("In the real world" card with link), README, walkthrough | Requirements R3 (2) |
| R4 | **One tab per contract** when a challenge has several | Done | Tabs for `HamonisToken`, `SwapRouter`, `AirdropClaim`, each with address, live allowance, source and ABI | Requirements R4 (3); e2e tests 2 and 3 |
| R5 | **Fixed accounts** in `hardhat.config.js` so the HTML never changes | Done | `hardhat.config.js` carries the standard accounts block exactly. The page lists only the 4 player accounts. | Requirements R5 (6); unit "accounts" (2) |

### Accounts

| Account | Address | Role |
|---|---|---|
| #0 | `0xbDA5747bFD65F08deb54cb465eB87D40e51B197E` | The player's wallet |
| #1 | `0x70997970C51812dc3A010C7d01b50e0d17dc79C8` | Player |
| #2 | `0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC` | Player |
| #3 | `0x90F79bf6EB2c4f870365E785982E1f101E93b906` | Player |
| #4 | `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266` | Hidden deployer, 12.5 ETH |

Ignition deploys from account #0 by default, which has only 1 ETH. So the
deploy module sets `const deployer = m.getAccount(4)` and passes an explicit
sender on every step. The requirements suite checks that none is missing.

### Extra safeguards (tested)

- **No solution in the player image.** The Dockerfile removes `test/` and
  `solve.js`, both are in `.dockerignore`, and `solve.js` is gitignored.
  (Requirements R6)
- **No flag leaks.** `flag.txt` is `chmod 400`. The API serves only
  whitelisted contract sources, so `/contracts/..%2fflag.txt` returns 404. The
  flag is never written into the page. (Requirements R1 and R6; e2e test 3)

## Test suites

| Suite | Where | Cases | What it checks |
|---|---|---|---|
| Unit | `approval-trap/challenge/test/ApprovalTrap.js` | 24 | Contract behaviour and the win condition, in-process |
| Requirements | `tests/requirements.test.js` | 25 | R1–R5 and the image safeguards, read straight from the files |
| End-to-end | `tests/e2e.test.js` | 11 | The challenge started exactly like the image and played through the real API |

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

End-to-end copies `approval-trap/challenge` to a temp folder without the files
the Dockerfile strips. It starts it with its own `run_challenge.sh` on spare
ports (RPC 28545, API 23000, page 28000), so an instance on 8545/3000/8000
isn't affected. It then plays each scenario from a chain snapshot taken right
after deployment.

### Unit tests (24)

| Group | Cases |
|---|---|
| Accounts | Account #0 is `0xbDA5…`. Exactly 5 accounts, in the client's order. |
| Starting state | Wallet holds 1,000 HMS, the deployer holds none. Router approval is 50 HMS. Airdrop approval is unlimited. Starts unsolved. |
| HamonisToken | `approve` overwrites and emits `Approval`. Bounded allowances decrease. Unlimited never decreases. Over-allowance reverts. |
| SwapRouter | Deposit and withdraw within the 50 HMS approval work. 51 HMS reverts. |
| AirdropClaim | `claim()` sends everything to the collector and pays no bonus. `sweep()` is collector-only. It's capped by the allowance. It takes nothing after a revoke. |
| Pending request | Sent to the token, not the airdrop. Decodes to `approve(AirdropClaim, unlimited)`. Confirming it after revoking hands the approval back. |
| Win condition | Revoking only the airdrop solves it. Each of these doesn't: revoking the router too, lowering the approval instead of zeroing it, revoking after being drained, moving the HMS away instead of revoking. |

### End-to-end (11)

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

## Manual test in a browser

```bash
cd approval-trap/challenge && rm -rf ignition/deployments && ./run_challenge.sh
```

Wait for `Challenge running on http://127.0.0.1:3000`, open
http://localhost:8000, then in a second terminal:

```bash
cd approval-trap/challenge && npx hardhat console --network localhost
```

The console's default signer is Account #0, the wallet.

```js
const token = await ethers.getContractAt("HamonisToken", "0x5FbDB2315678afecb367f032d93F642f64180aa3")
const airdrop = await ethers.getContractAt("AirdropClaim", "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512")
const ROUTER = "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0"
```

| Try | Command | Page should show |
|---|---|---|
| Solve | `await token.approve(airdrop, 0)` | "Challenge solved" and the flag within ~3 s |
| Confirm the request after solving | `await token.approve(airdrop, ethers.MaxUint256)` | Flag disappears |
| Panic-revoke | `await token.approve(airdrop, 0); await token.approve(ROUTER, 0)` | No flag |
| Fall for the trap | `await airdrop.claim()` | "Wallet drained. Restart the challenge to try again." |

To reset, stop with Ctrl+C and run the start command again. The
`rm -rf ignition/deployments` matters: without it, Ignition reuses the old
deployment record on the new chain.

## Not covered

- **Docker build on `hamonis:base`.** Docker wasn't available. End-to-end
  reproduces what the Dockerfile does (same files stripped, same
  `run_challenge.sh`), but not the image build or the in-container desktop.
- **A real browser wallet extension.**
- **The original Welcome challenge** (`challenge/`) is unchanged. With the
  standard accounts config it would fail to deploy, because it sends 1 ETH
  from account #0, which only has 1 ETH.
