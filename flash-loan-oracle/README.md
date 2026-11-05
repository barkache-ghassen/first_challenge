# Flash-Loan Price-Oracle Manipulation

**Class:** price-oracle manipulation via flash loan · **Category:** Security · **Difficulty:** hard

## Problem statement

A small DeFi market made of four contracts, one file each in `challenge/contracts/`
(each gets its own tab on the contract page):

- **`Asset`** — minimal ERC-20 used for both `WETH` and `USD`.
- **`SpotPool`** — a constant-product AMM holding 100 WETH / 200,000 USD, so it
  prices 1 WETH at 2,000 USD. Its `wethPrice()` is just the live reserve ratio.
- **`Lender`** — lends out WETH against USD collateral. It values collateral
  using `SpotPool.wethPrice()` **directly, with no TWAP or delay**, and lets you
  borrow up to 50% of your collateral's value. It holds **50 WETH**.
- **`FlashLender`** — lends up to 5,000 WETH in a single transaction, as long as
  it is repaid before the call returns.

The player starts with the four fixed Hardhat accounts, #0 to #3 (1 WETH + 10,000 USD
each). At the fair price that collateral can only borrow a few WETH, and debt is
tracked so you cannot reuse it.

**Objective:** drain the lender. `solved()` returns true (and the flag is
revealed) once `totalBorrowed > 0 && weth.balanceOf(lender) == 0`.

## How to solve it

The lender trusts a **spot** price that you can move within one transaction, and
a flash loan gives you enough WETH to move it hard. All in one atomic callback:

1. **Flash-borrow** ~4,000 WETH from `FlashLender`.
2. **Dump it** into `SpotPool` via `swapWethForUsd`. Reserves skew to mostly
   WETH, so `wethPrice()` (USD per WETH) collapses.
3. At the crashed price your USD is now worth a huge amount of WETH. **Deposit**
   enough USD as collateral and **borrow the lender's entire 50 WETH**.
4. **Swap back** to buy the WETH you need and **repay** the flash loan. The
   borrowed 50 WETH stay with you.

The intended fix (use a manipulation-resistant oracle — TWAP / Chainlink, never a
spot reserve ratio) and the working `Attacker.sol` are described in
[walkthrough.md](walkthrough.md). Note: `Attacker.sol` and `test/` are stripped
from the player image by the `Dockerfile` and `.dockerignore`.
