// End-to-end: runs The Approval Trap the way the image does and plays it through the real API.
// Run: node --test --test-concurrency=1 tests/e2e.test.js   (needs node/npm on PATH, python3, network for npm ci)
//
// The challenge is copied to a temp folder without the files its Dockerfile strips
// (test/, solve.js), started with its own run_challenge.sh on spare ports
// (so a challenge already running on 8545/3000/8000 is untouched), and every scenario
// starts from the same chain snapshot taken right after deployment.
const { describe, it, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn, execFileSync } = require("child_process");
const { createRequire } = require("module");

const ROOT = path.resolve(__dirname, "..");
const { ethers } = createRequire(path.join(ROOT, "approval-trap/challenge/package.json"))("ethers");

const PORTS = { rpc: 28545, api: 23000, page: 28000 };
const RPC_URL = `http://127.0.0.1:${PORTS.rpc}`;
const API = `http://127.0.0.1:${PORTS.api}`;
const PAGE = `http://127.0.0.1:${PORTS.page}`;
const STARTUP_TIMEOUT_MS = 5 * 60 * 1000;

const KEYS = [
  "0x689af8efa8c651a91ad287602527f3af2fe9f6501a7ac4b061667b5a93e037fd",
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
  "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a",
  "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6",
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const getJson = async (p) => (await fetch(API + p)).json();
const flagOf = (name) => fs.readFileSync(path.join(ROOT, name, "challenge/flag.txt"), "utf8").trim();

function freePorts() {
  for (const port of Object.values(PORTS)) {
    try {
      const pids = execFileSync("lsof", ["-ti", `tcp:${port}`], { encoding: "utf8" }).split("\n").filter(Boolean);
      for (const pid of pids) process.kill(Number(pid), "SIGKILL");
    } catch { /* nothing listening */ }
  }
}

// Copies a challenge like the Dockerfile does and starts it with run_challenge.sh.
async function startChallenge(name, { strip }) {
  const src = path.join(ROOT, name, "challenge");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `hms-e2e-${name}-`));
  const skip = new Set(["node_modules", "artifacts", "cache", "deployments", "solve.js", "test", ...strip]);
  fs.cpSync(src, dir, { recursive: true, filter: (p) => !skip.has(path.basename(p)) });

  freePorts();
  const log = fs.openSync(path.join(dir, "e2e.log"), "w");
  const child = spawn("./run_challenge.sh", [], {
    cwd: dir,
    detached: true,
    stdio: ["ignore", log, log],
    env: { ...process.env, RPC_URL, API_PORT: String(PORTS.api), PAGE_PORT: String(PORTS.page) },
  });

  const deadline = Date.now() + STARTUP_TIMEOUT_MS;
  while (Date.now() < deadline) {
    try {
      if ((await fetch(API + "/status")).ok) break;
    } catch { /* not up yet */ }
    if (child.exitCode !== null) break;
    await sleep(1000);
  }
  const res = await fetch(API + "/status").catch(() => null);
  if (!res || !res.ok) {
    throw new Error(`${name} did not start. Log:\n` + fs.readFileSync(path.join(dir, "e2e.log"), "utf8").slice(-3000));
  }

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  let snapshot = await provider.send("evm_snapshot", []);
  return {
    dir,
    provider,
    // evm_revert consumes the snapshot, so take a fresh one each time.
    async reset() {
      await provider.send("evm_revert", [snapshot]);
      snapshot = await provider.send("evm_snapshot", []);
    },
    async stop() {
      try { process.kill(-child.pid, "SIGTERM"); } catch { /* already gone */ }
      await sleep(500);
      freePorts();
      fs.rmSync(dir, { recursive: true, force: true });
    },
  };
}

// A player account that counts its own nonces (Hardhat automine + ethers can read a stale one).
async function player(provider, index) {
  const wallet = new ethers.Wallet(KEYS[index], provider);
  let nonce = await provider.getTransactionCount(wallet.address, "latest");
  return {
    wallet,
    address: wallet.address,
    async send(contract, method, ...args) {
      const tx = await contract.connect(wallet)[method](...args, { nonce });
      nonce++;
      return tx.wait();
    },
    async sendRaw(req) {
      const tx = await wallet.sendTransaction({ to: req.to, data: req.data, value: req.value, nonce });
      nonce++;
      return tx.wait();
    },
  };
}

describe("approval-trap end-to-end", { timeout: STARTUP_TIMEOUT_MS + 120000 }, () => {
  let env, st, token, airdrop;
  const FLAG = flagOf("approval-trap");

  before(async () => {
    env = await startChallenge("approval-trap", { strip: [] });
    st = await getJson("/status");
    token = new ethers.Contract(st.tokenAddress, ["function approve(address,uint256) returns (bool)"], env.provider);
    airdrop = new ethers.Contract(st.airdropAddress, ["function claim()", "function sweep(address)"], env.provider);
  });
  after(async () => env && env.stop());
  beforeEach(async () => env.reset());

  it("starts with 1,000 HMS, both approvals live, unsolved and no flag", async () => {
    const s = await getJson("/status");
    assert.equal(s.wallet, "0xbDA5747bFD65F08deb54cb465eB87D40e51B197E");
    assert.equal(s.balance, "1000.0");
    assert.equal(s.airdropAllowance, "unlimited");
    assert.equal(s.routerAllowance, "50.0");
    assert.equal(s.drained, false);
    assert.deepEqual(await getJson("/check-solved"), { solved: false });
  });

  it("serves the page with every tab", async () => {
    const html = await (await fetch(PAGE)).text();
    for (const tab of ["overview", "request", "signed", "HamonisToken", "SwapRouter", "AirdropClaim", "accounts"]) {
      assert.match(html, new RegExp(`data-tab="${tab}"`));
    }
  });

  it("serves the source and ABI of each contract, and nothing else", async () => {
    const abi = await getJson("/abi");
    for (const c of ["HamonisToken", "SwapRouter", "AirdropClaim"]) {
      const res = await fetch(`${API}/contracts/${c}.sol`);
      assert.equal(res.status, 200);
      assert.match(await res.text(), new RegExp(`contract ${c}`));
      assert.ok(Array.isArray(abi[c]) && abi[c].length > 0, `no ABI for ${c}`);
    }
    assert.equal((await fetch(`${API}/contracts/flag.txt`)).status, 404);
    assert.equal((await fetch(`${API}/contracts/..%2fflag.txt`)).status, 404);
  });

  it("shows the pending request as approve(AirdropClaim, unlimited) sent to the token", async () => {
    const req = (await getJson("/status")).pendingRequest;
    assert.equal(req.from, st.wallet);
    assert.equal(req.to, st.tokenAddress);
    const [spender, amount] = new ethers.Interface(["function approve(address,uint256)"]).decodeFunctionData("approve", req.data);
    assert.equal(spender, st.airdropAddress);
    assert.equal(amount, ethers.MaxUint256);
  });

  it("shows the two approvals the wallet already signed, as raw approve calldata", async () => {
    const signed = (await getJson("/status")).signed;
    assert.equal(signed.length, 2);
    for (const tx of signed) {
      assert.equal(tx.from, st.wallet);
      assert.equal(tx.to, st.tokenAddress);
      assert.equal(tx.data.slice(0, 10), "0x095ea7b3");
    }
  });

  it("solve: revoking only the airdrop approval returns the flag", async () => {
    const p = await player(env.provider, 0);
    await p.send(token, "approve", st.airdropAddress, 0);
    assert.deepEqual(await getJson("/check-solved"), { solved: true, flag: FLAG });
  });

  it("trap: calling claim() drains the wallet and withholds the flag", async () => {
    const p = await player(env.provider, 0);
    await p.send(airdrop, "claim");
    const s = await getJson("/status");
    assert.equal(s.balance, "0.0");
    assert.equal(s.drained, true);
    assert.deepEqual(await getJson("/check-solved"), { solved: false });
  });

  it("trap: confirming the pending request after revoking un-solves it", async () => {
    const p = await player(env.provider, 0);
    await p.send(token, "approve", st.airdropAddress, 0);
    assert.equal((await getJson("/check-solved")).solved, true);
    await p.sendRaw((await getJson("/status")).pendingRequest);
    assert.equal((await getJson("/status")).airdropAllowance, "unlimited");
    assert.deepEqual(await getJson("/check-solved"), { solved: false });
  });

  it("fail: revoking the DEX approval too withholds the flag", async () => {
    const p = await player(env.provider, 0);
    await p.send(token, "approve", st.airdropAddress, 0);
    await p.send(token, "approve", st.routerAddress, 0);
    assert.deepEqual(await getJson("/check-solved"), { solved: false });
  });

  it("the attacker's sweep() cannot be called by the player", async () => {
    const p = await player(env.provider, 0);
    await assert.rejects(p.send(airdrop, "sweep", st.wallet));
    assert.equal((await getJson("/status")).balance, "1000.0");
  });

  it("another player account cannot solve it for account #0", async () => {
    const p = await player(env.provider, 1);
    await p.send(token, "approve", st.airdropAddress, 0);
    assert.deepEqual(await getJson("/check-solved"), { solved: false });
  });
});

