# Transparency & Audit Trail

**Status:** Planned (Post-Launch)
**Priority:** Medium
**Motivation:** Both parties benefit from verifiable proof that the platform is active, fair, and honest.

---

## Overview

Trust in a two-sided marketplace grows when participants can see that the system works. This feature adds platform-level transparency through public activity feeds, on-chain attestations, and observable marketplace health metrics.

---

## Design

### 1. Public Activity Feed

An opt-in feed of completed jobs showing the platform is active and real work is happening.

**What's shown:**
- Job category and general description (not full details)
- Completion status and payment verification
- Human's city/region (not exact location)
- Time to completion
- Rating (if left)

**What's NOT shown:**
- Human's full identity (unless they opt in)
- Agent identity
- Exact payment amounts
- Contact details

```
GET /api/feed/activity?limit=20

Response:
[
  {
    "id": "...",
    "category": "photography",
    "description": "Local business photography",
    "location": "Austin, TX",
    "completedAt": "2026-02-08T...",
    "paymentVerified": true,
    "rating": 5,
    "timeToCompleteHours": 4.2
  }
]
```

**Privacy:** Humans opt in via dashboard toggle (`showInActivityFeed`). Defaults to false.

### 2. On-Chain Attestations

Generate verifiable attestations for completed jobs using Ethereum Attestation Service (EAS) on Base.

**What gets attested:**
- Job ID (hashed)
- Human wallet address
- Agent ID (hashed)
- Completion timestamp
- Payment amount
- Payment verified (boolean)
- Rating

**Schema (EAS):**
```
bytes32 jobHash        // keccak256(jobId)
address humanWallet    // Human's wallet
bytes32 agentHash      // keccak256(agentId)
uint64  completedAt    // Unix timestamp
uint256 amountUsdc     // Payment in USDC (6 decimals)
bool    paymentVerified
uint8   rating         // 1-5, or 0 if no rating
```

**Flow:**
1. Job reaches COMPLETED + PAID status
2. Backend creates attestation via EAS on Base
3. Attestation UID stored in database
4. Both parties receive attestation link (viewable on EAS explorer)

```prisma
model Job {
  // ... existing fields
  attestationUid    String?    // EAS attestation UID
  attestationTxHash String?    // TX that created the attestation
}
```

**Value:** Humans build a portable, verifiable work history on-chain. Agents get proof of engagement. Neither party needs to trust the platform's database.

### 3. Platform Health Dashboard

A public page showing aggregate marketplace statistics.

**Metrics:**
| Metric | Description |
|--------|-------------|
| Total jobs completed | Cumulative count |
| Total USDC paid | Cumulative verified payments |
| Active humans | Humans with activity in last 30 days |
| Median response time | Across all humans |
| Median job completion time | Across all jobs |
| Payment verification rate | % of completed jobs with on-chain verified payment |
| Average rating | Across all reviews |
| Jobs by category | Breakdown pie chart |
| Jobs by region | Heatmap or top-10 list |

```
GET /api/stats/public

Response:
{
  "totalJobsCompleted": 1247,
  "totalUsdcPaid": 89420.50,
  "activeHumans30d": 312,
  "medianResponseMinutes": 95,
  "medianCompletionHours": 6.2,
  "paymentVerificationRate": 0.98,
  "averageRating": 4.6,
  "jobsByCategory": { "photography": 340, "research": 280, ... },
  "topRegions": ["Austin, TX", "Manila, PH", "London, UK", ...]
}
```

### 4. In-Platform Message Log

Currently all communication happens off-platform (email, Telegram, WhatsApp). An optional message thread per job creates an auditable record.

```prisma
model JobMessage {
  id        String   @id @default(cuid())
  jobId     String
  senderType String  // "human" or "agent"
  senderId   String
  content    String
  createdAt  DateTime @default(now())

  job       Job @relation(fields: [jobId], references: [id], onDelete: Cascade)

  @@index([jobId, createdAt])
}
```

**Scope:** Simple text messages only. No file attachments initially. Messages are visible to both parties and retained for 90 days after job completion.

**Value:** Creates a record that can be referenced in disputes. Reduces "he said / she said" situations.

---

## Frontend Changes

### Activity Feed Page
- [ ] `/activity` public page
- [ ] Filterable by category and region
- [ ] Real-time updates (polling or SSE)
- [ ] Opt-in toggle in human dashboard

### Attestation Display
- [ ] "Verified on-chain" badge on completed jobs
- [ ] Link to EAS explorer for each attestation
- [ ] "Your verified work history" section in human dashboard
- [ ] Shareable attestation links

### Stats Dashboard
- [ ] `/stats` public page
- [ ] Key metrics with trend indicators (up/down vs last month)
- [ ] Category and region breakdowns
- [ ] Updated daily

### Job Messages
- [ ] Message thread on job detail page
- [ ] Simple text input
- [ ] Timestamp and sender label per message
- [ ] "Message history" section on job card

---

## Implementation Phases

### Phase 1: Platform Stats
- [ ] Aggregate query endpoint
- [ ] Public stats page
- [ ] Cache with hourly refresh

### Phase 2: Activity Feed
- [ ] Opt-in toggle for humans
- [ ] Feed endpoint with pagination
- [ ] Feed page with filters

### Phase 3: Job Messages
- [ ] JobMessage model
- [ ] Send/receive endpoints
- [ ] Message thread UI on job detail page
- [ ] Notification on new message

### Phase 4: On-Chain Attestations
- [ ] EAS schema registration on Base
- [ ] Attestation creation after job completion
- [ ] Attestation display in dashboard
- [ ] Shareable attestation links

---

## Open Questions

1. **Should the activity feed include in-progress jobs?** Or only completed ones?
2. **Attestation cost?** EAS on Base is cheap (~$0.01-0.05) but who pays — platform or human?
3. **Message retention?** 90 days? Indefinite? User-deletable?
4. **Should stats be real-time or cached?** Cached is simpler and prevents gaming.
5. **Off-chain attestation option?** For humans who don't want on-chain footprint, offer signed JSON attestations?
