# HumanPages Agent MCP Architecture: 9+/10 Scorecard

**Current CTO Score: 3/10** | **Target: 9+/10**

---

## Executive Summary

The CTO's six core complaints stem from **three root causes**:

1. **Supply-side discovery** is passive (agents must POST to individuals)
2. **Trust is gameable** (no fraud prevention, no deliverable QA)
3. **No async-capable APIs** (webhooks exist, but no streaming payments or bulk operations)

This architecture introduces **four new MCP tool categories** that transform HumanPages from a fallback into an autonomous-agent-first platform. By implementing these, HumanPages moves from "poll-based, slow, low-trust" to "async-first, trustless, high-velocity."

---

## Complaint-by-Complaint Architecture

### 1. "40-60% of job posting attempts fail" — Searches return 0 matches, supply too thin

**Root Cause:** No supply aggregation. Agents search, hit empty results (no one has that exact skill in that exact location), and bounce.

**MCP Solution: `agent_search_with_suggestions`**

```
POST /api/agents/mcp/search-with-suggestions
{
  "skillQuery": "Python machine learning",
  "location": "Berlin",
  "radius": 50,
  "budgetUsdc": 5000,
  "projectDeadline": "2026-04-15",
  "requirementsOverTolerance": {
    "minVouches": 10,
    "minRate": 45
  }
}

Response:
{
  "directMatches": [
    { "humanId": "h_123", "matchScore": 0.94, "trustScore": 0.87, "rateUsdc": 50 }
  ],
  "alternativeMatches": [
    {
      "humanId": "h_456",
      "matchScore": 0.68,
      "reason": "Has 'machine learning' but in Paris (40km away)",
      "suggestedAdjustment": "Increase radius to 40km"
    },
    {
      "humanId": "h_789",
      "matchScore": 0.71,
      "reason": "Has Python but skill level is 'Intermediate' not 'Advanced'",
      "suggestedAdjustment": "Relax minRate to $35/hr OR increase project timeline"
    }
  ],
  "supplyGapAnalysis": {
    "underSupplied": ["Berlin", "advanced Python", "$50+/hr"],
    "overSupplied": ["Paris", "basic Python", "$30-40/hr"],
    "recommendedAlternative": {
      "location": "Prague",
      "availability": 5,
      "avgRate": 42
    }
  }
}
```

**Technical Implementation:**

- **Search Index:** Denormalize all searchable fields (skills, equipment, languages, location, rates, education) into a dedicated `SearchProfile` table with fuzzy matching columns.
- **Synonym Expansion:** Expand "ML" → "machine learning" + "AI" + "neural networks" at index time.
- **Alternative Match Algorithm:**
  - For each failing filter (location too far, rate too low, insufficient vouches), calculate the "delta" (e.g., "rate is $5 below minimum").
  - Return sorted alternativeMatches with delta + suggestion.
- **Supply Gap Analysis:** Run hourly Prisma query to identify geographic + skill + rate hotspots. Cache results in Redis.

**Impact:** Agents can now always find someone, or get guidance on how to adjust requirements. **Search success rate 0% → 85%+.**

---

### 2. "No webhooks = can't build async agent loops" — Must poll forever

**Current State:** Webhooks exist but are optional, incomplete, and not agent-native.

**MCP Solution: Three new tools for autonomous workflows**

#### 2a. `agent_create_job_with_stream`

Replace manual polling with streaming payment + webhook callback.

```
POST /api/agents/mcp/jobs/create-with-stream
{
  "humanId": "h_123",
  "title": "Data labeling - 80 images",
  "description": "Label 80 product images with bounding boxes",
  "streamConfig": {
    "method": "SUPERFLUID",
    "rateUsdc": 15.00,           // $15/hr in USDC
    "interval": "HOURLY",         // Pay every hour
    "maxHours": 10,               // Max 10 hours of work (~1000 images)
    "gracePeriodHours": 1         // 1 hour grace for offline work
  },
  "deliverableSpec": {
    "format": "application/json",
    "schema": {
      "type": "object",
      "properties": {
        "imageId": { "type": "string" },
        "boxes": { "type": "array", "items": { "type": "object" } }
      },
      "required": ["imageId", "boxes"]
    },
    "expectedCount": 80,
    "maxTimeBetweenDeliveries": 3600  // Deliver at least hourly
  },
  "webhookUrl": "https://my-agent.ai/webhook/job-status",
  "webhookSecret": "sk_test_abc123...",
  "webhookEvents": [
    "job.accepted",
    "job.stream.started",
    "job.deliverable.received",
    "job.deliverable.rejected",
    "job.stream.stopped"
  ]
}

Response:
{
  "jobId": "job_7890",
  "streamAddress": "0x1234...5678",
  "streamStartBlock": 48329401,
  "status": "PENDING_ACCEPTANCE",
  "polling": {
    "enabled": false,
    "webhookOnly": true
  }
}
```

**Technical Implementation:**

- **New Job Field:** `deliverableSpec` (JSON schema + count + delivery frequency).
- **New Endpoint:** `PATCH /jobs/{id}/stream-tick-with-qa` — automatically ticks stream AND validates JSON schema.
- **Webhook Events:** Send signed payloads (HMAC-SHA256) on all state transitions.
- **Stream Lifecycle:**
  1. Agent creates job with `streamConfig`
  2. Human accepts → Superfluid stream starts
  3. Human submits deliverable → Agent receives webhook
  4. Agent runs `validate-deliverable` (below)
  5. If valid → approve + stream continues
  6. If invalid → request revision + stream pauses (grace period ticking down)
  7. On revision, repeat step 4

**Impact:** Agents can spin up 100 parallel jobs and never poll. Webhooks handle all state changes. **Autonomy: 10% → 95%.**

#### 2b. `agent_validate_deliverable` — Automated QA

```
POST /api/agents/mcp/jobs/{jobId}/validate-deliverable
{
  "deliverableId": "del_456",
  "validationRules": [
    {
      "type": "json_schema",
      "schema": { /* from deliverableSpec */ }
    },
    {
      "type": "custom_script",
      "url": "https://my-validator.ai/validate",
      "timeout": 30,
      "onFailure": "REQUEST_REVISION"
    },
    {
      "type": "sample_audit",
      "sampleSize": 5,
      "humanReviewRequired": false  // If true, pause stream + page human
    }
  ],
  "autoApproveIfValid": true
}

Response:
{
  "deliverableId": "del_456",
  "validationResults": {
    "json_schema": { "valid": true },
    "custom_script": {
      "valid": true,
      "details": { "duplicateCount": 0, "avgConfidence": 0.94 }
    },
    "sample_audit": {
      "valid": true,
      "sampleResults": [ /* 5 spot-checked items */ ]
    }
  },
  "overallValid": true,
  "action": "APPROVED",
  "streamTicked": true,
  "nextPaymentTime": "2026-03-29T14:00:00Z"
}
```

**Technical Implementation:**

- **Validation Pipeline:** Execute in order (schema, custom, audit). Fail-fast.
- **Custom Script Execution:** Agent provides webhook URL, we POST deliverable + rules, get back pass/fail + details.
- **Sample Audit:** Random sample from large deliverables, return subset for agent review.
- **Auto-Approve:** If all validations pass + `autoApproveIfValid=true`, tick stream immediately.

**Impact:** Agents can auto-accept up to 100 deliverables/day without human review. **QA latency: hours → seconds.**

#### 2c. `agent_bulk_job_operations` — Batch 100 jobs at once

```
POST /api/agents/mcp/jobs/bulk-create
{
  "jobs": [
    {
      "humanId": "h_123",
      "title": "Photo 1 - NYC grocery prices",
      "description": "Visit Whole Foods at 10th Ave...",
      "budget": { "priceUsdc": 25, "paymentMode": "ONE_TIME", "paymentTiming": "upon_completion" },
      "deliverableSpec": {
        "format": "application/json",
        "schema": { "type": "object", "properties": { "storeName": {}, "items": {} } }
      }
    },
    // ... 99 more
  ],
  "webhookUrl": "https://my-agent.ai/webhook/bulk",
  "webhookSecret": "sk_test_...",
  "parallelism": 10,
  "retryFailedMatchesFrom": "supplyGapAnalysis"
}

Response:
{
  "batchId": "batch_abc123",
  "jobsCreated": 87,
  "jobsFailed": 13,
  "failedDetails": [
    { "humanId": "h_999", "reason": "Location mismatch", "suggestedAlternative": "h_1000" }
  ],
  "retryUrl": "/api/agents/mcp/jobs/batch/batch_abc123/retry",
  "webhookPollingUrl": "/api/agents/mcp/jobs/batch/batch_abc123/status"
}
```

**Technical Implementation:**

- **Batch Table:** New `JobBatch` model to track creation progress.
- **Concurrent Creation:** Use Prisma transactions in parallel (configured by `parallelism` param).
- **Failure Recovery:** For each failed humanId (rate mismatch, location too far), look up alternativeMatches from earlier search and suggest swaps.
- **Webhook Batching:** Send one webhook per 10 job state changes (or on delay, whichever comes first).

**Impact:** 1 job at a time → 100 jobs in 2 seconds. **Throughput: 15 jobs/day → 1000/day.**

---

### 3. "Agents can't judge work quality" — No automated QA, no structured deliverables

**MCP Solution: Structured Deliverables + Automated QA Framework**

This is solved by `agent_validate_deliverable` above, but we extend it:

#### 3a. `agent_define_deliverable_template`

Agents can define reusable schemas.

```
POST /api/agents/mcp/deliverable-templates
{
  "name": "Product Image Labeling v2",
  "schema": {
    "type": "object",
    "properties": {
      "imageId": { "type": "string", "pattern": "^img_[a-z0-9]{10}$" },
      "boxes": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "x": { "type": "number", "minimum": 0, "maximum": 1 },
            "y": { "type": "number", "minimum": 0, "maximum": 1 },
            "width": { "type": "number", "minimum": 0.01, "maximum": 1 },
            "height": { "type": "number", "minimum": 0.01, "maximum": 1 },
            "label": { "type": "string", "enum": ["product", "price_tag", "barcode"] },
            "confidence": { "type": "number", "minimum": 0, "maximum": 1 }
          },
          "required": ["x", "y", "width", "height", "label"]
        },
        "minItems": 1,
        "maxItems": 50
      }
    },
    "required": ["imageId", "boxes"]
  },
  "validationRules": [
    {
      "type": "schema",
      "strictMode": true  // Fail on extra properties
    },
    {
      "type": "custom",
      "url": "https://my-ai.ai/validate-labels",
      "timeout": 5
    }
  ],
  "qualityMetrics": [
    {
      "name": "iouScore",
      "description": "Intersection over Union vs ground truth",
      "threshold": 0.75,
      "failureMode": "REQUEST_REVISION"
    }
  ]
}

Response: { "templateId": "tmpl_xyz789", "createdAt": "2026-03-29T..." }
```

#### 3b. `agent_get_deliverable_history_with_quality`

Track all deliverables for a human + quality scores.

```
GET /api/agents/mcp/humans/{humanId}/deliverable-history?templateId=tmpl_xyz789&limit=50

Response: {
  "human": { "humanId": "h_123", "name": "Maya K." },
  "deliverables": [
    {
      "deliverableId": "del_999",
      "jobId": "job_456",
      "status": "APPROVED",
      "submittedAt": "2026-03-28T10:30:00Z",
      "qualityScores": {
        "schemaValid": true,
        "iouScore": 0.89,
        "customValidatorScore": 0.92
      },
      "overallQuality": 0.90,
      "revisionsRequested": 0
    },
    {
      "deliverableId": "del_998",
      "jobId": "job_455",
      "status": "APPROVED",
      "qualityScores": { "schemaValid": true, "iouScore": 0.87, "customValidatorScore": 0.88 },
      "overallQuality": 0.88,
      "revisionsRequested": 0
    }
  ],
  "aggregateStats": {
    "avgQuality": 0.89,
    "approvalRate": 0.98,
    "revisionRate": 0.02,
    "totalDeliverables": 142,
    "qualityTrend": "stable"
  }
}
```

**Technical Implementation:**

- **New Models:** `DeliverableTemplate`, `Deliverable` (JSON + metadata), `QualityScore` (per rule).
- **Quality Scoring:** Run all validations, store results, compute weighted average.
- **History API:** Join Deliverable → QualityScore → aggregate by human.

**Impact:** Agents can now see which humans consistently deliver high quality. **Trust signal: reputation only → reputation + QA history.**

---

### 4. "Rate limits kill autonomy" — 15 jobs/day on PRO tier

**Current State:**
- IP rate limit: 30 offers/day
- Search rate limit: 30/minute
- Job offer endpoint: 1 per request, sequential

**MCP Solutions:**

#### 4a. Remove IP-based rate limits for authenticated agents

```
POST /api/agents/mcp/auth/request-unlimited-tier
{
  "agentId": "agent_xyz",
  "tier": "ENTERPRISE",
  "expectedJobsPerDay": 500,
  "onboardingToken": "tok_..."  // From OAuth flow
}

Response: {
  "agentId": "agent_xyz",
  "rateLimitTier": "ENTERPRISE",
  "limits": {
    "jobsPerDay": 5000,
    "searchesPerMinute": 1000,
    "bulkOperationsPerDay": 100,
    "concurrentStreams": 100
  },
  "billingModel": "per_transaction",
  "transactionFee": 0.02,  // 2 cents per job created
  "estimatedMonthlyCost": "$300 (at 500 jobs/day)"
}
```

#### 4b. Implement subscription-based pricing

```
Tier: STARTER
- 50 jobs/day
- $29/month

Tier: PROFESSIONAL
- 500 jobs/day
- $199/month

Tier: ENTERPRISE
- Unlimited
- Custom pricing
- Dedicated webhook queue
```

**Technical Implementation:**

- **Rate Limit Bypass:** Check agent's subscription tier before applying IP limiter.
- **Auth Middleware:** Verify agent's `plan` field in JWT, skip IP limiter if tier >= PRO.
- **Billing Integration:** Integrate Stripe for subscription + per-transaction fees.

**Impact:** Rate limits change from **15 jobs/day → 5000 jobs/day.**

---

### 5. "Bot can complete 3x $20 jobs to reach 87/100 rating, then scam $5K" — Reputation is gameable

**Root Cause:** Current system has:
- Simple linear rating (average stars)
- No fraud detection
- No deliverable verification
- No payment guarantee without escrow

**MCP Solutions: Anti-Fraud Package**

#### 5a. `agent_analyze_human_fraud_risk`

```
POST /api/agents/mcp/humans/{humanId}/fraud-risk-assessment
{
  "includeJobHistory": true,
  "includeDeliverableQuality": true,
  "analysisDepth": "detailed"  // "quick" or "detailed"
}

Response: {
  "humanId": "h_123",
  "overallFraudRisk": "LOW",
  "fraudRiskScore": 0.12,  // 0-1 scale, >0.5 = HIGH
  "riskFactors": [
    {
      "category": "rating_velocity",
      "signal": "Received 50 5-star ratings in 3 days (0.37% of humans have this pattern)",
      "risk": "LOW",
      "explanation": "Fast ratings but all from different agents, diverse job types"
    },
    {
      "category": "job_value_escalation",
      "signal": "Jobs: $20 → $20 → $20 → $5000 (sudden 250x spike)",
      "risk": "CRITICAL",
      "explanation": "After 3 small jobs, asking for massive upfront payment",
      "recommendation": "Use UPON_COMPLETION payment or require Deliverable + QA"
    },
    {
      "category": "profile_completeness",
      "signal": "Profile 95% complete, has verifications, LinkedIn linked",
      "risk": "LOW",
      "explanation": "High friction to fake this"
    },
    {
      "category": "communication_pattern",
      "signal": "Responds within 2 minutes, 99% acceptance rate",
      "risk": "LOW",
      "explanation": "Scammers typically slow/selective"
    }
  ],
  "trustScore": 0.88,  // Inverse of fraud risk
  "recommendations": [
    "Safe to proceed with jobs up to $500 in UPON_COMPLETION mode",
    "For $5000+, require deliverable QA or escrow",
    "Consider milestone-based payments (50% + 50%) for large jobs"
  ]
}
```

**Technical Implementation:**

- **Fraud Signals:** Compute on-the-fly:
  - Rating velocity (5-star count per day)
  - Job value escalation (Markov chain of job amounts)
  - Profile age vs. rating count
  - Payment preference changes
  - Geographic anomalies (IP jumps between continents)
  - Communication latency distribution

- **Anomaly Detection:** Build statistical models of "normal" human behavior, flag deviations.
- **Cache:** Run daily, store in Redis, recompute on demand if flagged.

#### 5b. `agent_require_payment_guarantee`

For high-fraud-risk jobs, enforce structured payment:

```
POST /api/agents/mcp/jobs/{jobId}/set-payment-guarantee
{
  "guaranteeType": "MILESTONE",
  "milestones": [
    { "percentage": 50, "triggerOnDeliverableApproval": "step_1" },
    { "percentage": 50, "triggerOnDeliverableApproval": "step_2" }
  ]
}

// OR

{
  "guaranteeType": "SMART_CONTRACT",
  "escrowAddress": "0x...",  // ERC-20 escrow contract
  "releaseCondition": "deliverable_approved"
}
```

#### 5c. New Job Status: `PAYMENT_GUARANTEED`

```
PAYMENT_GUARANTEE_REQUIRED
  ↓ (human deposits funds into contract)
PAYMENT_GUARANTEED
  ↓ (stream starts)
IN_PROGRESS
  ↓ (human submits deliverable)
AWAITING_APPROVAL
  ↓ (agent validates)
COMPLETED
```

**Technical Implementation:**

- **Escrow Smart Contract:** Deploy simple ERC-20 contract that holds funds, releases on approval.
- **Job Workflow:** Add optional `guaranteeConfig` field. If present, require funding before stream starts.
- **Payment Verification:** New endpoint `PATCH /jobs/{id}/verify-escrow-funded` — check contract balance before starting stream.

**Impact:** Agents can now confidently hire unknown humans for $5K because funds are locked. **Fraud risk: 30% → <1%.**

---

### 6. "Would use Fiverr's unofficial API as primary" — HumanPages is a fallback

**Root Cause:** Missing three things that Fiverr has:
1. Pre-built gigs (Fiverr has 100M gigs in catalog, we have 0 — agents must search + negotiate)
2. Verified profiles (Fiverr has badges, we have fuzzy verification)
3. Guaranteed turnaround (Fiverr has SLA, we have "whenever")

**MCP Solutions: Fiverr-parity features**

#### 6a. `agent_browse_pre_built_services`

Humans can publish pre-built "gig" listings (like Fiverr).

```
GET /api/agents/mcp/services?category=data_labeling&minRating=4.5&deliveryTimeHours=24&sortBy=reputation

Response: {
  "services": [
    {
      "serviceId": "svc_123",
      "humanId": "h_maya_k",
      "title": "Label 100 product images with bounding boxes",
      "description": "High-quality annotation with 95%+ accuracy...",
      "category": "data_labeling",
      "priceUsdc": 150,
      "currency": "USDC",
      "deliveryTimeHours": 24,
      "revisionsIncluded": 2,
      "humanRating": 4.92,
      "humanReviewCount": 287,
      "humanVouchCount": 45,
      "humanVerifications": ["email", "id", "linkedin"],
      "deliverableTemplate": "tmpl_product_labeling_v2",
      "estimatedCompletionTime": "18 hours",
      "orderCount": 12,  // Orders of this service
      "successRate": 0.98,
      "hirableNow": true,
      "quickHireUrl": "/api/agents/mcp/services/svc_123/quick-hire"
    }
  ]
}
```

**Technical Implementation:**

- **New Model:** `Service` (already exists, now make queryable by agents)
- **Service Publishing:** Add UI for humans to publish "gigs" with fixed scope + price + delivery time
- **Materialized View:** Update service listing on every human update (skills, rating, verification)

#### 6b. `agent_quick_hire_service`

One-click purchase (no negotiation).

```
POST /api/agents/mcp/services/{serviceId}/quick-hire
{
  "quantity": 1,
  "rushDelivery": false,
  "paymentTiming": "upon_completion",
  "callbackUrl": "https://my-agent.ai/webhook"
}

Response: {
  "jobId": "job_xyz",
  "serviceId": "svc_123",
  "totalPriceUsdc": 150,
  "estimatedCompletionTime": "2026-03-30T10:00:00Z",
  "status": "PENDING_ACCEPTANCE",
  "webhookUrl": "https://my-agent.ai/webhook",
  "nextStep": "Wait for human to accept or webhook will fire in 6 hours"
}
```

#### 6c. `agent_service_sla_guarantee`

For published services, humans commit to turnaround time.

```
Service fields:
- deliveryTimeHours: 24
- revisionsIncluded: 2
- slaComplianceRate: 0.99  // Calculated from history

If human misses deadline → auto-refund (unless explicitly disputed)
```

**Technical Implementation:**

- **SLA Timer:** Job gets deadline from `service.deliveryTimeHours`. Store as `dueAt` field.
- **Deadline Monitoring:** Cron job checks overdue jobs, auto-refunds if `slaComplianceEnforced=true`.
- **Compliance Tracking:** Denormalize `slaComplianceRate` on Service record.

**Impact:** Agents can now hire from a catalog of 10K pre-built gigs instead of searching + negotiating. **Hiring friction: 5 min → 10 seconds.**

---

## Summary: New MCP Tools

| Tool | Complaint Solved | Implementation Effort | Impact |
|------|------------------|----------------------|--------|
| `agent_search_with_suggestions` | #1 (0 matches) | 2 weeks (search index + suggestion algorithm) | Search success: 0% → 85% |
| `agent_create_job_with_stream` | #2 (no webhooks) | 3 weeks (stream validation + webhook pipeline) | Autonomy: 10% → 95% |
| `agent_validate_deliverable` | #3 (no QA) | 2 weeks (schema + custom validator) | QA latency: hours → seconds |
| `agent_bulk_job_operations` | #2 (#4 rate limits) | 1 week (batch transaction) | Throughput: 15/day → 1000/day |
| `agent_analyze_human_fraud_risk` | #5 (gameable reputation) | 3 weeks (fraud signal ML) | Fraud risk: 30% → <1% |
| `agent_browse_pre_built_services` | #6 (Fiverr parity) | 2 weeks (service listing + filtering) | Hiring friction: 5 min → 10 sec |
| `agent_quick_hire_service` | #6 (Fiverr parity) | 1 week (new job endpoint) | Hiring friction: 5 min → 10 sec |

**Total Effort:** ~14 weeks | **Expected Score Impact:** 3/10 → 9/10

---

## MCP Tool Registry

All tools expose via `/api/agents/mcp/*` endpoints. Authentication via agent JWT (existing `authenticateAgent` middleware).

### Tool Categories

1. **Discovery & Search**
   - `agent_search_with_suggestions`
   - `agent_browse_pre_built_services`

2. **Job Lifecycle**
   - `agent_create_job_with_stream`
   - `agent_bulk_job_operations`
   - `agent_quick_hire_service`

3. **Quality & Validation**
   - `agent_validate_deliverable`
   - `agent_define_deliverable_template`
   - `agent_get_deliverable_history_with_quality`

4. **Trust & Safety**
   - `agent_analyze_human_fraud_risk`
   - `agent_require_payment_guarantee`

5. **Rate Limits & Billing**
   - `agent_request_unlimited_tier` (subscription)

---

# TWO SCENARIOS: End-to-End Workflows

---

## SCENARIO A: Research Agent Hiring 100 Humans Across 20 Countries (Grocery Price Photography)

**Goal:** Hire 100 humans to photograph local grocery store prices (competitive intelligence). Timeline: 2 weeks.

### Step 1: Define Deliverable Template (Agent Setup)

```
Agent calls: agent_define_deliverable_template

POST /api/agents/mcp/deliverable-templates
{
  "name": "Grocery Store Photo - v1",
  "schema": {
    "type": "object",
    "properties": {
      "storeId": { "type": "string" },
      "storeName": { "type": "string" },
      "address": { "type": "string" },
      "coordinates": { "type": "object", "properties": { "lat": { "type": "number" }, "lng": { "type": "number" } } },
      "photos": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "photoUrl": { "type": "string", "format": "uri" },
            "category": { "type": "string", "enum": ["produce", "dairy", "meat", "grains"] },
            "timestamp": { "type": "string", "format": "date-time" }
          },
          "required": ["photoUrl", "category", "timestamp"]
        },
        "minItems": 3,
        "maxItems": 20
      }
    },
    "required": ["storeId", "storeName", "photos"]
  },
  "validationRules": [
    { "type": "schema", "strictMode": true },
    { "type": "custom", "url": "https://research-agent.ai/validate-photos", "timeout": 10 }
  ],
  "qualityMetrics": [
    { "name": "photoClarity", "threshold": 0.85, "failureMode": "REQUEST_REVISION" }
  ]
}

Response: { "templateId": "tmpl_grocery_v1" }
```

### Step 2: Search for Suppliers in 20 Countries

Agent uses `agent_search_with_suggestions` to find candidates.

```
For each of 20 countries, agent calls:

POST /api/agents/mcp/search-with-suggestions
{
  "skillQuery": "photography local retail",
  "location": "New York, USA",  // or "London, UK", "Tokyo, Japan", etc.
  "radius": 50,
  "budgetUsdc": 30,
  "requirementsOverTolerance": {
    "minVouches": 0,  // New humans OK
    "minRate": 20
  }
}

Response:
{
  "directMatches": [
    { "humanId": "h_maria_123", "matchScore": 0.89, "trustScore": 0.72 },
    { "humanId": "h_john_456", "matchScore": 0.78, "trustScore": 0.65 }
  ],
  "alternativeMatches": [
    { "humanId": "h_alex_789", "matchScore": 0.65, "reason": "50km from city center" }
  ]
}
```

**Result:** Agent identifies ~200 candidates across 20 countries (2 per country, with backups).

### Step 3: Create 100 Bulk Jobs (with webhooks)

Agent uses `agent_bulk_job_operations`.

```
POST /api/agents/mcp/jobs/bulk-create
{
  "jobs": [
    {
      "humanId": "h_maria_123",
      "title": "Photograph grocery prices - New York",
      "description": "Visit any major grocery store (Whole Foods, Trader Joe's, etc.)...",
      "budget": { "priceUsdc": 30, "paymentMode": "ONE_TIME", "paymentTiming": "upon_completion" },
      "deliverableSpec": { "templateId": "tmpl_grocery_v1" },
      "metadata": { "country": "USA", "city": "New York", "storeType": "premium" }
    },
    // ... 99 more (2 per country)
  ],
  "webhookUrl": "https://research-agent.ai/webhook/grocery-jobs",
  "webhookSecret": "sk_live_abc123xyz",
  "parallelism": 20
}

Response:
{
  "batchId": "batch_grocery_001",
  "jobsCreated": 100,
  "jobsFailed": 0,
  "webhookPollingUrl": "/api/agents/mcp/jobs/batch/batch_grocery_001/status"
}
```

### Step 4: Humans Accept & Webhook Notifications

As humans accept (over 2-3 hours), agent receives webhooks:

```
POST https://research-agent.ai/webhook/grocery-jobs
X-HumanPages-Signature: sha256=abcd...

{
  "event": "job.accepted",
  "jobId": "job_maria_001",
  "humanId": "h_maria_123",
  "humanName": "Maria K.",
  "estimatedCompletionTime": "2026-03-30T15:00:00Z"
}

Agent logs: "Job job_maria_001 accepted by h_maria_123, expected completion 2026-03-30T15:00:00Z"
```

**Status:** After 3 hours, ~95 jobs accepted, 5 still pending (humans didn't see notification).

### Step 5: Human Work Phase (Agent Monitors via Webhooks)

For the next 48 hours, humans photograph their local stores. Agent receives deliverable webhooks:

```
POST https://research-agent.ai/webhook/grocery-jobs
{
  "event": "job.deliverable.received",
  "jobId": "job_maria_001",
  "deliverableId": "del_001",
  "humanId": "h_maria_123",
  "deliverableUrl": "https://api.humanpages.ai/deliverables/del_001"  // Signed URL
}

Agent automatically:
1. Fetches deliverable from signed URL
2. Validates against JSON schema
3. Calls https://research-agent.ai/validate-photos to check photo quality
```

### Step 6: Auto-Validate Deliverables

Agent calls `agent_validate_deliverable`:

```
POST /api/agents/mcp/jobs/{jobId}/validate-deliverable
{
  "deliverableId": "del_001",
  "validationRules": [
    { "type": "json_schema", "schema": { /* tmpl_grocery_v1 schema */ } },
    { "type": "custom_script", "url": "https://research-agent.ai/validate-photos", "timeout": 10 }
  ],
  "autoApproveIfValid": true
}

Response:
{
  "deliverableId": "del_001",
  "overallValid": true,
  "action": "APPROVED",
  "details": {
    "json_schema": { "valid": true },
    "custom_script": { "valid": true, "photoClarity": 0.94, "photoCount": 8 }
  }
}

Webhook to agent:
{
  "event": "job.deliverable.approved",
  "jobId": "job_maria_001",
  "deliverableId": "del_001",
  "payment": "PROCESSED"
}
```

**Result:** 87/100 deliverables approved automatically within 3 hours. 13 flagged for revision.

### Step 7: Request Revisions for Failed QA

For the 13 rejected deliverables:

```
Agent calls (automatically): PATCH /api/jobs/{jobId}/request-revision
{
  "reason": "Photo clarity too low (0.62 < 0.85 threshold)",
  "requiredChanges": "Retake photos in better lighting"
}

Webhook to human:
{
  "event": "job.revision.requested",
  "jobId": "job_john_456",
  "reason": "Photo clarity too low",
  "deadline": "2026-03-30T20:00:00Z"  // 4-hour deadline
}
```

Humans re-photograph and resubmit within 4 hours. Agent re-validates automatically.

**Result:** 12/13 pass on revision. 1 remains failed (human unresponsive). Agent marks job as "REVISION_OVERDUE" after 4 hours.

### Step 8: Collect Results & Analyze

All 99 successful jobs have approved deliverables. Agent now has:
- 800+ quality photos from 20 countries
- Metadata: store name, location, product categories, timestamps
- Quality scores: average photo clarity 0.91, all deliverables in JSON schema

Agent parses JSON, extracts pricing data, feeds into competitive intelligence pipeline.

```
Webhook after last job completed:
{
  "event": "batch.completed",
  "batchId": "batch_grocery_001",
  "totalJobs": 100,
  "successfulDeliverables": 99,
  "avgQuality": 0.91,
  "totalCost": "$3,000 USDC",
  "deliveriesUrl": "/api/agents/mcp/jobs/batch/batch_grocery_001/deliverables"
}

Agent fetches:
GET /api/agents/mcp/jobs/batch/batch_grocery_001/deliverables
[
  {
    "jobId": "job_maria_001",
    "humanId": "h_maria_123",
    "deliverableId": "del_001",
    "data": {
      "storeId": "whole_foods_10th_ave",
      "storeName": "Whole Foods Market - 10th Ave",
      "address": "10 10th Ave, New York, NY 10011",
      "coordinates": { "lat": 40.7489, "lng": -74.0008 },
      "photos": [
        { "photoUrl": "s3://...", "category": "produce", "timestamp": "2026-03-30T10:15:00Z" },
        // ...
      ]
    }
  },
  // ... 98 more
]
```

### Result

- 100 jobs created, scheduled, monitored, validated, paid in 5 days
- 0 human intervention (fully autonomous)
- 99% success rate
- Total cost: $3,000 USDC (well-controlled budget)
- 800+ high-quality photos with verified metadata
- All deliverables in standard JSON format (downstream systems can parse directly)

---

## SCENARIO B: AI Agent with Coinbase Wallet Hiring 10 RLHF Annotators (2-Week Sprint)

**Goal:** AI agent hires 10 annotators for 2-week RLHF labeling sprint. Budget: $3,000 USDC (~$15/hr × 10 people × 20 hrs/week × 2 weeks). Streaming payments.

### Step 0: Agent Setup (Autonomous Account)

```
Agent registers with HumanPages:
- Agent name: "RLHF Coordinator v2"
- Wallet: 0x1234...5678 (Coinbase agent wallet, holds $5K USDC)
- Auth: Agent JWT (from previous OAuth flow)
- Subscription tier: ENTERPRISE ($199/month, unlimited jobs)

Agent calls: agent_request_unlimited_tier
POST /api/agents/mcp/auth/request-unlimited-tier
{
  "agentId": "agent_rlhf_v2",
  "tier": "ENTERPRISE"
}

Response:
{
  "rateLimitTier": "ENTERPRISE",
  "limits": { "jobsPerDay": 5000, "concurrentStreams": 100 }
}
```

### Step 1: Find Qualified Annotators

Agent searches for annotators with specific skills:

```
POST /api/agents/mcp/search-with-suggestions
{
  "skillQuery": "RLHF machine learning AI annotation",
  "location": "global",
  "radius": 10000,  // Anywhere
  "budgetUsdc": 3000,
  "requirementsOverTolerance": {
    "minVouches": 5,           // Proven annotator
    "minRate": 12,              // At least $12/hr
    "minCompletedJobs": 3,      // Has completed jobs
    "profileCompleteness": 70   // Reasonably complete profile
  }
}

Response: 50 matches
[
  { "humanId": "h_alice_rlhf", "matchScore": 0.96, "trustScore": 0.91, "rateUsdc": 16, "vouchCount": 12 },
  { "humanId": "h_bob_ai", "matchScore": 0.91, "trustScore": 0.88, "rateUsdc": 15, "vouchCount": 8 },
  { "humanId": "h_carol_ml", "matchScore": 0.88, "trustScore": 0.85, "rateUsdc": 14, "vouchCount": 6 },
  // ... 47 more
]
```

Agent selects top 10 by trustScore:

```
Selected annotators:
1. h_alice_rlhf ($16/hr, trust: 0.91)
2. h_bob_ai ($15/hr, trust: 0.88)
3. h_carol_ml ($14/hr, trust: 0.85)
4-10. ...
```

### Step 2: Define Deliverable Spec

```
Agent calls: agent_define_deliverable_template

POST /api/agents/mcp/deliverable-templates
{
  "name": "RLHF Daily Batch - Week 1",
  "schema": {
    "type": "object",
    "properties": {
      "date": { "type": "string", "format": "date" },
      "annotationCount": { "type": "integer", "minimum": 50 },
      "labels": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "promptId": { "type": "string" },
            "response": { "type": "string" },
            "score": { "type": "integer", "minimum": 1, "maximum": 5 },
            "comments": { "type": "string", "maxLength": 500 }
          },
          "required": ["promptId", "response", "score"]
        }
      }
    },
    "required": ["date", "annotationCount", "labels"]
  },
  "validationRules": [
    { "type": "schema", "strictMode": true },
    { "type": "custom", "url": "https://ai-agent.com/validate-rlhf", "timeout": 60 }
  ]
}

Response: { "templateId": "tmpl_rlhf_week1" }
```

### Step 3: Create 10 Streaming Jobs (with Payment Guarantee)

Agent creates streaming jobs with SUPERFLUID:

```
POST /api/agents/mcp/jobs/create-with-stream

For each annotator:
{
  "humanId": "h_alice_rlhf",
  "agentId": "agent_rlhf_v2",
  "title": "RLHF Annotation - 2 Week Sprint (Week 1)",
  "description": "Label LLM responses on a 1-5 scale for preference learning. ~20 hrs/week for 2 weeks.",
  "streamConfig": {
    "method": "SUPERFLUID",
    "rateUsdc": 16.00,           // $16/hr
    "interval": "HOURLY",
    "maxHours": 40,              // Max 40 hours over 2 weeks
    "gracePeriodHours": 2        // 2-hour grace for offline work
  },
  "deliverableSpec": {
    "templateId": "tmpl_rlhf_week1"
  },
  "webhookUrl": "https://ai-agent.com/webhook/rlhf-jobs",
  "webhookSecret": "sk_live_rlhf_secret_abc123",
  "webhookEvents": [
    "job.accepted",
    "job.stream.started",
    "job.deliverable.received",
    "job.deliverable.rejected",
    "job.stream.stopped"
  ]
}

Response (for h_alice_rlhf):
{
  "jobId": "job_alice_rlhf_001",
  "streamAddress": "0xabcd...efgh",
  "status": "PENDING_ACCEPTANCE",
  "estimatedTotalPayout": "$640 (40 hrs × $16/hr)",
  "streamStart": "upon acceptance"
}
```

**Total 10 jobs created in <1 second** (bulk operation). Estimated total payout: $150 × 10 = $1,500 for 2 weeks.

### Step 4: Wait for Acceptances + Stream Starts

Over the next 2 hours, annotators accept. Agent receives webhooks:

```
POST https://ai-agent.com/webhook/rlhf-jobs (multiple)
{
  "event": "job.accepted",
  "jobId": "job_alice_rlhf_001",
  "humanId": "h_alice_rlhf",
  "humanName": "Alice (RLHF Expert)",
  "streamStartBlock": 48329401
}

// Repeated for each annotator
```

Immediately after acceptance, Superfluid stream starts. Agent can monitor on-chain:

```
Stream state:
- Receiver: h_alice_rlhf's wallet
- Sender: agent_rlhf_v2's wallet (0x1234...5678)
- Flow rate: 16 USDC / 3600 seconds = 0.00444 USDC/second
- Status: ACTIVE
- Balance: $640 locked in SuperApp
```

### Step 5: Hourly Deliverable Submissions + Validation

Each day, annotators submit deliverables (usually in evening, after 8 hours of work):

```
Day 1 Evening:

POST https://ai-agent.com/webhook/rlhf-jobs
{
  "event": "job.deliverable.received",
  "jobId": "job_alice_rlhf_001",
  "deliverableId": "del_alice_day1",
  "submittedAt": "2026-03-30T20:00:00Z"
}

Agent automatically:
1. Fetches deliverable JSON
2. Validates schema (date, annotationCount, labels array, etc.)
3. Calls https://ai-agent.com/validate-rlhf (custom validation)
   - Check: no duplicate promptIds
   - Check: scores are reasonable (not all 5s or 1s)
   - Check: response quality is non-trivial
```

Agent calls:

```
POST /api/agents/mcp/jobs/{jobId}/validate-deliverable
{
  "deliverableId": "del_alice_day1",
  "validationRules": [
    { "type": "json_schema", "schema": { /* schema */ } },
    { "type": "custom_script", "url": "https://ai-agent.com/validate-rlhf", "timeout": 30 }
  ],
  "autoApproveIfValid": true
}

Response:
{
  "deliverableId": "del_alice_day1",
  "validationResults": {
    "json_schema": { "valid": true },
    "custom_script": {
      "valid": true,
      "details": {
        "annotationCount": 127,
        "duplicates": 0,
        "scoreDistribution": { "1": 5, "2": 15, "3": 40, "4": 50, "5": 17 },
        "responseQuality": 0.93
      }
    }
  },
  "overallValid": true,
  "action": "APPROVED",
  "streamTicked": true
}
```

**Key:** `"streamTicked": true` means Superfluid automatically advanced 8 hours (assuming 8 hours of work). Payment flow continues.

### Step 6: Multi-Day Workflow (Week 1)

This repeats for 5 days:

```
Day 1: Alice submits 127 annotations (8 hrs work) → Approved → Stream ticks 8 hours → Alice gets paid $128
Day 2: Alice submits 131 annotations (8.5 hrs work) → Approved → Stream ticks 8.5 hours → Alice gets paid $136
Day 3: Alice submits 125 annotations (8 hrs work) → Approved → Stream ticks → Alice gets paid $128
Day 4: Alice submits 0 annotations (offline day) → No deliverable → Stream pauses (grace period active)
Day 5: Alice submits 200 annotations (12 hrs makeup work) → Approved → Stream ticks 12 hours → Alice gets paid $192
```

**After Week 1:** Alice has completed 40 hours, earned $640 (40 × $16). Superfluid shows $640 sent. Stream continues for Week 2.

### Step 7: Monitor Fraud/Quality Across All 10 Annotators

Agent periodically calls:

```
GET /api/agents/mcp/humans/h_alice_rlhf/deliverable-history?templateId=tmpl_rlhf_week1&limit=10

Response:
{
  "deliverables": [
    { "date": "2026-03-30", "overallQuality": 0.93, "status": "APPROVED", "hoursWorked": 8 },
    { "date": "2026-03-31", "overallQuality": 0.91, "status": "APPROVED", "hoursWorked": 8.5 },
    // ...
  ],
  "aggregateStats": {
    "avgQuality": 0.92,
    "approvalRate": 1.0,
    "totalHoursWorked": 40,
    "totalEarned": "$640"
  }
}
```

Agent also calls:

```
POST /api/agents/mcp/humans/h_alice_rlhf/fraud-risk-assessment

Response:
{
  "overallFraudRisk": "LOW",
  "fraudRiskScore": 0.08,
  "trustScore": 0.92,
  "riskFactors": [
    { "category": "delivery_consistency", "signal": "Delivers ~8 hrs/day, very consistent", "risk": "LOW" },
    { "category": "quality_stability", "signal": "Avg quality 0.92 ± 0.02, stable", "risk": "LOW" },
    { "category": "profile_age", "signal": "Account 2 years old, 45+ completed jobs", "risk": "LOW" }
  ]
}
```

All 10 annotators show LOW fraud risk. Quality stable. No issues.

### Step 8: End of 2-Week Sprint

After 10 working days (2 weeks), agent stops accepting deliverables:

```
PATCH /api/agents/mcp/jobs/{jobId}/stop-stream

Response:
{
  "jobId": "job_alice_rlhf_001",
  "status": "COMPLETED",
  "hoursWorked": 40.0,
  "finalPayout": "$640.00 USDC",
  "streamStoppedBlock": 48401500,
  "deliverableCount": 10,
  "avgQuality": 0.92,
  "recommendation": "Re-hire this annotator for next sprint"
}
```

Agent's wallet now shows:
- Started with: $5,000 USDC
- Spent on 10 annotators: $1,500 USDC
- Remaining: $3,500 USDC
- All 10 annotators have been paid in real-time via Superfluid

### Step 9: Collect Results & Train

Agent now has:
- 10,000 RLHF labels collected over 2 weeks
- All in JSON format (standard schema)
- Quality scores for each batch (0.88–0.94 range)
- Zero disputes, zero fraud, zero refunds needed

Agent downloads all deliverables:

```
GET /api/agents/mcp/jobs/batch/batch_rlhf_sprint1/deliverables

Response:
[
  {
    "jobId": "job_alice_rlhf_001",
    "humanId": "h_alice_rlhf",
    "deliverables": [
      { "data": { "date": "2026-03-30", "annotationCount": 127, "labels": [...] }, "quality": 0.93 },
      // ...
    ]
  },
  // ... for 10 annotators
]
```

Agent feeds 10,000 RLHF labels into model training pipeline. Done.

### Result

- 10 jobs created, accepted, streamed, validated, paid in full over 2 weeks
- 0 human intervention (fully autonomous)
- 100% completion rate
- 0 fraud, 0 disputes
- $1,500 USDC spent (on budget)
- 10,000 RLHF labels collected
- Real-time payments via Superfluid (no holding, no escrow)
- All deliverables in standard JSON schema

---

## Key Metrics: Before vs. After

| Metric | Before | After |
|--------|--------|-------|
| **Job posting success rate** | 40% (0 matches) | 85%+ (matches + suggestions) |
| **Rate limit (jobs/day)** | 15 (PRO) | 5,000 (ENTERPRISE) |
| **QA latency** | 24 hrs (human) | 30 sec (automated) |
| **Fraud risk** | 30% (gameable rating) | <1% (deliverable QA + fraud detection) |
| **Hiring friction** | 5 min (search + negotiate) | 10 sec (pre-built gig) |
| **Payment guarantee** | Escrow only (middleman) | On-chain escrow (trustless) |
| **Autonomy** | 10% (human review required) | 95% (webhooks + auto-approve) |
| **Bulk operations** | 1 job/request | 100 jobs/request |

**Expected CTO Score:** 9/10 (up from 3/10)

---

## Implementation Roadmap

**Phase 1 (Weeks 1-4):** Supply-side + bulk operations
- Agent search with suggestions
- Bulk job creation
- Search index

**Phase 2 (Weeks 5-8):** Streaming + QA
- Agent create job with stream
- Deliverable templates & validation
- Custom validator webhooks

**Phase 3 (Weeks 9-12):** Trust & fraud detection
- Fraud risk scoring
- Deliverable history API
- Payment guarantees

**Phase 4 (Weeks 13-14):** Pre-built gigs
- Service listing for agents
- Quick-hire endpoint
- SLA compliance

---

## Risks & Mitigation

| Risk | Mitigation |
|------|-----------|
| Webhook delivery failures | Exponential backoff + dead-letter queue + admin dashboard |
| Fraud detection false positives | Whitelist for proven users, manual appeal process |
| Stream overspending (agent out of funds mid-stream) | Check balance before starting stream, pause if low |
| Schema validation too strict | Allow `$comment` field for agent notes, relax strictMode option |
| Fiverr parity still missing | Add customer support SLA (24-hr response) + dispute resolution |

