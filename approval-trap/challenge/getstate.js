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

// How long the drainer bot waits after the airdrop approval before it sweeps the wallet.
const SWEEP_DELAY_SECONDS = Number(process.env.SWEEP_DELAY_SECONDS || 120);

// Solved when the player confirmed the airdrop approval, then revoked it before
// the drainer struck, kept every HMS, and left the legitimate DEX approval alone.
function isSolved({ approvedAirdrop, balance, airdropAllowance, routerAllowance }) {
  return approvedAirdrop
    && airdropAllowance === 0n
    && balance >= START_BALANCE
    && routerAllowance === ROUTER_ALLOWANCE;
}

// What the airdrop site's "Claim 500 HMS" button asks the wallet to confirm:
// not a claim at all, but an unlimited HMS approval for the airdrop contract.
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

function readDeployment() {
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
  return { tokenAddress, routerAddress, airdropAddress };
}

async function getState() {
  const rpcUrl = process.env.RPC_URL || "http://127.0.0.1:8545";
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const { tokenAddress, routerAddress, airdropAddress } = readDeployment();

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

  const airdropLogs = approvalLogs.filter((log) => log.args.spender === airdropAddress);
  const approvedAirdrop = airdropLogs.some((log) => log.args.value > 0n);

  // While the airdrop approval is live, the drainer sweeps SWEEP_DELAY_SECONDS
  // after the approval that set it.
  let sweepAt = null;
  if (airdropAllowance > 0n && airdropLogs.length > 0) {
    const block = await provider.getBlock(airdropLogs[airdropLogs.length - 1].blockNumber);
    sweepAt = block.timestamp + SWEEP_DELAY_SECONDS;
  }

  return {
    wallet: WALLET,
    tokenAddress,
    routerAddress,
    airdropAddress,
    balance: ethers.formatEther(balance),
    airdropAllowance: formatAmount(airdropAllowance),
    routerAllowance: formatAmount(routerAllowance),
    // Every spender the wallet has approved, like revoke.cash lists them.
    approvals: [
      { name: "AirdropClaim", spender: airdropAddress, amount: formatAmount(airdropAllowance) },
      { name: "SwapRouter", spender: routerAddress, amount: formatAmount(routerAllowance) },
    ],
    approvedAirdrop,
    sweepAt,
    secondsLeft: sweepAt === null ? null : Math.max(0, sweepAt - Math.floor(Date.now() / 1000)),
    drained: balance < START_BALANCE,
    pendingRequest: buildPendingRequest(tokenAddress, airdropAddress),
    signed,
    solved: isSolved({ approvedAirdrop, balance, airdropAllowance, routerAllowance }),
    network: rpcUrl,
    chainId: Number(network.chainId),
  };
}

module.exports = getState;
module.exports.isSolved = isSolved;
module.exports.buildPendingRequest = buildPendingRequest;
module.exports.readDeployment = readDeployment;
module.exports.WALLET = WALLET;
