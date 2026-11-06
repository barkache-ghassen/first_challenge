// Checks the client's requirements against the files in the repo.
// Run: node --test tests/requirements.test.js   (needs `npm ci` in approval-trap/challenge for ethers)
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { createRequire } = require("module");

const ROOT = path.resolve(__dirname, "..");
const CHALLENGES = ["approval-trap"];
const { ethers } = createRequire(path.join(ROOT, "approval-trap/challenge/package.json"))("ethers");

const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
const exists = (...p) => fs.existsSync(path.join(ROOT, ...p));

// The accounts block the client sent, in order.
const CLIENT_ACCOUNTS = [
  { privateKey: "0x689af8efa8c651a91ad287602527f3af2fe9f6501a7ac4b061667b5a93e037fd", balance: "1000000000000000000" },
  { privateKey: "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d", balance: "1000000000000000000" },
  { privateKey: "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a", balance: "1000000000000000000" },
  { privateKey: "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6", balance: "1000000000000000000" },
  { privateKey: "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80", balance: "12500000000000000000" },
];
const PLAYER_ACCOUNTS = CLIENT_ACCOUNTS.slice(0, 4);
const DEPLOYER = CLIENT_ACCOUNTS[4];

// Contract files shipped to players.
function shippedContracts(name) {
  return fs.readdirSync(path.join(ROOT, name, "challenge/contracts"))
    .filter((f) => f.endsWith(".sol"))
    .map((f) => f.replace(/\.sol$/, ""))
    .sort();
}

function configAccounts(name) {
  const src = read(name, "challenge/hardhat.config.js");
  const hardhatBlock = src.slice(src.indexOf("hardhat:"), src.indexOf("localhost:"));
  return [...hardhatBlock.matchAll(/privateKey:\s*"(0x[0-9a-fA-F]{64})",\s*balance:\s*"(\d+)"/g)]
    .map(([, privateKey, balance]) => ({ privateKey, balance }));
}

describe("R1 · The Approval Trap exists as an easy awareness challenge", () => {
  it("lives in approval-trap/ with the standard challenge layout", () => {
    for (const f of ["Dockerfile", "README.md", "walkthrough.md", "challenge_icon.png",
      "challenge/flag.txt", "challenge/contract.html", "challenge/run_challenge.sh",
      "challenge/server.js", "challenge/server.py", "challenge/getstate.js",
      "challenge/hardhat.config.js", "challenge/ignition/modules/deploy.js"]) {
      assert.ok(exists("approval-trap", f), `missing approval-trap/${f}`);
    }
  });

  it('is named "The Approval Trap" on the page, the desktop icon and the README', () => {
    assert.match(read("approval-trap/challenge/contract.html"), /<title>The Approval Trap<\/title>/);
    assert.match(read("approval-trap/Dockerfile"), /Name= Web3 Challenge - The Approval Trap/);
    assert.match(read("approval-trap/README.md"), /^# The Approval Trap/);
  });

  it("is marked easy and framed as awareness", () => {
    const readme = read("approval-trap/README.md");
    assert.match(readme, /\*\*Difficulty:\*\* easy/);
    assert.match(readme, /awareness/i);
  });

  it("has a flag in the HMS{...} format that is not on the page", () => {
    const flag = read("approval-trap/challenge/flag.txt").trim();
    assert.match(flag, /^HMS\{[^}]+\}$/);
    assert.ok(!read("approval-trap/challenge/contract.html").includes(flag));
  });
});

describe("R2 · The page shows every step: airdrop, confirm the approval, revoke before funds are stolen", () => {
  const html = read("approval-trap/challenge/contract.html");
  const server = read("approval-trap/challenge/server.js");
  const getstate = read("approval-trap/challenge/getstate.js");

  it("has numbered tabs for the three steps, in order", () => {
    const order = ["airdrop", "request", "approvals"].map((t) => html.indexOf(`data-tab="${t}"`));
    assert.ok(order.every((n) => n > 0), "a step tab is missing");
    assert.deepEqual([...order].sort((a, b) => a - b), order, "step tabs out of order");
    assert.match(html, />1 · Airdrop</);
    assert.match(html, />2 · Wallet request/);
    assert.match(html, />3 · Approvals</);
  });

  it("step 1: the airdrop offer has a working Claim button that opens the wallet request", () => {
    assert.match(html, /id="claim-button"/);
    assert.match(html, /getElementById\("claim-button"\)\.addEventListener\("click", \(\) => showTab\("request"\)\)/);
  });

  it("step 2: the wallet request shows From/To/Value/Data with working Confirm and Reject", () => {
    for (const id of ["req-from", "req-to", "req-value", "req-data", "confirm-button", "reject-button"]) {
      assert.match(html, new RegExp(`id="${id}"`), `request field ${id} missing`);
    }
    assert.ok(!/fake-btn/.test(html), "buttons are still fake");
    assert.match(html, /post\("\/wallet\/confirm"\)/);
    assert.match(html, /post\("\/wallet\/reject"\)/);
    assert.match(server, /app\.post\("\/wallet\/confirm"/);
    assert.match(server, /app\.post\("\/wallet\/reject"/);
  });

  it("step 2: the request is the malicious approve(AirdropClaim, unlimited), sent to the token", () => {
    const { buildPendingRequest } = require(path.join(ROOT, "approval-trap/challenge/getstate.js"));
    const token = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
    const airdrop = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";
    const req = buildPendingRequest(token, airdrop);
    assert.equal(req.to, token);
    const iface = new ethers.Interface(["function approve(address,uint256)"]);
    const [spender, amount] = iface.decodeFunctionData("approve", req.data);
    assert.equal(spender, airdrop);
    assert.equal(amount, ethers.MaxUint256);
  });

  it("step 2: after confirming, the page says the player approved an UNLIMITED amount", () => {
    assert.match(html, /You approved <u>UNLIMITED<\/u> HMS to AirdropClaim/);
    assert.match(html, /permission to spend an <strong>unlimited<\/strong> amount of your HMS/);
  });

  it("step 3: a countdown shows when the drainer will strike", () => {
    assert.match(getstate, /SWEEP_DELAY_SECONDS/);
    assert.match(html, /will sweep your wallet in <span class=\\"countdown\\" id=\\"alert-countdown\\">/);
    assert.match(html, /getElementById\("alert-countdown"\)\.textContent = mm \+ ":" \+ ss/);
    assert.match(html, /setInterval\(renderAlert, 1000\)/);
  });

  it("step 3: a drainer bot really sweeps the wallet when the countdown ends", () => {
    assert.match(server, /async function drainerTick\(\)/);
    assert.match(server, /setInterval\(drainerTick, 1000\)/);
    assert.match(server, /encodeFunctionData\("sweep"/);
  });

  it("step 3: the Approvals tab lists spenders with risk and working Revoke buttons", () => {
    assert.match(html, /id="panel-approvals"/);
    assert.match(html, /id="approvals-body"/);
    assert.match(html, /High: unlimited/);
    assert.match(html, /post\("\/wallet\/revoke", \{ spender: a\.spender \}\)/);
    assert.match(server, /app\.post\("\/wallet\/revoke"/);
  });

  it("the win condition requires the approval to have been given, then revoked", () => {
    const { isSolved } = require(path.join(ROOT, "approval-trap/challenge/getstate.js"));
    const ok = { approvedAirdrop: true, balance: ethers.parseEther("1000"), airdropAllowance: 0n, routerAllowance: ethers.parseEther("50") };
    assert.equal(isSolved(ok), true);
    assert.equal(isSolved({ ...ok, approvedAirdrop: false }), false);
    assert.equal(isSolved({ ...ok, airdropAllowance: ethers.MaxUint256 }), false);
    assert.equal(isSolved({ ...ok, balance: 0n }), false);
    assert.equal(isSolved({ ...ok, routerAllowance: 0n }), false);
  });

  it("still teaches reading the request before confirming", () => {
    assert.match(html, /Before you confirm/);
    assert.match(html, /function selector/);
    assert.match(html, /id="panel-signed"/);
  });

  it("README and walkthrough describe the three steps", () => {
    const readme = read("approval-trap/README.md");
    const walkthrough = read("approval-trap/walkthrough.md");
    for (const doc of [readme, walkthrough]) {
      assert.match(doc, /Airdrop/);
      assert.match(doc, /Confirm/);
      assert.match(doc, /Revoke/i);
      assert.match(doc, /countdown/i);
    }
  });
});

describe("R3 · Players are pointed to revoke.cash", () => {
  it("the page links to https://revoke.cash", () => {
    assert.match(read("approval-trap/challenge/contract.html"), /href="https:\/\/revoke\.cash"/);
  });

  it("README and walkthrough both mention revoke.cash", () => {
    assert.match(read("approval-trap/README.md"), /revoke\.cash/);
    assert.match(read("approval-trap/walkthrough.md"), /revoke\.cash/);
  });
});

describe("R4 · Multi-contract challenges show one tab per contract", () => {
  for (const name of CHALLENGES) {
    const contracts = shippedContracts(name);
    const html = read(name, "challenge/contract.html");
    const server = read(name, "challenge/server.js");

    if (contracts.length < 2) {
      it(`${name}: single contract, no tabs needed`, () => {
        assert.equal(contracts.length, 1);
      });
      continue;
    }

    it(`${name}: each contract file holds exactly one contract`, () => {
      for (const c of contracts) {
        const src = read(name, "challenge/contracts", `${c}.sol`);
        const declared = [...src.matchAll(/^contract (\w+)/gm)].map((m) => m[1]);
        assert.deepEqual(declared, [c], `${c}.sol declares ${declared.join(", ")}`);
      }
    });

    it(`${name}: has a tab, a panel and a source box for every contract (${contracts.join(", ")})`, () => {
      for (const c of contracts) {
        assert.match(html, new RegExp(`class="tab" data-tab="${c}"`), `no tab for ${c}`);
        assert.match(html, new RegExp(`id="panel-${c}"`), `no panel for ${c}`);
        assert.match(html, new RegExp(`class="source" data-contract="${c}"`), `no source box for ${c}`);
        assert.match(html, new RegExp(`class="abi-toggle" data-contract="${c}"`), `no ABI button for ${c}`);
      }
    });

    it(`${name}: the API serves the source and ABI of every contract`, () => {
      const listed = server.match(/const CONTRACTS = \[([^\]]*)\]/)[1].match(/"(\w+)"/g).map((s) => s.slice(1, -1)).sort();
      assert.deepEqual(listed, contracts);
    });
  }
});

describe("R5 · Fixed accounts in hardhat.config.js", () => {
  const playerAddresses = PLAYER_ACCOUNTS.map((a) => new ethers.Wallet(a.privateKey).address);
  const deployerAddress = new ethers.Wallet(DEPLOYER.privateKey).address;

  it("the 4 player keys are the expected addresses", () => {
    assert.deepEqual(playerAddresses, [
      "0xbDA5747bFD65F08deb54cb465eB87D40e51B197E",
      "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
      "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
      "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
    ]);
  });

  for (const name of CHALLENGES) {
    it(`${name}: hardhat accounts match the client's list exactly (keys, balances, order)`, () => {
      assert.deepEqual(configAccounts(name), CLIENT_ACCOUNTS);
    });

    it(`${name}: Solidity version is 0.8.28`, () => {
      assert.match(read(name, "challenge/hardhat.config.js"), /solidity: "0\.8\.28"/);
    });

    it(`${name}: the page lists exactly the 4 player accounts with their keys`, () => {
      const html = read(name, "challenge/contract.html");
      const shown = [...html.matchAll(/<pre class="wallet-pre copyable">(0x[0-9a-fA-F]{40})<\/pre>/g)].map((m) => m[1]);
      const keys = [...html.matchAll(/class="private-key wallet-pre copyable">(0x[0-9a-fA-F]{64})<\/pre>/g)].map((m) => m[1]);
      assert.deepEqual(shown, playerAddresses);
      assert.deepEqual(keys, PLAYER_ACCOUNTS.map((a) => a.privateKey));
    });

    it(`${name}: the page never shows the deployer address or key`, () => {
      const html = read(name, "challenge/contract.html");
      assert.ok(!html.includes(deployerAddress), "deployer address on page");
      assert.ok(!html.includes(DEPLOYER.privateKey), "deployer key on page");
    });

    it(`${name}: the deploy module sends every transaction from account #4`, () => {
      const mod = read(name, "challenge/ignition/modules/deploy.js");
      assert.match(mod, /const deployer = m\.getAccount\(4\);/);
      const calls = [...mod.matchAll(/m\.(contract|call)\(/g)].length;
      const fromDeployer = [...mod.matchAll(/from: deployer/g)].length;
      const fromWallet = [...mod.matchAll(/from: wallet/g)].length;
      assert.equal(fromDeployer + fromWallet, calls, "a deploy step has no explicit sender");
      assert.ok(![...mod.matchAll(/getAccount\((\d+)\)/g)].some((m) => Number(m[1]) > 4), "uses an account beyond #4");
    });
  }
});

describe("R6 · Solutions and flags stay out of the player image", () => {
  it("solve.js helpers are gitignored", () => {
    assert.match(read(".gitignore"), /^\*\*\/challenge\/solve\.js$/m);
  });

  for (const name of CHALLENGES) {
    it(`${name}: Dockerfile locks flag.txt and removes tests and solve.js`, () => {
      const docker = read(name, "Dockerfile");
      assert.match(docker, /chmod 400 \/root\/challenge\/flag\.txt/);
      assert.match(docker, /rm -rf [^\n]*\/root\/challenge\/test/);
      assert.match(docker, /rm -rf [^\n]*\/root\/challenge\/solve\.js/);
    });

    it(`${name}: .dockerignore keeps tests, solve.js and build output out of the build context`, () => {
      const ignore = read(name, ".dockerignore");
      for (const entry of ["challenge/test", "challenge/solve.js", "challenge/node_modules", "challenge/ignition/deployments"]) {
        assert.ok(ignore.split("\n").includes(entry), `${entry} not ignored`);
      }
    });

    it(`${name}: README.md and walkthrough.md sit outside challenge/ (not copied into the image)`, () => {
      assert.ok(exists(name, "README.md") && exists(name, "walkthrough.md"));
      assert.ok(!exists(name, "challenge/README.md") && !exists(name, "challenge/walkthrough.md"));
    });

    it(`${name}: the API only serves whitelisted contract files`, () => {
      assert.match(read(name, "challenge/server.js"), /if \(!CONTRACTS\.includes\(name\)\)/);
    });
  }

});
