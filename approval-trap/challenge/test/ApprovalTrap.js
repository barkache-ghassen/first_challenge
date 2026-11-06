const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { isSolved, buildPendingRequest } = require("../getstate");

const COLLECTOR = "0x000000000000000000000000000000000000bad1";
const WALLET = "0xbDA5747bFD65F08deb54cb465eB87D40e51B197E";
const DEPLOYER = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
const HMS = (n) => ethers.parseEther(String(n));

// Mirrors ignition/modules/deploy.js: #4 deploys and owns the drainer, #0 is the player's wallet.
async function deployFixture() {
  const signers = await ethers.getSigners();
  const wallet = signers[0];
  const deployer = signers[4];
  const other = signers[1];

  const token = await ethers.deployContract("HamonisToken", [HMS(1000)], deployer);
  const router = await ethers.deployContract("SwapRouter", [token], deployer);
  const airdrop = await ethers.deployContract("AirdropClaim", [token, COLLECTOR], deployer);

  await token.connect(deployer).transfer(wallet, HMS(1000));
  await token.connect(wallet).approve(router, HMS(50));
  return { token, router, airdrop, wallet, deployer, other };
}

// The same check getstate.js runs, including "did the player ever confirm the airdrop approval".
async function solved({ token, router, airdrop, wallet }) {
  const logs = await token.queryFilter(token.filters.Approval(wallet.address, await airdrop.getAddress()));
  return isSolved({
    approvedAirdrop: logs.some((log) => log.args.value > 0n),
    balance: await token.balanceOf(wallet),
    airdropAllowance: await token.allowance(wallet, airdrop),
    routerAllowance: await token.allowance(wallet, router),
  });
}

// Step 2: the player clicks Confirm on the wallet request, exactly as the page sends it.
async function confirmPendingRequest({ token, airdrop, wallet }) {
  const req = buildPendingRequest(await token.getAddress(), await airdrop.getAddress());
  return wallet.sendTransaction({ to: req.to, data: req.data, value: req.value });
}

describe("Approval Trap", function () {
  describe("accounts (fixed hardhat.config.js)", function () {
    it("uses the client's wallet as account #0", async function () {
      const [wallet] = await ethers.getSigners();
      expect(wallet.address).to.equal(WALLET);
    });

    it("has exactly 5 accounts: 4 players + the hidden deployer at #4", async function () {
      const signers = await ethers.getSigners();
      expect(signers.map((s) => s.address)).to.deep.equal([
        WALLET,
        "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
        "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
        "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
        DEPLOYER,
      ]);
    });
  });

  describe("starting state", function () {
    it("gives the wallet 1,000 HMS", async function () {
      const { token, wallet, deployer } = await loadFixture(deployFixture);
      expect(await token.balanceOf(wallet)).to.equal(HMS(1000));
      expect(await token.balanceOf(deployer)).to.equal(0n);
    });

    it("has a bounded 50 HMS approval to the DEX router", async function () {
      const { token, router, wallet } = await loadFixture(deployFixture);
      expect(await token.allowance(wallet, router)).to.equal(HMS(50));
    });

    it("has no airdrop approval yet: the player gives it during the challenge", async function () {
      const { token, airdrop, wallet } = await loadFixture(deployFixture);
      expect(await token.allowance(wallet, airdrop)).to.equal(0n);
    });

    it("starts unsolved (doing nothing is not a solve)", async function () {
      expect(await solved(await loadFixture(deployFixture))).to.equal(false);
    });

    it("the drainer contract is owned by the hidden account #4", async function () {
      const { airdrop } = await loadFixture(deployFixture);
      expect(await airdrop.owner()).to.equal(DEPLOYER);
      expect(await airdrop.collector()).to.equal(ethers.getAddress(COLLECTOR));
    });
  });

  describe("HamonisToken (plain ERC20)", function () {
    it("approve overwrites the allowance and emits Approval", async function () {
      const { token, router, wallet } = await loadFixture(deployFixture);
      await expect(token.connect(wallet).approve(router, HMS(7)))
        .to.emit(token, "Approval").withArgs(WALLET, await router.getAddress(), HMS(7));
      expect(await token.allowance(wallet, router)).to.equal(HMS(7));
    });

    it("transferFrom spends a bounded allowance", async function () {
      const { token, wallet, other } = await loadFixture(deployFixture);
      await token.connect(wallet).approve(other, HMS(10));
      await token.connect(other).transferFrom(wallet, other, HMS(4));
      expect(await token.allowance(wallet, other)).to.equal(HMS(6));
    });

    it("an unlimited allowance never decreases", async function () {
      const { token, wallet, other } = await loadFixture(deployFixture);
      await token.connect(wallet).approve(other, ethers.MaxUint256);
      await token.connect(other).transferFrom(wallet, other, HMS(4));
      expect(await token.allowance(wallet, other)).to.equal(ethers.MaxUint256);
    });

    it("transferFrom over the allowance reverts", async function () {
      const { token, wallet, other } = await loadFixture(deployFixture);
      await expect(token.connect(other).transferFrom(wallet, other, 1n)).to.be.revertedWith("allowance exceeded");
    });
  });

  describe("SwapRouter (legitimate DEX)", function () {
    it("can only pull what was deposited, within the 50 HMS approval", async function () {
      const { token, router, wallet } = await loadFixture(deployFixture);
      await router.connect(wallet).deposit(HMS(20));
      expect(await router.deposits(wallet)).to.equal(HMS(20));
      expect(await token.balanceOf(wallet)).to.equal(HMS(980));
      await router.connect(wallet).withdraw(HMS(20));
      expect(await token.balanceOf(wallet)).to.equal(HMS(1000));
    });

    it("cannot pull more than the approval", async function () {
      const { router, wallet } = await loadFixture(deployFixture);
      await expect(router.connect(wallet).deposit(HMS(51))).to.be.revertedWith("allowance exceeded");
    });
  });

  describe("step 2: the wallet request", function () {
    it("is sent to the token, not to the airdrop it claims to be", async function () {
      const { token, airdrop } = await loadFixture(deployFixture);
      const req = buildPendingRequest(await token.getAddress(), await airdrop.getAddress());
      expect(req.from).to.equal(WALLET);
      expect(req.to).to.equal(await token.getAddress());
      expect(req.value).to.equal("0");
    });

    it("decodes to approve(AirdropClaim, unlimited)", async function () {
      const { token, airdrop } = await loadFixture(deployFixture);
      const req = buildPendingRequest(await token.getAddress(), await airdrop.getAddress());
      expect(req.data.slice(0, 10)).to.equal("0x095ea7b3");
      const [spender, amount] = token.interface.decodeFunctionData("approve", req.data);
      expect(spender).to.equal(await airdrop.getAddress());
      expect(amount).to.equal(ethers.MaxUint256);
    });

    it("confirming it pays no bonus and grants an unlimited approval", async function () {
      const ctx = await loadFixture(deployFixture);
      await confirmPendingRequest(ctx);
      expect(await ctx.token.balanceOf(ctx.wallet)).to.equal(HMS(1000));
      expect(await ctx.token.allowance(ctx.wallet, ctx.airdrop)).to.equal(ethers.MaxUint256);
      expect(await solved(ctx)).to.equal(false);
    });
  });

  describe("AirdropClaim (the drainer)", function () {
    it("the owner's sweep() takes the whole balance once the wallet approved", async function () {
      const ctx = await loadFixture(deployFixture);
      await confirmPendingRequest(ctx);
      await ctx.airdrop.connect(ctx.deployer).sweep(ctx.wallet);
      expect(await ctx.token.balanceOf(ctx.wallet)).to.equal(0n);
      expect(await ctx.token.balanceOf(COLLECTOR)).to.equal(HMS(1000));
      expect(await solved(ctx)).to.equal(false);
    });

    it("sweep() can only be called by the owner", async function () {
      const ctx = await loadFixture(deployFixture);
      await confirmPendingRequest(ctx);
      await expect(ctx.airdrop.connect(ctx.wallet).sweep(ctx.wallet)).to.be.revertedWith("not owner");
    });

    it("claim() also drains the caller and pays no bonus", async function () {
      const ctx = await loadFixture(deployFixture);
      await confirmPendingRequest(ctx);
      await ctx.airdrop.connect(ctx.wallet).claim();
      expect(await ctx.token.balanceOf(ctx.wallet)).to.equal(0n);
    });

    it("takes nothing once the approval is revoked", async function () {
      const ctx = await loadFixture(deployFixture);
      await confirmPendingRequest(ctx);
      await ctx.token.connect(ctx.wallet).approve(ctx.airdrop, 0);
      await ctx.airdrop.connect(ctx.deployer).sweep(ctx.wallet);
      expect(await ctx.token.balanceOf(ctx.wallet)).to.equal(HMS(1000));
      expect(await ctx.token.balanceOf(COLLECTOR)).to.equal(0n);
    });

    it("takes nothing from a wallet that never approved it", async function () {
      const ctx = await loadFixture(deployFixture);
      await ctx.airdrop.connect(ctx.deployer).sweep(ctx.wallet);
      expect(await ctx.token.balanceOf(ctx.wallet)).to.equal(HMS(1000));
    });
  });

  describe("step 3: win condition", function () {
    it("is solved by confirming, then revoking only the airdrop approval", async function () {
      const ctx = await loadFixture(deployFixture);
      await confirmPendingRequest(ctx);
      await ctx.token.connect(ctx.wallet).approve(ctx.airdrop, 0);
      expect(await solved(ctx)).to.equal(true);
    });

    it("is not solved without ever confirming the approval", async function () {
      const ctx = await loadFixture(deployFixture);
      await ctx.token.connect(ctx.wallet).approve(ctx.airdrop, 0);
      expect(await solved(ctx)).to.equal(false);
    });

    it("is not solved when the DEX approval is revoked too", async function () {
      const ctx = await loadFixture(deployFixture);
      await confirmPendingRequest(ctx);
      await ctx.token.connect(ctx.wallet).approve(ctx.airdrop, 0);
      await ctx.token.connect(ctx.wallet).approve(ctx.router, 0);
      expect(await solved(ctx)).to.equal(false);
    });

    it("is not solved by lowering the airdrop approval instead of revoking it", async function () {
      const ctx = await loadFixture(deployFixture);
      await confirmPendingRequest(ctx);
      await ctx.token.connect(ctx.wallet).approve(ctx.airdrop, 1n);
      expect(await solved(ctx)).to.equal(false);
    });

    it("is not solved after being drained, even if revoked afterwards", async function () {
      const ctx = await loadFixture(deployFixture);
      await confirmPendingRequest(ctx);
      await ctx.airdrop.connect(ctx.deployer).sweep(ctx.wallet);
      await ctx.token.connect(ctx.wallet).approve(ctx.airdrop, 0);
      expect(await solved(ctx)).to.equal(false);
    });

    it("is not solved by moving the HMS out of the wallet instead of revoking", async function () {
      const ctx = await loadFixture(deployFixture);
      await confirmPendingRequest(ctx);
      await ctx.token.connect(ctx.wallet).transfer(ctx.other, HMS(1000));
      expect(await solved(ctx)).to.equal(false);
    });

    it("re-confirming after revoking un-solves it until revoked again", async function () {
      const ctx = await loadFixture(deployFixture);
      await confirmPendingRequest(ctx);
      await ctx.token.connect(ctx.wallet).approve(ctx.airdrop, 0);
      await confirmPendingRequest(ctx);
      expect(await solved(ctx)).to.equal(false);
      await ctx.token.connect(ctx.wallet).approve(ctx.airdrop, 0);
      expect(await solved(ctx)).to.equal(true);
    });
  });
});
