#!/bin/bash
set -e

# Install Hardhat if not installed yet
if ! [ -d "node_modules/hardhat" ]; then
    echo "Installing Hardhat..."
    npm install --save-dev hardhat
fi

# Start Hardhat node in background
echo "Starting Hardhat node..."
npx hardhat node &
HARDHAT_PID=$!

# Wait a few seconds for node to start
sleep 5

# Deploy contracts
echo "Deploying contracts..."
npx hardhat ignition deploy ignition/modules/deploy.js --network localhost

# Start Python server in background
echo "Starting protected Python server (only contract.html)..."
python3 server.py &
PYTHON_PID=$!

# Start Node server in foreground
echo "Starting Node server..."
node server.js &
NODE_PID=$!

# Cleanup function on container stop
cleanup() {
    echo "Stopping all servers..."
    kill $HARDHAT_PID $PYTHON_PID $NODE_PID 2>/dev/null || true
}
trap cleanup SIGINT SIGTERM EXIT

# Wait for Node server to exit
wait $NODE_PID
