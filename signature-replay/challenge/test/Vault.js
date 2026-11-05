const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

// Voucher helper: operator signs keccak256(abi.encodePacked(to, amount)) with
// the EIP-191 personal-message prefix (what ethers' signMessage applies).
async function signVoucher(operator, to, amount) {
  const message = ethers.solidityPackedKeccak256(["address", "uint256"], [to, amount]);
  const sig = await operator.signMessage(ethers.getBytes(message));
  return ethers.Signature.from(sig);
}

describe("SignatureVault", function () {
  const VOUCHER_AMOUNT = ethers.parseEther("1");
  const VAULT_FUNDING = ethers.parseEther("10");

  // The deployer only holds 12.5 ETH, so every test reverts to one 10 ETH deploy.
  async function deployFixture() {
    // Mirrors the fixed accounts in hardhat.config.js: #4 deploys, #1 is the beneficiary.
    const signers = await ethers.getSigners();
    const deployer = signers[4];
    const player = signers[1];
    const operator = ethers.Wallet.createRandom();

    const Vault = await ethers.getContractFactory("SignatureVault", deployer);
    const vault = await Vault.deploy(operator.address, { value: VAULT_FUNDING });
    await vault.waitForDeployment();

    const sig = await signVoucher(operator, player.address, VOUCHER_AMOUNT);
    return { vault, deployer, player, operator, sig };
  }

  it("honours a single valid voucher", async function () {
    const { vault, player, sig } = await loadFixture(deployFixture);
    await vault.redeem(player.address, VOUCHER_AMOUNT, sig.v, sig.r, sig.s);
    expect(await vault.totalReleased()).to.equal(VOUCHER_AMOUNT);
    expect(await vault.solved()).to.equal(false);
  });

  it("rejects a voucher not signed by the operator", async function () {
    const { vault, player } = await loadFixture(deployFixture);
    const impostor = ethers.Wallet.createRandom();
    const forged = await signVoucher(impostor, player.address, VOUCHER_AMOUNT);
    await expect(
      vault.redeem(player.address, VOUCHER_AMOUNT, forged.v, forged.r, forged.s)
    ).to.be.revertedWith("bad signature");
  });

  it("rejects a tampered amount", async function () {
    const { vault, player, sig } = await loadFixture(deployFixture);
    await expect(
      vault.redeem(player.address, ethers.parseEther("10"), sig.v, sig.r, sig.s)
    ).to.be.revertedWith("bad signature");
  });

  it("is solved by replaying the single voucher until the vault is empty", async function () {
    const { vault, player, sig } = await loadFixture(deployFixture);

    // The voucher authorizes only 1 ETH, but there is no nonce or used-flag, so
    // the same signature can be submitted repeatedly to drain all 10 ETH.
    for (let i = 0; i < 10; i++) {
      await vault.redeem(player.address, VOUCHER_AMOUNT, sig.v, sig.r, sig.s);
    }

    expect(await ethers.provider.getBalance(await vault.getAddress())).to.equal(0n);
    expect(await vault.totalReleased()).to.equal(VAULT_FUNDING);
    expect(await vault.solved()).to.equal(true);
  });
});
