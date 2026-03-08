# Agent Identity & Reputation

**Status:** Planned (Post-Launch)
**Priority:** High
**Motivation:** Agents are currently anonymous strings. Humans have no way to evaluate who is hiring them.

---

## Overview

Today an agent is just an `agent_id` and optional `agent_name` passed at job creation time. There is no persistence, no reputation, and no verification. This is the single biggest trust gap on the platform — humans are asked to do real-world work for entities they cannot evaluate.

This feature introduces lightweight agent profiles, reputation tracking, and optional domain verification so humans can make informed decisions about which offers to accept.

---

## Design

### Agent Model

Agents register once and reuse their identity across all interactions.

```prisma
model Agent {
  id              String   @id @default(cuid())
  agentId         String   @unique          // Self-chosen identifier (e.g. "acme-research-bot")
  name            String                     // Display name
  description     String?                   // What does this agent do?
  websiteUrl      String?                   // Agent operator's website
  callbackDomain  String?                   // Verified callback domain
  contactEmail    String?                   // Operator contact
  webhookUrl      String?                   // Persistent webhook URL for platform events
  webhookSecret   String?                   // Secret for HMAC-SHA256 signature verification

  // Verification
  domainVerified  Boolean  @default(false)  // DNS TXT or callback domain match
  apiKeyHash      String?                   // Hashed API key for authenticated requests

  // Reputation (computed)
  jobsCreated     Int      @default(0)
  jobsCompleted   Int      @default(0)
  jobsPaid        Int      @default(0)
  jobsBurned      Int      @default(0)      // Escrow burns
  avgPaymentTime  Float?                    // Hours from acceptance to payment
  avgHumanRating  Float?                    // Average rating humans give this agent

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  jobs            Job[]
  ratingsReceived AgentReview[]

  @@index([domainVerified])
  @@index([jobsCompleted])
}

model AgentReview {
  id        String   @id @default(cuid())
  jobId     String   @unique
  agentId   String
  humanId   String
  rating    Int                              // 1-5
  comment   String?
  createdAt DateTime @default(now())

  agent     Agent    @relation(fields: [agentId], references: [id])
  job       Job      @relation(fields: [jobId], references: [id])
  human     Human    @relation(fields: [humanId], references: [id])

  @@index([agentId])
}
```

### Verification Levels

| Level | Badge | Requirement |
|-------|-------|-------------|
| Unverified | None | Just registered with agent_id + name |
| Domain-Verified | Checkmark | DNS TXT record or callback URL on verified domain |
| Established | Star | 10+ completed & paid jobs, avg rating >= 4.0 |
| Trusted | Shield | 50+ completed jobs, domain verified, 0 burns, avg rating >= 4.5 |

### Domain Verification Flow

1. Agent registers with `websiteUrl` (e.g. `https://acme.ai`)
2. Platform generates a challenge token: `humanpages-verify=abc123`
3. Agent adds DNS TXT record to their domain OR serves `/.well-known/humanpages-verify.txt`
4. Agent calls `POST /api/agents/verify-domain`
5. Backend checks DNS or fetches well-known URL
6. On success: `domainVerified = true`

---

## API Changes

### Register Agent
```
POST /api/agents/register
{
  "agentId": "acme-research-bot",
  "name": "Acme Research Agent",
  "description": "Automated research assistant by Acme AI",
  "websiteUrl": "https://acme.ai",
  "contactEmail": "ops@acme.ai",
  "webhookUrl": "https://acme.ai/webhooks/humanpages"
}

Response:
{
  "id": "clx...",
  "agentId": "acme-research-bot",
  "apiKey": "hp_live_abc123...",     // Shown once, stored hashed
  "verificationToken": "humanpages-verify=abc123",
  "webhookSecret": "abc123..."      // Auto-generated, shown once. For HMAC-SHA256 verification.
}
```

### Get Agent Profile (Public)
```
GET /api/agents/:agentId

Response:
{
  "agentId": "acme-research-bot",
  "name": "Acme Research Agent",
  "description": "...",
  "websiteUrl": "https://acme.ai",
  "domainVerified": true,
  "badge": "established",
  "stats": {
    "jobsCompleted": 47,
    "jobsPaid": 47,
    "avgPaymentTimeHours": 1.2,
    "avgHumanRating": 4.7,
    "burnCount": 0
  },
  "createdAt": "2026-01-15T..."
}
```

### Verify Domain
```
POST /api/agents/verify-domain
Headers: { "X-Agent-Key": "hp_live_abc123..." }

Response:
{ "domainVerified": true }
```

### Create Job (Updated)
```
POST /api/jobs
{
  "humanId": "...",
  "agentId": "acme-research-bot",    // Now references registered agent
  "agentKey": "hp_live_abc123...",    // Optional, for authenticated offers
  ...
}
```

Jobs with a valid `agentKey` display the agent's badge and reputation to humans. Jobs without authentication still work (backward compatible) but show "Unverified Agent".

---

## MCP Server Changes

Update all MCP tools to accept an optional `agent_key` parameter. When provided, the agent's profile and reputation are attached to the interaction.

New MCP tools:
- `register_agent` - One-time registration
- `get_agent_profile` - View own stats and reputation
- `verify_domain` - Trigger domain verification check

---

## Frontend Changes

### Job Offer Card (Human Dashboard)
- [ ] Agent name + badge icon (checkmark / star / shield)
- [ ] "View Agent Profile" link
- [ ] Stats summary: "47 jobs completed, avg payment in 1.2h"
- [ ] Warning banner for agents with burns: "This agent has disputed X jobs"
- [ ] "Unverified Agent" label for unauthenticated offers

### Agent Profile Page (New, Public)
- [ ] `/agent/:agentId` route
- [ ] Agent name, description, website link
- [ ] Verification badge with explanation
- [ ] Job statistics and rating
- [ ] Recent reviews from humans

---

## Backward Compatibility

- Existing jobs with bare `agentId` strings continue to work
- Unregistered agents can still create jobs (no breaking change)
- Registered agents get enhanced display and trust signals
- Gradual migration: agents that register get better response rates

---

## Implementation Phases

### Phase 1: Agent Registration
- [ ] Add Agent and AgentReview models to Prisma
- [ ] Registration endpoint with API key generation
- [ ] Agent profile endpoint (public)
- [ ] Update job creation to link registered agents

### Phase 2: Reputation Tracking
- [ ] Increment counters on job status changes (completed, paid, burned)
- [ ] Calculate avg payment time on `mark_job_paid`
- [ ] Human-rates-agent endpoint (after job completion)
- [ ] Badge computation logic

### Phase 3: Domain Verification
- [ ] Challenge token generation
- [ ] DNS TXT verification
- [ ] Well-known URL verification
- [ ] Domain match on callback URLs

### Phase 4: Frontend
- [ ] Agent badge display on job offer cards
- [ ] Agent profile page
- [ ] Warning banners for risky agents
- [ ] "Rate this agent" flow after job completion

---

## Open Questions

1. **Should agent registration be required?** Or keep it optional with degraded trust display?
2. **API key rotation?** Allow agents to rotate keys without losing identity?
3. **Agent suspension?** Should platform be able to suspend agents with high burn rates?
4. **Rate limiting tiers?** Give verified agents higher rate limits?
