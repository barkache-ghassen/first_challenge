#!/bin/bash
set -euo pipefail

echo "=================================================="
echo "Starting Web3 Challenge services (as root)"
echo "=================================================="

# Run the challenge directly as root
cd /root/challenge || exit 1

# Install npm packages only once
[ ! -d node_modules ] && npm ci --silent 2>/dev/null || true

# Start the full stack (Hardhat + Python server + Node API)
echo 'Starting challenge stack...' > /root/challenge.log
nohup ./run_challenge.sh >> /root/challenge.log 2>&1 &

echo "Waiting 20 seconds for Hardhat node, deployment & servers (8000 + 3000)..."
sleep 20
echo "Challenge is now LIVE at http://localhost:8000"

# Finally start the original VNC + noVNC desktop
echo "Starting VNC/noVNC desktop..."
exec /root/start.sh