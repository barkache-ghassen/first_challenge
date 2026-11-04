require("@nomicfoundation/hardhat-toolbox");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.28",
  networks: {
    hardhat: {
      accounts: [
        {
          privateKey: "0x689af8efa8c651a91ad287602527f3af2fe9f6501a7ac4b061667b5a93e037fd",
          balance: "1000000000000000000",
        },
        {
          privateKey: "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
          balance: "1000000000000000000",
        },
        {
          privateKey: "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a",
          balance: "1000000000000000000",
        },
        {
          privateKey: "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6",
          balance: "1000000000000000000",
        },
        // Deployer only: funds and deploys the challenge, never shown to players.
        {
          privateKey: "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
          balance: "12500000000000000000",
        },
      ],
    },
    localhost: {
      url: process.env.RPC_URL || "http://127.0.0.1:8545",
    },
  },
};
