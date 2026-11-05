const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

const ether = (amount) => BigInt(amount) * 10n ** 18n;
const UNLIMITED = 2n ** 256n - 1n;

// Where the drainer sends stolen tokens. Nobody holds this key.
const COLLECTOR = "0x000000000000000000000000000000000000bad1";

module.exports = buildModule("ApprovalTrapModule", (m) => {
  // Account #4 is the funded deployer; account #0 is the player's wallet.
  const deployer = m.getAccount(4);
  const wallet = m.getAccount(0);

  const token = m.contract("HamonisToken", [ether(1000)], { from: deployer });
  const router = m.contract("SwapRouter", [token], { from: deployer });
  const airdrop = m.contract("AirdropClaim", [token, COLLECTOR], { from: deployer });

  const fund = m.call(token, "transfer", [wallet, ether(1000)], { from: deployer, id: "fundWallet" });

  // The two approvals the wallet "signed" before the challenge starts:
  // a bounded one for the DEX it uses, then an unlimited one from a phishing airdrop.
  const approveRouter = m.call(token, "approve", [router, ether(50)], {
    from: wallet, id: "approveRouter", after: [fund],
  });
  m.call(token, "approve", [airdrop, UNLIMITED], {
    from: wallet, id: "approveAirdrop", after: [approveRouter],
  });

  return { token, router, airdrop };
});
