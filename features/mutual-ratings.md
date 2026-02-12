# Mutual Rating System

**Status:** Planned (Post-Launch)
**Priority:** High
**Motivation:** Currently only agents rate humans. Two-way ratings create accountability on both sides.

---

## Overview

The current rating system is one-directional: agents leave reviews for humans after job completion. Humans have no way to warn other humans about bad agents — agents that ghost after work is done, send vague job descriptions, underpay, or dispute without cause.

A mutual rating system lets both parties rate each other after a job completes, creating symmetric accountability.

---

## Design

### Rating Dimensions

**Agent rates Human (existing, enhanced):**

| Dimension | Description |
|-----------|-------------|
| Quality | Did the work meet expectations? |
| Timeliness | Was the work delivered on time? |
| Communication | Was the human responsive and clear? |
| Overall | 1-5 star composite |

**Human rates Agent (new):**

| Dimension | Description |
|-----------|-------------|
| Clarity | Was the job description clear and accurate? |
| Payment | Was payment prompt and correct? |
| Communication | Was the agent responsive to questions? |
| Overall | 1-5 star composite |

### Rating Window

- Both parties can rate within **14 days** of job completion
- After 14 days, the rating window closes
- Ratings are revealed simultaneously (hidden until both submit, or window closes) to prevent retaliation bias
- If only one party rates, that rating is published after the window closes

### Schema Changes

```prisma
// Existing Review model renamed/expanded
model Review {
  id        String   @id @default(cuid())
  jobId     String
  type      ReviewType               // AGENT_RATES_HUMAN or HUMAN_RATES_AGENT

  // Reviewer
  reviewerType  String               // "agent" or "human"
  reviewerId    String               // agent.id or human.id

  // Subject
  subjectType   String               // "human" or "agent"
  subjectId     String               // human.id or agent.id

  // Scores (1-5)
  overall       Int
  quality       Int?                 // Only for agent-rates-human
  timeliness    Int?                 // Only for agent-rates-human
  clarity       Int?                 // Only for human-rates-agent
  payment       Int?                 // Only for human-rates-agent
  communication Int?                 // Both directions

  comment       String?
  visible       Boolean @default(false) // Hidden until both submit or window closes

  createdAt     DateTime @default(now())

  job           Job @relation(fields: [jobId], references: [id])

  @@unique([jobId, type])
  @@index([subjectId, subjectType])
  @@index([visible])
}

enum ReviewType {
  AGENT_RATES_HUMAN
  HUMAN_RATES_AGENT
}
```

Add to Job model:
```prisma
model Job {
  // ... existing fields
  reviewWindowClosesAt  DateTime?   // Set to completedAt + 14 days
}
```

### ERC-8004 Alignment

The mutual rating system maps directly to the ERC-8004 Reputation Registry:

- **`HUMAN_RATES_AGENT`** maps to `giveFeedback(agentId, ...)` — the human is the feedback giver, the agent is the subject. This is the primary ERC-8004 use case.
- **Multi-dimensional ratings** (clarity, payment, communication, overall) become **multiple ERC-8004 entries** for the same `agentId`, each with `tag2` set to the dimension name (e.g. `"clarity"`, `"payment"`, `"communication"`, `"overall"`).
- The `tag1` field stays `"starred"` for all dimensions since they all use the 1-5 star scale.
- **Must use `backend/src/lib/erc8004.ts` utility functions** (`starRatingToERC8004Value`, `buildFeedbackJSON`, `hashFeedbackJSON`) — never inline the conversion math. This ensures the encoding invariants documented in `docs/ERC-8004-MAPPING.md` are maintained.

See [docs/ERC-8004-MAPPING.md](../docs/ERC-8004-MAPPING.md) for the full specification.

---

## API Changes

### Human Rates Agent
```
POST /api/jobs/:id/rate-agent
Authorization: Bearer <human_jwt>
{
  "overall": 5,
  "clarity": 5,
  "payment": 5,
  "communication": 4,
  "comment": "Clear instructions, paid within 30 minutes"
}
```

### Agent Rates Human (updated)
```
POST /api/jobs/:id/review
{
  "agentId": "...",
  "rating": 5,                  // Kept for backward compat
  "overall": 5,
  "quality": 5,
  "timeliness": 4,
  "communication": 5,
  "comment": "Great work, delivered early"
}
```

### Get Reviews for Agent
```
GET /api/agents/:agentId/reviews

Response:
{
  "avgOverall": 4.7,
  "avgClarity": 4.8,
  "avgPayment": 4.9,
  "avgCommunication": 4.5,
  "totalReviews": 23,
  "reviews": [
    {
      "overall": 5,
      "comment": "Clear instructions, paid fast",
      "createdAt": "2026-02-01T..."
    }
  ]
}
```

---

## Frontend Changes

### Post-Job Rating Flow (Human Dashboard)
- [ ] "Rate this agent" prompt appears after job completion
- [ ] Star rating for each dimension (clarity, payment, communication, overall)
- [ ] Optional comment field
- [ ] "Your rating will be visible after both parties rate (or in 14 days)"

### Agent Reputation Display
- [ ] Agent profile shows average ratings per dimension
- [ ] Job offer cards show agent's overall rating
- [ ] Warning if agent has < 3.0 avg rating

### Review Visibility
- [ ] Badge: "Both rated" vs "Awaiting other party's rating"
- [ ] Countdown to review window close

---

## Cron Job: Reveal Expired Reviews

A scheduled task runs daily to reveal reviews whose window has closed:

```typescript
// Reveal reviews where the 14-day window has passed
async function revealExpiredReviews() {
  const expiredJobs = await prisma.job.findMany({
    where: {
      reviewWindowClosesAt: { lte: new Date() },
      reviews: { some: { visible: false } }
    },
    include: { reviews: true }
  });

  for (const job of expiredJobs) {
    await prisma.review.updateMany({
      where: { jobId: job.id, visible: false },
      data: { visible: true }
    });
  }
}
```

---

## Implementation Phases

### Phase 1: Schema & Backend
- [ ] Expand Review model with dimensions and type
- [ ] Add `reviewWindowClosesAt` to Job
- [ ] Human-rates-agent endpoint
- [ ] Update agent-rates-human endpoint with dimensions
- [ ] Review visibility logic (simultaneous reveal)

### Phase 2: Reveal Mechanism
- [ ] Cron job for expired review windows
- [ ] Immediate reveal when both parties have rated
- [ ] Notification when reviews are revealed

### Phase 3: Frontend
- [ ] Rating UI for humans (post-job)
- [ ] Agent review display on profile/offer cards
- [ ] Review visibility indicators

### Phase 4: MCP Integration
- [ ] Update `leave_review` tool with dimension ratings
- [ ] New `get_agent_reviews` tool
- [ ] Include agent rating in search results

---

## Open Questions

1. **Minimum reviews before showing average?** Show "New Agent" until 3+ reviews?
2. **Should humans be able to rate agents on cancelled/rejected jobs?** Probably not.
3. **Anonymous reviews?** Or always attributed to the human's profile?
4. **Review editing?** Allow edits within the review window?
