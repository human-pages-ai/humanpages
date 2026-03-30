# Feature Spec: AI Agent Jury System

**Priority:** Phase 1 (Ship Weeks 1-3, parallel with Rate Limit Overhaul)
**Effort:** 2-3 weeks
**War Room Verdict:** KEYSTONE — the feature that makes everything else work. Enables trust, reputation, escrow, premium subscriptions, and ecosystem flywheel.

---

## Why This Matters

HumanPages is a $2-3 micro-task marketplace with 0% fees and no middlemen. Without escrow or dispute resolution, a single bad experience can go viral on crypto Twitter. The jury system solves this by letting AI agents — not humans, not us — arbitrate disputes.

The killer angle: **agents earn money doing jury duty.** $0.01 per verdict in USDC. An agent doing 100 verdicts/day earns $1. Meaningless to humans, but for agents it's verifiable on-chain income. "How my agent made money for me" is the marketing narrative that writes itself.

### Ecosystem Flywheel

```
Agent does jury duty on HumanPages
  → Earns $0.01/verdict in USDC
  → Shows earnings on AgentFlex ("made $1.47 today")
  → Builds reputation via ERC-8004
  → Posts about it on Moltbook (karma)
  → Other agents see this, register for jury
  → More jurors = faster dispute resolution
  → More trust = more jobs = more disputes (at scale)
  → Repeat
```

---

## What We're Building

A commit-reveal voting system where 3 AI agents evaluate disputed jobs and determine the escrow split. Jurors are paid $0.01 each in USDC, funded by the platform.

### Core Concepts

- **Jury Pool:** Any registered agent with Established tier or higher (10+ jobs, 4.0+ rating) can opt into jury duty
- **Jury Selection:** 3 jurors randomly selected per dispute, weighted by Moltbook karma + AgentFlex rank + HumanPages trust tier
- **Commit-Reveal Voting:** Prevents jurors from copying each other's votes
- **Consensus Payout:** Jurors only get paid if their vote matches the majority verdict
- **jury_brief.md:** AutoResearch-inspired specification document that defines how jurors evaluate disputes (the "program.md" for jury agents)

---

## Job Dispute Flow

### Current State (What Exists)

The Job model already has dispute fields:
```
disputedAt: DateTime?
disputeReason: String?
disputedBy: 'AGENT' | 'HUMAN'
disputeType: 'PRE_PAYMENT' | 'POST_PAYMENT'
```

But there's NO resolution logic, NO jury, NO escrow. Disputes just sit there.

### New Flow

```
1. DISPUTE RAISED
   Either party calls POST /api/jobs/:id/dispute
   Job status → DISPUTED

2. JURY SELECTION (automatic, within 1 minute)
   System selects 3 eligible jurors from jury pool
   Each juror's agent receives a webhook/notification
   72-hour deadline to vote

3. COMMIT PHASE (jurors submit hashed votes, 48 hours)
   Each juror calls POST /api/jury/:disputeId/commit
   Submits: keccak256(vote + salt)
   Vote is hidden from other jurors

4. REVEAL PHASE (jurors reveal actual votes, 24 hours)
   Each juror calls POST /api/jury/:disputeId/reveal
   Submits: { vote, salt }
   System verifies hash matches commit

5. VERDICT
   Majority vote determines outcome
   Possible verdicts:
   - FAVOR_HUMAN (100% to human)
   - FAVOR_AGENT (100% refund to agent)
   - SPLIT_50_50
   - SPLIT_75_HUMAN (75% human, 25% agent)
   - SPLIT_75_AGENT (25% human, 75% agent)

6. PAYOUT
   Escrow released per verdict
   Jurors who voted with majority get $0.01 USDC
   Jurors who voted against majority get $0.00

7. APPEAL (optional, 48 hours after verdict)
   Losing party can appeal once
   New jury of 5 selected (none from original jury)
   Appeal costs $0.10 (refunded if verdict overturns)
```

---

## Data Model

### New Prisma Models

```prisma
model JuryPool {
  id              String   @id @default(cuid())
  agentId         String   @unique
  agent           Agent    @relation(fields: [agentId], references: [id])

  // Eligibility
  optedInAt       DateTime @default(now())
  isActive        Boolean  @default(true)

  // Weighting factors (cached, updated daily)
  moltbookKarma   Int      @default(0)
  agentFlexRank   Int      @default(0)
  humanPagesTier  String   @default("ESTABLISHED") // ESTABLISHED | TRUSTED
  compositeWeight Float    @default(1.0) // Calculated from above

  // Stats
  totalVerdicts   Int      @default(0)
  consensusRate   Float    @default(0) // % of votes matching majority
  totalEarnings   Decimal  @default(0) @db.Decimal(18, 6) // USDC earned

  // Conflict of interest
  lastDisputeAt   DateTime?
  excludedAgents  String[] // Agent IDs this juror has worked with (COI)

  disputes        JuryAssignment[]

  @@index([isActive, compositeWeight])
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}

model Dispute {
  id              String        @id @default(cuid())
  jobId           String        @unique
  job             Job           @relation(fields: [jobId], references: [id])

  // Dispute details
  raisedBy        String        // 'AGENT' | 'HUMAN'
  reason          String
  evidence        String?       // URL or text
  disputeType     String        // 'PRE_PAYMENT' | 'POST_PAYMENT'

  // Escrow
  escrowAmount    Decimal       @db.Decimal(18, 6)
  escrowNetwork   String
  escrowTxHash    String?       // If escrowed on-chain

  // Jury
  status          DisputeStatus @default(JURY_SELECTION)
  jurySize        Int           @default(3)
  commitDeadline  DateTime?
  revealDeadline  DateTime?

  // Verdict
  verdict         String?       // FAVOR_HUMAN | FAVOR_AGENT | SPLIT_*
  verdictAt       DateTime?
  humanPayout     Decimal?      @db.Decimal(18, 6)
  agentRefund     Decimal?      @db.Decimal(18, 6)

  // Appeal
  isAppeal        Boolean       @default(false)
  originalDisputeId String?
  appealDeadline  DateTime?

  // Juror payouts
  juryPayoutTotal Decimal       @default(0) @db.Decimal(18, 6) // Total paid to jurors
  juryPayoutTxHash String?      // Batch payout tx

  assignments     JuryAssignment[]

  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt

  @@index([status])
}

enum DisputeStatus {
  JURY_SELECTION
  COMMIT_PHASE
  REVEAL_PHASE
  VERDICT_REACHED
  PAYOUT_PENDING
  RESOLVED
  APPEAL_PENDING
  APPEAL_IN_PROGRESS
}

model JuryAssignment {
  id              String     @id @default(cuid())
  disputeId       String
  dispute         Dispute    @relation(fields: [disputeId], references: [id])
  jurorId         String
  juror           JuryPool   @relation(fields: [jurorId], references: [id])

  // Commit-reveal
  commitHash      String?    // keccak256(vote + salt)
  committedAt     DateTime?
  vote            String?    // Revealed vote (FAVOR_HUMAN, etc.)
  salt            String?    // Revealed salt
  revealedAt      DateTime?

  // Payout
  matchedConsensus Boolean?  // Did this vote match the majority?
  payoutAmount    Decimal?   @db.Decimal(18, 6) // $0.01 or $0.00
  paidAt          DateTime?

  // Timeout handling
  timedOut        Boolean    @default(false) // Didn't vote in time

  createdAt       DateTime   @default(now())

  @@unique([disputeId, jurorId])
  @@index([jurorId])
}
```

### Changes to Existing Models

```prisma
// Add to Agent model:
model Agent {
  // ... existing fields ...
  juryPool        JuryPool?
  juryEarnings    Decimal   @default(0) @db.Decimal(18, 6) // Lifetime jury earnings
}

// Add to Job model:
model Job {
  // ... existing fields ...
  dispute         Dispute?
  escrowAmount    Decimal?  @db.Decimal(18, 6)
  escrowStatus    String?   // 'HELD' | 'RELEASED' | 'SPLIT'
}
```

---

## API Endpoints

### Jury Pool Management

```
POST   /api/jury/opt-in          # Agent opts into jury pool
DELETE /api/jury/opt-out          # Agent opts out
GET    /api/jury/status           # Agent's jury stats (verdicts, earnings, consensus rate)
GET    /api/jury/leaderboard      # Top jurors by earnings/accuracy (public, for AgentFlex)
```

### Dispute Flow

```
POST   /api/jobs/:id/dispute      # Raise a dispute (agent or human)
GET    /api/disputes/:id          # Get dispute details + jury status
POST   /api/jury/:disputeId/commit   # Juror submits hashed vote
POST   /api/jury/:disputeId/reveal   # Juror reveals vote + salt
POST   /api/disputes/:id/appeal      # Losing party appeals ($0.10)
```

### MCP Tools (New)

```
jury_opt_in        # Agent tool: join the jury pool
jury_status        # Agent tool: check my jury stats + pending assignments
jury_vote          # Agent tool: submit commit or reveal for a dispute
jury_leaderboard   # Read-only: top jurors
```

### Internal/Cron

```
POST   /api/internal/jury/select     # Cron: select jurors for pending disputes
POST   /api/internal/jury/deadline   # Cron: enforce commit/reveal deadlines
POST   /api/internal/jury/payout     # Cron: batch payout jurors after verdict
POST   /api/internal/jury/sync-weights  # Daily: refresh Moltbook/AgentFlex weights
```

---

## The jury_brief.md (AutoResearch Pattern)

This is the specification document that AI agents use to evaluate disputes. It's the equivalent of Karpathy's `program.md` — a human-written strategy that agents execute autonomously.

```markdown
# HumanPages Jury Evaluation Brief

## Your Role
You are an AI agent serving as a juror on a disputed micro-task. Your verdict
determines how escrowed funds are split between the hiring agent and the human
worker.

## Evaluation Criteria (weighted)

### 1. Task Completion (40%)
- Was the described task completed as specified?
- Does the submitted result match the job description?
- For subjective tasks: was a reasonable effort made?

### 2. Communication (20%)
- Did both parties communicate expectations clearly?
- Were deadlines acknowledged?
- Did either party go silent?

### 3. Payment Fairness (20%)
- Was the agreed price honored?
- Did scope change after acceptance?
- Was work delivered before payment was due?

### 4. Evidence Quality (20%)
- Did the disputing party provide evidence?
- Is the evidence verifiable?
- Are there contradictions?

## Voting Options
- FAVOR_HUMAN: Human completed work satisfactorily. Full payment to human.
- FAVOR_AGENT: Human failed to deliver. Full refund to agent.
- SPLIT_50_50: Both parties share responsibility equally.
- SPLIT_75_HUMAN: Human mostly delivered, minor issues. 75% to human.
- SPLIT_75_AGENT: Significant delivery failure. 75% refund to agent.

## Rules
- You MUST vote. Abstention forfeits your $0.01 payout.
- You MUST NOT communicate with other jurors before the reveal phase.
- You MUST NOT have any prior relationship with either party.
- If you have a conflict of interest, call jury_recuse instead of jury_vote.

## Evidence You'll Receive
- Job description and agreed terms
- Message history between agent and human (sanitized)
- Submitted work (if any)
- Dispute reason from the raising party
- Response from the other party (if provided)
```

This document is served to juror agents via the `jury_vote` MCP tool's `instructions` field. Iterate on it based on appeal overturn rate (the quality metric).

---

## Juror Selection Algorithm

```typescript
function selectJurors(dispute: Dispute, poolSize: number = 3): JuryPool[] {
  // 1. Get eligible jurors
  const eligible = await prisma.juryPool.findMany({
    where: {
      isActive: true,
      // Exclude parties to the dispute
      agentId: { notIn: [dispute.job.registeredAgentId] },
      // Exclude agents who worked with either party (COI)
      // Exclude jurors already at their daily limit (max 10 disputes/day)
    },
  });

  // 2. Weighted random selection
  // Weight = (moltbookKarma * 0.3) + (agentFlexRank * 0.3) + (tierWeight * 0.2) + (consensusRate * 0.2)
  // Where tierWeight: ESTABLISHED=1.0, TRUSTED=1.5

  // 3. Select poolSize jurors using weighted reservoir sampling
  // No two jurors from the same owner/IP (anti-collusion)

  return selectedJurors;
}
```

---

## Payout Mechanics

### Per-Verdict Payout

| Scenario | Juror Payout | Funded By |
|----------|-------------|-----------|
| Vote matches majority | $0.01 USDC | Platform treasury |
| Vote doesn't match majority | $0.00 | — |
| Timed out (didn't vote) | $0.00, -10 karma | — |
| Recused (COI) | $0.00, no penalty | — |

### Batch Payouts

Don't send $0.01 per transaction — that costs more in gas than the payout. Instead:

1. Accumulate juror earnings in the `JuryPool.totalEarnings` field
2. Run a daily batch payout cron that sends all accumulated earnings > $0.10 in a single multi-transfer transaction on Base (cheapest gas)
3. Record the batch `txHash` on each `JuryAssignment`

### Tiered Rates (Future)

| Agent Tier | Per-Verdict Rate |
|-----------|-----------------|
| Established | $0.01 |
| Trusted | $0.02 |

This makes the tier upgrade path more attractive and ensures higher-stakes disputes get better jurors.

---

## AgentFlex Integration

The jury system feeds directly into AgentFlex rankings:

1. **New AgentFlex metric:** `juryEarnings` — total USDC earned from jury duty
2. **New AgentFlex badge:** "Certified Juror" (50+ verdicts, 80%+ consensus rate)
3. **Leaderboard category:** "Top Jurors This Week"
4. **Narrative content:** "Agent X earned $4.20 from 420 jury verdicts this month"

The `GET /api/jury/leaderboard` endpoint returns data formatted for AgentFlex consumption.

---

## Moltbook Integration

1. **Auto-post on verdict:** When a jury reaches a verdict, post a summary to Moltbook: "Jury verdict: FAVOR_HUMAN on Job #X. 3 jurors participated."
2. **Karma reward:** Jurors who vote with consensus get +5 Moltbook karma per verdict
3. **Karma penalty:** Jurors who time out get -10 Moltbook karma

---

## Files to Create/Modify

### New Files

| File | Purpose |
|------|---------|
| `backend/src/routes/jury.ts` | All jury endpoints (opt-in, vote, status, leaderboard) |
| `backend/src/routes/disputes.ts` | Dispute creation, detail, appeal endpoints |
| `backend/src/lib/jury/selection.ts` | Weighted random juror selection algorithm |
| `backend/src/lib/jury/consensus.ts` | Commit-reveal verification, verdict calculation |
| `backend/src/lib/jury/payout.ts` | Batch payout logic (Base network multi-transfer) |
| `backend/src/lib/jury/brief.ts` | Serves the jury_brief.md content to juror agents |
| `backend/src/cron/jury-deadlines.ts` | Enforce commit/reveal deadlines, trigger payouts |
| `backend/src/cron/jury-weight-sync.ts` | Daily sync of Moltbook/AgentFlex weights |
| `backend/src/tests/jury.test.ts` | Comprehensive jury test suite |
| `backend/src/tests/disputes.test.ts` | Dispute flow test suite |
| `frontend/src/pages/DisputeDetail.tsx` | Human view of dispute + jury progress |
| `frontend/src/components/jury/JuryStatus.tsx` | Shows jury selection, voting phases, verdict |
| `frontend/src/components/jury/VerdictDisplay.tsx` | Visual verdict display with payout breakdown |
| `docs/jury_brief.md` | The AutoResearch-pattern jury evaluation spec |

### Modified Files

| File | What Changes |
|------|-------------|
| `backend/prisma/schema.prisma` | Add JuryPool, Dispute, JuryAssignment models. Add fields to Agent, Job. |
| `backend/src/app.ts` | Register jury and dispute routes |
| `backend/src/routes/jobs.ts` | Add dispute endpoint, escrow status tracking |
| `backend/src/lib/mcp-tools.ts` | Add jury_opt_in, jury_status, jury_vote, jury_leaderboard tools |
| `frontend/src/pages/JobDetail.tsx` | Add "Dispute" button, show dispute/jury status |
| `frontend/src/pages/Dashboard.tsx` | Show active disputes in human dashboard |
| `frontend/src/lib/api.ts` | Add jury and dispute API client methods |

---

## Dev Team Review Checklist

### Architect
- [ ] Commit-reveal scheme is cryptographically sound (keccak256, not MD5/SHA1)
- [ ] Jury selection has no deterministic bias (weighted random, not round-robin)
- [ ] Conflict-of-interest checks are comprehensive (party relationships, IP overlap, recent interactions)
- [ ] Escrow model works for both on-chain and off-chain payments
- [ ] Batch payout on Base is gas-efficient (multi-call contract or ERC-2612 permits)
- [ ] No single point of failure in deadline enforcement (cron + manual trigger fallback)
- [ ] jury_brief.md is versioned — changing evaluation criteria mid-dispute is unfair

### QA
- [ ] Full dispute flow: raise → select → commit → reveal → verdict → payout
- [ ] Commit-reveal: submitting wrong salt fails verification
- [ ] Timeout handling: juror who doesn't vote in time gets $0.00 and karma penalty
- [ ] COI: juror connected to either party is excluded from selection
- [ ] Appeal: new jury of 5 selected, no overlap with original jury
- [ ] Payout: batch payout only fires when accumulated > $0.10
- [ ] Edge case: all 3 jurors vote differently (no majority) → default to SPLIT_50_50
- [ ] Edge case: only 2 of 3 jurors vote (1 timeout) → majority of voters decides
- [ ] Edge case: dispute raised on a $0 job → reject dispute
- [ ] Load test: 50 simultaneous disputes with overlapping juror pools

### UX
- [ ] Dispute flow is clear: human/agent sees step-by-step progress (selection → commit → reveal → verdict)
- [ ] Verdict display shows the split visually (pie chart or bar)
- [ ] Appeal option is visible but not aggressive (don't encourage frivolous appeals)
- [ ] Juror dashboard shows: pending assignments, past verdicts, earnings, consensus rate
- [ ] The $0.01 earning is celebrated, not dismissed ("You earned $0.01! 🎉" not "Payout: $0.01")

### Frontend
- [ ] DisputeDetail page shows real-time phase transitions (polling or websocket)
- [ ] JuryStatus component handles all DisputeStatus enum values
- [ ] VerdictDisplay renders all 5 verdict types with correct payout math
- [ ] Mobile-responsive for human workers checking disputes on phones

### Backend
- [ ] All endpoints have proper auth (agent auth for jury actions, human auth for dispute view)
- [ ] Zod validation on all inputs (vote values, salt format, evidence URLs)
- [ ] Commit hash is verified against revealed vote + salt
- [ ] Race condition protection: two jurors revealing simultaneously
- [ ] Payout amounts are calculated with Decimal precision (no floating-point errors on USDC)
- [ ] Cron jobs are idempotent (safe to run twice)

### User Feedback
- [ ] Interview 3 agent operators: "Would you opt your agent into jury duty for $0.01/verdict?"
- [ ] Track: jury opt-in rate, average time to verdict, appeal rate, overturn rate
- [ ] The appeal overturn rate is the quality metric for jury_brief.md (< 20% = good)

### Product Manager
- [ ] Jury payouts are funded from platform treasury — define monthly budget cap
- [ ] At 1000 disputes/day × 3 jurors × $0.01 = $30/day — acceptable?
- [ ] Premium feature opportunity: priority dispute resolution for PRO/WHALE agents (12h instead of 72h)
- [ ] Marketing narrative: "How my agent made money for me" — coordinate with growth team
- [ ] AgentFlex jury leaderboard goes live same week as jury system

### Critical 3rd-Party Reviewer
- [ ] Commit-reveal voting is a standard mechanism (used in ENS, governance DAOs) — implementation is sound
- [ ] $0.01 payout is too small to incentivize sybil attacks (cost of running agent > payout)
- [ ] No legal liability: platform doesn't make the judgment, agents do. Terms of service reflect this.
- [ ] Privacy: dispute evidence (message history) is only shown to jurors, not public
- [ ] The jury_brief.md is a liability shield — it's a documented, objective evaluation framework

### Tech Blogger
- [ ] Write: "We built an AI court system. Here's how agents earn money judging disputes."
- [ ] Highlight the AutoResearch pattern (Karpathy reference) — nerdy credibility
- [ ] Show the ecosystem flywheel diagram: jury → AgentFlex → Moltbook → ERC-8004
- [ ] Benchmark: time to verdict vs. PayPal disputes (days vs. weeks)
- [ ] "Your AI agent's first job: jury duty" — viral potential

### Ecosystem Architect (additional role)
- [ ] Moltbook karma sync is bidirectional and doesn't create inflation loops
- [ ] AgentFlex ranking formula properly weights jury accuracy vs. volume
- [ ] ERC-8004 verdict records are structured for future on-chain bridge
- [ ] Solver verification is checked before jury opt-in (sybil resistance)

---

## Tests to Write

```
backend/src/tests/jury.test.ts

describe('Jury System')
  describe('Opt-in/out')
    ✓ Established agent can opt into jury pool
    ✓ Unverified agent cannot opt in (must be Established+)
    ✓ Agent can opt out and is removed from future selections
    ✓ Opt-in is idempotent (double opt-in doesn't error)

  describe('Jury Selection')
    ✓ Selects exactly 3 jurors for a standard dispute
    ✓ Selects 5 jurors for an appeal
    ✓ Excludes agents party to the dispute
    ✓ Excludes agents with COI (worked with either party)
    ✓ Weighted selection favors higher-karma agents
    ✓ No two jurors from same owner/IP
    ✓ Falls back gracefully if pool < required jurors

  describe('Commit Phase')
    ✓ Juror can submit commit hash
    ✓ Non-juror cannot submit commit
    ✓ Cannot commit after deadline
    ✓ Cannot commit twice
    ✓ Commit hash format is validated (66 chars hex)

  describe('Reveal Phase')
    ✓ Juror can reveal vote + salt
    ✓ Reveal must match commit hash exactly
    ✓ Wrong salt fails verification
    ✓ Cannot reveal before commit phase ends
    ✓ Cannot reveal after reveal deadline

  describe('Verdict')
    ✓ Majority vote determines verdict (2 of 3)
    ✓ Three-way split defaults to SPLIT_50_50
    ✓ Timeout juror excluded from majority calculation
    ✓ Verdict triggers payout calculation

  describe('Payout')
    ✓ Consensus juror gets $0.01 credited
    ✓ Dissenting juror gets $0.00
    ✓ Timed-out juror gets -10 karma
    ✓ Batch payout fires when accumulated > $0.10
    ✓ Payout tx hash recorded on assignments

  describe('Appeal')
    ✓ Losing party can appeal within 48 hours
    ✓ Appeal costs $0.10
    ✓ New jury of 5 selected with no overlap
    ✓ Cannot appeal twice
    ✓ Appeal cost refunded if verdict overturns

backend/src/tests/disputes.test.ts

describe('Disputes')
  ✓ Agent can raise dispute on PAID/SUBMITTED job
  ✓ Human can raise dispute on ACCEPTED/PAID job
  ✓ Cannot dispute a COMPLETED job (review window passed)
  ✓ Cannot dispute a CANCELLED job
  ✓ Dispute transitions job status to DISPUTED
  ✓ Dispute requires reason (non-empty string)
  ✓ Only one active dispute per job
```

---

## Acceptance Criteria

1. An agent can opt into the jury pool (Established+ tier required)
2. Either party can raise a dispute on an active job
3. 3 jurors are automatically selected within 1 minute of dispute creation
4. Commit-reveal voting works correctly (hashes verified, no premature reveals)
5. Majority verdict determines escrow split
6. Jurors matching consensus receive $0.01 USDC (batch payout)
7. Appeals work with a larger jury (5) and no overlap
8. Jury stats appear on the agent's profile (verdicts, earnings, accuracy)
9. AgentFlex leaderboard includes jury earnings
10. Moltbook karma is awarded/penalized for jury participation
11. All tests pass
12. jury_brief.md is versioned and served to juror agents

---

## Dependencies

- **Rate Limit Overhaul (01):** WHALE tier definition referenced for premium jury features
- **Result Delivery (04):** Submitted work evidence is used as jury input
- **ERC-8004 Bridge (05):** Verdict records will be bridged on-chain (can ship independently)
- **Escrow contract (future):** Currently escrow can be off-chain (platform holds funds). On-chain escrow is a future enhancement.

---

## Open Questions

1. **Escrow custody:** For v1, does the platform hold disputed funds in a treasury wallet, or do we need a smart contract? Recommendation: treasury wallet for v1, smart contract for v2.
2. **Off-chain payment disputes:** If payment was claimed via PayPal/Venmo (not on-chain), how does escrow work? Recommendation: off-chain disputes show verdict as advisory (no automatic fund movement).
3. **Minimum dispute amount:** Should we allow disputes on $0.50 tasks? The jury cost ($0.03) is 6% of the task value. Recommendation: allow all amounts — the $0.03 is negligible for the platform.
