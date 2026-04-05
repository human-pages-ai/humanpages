# Smart Contract Security Protocol

## Mandatory: Attack Vector Test Suite

Every change to any `.sol` file under `src/` MUST be followed by running the full attack vector test suite. No exceptions.

### Run command

```bash
cd /home/ubuntu/projects/human-pages/contracts && forge test --summary
```

All tests must pass before committing, deploying, or opening a PR.

### Test structure

| File | Tests | What it covers |
|------|-------|----------------|
| `test/HumanPagesEscrow.t.sol` | 69 | Flow tests, negative tests, security fix regression tests, attack vector smoke tests |
| `test/attacks/Reentrancy.t.sol` | 10 | Classic reentrancy, cross-function reentrancy, read-only reentrancy, transferFrom reentrancy |
| `test/attacks/SignatureAttacks.t.sol` | 14 | EIP-712 replay (cross-chain, cross-contract, cross-job), malleability, zero-address, truncated/empty/oversized sigs, wrong domain |
| `test/attacks/StateMachine.t.sol` | 72 | Exhaustive state transition matrix (every function x every state), conservation of funds invariant, state finality (terminal states immutable) |
| `test/attacks/ERC20Attacks.t.sol` | 14 | Fee-on-transfer, rebasing, pausable, blacklist (payee + contract), return-false, no-return, approval race, deflationary, overflow |
| `test/attacks/EconomicAttacks.t.sol` | 20 | Front-running, fee rounding fuzz, collusion scenarios, dust attacks, cancel bait-and-switch, timestamp manipulation, multi-escrow isolation |
| `test/attacks/GriefingDoS.t.sol` | 20 | Fund locking, reverting receivers, admin renounce, pause interactions, USDC blacklist, atomic resolve coupling, no Funded timeout |

### When modifying the contract

1. **Before changing code**: Read the attack test that covers the area you're touching. Understand what invariants it enforces.
2. **After changing code**: Run `forge test`. If any attack test fails, your change broke a security property. Fix the change, not the test.
3. **Adding new functions**: Add corresponding attack tests to the relevant `test/attacks/` file. Every new external/public function needs:
   - State machine test: which states allow it? Test all invalid states revert.
   - Reentrancy test: if it transfers tokens, prove nonReentrant blocks callback attacks.
   - Access control test: who can call it? Prove unauthorized callers revert.
   - Economic test: can it be gamed for profit? Fuzz edge cases.
4. **Adding new state transitions**: Update `StateMachine.t.sol` transition matrix. Every (state, function) pair must be covered.
5. **Changing signature/EIP-712 logic**: Update `SignatureAttacks.t.sol`. Replay and malleability tests must cover the new logic.

### Known accepted risks (documented, not bugs)

These are design decisions with tests proving the behavior:

- **Arbitrator collusion**: Arbitrator can award 0 to either party. Mitigated at platform level (arbitrator curation + fee caps at 50%).
- **USDC blacklist**: If Circle blacklists the contract or a party, funds can get stuck. No on-chain fix — this is inherent to USDC.
- **No Funded-state timeout**: If relayer never calls markComplete, funds are stuck unless depositor proposes cancel and payee accepts.
- **forceRelease favors payee**: After 7-day arbitrator timeout, 100% goes to payee. This is intentional.
- **Cancel survives Funded->Completed**: A cancel proposal made during Funded remains valid after markComplete. Payee would only accept if terms are favorable.
- **Fee-on-transfer tokens**: Contract is designed for USDC only. Fee-on-transfer tokens cause insolvency. Token address is immutable.

### Deploying

1. Run full test suite: `forge test`
2. Deploy to Sepolia first: `forge script script/Deploy.s.sol --rpc-url $BASE_SEPOLIA_RPC --broadcast`
3. Verify on Basescan: `forge verify-contract <address> src/HumanPagesEscrow.sol:HumanPagesEscrow --chain base-sepolia --constructor-args $(cast abi-encode "constructor(address)" 0x036CbD53842c5426634e7929541eC2318f3dCF7e)`
4. Test all flows on Sepolia using cast
5. Only then deploy to mainnet
