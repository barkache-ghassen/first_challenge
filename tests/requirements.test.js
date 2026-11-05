// Checks the client's requirements against the files in the repo.
// Run: node --test tests/requirements.test.js   (needs `npm ci` in flash-loan-oracle/challenge for ethers)
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { createRequire } = require("module");

const ROOT = path.resolve(__dirname, "..");
const CHALLENGES = ["flash-loan-oracle", "signature-replay"];
const { ethers } = createRequire(path.join(ROOT, "flash-loan-oracle/challenge/package.json"))("ethers");

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

// Contract files shipped to players (Attacker.sol is the stripped reference solution).
function shippedContracts(name) {
  return fs.readdirSync(path.join(ROOT, name, "challenge/contracts"))
    .filter((f) => f.endsWith(".sol") && f !== "Attacker.sol")
    .map((f) => f.replace(/\.sol$/, ""))
    .sort();
}

function configAccounts(name) {
  const src = read(name, "challenge/hardhat.config.js");
  const hardhatBlock = src.slice(src.indexOf("hardhat:"), src.indexOf("localhost:"));
  return [...hardhatBlock.matchAll(/privateKey:\s*"(0x[0-9a-fA-F]{64})",\s*balance:\s*"(\d+)"/g)]
    .map(([, privateKey, balance]) => ({ privateKey, balance }));
}

describe("R1 · Multi-contract challenges show one tab per contract", () => {
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

    it(`${name}: has no leftover single-file Market.sol`, () => {
      assert.ok(!exists(name, "challenge/contracts/Market.sol"));
    });
  }
});

describe("R2 · Fixed accounts in hardhat.config.js", () => {
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

describe("R3 · Solutions and flags stay out of the player image", () => {
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
      assert.match(read(name, "challenge/server.js"), /if \(!CONTRACTS\.includes\(name\)\)|app\.get\("\/contracts\/Vault\.sol"/);
    });
  }

  it("flash-loan-oracle: the Attacker solution is removed from the image", () => {
    assert.match(read("flash-loan-oracle/Dockerfile"), /rm -rf \/root\/challenge\/contracts\/Attacker\.sol/);
    assert.ok(read("flash-loan-oracle/.dockerignore").split("\n").includes("challenge/contracts/Attacker.sol"));
  });
});
