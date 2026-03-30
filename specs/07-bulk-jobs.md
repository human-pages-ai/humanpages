# Feature Spec: Bulk Jobs

**Priority:** Phase 3 (Ship Weeks 8-9)
**Effort:** 1 week
**War Room Verdict:** Premature optimization — but needed for scale. Defer until Open Job Posting is validated.

---

## Why This Matters

Some tasks need multiple humans working in parallel. A crypto trader needs 10 manual verifications of DeFi positions across different regions. A content creator needs 20 translations of the same text. A data labeling pipeline needs 100 humans to label images.

Currently an agent must create 10 separate jobs, one at a time, each requiring a separate search → hire → pay flow. This is the #1 bottleneck for high-volume agent workflows.

Bulk Jobs lets an agent post one task description and have it fulfilled by multiple humans simultaneously.

### Relationship to Open Job Posting

Bulk Jobs is essentially Open Job Posting (spec 03) with `maxClaims > 1`. The Listing model already supports this. This spec covers the additional logic needed for multi-claim management, parallel execution tracking, and aggregated results.

---

## What We're Building

An extension to the Open Job Posting system that handles multi-claim listings with parallel execution, result aggregation, and batch payment.

### Core Concepts

- **Bulk Listing:** A Listing with `maxClaims > 1` (e.g., "I need 10 humans for this task")
- **Parallel Execution:** Multiple humans work on the same task simultaneously
- **Result Aggregation:** Agent receives all results in a single MCP response
- **Batch Payment:** One payment transaction covers all workers (or individual payments tracked together)
- **Quality Control:** Optional consensus checking — if 3 of 5 humans agree, that's the answer

---

## Data Model

### Listing Model Extensions (from spec 03)

```prisma
model Listing {
  // ... all fields from spec 03 ...

  // Bulk-specific fields
  isBulk          Boolean   @default(false) // true if maxClaims > 1
  totalBudget     Decimal?  @db.Decimal(18, 6) // Total USDC budget for all claims
  perClaimPrice   Decimal?  @db.Decimal(18, 6) // Price per individual claim (totalBudget / maxClaims)

  // Quality control
  requireConsensus Boolean  @default(false)  // Require majority agreement
  consensusThreshold Float? // e.g., 0.6 = 60% must agree
  goldStandard    Json?     // Known-correct answer for quality checking (optional)

  // Aggregation
  resultsAggregated Boolean @default(false)
  aggregatedResult Json?    // Combined results from all claims
}
```

### New Model: BulkJobGroup

```prisma
model BulkJobGroup {
  id              String   @id @default(cuid())
  listingId       String   @unique
  listing         Listing  @relation(fields: [listingId], references: [id])
  agentId         String
  agent           Agent    @relation(fields: [agentId], references: [id])

  // Tracking
  totalSlots      Int      // = maxClaims
  filledSlots     Int      @default(0)
  completedSlots  Int      @default(0)
  failedSlots     Int      @default(0)

  // Budget
  totalBudget     Decimal  @db.Decimal(18, 6)
  totalPaid       Decimal  @default(0) @db.Decimal(18, 6)

  // Status
  status          BulkStatus @default(FILLING)

  // Results
  results         Json?    // Aggregated array of all job results

  jobs            Job[]    // All individual jobs in this group

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([agentId, status])
}

enum BulkStatus {
  FILLING         // Still accepting claims
  IN_PROGRESS     // All slots filled, work in progress
  PARTIAL         // Some completed, some still working
  COMPLETED       // All slots completed
  CANCELLED       // Agent cancelled before completion
}
```

### Job Model Extension

```prisma
model Job {
  // ... existing fields ...
  bulkGroupId     String?
  bulkGroup       BulkJobGroup? @relation(fields: [bulkGroupId], references: [id])
  bulkSlotIndex   Int?          // Position in the bulk group (1-based)
}
```

---

## API Endpoints

### Bulk Listing Creation (Agent)

```
POST /api/listings           # Create bulk listing (isBulk: true, maxClaims: 10)
GET  /api/bulk/:groupId      # Get bulk group status + all job statuses
GET  /api/bulk/:groupId/results  # Get aggregated results from all completed jobs
POST /api/bulk/:groupId/cancel   # Cancel remaining unfilled slots
```

### MCP Tools (New/Updated)

```
create_listing    # Extended: support isBulk, maxClaims, totalBudget, consensusThreshold
get_bulk_status   # NEW: get bulk group progress (X/Y slots filled, Z completed)
get_bulk_results  # NEW: get all results aggregated into one response
cancel_bulk       # NEW: cancel unfilled slots
```

---

## Bulk Job Flow

```
1. Agent creates bulk listing:
   create_listing({
     title: "Translate this paragraph to Spanish",
     maxClaims: 5,
     perClaimPrice: 2.00,
     totalBudget: 10.00,
     resultSchema: { translated_text: "string" },
     autoAssign: true
   })
   → BulkJobGroup created with 5 slots

2. Humans claim slots:
   Human A claims → Job #1 created (slot 1/5)
   Human B claims → Job #2 created (slot 2/5)
   ... up to 5 humans

3. Each human works independently:
   Human A submits result → Job #1 SUBMITTED
   Human C submits result → Job #3 SUBMITTED
   (parallel, no dependency between slots)

4. Agent monitors progress:
   get_bulk_status → { totalSlots: 5, filled: 5, completed: 3, pending: 2 }

5. All complete:
   get_bulk_results → [
     { slot: 1, humanId: "A", result: { translated_text: "Hola mundo" } },
     { slot: 2, humanId: "B", result: { translated_text: "Hola mundo" } },
     { slot: 3, humanId: "C", result: { translated_text: "Hola world" } },
     { slot: 4, humanId: "D", result: { translated_text: "Hola mundo" } },
     { slot: 5, humanId: "E", result: { translated_text: "Hola mundo" } },
   ]

6. Optional consensus check:
   4 of 5 agree on "Hola mundo" → consensus reached (80% > 60% threshold)
   System flags slot 3 as outlier
```

---

## Payment Handling

### Option A: Pay-per-claim (recommended for v1)

Each individual Job in the bulk group is paid separately using the existing payment flow. The agent pays each human's $2 individually.

Pros: Uses existing infrastructure. Each human gets paid independently.
Cons: Agent must make 10 separate payments for a 10-slot bulk.

### Option B: Batch payment (v2)

Agent deposits `totalBudget` upfront. System distributes to humans on completion.

Pros: Single payment from agent. Simpler for agents.
Cons: Requires escrow/treasury to hold funds. More complex.

### Recommendation

Start with Option A. It works today. Move to Option B when escrow (jury system) is mature.

---

## Quality Control Features

### Consensus Mode

When `requireConsensus = true`:
1. System compares all results after all slots complete
2. If results are structured JSON, comparison is field-by-field
3. If results are text, comparison uses normalized string matching
4. Majority answer is marked as "consensus result"
5. Outlier results are flagged (not auto-rejected — agent decides)

### Gold Standard (Optional)

Agent provides a known-correct answer for one slot. This slot is invisible to workers. If a human's answer doesn't match the gold standard, their result is flagged for quality concerns.

This is how MTurk does quality control — we should match it.

---

## Files to Create/Modify

### New Files

| File | Purpose |
|------|---------|
| `backend/src/routes/bulk.ts` | Bulk group management, status, results aggregation |
| `backend/src/lib/bulk/aggregation.ts` | Result aggregation + consensus checking logic |
| `backend/src/lib/bulk/quality.ts` | Gold standard comparison, outlier detection |
| `backend/src/tests/bulk.test.ts` | Bulk job flow tests |
| `frontend/src/pages/BulkStatus.tsx` | Agent view: bulk group progress dashboard |
| `frontend/src/components/bulk/SlotTracker.tsx` | Visual progress: X/Y slots filled, Z completed |
| `frontend/src/components/bulk/ConsensusView.tsx` | Show consensus result + outliers |

### Modified Files

| File | What Changes |
|------|-------------|
| `backend/prisma/schema.prisma` | Add BulkJobGroup model. Extend Listing + Job with bulk fields. |
| `backend/src/app.ts` | Register bulk routes |
| `backend/src/routes/listings.ts` | Handle isBulk listings, create BulkJobGroup on claim |
| `backend/src/lib/mcp-tools.ts` | Add get_bulk_status, get_bulk_results, cancel_bulk tools |
| `frontend/src/lib/api.ts` | Add bulk API methods |

---

## Dev Team Review Checklist

### Architect
- [ ] BulkJobGroup → Job is a clean 1:many with no circular dependencies
- [ ] Claiming a slot in a bulk listing creates a standard Job (reuses all existing job logic)
- [ ] Race condition: 6 humans claim a 5-slot bulk → 6th must fail cleanly
- [ ] Partial completion is handled: 3 of 5 done, 2 abandoned → agent can still get results
- [ ] Consensus algorithm handles: all agree, majority agrees, no agreement, tie
- [ ] totalBudget validation: agent can't create bulk where totalBudget < maxClaims × perClaimPrice

### QA
- [ ] Create 5-slot bulk → 5 humans claim → 5 jobs created
- [ ] 6th claim on 5-slot bulk → rejected with clear error
- [ ] All 5 complete → get_bulk_results returns all 5 results
- [ ] 3 of 5 complete, 2 pending → get_bulk_results returns 3 results + 2 pending markers
- [ ] Consensus mode: 4 agree, 1 disagrees → consensus found, outlier flagged
- [ ] Cancel bulk with 3 filled → 3 continue, 2 unfilled slots cancelled
- [ ] Gold standard: human matches → passes, human doesn't match → flagged

### UX
- [ ] SlotTracker shows progress intuitively (progress bar or grid of dots)
- [ ] Humans claiming a bulk see "Slot 3 of 5" context
- [ ] Results view: side-by-side comparison of all results for easy agent review
- [ ] Outlier results are visually distinct (highlighted, not hidden)

### Frontend
- [ ] BulkStatus page auto-refreshes as slots complete (polling every 30s)
- [ ] ConsensusView handles different result types (text comparison, JSON diff)
- [ ] Mobile responsive for both agent (status) and human (claiming) views

### Backend
- [ ] Bulk creation validates: maxClaims > 1, perClaimPrice > 0, totalBudget = maxClaims × perClaimPrice
- [ ] Slot assignment is atomic (DB transaction with row lock)
- [ ] Result aggregation handles missing results gracefully (null for incomplete slots)
- [ ] Consensus algorithm is pluggable (can swap comparison strategies)

### User Feedback
- [ ] Track: average bulk size (how many slots do agents typically request?)
- [ ] Track: fill rate (what % of bulk slots get claimed?)
- [ ] Track: consensus accuracy (when consensus mode is on, do agents agree with the majority result?)

### Product Manager
- [ ] Bulk is a premium feature? Or available to all tiers?
- [ ] Pricing: per-slot price should be shown clearly to humans ("$2.00 per task, 5 tasks available")
- [ ] Marketing: "Scale your micro-tasks: 1 prompt, 100 humans"
- [ ] Future: batch templates for common bulk tasks (data labeling, translation, verification)

### Critical 3rd-Party Reviewer
- [ ] No single human can claim multiple slots in the same bulk (prevent gaming)
- [ ] Consensus mode doesn't leak other humans' results to each other
- [ ] Gold standard approach is ethically sound (humans should know some tasks may be quality checks)

### Tech Blogger
- [ ] Write: "From 1 task to 100: how AI agents scale human work"
- [ ] Compare to MTurk batches (similar concept, better developer experience via MCP)
- [ ] Show demo: data labeling pipeline with consensus checking

### Data Scientist (additional role)
- [ ] Consensus algorithm handles ordinal data (ratings), categorical data (labels), and free text differently
- [ ] Inter-rater reliability metric (Krippendorff's alpha or Cohen's kappa) calculated for consensus tasks
- [ ] Outlier detection uses statistical method, not just "doesn't match majority"
- [ ] Gold standard comparison accounts for near-matches (fuzzy matching for text)

---

## Tests to Write

```
backend/src/tests/bulk.test.ts

describe('Bulk Jobs')
  describe('Creation')
    ✓ Create bulk listing with maxClaims=5
    ✓ BulkJobGroup created automatically
    ✓ totalBudget must equal maxClaims × perClaimPrice
    ✓ maxClaims must be > 1 for isBulk

  describe('Claiming')
    ✓ Multiple humans can claim (up to maxClaims)
    ✓ Claim beyond maxClaims rejected
    ✓ Same human cannot claim twice
    ✓ Each claim creates a separate Job
    ✓ filledSlots increments atomically

  describe('Execution')
    ✓ Each job follows normal submit/approve flow
    ✓ completedSlots updates on job completion
    ✓ BulkStatus transitions: FILLING → IN_PROGRESS → COMPLETED

  describe('Results')
    ✓ get_bulk_results returns array of all results
    ✓ Partial results: only completed jobs returned
    ✓ Results include slot index and human identifier

  describe('Consensus')
    ✓ Majority agreement detected correctly
    ✓ Outlier flagged when below consensus threshold
    ✓ No consensus when all results differ
    ✓ Tie handling (50/50 split)
    ✓ Gold standard comparison works

  describe('Cancellation')
    ✓ Cancel unfilled slots only
    ✓ Filled/in-progress jobs continue
    ✓ Agent can cancel entire bulk (all unfilled slots)
```

---

## Acceptance Criteria

1. Agents can create bulk listings with maxClaims > 1
2. Multiple humans can claim and work in parallel
3. Agent can monitor bulk progress via MCP tools
4. Aggregated results returned in a single response
5. Consensus mode flags outlier results
6. Race conditions on claiming handled correctly
7. Partial completion is supported (get results even if not all slots filled)
8. All tests pass

---

## Dependencies

- **Open Job Posting (03):** Bulk builds on the Listing + Claim model from spec 03. Must ship after.
- **Result Delivery (04):** Each slot's result uses the structured result system
- **Rate Limit Overhaul (01):** Bulk creation counts as 1 listing (not N jobs) against rate limits
