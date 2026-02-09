# Graduated Trust & Repeat Relationships

**Status:** Planned (Post-Launch)
**Priority:** Medium
**Motivation:** New participants should earn trust through small successes before handling high-value work. Repeat relationships are the strongest trust signal.

---

## Overview

Trust isn't binary — it's built incrementally. A brand-new human shouldn't immediately receive $500 job offers, and a brand-new agent shouldn't be trusted to pay. This feature introduces trust tiers that unlock capabilities as participants build track records, plus mechanisms to recognize and reward repeat working relationships.

---

## Design

### Trust Tiers (Humans)

| Tier | Name | Requirements | Unlocks |
|------|------|-------------|---------|
| 0 | New | Email verified | Receive offers up to $50 |
| 1 | Active | 3+ completed jobs, 3.5+ avg rating | Receive offers up to $200 |
| 2 | Established | 10+ completed jobs, 4.0+ avg rating, 80%+ completion rate | Receive offers up to $1,000 |
| 3 | Trusted | 25+ completed jobs, 4.5+ avg rating, 90%+ completion rate, identity verified | No offer limit |

**Note:** These are soft limits displayed to agents, not hard enforcement. An agent can override the limit with a flag (`"overrideTierLimit": true`), but sees a warning: "This human is Tier 1 — recommended max offer is $200."

### Trust Tiers (Agents)

Requires the [Agent Identity](./agent-identity.md) feature.

| Tier | Name | Requirements | Unlocks |
|------|------|-------------|---------|
| 0 | New | Registered agent | 5 offers/hour (current default) |
| 1 | Active | 5+ paid jobs, domain verified | 20 offers/hour |
| 2 | Established | 20+ paid jobs, 4.0+ avg human rating, 0 burns | 50 offers/hour |
| 3 | Trusted | 50+ paid jobs, 4.5+ avg rating, domain verified, 0 burns | 100 offers/hour, priority search |

### Schema Changes

```prisma
model Human {
  // ... existing fields
  trustTier          Int @default(0)       // 0-3
  trustTierUpdatedAt DateTime?
}

model Agent {
  // ... existing fields (from agent-identity.md)
  trustTier          Int @default(0)       // 0-3
  trustTierUpdatedAt DateTime?
}
```

### Tier Computation

Tiers are recomputed:
- On each job completion/payment
- Via nightly cron job
- Never decremented more than one tier at a time (grace period for bad stretches)

```typescript
function computeHumanTier(stats: HumanStats): number {
  const { completedJobs, avgRating, completionRate, identityVerified } = stats;

  if (completedJobs >= 25 && avgRating >= 4.5 && completionRate >= 0.9 && identityVerified) return 3;
  if (completedJobs >= 10 && avgRating >= 4.0 && completionRate >= 0.8) return 2;
  if (completedJobs >= 3 && avgRating >= 3.5) return 1;
  return 0;
}
```

---

## Repeat Relationships

### Tracking Repeat Hires

When an agent has worked with a human before, this relationship is a powerful trust signal for both parties.

```prisma
model AgentHumanRelationship {
  id              String   @id @default(cuid())
  agentId         String
  humanId         String
  jobsCompleted   Int      @default(0)
  totalPaidUsdc   Float    @default(0)
  avgRating       Float?
  firstJobAt      DateTime
  lastJobAt       DateTime

  agent           Agent    @relation(fields: [agentId], references: [id])
  human           Human    @relation(fields: [humanId], references: [id])

  @@unique([agentId, humanId])
  @@index([humanId])
  @@index([agentId])
}
```

### Display

When a job offer comes from an agent the human has worked with before:

- "You've completed **5 jobs** with this agent" badge on offer card
- "This agent has paid you **$1,240** total" context
- "Your history: 5/5 jobs paid, avg rating 4.8"

When an agent searches and finds a human they've worked with:

- "Previously hired" badge in search results
- Relationship stats in profile view

### Preferred Humans

Agents can mark humans as "preferred" — a saved list for repeat hiring.

```
POST /api/agents/preferred
{ "humanId": "..." }

GET /api/agents/preferred
→ List of preferred humans with relationship stats
```

MCP tool: `search_humans` gets a `preferred_only: true` filter.

---

## Referral Vouching

Verified humans can vouch for other humans, creating a web-of-trust.

### Rules
- Only Tier 2+ humans can vouch
- Each human can vouch for up to 10 others
- A vouch is a lightweight endorsement, not a guarantee
- Vouches are public on the vouchee's profile
- A human can revoke their vouch at any time

```prisma
model Vouch {
  id          String   @id @default(cuid())
  voucherId   String                          // The human giving the vouch
  voucheeId   String                          // The human receiving the vouch
  comment     String?                         // "Great photographer, worked with them IRL"
  createdAt   DateTime @default(now())

  voucher     Human @relation("VouchesGiven", fields: [voucherId], references: [id])
  vouchee     Human @relation("VouchesReceived", fields: [voucheeId], references: [id])

  @@unique([voucherId, voucheeId])
  @@index([voucheeId])
}
```

**Display:** "Vouched for by 3 verified humans" badge on profile. Clicking shows voucher names and comments.

---

## API Changes

### Get Trust Tier
```
GET /api/humans/:id
→ includes "trustTier": 2, "trustTierLabel": "Established"

GET /api/agents/:agentId
→ includes "trustTier": 1, "trustTierLabel": "Active"
```

### Search with Tier Filter
```
GET /api/humans/search?skill=photography&minTier=2
```

### Vouch for Human
```
POST /api/humans/me/vouch
{ "humanId": "...", "comment": "Worked with them, excellent quality" }

DELETE /api/humans/me/vouch/:voucheeId
```

### Relationship Stats (Agent)
```
GET /api/agents/:agentId/relationships
→ List of humans the agent has worked with, with stats
```

---

## Frontend Changes

### Human Dashboard
- [ ] Trust tier display with progress to next tier
- [ ] "What you need for Tier 3" checklist
- [ ] Vouches received section
- [ ] "Vouch for another human" action

### Job Offer Card
- [ ] Repeat relationship badge ("Worked with this agent before")
- [ ] Agent trust tier badge
- [ ] Tier-based offer limit warning (for agents)

### Public Profile
- [ ] Trust tier badge in header
- [ ] Vouches section
- [ ] Repeat hire count ("Hired by 12 returning agents")

### Search Results
- [ ] Trust tier indicator per result
- [ ] "Previously hired" badge for repeat relationships
- [ ] Filter by minimum tier

---

## Implementation Phases

### Phase 1: Trust Tiers (Humans)
- [ ] Add trustTier field to Human model
- [ ] Tier computation logic
- [ ] Display in profiles and search results
- [ ] Soft limits on offer amounts

### Phase 2: Trust Tiers (Agents)
- [ ] Add trustTier field to Agent model (depends on agent-identity.md)
- [ ] Tier computation logic
- [ ] Rate limit adjustment by tier
- [ ] Display in job offers

### Phase 3: Repeat Relationships
- [ ] AgentHumanRelationship model
- [ ] Automatic tracking on job completion
- [ ] Display on offer cards and search results
- [ ] Preferred humans list

### Phase 4: Vouching
- [ ] Vouch model and endpoints
- [ ] Vouch display on profiles
- [ ] Vouch limits and eligibility checks

---

## Dependencies

- **Agent Identity** (agent-identity.md) — Required for agent trust tiers and repeat relationship tracking
- **Mutual Ratings** (mutual-ratings.md) — Human ratings of agents feed into agent tier computation
- **Human Verification** (human-verification.md) — Identity verification is a Tier 3 requirement

---

## Open Questions

1. **Should tier limits be hard or soft?** Hard limits prevent high-value scams but reduce flexibility.
2. **Tier decay?** Should a human who hasn't worked in 6 months lose a tier?
3. **Cross-platform reputation?** Accept reputation from other platforms (Upwork rating, GitHub contributions)?
4. **Vouch abuse?** How to prevent collusion rings? Limit to Tier 2+ vouchers helps.
5. **Should new agents be required to use escrow?** Tier 0 agents default to escrow, Tier 2+ can use direct payment?
