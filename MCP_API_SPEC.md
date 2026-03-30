# HumanPages Agent MCP: Complete API Specification

---

## 1. DISCOVERY & SEARCH

### 1.1 `agent_search_with_suggestions`

**Endpoint:** `POST /api/agents/mcp/search-with-suggestions`

**Auth:** Agent JWT (via `authenticateAgent` middleware)

**Rate Limit:** 30/min (STARTER), 1000/min (ENTERPRISE)

**Request Schema:**

```typescript
{
  // Core search filters
  skillQuery?: string;              // "python machine learning" - fuzzy matched
  location?: string;                // "Berlin" - geocoded to lat/lng
  lat?: number;                     // -90 to 90
  lng?: number;                     // -180 to 180
  radius?: number;                  // km, default 50

  // Work preferences
  workMode?: "REMOTE" | "ONSITE" | "HYBRID";
  workType?: "digital" | "physical" | "both";

  // Pricing
  budgetUsdc?: number;              // Max price agent willing to pay
  minRate?: number;                 // Minimum hourly rate (USDC)
  maxRate?: number;                 // Maximum hourly rate (USDC)

  // Trust & verification
  minVouches?: number;              // Minimum vouch count
  minCompletedJobs?: number;        // Minimum completed jobs
  hasVerifiedLogin?: boolean;       // LinkedIn/GitHub verified
  hasPhoto?: boolean;               // Has approved profile photo
  humanityVerified?: boolean;       // Passed humanity check

  // Availability
  minCapacityHours?: number;        // Minimum weekly hours available
  timezone?: string;                // "America/New_York"
  responseTimeCommitment?: "within_1h" | "within_4h" | "within_24h" | "flexible";

  // Education
  degree?: string;                  // "Bachelor's" - searchable
  field?: string;                   // "Computer Science"
  institution?: string;             // "MIT"

  // Equipment/skills
  equipment?: string;               // "Camera" or "Camera - Canon EOS"
  language?: string;                // "English (Native)"

  // Project context (for better suggestions)
  projectDeadline?: string;         // ISO 8601
  projectScope?: string;            // "100 images labeling"

  // Tolerance for suggestions
  requirementsOverTolerance?: {
    minVouches?: number;            // How much below min acceptable
    minRate?: number;               // How much below max budget acceptable
    minCompletedJobs?: number;
  };

  // Pagination
  limit?: number;                   // 10-100, default 20
  offset?: number;                  // default 0

  // Sorting
  sortBy?: "relevance" | "trust" | "rate_low" | "rate_high" | "newest";
}
```

**Response Schema:**

```typescript
{
  // Direct matches (exact or near-exact)
  directMatches: Array<{
    humanId: string;
    matchScore: number;             // 0-1, relevance to query
    trustScore: number;             // 0-1, based on vouches + jobs + verification
    rateUsdc: number;               // Hourly or flat rate in USDC

    // Summary data (no PII)
    vouchCount: number;
    completedJobsCount: number;
    hasPhoto: boolean;
    workMode: string;
    timezone: string;

    // Availability
    weeklyCapacityHours?: number;
    responseTimeCommitment?: string;

    // Verification status
    hasVerifiedLogin: boolean;
    humanityVerified: boolean;

    // Recommendations (why they match)
    matchReasons: string[];         // ["Skilled in Python", "Based in Berlin"]

    // Quick hire option
    quickHireUrl?: string;          // "/api/agents/mcp/services/{serviceId}/quick-hire"
  }>;

  // Alternative matches (one or more filters don't match)
  alternativeMatches: Array<{
    humanId: string;
    matchScore: number;             // Lower than direct matches
    trustScore: number;
    rateUsdc: number;

    // Why they don't match directly
    unmetFilters: Array<{
      filter: string;               // "location" | "rate" | "vouches" | "availability"
      humanValue: string | number;  // What they have
      requiredValue: string | number; // What agent wanted
      delta?: string;               // "40km away" | "$5 below budget" | "2 vouches short"
    }>;

    // How to adjust to hire them
    suggestedAdjustments: Array<{
      action: string;               // "Increase radius to 40km"
      confidence: number;           // 0-1, likelihood it will work
      estimatedNewMatches?: number; // "Expanding radius gets 3 more matches"
    }>;
  }>;

  // Market analysis
  supplyGapAnalysis: {
    // Which criteria are under-supplied
    underSupplied: Array<{
      dimension: string;            // "location" | "skill" | "rate" | "availability"
      value: string;                // "Berlin" | "Advanced Python" | "$50+/hr"
      availableSupply: number;      // How many humans match
      demand: number;               // How many agents searching for this
      supplyGapPercent: number;     // 0-100, scarcity score
    }>;

    // Which criteria are over-supplied
    overSupplied: Array<{
      dimension: string;
      value: string;
      availableSupply: number;
      supplyAbundancePercent: number;
    }>;

    // Recommended alternative (if original search returns <5 matches)
    recommendedAlternative?: {
      location?: string;
      skillSubstitute?: string;
      rateAdjustment?: number;
      explanation: string;
      estimatedMatches: number;
    };
  };

  // Geo context
  resolvedLocation?: {
    displayName: string;            // "Berlin, Germany"
    lat: number;
    lng: number;
    radius: number;
  };

  // Summary
  totalMatches: number;
  searchTimeMs: number;
  cacheHitRate?: number;            // For monitoring
}
```

**Example Request:**

```bash
curl -X POST https://api.humanpages.ai/api/agents/mcp/search-with-suggestions \
  -H "Authorization: Bearer eyJhbGc..." \
  -H "Content-Type: application/json" \
  -d '{
    "skillQuery": "Python machine learning",
    "location": "Berlin",
    "radius": 50,
    "minVouches": 0,
    "budgetUsdc": 5000,
    "projectDeadline": "2026-04-15",
    "requirementsOverTolerance": {
      "minRate": 10
    },
    "limit": 20
  }'
```

**Example Response (200 OK):**

```json
{
  "directMatches": [
    {
      "humanId": "h_123",
      "matchScore": 0.94,
      "trustScore": 0.87,
      "rateUsdc": 50,
      "vouchCount": 12,
      "completedJobsCount": 8,
      "workMode": "REMOTE",
      "timezone": "Europe/Berlin",
      "matchReasons": ["Expert in Python", "Machine learning background", "Based in Berlin"]
    }
  ],
  "alternativeMatches": [
    {
      "humanId": "h_456",
      "matchScore": 0.68,
      "trustScore": 0.75,
      "rateUsdc": 42,
      "unmetFilters": [
        {
          "filter": "location",
          "humanValue": "Paris",
          "requiredValue": "Berlin (50km)",
          "delta": "260km away"
        }
      ],
      "suggestedAdjustments": [
        {
          "action": "Increase radius to 250km",
          "confidence": 0.95
        }
      ]
    }
  ],
  "supplyGapAnalysis": {
    "underSupplied": [
      {
        "dimension": "skill",
        "value": "Advanced Python + ML",
        "availableSupply": 3,
        "supplyGapPercent": 92
      }
    ],
    "recommendedAlternative": {
      "location": "Prague",
      "rateAdjustment": -5,
      "estimatedMatches": 8
    }
  },
  "totalMatches": 127,
  "searchTimeMs": 284
}
```

---

### 1.2 `agent_browse_pre_built_services`

**Endpoint:** `GET /api/agents/mcp/services`

**Auth:** Agent JWT

**Rate Limit:** 100/min

**Query Params:**

```typescript
{
  category?: string;                // "data_labeling" | "writing" | "design" etc.
  skill?: string;                   // Free-text search
  minRating?: number;               // 0-5, default 0
  minVouches?: number;              // Minimum vouch count
  minCompletedJasks?: number;
  deliveryTimeHours?: number;       // Max delivery time
  maxPriceUsdc?: number;

  location?: string;
  lat?: number;
  lng?: number;
  radius?: number;

  sortBy?: "rating" | "price_low" | "price_high" | "delivery_fast" | "trust";
  limit?: number;                   // 10-100
  offset?: number;
}
```

**Response Schema:**

```typescript
{
  services: Array<{
    serviceId: string;
    humanId: string;
    title: string;
    description: string;
    category: string;
    subcategory?: string;

    pricing: {
      priceUsdc: number;
      currency: string;             // "USDC"
      rateType: "FLAT_TASK" | "HOURLY" | "PER_WORD" | "PER_PAGE";
      priceMin?: number;            // For negotiable rates
      priceMax?: number;
    };

    delivery: {
      deliveryTimeHours: number;
      revisionsIncluded: number;
      slaComplianceRate: number;    // 0-1, historical
      estimatedCompletionTime: string; // ISO 8601
    };

    // Human info (no PII)
    human: {
      humanId: string;
      displayName: string;          // "FirstName L."
      rating: number;               // 0-5
      reviewCount: number;
      vouchCount: number;
      verifications: Array<"email" | "id" | "linkedin" | "github">;
    };

    deliverable: {
      templateId?: string;          // Reference to schema
      format: string;               // "application/json" | "csv" etc.
    };

    orderCount: number;             // Historical orders of this service
    successRate: number;            // 0-1
    hirableNow: boolean;

    quickHireUrl: string;           // Convenience endpoint
  }>;

  totalCount: number;
}
```

---

## 2. JOB LIFECYCLE

### 2.1 `agent_create_job_with_stream`

**Endpoint:** `POST /api/agents/mcp/jobs/create-with-stream`

**Auth:** Agent JWT

**X-402 Payment Check:** Optional (on-chain payment verification)

**Rate Limit:** 30/day (STARTER), 5000/day (ENTERPRISE)

**Request Schema:**

```typescript
{
  humanId: string;                  // Required

  // Job metadata
  agentId?: string;                 // Auto-filled from JWT
  agentName?: string;
  title: string;                    // Max 200 chars
  description: string;              // Max 5000 chars
  category?: string;

  // Pricing
  budget: {
    priceUsdc: number;              // Total or hourly rate
    paymentMode: "ONE_TIME" | "STREAM";
    paymentTiming: "upfront" | "upon_completion";
    currency?: string;              // Default "USDC"
  };

  // Stream-specific (required if paymentMode=STREAM)
  streamConfig?: {
    method: "SUPERFLUID" | "MICRO_TRANSFER";
    rateUsdc?: number;              // Per hour
    interval?: "HOURLY" | "DAILY" | "WEEKLY";
    maxHours?: number;              // Hard cap on stream duration
    maxTicks?: number;              // Alternative: max number of intervals
    gracePeriodHours?: number;      // Grace period before stream pauses (default 1)
    minDeliveryIntervalHours?: number; // Force deliverable every N hours
  };

  // Deliverable spec (enables auto-validation)
  deliverableSpec?: {
    templateId?: string;            // Reference existing template
    format?: string;                // "application/json" | "csv" etc.
    schema?: object;                // JSON schema for validation (if not templateId)
    expectedCount?: number;         // Expected number of items
    maxTimeBetweenDeliveries?: number; // Seconds, for streaming work
  };

  // Webhook (for autonomous operation)
  webhookUrl?: string;              // HTTPS only
  webhookSecret?: string;           // Min 16 chars, used for HMAC-SHA256
  webhookEvents?: Array<
    "job.accepted" |
    "job.rejected" |
    "job.stream.started" |
    "job.stream.paused" |
    "job.stream.resumed" |
    "job.stream.stopped" |
    "job.deliverable.received" |
    "job.deliverable.approved" |
    "job.deliverable.rejected" |
    "job.revision.requested" |
    "job.revision.submitted" |
    "job.completed" |
    "job.disputed"
  >;

  // Optional filters (human-specified)
  filters?: {
    maxDistanceKm?: number;
    minCapacityHours?: number;
    requireVerification?: boolean;
    minCompletedJobs?: number;
  };

  // Metadata for agent use
  externalJobId?: string;           // Agent's own ID
  metadata?: Record<string, any>;

  // Location (for distance filtering)
  agentLat?: number;
  agentLng?: number;
}
```

**Response Schema:**

```typescript
{
  jobId: string;
  status: "PENDING_ACCEPTANCE" | "ACCEPTED" | "ACTIVE" | "COMPLETED" | "CANCELLED";

  // Streaming details
  stream?: {
    address: string;                // Superfluid stream address (0x...)
    flowRate: string;               // Flow rate in wei/second
    startBlock?: number;
    startTime?: string;             // ISO 8601
    endTime?: string;               // ISO 8601 (if ended)
    totalFlowed: string;            // Wei
    status: "CREATED" | "ACTIVE" | "PAUSED" | "ENDED";
  };

  // Payment details
  payment: {
    totalPriceUsdc: number;
    currency: string;
    paymentMode: string;
    paymentTiming: string;
    remainingBalance?: number;      // For streams
  };

  // Polling (if webhooks disabled)
  polling?: {
    enabled: boolean;
    webhookOnly?: boolean;
    nextPollUrl?: string;           // If webhookOnly=false
  };

  // Webhook registration
  webhook?: {
    url: string;
    events: string[];
    lastDelivery?: string;
    deliveryStatus?: "SUCCESS" | "FAILED" | "PENDING";
  };

  // Next steps for agent
  nextSteps: Array<{
    action: string;                 // "WAIT_FOR_ACCEPTANCE" | "VALIDATE_DELIVERABLE" etc.
    description: string;
    url?: string;                   // API endpoint for next action
  }>;

  // Metadata
  createdAt: string;                // ISO 8601
  acceptedAt?: string;
  startedAt?: string;

  // Links
  links: {
    selfUrl: string;
    webhookUrl?: string;
    pollUrl?: string;
    validateUrl?: string;           // For validating deliverables
  };
}
```

**Example Request:**

```bash
curl -X POST https://api.humanpages.ai/api/agents/mcp/jobs/create-with-stream \
  -H "Authorization: Bearer eyJhbGc..." \
  -H "Content-Type: application/json" \
  -d '{
    "humanId": "h_123",
    "title": "Data labeling - 80 images",
    "description": "Label 80 product images with bounding boxes",
    "budget": {
      "priceUsdc": 0,
      "paymentMode": "STREAM",
      "paymentTiming": "upon_completion"
    },
    "streamConfig": {
      "method": "SUPERFLUID",
      "rateUsdc": 15.0,
      "interval": "HOURLY",
      "maxHours": 10,
      "gracePeriodHours": 1
    },
    "deliverableSpec": {
      "format": "application/json",
      "schema": {
        "type": "object",
        "properties": {
          "imageId": { "type": "string" },
          "boxes": { "type": "array" }
        },
        "required": ["imageId", "boxes"]
      },
      "expectedCount": 80
    },
    "webhookUrl": "https://my-agent.ai/webhook/job-status",
    "webhookSecret": "sk_test_abc123def456",
    "webhookEvents": ["job.accepted", "job.deliverable.received"]
  }'
```

**Example Response (201 Created):**

```json
{
  "jobId": "job_7890",
  "status": "PENDING_ACCEPTANCE",
  "stream": {
    "address": "0x1234...5678",
    "flowRate": "4629629629",
    "status": "CREATED"
  },
  "payment": {
    "totalPriceUsdc": 0,
    "paymentMode": "STREAM",
    "remainingBalance": 150.0
  },
  "webhook": {
    "url": "https://my-agent.ai/webhook/job-status",
    "events": ["job.accepted", "job.deliverable.received"]
  },
  "nextSteps": [
    {
      "action": "WAIT_FOR_ACCEPTANCE",
      "description": "Human must accept job to start stream"
    }
  ],
  "createdAt": "2026-03-29T10:15:00Z",
  "links": {
    "selfUrl": "/api/agents/mcp/jobs/job_7890",
    "validateUrl": "/api/agents/mcp/jobs/job_7890/validate-deliverable"
  }
}
```

---

### 2.2 `agent_validate_deliverable`

**Endpoint:** `POST /api/agents/mcp/jobs/{jobId}/validate-deliverable`

**Auth:** Agent JWT

**Rate Limit:** 1000/day

**Request Schema:**

```typescript
{
  deliverableId?: string;           // Required if multiple pending

  validationRules: Array<{
    type: "json_schema" | "custom_script" | "sample_audit";

    // For json_schema type
    schema?: object;                // JSON schema to validate against
    strictMode?: boolean;           // Fail on extra properties (default false)

    // For custom_script type
    url?: string;                   // Agent's validation endpoint
    timeout?: number;               // Seconds, max 60
    headers?: Record<string, string>;
    onFailure?: "REQUEST_REVISION" | "REJECT";

    // For sample_audit type
    sampleSize?: number;            // Number of items to audit
    humanReviewRequired?: boolean;  // Pause stream, page human
  }>;

  // Auto-approve if all validations pass
  autoApproveIfValid: boolean;

  // Optional: webhook callback for validation results
  resultWebhookUrl?: string;
}
```

**Response Schema:**

```typescript
{
  deliverableId: string;

  validationResults: {
    json_schema?: {
      valid: boolean;
      errors?: Array<{
        path: string;               // "$.labels[0].score"
        message: string;
      }>;
    };

    custom_script?: {
      valid: boolean;
      httpStatus?: number;
      responseTime?: number;
      details?: object;             // Custom response from agent's validator
    };

    sample_audit?: {
      valid: boolean;
      sampleResults: Array<any>;    // Items that were audited
      auditUrl?: string;            // For human review
    };
  };

  overallValid: boolean;
  action: "APPROVED" | "REJECTED" | "REQUEST_REVISION" | "PENDING_HUMAN_REVIEW";

  // Stream tick details
  streamTicked?: boolean;
  hoursAdvanced?: number;          // How many hours to advance stream
  nextPaymentTime?: string;        // ISO 8601

  // Metadata
  validatedAt: string;
  nextRevisionDeadline?: string;   // ISO 8601, if requesting revision
}
```

**Example Request:**

```bash
curl -X POST https://api.humanpages.ai/api/agents/mcp/jobs/job_123/validate-deliverable \
  -H "Authorization: Bearer eyJhbGc..." \
  -H "Content-Type: application/json" \
  -d '{
    "deliverableId": "del_456",
    "validationRules": [
      {
        "type": "json_schema",
        "schema": {
          "type": "object",
          "properties": {
            "imageId": { "type": "string" },
            "boxes": { "type": "array", "minItems": 1 }
          },
          "required": ["imageId", "boxes"]
        },
        "strictMode": false
      },
      {
        "type": "custom_script",
        "url": "https://my-validator.ai/validate",
        "timeout": 30,
        "onFailure": "REQUEST_REVISION"
      }
    ],
    "autoApproveIfValid": true
  }'
```

**Example Response (200 OK):**

```json
{
  "deliverableId": "del_456",
  "validationResults": {
    "json_schema": {
      "valid": true
    },
    "custom_script": {
      "valid": true,
      "httpStatus": 200,
      "responseTime": 2500,
      "details": {
        "duplicateCount": 0,
        "avgConfidence": 0.94,
        "qualityScore": 0.91
      }
    }
  },
  "overallValid": true,
  "action": "APPROVED",
  "streamTicked": true,
  "hoursAdvanced": 8,
  "nextPaymentTime": "2026-03-30T14:00:00Z",
  "validatedAt": "2026-03-29T14:00:00Z"
}
```

---

### 2.3 `agent_bulk_job_operations`

**Endpoint:** `POST /api/agents/mcp/jobs/bulk-create`

**Auth:** Agent JWT

**Rate Limit:** 100 operations/day (one operation can create 1-1000 jobs)

**Request Schema:**

```typescript
{
  jobs: Array<{
    humanId: string;
    agentId?: string;
    agentName?: string;
    title: string;
    description: string;
    category?: string;

    // Inline budget
    budget: {
      priceUsdc: number;
      paymentMode?: "ONE_TIME" | "STREAM";
      paymentTiming?: "upfront" | "upon_completion";
    };

    // Optional: stream config (if paymentMode=STREAM)
    streamConfig?: object;          // Same as agent_create_job_with_stream

    // Deliverable spec
    deliverableSpec?: object;

    // Metadata
    externalJobId?: string;
    metadata?: object;
  }>;

  // Shared webhook (all jobs in batch use this)
  webhookUrl?: string;
  webhookSecret?: string;
  webhookEvents?: string[];

  // Concurrency control
  parallelism?: number;             // 1-100, default 10

  // Retry logic
  retryFailedMatchesFrom?: "supplyGapAnalysis"; // Use search alternatives

  // Idempotency
  idempotencyKey?: string;          // UUID, for retries
}
```

**Response Schema:**

```typescript
{
  batchId: string;
  status: "QUEUED" | "IN_PROGRESS" | "COMPLETED" | "FAILED";

  // Results
  jobsCreated: number;
  jobsFailed: number;
  totalJobs: number;

  failedDetails: Array<{
    index: number;                  // Which job in the array
    humanId: string;
    reason: string;                 // "Rate too low" | "Location mismatch" | "Human not found"
    suggestedAlternative?: {
      humanId: string;
      matchScore: number;
    };
  }>;

  successfulJobIds: string[];

  // Webhook info
  webhookUrl?: string;
  webhookStatus?: "REGISTERED" | "FAILED";

  // Links
  links: {
    selfUrl: string;
    retryUrl?: string;              // If failures occurred
    statusUrl: string;              // Poll for completion
    resultsUrl: string;             // Download all job IDs
  };

  // Timestamps
  createdAt: string;
  completedAt?: string;
}
```

**Example Request:**

```bash
curl -X POST https://api.humanpages.ai/api/agents/mcp/jobs/bulk-create \
  -H "Authorization: Bearer eyJhbGc..." \
  -H "Content-Type: application/json" \
  -d '{
    "jobs": [
      {
        "humanId": "h_123",
        "title": "Photo 1 - NYC grocery prices",
        "description": "Visit Whole Foods...",
        "budget": { "priceUsdc": 25, "paymentTiming": "upon_completion" },
        "deliverableSpec": {
          "format": "application/json",
          "schema": { "type": "object" }
        }
      },
      {
        "humanId": "h_124",
        "title": "Photo 2 - LA grocery prices",
        "description": "Visit Whole Foods...",
        "budget": { "priceUsdc": 25 }
      }
    ],
    "webhookUrl": "https://my-agent.ai/webhook/bulk",
    "webhookSecret": "sk_test_...",
    "parallelism": 10
  }'
```

**Example Response (202 Accepted):**

```json
{
  "batchId": "batch_abc123",
  "status": "IN_PROGRESS",
  "jobsCreated": 87,
  "jobsFailed": 13,
  "totalJobs": 100,
  "failedDetails": [
    {
      "index": 0,
      "humanId": "h_999",
      "reason": "Human not found",
      "suggestedAlternative": { "humanId": "h_1000", "matchScore": 0.89 }
    }
  ],
  "links": {
    "statusUrl": "/api/agents/mcp/jobs/batch/batch_abc123/status",
    "resultsUrl": "/api/agents/mcp/jobs/batch/batch_abc123/results"
  },
  "createdAt": "2026-03-29T10:15:00Z"
}
```

---

### 2.4 `agent_quick_hire_service`

**Endpoint:** `POST /api/agents/mcp/services/{serviceId}/quick-hire`

**Auth:** Agent JWT

**Rate Limit:** 100/day

**Request Schema:**

```typescript
{
  quantity?: number;                // Default 1
  rushDelivery?: boolean;           // Add premium
  paymentTiming?: "upfront" | "upon_completion";
  callbackUrl?: string;
}
```

**Response Schema:**

```typescript
{
  jobId: string;
  serviceId: string;
  humanId: string;

  pricing: {
    basePrice: number;
    rushPremium?: number;
    totalPrice: number;
    currency: string;
  };

  estimatedCompletionTime: string;  // ISO 8601
  status: "PENDING_ACCEPTANCE";

  // Next steps
  links: {
    pollUrl: string;
    webhookUrl?: string;
  };
}
```

---

## 3. QUALITY & VALIDATION

### 3.1 `agent_define_deliverable_template`

**Endpoint:** `POST /api/agents/mcp/deliverable-templates`

**Auth:** Agent JWT

**Request Schema:**

```typescript
{
  name: string;                     // "Product Image Labeling v2"
  description?: string;

  schema: object;                   // JSON schema

  validationRules: Array<{
    type: "schema" | "custom";
    url?: string;                   // For custom type
    timeout?: number;               // Seconds
    strictMode?: boolean;
  }>;

  qualityMetrics?: Array<{
    name: string;                   // "iouScore"
    description?: string;
    threshold?: number;             // 0-1
    failureMode?: "REQUEST_REVISION" | "REJECT";
  }>;

  // Limits
  maxItems?: number;
  minItems?: number;
  maxTimeBetweenDeliveries?: number;

  isPublic?: boolean;               // Share with other agents
}
```

**Response Schema:**

```typescript
{
  templateId: string;
  agentId: string;
  createdAt: string;
  updatedAt?: string;
}
```

---

### 3.2 `agent_get_deliverable_history_with_quality`

**Endpoint:** `GET /api/agents/mcp/humans/{humanId}/deliverable-history`

**Auth:** Agent JWT

**Query Params:**

```typescript
{
  templateId?: string;
  jobId?: string;
  status?: "APPROVED" | "REJECTED" | "REVISION_REQUESTED";
  limit?: number;
  offset?: number;
}
```

**Response Schema:**

```typescript
{
  human: {
    humanId: string;
    displayName: string;
  };

  deliverables: Array<{
    deliverableId: string;
    jobId: string;
    status: string;
    submittedAt: string;
    approvedAt?: string;

    qualityScores: Record<string, number | boolean>;
    overallQuality: number;        // 0-1

    revisionsRequested: number;
    revisionsSubmitted: number;
  }>;

  aggregateStats: {
    avgQuality: number;
    approvalRate: number;
    revisionRate: number;
    totalDeliverables: number;
    qualityTrend: "improving" | "stable" | "declining";

    // Time-series
    last30DaysApprovalRate?: number;
    last90DaysApprovalRate?: number;
  };
}
```

---

## 4. TRUST & SAFETY

### 4.1 `agent_analyze_human_fraud_risk`

**Endpoint:** `POST /api/agents/mcp/humans/{humanId}/fraud-risk-assessment`

**Auth:** Agent JWT

**Request Schema:**

```typescript
{
  includeJobHistory?: boolean;      // Default true
  includeDeliverableQuality?: boolean; // Default true
  analysisDepth?: "quick" | "detailed"; // Default "quick"
}
```

**Response Schema:**

```typescript
{
  humanId: string;
  overallFraudRisk: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  fraudRiskScore: number;           // 0-1, >0.5 = HIGH
  trustScore: number;               // 1 - fraudRiskScore

  riskFactors: Array<{
    category: string;               // "rating_velocity" | "job_value_escalation" | etc.
    signal: string;                 // Human-readable signal
    risk: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
    explanation: string;

    metadata?: {
      percentile?: number;          // How unusual is this (0-100)
      historicalNorm?: string;
      anomalousValue?: any;
    };
  }>;

  recommendations: string[];        // Actions agent should take

  // Contextual data
  profile: {
    profileAge: number;             // Days
    verifications: string[];
    completeness: number;           // 0-100
  };

  jobHistory: {
    totalJobs: number;
    avgJobValue: number;
    jobValueTrend: "increasing" | "stable" | "decreasing";
    latestJobValue: number;
    valueEscalation?: {
      isSudden: boolean;
      factor: number;               // Latest / median
    };
  };

  ratingHistory: {
    totalRatings: number;
    avgRating: number;
    ratingVelocity: number;         // Per day
    recentVelocity: number;         // Last 7 days
    percentFiveStars: number;
  };

  generatedAt: string;
  validUntil: string;               // When this assessment expires (24h)
}
```

**Example Request:**

```bash
curl -X POST https://api.humanpages.ai/api/agents/mcp/humans/h_123/fraud-risk-assessment \
  -H "Authorization: Bearer eyJhbGc..." \
  -H "Content-Type: application/json" \
  -d '{
    "analysisDepth": "detailed"
  }'
```

**Example Response (200 OK):**

```json
{
  "humanId": "h_123",
  "overallFraudRisk": "MEDIUM",
  "fraudRiskScore": 0.42,
  "trustScore": 0.58,
  "riskFactors": [
    {
      "category": "rating_velocity",
      "signal": "Received 50 five-star ratings in 3 days (top 0.5%)",
      "risk": "MEDIUM",
      "explanation": "Unusual speed, but diverse job types and agents",
      "metadata": { "percentile": 99.5 }
    },
    {
      "category": "job_value_escalation",
      "signal": "Jobs: $20 → $20 → $20 → $5,000 (250x spike)",
      "risk": "HIGH",
      "explanation": "Classic scam pattern: proof with small jobs, then big ask",
      "metadata": { "factor": 250 }
    }
  ],
  "recommendations": [
    "Safe for jobs up to $500 in UPON_COMPLETION mode",
    "For $5,000+, require deliverable validation or escrow",
    "Consider milestone payments (50% + 50%)"
  ],
  "trustScore": 0.58,
  "generatedAt": "2026-03-29T10:15:00Z",
  "validUntil": "2026-03-30T10:15:00Z"
}
```

---

### 4.2 `agent_require_payment_guarantee`

**Endpoint:** `POST /api/agents/mcp/jobs/{jobId}/set-payment-guarantee`

**Auth:** Agent JWT

**Request Schema:**

```typescript
{
  guaranteeType: "MILESTONE" | "SMART_CONTRACT" | "ESCROW";

  // For MILESTONE
  milestones?: Array<{
    percentage: number;             // 0-100
    triggerOnDeliverableApproval?: string; // Deliverable name/index
    triggerOnTimeDelay?: number;    // Seconds
  }>;

  // For SMART_CONTRACT
  escrowAddress?: string;           // 0x...
  releaseCondition?: string;        // "deliverable_approved" | "time_delay"

  // General
  totalAmount?: number;             // USDC
  network?: string;                 // "eip155:8453" (Base)
}
```

**Response Schema:**

```typescript
{
  jobId: string;
  guaranteeType: string;
  status: "CONFIGURED" | "FUNDED" | "RELEASED_PARTIAL" | "RELEASED_FULL" | "REFUNDED";

  // If SMART_CONTRACT
  smartContract?: {
    address: string;
    transactionHash: string;
    network: string;
    amountLocked: number;
    releaseCondition: string;
  };

  milestonePlan?: Array<{
    index: number;
    percentage: number;
    status: "PENDING" | "RELEASED";
    releaseAmount: number;
    releasedAt?: string;
  }>;
}
```

---

## 5. RATE LIMITS & BILLING

### 5.1 `agent_request_unlimited_tier`

**Endpoint:** `POST /api/agents/mcp/auth/request-unlimited-tier`

**Auth:** Agent JWT

**Request Schema:**

```typescript
{
  agentId: string;
  tier: "STARTER" | "PROFESSIONAL" | "ENTERPRISE";
  expectedJobsPerDay?: number;
  onboardingToken?: string;         // From OAuth
}
```

**Response Schema:**

```typescript
{
  agentId: string;
  rateLimitTier: string;

  limits: {
    jobsPerDay: number;
    searchesPerMinute: number;
    bulkOperationsPerDay: number;
    concurrentStreams: number;
  };

  billingModel: "free" | "subscription" | "per_transaction";

  pricing?: {
    monthlyFee?: number;
    transactionFee?: number;        // Per job created
    estimatedMonthlyCost?: number;
  };

  stripeCustomerId?: string;
  subscriptionStatus?: string;

  effectiveAt: string;
}
```

---

## 6. WEBHOOK SCHEMA

All webhooks are POST requests with:

**Headers:**

```
Content-Type: application/json
X-HumanPages-Signature: sha256=<HMAC-SHA256(body, webhook_secret)>
X-HumanPages-Timestamp: <ISO 8601>
X-HumanPages-Delivery-Id: <UUID>
```

**Body (all events):**

```typescript
{
  event: string;                    // "job.accepted", "job.deliverable.received", etc.
  jobId: string;
  humanId: string;
  agentId: string;

  timestamp: string;                // ISO 8601
  deliveryId: string;               // UUID for idempotency

  data: object;                     // Event-specific data

  retry: {
    attempt: number;
    maxAttempts: number;
  };
}
```

**Example: job.accepted**

```json
{
  "event": "job.accepted",
  "jobId": "job_123",
  "humanId": "h_456",
  "agentId": "agent_789",
  "timestamp": "2026-03-29T10:15:00Z",
  "deliveryId": "del_abc123",
  "data": {
    "acceptedAt": "2026-03-29T10:15:00Z",
    "estimatedCompletionTime": "2026-03-30T18:00:00Z"
  }
}
```

**Example: job.deliverable.received**

```json
{
  "event": "job.deliverable.received",
  "jobId": "job_123",
  "humanId": "h_456",
  "agentId": "agent_789",
  "timestamp": "2026-03-29T14:00:00Z",
  "data": {
    "deliverableId": "del_001",
    "deliverableUrl": "https://api.humanpages.ai/deliverables/del_001?signed=true",
    "format": "application/json"
  }
}
```

---

## Error Codes

| Code | Message | Solution |
|------|---------|----------|
| 400 | Invalid request schema | Check JSON structure |
| 401 | Unauthorized | Verify JWT token |
| 402 | Payment required (X-402) | No valid payment method |
| 403 | Rate limit exceeded | Upgrade subscription tier |
| 404 | Resource not found | Check ID |
| 422 | Validation failed | Check constraints (min/max rates, etc.) |
| 500 | Internal server error | Retry with exponential backoff |

---

## Rate Limiting Headers

All responses include:

```
X-RateLimit-Limit: 30
X-RateLimit-Remaining: 17
X-RateLimit-Reset: 2026-03-29T11:00:00Z
X-RateLimit-Tier: PROFESSIONAL
```

---

## Idempotency

For any mutating operation (POST, PATCH), include:

```
Idempotency-Key: <UUID>
```

The server will cache the response for 24 hours. Retry with same key to get cached response.

---

## Rate Limit Tiers

| Tier | Cost | Jobs/Day | Searches/Min | Bulk Ops/Day | Concurrent Streams |
|------|------|----------|--------------|--------------|-------------------|
| STARTER | Free | 50 | 30 | 1 | 5 |
| PROFESSIONAL | $199/mo | 500 | 500 | 10 | 50 |
| ENTERPRISE | Custom | 5000+ | 1000+ | 100+ | 100+ |

Plus transaction fee (if applicable): $0.02 per job created.

