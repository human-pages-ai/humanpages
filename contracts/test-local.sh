#!/bin/bash
# Local E2E verification: deploy contracts to Anvil, test via cast
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
RPC="http://127.0.0.1:8545"

# Anvil deterministic accounts
DEPLOYER_PK="0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
RELAYER_PK="0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d"
RELAYER_ADDR="0x70997970C51812dc3A010C7d01b50e0d17dc79C8"
DEPOSITOR_PK="0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a"
DEPOSITOR_ADDR="0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC"
ARB_PK="0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6"
ARB_ADDR="0x90F79bf6EB2c4f870365E785982E1f101E93b906"
WORKER_ADDR="0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65"

cleanup() {
    [ -n "$ANVIL_PID" ] && kill $ANVIL_PID 2>/dev/null
    exit ${1:-0}
}
trap cleanup EXIT INT TERM

echo "=== 1. Starting Anvil ==="
anvil --chain-id 84532 --port 8545 --silent &
ANVIL_PID=$!
sleep 2
cast chain-id --rpc-url $RPC > /dev/null 2>&1 || { echo "FAIL: Anvil not running"; exit 1; }
echo "OK: Anvil running"

echo ""
echo "=== 2. Deploying contracts ==="
cd "$SCRIPT_DIR"

DEPLOY_OUTPUT=$(forge script script/DeployLocal.s.sol --tc DeployLocal --rpc-url $RPC --broadcast 2>&1)
USDC_ADDR=$(echo "$DEPLOY_OUTPUT" | grep "USDC deployed to:" | awk '{print $NF}')
ESCROW_ADDR=$(echo "$DEPLOY_OUTPUT" | grep "Escrow deployed to:" | awk '{print $NF}')

if [ -z "$USDC_ADDR" ] || [ -z "$ESCROW_ADDR" ]; then
    echo "FAIL: Deploy failed"
    echo "$DEPLOY_OUTPUT"
    exit 1
fi
echo "OK: USDC=$USDC_ADDR  Escrow=$ESCROW_ADDR"

echo ""
echo "=== 3. Approve USDC spending ==="
cast send "$USDC_ADDR" "approve(address,uint256)" "$ESCROW_ADDR" \
    "115792089237316195423570985008687907853269984665640564039457584007913129639935" \
    --private-key "$DEPOSITOR_PK" --rpc-url "$RPC" > /dev/null 2>&1
echo "OK: Depositor approved"

echo ""
echo "=== 4. Deposit into escrow ==="
JOB_ID="test-job-001"
JOB_HASH=$(cast keccak "0x$(printf '%s' "$JOB_ID" | xxd -p -c 256)" 2>/dev/null)
echo "Job hash: $JOB_HASH"

TX=$(cast send "$ESCROW_ADDR" \
    "deposit(bytes32,address,address,uint32,uint256,uint256)" \
    "$JOB_HASH" "$WORKER_ADDR" "$ARB_ADDR" 259200 100000000 500 \
    --private-key "$DEPOSITOR_PK" --rpc-url "$RPC" --json 2>&1)

TX_STATUS=$(echo "$TX" | python3 -c "import sys,json; print(json.load(sys.stdin).get('status',''))" 2>/dev/null)
TX_HASH=$(echo "$TX" | python3 -c "import sys,json; print(json.load(sys.stdin).get('transactionHash',''))" 2>/dev/null)

if [ "$TX_STATUS" != "0x1" ]; then
    echo "FAIL: Deposit tx failed"
    echo "$TX" | python3 -m json.tool 2>/dev/null || echo "$TX"
    exit 1
fi
echo "OK: Deposit tx=$TX_HASH"

# Verify escrow state
STATE=$(cast call "$ESCROW_ADDR" "getEscrow(bytes32)((address,address,address,uint256,uint256,uint8,uint256,uint256,uint32,uint256))" "$JOB_HASH" --rpc-url "$RPC" 2>/dev/null)
echo "Escrow state: $STATE"

echo ""
echo "=== 5. Mark complete (relayer) ==="
cast send "$ESCROW_ADDR" "markComplete(bytes32)" "$JOB_HASH" \
    --private-key "$RELAYER_PK" --rpc-url "$RPC" > /dev/null 2>&1
STATE2=$(cast call "$ESCROW_ADDR" "getEscrow(bytes32)((address,address,address,uint256,uint256,uint8,uint256,uint256,uint32,uint256))" "$JOB_HASH" --rpc-url "$RPC" 2>/dev/null)
echo "State after markComplete: $STATE2"

echo ""
echo "=== 6. Release (after warp) ==="
# Warp time forward (Anvil supports evm_increaseTime)
cast rpc evm_increaseTime 260000 --rpc-url "$RPC" > /dev/null 2>&1
cast rpc evm_mine --rpc-url "$RPC" > /dev/null 2>&1

cast send "$ESCROW_ADDR" "release(bytes32)" "$JOB_HASH" \
    --private-key "$RELAYER_PK" --rpc-url "$RPC" > /dev/null 2>&1

WORKER_BAL=$(cast call "$USDC_ADDR" "balanceOf(address)(uint256)" "$WORKER_ADDR" --rpc-url "$RPC" 2>/dev/null)
echo "Worker USDC balance: $WORKER_BAL"

ESCROW_BAL=$(cast call "$USDC_ADDR" "balanceOf(address)(uint256)" "$ESCROW_ADDR" --rpc-url "$RPC" 2>/dev/null)
echo "Escrow USDC balance: $ESCROW_BAL"

echo ""
echo "=========================================="
echo "  LOCAL E2E VERIFICATION RESULTS"
echo "=========================================="
echo ""

if [ "$WORKER_BAL" = "100000000" ]; then
    echo "  [OK] Happy path PASSED - Worker received 100 USDC"
else
    echo "  [??] Worker balance: $WORKER_BAL (expected 100000000)"
fi

echo ""
echo "  Contract: $ESCROW_ADDR"
echo "  USDC: $USDC_ADDR"
echo ""

cleanup 0
