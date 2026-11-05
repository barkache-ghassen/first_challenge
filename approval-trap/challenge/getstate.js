const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");

const TOKEN_ABI = [
  "event Approval(address indexed owner, address indexed spender, uint256 value)",
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
];
const APPROVE = new ethers.Interface(["function approve(address spender, uint256 amount)"]);

// The player's wallet (account #0) and what it held when the challenge started.
const WALLET = "0xbDA5747bFD65F08deb54cb465eB87D40e51B197E";
const START_BALANCE = ethers.parseEther("1000");
const ROUTER_ALLOWANCE = ethers.parseEther("50");

// Solved when the drainer's approval is revoked, no HMS was lost, and the
// legitimate DEX approval was left as it was.
function isSolved({ balance, airdropAllowance, routerAllowance }) {
  return airdropAllowance === 0n
    && balance >= START_BALANCE
    && routerAllowance === ROUTER_ALLOWANCE;
}

// The airdrop site's "Claim 500 HMS" button asks the wallet to confirm this.
// It is the same unlimited approval again; the player should decode it and not send it.
function buildPendingRequest(tokenAddress, airdropAddress) {
  return {
    site: "HMS Community Airdrop",
    label: "Claim 500 HMS bonus",
    from: WALLET,
    to: tokenAddress,
    value: "0",
    data: APPROVE.encodeFunctionData("approve", [airdropAddress, ethers.MaxUint256]),
  };
}

function formatAmount(value) {
  return value === ethers.MaxUint256 ? "unlimited" : ethers.formatEther(value);
}

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
  const tokenAddress = data["ApprovalTrapModule#HamonisToken"];
  const routerAddress = data["ApprovalTrapModule#SwapRouter"];
  const airdropAddress = data["ApprovalTrapModule#AirdropClaim"];
  if (!tokenAddress || !routerAddress || !airdropAddress) {
    throw new Error("Approval trap deployment is missing");
  }

  const token = new ethers.Contract(tokenAddress, TOKEN_ABI, provider);
  const [balance, airdropAllowance, routerAllowance, approvalLogs, network] = await Promise.all([
    token.balanceOf(WALLET),
    token.allowance(WALLET, airdropAddress),
    token.allowance(WALLET, routerAddress),
    token.queryFilter(token.filters.Approval(WALLET), 0, "latest"),
    provider.getNetwork(),
  ]);

  // Raw transactions the wallet signed that touched an approval, oldest first.
  // Shown undecoded, the way a wallet confirmation screen shows calldata.
  const signed = await Promise.all(approvalLogs.map(async (log) => {
    const tx = await provider.getTransaction(log.transactionHash);
    return { hash: tx.hash, block: tx.blockNumber, from: tx.from, to: tx.to, data: tx.data };
  }));

  const pendingRequest = buildPendingRequest(tokenAddress, airdropAddress);

  return {
    wallet: WALLET,
    tokenAddress,
    routerAddress,
    airdropAddress,
    balance: ethers.formatEther(balance),
    airdropAllowance: formatAmount(airdropAllowance),
    routerAllowance: formatAmount(routerAllowance),
    drained: balance < START_BALANCE,
    pendingRequest,
    signed,
    solved: isSolved({ balance, airdropAllowance, routerAllowance }),
    network: rpcUrl,
    chainId: Number(network.chainId),
  };
}

module.exports = getState;
module.exports.isSolved = isSolved;
module.exports.buildPendingRequest = buildPendingRequest;
