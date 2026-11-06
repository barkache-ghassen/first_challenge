const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

const ether = (amount) => BigInt(amount) * 10n ** 18n;

// Where the drainer sends stolen tokens. Nobody holds this key.
const COLLECTOR = "0x000000000000000000000000000000000000bad1";

module.exports = buildModule("ApprovalTrapModule", (m) => {
  // Account #4 is the funded deployer and also runs the drainer bot (it owns
  // AirdropClaim); account #0 is the player's wallet.
  const deployer = m.getAccount(4);
  const wallet = m.getAccount(0);

  const token = m.contract("HamonisToken", [ether(1000)], { from: deployer });
  const router = m.contract("SwapRouter", [token], { from: deployer });
  const airdrop = m.contract("AirdropClaim", [token, COLLECTOR], { from: deployer });

  const fund = m.call(token, "transfer", [wallet, ether(1000)], { from: deployer, id: "fundWallet" });

  // The wallet starts with one bounded approval for the DEX it uses. The
  // airdrop approval is what the player confirms during the challenge.
  m.call(token, "approve", [router, ether(50)], {
    from: wallet, id: "approveRouter", after: [fund],
  });

  return { token, router, airdrop };
});
