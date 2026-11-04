const { expect } = require("chai");
const { ethers } = require("hardhat");
const { isSolved } = require("../getstate");

describe("Approval trap", function () {
  const COLLECTOR = "0x000000000000000000000000000000000000bad1";

  // Mirrors ignition/modules/deploy.js.
  async function deploy() {
    const signers = await ethers.getSigners();
    const wallet = signers[0];
    const deployer = signers[4];

    const token = await ethers.deployContract("HamonisToken", [ethers.parseEther("1000")], deployer);
    const router = await ethers.deployContract("SwapRouter", [token], deployer);
    const airdrop = await ethers.deployContract("AirdropClaim", [token, COLLECTOR], deployer);

    await token.connect(deployer).transfer(wallet, ethers.parseEther("1000"));
    await token.connect(wallet).approve(router, ethers.parseEther("50"));
    await token.connect(wallet).approve(airdrop, ethers.MaxUint256);
    return { token, router, airdrop, wallet };
  }

  async function solved({ token, router, airdrop, wallet }) {
    return isSolved({
      balance: await token.balanceOf(wallet),
      airdropAllowance: await token.allowance(wallet, airdrop),
      routerAllowance: await token.allowance(wallet, router),
    });
  }

  it("uses the fixed player wallet as account #0", async function () {
    const [wallet] = await ethers.getSigners();
    expect(wallet.address).to.equal("0xbDA5747bFD65F08deb54cb465eB87D40e51B197E");
  });

  it("starts unsolved", async function () {
    expect(await solved(await deploy())).to.equal(false);
  });

  it("claim() drains the wallet instead of paying a bonus", async function () {
    const ctx = await deploy();
    await ctx.airdrop.connect(ctx.wallet).claim();
    expect(await ctx.token.balanceOf(ctx.wallet)).to.equal(0n);
    expect(await ctx.token.balanceOf(COLLECTOR)).to.equal(ethers.parseEther("1000"));
    expect(await solved(ctx)).to.equal(false);
  });

  it("revoking everything is not enough: the DEX approval must stay", async function () {
    const ctx = await deploy();
    await ctx.token.connect(ctx.wallet).approve(ctx.airdrop, 0);
    await ctx.token.connect(ctx.wallet).approve(ctx.router, 0);
    expect(await solved(ctx)).to.equal(false);
  });

  it("is solved by revoking only the drainer's approval", async function () {
    const ctx = await deploy();
    await ctx.token.connect(ctx.wallet).approve(ctx.airdrop, 0);
    expect(await solved(ctx)).to.equal(true);

    // And the drainer can no longer touch the wallet.
    await ctx.airdrop.connect(ctx.wallet).claim();
    expect(await ctx.token.balanceOf(ctx.wallet)).to.equal(ethers.parseEther("1000"));
  });
});
