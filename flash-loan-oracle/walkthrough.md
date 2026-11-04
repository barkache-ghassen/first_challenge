# Spot Lender walkthrough

This note is for reviewers. The Dockerfile does not copy it into the image, and it also removes `contracts/Attacker.sol` and `test/` from the image.

The lender holds 50 WETH. Borrowing capacity is 50% of USD collateral, valued with `SpotPool.wethPrice()`, which is the current reserve ratio. Accounts #0 through #3 each start with 1 WETH and 10,000 USD. At the starting price of 2,000 USD per WETH, that collateral can borrow 2.5 WETH, and debt is recorded so the same collateral cannot be borrowed twice.

`FlashLender` will send WETH to a contract and require repayment before the call returns. `SpotPool` has no fee. Selling WETH into the pool moves the reserve price. The lender reads that price with no delay and no average.

One working sequence, implemented in `contracts/Attacker.sol` for local tests:

1. Flash-borrow 4,000 WETH.
2. Sell that WETH into the spot pool. The reported WETH price collapses.
3. Deposit enough of the resulting USD into the lender to cover 50 WETH at the new price, then borrow the lender's entire WETH balance.
4. Buy the 4,000 WETH back from the pool and repay the flash loan.

The borrowed 50 WETH remain. `Lender.solved()` is true only when the lender has an outstanding borrow and holds no WETH. The flag is stored only in `challenge/flag.txt`.
