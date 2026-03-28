const hre = require("hardhat");
const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");

async function get_balance() {
  // Specify the network provider
  const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");

  const deploymentsPath = path.join(__dirname, "ignition", "deployments", "chain-31337", "deployed_addresses.json");
  let data;
  try {
    const raw = fs.readFileSync(deploymentsPath, "utf8");
    data = JSON.parse(raw);
    //console.log("Deployed addresses:", JSON.stringify(data, null, 2)); // Debug: see all addresses
  } catch (err) {
    console.error("Could not read deployed_addresses.json:", err.message);
    process.exit(1);
  }

  const addr = data["WelcomeModule#Welcome"];
  if (!addr) {
    console.error("Contract address 'WelcomeModule#Welcome' not found. Available keys:", Object.keys(data));
    process.exit(1);
  }

  const balance = await provider.getBalance(addr);
  const formatEther = ethers.formatEther ?? (ethers.utils && ethers.utils.formatEther);
  
   
    return {
    address: addr,
    balance: formatEther ? formatEther(balance) : balance.toString()
  };
 }

module.exports = get_balance;



// In ethers.js (and Hardhat, which uses ethers.js under the hood), you can do:
// const provider = hre.ethers.provider; // Hardhat provider
// const balance = await provider.getBalance(contractAddress);
// Here’s what happens:
// provider.getBalance(address) calls the JSON-RPC method eth_getBalance.
// The Ethereum node simply looks up the account object at that address in the global state trie and returns the balance.
// No contract storage reading or ABI decoding is needed — the balance is part of the base account info, not part of the contract logic.

// An ABI (Application Binary Interface) is only needed when you want to call a contract function or read/write contract storage.
// For example, if your Solidity contract has:
// function totalFunds() public view returns (uint256)
// You need the ABI to encode the call correctly and decode the returned value.
// Balance, however, is not a function or storage variable. It is a built-in property of the Ethereum account, directly accessible from the node.
// In other words: balance exists at the protocol level, not the contract level. The ABI only describes how to talk to contract-specific functions and data, not basic Ethereum state.