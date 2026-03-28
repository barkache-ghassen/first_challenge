// This setup uses Hardhat Ignition to manage smart contract deployments.
// Learn more about it at https://hardhat.org/ignition

const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

const amount = 1_000_000_000_000_000_000n;

module.exports = buildModule("WelcomeModule", (m) => {
  
  const welcome = m.contract("Welcome",[], {
    value: amount,
  });

  return { welcome };
});
