# Escrow Smart Contract + MoltCourt Dispute Resolution

**Status:** Planned (Post-Launch)
**Supersedes:** [burnable-escrow.md](./burnable-escrow.md)
**Chain:** Base (USDC only for v1)
**Dispute Resolution:** MoltCourt (AI debate arena)

---

## Overview

A smart contract escrow system where funds are held on-chain (not by Human Pages). MoltCourt — an AI debate arena — decides disputed outcomes via cryptographically signed verdicts. Human Pages acts only as a coordinator: verifying on-chain state and relaying verdicts.

### Why Not Burnable Escrow?

The earlier burnable-escrow design had a fundamental problem: the Agent's only dispute option was total destruction of funds. MoltCourt enables **fair partial splits** — a dispute over 60% completion can result in a 60/40 payout rather than all-or-nothing.

### Flow

```
Agent deposits USDC --> Escrow Contract (Base) --> holds funds
  Happy path: Agent calls release() --> funds go to Human
  Mutual cancel: Both parties agree on a split --> funds distribute per agreement
  Dispute: Either party calls dispute() --> MoltCourt debates --> signed verdict relayed --> contract distributes
  Timeout: 30 days no verdict --> Human can withdraw (favoring the worker)
```

All escrows live on the same contract, isolated by `jobId` mapping. Each escrow tracks its own `depositor`, `payee`, `amount`, and `state` independently.

---

## Game Theory

| Scenario | Agent | Human | Outcome |
|----------|-------|-------|---------|
| Work done well | Releases payment | Receives full amount | Happy path |
| Partial completion | Proposes 70/30 cancel | Accepts or disputes | Fair split |
| No work done | Proposes 0/100 cancel (full refund) | Accepts or disputes | Mutual cancel |
| Genuine dispute | Either party disputes | MoltCourt decides | Evidence-based split |
| Agent abandons dispute | Does nothing for 30 days | Withdraws via timeout | Human protected |

**Key insight:** The 30-day timeout always favors the Human (worker). Agents are incentivized to either release or engage with the dispute process — ghosting means the Human gets everything.

### Comparison to Other Models

| Model | Agent can profit from lying? | Platform liability? | Partial splits? |
|-------|------------------------------|---------------------|-----------------|
| P2P (current) | Yes (ghost after work) | None | N/A |
| Platform Escrow | No | Yes (custody risk) | Manual |
| Burnable Escrow (old) | No | None | No (all-or-nothing) |
| **MoltCourt Escrow** | No | None | Yes (AI-adjudicated) |

---

## Smart Contract Design

### Safety Features

- **Deposit cap**: `uint256 public maxDeposit` (start at $500 USDC) + `uint256 public minDeposit` ($5 USDC), owner-adjustable
- **Pausable**: Owner can pause new deposits. Existing escrows can always be released/resolved/timed-out (funds never stuck by a pause)
- **ReentrancyGuard**: On all state-changing functions that transfer tokens
- **Blacklist**: `mapping(address => bool) public blacklisted` — owner can block bad actors from depositing or being payees
- **USDC hardcoded**: Single immutable token address set in constructor, no arbitrary ERC-20 risk
- **Arbitrator whitelist**: `mapping(address => bool) public approvedArbitrators` — closed list of vetted addresses. Owner can add/remove. Contract accepts verdicts from ANY approved arbitrator. No single `setArbitrator()` backdoor.

### State & Storage

```solidity
mapping(bytes32 => Escrow) escrows;                  // jobId hash --> escrow data
mapping(address => bool) public approvedArbitrators;  // whitelist of vetted arbitrator keys
mapping(address => bool) public blacklisted;          // blocked addresses
mapping(bytes32 => bool) public verdictExecuted;      // replay protection
mapping(bytes32 => CancelProposal) cancelProposals;   // pending mutual cancellation proposals

uint256 public constant DISPUTE_TIMEOUT = 30 days;
uint256 public constant CANCEL_PROPOSAL_EXPIRY = 7 days;
address public immutable token;                       // USDC address (set once in constructor)
```

### Escrow Struct

```solidity
enum EscrowState { Empty, Deposited, Released, Cancelled, Disputed, Resolved, TimedOut }

struct Escrow {
    address depositor;      // agent's wallet
    address payee;          // human's wallet
    uint256 amount;         // total escrowed (USDC, 6 decimals)
    EscrowState state;      // lifecycle state
    uint256 disputedAt;     // timestamp when dispute was raised
}

struct CancelProposal {
    uint256 amountToPayee;      // proposed amount to human
    uint256 amountToDepositor;  // proposed amount to agent
    uint256 proposedAt;         // timestamp
}
```

### Functions

| Function | Access | Description |
|----------|--------|-------------|
| `deposit(jobId, payee, amount)` | Not blacklisted, not paused | Agent deposits USDC. Must be within min/max cap. |
| `release(jobId)` | Depositor only | Happy path -- full amount to payee |
| `proposeCancel(jobId, amountToPayee)` | Depositor only | Proposes a split. `amountToDepositor = escrow.amount - amountToPayee` |
| `acceptCancel(jobId)` | Payee only | Accepts proposed split, funds distribute to both parties |
| `dispute(jobId)` | Either party | Sets state to Disputed, starts 30-day timer |
| `resolve(jobId, amountToPayee, amountToDepositor, nonce, signature)` | Anyone (relayer) | Verifies EIP-712 sig from an approved arbitrator. Distributes accordingly. |
| `timeoutWithdraw(jobId)` | Anyone | After 30 days, full amount to payee (human) |
| `addArbitrator(address)` | Owner | Add address to approved arbitrator whitelist |
| `removeArbitrator(address)` | Owner | Remove address from whitelist |
| `setMaxDeposit(uint256)` | Owner | Adjust deposit cap |
| `setMinDeposit(uint256)` | Owner | Adjust minimum deposit |
| `setBlacklisted(address, bool)` | Owner | Block/unblock an address |
| `pause() / unpause()` | Owner | Emergency pause (deposits only) |

### EIP-712 Verdict Type

```
Verdict(bytes32 jobId, uint256 amountToPayee, uint256 amountToDepositor, uint256 nonce)
```

Explicit split -- no ambiguity about who gets what. Contract verifies `amountToPayee + amountToDepositor == escrow.amount`.

### Arbitrator Key Compromise Response

If an arbitrator key is compromised:
1. Owner calls `pause()` -- stops new deposits immediately
2. Owner calls `removeArbitrator(compromisedAddress)` -- invalidates the key
3. Owner calls `unpause()` -- resume normal operations
4. Existing disputed escrows can still be resolved by other approved arbitrators, or via 30-day timeout

### Arbitrator Transition

When an arbitrator is removed from the whitelist, their unrelayed verdicts become invalid. Remaining approved arbitrators can re-assess and issue new verdicts for open disputes. The 30-day timeout is the ultimate fallback -- no dispute is ever permanently stuck.

---

## Inheritance & Dependencies

```
HumanPagesEscrow
  ├── EIP712        (OpenZeppelin - signature verification)
  ├── Ownable       (OpenZeppelin - admin functions)
  ├── Pausable      (OpenZeppelin - emergency pause)
  └── ReentrancyGuard (OpenZeppelin - reentrancy protection)
```

Constructor args: `address _token` (USDC), `address _initialArbitrator` (MoltCourt's key), `uint256 _maxDeposit`, `uint256 _minDeposit`.

---

## Gas Costs (Base L2)

| Action | Estimated Gas | Cost (USD) |
|--------|---------------|------------|
| deposit() | ~80,000 | $0.02 - $0.05 |
| release() | ~50,000 | $0.01 - $0.03 |
| proposeCancel() | ~50,000 | $0.01 - $0.03 |
| acceptCancel() | ~60,000 | $0.01 - $0.05 |
| dispute() | ~40,000 | $0.01 - $0.02 |
| resolve() (relayed) | ~70,000 | $0.01 - $0.05 |
| timeoutWithdraw() | ~50,000 | $0.01 - $0.03 |

**Total per happy-path job:** ~$0.03 - $0.08 (deposit + release)
**Total per dispute:** ~$0.05 - $0.12 (deposit + dispute + resolve)

---

## Database Schema Changes

### New Enum

```prisma
enum EscrowStatus {
  PENDING_DEPOSIT
  DEPOSITED
  RELEASED
  CANCELLED
  DISPUTED
  RESOLVED
  TIMED_OUT
}
```

### New Fields on Job Model

```prisma
model Job {
  // ... existing fields (after streamContractId)

  // ===== ESCROW FIELDS =====
  escrowStatus                EscrowStatus?
  escrowNetwork               String?
  escrowContractAddress       String?
  escrowJobIdHash             String?
  escrowDepositTxHash         String?
  escrowDepositedAt           DateTime?
  escrowDepositorAddress      String?
  escrowPayeeAddress          String?
  escrowReleaseTxHash         String?
  escrowReleasedAt            DateTime?
  escrowCancelTxHash          String?
  escrowCancelledAt           DateTime?
  escrowCancelAmountPayee     Decimal?           @db.Decimal(18, 6)
  escrowCancelAmountDepositor Decimal?           @db.Decimal(18, 6)
  escrowDisputeTxHash         String?
  escrowDisputedAt            DateTime?
  escrowDisputeReason         String?            @db.VarChar(1000)
  escrowMoltCourtCaseId       String?
  escrowVerdictAmountPayee    Decimal?           @db.Decimal(18, 6)
  escrowVerdictAmountDepositor Decimal?          @db.Decimal(18, 6)
  escrowVerdictSignature      String?
  escrowVerdictNonce          String?
  escrowResolveTxHash         String?
  escrowResolvedAt            DateTime?
  escrowTimeoutAt             DateTime?

  @@index([escrowStatus])
}
```

### New Fields on Agent Model (Reputation)

```prisma
model Agent {
  // ... existing fields

  // ===== ESCROW REPUTATION =====
  escrowReleaseCount  Int @default(0)
  escrowDisputeCount  Int @default(0)
  escrowTimeoutCount  Int @default(0)
}
```

---

## API Endpoints

### Escrow Routes (`/api/escrow`)

**Flow:** User calls the smart contract function first (deposit/release/dispute/etc.), then calls the API with the tx hash. Backend reads on-chain state to verify, then updates the database.

| Endpoint | Auth | Description |
|----------|------|-------------|
| `POST /api/escrow/:jobId/deposit` | Agent | Verify escrow deposit on-chain, update job to PAID + DEPOSITED |
| `POST /api/escrow/:jobId/release` | Agent | Verify release on-chain, update job to COMPLETED + RELEASED |
| `POST /api/escrow/:jobId/propose-cancel` | Agent | Record cancel proposal (verified on-chain) |
| `POST /api/escrow/:jobId/accept-cancel` | Human | Verify mutual cancel on-chain, update to CANCELLED |
| `POST /api/escrow/:jobId/dispute` | Either | Verify dispute on-chain, create MoltCourt case, update to DISPUTED |
| `POST /api/escrow/:jobId/resolve` | Either | Verify resolution on-chain, update to RESOLVED |
| `POST /api/escrow/:jobId/timeout` | Either | Verify timeout withdrawal on-chain, update to TIMED_OUT |
| `GET /api/escrow/:jobId/status` | Public | Return escrow status + live on-chain state |
| `POST /api/escrow/webhook/moltcourt` | HMAC | Receive verdict from MoltCourt, auto-relay on-chain, notify parties |

### Verdict Relay

When MoltCourt webhook delivers a verdict, the backend auto-relays `resolve()` on-chain using a relayer wallet (small ETH balance on Base, ~$0.01 per tx). This way humans don't need ETH for dispute resolution.

---

## MCP Server Tools

3 new tools following existing patterns:

| Tool | Description |
|------|-------------|
| `escrow_deposit` | Agent records deposit after calling contract |
| `escrow_release` | Agent records release after calling contract |
| `escrow_dispute` | Agent records dispute after calling contract |

Update `get_job_status` to include escrow info when present.

---

## Blockchain Service Layer

### `backend/src/lib/blockchain/escrow.ts`

Following patterns from `verify-payment.ts` and `superfluid.ts`:

- `ESCROW_CONTRACT_ADDRESSES: Record<string, Address>` -- contract addresses per network
- `ESCROW_NETWORKS = ['base', 'base-sepolia']`
- `jobIdToBytes32(jobId: string): Hex` -- `keccak256(encodePacked(['string'], [jobId]))`
- `verifyEscrowDeposit(params)` -- reads contract state, verifies amount/payee match
- `getEscrowState(network, jobId)` -- reads on-chain escrow state
- `getEscrowEIP712Domain(network)` -- returns domain separator config
- Minimal ABI (only `getEscrow` view function + events)

### `backend/src/lib/blockchain/moltcourt.ts`

- `createMoltCourtCase(params)` -- POST case to MoltCourt API with job details, dispute reason, party addresses, escrow info
- `getMoltCourtVerdict(caseId)` -- poll for verdict (fallback if webhook fails)
- `MoltCourtError` -- custom error class
- Configurable via `MOLTCOURT_API_URL`, `MOLTCOURT_API_KEY` env vars
- Graceful failure -- dispute still works if MoltCourt is unreachable (on-chain state is source of truth, timeout protects human)

---

## Reputation Tracking

### For Humans (existing trust score)

- Escrow released cleanly --> counts as successful completion
- Dispute won --> neutral
- Dispute lost --> penalty (same as current -15%)
- Won via timeout --> mild positive

### For Agents (new fields)

- Track: `escrowReleaseCount`, `escrowDisputeCount`, `escrowTimeoutCount`
- Derive: release rate, dispute rate, timeout rate (how often agent abandons disputes)
- Expose agent reputation in `GET /api/agents/:id` and job status responses
- Humans can see agent escrow reputation before accepting jobs

---

## Contract Test Cases

1. Happy path: deposit --> release
2. Mutual cancel: deposit --> proposeCancel(70/30) --> acceptCancel
3. Mutual cancel: full refund (0/100 split)
4. Dispute + full resolution to human (100/0)
5. Dispute + full refund to agent (0/100)
6. Dispute + partial split (70/30)
7. 30-day timeout --> human withdraws
8. Deposit cap enforcement (min and max)
9. Blacklist enforcement
10. Pause enforcement (deposits blocked, releases/resolves still work)
11. Arbitrator whitelist (approved signer accepted, unapproved rejected)
12. Signature replay protection
13. Invalid states (release on empty, dispute on released, etc.)
14. Reentrancy resistance
15. Cancel proposal expiry (7 days)

---

## Environment Variables

```
ESCROW_CONTRACT_BASE=0x...
ESCROW_CONTRACT_BASE_SEPOLIA=0x...
ESCROW_RELAYER_PRIVATE_KEY=0x...  (for auto-relaying verdicts)
MOLTCOURT_API_URL=https://api.moltcourt.fun
MOLTCOURT_API_KEY=...
MOLTCOURT_WEBHOOK_SECRET=...
```

---

## Deployment Plan

### Foundry Project Structure

```
contracts/
  foundry.toml
  src/HumanPagesEscrow.sol
  test/HumanPagesEscrow.t.sol
  script/Deploy.s.sol
  lib/  (openzeppelin via forge install)
```

### Constructor Args

- `token`: USDC address (Base: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`, Base Sepolia: `0x036CbD53842c5426634e7929541eC2318f3dCF7e`)
- `initialArbitrator`: MoltCourt's signing address
- `maxDeposit`: 500 * 1e6 (500 USDC)
- `minDeposit`: 5 * 1e6 (5 USDC)

Owner should be a multisig (Safe) on mainnet, not the deployer hot wallet.

---

## Files to Create

| File | Purpose |
|------|---------|
| `contracts/foundry.toml` | Foundry config |
| `contracts/src/HumanPagesEscrow.sol` | Escrow smart contract |
| `contracts/test/HumanPagesEscrow.t.sol` | Contract tests |
| `contracts/script/Deploy.s.sol` | Deployment script |
| `backend/src/lib/blockchain/escrow.ts` | Contract interaction service |
| `backend/src/lib/blockchain/moltcourt.ts` | MoltCourt API client |
| `backend/src/routes/escrow.ts` | Escrow REST endpoints |

## Files to Modify

| File | Change |
|------|--------|
| `backend/prisma/schema.prisma` | Add EscrowStatus enum + escrow fields on Job + agent reputation fields |
| `backend/src/lib/blockchain/index.ts` | Re-export escrow + moltcourt modules |
| `backend/src/app.ts` | Mount escrow routes |
| `humanpages/src/index.ts` | Add escrow MCP tools |

---

## Implementation Phases

### Phase 1: Smart Contract
- [ ] Set up Foundry project
- [ ] Write `HumanPagesEscrow.sol`
- [ ] Write comprehensive tests (15 cases)
- [ ] Write deployment script
- [ ] Deploy to Base Sepolia, test with faucet USDC

### Phase 2: Backend Integration
- [ ] Run Prisma migration (EscrowStatus enum + Job fields + Agent reputation)
- [ ] Create `escrow.ts` blockchain service
- [ ] Create `moltcourt.ts` API client
- [ ] Create escrow routes
- [ ] Mount routes in `app.ts`
- [ ] Update blockchain `index.ts` exports

### Phase 3: MCP Server
- [ ] Add `escrow_deposit`, `escrow_release`, `escrow_dispute` tools
- [ ] Update `get_job_status` to include escrow info

### Phase 4: Mainnet Launch
- [ ] Deploy contract to Base mainnet (owner = multisig)
- [ ] End-to-end smoke test
- [ ] Monitor first real escrows

---

## Security Considerations

1. **Contract Audit:** Get the escrow contract audited before mainnet deployment
2. **Reentrancy:** OpenZeppelin ReentrancyGuard on all transfer functions
3. **USDC Only:** Single immutable token address, no arbitrary ERC-20 risk
4. **Arbitrator Whitelist:** No single-key backdoor, closed list of vetted addresses
5. **Timeout Fallback:** 30-day timeout ensures no funds are permanently stuck
6. **Relayer Wallet:** Small ETH balance, only used for verdict relay -- no access to escrowed funds
7. **Replay Protection:** `verdictExecuted` mapping + nonce in EIP-712 signature
8. **Pausable:** Owner can freeze new deposits without affecting existing escrows

---

## Open Questions

1. **MoltCourt API spec?** Need to finalize webhook payload format and HMAC signing
2. **Multisig setup?** Which Safe configuration for mainnet contract owner?
3. **Relayer key management?** AWS KMS vs. local encrypted keystore?
4. **Frontend escrow UX?** Separate design pass needed for escrow status displays
5. **Should this replace burnable-escrow.md entirely?** Or keep both as options?

---

## References

- [EIP-712: Typed Structured Data Hashing and Signing](https://eips.ethereum.org/EIPS/eip-712)
- [OpenZeppelin Contracts](https://docs.openzeppelin.com/contracts)
- [Base USDC Address](https://basescan.org/token/0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913)
- [MoltCourt](https://moltcourt.fun)
