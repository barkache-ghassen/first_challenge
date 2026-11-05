#!/bin/bash
set -e

cd "$(dirname "$0")"

export RPC_URL="${RPC_URL:-http://127.0.0.1:8545}"
export API_PORT="${API_PORT:-3000}"
export PAGE_PORT="${PAGE_PORT:-8000}"
RPC_PORT="${RPC_URL##*:}"

echo "Starting contract page on port ${PAGE_PORT}..."
python3 server.py &
PYTHON_PID=$!

if [ -f package.json ]; then
  echo "Installing npm dependencies..."
  npm ci --silent
fi

echo "Starting Hardhat node on port ${RPC_PORT}..."
npx hardhat node --hostname 127.0.0.1 --port "$RPC_PORT" &
HARDHAT_PID=$!

ready=0
for _ in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20 21 22 23 24 25 26 27 28 29 30; do
  if curl -sf -m 1 -H "content-type: application/json" \
    -d '{"jsonrpc":"2.0","id":1,"method":"eth_chainId","params":[]}' \
    "$RPC_URL" >/dev/null; then
    ready=1
    break
  fi
  sleep 1
done
if [ "$ready" != 1 ]; then
  echo "Hardhat node did not start"
  exit 1
fi

echo "Deploying contracts..."
npx hardhat ignition deploy ignition/modules/deploy.js --network localhost

echo "Starting solve API on port ${API_PORT}..."
node server.js &
NODE_PID=$!

if [ -d /home/Hamonis/.npm ]; then
  chown -R 1000:1000 /home/Hamonis/.npm || true
fi

cleanup() {
  echo "Stopping all servers..."
  kill $HARDHAT_PID $PYTHON_PID $NODE_PID 2>/dev/null || true
}
trap cleanup SIGINT SIGTERM EXIT

wait $NODE_PID
