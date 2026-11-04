const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");

const LENDER_ABI = [
  "function solved() view returns (bool)",
  "function weth() view returns (address)",
  "function usd() view returns (address)",
  "function pool() view returns (address)",
];
const POOL_ABI = [
  "function reserveWeth() view returns (uint256)",
  "function reserveUsd() view returns (uint256)",
  "function wethPrice() view returns (uint256)",
];
const ERC20_ABI = ["function balanceOf(address) view returns (uint256)"];

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
  const wethAddress = data["LenderModule#WETH"];
  const usdAddress = data["LenderModule#USD"];
  const poolAddress = data["LenderModule#SpotPool"];
  const flashAddress = data["LenderModule#FlashLender"];
  const lenderAddress = data["LenderModule#Lender"];
  if (!wethAddress || !usdAddress || !poolAddress || !flashAddress || !lenderAddress) {
    throw new Error("Lender deployment is missing");
  }

  const lender = new ethers.Contract(lenderAddress, LENDER_ABI, provider);
  const pool = new ethers.Contract(poolAddress, POOL_ABI, provider);
  const weth = new ethers.Contract(wethAddress, ERC20_ABI, provider);
  const [solved, lenderWeth, flashWeth, reserveWeth, reserveUsd, wethPrice] = await Promise.all([
    lender.solved(),
    weth.balanceOf(lenderAddress),
    weth.balanceOf(flashAddress),
    pool.reserveWeth(),
    pool.reserveUsd(),
    pool.wethPrice(),
  ]);
  const network = await provider.getNetwork();

  return {
    wethAddress,
    usdAddress,
    poolAddress,
    flashAddress,
    lenderAddress,
    lenderWeth: ethers.formatEther(lenderWeth),
    flashWeth: ethers.formatEther(flashWeth),
    reserveWeth: ethers.formatEther(reserveWeth),
    reserveUsd: ethers.formatEther(reserveUsd),
    wethPrice: ethers.formatEther(wethPrice),
    solved,
    network: rpcUrl,
    chainId: Number(network.chainId),
  };
}

module.exports = getState;
