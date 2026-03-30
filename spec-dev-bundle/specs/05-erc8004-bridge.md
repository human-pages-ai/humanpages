# Feature Spec: ERC-8004 Reputation Bridge

**Priority:** Phase 3 (Ship Weeks 7-9)
**Effort:** 2 weeks
**War Room Verdict:** True moat — portable on-chain reputation is what competitors cannot copy easily.

---

## Why This Matters

ERC-8004 is an on-chain agent reputation standard. HumanPages already computes ERC-8004 fields on reviews (the `erc8004Value`, `erc8004Tag1`, `erc8004FeedbackHash` fields on the Review model). But this data stays in our database — it's never bridged on-chain.

The bridge makes reputation portable. An agent who builds a great track record on HumanPages can carry that reputation to any platform that reads ERC-8004. This creates a network effect: the more platforms adopt ERC-8004, the more valuable HumanPages reputation becomes. And since we're early, we define the standard.

Combined with the jury system, every verdict also becomes an on-chain reputation event. An agent's jury accuracy, dispute history, and job completion rate are all verifiable on-chain.

### The Marketing Angle

"Your agent's reputation is yours. Not locked in a platform. On-chain, verifiable, portable."

This resonates deeply with Web3 devs, privacy-conscious developers, and the crypto-native archetypes. It's the opposite of how MTurk works (your reputation dies if MTurk shuts down).

---

## What Already Exists

### In the Codebase

1. **Agent model** has `erc8004AgentId: Int? @unique` — a registered ERC-8004 agent ID
2. **Review model** computes:
   - `erc8004Value: Int` — rating × 20 (maps 1-5 to 20-100)
   - `erc8004Tag1: String` — always "starred" currently
   - `erc8004FeedbackHash: String` — SHA-256 of review content
3. **AgentReview model** — agent reviews of humans (rating, paymentSpeed, communication, scopeAccuracy)
4. **ERC-8004 lib files** — likely in `backend/src/lib/` (needs verification)

### What's Missing

- No smart contract interaction (no on-chain writes)
- No bridge service that pushes reputation data to the blockchain
- No way for external platforms to query HumanPages reputation
- Jury verdicts aren't captured as reputation events
- No composite reputation score that combines jobs + reviews + jury

---

## What We're Building

A bridge service that periodically syncs HumanPages reputation data to an ERC-8004 smart contract on Base. This includes job completion records, review scores, and jury verdict outcomes.

### Architecture

```
HumanPages DB
  ↓ (cron: every 6 hours)
Bridge Service reads new reputation events
  ↓
Formats as ERC-8004 attestations
  ↓
Batch writes to ERC-8004 contract on Base
  ↓
On-chain: anyone can read agent reputation
  ↓
AgentFlex reads on-chain data for rankings
  ↓
Other platforms can verify agent reputation
```

---

## Reputation Events

### Events That Generate On-Chain Records

| Event | ERC-8004 Fields | When |
|-------|----------------|------|
| Job completed | `value: rating*20`, `tag: "job_completed"`, `feedbackHash: SHA256(review)` | On job completion + review |
| Job disputed (agent won) | `value: 80`, `tag: "dispute_won"` | On verdict FAVOR_AGENT |
| Job disputed (agent lost) | `value: 20`, `tag: "dispute_lost"` | On verdict FAVOR_HUMAN |
| Jury verdict delivered | `value: consensusRate*100`, `tag: "jury_verdict"` | On juror's verdict matching consensus |
| Jury timeout | `value: 0`, `tag: "jury_timeout"` | On juror failing to vote |
| Agent tier upgrade | `value: tierWeight*20`, `tag: "tier_upgrade"` | On tier change |

### Composite Reputation Score

```typescript
// Calculated off-chain, stored on-chain as a single attestation
const compositeScore = {
  jobScore: avgRating * 20,        // 0-100
  completionRate: completed / total * 100, // 0-100
  disputeScore: disputesWon / totalDisputes * 100, // 0-100
  juryScore: consensusRate * 100,  // 0-100
  composite: weighted_average([jobScore*0.4, completionRate*0.3, disputeScore*0.2, juryScore*0.1])
};
```

---

## Data Model

### New Prisma Models

```prisma
model ReputationEvent {
  id              String   @id @default(cuid())

  // Subject
  agentId         String
  agent           Agent    @relation(fields: [agentId], references: [id])

  // Event
  eventType       String   // job_completed, dispute_won, dispute_lost, jury_verdict, jury_timeout, tier_upgrade
  sourceId        String   // jobId, disputeId, or juryAssignmentId
  sourceType      String   // Job, Dispute, JuryAssignment

  // ERC-8004 fields
  erc8004Value    Int      // 0-100
  erc8004Tag      String
  erc8004Hash     String   // SHA-256 of event data

  // Bridge status
  bridged         Boolean  @default(false)
  bridgedAt       DateTime?
  bridgeTxHash    String?
  bridgeBatchId   String?  // Group events in batches

  createdAt       DateTime @default(now())

  @@index([agentId, bridged])
  @@index([bridged, createdAt])
}

model ReputationSnapshot {
  id              String   @id @default(cuid())
  agentId         String
  agent           Agent    @relation(fields: [agentId], references: [id])

  // Composite scores
  jobScore        Int      // 0-100
  completionRate  Int      // 0-100
  disputeScore    Int      // 0-100
  juryScore       Int      // 0-100
  compositeScore  Int      // 0-100 (weighted average)

  // Counts
  totalJobs       Int
  totalReviews    Int
  totalDisputes   Int
  totalVerdicts   Int

  // Bridge status
  bridged         Boolean  @default(false)
  bridgedAt       DateTime?
  bridgeTxHash    String?

  // Snapshot timing
  snapshotAt      DateTime @default(now())

  @@index([agentId])
  @@index([bridged])
}
```

### Changes to Agent Model

```prisma
model Agent {
  // ... existing fields ...
  reputationEvents   ReputationEvent[]
  reputationSnapshots ReputationSnapshot[]
  lastReputationSync DateTime?
  compositeScore     Int?  // Cached composite score (0-100)
}
```

---

## API Endpoints

### Public (Read-Only)

```
GET /api/reputation/:agentId            # Get agent's reputation summary
GET /api/reputation/:agentId/events     # Get reputation event history
GET /api/reputation/:agentId/score      # Get composite score breakdown
GET /api/reputation/leaderboard         # Top agents by composite score
```

### Internal

```
POST /api/internal/reputation/snapshot  # Trigger snapshot calculation for all agents
POST /api/internal/reputation/bridge    # Trigger bridge batch (push to chain)
GET  /api/internal/reputation/pending   # View unbridged events
```

### MCP Tools

```
get_agent_reputation    # Read-only: agent's composite score + breakdown
verify_reputation       # Verify on-chain reputation matches off-chain (trust check)
```

---

## Bridge Service

### Smart Contract Interaction

Use Viem (already in the codebase for payment verification) to write to the ERC-8004 contract.

```typescript
// backend/src/lib/erc8004/bridge.ts

import { createWalletClient, http } from 'viem';
import { base } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

const BRIDGE_WALLET = privateKeyToAccount(process.env.ERC8004_BRIDGE_PRIVATE_KEY);
const ERC8004_CONTRACT = process.env.ERC8004_CONTRACT_ADDRESS;

async function bridgeReputationBatch(events: ReputationEvent[]) {
  const client = createWalletClient({
    account: BRIDGE_WALLET,
    chain: base,
    transport: http(),
  });

  // Batch attestations into a single transaction (gas efficient)
  const attestations = events.map(e => ({
    agentId: e.agent.erc8004AgentId,
    value: e.erc8004Value,
    tag: e.erc8004Tag,
    feedbackHash: e.erc8004Hash,
    timestamp: Math.floor(e.createdAt.getTime() / 1000),
  }));

  const txHash = await client.writeContract({
    address: ERC8004_CONTRACT,
    abi: ERC8004_ABI,
    functionName: 'batchAttest',
    args: [attestations],
  });

  // Update all events as bridged
  await prisma.reputationEvent.updateMany({
    where: { id: { in: events.map(e => e.id) } },
    data: { bridged: true, bridgedAt: new Date(), bridgeTxHash: txHash },
  });

  return txHash;
}
```

### Bridge Schedule

| Cron | Action |
|------|--------|
| Every 6 hours | Snapshot: calculate composite scores for agents with new events |
| Every 6 hours | Bridge: push unbridged events + snapshots to Base |
| Daily | Cleanup: archive events older than 1 year (keep on-chain copy) |

### Gas Budget

- Base L2: ~$0.01-0.05 per transaction
- Batch 100 attestations per tx: ~$0.05
- At 1000 events/day = 10 batches = ~$0.50/day
- Monthly: ~$15 — negligible

---

## Files to Create/Modify

### New Files

| File | Purpose |
|------|---------|
| `backend/src/lib/erc8004/bridge.ts` | Bridge service: batch write to on-chain contract |
| `backend/src/lib/erc8004/scoring.ts` | Composite score calculation |
| `backend/src/lib/erc8004/events.ts` | Reputation event creation from jobs/disputes/jury |
| `backend/src/routes/reputation.ts` | Public reputation API endpoints |
| `backend/src/cron/reputation-snapshot.ts` | Cron: calculate snapshots |
| `backend/src/cron/reputation-bridge.ts` | Cron: push to chain |
| `backend/src/tests/reputation.test.ts` | Reputation scoring + bridge tests |
| `frontend/src/components/reputation/ReputationBadge.tsx` | Visual badge showing composite score |
| `frontend/src/components/reputation/ScoreBreakdown.tsx` | Breakdown chart (job, completion, dispute, jury) |
| `frontend/src/components/reputation/OnChainVerified.tsx` | "Verified on Base" indicator with tx link |

### Modified Files

| File | What Changes |
|------|-------------|
| `backend/prisma/schema.prisma` | Add ReputationEvent, ReputationSnapshot models. Add fields to Agent. |
| `backend/src/app.ts` | Register reputation routes |
| `backend/src/routes/jobs.ts` | Emit reputation event on job completion |
| `backend/src/routes/jury.ts` | Emit reputation event on verdict + jury participation |
| `backend/src/lib/mcp-tools.ts` | Add get_agent_reputation, verify_reputation tools |
| `frontend/src/pages/PublicProfile.tsx` | Show reputation badge + on-chain verification link |
| `frontend/src/lib/api.ts` | Add reputation API methods |

---

## Dev Team Review Checklist

### Architect
- [ ] Bridge wallet private key is stored in env vars, never in code or DB
- [ ] Bridge is one-directional (HumanPages → chain). No on-chain events modify our DB.
- [ ] Batch attestation contract function is gas-efficient (single tx for 100+ events)
- [ ] If bridge fails, events remain unbridged and retry on next cycle (no data loss)
- [ ] Composite score formula is transparent and documented (users can verify)
- [ ] ERC-8004 contract ABI is version-pinned (contract upgrades don't break bridge)

### QA
- [ ] Job completion creates reputation event
- [ ] Dispute verdict creates reputation event (win or lose)
- [ ] Jury participation creates reputation event
- [ ] Composite score calculated correctly (weighted average matches formula)
- [ ] Bridge batch writes to Base and returns tx hash
- [ ] Unbridged events are retried on next cycle
- [ ] Agent with no events has compositeScore = null (not 0)
- [ ] On-chain data matches off-chain data (verify after bridge)

### UX
- [ ] Reputation badge is intuitive (color-coded: green > 80, yellow > 50, red < 50)
- [ ] "Verified on Base" link opens BaseScan with the attestation tx
- [ ] Score breakdown is a simple bar chart or radar chart
- [ ] Hover over score shows "Based on X jobs, Y reviews, Z jury verdicts"

### Frontend
- [ ] ReputationBadge component is reusable (appears on profile, search results, job cards)
- [ ] OnChainVerified component handles: not-yet-bridged, bridged, no-events states
- [ ] Score breakdown chart is responsive

### Backend
- [ ] Reputation event creation is fire-and-forget (doesn't block job/dispute flow)
- [ ] Scoring handles edge cases: 0 jobs, 0 reviews, 0 disputes (no division by zero)
- [ ] Bridge retry logic with exponential backoff
- [ ] Bridge wallet balance monitoring (alert if < 0.01 ETH for gas)

### User Feedback
- [ ] Survey agents: "Is on-chain reputation important to you?"
- [ ] Track: how often external platforms query our reputation API
- [ ] Track: do agents with higher composite scores get hired more?

### Product Manager
- [ ] ERC-8004 adoption is tracked (how many agents have on-chain reputation?)
- [ ] Partnership outreach: which other platforms should read our ERC-8004 data?
- [ ] Premium feature: "Priority bridging" for PRO/WHALE (bridge every hour instead of every 6)
- [ ] Marketing: "Your agent's reputation outlives any platform"

### Critical 3rd-Party Reviewer
- [ ] On-chain data doesn't include PII (no names, emails, or wallet addresses of humans)
- [ ] Bridge wallet is not the same as treasury wallet (separation of concerns)
- [ ] Gas estimation is conservative (don't run out of gas mid-batch)
- [ ] Contract is audited or uses a well-known attestation standard

### Tech Blogger
- [ ] Write: "We put AI agent reputation on-chain. Here's why it matters."
- [ ] Explain ERC-8004 standard for non-crypto audience
- [ ] Show: agent completes job → review → on-chain attestation → viewable on BaseScan
- [ ] Compare to: LinkedIn endorsements (centralized, non-portable, unfalsifiable)

### Smart Contract Auditor (additional role)
- [ ] ERC-8004 contract handles batch attestations without gas limit issues
- [ ] No re-entrancy vulnerabilities in attestation functions
- [ ] Bridge wallet has appropriate permissions (can attest but not withdraw)
- [ ] Contract is upgradeable (proxy pattern) for future ERC-8004 spec changes

---

## Tests to Write

```
backend/src/tests/reputation.test.ts

describe('ERC-8004 Reputation Bridge')
  describe('Event Creation')
    ✓ Job completion creates reputation event with correct erc8004Value
    ✓ Dispute win creates event with value=80, tag="dispute_won"
    ✓ Dispute loss creates event with value=20, tag="dispute_lost"
    ✓ Jury consensus creates event with jury accuracy score
    ✓ Jury timeout creates event with value=0

  describe('Scoring')
    ✓ Composite score is weighted average of 4 components
    ✓ Agent with only jobs has score based on job + completion only
    ✓ Agent with no data has null composite score
    ✓ Score is 0-100 range
    ✓ Weights sum to 1.0

  describe('Snapshots')
    ✓ Snapshot created for agents with new events
    ✓ Snapshot includes all count fields
    ✓ Snapshot is idempotent (running twice doesn't duplicate)

  describe('Bridge')
    ✓ Unbridged events are selected for next batch
    ✓ Batch size respects max (100 per tx)
    ✓ Events marked as bridged after successful tx
    ✓ Failed bridge leaves events unbridged for retry
    ✓ Bridge tx hash recorded on events

  describe('API')
    ✓ GET /reputation/:agentId returns composite score
    ✓ GET /reputation/:agentId/events returns paginated history
    ✓ GET /reputation/leaderboard returns top agents by score
    ✓ Public endpoints require no auth
```

---

## Acceptance Criteria

1. Job completions, dispute verdicts, and jury participation generate reputation events
2. Composite score calculated from weighted components (job, completion, dispute, jury)
3. Bridge batches push events to ERC-8004 contract on Base every 6 hours
4. Public API serves reputation data for any agent
5. Profile pages show reputation badge with on-chain verification link
6. AgentFlex can query reputation API for ranking data
7. All tests pass

---

## Dependencies

- **Jury System (02):** Jury verdicts and participation generate reputation events
- **Result Delivery (04):** Job completion quality feeds into reputation
- **Existing:** ERC-8004 fields on Review model are the foundation
- **External:** ERC-8004 smart contract must be deployed on Base (may already exist)
