const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");

const VAULT_ABI = [
  "function operator() view returns (address)",
  "function totalReleased() view returns (uint256)",
  "function solved() view returns (bool)",
];

// The single voucher the operator signed. It authorizes 1 ETH to Hardhat
// account #1 (a well-known funded dev account the player controls on chain
// 31337). This is public information handed to the player.
const VOUCHER = {
  to: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
  amount: "1000000000000000000",
  v: 28,
  r: "0xee133ccdc3556d276a3e656cb36182de5b123157bc771a4b0d7146e9eb07b139",
  s: "0x48b87b28fd2bc9c43db7522e63a4b5ae7fdb5d7fae7e71886f21c544fa8ffbcd",
  signature:
    "0xee133ccdc3556d276a3e656cb36182de5b123157bc771a4b0d7146e9eb07b13948b87b28fd2bc9c43db7522e63a4b5ae7fdb5d7fae7e71886f21c544fa8ffbcd1c",
};

async function getState() {
  const rpcUrl = process.env.RPC_URL || "http://127.0.0.1:8545";
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const deploymentsPath = path.join(
    __dirname,
    "ignition",
    "deployments",
    "chain-31337",
    "deployed_addresses.json"
  );
  const data = JSON.parse(fs.readFileSync(deploymentsPath, "utf8"));
  const vaultAddress = data["VaultModule#SignatureVault"];
  if (!vaultAddress) {
    throw new Error("Vault deployment is missing");
  }

  const vault = new ethers.Contract(vaultAddress, VAULT_ABI, provider);
  const [operator, totalReleased, solved, balance, network] = await Promise.all([
    vault.operator(),
    vault.totalReleased(),
    vault.solved(),
    provider.getBalance(vaultAddress),
    provider.getNetwork(),
  ]);

  return {
    vaultAddress,
    operator,
    totalReleased: totalReleased.toString(),
    balance: balance.toString(),
    solved,
    voucher: VOUCHER,
    network: rpcUrl,
    chainId: Number(network.chainId),
  };
}

module.exports = getState;
