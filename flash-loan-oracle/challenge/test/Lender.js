const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Spot lender", function () {
  const ether = (amount) => ethers.parseEther(amount.toString());

  async function deploy() {
    // Mirrors the fixed accounts in hardhat.config.js: #4 deploys, #0 plays.
    const signers = await ethers.getSigners();
    const deployer = signers[4];
    const player = signers[0];
    const weth = await ethers.deployContract("Asset", ["Wrapped Ether", "WETH"], deployer);
    const usd = await ethers.deployContract("Asset", ["Dollar", "USD"], deployer);
    const pool = await ethers.deployContract("SpotPool", [await weth.getAddress(), await usd.getAddress()], deployer);
    const flash = await ethers.deployContract("FlashLender", [await weth.getAddress()], deployer);
    const lender = await ethers.deployContract("Lender", [
      await weth.getAddress(),
      await usd.getAddress(),
      await pool.getAddress(),
    ], deployer);

    await weth.mint(await pool.getAddress(), ether(100));
    await usd.mint(await pool.getAddress(), ether(200000));
    await pool.initialize();
    await weth.mint(await flash.getAddress(), ether(5000));
    await weth.mint(await lender.getAddress(), ether(50));
    await weth.mint(player.address, ether(1));
    await usd.mint(player.address, ether(10000));

    return { deployer, player, weth, usd, pool, flash, lender };
  }

  it("prices one WETH at 2,000 USD before any trade", async function () {
    const { pool } = await deploy();
    expect(await pool.wethPrice()).to.equal(ether(2000));
  });

  it("does not let the starter funds empty the lender at the fair price", async function () {
    const { player, weth, usd, lender } = await deploy();
    const lenderAddress = await lender.getAddress();

    await usd.connect(player).approve(lenderAddress, ether(10000));
    await lender.connect(player).deposit(ether(10000));
    const max = await lender.maxBorrow(player.address);
    expect(max).to.equal(ether("2.5"));

    await lender.connect(player).borrow(max);
    expect(await weth.balanceOf(lenderAddress)).to.equal(ether("47.5"));
    expect(await lender.solved()).to.equal(false);
    await expect(lender.connect(player).borrow(1)).to.be.revertedWith("collateral");
  });

  it("is solved when a flash swap crashes the spot price and borrows every WETH", async function () {
    const { player, weth, usd, pool, flash, lender } = await deploy();
    const attacker = await ethers.deployContract("Attacker", [
      await pool.getAddress(),
      await flash.getAddress(),
      await lender.getAddress(),
    ]);
    const attackerAddress = await attacker.getAddress();
    const lenderAddress = await lender.getAddress();

    await usd.connect(player).transfer(attackerAddress, ether(10000));
    const before = await weth.balanceOf(player.address);
    await attacker.connect(player).attack(ether(4000));

    expect(await weth.balanceOf(lenderAddress)).to.equal(0);
    expect(await lender.solved()).to.equal(true);
    expect(await weth.balanceOf(player.address)).to.be.gt(before + ether(49));
    expect(await weth.balanceOf(await flash.getAddress())).to.equal(ether(5000));
  });
});
