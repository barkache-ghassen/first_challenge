const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

const ether = (amount) => BigInt(amount) * 10n ** 18n;

// Operator (trusted signer) for the vault. Its private key was used only to
// precompute the single voucher published to the player and is NOT stored here
// or anywhere in the challenge image.
const OPERATOR = "0x7fb14d53083E1Cb7781637f21E18a752B0a2FC52";

module.exports = buildModule("VaultModule", (m) => {
  // Account #4 is the funded deployer; it is the only account that can cover
  // the 10 ETH seed. Players use accounts #0-#3.
  const deployer = m.getAccount(4);

  // Vault is seeded with 10 ETH; the only voucher authorizes just 1 ETH.
  const vault = m.contract("SignatureVault", [OPERATOR], { value: ether(10), from: deployer });

  return { vault };
});
