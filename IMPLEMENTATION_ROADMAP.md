# HumanPages Agent MCP: Implementation Roadmap & Technical Details

---

## Overview

Transform HumanPages from 3/10 CTO score to 9+/10 by implementing four MCP tool categories in 14 weeks.

**Key principle:** Every new tool unblocks an autonomous agent use case that currently requires human intervention.

---

## Phase 1: Supply-Side Discovery + Bulk Operations (Weeks 1-4)

### Goal
Solve complaint #1 ("40-60% of job posting attempts fail") and #4 ("rate limits kill autonomy")

### 1.1 Search Index Infrastructure (Week 1)

**Task:** Denormalize searchable profile data into optimized index.

**Current State:**
- Search already exists at `GET /api/humans/search`
- Uses Prisma queries with text contains + filters
- Problem: No fuzziness, no suggestions, no supply gap analysis

**Changes Required:**

1. **New Prisma Model: SearchProfile**

```prisma
model SearchProfile {
  id              String    @id @default(cuid())
  humanId         String    @unique
  human           Human     @relation(fields: [humanId], references: [id])

  // Denormalized searchable fields
  skillTokens     String[]  @default([])      // ["python", "ml", "pytorch", ...]
  equipmentTokens String[]  @default([])      // ["camera", "canon", "eos", ...]
  languageTags    String[]  @default([])      // ["english-native", "german-fluent", ...]

  // Numeric fields (for range queries)
  minRateUsdc     Decimal   @default(0)
  maxRateUsdc     Decimal?
  vouchCount      Int       @default(0)
  completedJobs   Int       @default(0)
  reviewScore     Decimal   @default(0)

  // Geo (for distance queries)
  locationLat     Float?
  locationLng     Float?

  // Verification flags
  emailVerified   Boolean   @default(false)
  idVerified      Boolean   @default(false)
  linkedinVerified Boolean  @default(false)
  humanityVerified Boolean  @default(false)

  // Availability
  isAvailable     Boolean   @default(true)
  weeklyHours     Int?

  // Timestamps (for velocity queries)
  createdAt       DateTime  @default(now())
  lastJobAt       DateTime?
  lastRatingAt    DateTime?

  // Materialized metrics (for supply gap)
  supplyScarcityScore Float @default(0.5)  // How hard to find (0=common, 1=rare)

  @@index([skillTokens])
  @@index([vouchCount])
  @@index([minRateUsdc])
  @@index([completedJobs])
  @@fulltext([skillTokens])  // For fuzzy search
}
```

2. **Update Human Model Triggers**

Add Prisma trigger to update SearchProfile whenever Human changes:

```prisma
// In existing Human model
model Human {
  // ... existing fields ...

  searchProfile   SearchProfile?

  @@index([skills])  // Ensure indexed for denormalization
}
```

3. **Denormalization Logic (TypeScript)**

Create `backend/src/lib/searchProfileSync.ts`:

```typescript
export async function syncSearchProfile(humanId: string) {
  const human = await prisma.human.findUnique({
    where: { id: humanId },
    include: {
      services: true,
      educations: true,
      jobs: { where: { status: 'COMPLETED' } }
    }
  });

  if (!human) return;

  // Tokenize skills (expand synonyms)
  const skillTokens = [
    ...(human.skills || []).flatMap(s => tokenizeSkill(s)),
    ...extractSkillsFromBio(human.bio),
    ...extractSkillsFromEducation(human.educations)
  ];

  // Tokenize equipment
  const equipmentTokens = (human.equipment || []).flatMap(e => tokenizeEquipment(e));

  // Extract language tags
  const languageTags = (human.languages || []).map(l => tokenizeLanguage(l));

  // Rate bounds
  const services = human.services || [];
  const rates = services.map(s => s.priceMin).filter(Boolean);
  const minRateUsdc = rates.length > 0 ? Math.min(...rates) : 0;
  const maxRateUsdc = rates.length > 0 ? Math.max(...rates) : null;

  // Update search profile
  await prisma.searchProfile.upsert({
    where: { humanId },
    update: {
      skillTokens,
      equipmentTokens,
      languageTags,
      minRateUsdc,
      maxRateUsdc,
      vouchCount: human.vouchCount,
      completedJobs: human.jobs.length,
      isAvailable: human.isAvailable,
      weeklyHours: human.weeklyCapacityHours,
      lastJobAt: human.jobs[0]?.createdAt
    },
    create: {
      humanId,
      skillTokens,
      equipmentTokens,
      languageTags,
      minRateUsdc,
      maxRateUsdc,
      vouchCount: human.vouchCount,
      completedJobs: human.jobs.length
    }
  });
}
```

4. **Webhook Trigger**

Update all Human update endpoints to trigger sync:

```typescript
// In any route that modifies Human
await updateProfile(...);
await syncSearchProfile(userId);  // NEW
```

**Effort:** 5 days

**Validation:**
- Test tokenization for Hebrew + English
- Test fuzzy match on common typos ("pytohn" → "python")
- Benchmark: <100ms query for 10K results

---

### 1.2 Alternative Match Algorithm (Week 1-2)

**New endpoint:** `POST /api/agents/mcp/search-with-suggestions`

**Algorithm:**

```typescript
// backend/src/lib/searchAlgorithm.ts

export interface SearchResult {
  directMatches: Human[];
  alternativeMatches: AlternativeMatch[];
  supplyGapAnalysis: SupplyGapAnalysis;
}

export async function searchWithSuggestions(query: SearchQuery): Promise<SearchResult> {
  // Step 1: Direct match (all filters apply)
  const directMatches = await findDirectMatches(query);

  if (directMatches.length >= 5) {
    // Enough matches, no need for alternatives
    return { directMatches, alternativeMatches: [], supplyGapAnalysis: {} };
  }

  // Step 2: Generate alternatives (relax one filter at a time)
  const alternativeMatches = await generateAlternatives(query, directMatches);

  // Step 3: Supply gap analysis (which dimensions are scarce?)
  const supplyGapAnalysis = await analyzeSupplyGap(query);

  return { directMatches, alternativeMatches, supplyGapAnalysis };
}

async function findDirectMatches(query: SearchQuery): Promise<Human[]> {
  // Build Prisma where clause from all filters
  const where = buildWhereClause(query);

  const humans = await prisma.human.findMany({
    where,
    include: { searchProfile: true, services: true },
    take: query.limit || 20
  });

  // Score by relevance + trust
  return humans
    .map(h => ({
      ...h,
      matchScore: calculateRelevance(h, query),
      trustScore: calculateTrust(h)
    }))
    .sort((a, b) => (b.matchScore * b.trustScore) - (a.matchScore * a.trustScore));
}

async function generateAlternatives(
  query: SearchQuery,
  directMatches: Human[]
): Promise<AlternativeMatch[]> {
  const alternatives: AlternativeMatch[] = [];

  // Try relaxing each constraint
  const constraints = extractConstraints(query);

  for (const constraint of constraints) {
    const relaxedQuery = { ...query };

    switch (constraint.type) {
      case 'location':
        // Double radius
        relaxedQuery.radius = (relaxedQuery.radius || 50) * 2;
        break;
      case 'rate':
        // Increase budget by 20%
        relaxedQuery.budgetUsdc = (relaxedQuery.budgetUsdc || 1000) * 1.2;
        break;
      case 'vouches':
        // Lower threshold by 5
        relaxedQuery.minVouches = Math.max(0, (relaxedQuery.minVouches || 5) - 5);
        break;
      case 'availability':
        // Remove availability check
        delete (relaxedQuery as any).available;
        break;
    }

    const candidates = await prisma.human.findMany({
      where: buildWhereClause(relaxedQuery),
      include: { searchProfile: true },
      take: 10
    });

    // Filter to those NOT in directMatches
    const newCandidates = candidates.filter(
      c => !directMatches.find(d => d.id === c.id)
    );

    // For each, calculate what constraint failed in original query
    for (const candidate of newCandidates) {
      const unmetFilters = calculateUnmetFilters(candidate, query);
      if (unmetFilters.length > 0) {
        alternatives.push({
          humanId: candidate.id,
          matchScore: calculateRelevance(candidate, query),
          trustScore: calculateTrust(candidate),
          unmetFilters,
          suggestedAdjustments: generateAdjustments(unmetFilters, query)
        });
      }
    }
  }

  // Deduplicate + sort by match score
  const seen = new Set<string>();
  return alternatives
    .filter(a => {
      if (seen.has(a.humanId)) return false;
      seen.add(a.humanId);
      return true;
    })
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, 10);
}

function calculateUnmetFilters(
  human: Human,
  query: SearchQuery
): UnmetFilter[] {
  const unmet: UnmetFilter[] = [];

  if (query.minVouches && human.vouchCount < query.minVouches) {
    unmet.push({
      filter: 'vouches',
      humanValue: human.vouchCount,
      requiredValue: query.minVouches,
      delta: `${query.minVouches - human.vouchCount} vouches short`
    });
  }

  if (query.radius && query.lat && query.lng) {
    const distance = calculateDistance(
      query.lat, query.lng,
      human.locationLat, human.locationLng
    );
    if (distance > query.radius) {
      unmet.push({
        filter: 'location',
        humanValue: `${distance}km away`,
        requiredValue: `${query.radius}km`,
        delta: `${Math.round(distance - query.radius)}km over limit`
      });
    }
  }

  if (query.budgetUsdc && human.minRateUsdc > query.budgetUsdc) {
    unmet.push({
      filter: 'rate',
      humanValue: `$${human.minRateUsdc}/hr`,
      requiredValue: `<$${query.budgetUsdc}`,
      delta: `$${Math.round(human.minRateUsdc - query.budgetUsdc)} over budget`
    });
  }

  return unmet;
}

function generateAdjustments(
  unmetFilters: UnmetFilter[],
  query: SearchQuery
): SuggestedAdjustment[] {
  return unmetFilters.map(u => {
    if (u.filter === 'location') {
      const match = u.delta?.match(/(\d+)km over/);
      const overKm = match ? parseInt(match[1]) : 50;
      return {
        action: `Increase radius to ${(query.radius || 50) + overKm + 10}km`,
        confidence: 0.95
      };
    }
    if (u.filter === 'rate') {
      const match = u.delta?.match(/\$([0-9.]+) over/);
      const overAmount = match ? parseFloat(match[1]) : 10;
      return {
        action: `Increase budget to $${(query.budgetUsdc || 100) + overAmount + 5}`,
        confidence: 0.90
      };
    }
    return {
      action: `Relax ${u.filter} requirements`,
      confidence: 0.80
    };
  });
}

async function analyzeSupplyGap(query: SearchQuery): Promise<SupplyGapAnalysis> {
  // Query current supply levels across dimensions

  // For skills: count humans with each skill
  const skillSupply = await prisma.searchProfile.groupBy({
    by: ['skillTokens'],
    _count: true,
    where: buildWhereClause(query)
  });

  // For locations: bin by geography
  const locationSupply = await prisma.searchProfile.groupBy({
    by: ['locationLat', 'locationLng'],
    _count: true
  });

  // For rates: distribution
  const rateDistribution = await prisma.searchProfile.findMany({
    select: { minRateUsdc: true },
    where: buildWhereClause(query)
  });

  // Calculate scarcity (inverse of supply)
  const underSupplied = skillSupply
    .filter(s => s._count < 3)  // Very few humans
    .map(s => ({
      dimension: 'skill',
      value: s.skillTokens[0],
      availableSupply: s._count,
      supplyGapPercent: 95
    }));

  // If <3 direct matches but 10+ alternatives in next city:
  if (skillSupply.length > 0 && skillSupply[0]._count < 3) {
    const nearbyCity = findNearbyCity(query.lat, query.lng);
    return {
      underSupplied,
      recommendedAlternative: {
        location: nearbyCity,
        explanation: `${underSupplied[0].value} is scarce in this location`,
        estimatedMatches: 8
      }
    };
  }

  return { underSupplied, overSupplied: [] };
}
```

**Effort:** 8 days

---

### 1.3 Bulk Job Creation Endpoint (Week 2-3)

**Endpoint:** `POST /api/agents/mcp/jobs/bulk-create`

**Implementation:**

```typescript
// backend/src/routes/agents.ts

const bulkJobSchema = z.object({
  jobs: z.array(z.object({
    humanId: z.string(),
    title: z.string(),
    description: z.string(),
    budget: z.object({
      priceUsdc: z.number().positive(),
      paymentMode: z.enum(['ONE_TIME', 'STREAM']).optional()
    })
  })).min(1).max(1000),

  webhookUrl: z.string().url().optional(),
  webhookSecret: z.string().min(16).optional(),

  parallelism: z.number().int().min(1).max(100).optional()
});

router.post('/bulk-create', authenticateAgent, async (req: AgentAuthRequest, res) => {
  const validated = bulkJobSchema.parse(req.body);
  const agentId = req.agentId;

  // Create batch record
  const batch = await prisma.jobBatch.create({
    data: {
      agentId,
      totalJobs: validated.jobs.length,
      status: 'IN_PROGRESS',
      webhookUrl: validated.webhookUrl
    }
  });

  // Process in parallel (with queue to avoid overwhelming DB)
  const parallelism = validated.parallelism || 10;
  const queue = validated.jobs.map((j, idx) => ({ job: j, index: idx }));
  const results: { created: Job[], failed: { index: number, reason: string }[] } = {
    created: [],
    failed: []
  };

  // Process in batches
  for (let i = 0; i < queue.length; i += parallelism) {
    const batch = queue.slice(i, i + parallelism);

    await Promise.all(
      batch.map(async ({ job, index }) => {
        try {
          const newJob = await createJobInternal({
            ...job,
            agentId,
            externalJobId: `bulk_${batch.id}_${index}`
          });
          results.created.push(newJob);
        } catch (err) {
          results.failed.push({
            index,
            reason: (err as Error).message
          });
        }
      })
    );
  }

  // Update batch status
  await prisma.jobBatch.update({
    where: { id: batch.id },
    data: {
      status: 'COMPLETED',
      jobsCreated: results.created.length,
      jobsFailed: results.failed.length
    }
  });

  // Webhook: batch.completed
  if (validated.webhookUrl) {
    fireWebhook(validated.webhookUrl, {
      event: 'batch.completed',
      batchId: batch.id,
      jobsCreated: results.created.length,
      jobsFailed: results.failed.length
    }, validated.webhookSecret);
  }

  res.status(201).json({
    batchId: batch.id,
    jobsCreated: results.created.length,
    jobsFailed: results.failed.length,
    failedDetails: results.failed
  });
});
```

**New Prisma Model:**

```prisma
model JobBatch {
  id              String    @id @default(cuid())
  agentId         String
  registeredAgent RegisteredAgent @relation(fields: [agentId], references: [id])

  totalJobs       Int
  jobsCreated     Int       @default(0)
  jobsFailed      Int       @default(0)

  status          String    @default("IN_PROGRESS")  // "IN_PROGRESS" | "COMPLETED" | "FAILED"

  webhookUrl      String?
  webhookStatus   String?

  createdAt       DateTime  @default(now())
  completedAt     DateTime?

  @@index([agentId])
  @@index([status])
}
```

**Effort:** 6 days

**Testing:**
- Create 1, 10, 100 jobs in parallel
- Verify all created with correct data
- Verify webhook fires with batch.completed event
- Test failure handling (one human not found → other jobs still created)

---

### 1.4 Rate Limit Tiers (Week 3-4)

**New Subscription System:**

```typescript
// backend/src/lib/rateLimits.ts

const TIER_LIMITS = {
  STARTER: { jobsPerDay: 50, searchPerMin: 30, concurrent: 5 },
  PROFESSIONAL: { jobsPerDay: 500, searchPerMin: 500, concurrent: 50 },
  ENTERPRISE: { jobsPerDay: 5000, searchPerMin: 1000, concurrent: 100 }
};

// Check tier before applying IP rate limit
async function checkAgentTier(agentId: string) {
  const agent = await prisma.registeredAgent.findUnique({
    where: { id: agentId },
    select: { subscriptionTier: true }
  });
  return TIER_LIMITS[agent?.subscriptionTier || 'STARTER'];
}

// New middleware
export function agentRateLimiter(tier: 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE') {
  return rateLimit({
    windowMs: 24 * 60 * 60 * 1000,  // 24 hours
    max: TIER_LIMITS[tier].jobsPerDay,
    keyGenerator: (req) => {
      // Use agent ID from JWT, not IP
      return (req as AgentAuthRequest).agentId;
    }
  });
}
```

**Update Job Posting Endpoint:**

```typescript
router.post(
  '/',
  authenticateAgent,
  requireActiveOrPaid,
  async (req: AgentAuthRequest, res) => {
    // No IP rate limiter! Tier-based instead
    const agent = await prisma.registeredAgent.findUnique({
      where: { id: req.agentId }
    });

    const limits = TIER_LIMITS[agent?.subscriptionTier || 'STARTER'];
    // Check daily quota...
  }
);
```

**Subscription Setup (Week 4):**

```typescript
// backend/src/routes/agents.ts

router.post('/request-tier', authenticateAgent, async (req: AgentAuthRequest, res) => {
  const { tier } = req.body;

  if (tier === 'ENTERPRISE') {
    // Redirect to Stripe
    const session = await stripe.checkout.sessions.create({
      customer_email: req.user.email,
      line_items: [{
        price: process.env.STRIPE_ENTERPRISE_PRICE_ID,
        quantity: 1
      }],
      mode: 'subscription',
      success_url: 'https://humanpages.ai/dashboard/billing?success=true',
      cancel_url: 'https://humanpages.ai/dashboard/billing'
    });

    return res.json({ stripeCheckoutUrl: session.url });
  }

  // Update tier
  await prisma.registeredAgent.update({
    where: { id: req.agentId },
    data: { subscriptionTier: tier }
  });

  res.json({ subscriptionTier: tier });
});
```

**Effort:** 5 days

---

## Phase 2: Streaming Payments + Quality Validation (Weeks 5-8)

### Goal
Solve complaint #2 (no webhooks) and #3 (agents can't judge quality)

### 2.1 Streaming Payment Integration (Week 5-6)

**Current State:**
- SuperFluid integration exists (`backend/src/lib/blockchain/`)
- Job model has stream fields
- Problem: No auto-tick, no deliverable validation trigger

**New Features:**

1. **Auto-tick Stream on Deliverable Approval**

```typescript
// When agent approves deliverable:
await prisma.job.update({
  where: { id: jobId },
  data: {
    lastDeliverableApprovedAt: new Date(),
    // Stream tick triggered by webhook (async)
  }
});

// Async job (in queue):
async function tickStreamIfApproved(jobId: string) {
  const job = await prisma.job.findUnique({ where: { id: jobId } });

  if (job.paymentMode !== 'STREAM') return;

  // Calculate hours worked based on deliverable timestamp
  const hoursWorked = calculateHoursWorked(
    job.lastDeliverableApprovedAt,
    job.lastStreamTickAt
  );

  // Tick stream on-chain
  await tickSuperfluidStream(job.streamAddress, hoursWorked);

  // Update DB
  await prisma.job.update({
    where: { id: jobId },
    data: { lastStreamTickAt: new Date() }
  });
}
```

2. **Grace Period Mechanism**

If human doesn't submit deliverable for N hours, stream pauses:

```typescript
// Cron job (every hour)
async function pauseExpiredStreams() {
  const jobs = await prisma.job.findMany({
    where: {
      status: 'IN_PROGRESS',
      paymentMode: 'STREAM',
      lastDeliverableApprovedAt: {
        lte: new Date(Date.now() - GRACE_PERIOD_MS)
      }
    }
  });

  for (const job of jobs) {
    // Call Superfluid to pause stream
    await pauseSuperfluidStream(job.streamAddress);

    // Send webhook
    fireWebhook(job.callbackUrl, {
      event: 'job.stream.paused',
      reason: 'No deliverable submitted within grace period'
    });
  }
}
```

**Effort:** 5 days

---

### 2.2 Deliverable Validation Framework (Week 6-7)

**New Prisma Models:**

```prisma
model DeliverableTemplate {
  id              String    @id @default(cuid())
  agentId         String
  registeredAgent RegisteredAgent @relation(fields: [agentId], references: [id])

  name            String
  description     String?

  // JSON schema
  schema          Json

  validationRules Json[]    // Array of validation rules
  qualityMetrics  Json[]    // Array of quality metrics

  isPublic        Boolean   @default(false)

  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  @@index([agentId])
}

model Deliverable {
  id              String    @id @default(cuid())
  jobId           String
  job             Job       @relation(fields: [jobId], references: [id])

  templateId      String?
  template        DeliverableTemplate? @relation(fields: [templateId], references: [id])

  // Raw data
  data            Json
  format          String    @default("application/json")

  // Validation results
  validationStatus String   @default("PENDING")  // "PENDING" | "APPROVED" | "REJECTED" | "REVISION_REQUESTED"
  validationResults Json?
  qualityScores   Json?     // { metric1: 0.95, metric2: 0.88 }
  overallQuality  Decimal?  @default(0)

  submittedAt     DateTime  @default(now())
  validatedAt     DateTime?
  approvedAt      DateTime?

  revisionsRequested Int    @default(0)

  @@index([jobId])
  @@index([templateId])
  @@index([validationStatus])
}
```

**New Endpoint: `agent_define_deliverable_template`**

```typescript
router.post(
  '/deliverable-templates',
  authenticateAgent,
  async (req: AgentAuthRequest, res) => {
    const schema = z.object({
      name: z.string(),
      schema: z.object({}),  // JSON schema (permissive)
      validationRules: z.array(z.object({})),
      qualityMetrics: z.array(z.object({})).optional()
    });

    const validated = schema.parse(req.body);

    const template = await prisma.deliverableTemplate.create({
      data: {
        agentId: req.agentId,
        ...validated
      }
    });

    res.status(201).json(template);
  }
);
```

**New Endpoint: `agent_validate_deliverable`**

```typescript
router.post(
  '/jobs/:jobId/validate-deliverable',
  authenticateAgent,
  async (req: AgentAuthRequest, res) => {
    const { deliverableId, validationRules, autoApproveIfValid } = req.body;

    const deliverable = await prisma.deliverable.findUnique({
      where: { id: deliverableId }
    });

    // Step 1: JSON Schema validation
    const schemaRule = validationRules.find((r: any) => r.type === 'json_schema');
    if (schemaRule) {
      const ajv = new Ajv();
      const valid = ajv.validate(schemaRule.schema, deliverable.data);

      if (!valid) {
        return res.status(400).json({
          overallValid: false,
          action: 'REJECTED',
          errors: ajv.errors
        });
      }
    }

    // Step 2: Custom validator webhook
    const customRule = validationRules.find((r: any) => r.type === 'custom_script');
    let customValid = true;
    let customDetails = {};

    if (customRule) {
      const response = await fetch(customRule.url, {
        method: 'POST',
        body: JSON.stringify({
          deliverable: deliverable.data,
          jobId: req.params.jobId
        }),
        timeout: customRule.timeout * 1000
      });

      const result = await response.json();
      customValid = result.valid;
      customDetails = result.details || {};
    }

    // Step 3: Auto-approve + tick stream?
    if (autoApproveIfValid && customValid) {
      // Approve
      await prisma.deliverable.update({
        where: { id: deliverableId },
        data: {
          validationStatus: 'APPROVED',
          validatedAt: new Date(),
          approvedAt: new Date(),
          qualityScores: customDetails
        }
      });

      // Tick stream
      const job = await prisma.job.findUnique({
        where: { id: req.params.jobId }
      });

      if (job.paymentMode === 'STREAM') {
        await tickStreamIfApproved(job.id);
      }

      return res.json({
        overallValid: true,
        action: 'APPROVED',
        streamTicked: true
      });
    }

    res.json({
      overallValid: customValid,
      action: customValid ? 'APPROVED' : 'REJECTED'
    });
  }
);
```

**Effort:** 6 days

---

### 2.3 Deliverable History API (Week 7-8)

**Endpoint: `GET /api/agents/mcp/humans/{humanId}/deliverable-history`**

```typescript
router.get(
  '/humans/:humanId/deliverable-history',
  authenticateAgent,
  async (req: AgentAuthRequest, res) => {
    const { humanId } = req.params;
    const { templateId, limit = 20, offset = 0 } = req.query;

    // Fetch deliverables for this human
    const deliverables = await prisma.deliverable.findMany({
      where: {
        job: {
          humanId,
          ...(templateId && { templateId })
        }
      },
      include: { job: true },
      orderBy: { submittedAt: 'desc' },
      take: parseInt(limit as string),
      skip: parseInt(offset as string)
    });

    // Aggregate stats
    const all = await prisma.deliverable.findMany({
      where: { job: { humanId } },
      select: {
        validationStatus: true,
        overallQuality: true,
        revisionsRequested: true
      }
    });

    const stats = {
      avgQuality:
        all.reduce((sum, d) => sum + (d.overallQuality || 0), 0) / all.length,
      approvalRate:
        all.filter(d => d.validationStatus === 'APPROVED').length / all.length,
      revisionRate:
        all.filter(d => d.revisionsRequested > 0).length / all.length
    };

    res.json({
      human: { humanId },
      deliverables,
      aggregateStats: stats
    });
  }
);
```

**Effort:** 3 days

---

## Phase 3: Trust & Fraud Detection (Weeks 9-12)

### Goal
Solve complaint #5 (reputation is gameable)

### 3.1 Fraud Risk Scoring (Week 9-10)

**New Prisma Model:**

```prisma
model FraudRiskAssessment {
  id              String    @id @default(cuid())
  humanId         String
  human           Human     @relation(fields: [humanId], references: [id])

  overallRiskScore Decimal  @default(0.5)  // 0-1
  trustScore      Decimal   @default(0.5)  // 1 - riskScore

  riskFactors     Json[]    // Array of { category, signal, risk, explanation }

  recommendations String[]

  generatedAt     DateTime  @default(now())
  validUntil      DateTime  @default(now() + 24h)

  @@index([humanId])
  @@index([overallRiskScore])
}
```

**Scoring Algorithm:**

```typescript
// backend/src/lib/fraudDetection.ts

export async function assessFraudRisk(humanId: string): Promise<FraudRiskAssessment> {
  const human = await prisma.human.findUnique({
    where: { id: humanId },
    include: {
      jobs: { where: { status: 'COMPLETED' } },
      reviews: true,
      vouches: true
    }
  });

  const riskFactors: RiskFactor[] = [];

  // Factor 1: Rating velocity
  const ratingVelocity = await calculateRatingVelocity(humanId);
  if (ratingVelocity > 10 / 24) {  // >10 ratings per day
    riskFactors.push({
      category: 'rating_velocity',
      signal: `${ratingVelocity} ratings/day`,
      risk: percentileToRisk(getPercentile('rating_velocity', ratingVelocity)),
      explanation: 'Unusually fast accumulation of ratings'
    });
  }

  // Factor 2: Job value escalation
  const valueEscalation = calculateValueEscalation(human.jobs);
  if (valueEscalation.factor > 10) {  // Sudden 10x jump
    riskFactors.push({
      category: 'job_value_escalation',
      signal: `${valueEscalation.factor}x increase in job value`,
      risk: 'HIGH',
      explanation: 'Classic scam pattern: proof with small jobs, then large ask'
    });
  }

  // Factor 3: Profile age vs. reputation
  const profileAge = Date.now() - human.createdAt.getTime();
  const reputation = human.reviews.length + human.vouches.length;
  if (profileAge < 7 * 24 * 60 * 60 * 1000 && reputation > 10) {
    // <1 week old, but 10+ reputation = suspicious
    riskFactors.push({
      category: 'reputation_velocity',
      signal: 'New account with many reviews/vouches',
      risk: 'MEDIUM',
      explanation: 'Harder to fake but possible with collusion'
    });
  }

  // Factor 4: Geographic anomalies
  const geoAnomalies = detectGeoAnomalies(humanId);
  if (geoAnomalies) {
    riskFactors.push({
      category: 'geographic_anomaly',
      signal: geoAnomalies.signal,
      risk: geoAnomalies.risk,
      explanation: 'Unusual location patterns'
    });
  }

  // Score: sum of risk factors (0-1)
  const overallRiskScore = Math.min(1, riskFactors.reduce((sum, f) => {
    const weight = { LOW: 0.05, MEDIUM: 0.25, HIGH: 0.5, CRITICAL: 1 };
    return sum + weight[f.risk];
  }, 0));

  return {
    overallRiskScore,
    trustScore: 1 - overallRiskScore,
    riskFactors,
    recommendations: generateRecommendations(riskFactors)
  };
}

function calculateValueEscalation(jobs: Job[]): { factor: number } {
  if (jobs.length < 3) return { factor: 0 };

  const sorted = jobs.sort((a, b) =>
    a.createdAt.getTime() - b.createdAt.getTime()
  );

  const recent = sorted[sorted.length - 1].priceUsdc;
  const median = sorted[Math.floor(sorted.length / 2)].priceUsdc;

  return { factor: recent / median };
}

function detectGeoAnomalies(humanId: string): RiskFactor | null {
  // Check: does human jump between continents too fast?
  // E.g., London job yesterday, Tokyo job today = suspicious

  const jobs = prisma.job.findMany({
    where: { humanId },
    select: { createdAt: true, agentLat: true, agentLng: true }
  });

  // TODO: implement haversine distance check
  return null;
}
```

**Effort:** 7 days

---

### 3.2 Payment Guarantees (Smart Contract Escrow) (Week 10-11)

**On-Chain Contract (Solidity):**

```solidity
// contracts/HumanPagesEscrow.sol

pragma solidity ^0.8.0;

contract HumanPagesEscrow {
  struct Escrow {
    address agent;
    address human;
    uint256 amount;
    uint256 releaseBlock;
    bool released;
    string jobId;
  }

  mapping(string => Escrow) public escrows;

  event EscrowCreated(string jobId, address agent, address human, uint256 amount);
  event EscrowReleased(string jobId, uint256 amount);

  function createEscrow(
    string memory jobId,
    address human,
    uint256 amount,
    uint256 releaseBlock
  ) public payable {
    require(msg.value == amount, "Amount mismatch");

    escrows[jobId] = Escrow({
      agent: msg.sender,
      human: human,
      amount: amount,
      releaseBlock: releaseBlock,
      released: false,
      jobId: jobId
    });

    emit EscrowCreated(jobId, msg.sender, human, amount);
  }

  function release(string memory jobId) public {
    Escrow storage e = escrows[jobId];
    require(!e.released, "Already released");
    require(msg.sender == e.agent || msg.sender == e.human, "Not authorized");
    require(block.number >= e.releaseBlock, "Too early");

    e.released = true;
    payable(e.human).transfer(e.amount);

    emit EscrowReleased(jobId, e.amount);
  }

  function refund(string memory jobId) public {
    Escrow storage e = escrows[jobId];
    require(!e.released, "Already released");
    require(msg.sender == e.agent, "Only agent can refund");

    e.released = true;
    payable(e.agent).transfer(e.amount);
  }
}
```

**Backend Integration:**

```typescript
// When agent creates job with SMART_CONTRACT guarantee:

router.post('/jobs/create-with-guarantee', authenticateAgent, async (req) => {
  const { jobId, humanId, amountUsdc, network } = req.body;

  // Convert USDC to wei
  const amountWei = ethers.utils.parseUnits(amountUsdc.toString(), 6);

  // Deploy escrow instance
  const contract = new ethers.Contract(
    ESCROW_ADDRESS,
    ESCROW_ABI,
    agentSigner
  );

  const tx = await contract.createEscrow(
    jobId,
    humanWalletAddress,
    amountWei,
    Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60  // 30 days
  );

  const receipt = await tx.wait();

  // Store escrow reference in Job
  await prisma.job.update({
    where: { id: jobId },
    data: {
      guaranteeType: 'SMART_CONTRACT',
      guaranteeData: {
        contractAddress: ESCROW_ADDRESS,
        escrowId: jobId,
        transactionHash: receipt.transactionHash,
        network
      }
    }
  });

  return { escrowId: jobId, txHash: receipt.transactionHash };
});

// When agent approves deliverable, release funds:
async function approveDeliverable(jobId: string) {
  const job = await prisma.job.findUnique({ where: { id: jobId } });

  if (job.guaranteeType === 'SMART_CONTRACT') {
    // Release escrow
    const contract = new ethers.Contract(
      job.guaranteeData.contractAddress,
      ESCROW_ABI,
      agentSigner
    );

    const tx = await contract.release(job.id);
    await tx.wait();
  }
}
```

**Effort:** 6 days

---

### 3.3 Endpoint: `agent_analyze_human_fraud_risk` (Week 11-12)

```typescript
router.post(
  '/humans/:humanId/fraud-risk-assessment',
  authenticateAgent,
  async (req: AgentAuthRequest, res) => {
    const { analysisDepth = 'quick' } = req.body;
    const { humanId } = req.params;

    // Check cache first (valid for 24h)
    let cached = await prisma.fraudRiskAssessment.findUnique({
      where: { humanId },
      select: {
        overallRiskScore: true,
        trustScore: true,
        riskFactors: true,
        validUntil: true
      }
    });

    if (cached && cached.validUntil > new Date()) {
      return res.json(cached);
    }

    // Compute fresh assessment
    const assessment = await assessFraudRisk(humanId);

    // Cache it
    await prisma.fraudRiskAssessment.upsert({
      where: { humanId },
      update: assessment,
      create: { humanId, ...assessment }
    });

    res.json(assessment);
  }
);
```

**Effort:** 2 days

---

## Phase 4: Pre-built Gigs & SLA Compliance (Weeks 13-14)

### Goal
Solve complaint #6 (Fiverr parity) and reduce hiring friction

### 4.1 Service Browsing & SLA (Week 13)

**Current State:**
- Service model exists
- Humans can create services (in onboarding)
- Problem: No filtering for agents, no SLA tracking

**New Fields:**

```prisma
model Service {
  // Existing fields...

  // SLA fields
  deliveryTimeHours  Int?      // Expected turnaround
  revisionsIncluded  Int?      // Number of free revisions
  slaComplianceRate  Decimal?  // 0-1, historical

  // Visibility
  isPublicGig        Boolean   @default(false)  // Published for agents
  gigOrderCount      Int       @default(0)      // How many times ordered
  gigSuccessRate     Decimal?  @default(0)      // Approve rate

  @@index([isPublicGig])
  @@index([category])
  @@index([slaComplianceRate])
}
```

**Endpoint: `GET /api/agents/mcp/services`**

```typescript
router.get(
  '/services',
  authenticateAgent,
  async (req: AgentAuthRequest, res) => {
    const {
      category,
      minRating = 0,
      deliveryTimeHours,
      maxPriceUsdc,
      sortBy = 'relevance'
    } = req.query;

    const where = {
      isPublicGig: true,
      category: category ? { contains: category as string } : undefined,
      priceMin: maxPriceUsdc ? { lte: parseFloat(maxPriceUsdc as string) } : undefined
    };

    const services = await prisma.service.findMany({
      where,
      include: { human: { select: { id: true, displayName: true, ... } } },
      take: 20
    });

    // Enrich with SLA + rating
    const enriched = services.map(s => ({
      ...s,
      humanRating: s.human.reviewScore,
      slaComplianceRate: s.slaComplianceRate || 1.0,
      quickHireUrl: `/api/agents/mcp/services/${s.id}/quick-hire`
    }));

    // Sort
    const sorted = enriched.sort((a, b) => {
      if (sortBy === 'trust') {
        return (b.slaComplianceRate * b.humanRating) - (a.slaComplianceRate * a.humanRating);
      }
      return 0;
    });

    res.json({ services: sorted });
  }
);
```

**Endpoint: `POST /api/agents/mcp/services/{serviceId}/quick-hire`**

```typescript
router.post(
  '/services/:serviceId/quick-hire',
  authenticateAgent,
  async (req: AgentAuthRequest, res) => {
    const service = await prisma.service.findUnique({
      where: { id: req.params.serviceId },
      include: { human: true }
    });

    // Create job directly from service
    const job = await prisma.job.create({
      data: {
        humanId: service.humanId,
        agentId: req.agentId,
        title: service.title,
        description: service.description || '',
        category: service.category,
        priceUsdc: service.priceMin || 0,
        paymentTiming: 'upon_completion',
        status: 'PENDING_ACCEPTANCE',
        gig ServiceId: service.id  // Track source
      }
    });

    res.status(201).json({
      jobId: job.id,
      serviceId: service.id,
      status: 'PENDING_ACCEPTANCE',
      estimatedCompletionTime: new Date(Date.now() + service.deliveryTimeHours * 3600 * 1000)
    });
  }
);
```

**Effort:** 5 days

---

### 4.2 SLA Monitoring & Auto-Refund (Week 13-14)

**Cron Job:**

```typescript
// runs every hour

async function enforceSLACompliance() {
  const jobs = await prisma.job.findMany({
    where: {
      status: 'IN_PROGRESS',
      slaComplianceEnforced: true,
      gigsServiceId: { not: null }
    },
    include: { service: true }
  });

  for (const job of jobs) {
    const deadline = job.createdAt + job.service.deliveryTimeHours * 3600 * 1000;
    if (Date.now() > deadline) {
      // Overdue!

      // Auto-refund
      if (job.paymentMode === 'ONE_TIME' && job.paymentTiming === 'upfront') {
        // Refund agent
        await stripe.refunds.create({
          payment_intent: job.stripePaymentId
        });
      }

      // Mark as SLA violation
      await prisma.job.update({
        where: { id: job.id },
        data: { slaViolation: true }
      });

      // Decrement human's SLA compliance rate
      const human = await prisma.human.findUnique({
        where: { id: job.humanId }
      });

      const totalGigs = await prisma.job.count({
        where: { humanId: job.humanId, gigsServiceId: { not: null } }
      });

      const violations = await prisma.job.count({
        where: { humanId: job.humanId, slaViolation: true }
      });

      const complianceRate = (totalGigs - violations) / totalGigs;

      await prisma.service.updateMany({
        where: { humanId: job.humanId },
        data: { slaComplianceRate: complianceRate }
      });
    }
  }
}
```

**Effort:** 3 days

---

## Summary

| Week | Phase | Deliverable | Effort |
|------|-------|-------------|--------|
| 1-4 | 1 | Search index + alternatives + bulk jobs + rate limits | 24 days |
| 5-8 | 2 | Streaming auto-tick + validation framework + deliverable history | 17 days |
| 9-12 | 3 | Fraud detection + smart contract escrow | 15 days |
| 13-14 | 4 | Pre-built gigs + SLA compliance | 8 days |
| **Total** | - | **7 New MCP Tools** | **64 days (~14 weeks)** |

---

## Testing Strategy

### Unit Tests
- Search tokenization (Hebrew, English, typos)
- Fraud scoring (each factor independently)
- Value escalation detection
- SLA deadline calculation

### Integration Tests
- Create bulk jobs → all created
- Validate deliverable with schema + custom validator → approved
- Approve deliverable → stream ticks
- Pause stream after grace period
- Release escrow on approval

### End-to-End Tests
- **Scenario A:** Create 100 jobs, receive deliverables, auto-validate, pay
- **Scenario B:** Stream job, submit daily deliverables, auto-tick stream

---

## Deployment Strategy

1. **Week 1-4:** Deploy Phase 1 behind feature flag (`AGENT_BULK_JOBS_ENABLED`)
2. **Week 5-8:** Deploy Phase 2 (webhooks + validation) to BETA agents first
3. **Week 9-12:** Phase 3 (fraud detection) rolls out to all agents (read-only initially)
4. **Week 13-14:** Phase 4 (gigs) public launch

---

## Success Metrics

| Metric | Before | Target | Measurement |
|--------|--------|--------|-------------|
| Job posting success rate | 40% | 85%+ | Search queries with >0 results |
| Avg time to hire | 15 min | <30 sec | Time from agent search to job posted |
| Rate limit (jobs/day) | 15 | 5000 | Max jobs in 24h by agent |
| QA latency | 24 hrs | 30 sec | Time from deliverable received to approval |
| Fraud risk | 30% | <1% | Disputed jobs / total jobs |
| Autonomy | 10% | 95% | Jobs completed without human review |
| CTO Score | 3/10 | 9/10 | Subjective assessment |

