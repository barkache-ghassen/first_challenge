const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");
const getState = require("./getstate");
const { readDeployment, buildPendingRequest } = getState;

const FLAG = fs.readFileSync(path.join(__dirname, "flag.txt"), "utf8").trim();
const CONTRACTS = ["HamonisToken", "AirdropClaim", "SwapRouter"];
const RPC_URL = process.env.RPC_URL || "http://127.0.0.1:8545";

// Account #0 is the player's wallet (its key is on the page anyway): the page's
// Confirm and Revoke buttons send from it, the way a wallet extension would.
// Account #4 owns AirdropClaim and plays the attacker's drainer bot.
const WALLET_KEY = "0x689af8efa8c651a91ad287602527f3af2fe9f6501a7ac4b061667b5a93e037fd";
const DRAINER_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const provider = new ethers.JsonRpcProvider(RPC_URL);
const walletSigner = new ethers.Wallet(WALLET_KEY, provider);
const drainerSigner = new ethers.Wallet(DRAINER_KEY, provider);

// Send one transaction at a time per signer, with a fresh nonce each time,
// so page clicks, the bot and a player's own console don't collide.
const queues = new Map();
function send(signer, tx) {
  const prev = queues.get(signer.address) || Promise.resolve();
  const next = prev.catch(() => {}).then(async () => {
    // Raw RPC on purpose: ethers' getTransactionCount can return a stale count
    // right after a receipt under Hardhat automine.
    const nonce = Number(await provider.send("eth_getTransactionCount", [signer.address, "pending"]));
    const sent = await signer.sendTransaction({ ...tx, nonce });
    return sent.wait();
  });
  queues.set(signer.address, next);
  return next;
}

const app = express();

app.use(cors({
  origin(origin, callback) {
    if (!origin || /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error("Origin not allowed"));
  },
}));

app.use(express.json());

app.get("/contracts/:file", (req, res) => {
  const name = req.params.file.replace(/\.sol$/, "");
  if (!CONTRACTS.includes(name)) {
    return res.status(404).type("text/plain").send("Unknown contract");
  }
  const file = path.join(__dirname, "contracts", `${name}.sol`);
  res.type("text/plain").send(fs.readFileSync(file, "utf8"));
});

app.get("/abi", (req, res) => {
  try {
    const abis = {};
    for (const name of CONTRACTS) {
      abis[name] = JSON.parse(fs.readFileSync(
        path.join(__dirname, "artifacts", "contracts", `${name}.sol`, `${name}.json`),
        "utf8"
      )).abi;
    }
    res.json(abis);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "ABI is unavailable" });
  }
});

app.get("/status", async (req, res) => {
  try {
    res.json(await getState());
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Challenge state is unavailable" });
  }
});

app.get("/check-solved", async (req, res) => {
  try {
    const data = await getState();
    if (!data.solved) {
      return res.json({ solved: false });
    }
    res.json({ solved: true, flag: FLAG });
  } catch (err) {
    console.error(err);
    res.status(500).json({ solved: false });
  }
});

// The wallet prompt's buttons.
app.post("/wallet/confirm", async (req, res) => {
  try {
    const { tokenAddress, airdropAddress } = readDeployment();
    const request = buildPendingRequest(tokenAddress, airdropAddress);
    const receipt = await send(walletSigner, { to: request.to, data: request.data, value: 0 });
    res.json({ confirmed: true, hash: receipt.hash });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Transaction failed" });
  }
});

app.post("/wallet/reject", (req, res) => {
  res.json({ rejected: true });
});

// The Approvals tab's Revoke buttons: approve(spender, 0) from the wallet.
app.post("/wallet/revoke", async (req, res) => {
  try {
    const { tokenAddress, routerAddress, airdropAddress } = readDeployment();
    const spender = req.body && req.body.spender;
    if (spender !== airdropAddress && spender !== routerAddress) {
      return res.status(400).json({ error: "Unknown spender" });
    }
    const data = new ethers.Interface(["function approve(address,uint256)"]).encodeFunctionData("approve", [spender, 0]);
    const receipt = await send(walletSigner, { to: tokenAddress, data, value: 0 });
    res.json({ revoked: true, hash: receipt.hash });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Transaction failed" });
  }
});

// The attacker's bot: once the countdown after an airdrop approval runs out,
// it sweeps every HMS the approval allows.
let sweeping = false;
async function drainerTick() {
  if (sweeping) return;
  sweeping = true;
  try {
    const state = await getState();
    if (state.sweepAt !== null && state.secondsLeft === 0 && !state.drained) {
      const data = new ethers.Interface(["function sweep(address)"]).encodeFunctionData("sweep", [state.wallet]);
      await send(drainerSigner, { to: state.airdropAddress, data, value: 0 });
      console.log("Drainer swept", state.wallet);
    }
  } catch (err) {
    // Usually the chain isn't ready yet or the approval was revoked meanwhile; retried next tick.
    console.error("Drainer tick failed:", err.shortMessage || err.message);
  } finally {
    sweeping = false;
  }
}
setInterval(drainerTick, 1000);

const port = Number(process.env.API_PORT || 3000);
app.listen(port, "127.0.0.1", () => {
  console.log(`Challenge running on http://127.0.0.1:${port}`);
});
