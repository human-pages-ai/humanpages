# Detailed API Specifications for New Features

This document provides complete OpenAPI-style specifications for all new endpoints, organized by feature.

---

## Feature 1: Escrow + Dispute Resolution

### POST /api/jobs/:jobId/escrow/fund
**Description:** Agent deposits funds into escrow for a job.
**Auth:** Agent (via X-Agent-Key header)
**Status Code:** 201 Created

**Request Body:**
```json
{
  "priceUsdc": 500,
  "paymentTxHash": "0x1a2b3c4d5e6f7g8h9i0j",
  "paymentNetwork": "base"
}
```

**Response (201):**
```json
{
  "escrowId": "escrow_abc123",
  "status": "FUNDED",
  "fundedAt": "2026-03-29T15:30:00Z",
  "reviewDeadlineAt": "2026-03-31T15:30:00Z",
  "expectedDisbursement": 500,
  "disbursementAddress": "0x1234567890abcdef..."
}
```

**Errors:**
- 404: Job not found
- 400: Job not in PENDING status
- 400: Payment verification failed
- 402: Insufficient funds in agent wallet (if agent-custodied)

**Webhook Emitted:**
```json
{
  "type": "ESCROW_FUNDED",
  "jobId": "job_xyz",
  "escrowId": "escrow_abc123",
  "amountUsdc": 500,
  "fundedAt": "2026-03-29T15:30:00Z"
}
```

---

### POST /api/jobs/:jobId/escrow/submit-work
**Description:** Human submits work for review. Starts 48h approval window.
**Auth:** Human (JWT)
**Status Code:** 200 OK

**Request Body:**
```json
{
  "submissionNote": "Photos uploaded to Google Drive. Link: https://drive.google.com/...",
  "evidenceUrls": [
    "https://drive.google.com/...",
    "https://example.com/receipt.png"
  ]
}
```

**Response (200):**
```json
{
  "jobId": "job_xyz",
  "escrowId": "escrow_abc123",
  "status": "SUBMITTED",
  "submittedAt": "2026-03-29T16:00:00Z",
  "reviewDeadlineAt": "2026-03-31T16:00:00Z",
  "reviewWindowHours": 48
}
```

**Errors:**
- 404: Job not found
- 403: Human doesn't own job
- 400: Escrow not in FUNDED status
- 400: Job already submitted

**Webhook Emitted:**
```json
{
  "type": "ESCROW_SUBMITTED",
  "jobId": "job_xyz",
  "submittedAt": "2026-03-29T16:00:00Z",
  "reviewDeadlineAt": "2026-03-31T16:00:00Z"
}
```

**Notifications:**
- Email to agent: "Work submitted for [Job Title]. Review deadline: [datetime]"
- Telegram (if subscribed): Similar

---

### POST /api/jobs/:jobId/escrow/approve
**Description:** Agent approves work and releases escrow funds to human.
**Auth:** Agent
**Status Code:** 200 OK

**Request Body:**
```json
{}
```

**Response (200):**
```json
{
  "jobId": "job_xyz",
  "escrowId": "escrow_abc123",
  "status": "APPROVED",
  "approvedAt": "2026-03-29T17:00:00Z",
  "disbursementTx": "0xabc123...",
  "disbursementAmount": 500,
  "disbursementNetwork": "base"
}
```

**Errors:**
- 404: Job not found
- 403: Agent doesn't own job
- 400: Escrow not in SUBMITTED status
- 410: Review deadline exceeded (auto-moves to TIMED_OUT)
- 503: Blockchain error (can retry)

**Webhook Emitted:**
```json
{
  "type": "ESCROW_APPROVED",
  "jobId": "job_xyz",
  "disbursementAmount": 500,
  "disbursementTx": "0xabc123...",
  "approvedAt": "2026-03-29T17:00:00Z"
}
```

**Side Effects:**
- Update Job.status = COMPLETED
- Update Job.completedAt = now
- Emit webhook: JOB_COMPLETED
- Notify human: "Payment released! [amount] USDC sent to [wallet]"

---

### POST /api/jobs/:jobId/escrow/dispute
**Description:** Agent disputes work quality. Triggers escalation to admin.
**Auth:** Agent
**Status Code:** 200 OK

**Request Body:**
```json
{
  "reason": "low_quality",
  "note": "Photos are blurry and out of focus. Not usable.",
  "evidenceUrls": [
    "https://example.com/unacceptable_photo_1.png",
    "https://example.com/unacceptable_photo_2.png"
  ]
}
```

**Response (200):**
```json
{
  "jobId": "job_xyz",
  "escrowId": "escrow_abc123",
  "status": "DISPUTED",
  "disputedAt": "2026-03-29T17:30:00Z",
  "supportTicketId": "ticket_def456",
  "escalationPriority": "high",
  "expectedResolutionTime": "24-48 hours"
}
```

**Errors:**
- 404: Job not found
- 403: Agent doesn't own job
- 400: Escrow not in SUBMITTED status
- 410: Review deadline exceeded

**Webhook Emitted:**
```json
{
  "type": "ESCROW_DISPUTED",
  "jobId": "job_xyz",
  "supportTicketId": "ticket_def456",
  "disputeReason": "low_quality",
  "disputeNote": "Photos are blurry...",
  "disputedAt": "2026-03-29T17:30:00Z"
}
```

**Notifications:**
- Email to human: "Your work on [Job] has been disputed. Reason: [reason]. Support will contact you within 24h."
- Telegram to admin: "New dispute on job_xyz. Agent: [name]. Reason: [reason]"

---

### PUT /api/jobs/:jobId/escrow/resolve
**Description:** Admin resolves dispute. Splits funds or awards to one party.
**Auth:** Admin (role=ADMIN)
**Status Code:** 200 OK

**Request Body:**
```json
{
  "result": "approved_partial",
  "humanShare": 300,
  "agentShare": 200,
  "burnAmount": 0,
  "reasoning": "Work was 60% acceptable. Human gets 60%, agent refunded 40%."
}
```

**Response (200):**
```json
{
  "jobId": "job_xyz",
  "escrowId": "escrow_abc123",
  "status": "RESOLVED",
  "resolvedAt": "2026-03-30T10:00:00Z",
  "humanDisbursement": 300,
  "agentRefund": 200,
  "burnAmount": 0,
  "humanTx": "0xhuman...",
  "agentTx": "0xagent..."
}
```

**Errors:**
- 403: Not admin
- 400: Escrow not in DISPUTED status
- 400: humanShare + agentShare + burnAmount != totalAmount
- 503: Blockchain error

**Webhook Emitted:**
```json
{
  "type": "ESCROW_RESOLVED",
  "jobId": "job_xyz",
  "result": "approved_partial",
  "humanShare": 300,
  "agentShare": 200,
  "resolvedAt": "2026-03-30T10:00:00Z"
}
```

**Notifications:**
- Email to both: "Your dispute on [Job] has been resolved. [Amount] released."

---

## Feature 2: Pre-Hire Verification

### POST /api/humans/:humanId/portfolio
**Description:** Upload portfolio item (photo, video, certificate, etc.)
**Auth:** Human
**Status Code:** 201 Created

**Request Body:**
```json
{
  "type": "PHOTO",
  "title": "Drone Photography - Golden Gate Bridge",
  "description": "Professional aerial photography of SF landmarks",
  "url": "https://example.com/portfolio/photo_123.jpg",
  "metadata": {
    "fileSize": 2500000,
    "duration": null,
    "resolution": "4096x2160"
  }
}
```

**Response (201):**
```json
{
  "portfolioId": "port_xyz789",
  "humanId": "human_456",
  "type": "PHOTO",
  "title": "Drone Photography - Golden Gate Bridge",
  "url": "https://example.com/portfolio/photo_123.jpg",
  "thumbnailUrl": "https://cdn.humanpages.io/portfolios/human_456/port_xyz789_thumb.webp",
  "verifiedStatus": "pending",
  "createdAt": "2026-03-29T15:30:00Z"
}
```

**Errors:**
- 404: Human not found
- 403: User doesn't own human profile
- 413: File too large (>50MB)
- 400: Invalid type

---

### POST /api/humans/:humanId/verify-identity
**Description:** Initiate identity verification via Midata or Stripe.
**Auth:** Human
**Status Code:** 200 OK

**Request Body:**
```json
{
  "provider": "midata"
}
```

**Response (200):**
```json
{
  "verificationId": "verify_abc123",
  "humanId": "human_456",
  "provider": "midata",
  "status": "pending",
  "verificationUrl": "https://midata.io/verify?code=abc123&redirect=https://humanpages.io/verify-callback?id=verify_abc123",
  "expiresAt": "2026-04-05T15:30:00Z",
  "nextSteps": "Click the link above and follow Midata's verification process. Returns to HumanPages automatically."
}
```

**Errors:**
- 404: Human not found
- 403: User doesn't own profile
- 409: Already verified (status = VERIFIED)
- 503: Provider API error

---

### POST /api/webhooks/identity-verification
**Description:** Receive identity verification callback from Midata.
**Auth:** Provider API key (in header)
**Status Code:** 204 No Content

**Request Body:**
```json
{
  "verificationId": "verify_abc123",
  "humanId": "human_456",
  "provider": "midata",
  "status": "verified",
  "idType": "passport",
  "country": "NG",
  "dateOfBirth": "1985-04-15",
  "firstName": "John",
  "lastName": "Doe",
  "backgroundCheck": {
    "passed": true,
    "flags": []
  }
}
```

**Response (204):**
```
[Empty body]
```

**Side Effects:**
- Update IdentityVerification.status = VERIFIED
- Update Human.isIdVerified = true
- Update Human.backgroundCheckPassed = true
- Recompute Human.profileCompleteness
- Emit webhook: HUMAN_IDENTITY_VERIFIED

---

### GET /api/humans/search (updated)
**Description:** Search humans with optional verification filters.
**Auth:** Agent or public (rate-limited)
**Status Code:** 200 OK

**Query Params:**
```
GET /api/humans/search?skill=photography&location=San+Francisco&minVerificationLevel=identity&sortBy=quality&limit=20&offset=0
```

- `skill` (string): required skill tag
- `location` (string): city or region
- `minVerificationLevel` (enum): none, portfolio, identity, background
- `sortBy` (enum): relevance, quality, newest, rating
- `limit` (integer): max 100, default 20
- `offset` (integer): pagination

**Response (200):**
```json
{
  "humans": [
    {
      "id": "human_456",
      "name": "John D.",
      "username": "@johndoe",
      "bio": "Professional photographer, 10+ years...",
      "location": "San Francisco, CA",
      "skills": ["photography", "product", "video"],
      "rateUsdc": 150,
      "rateType": "HOURLY",
      "rating": 4.8,
      "ratingCount": 24,
      "qualityScore": 87,
      "isVerified": true,
      "verificationLevel": "identity",
      "portfolioCount": 12,
      "backgroundCheckPassed": true,
      "profilePhoto": "https://cdn.humanpages.io/photos/human_456/photo.webp"
    }
  ],
  "totalCount": 145,
  "facets": {
    "verificationLevel": { "identity": 45, "portfolio": 89, "none": 11 },
    "rating": { "4.5+": 120, "4.0+": 135, "all": 145 }
  }
}
```

**Errors:**
- 400: Invalid minVerificationLevel enum
- 429: Rate limit exceeded

---

## Feature 3: Agent Reputation

### POST /api/jobs/:jobId/rate-agent
**Description:** Human rates agent after job completion.
**Auth:** Human
**Status Code:** 201 Created

**Request Body:**
```json
{
  "rating": 4,
  "comment": "Great communication, but payment took 3 days.",
  "clarity": 5,
  "professionalism": 4,
  "paymentSpeed": 3,
  "fairPrice": 4
}
```

**Response (201):**
```json
{
  "ratingId": "rating_xyz789",
  "jobId": "job_123",
  "agentId": "agent_abc",
  "rating": 4,
  "comment": "Great communication, but payment took 3 days.",
  "dimensions": {
    "clarity": 5,
    "professionalism": 4,
    "paymentSpeed": 3,
    "fairPrice": 4
  },
  "createdAt": "2026-03-29T18:00:00Z"
}
```

**Errors:**
- 404: Job not found
- 403: Human doesn't own job
- 400: Job has no agent (free-form agentId)
- 409: Already rated this job
- 400: rating not between 1-5

**Webhook Emitted:**
```json
{
  "type": "AGENT_RATED",
  "jobId": "job_123",
  "agentId": "agent_abc",
  "rating": 4,
  "ratingId": "rating_xyz789"
}
```

**Side Effects:**
- Aggregate Agent.avgRating (recomputed when 5+ new ratings)
- Agent receives email: "You received a 4-star review from [Human]"

---

### GET /api/agents/:agentId
**Description:** Get public agent reputation profile.
**Auth:** Public
**Status Code:** 200 OK

**Response (200):**
```json
{
  "agentId": "agent_abc",
  "name": "ResearchBot v2",
  "email": "api@researchbot.io",
  "totalJobsPosted": 120,
  "completedJobs": 108,
  "ratingCount": 95,
  "avgRating": 4.6,
  "isVerified": true,
  "ratingBreakdown": {
    "clarity": 4.7,
    "professionalism": 4.8,
    "paymentSpeed": 4.4,
    "fairPrice": 4.5
  },
  "ratingDistribution": {
    "5": 65,
    "4": 20,
    "3": 8,
    "2": 2,
    "1": 0
  },
  "recentRatings": [
    {
      "rating": 5,
      "comment": "Excellent to work with.",
      "humanName": "Sarah M.",
      "createdAt": "2026-03-28T10:00:00Z"
    }
  ]
}
```

**Errors:**
- 404: Agent not found (or private)

---

### POST /api/humans/:humanId/block-agent
**Description:** Block an agent from sending job offers.
**Auth:** Human
**Status Code:** 201 Created

**Request Body:**
```json
{
  "agentId": "agent_abc",
  "reason": "unprofessional"
}
```

**Response (201):**
```json
{
  "blockId": "block_xyz",
  "humanId": "human_456",
  "blockedAgentId": "agent_abc",
  "reason": "unprofessional",
  "blockedAt": "2026-03-29T18:30:00Z"
}
```

**Errors:**
- 404: Agent not found
- 409: Already blocked

**Side Effects:**
- Future job offers from agent_abc auto-rejected
- Agent receives notification: "[Human] has blocked you"

---

## Feature 4: Human Job Browsing

### POST /api/listings
**Description:** Agent posts job listing where humans can apply.
**Auth:** Agent
**Status Code:** 201 Created

**Request Body:**
```json
{
  "title": "Product Photography - 50 items",
  "description": "Need professional product photography for e-commerce website. White background, 3 angles per item. Studio setup provided.",
  "skills": ["photography", "product", "ecommerce"],
  "minPrice": 200,
  "maxPrice": 500,
  "priceUnit": "FLAT_TASK",
  "deadline": "2026-04-10T00:00:00Z",
  "location": "San Francisco, CA",
  "radius": 50,
  "remote": false,
  "maxApplications": 100,
  "isBulk": false,
  "targetCount": null,
  "screeningQuestions": [
    "What's your portfolio link?",
    "How many years of product photography experience?"
  ]
}
```

**Response (201):**
```json
{
  "listingId": "list_abc123",
  "agentId": "agent_xyz",
  "url": "https://humanpages.io/listings/list_abc123",
  "title": "Product Photography - 50 items",
  "createdAt": "2026-03-29T15:30:00Z",
  "applicationCount": 0,
  "viewCount": 0,
  "status": "ACTIVE",
  "deadline": "2026-04-10T00:00:00Z"
}
```

**Errors:**
- 400: Invalid priceUnit
- 400: minPrice > maxPrice
- 400: deadline in past

**Webhook Emitted:**
```json
{
  "type": "LISTING_CREATED",
  "listingId": "list_abc123",
  "agentId": "agent_xyz",
  "title": "Product Photography - 50 items",
  "createdAt": "2026-03-29T15:30:00Z"
}
```

---

### GET /api/listings
**Description:** Browse open job listings.
**Auth:** Public
**Status Code:** 200 OK

**Query Params:**
```
GET /api/listings?skill=photography&location=San+Francisco&minPrice=100&maxPrice=1000&sortBy=closingSoon&limit=20&offset=0
```

**Response (200):**
```json
{
  "listings": [
    {
      "listingId": "list_abc123",
      "agentId": "agent_xyz",
      "agentName": "ResearchBot",
      "agentRating": 4.6,
      "title": "Product Photography - 50 items",
      "description": "Need professional product photography...",
      "skills": ["photography", "product"],
      "minPrice": 200,
      "maxPrice": 500,
      "location": "San Francisco, CA",
      "radius": 50,
      "deadline": "2026-04-10T00:00:00Z",
      "applicationCount": 23,
      "viewCount": 312,
      "createdAt": "2026-03-29T15:30:00Z"
    }
  ],
  "totalCount": 145,
  "facets": {
    "skills": { "photography": 45, "video": 32, "product": 28 },
    "priceRange": { "100-500": 60, "500-1000": 45, "1000+": 40 }
  }
}
```

---

### POST /api/listings/:listingId/apply
**Description:** Human applies to job listing.
**Auth:** Human
**Status Code:** 201 Created

**Request Body:**
```json
{
  "coverLetter": "I have 8 years of product photography experience. I've worked with brands like...",
  "proposedPrice": 250,
  "portfolioItems": ["port_xyz", "port_123"],
  "screeningAnswers": {
    "q1": "Portfolio: https://example.com/portfolio",
    "q2": "8+ years, mainly e-commerce and fashion brands"
  }
}
```

**Response (201):**
```json
{
  "applicationId": "app_def456",
  "listingId": "list_abc123",
  "humanId": "human_456",
  "status": "SUBMITTED",
  "coverLetter": "I have 8 years of product photography...",
  "proposedPrice": 250,
  "createdAt": "2026-03-29T16:00:00Z"
}
```

**Errors:**
- 404: Listing not found
- 400: Listing closed
- 409: Already applied to this listing
- 400: proposedPrice below minPrice

**Webhook Emitted:**
```json
{
  "type": "APPLICATION_SUBMITTED",
  "listingId": "list_abc123",
  "applicationId": "app_def456",
  "humanName": "John D."
}
```

**Side Effects:**
- Increment Listing.applicationCount
- Agent receives email: "New application from [Human] on [Listing]"

---

### PATCH /api/listings/:listingId/applications/:appId
**Description:** Agent accepts or rejects application.
**Auth:** Agent
**Status Code:** 200 OK

**Request Body:**
```json
{
  "action": "accept",
  "note": "Perfect! Let's start this weekend. Studio location: [address]"
}
```

**Response (200):**
```json
{
  "applicationId": "app_def456",
  "status": "ACCEPTED",
  "jobId": "job_new123",
  "acceptedAt": "2026-03-29T16:30:00Z",
  "note": "Perfect! Let's start this weekend..."
}
```

**Errors:**
- 404: Application not found
- 403: Agent doesn't own listing
- 400: action not in [accept, reject]
- 400: Already responded to application
- 400: Listing maxApplications reached (if accept)

**Webhook Emitted (if accept):**
```json
{
  "type": "APPLICATION_ACCEPTED",
  "applicationId": "app_def456",
  "listingId": "list_abc123",
  "jobId": "job_new123"
}
```

**Side Effects (if accept):**
- Create Job record from Listing + Application
- Set Job.title, description, priceUsdc, category, etc. from Listing/Application
- Increment Listing.acceptedCount
- If acceptedCount == targetCount: set Listing.status = CLOSED
- Send email to human: "Your application was accepted! Job created: [jobId]"
- Send email to agent: "Application accepted! Job created: [jobId]"

---

## Feature 5: Webhooks + Async API

### POST /api/webhooks/subscribe
**Description:** Agent registers webhook endpoint for real-time notifications.
**Auth:** Agent
**Status Code:** 201 Created

**Request Body:**
```json
{
  "url": "https://myagent.io/webhooks/humanpages",
  "secret": "whsec_abc123xyz789",
  "eventTypes": [
    "JOB_ACCEPTED",
    "JOB_WORK_SUBMITTED",
    "JOB_COMPLETED",
    "ESCROW_APPROVED",
    "APPLICATION_ACCEPTED"
  ]
}
```

**Response (201):**
```json
{
  "subscriptionId": "sub_abc123",
  "agentId": "agent_xyz",
  "url": "https://myagent.io/webhooks/humanpages",
  "eventTypes": ["JOB_ACCEPTED", "JOB_WORK_SUBMITTED", ...],
  "isActive": true,
  "createdAt": "2026-03-29T15:30:00Z",
  "testEventId": "evt_test_abc123"
}
```

**Test Event Sent:**
Agent receives a POST to their URL with:
```json
{
  "id": "evt_test_abc123",
  "type": "TEST",
  "timestamp": "2026-03-29T15:30:00Z",
  "data": { "message": "Test event from HumanPages" }
}
```

**Errors:**
- 400: Invalid URL format
- 400: secret too short (<16 chars)
- 503: Test event delivery failed (endpoint unreachable)
- 409: Webhook already subscribed to this URL

---

### GET /api/webhooks/subscriptions
**Description:** List agent's webhook subscriptions.
**Auth:** Agent
**Status Code:** 200 OK

**Response (200):**
```json
{
  "subscriptions": [
    {
      "subscriptionId": "sub_abc123",
      "url": "https://myagent.io/webhooks/humanpages",
      "eventTypes": ["JOB_ACCEPTED", "JOB_COMPLETED"],
      "isActive": true,
      "lastDeliveredAt": "2026-03-29T15:45:00Z",
      "failureCount": 0,
      "createdAt": "2026-03-29T15:30:00Z"
    }
  ]
}
```

---

### GET /api/webhooks/deliveries/:subscriptionId
**Description:** View webhook delivery history for a subscription.
**Auth:** Agent
**Status Code:** 200 OK

**Query Params:**
```
GET /api/webhooks/deliveries/sub_abc123?status=failed&limit=50&offset=0
```

**Response (200):**
```json
{
  "deliveries": [
    {
      "deliveryId": "deliv_xyz789",
      "subscriptionId": "sub_abc123",
      "eventType": "JOB_ACCEPTED",
      "status": "SUCCESS",
      "httpStatus": 200,
      "attemptCount": 1,
      "deliveredAt": "2026-03-29T15:45:00Z"
    },
    {
      "deliveryId": "deliv_abc123",
      "subscriptionId": "sub_abc123",
      "eventType": "JOB_COMPLETED",
      "status": "FAILED",
      "httpStatus": 500,
      "responseBody": "Internal server error",
      "attemptCount": 3,
      "nextRetryAt": "2026-03-29T16:35:00Z"
    }
  ],
  "totalCount": 147
}
```

---

### POST /api/webhooks/retry/:deliveryId
**Description:** Manually retry failed webhook delivery.
**Auth:** Agent
**Status Code:** 200 OK

**Request Body:**
```json
{}
```

**Response (200):**
```json
{
  "deliveryId": "deliv_abc123",
  "status": "PENDING",
  "nextRetryAt": "2026-03-29T16:15:00Z",
  "message": "Retry queued. Will attempt delivery in 5 seconds."
}
```

---

### Webhook Payload Specifications

**General Structure:**
```json
{
  "id": "evt_abc123xyz789",
  "type": "JOB_ACCEPTED",
  "timestamp": "2026-03-29T15:45:00Z",
  "data": { ... }
}
```

**Header:**
```
X-HumanPages-Signature: sha256=<HMAC-SHA256(secret, JSON.stringify(event))>
```

**Example Payloads:**

**JOB_ACCEPTED:**
```json
{
  "id": "evt_abc123",
  "type": "JOB_ACCEPTED",
  "timestamp": "2026-03-29T15:45:00Z",
  "data": {
    "jobId": "job_xyz",
    "humanId": "human_456",
    "agentId": "agent_abc",
    "title": "Photography",
    "priceUsdc": 500,
    "acceptedAt": "2026-03-29T15:45:00Z"
  }
}
```

**JOB_WORK_SUBMITTED:**
```json
{
  "id": "evt_def456",
  "type": "JOB_WORK_SUBMITTED",
  "timestamp": "2026-03-29T16:00:00Z",
  "data": {
    "jobId": "job_xyz",
    "humanId": "human_456",
    "submittedAt": "2026-03-29T16:00:00Z",
    "submissionNote": "Photos uploaded to Google Drive...",
    "reviewDeadlineAt": "2026-03-31T16:00:00Z"
  }
}
```

**ESCROW_APPROVED:**
```json
{
  "id": "evt_ghi789",
  "type": "ESCROW_APPROVED",
  "timestamp": "2026-03-29T17:00:00Z",
  "data": {
    "jobId": "job_xyz",
    "escrowId": "escrow_abc",
    "disbursementAmount": 500,
    "disbursementTx": "0xabc123...",
    "approvedAt": "2026-03-29T17:00:00Z"
  }
}
```

---

## Feature 6: Quality Scoring Algorithm

### GET /api/humans/search (updated)
**New Query Params:**
```
GET /api/humans/search?sortBy=quality&minQuality=70
```

- `sortBy`: relevance | quality | newest | rating (default: relevance)
- `minQuality`: 0-100 (only return humans with qualityScore >= minQuality)

**Updated Response:**
```json
{
  "humans": [
    {
      "id": "human_456",
      "name": "John D.",
      ...
      "qualityScore": 87,
      "completionRate": 0.95,
      "avgRating": 4.8,
      "totalJobs": 25,
      "avgResponseMinutes": 120
    }
  ]
}
```

---

### GET /api/admin/quality-scores
**Description:** View quality score statistics and rankings.
**Auth:** Admin
**Status Code:** 200 OK

**Response (200):**
```json
{
  "topHumans": [
    {
      "humanId": "human_456",
      "name": "John D.",
      "qualityScore": 92,
      "breakdown": {
        "completionRate": 0.98,
        "responseTimeScore": 85,
        "ratingConsistency": 95,
        "reliabilityScore": 92
      },
      "stats": {
        "completedJobs": 45,
        "cancelledJobs": 1,
        "disputedJobs": 0,
        "avgRating": 4.9,
        "ratingCount": 43,
        "avgResponseMinutes": 90
      }
    }
  ],
  "statistics": {
    "meanQualityScore": 62.3,
    "medianQualityScore": 58,
    "stdDev": 18.5,
    "percentile90": 85.2,
    "humansAbove70": 245,
    "humansAbove80": 98
  }
}
```

---

### POST /api/admin/recalculate-quality
**Description:** Manually trigger quality score recalculation.
**Auth:** Admin
**Status Code:** 202 Accepted

**Request Body:**
```json
{
  "humanIdFilter": null
}
```

**Response (202):**
```json
{
  "jobId": "job_recalc_abc123",
  "status": "STARTED",
  "startedAt": "2026-03-29T15:30:00Z",
  "estimatedDurationSeconds": 120,
  "message": "Quality score recalculation started. Check back in ~2 minutes."
}
```

---

## Feature 7: Wallet On-ramp + Off-ramp

### GET /api/humans/:humanId/onramp/coinbase-pay
**Description:** Get Coinbase Pay redirect URL for wallet funding.
**Auth:** Human
**Status Code:** 200 OK

**Query Params:**
```
GET /api/humans/:humanId/onramp/coinbase-pay?amountUsd=50
```

**Response (200):**
```json
{
  "redirectUrl": "https://pay.coinbase.com/v3/?sessionId=abc123xyz789",
  "sessionId": "session_coinbase_abc123",
  "amountUsd": 50,
  "expiresAt": "2026-03-29T16:30:00Z"
}
```

**User Flow:**
1. Human clicks "Top up wallet"
2. Redirected to Coinbase Pay
3. Completes payment in Coinbase app
4. Redirected back to HumanPages
5. USDC lands in wallet within seconds
6. Webhook notifies backend

---

### POST /api/humans/:humanId/offramp/setup
**Description:** Set up bank account for USD withdrawals.
**Auth:** Human
**Status Code:** 201 Created

**Request Body:**
```json
{
  "provider": "wise",
  "bankCountry": "NG",
  "bankAccountNumber": "0123456789",
  "bankRoutingNumber": "011000015",
  "bankHolder": "John Doe"
}
```

**Response (201):**
```json
{
  "offRampAccountId": "offramp_xyz789",
  "humanId": "human_456",
  "provider": "wise",
  "status": "pending_kyc",
  "bankCountry": "NG",
  "bankHolder": "John Doe",
  "kycStatus": "pending",
  "nextSteps": "Check your email for Wise KYC link. Verification takes 5-10 minutes."
}
```

**Errors:**
- 400: Invalid country code
- 409: Account already exists for this provider
- 503: Wise API error

---

### POST /api/humans/:humanId/offramp/withdraw
**Description:** Withdraw USDC from wallet to bank account.
**Auth:** Human
**Status Code:** 201 Created

**Request Body:**
```json
{
  "amountUsdc": 250,
  "offRampAccountId": "offramp_xyz789"
}
```

**Response (201):**
```json
{
  "withdrawalId": "withdraw_abc123",
  "humanId": "human_456",
  "amountUsdc": 250,
  "estimatedAmountFiat": 405,
  "fiatCurrency": "NGN",
  "exchangeRate": 1620.5,
  "fee": 3.5,
  "status": "pending",
  "txHash": "0x1a2b3c4d5e6f7g8h9i0j",
  "completedBy": "2026-04-05T15:30:00Z",
  "nextSteps": "Funds will arrive in your bank account within 2-3 business days."
}
```

**Errors:**
- 404: Human not found
- 404: OffRamp account not found
- 400: Account KYC not verified
- 400: amountUsdc > wallet balance
- 400: amountUsdc < minimum (e.g., $10)
- 503: Blockchain error (retry)

**Webhook Emitted:**
```json
{
  "type": "OFFRAMP_INITIATED",
  "withdrawalId": "withdraw_abc123",
  "amountUsdc": 250,
  "initiatedAt": "2026-03-29T15:30:00Z"
}
```

---

### GET /api/humans/:humanId/payment-readiness
**Description:** Check if human is ready to receive payment.
**Auth:** Public (agent query)
**Status Code:** 200 OK

**Response (200):**
```json
{
  "humanId": "human_456",
  "walletAddress": "0x1234567890abcdef...",
  "walletNetwork": "base",
  "hasFundedWallet": true,
  "acceptsPayment": true,
  "preferredPaymentMethod": "USDC_DIRECT",
  "offRampConfigured": true,
  "readinessScore": 95
}
```

---

## Feature 8: Bulk Job Posting

### POST /api/listings (updated)
**New Fields:**
```json
{
  "isBulk": true,
  "targetCount": 5,
  "pricePerUnit": 100,
  "totalBudget": 500
}
```

**Response (201):**
```json
{
  "listingId": "list_bulk_abc123",
  "isBulk": true,
  "targetCount": 5,
  "totalBudget": 500,
  "acceptedCount": 0,
  "maxApplications": 100
}
```

---

## Feature 9: Supply Analysis Dashboard

### GET /api/admin/supply-analysis
**Description:** Analyze supply depth and identify gaps.
**Auth:** Admin
**Status Code:** 200 OK

**Query Params:**
```
GET /api/admin/supply-analysis?period=30d
```

**Response (200):**
```json
{
  "period": "30d",
  "totalHumans": 1500,
  "activeHumans": 800,
  "activeThisMonth": 620,
  "newThisMonth": 42,

  "skillGaps": [
    {
      "skill": "drone_operator",
      "supply": 3,
      "demand": 45,
      "gapScore": 1400,
      "acceptanceRate": 0.4
    },
    {
      "skill": "photographer",
      "supply": 120,
      "demand": 200,
      "gapScore": 66.7,
      "acceptanceRate": 0.75
    }
  ],

  "locationGaps": [
    {
      "location": "Lagos, NG",
      "supply": 5,
      "demand": 50,
      "gapScore": 900,
      "avgRating": 4.2
    },
    {
      "location": "San Francisco, CA",
      "supply": 180,
      "demand": 200,
      "gapScore": 11.1,
      "avgRating": 4.7
    }
  ],

  "growthMetrics": {
    "newHumansLastWeek": 12,
    "completedJobsLastWeek": 120,
    "totalUsdcTransacted": 35000,
    "avgJobValue": 290,
    "jobCompletionRate": 0.92,
    "disputeRate": 0.015
  }
}
```

---

## Feature 10: Availability Calendar

### POST /api/humans/:humanId/availability
**Description:** Create availability slot (recurring or one-off).
**Auth:** Human
**Status Code:** 201 Created

**Request Body:**
```json
{
  "recurring": true,
  "dayOfWeek": 1,
  "startTime": "09:00",
  "endTime": "17:00",
  "capacityHours": 8,
  "timezone": "America/New_York",
  "tags": ["remote", "flexible"]
}
```

**Response (201):**
```json
{
  "slotId": "slot_xyz789",
  "humanId": "human_456",
  "recurring": true,
  "dayOfWeek": 1,
  "startTime": "09:00",
  "endTime": "17:00",
  "timezone": "America/New_York",
  "status": "ACTIVE",
  "createdAt": "2026-03-29T15:30:00Z"
}
```

---

### GET /api/humans/availability-search
**Description:** Find humans available at specific date/time.
**Auth:** Agent
**Status Code:** 200 OK

**Query Params:**
```
GET /api/humans/availability-search?date=2026-04-01&startTime=14:00&endTime=16:00&skill=photography&location=SF
```

**Response (200):**
```json
{
  "availableHumans": [
    {
      "humanId": "human_456",
      "name": "John D.",
      "skills": ["photography", "product"],
      "availability": {
        "slotId": "slot_xyz",
        "startTime": "14:00",
        "endTime": "16:00",
        "capacityHours": 2
      },
      "qualityScore": 87,
      "avgRating": 4.8,
      "rateUsdc": 150
    }
  ],
  "totalCount": 8
}
```

---

### POST /api/jobs/:jobId/schedule
**Description:** Schedule a job for specific date/time.
**Auth:** Agent
**Status Code:** 200 OK

**Request Body:**
```json
{
  "scheduledStartAt": "2026-04-01T14:00:00Z",
  "scheduledEndAt": "2026-04-01T16:00:00Z",
  "notes": "Please confirm this time works for you."
}
```

**Response (200):**
```json
{
  "jobId": "job_xyz",
  "scheduledStartAt": "2026-04-01T14:00:00Z",
  "scheduledEndAt": "2026-04-01T16:00:00Z",
  "notes": "Please confirm this time works for you.",
  "status": "PENDING_CONFIRMATION"
}
```

---

## Feature 11: AI-Generated Job Descriptions

### POST /api/jobs/:jobId/refine-description
**Description:** Generate job description using Claude.
**Auth:** Agent
**Status Code:** 200 OK

**Request Body:**
```json
{
  "skill": "photography",
  "budget": 500,
  "context": "E-commerce product shots",
  "anythingElse": "Need white background, 3 angles per item, 50 items total"
}
```

**Response (200):**
```json
{
  "jobId": "job_xyz",
  "aiGeneratedDescription": "We are looking for a professional photographer to capture high-quality product images for our e-commerce website. This project involves photographing 50 items with the following requirements:\n\n- White background photography\n- 3 different angles per item\n- Professional lighting and composition\n- Clean, ready-to-publish images\n\nThe photographer should have experience with product photography and e-commerce imagery. All equipment will be provided, and the studio setup is ready for use.",
  "estimatedDuration": "8-12 hours",
  "clarityScore": 92,
  "suggestions": "Consider specifying: resolution, file format, delivery timeline"
}
```

**Errors:**
- 400: Invalid skill

---

### POST /api/jobs/:jobId/clarity-check
**Description:** Ask clarification question before accepting job.
**Auth:** Human
**Status Code:** 201 Created

**Request Body:**
```json
{
  "question": "What format should the final images be in? JPEG, PNG, or WebP?"
}
```

**Response (201):**
```json
{
  "messageId": "msg_abc123",
  "jobId": "job_xyz",
  "senderType": "human",
  "content": "What format should the final images be in?",
  "createdAt": "2026-03-29T16:00:00Z"
}
```

**Notifications:**
- Agent receives email: "Clarification question on [Job]"

---

## Feature 12: Agent Verification

### POST /api/agents/register
**Description:** Register agent with Coinbase AgentKit for verified status.
**Auth:** Agent (via X-Agent-Key)
**Status Code:** 201 Created

**Request Body:**
```json
{
  "coinbaseAgentId": "agent_123_abc",
  "agentName": "ResearchBot v2",
  "email": "api@researchbot.io"
}
```

**Response (201):**
```json
{
  "agentId": "agent_xyz789",
  "verificationStatus": "VERIFIED",
  "coinbaseAgentId": "agent_123_abc",
  "verifiedAt": "2026-03-29T15:30:00Z",
  "rateLimitTier": "VERIFIED",
  "offersPerDay": 1000,
  "badge": "Verified Agent"
}
```

**Errors:**
- 400: Invalid Coinbase agent credentials
- 409: Already verified

**Webhook Emitted:**
```json
{
  "type": "AGENT_VERIFIED",
  "agentId": "agent_xyz789",
  "verifiedAt": "2026-03-29T15:30:00Z"
}
```

---

**End of API Specifications**

All endpoints follow consistent patterns:
- Error responses use 4xx/5xx status codes with `{ error, statusCode, details }` body
- All timestamps are ISO 8601 UTC
- All IDs are prefixed with resource type (e.g., `job_`, `human_`, `agent_`)
- Pagination: `limit` (default 20, max 100) and `offset` (default 0)
- All endpoints support optional `include` param for nested resource expansion

