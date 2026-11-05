# Testing and requirement checklist

This covers two challenges:

- `flash-loan-oracle/`: **Spot The Lender**
- `signature-replay/`: **Signature Replay**

The Approval Trap is in its own PR. The original Welcome challenge in
`challenge/` is the client's baseline and is not covered here (see
[Not covered](#not-covered)).

## Requirements

| # | Client request | Status | Where | Proved by |
|---|---|---|---|---|
| R1 | Challenges with **multiple contracts get one tab per contract** (Spot The Lender was confusing) | Done | Spot The Lender: `Market.sol` split into `Asset`, `SpotPool`, `FlashLender`, `Lender`, each with its own tab (address, live state, source, ABI). Signature Replay has one contract, so no tabs. | Requirements R1 (5 checks); e2e "serves one tab, source and ABI per contract" |
| R1b | Match the **bridged token challenge's** tab layout | Not verified | Our tab design is our own. The bridged-token environment opens as a pop-up, which the in-app browser blocks. | Needs a visual check |
| R2 | **Fixed accounts** in `hardhat.config.js`, the same addresses every time so the HTML never changes | Done | Both `hardhat.config.js` files carry the standard accounts block exactly. The pages list only the 4 player accounts. | Requirements R2 (11) |

### Accounts

| Account | Address | Role |
|---|---|---|
| #0 | `0xbDA5747bFD65F08deb54cb465eB87D40e51B197E` | Player |
| #1 | `0x70997970C51812dc3A010C7d01b50e0d17dc79C8` | Player. The voucher beneficiary in Signature Replay. |
| #2 | `0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC` | Player |
| #3 | `0x90F79bf6EB2c4f870365E785982E1f101E93b906` | Player |
| #4 | `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266` | Hidden deployer, 12.5 ETH |

Ignition deploys from account #0 by default. #0 has only 1 ETH, which can't
fund Signature Replay's 10 ETH vault. So each deploy module sets
`const deployer = m.getAccount(4)` and passes `from: deployer` on every step.
The requirements suite checks that no deploy step is missing an explicit
sender. In Spot The Lender, accounts #0–#3 each get 1 WETH and 10,000 USD.

### Extra safeguards (tested)

- **No solutions in the player image.** Both Dockerfiles remove `test/` and
  `solve.js`, Spot The Lender also removes `Attacker.sol`, and the same files
  are in each `.dockerignore`. `solve.js` is gitignored. Before this branch,
  Signature Replay's image shipped its test file, which contains the solution.
  (Requirements R3, 10 checks)
- **No flag leaks.** `flag.txt` is `chmod 400`, and the API serves only
  whitelisted contract sources. (Requirements R3; e2e)

## Test suites

| Suite | Where | Cases | What it checks |
|---|---|---|---|
| Unit | `<challenge>/challenge/test/` | 3 + 4 | Contract behaviour and the win condition, in-process |
| Requirements | `tests/requirements.test.js` | 26 | R1, R2 and the image safeguards, read straight from the files |
| End-to-end | `tests/e2e.test.js` | 10 | Each challenge started exactly like the image and played through the real API |

Needs Node 22 with npm, and python3; end-to-end also needs network for
`npm ci`. Run everything (about a minute):

```bash
tests/run-all.sh
```

Or one suite at a time:

```bash
cd flash-loan-oracle/challenge && npm ci && npx hardhat test
```

```bash
node --test tests/requirements.test.js
```

```bash
node --test --test-concurrency=1 tests/e2e.test.js
```

End-to-end copies each `challenge/` folder to a temp folder without the files
its Dockerfile strips. It starts it with its own `run_challenge.sh` on spare
ports (RPC 28545, API 23000, page 28000) and plays each scenario from a chain
snapshot taken right after deployment.

### Spot The Lender

- **Unit** (3):
  - The opening price is 2,000 USD per WETH.
  - An honest borrow is capped at 2.5 WETH and can't solve it.
  - The flash-loan attack drains all 50 WETH and repays the flash loan.
- **End-to-end** (6):
  - The opening state is right.
  - The 4 per-contract tabs, sources and ABIs are served. `Attacker.sol` isn't.
  - The image has no `Attacker.sol`.
  - Each of the 4 player accounts has 1 WETH and 10,000 USD.
  - An honest max borrow doesn't solve it.
  - A player-added attack contract solves it, and the flash lender is repaid.

### Signature Replay

- **Unit** (4):
  - One valid voucher pays once.
  - A forged signer and a tampered amount revert.
  - Replaying the voucher 10 times empties the vault.
- **End-to-end** (4):
  - Starts with a 10 ETH vault, funded by the hidden deployer.
  - A tampered amount is rejected.
  - One redeem doesn't solve it.
  - 10 replays empty the vault and return the flag.

## Latest results

Run on 2026-11-05 on macOS (Apple Silicon), Node 22.23.4:

| Suite | Result |
|---|---|
| Unit: flash-loan-oracle | 3 passing |
| Unit: signature-replay | 4 passing |
| Requirements | 26 passing |
| End-to-end | 10 passing |

## Not covered

- **Docker build on `hamonis:base`.** Docker wasn't available. End-to-end
  reproduces what the Dockerfiles do (same files stripped, same
  `run_challenge.sh`), but not the image build or the in-container desktop.
- **The bridged token tab layout** (R1b above).
- **The original Welcome challenge** (`challenge/`). Not changed. With the
  standard accounts config it would fail to deploy, because it sends 1 ETH
  from account #0, which only has 1 ETH.
