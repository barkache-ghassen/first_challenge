const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

const ether = (amount) => BigInt(amount) * 10n ** 18n;

module.exports = buildModule("LenderModule", (m) => {
  // Account #4 is the funded deployer; accounts #0-#3 are the players.
  const deployer = m.getAccount(4);

  const weth = m.contract("Asset", ["Wrapped Ether", "WETH"], { id: "WETH", from: deployer });
  const usd = m.contract("Asset", ["Dollar", "USD"], { id: "USD", from: deployer });
  const pool = m.contract("SpotPool", [weth, usd], { from: deployer });
  const flash = m.contract("FlashLender", [weth], { from: deployer });
  const lender = m.contract("Lender", [weth, usd, pool], { from: deployer });

  const seedPoolWeth = m.call(weth, "mint", [pool, ether(100)], { id: "seedPoolWeth", from: deployer });
  const seedPoolUsd = m.call(usd, "mint", [pool, ether(200000)], { id: "seedPoolUsd", from: deployer });
  m.call(weth, "mint", [flash, ether(5000)], { id: "seedFlash", from: deployer });
  m.call(weth, "mint", [lender, ether(50)], { id: "seedLender", from: deployer });
  m.call(pool, "initialize", [], { id: "initPool", after: [seedPoolWeth, seedPoolUsd], from: deployer });

  for (let i = 0; i <= 3; i++) {
    const account = m.getAccount(i);
    m.call(weth, "mint", [account, ether(1)], { id: `playerWeth${i}`, from: deployer });
    m.call(usd, "mint", [account, ether(10000)], { id: `playerUsd${i}`, from: deployer });
  }

  return { weth, usd, pool, flash, lender };
});
