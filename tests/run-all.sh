#!/bin/bash
# Runs every test: unit tests per challenge, the requirement checks, then end-to-end.
# Usage: tests/run-all.sh            (skip end-to-end with SKIP_E2E=1)
set -e
cd "$(dirname "$0")/.."

for c in approval-trap flash-loan-oracle signature-replay; do
  echo "== Unit tests: $c"
  (cd "$c/challenge" && { [ -d node_modules ] || npm ci --silent; } && npx hardhat test)
done

echo "== Requirement checks"
node --test tests/requirements.test.js

if [ "${SKIP_E2E:-0}" != 1 ]; then
  echo "== End-to-end (starts each challenge with run_challenge.sh)"
  node --test --test-concurrency=1 tests/e2e.test.js
fi
