# Technical Implementation Checklist

## Phase 1A: Escrow + Verification (Weeks 1-4)

### Feature 1: Escrow + Dispute Resolution (2 weeks)

#### Prisma Schema
- [ ] Add EscrowStatus enum (NOT_REQUIRED, PENDING_FUNDING, FUNDED, SUBMITTED, APPROVED, DISPUTED, BURNED, REFUNDED)
- [ ] Create Escrow model with all fields per spec
- [ ] Add escrowId to Job model
- [ ] Add Human relation: `escrowsAsHuman`
- [ ] Create migration: `prisma migrate dev --name add_escrow`
- [ ] Update profile-schema.json with new fields

#### Backend Routes (`backend/src/routes/escrow.ts`)
- [ ] POST /api/jobs/:jobId/escrow/fund
  - [ ] Validate job exists & status is PENDING
  - [ ] Verify USDC payment on-chain (reuse verifyUsdcPayment())
  - [ ] Create Escrow record with status=FUNDED
  - [ ] Emit webhook: job.escrow.funded
  - [ ] Return { escrowId, reviewDeadlineAt, expectedDisbursement }
- [ ] POST /api/jobs/:jobId/escrow/submit-work
  - [ ] Validate human ownership of job
  - [ ] Update Escrow.status=SUBMITTED
  - [ ] Calculate reviewDeadlineAt = now + 48h
  - [ ] Notify agent (email + webhook)
  - [ ] Return { reviewDeadlineAt }
- [ ] POST /api/jobs/:jobId/escrow/approve
  - [ ] Validate agent ownership
  - [ ] Check 48h window not exceeded
  - [ ] Release funds to human's wallet (Privy wallet API)
  - [ ] Update Escrow.status=APPROVED
  - [ ] Emit webhook: job.escrow.released
  - [ ] Return { disbursementTx, amount }
- [ ] POST /api/jobs/:jobId/escrow/dispute
  - [ ] Validate agent ownership
  - [ ] Update Escrow.status=DISPUTED
  - [ ] Notify human + admin
  - [ ] Emit webhook: job.escrow.disputed
  - [ ] Return { supportTicketId }
- [ ] PUT /api/jobs/:jobId/escrow/resolve
  - [ ] Admin-only auth
  - [ ] Validate dispute status
  - [ ] Split or award funds
  - [ ] Release via Privy
  - [ ] Emit webhook: job.escrow.resolved

#### Wallet Integration (Privy)
- [ ] Review Privy wallet API docs
- [ ] Implement transferFunds() function in `backend/src/lib/blockchain/index.ts`
- [ ] Handle network selection (Base preferred for low fees)
- [ ] Test with testnet transactions
- [ ] Add retry logic for failed releases

#### Notifications
- [ ] Email templates: escrow_funded, escrow_submitted, escrow_approved, escrow_disputed
- [ ] Telegram messages (reuse existing flow)
- [ ] Webhook payloads for all events

#### MCP Tools
- [ ] Add CreateAction: create_job_with_escrow
  - [ ] Schema: { humanId, agentId, title, description, priceUsdc, ... }
  - [ ] Implementation: calls POST /api/jobs + POST /api/jobs/:jobId/escrow/fund
- [ ] Add CreateAction: escrow_approve
  - [ ] Schema: { jobId }
- [ ] Add CreateAction: escrow_dispute
  - [ ] Schema: { jobId, reason, note }

#### Testing
- [ ] Unit tests: escrow status transitions
- [ ] Integration tests: fund → submit → approve flow
- [ ] Integration tests: dispute flow
- [ ] E2E test: full escrow lifecycle
- [ ] Test timeout handling (48h deadline)

#### Admin Dashboard
- [ ] Add Escrow section to admin panel
- [ ] List pending disputes
- [ ] Manual dispute resolution UI (split slider)
- [ ] Audit log for all escrow actions

---

### Feature 2: Pre-Hire Verification (2 weeks)

#### Prisma Schema
- [ ] Create PortfolioItem model (type, title, url, metadata, verifiedAt)
- [ ] Create IdentityVerification model (provider, status, idType, country, backgroundCheck, riskLevel)
- [ ] Add to Human: `portfolioItems`, `identityVerification`, `isIdVerified`, `backgroundCheckPassed`
- [ ] Migration: `prisma migrate dev --name add_verification`
- [ ] Update profile-schema.json

#### Backend Routes (`backend/src/routes/verification.ts`)
- [ ] POST /api/humans/:humanId/portfolio
  - [ ] Validate human ownership
  - [ ] Store portfolio metadata
  - [ ] Generate R2 thumbnail if URL is image
  - [ ] Return { portfolioId, verifiedStatus: "pending" }
- [ ] POST /api/humans/:humanId/verify-identity
  - [ ] Create IdentityVerification record
  - [ ] Call Midata API (or Stripe Connect)
  - [ ] Return { verificationUrl, expiresAt }
- [ ] POST /api/webhooks/identity-verification
  - [ ] Midata/Stripe webhook handler
  - [ ] Update IdentityVerification record
  - [ ] Set Human.isIdVerified = true
  - [ ] Trigger search re-ranking
  - [ ] Emit webhook: human.identity_verified
- [ ] GET /api/humans/search (updated)
  - [ ] Add query param: minVerificationLevel (portfolio, identity, background)
  - [ ] Add response fields: verificationLevel, portfolioCount, backgroundCheckPassed
  - [ ] Rank verified humans higher in results

#### Midata/Stripe Integration
- [ ] Sign up for Midata API (or Stripe Connect)
- [ ] Implement in `backend/src/lib/verification/`
- [ ] Handle callback webhooks
- [ ] Store provider response securely (encrypt idNumber, DOB)
- [ ] Implement expiration logic (some checks expire)

#### R2 Storage
- [ ] Bucket: `humanpages-portfolios/`
- [ ] Path: `{humanId}/{portfolioItemId}.{ext}`
- [ ] Implement thumbnail generation (Cloudflare Image)
- [ ] CORS headers for embedding

#### MCP Tools
- [ ] Add CreateAction: view_human_portfolio
  - [ ] Schema: { humanId }
  - [ ] Return portfolio items + verification status
- [ ] Add CreateAction: request_identity_verification
  - [ ] Schema: { humanId }
  - [ ] Return verification link
- [ ] Add CreateAction: search_humans_verified
  - [ ] Schema: { skill, location, minVerificationLevel }
  - [ ] Return only verified humans

#### Testing
- [ ] Mock Midata API calls
- [ ] Test webhook callback handling
- [ ] Test portfolio thumbnail generation
- [ ] Test search ranking with verified/unverified humans
- [ ] E2E: full verification flow

---

## Phase 1B: Ratings + Listings (Weeks 3-4)

### Feature 3: Agent Reputation + Reverse Ratings (1.5 weeks)

#### Prisma Schema
- [ ] Create Agent model (agentPublicId, agentName, email, avgRating, ratingCount, totalJobsPosted, completedJobs, status, abuseScore)
- [ ] Create AgentRating model (jobId, agentId, rating, clarity, professionalism, paymentSpeed, fairPrice, agentResponse)
- [ ] Create AgentBlocking model (humanId, blockedAgentId)
- [ ] Add to Human: `agentRatingsGiven`, `blockedAgents`
- [ ] Add to Job: `registeredAgentId` (FK to Agent)
- [ ] Migration: `prisma migrate dev --name add_agent_ratings`

#### Backend Routes (`backend/src/routes/agents.ts`)
- [ ] POST /api/jobs/:jobId/rate-agent
  - [ ] Validate human ownership
  - [ ] Create AgentRating record
  - [ ] Update Agent.avgRating, ratingCount
  - [ ] Emit webhook: agent.rated
  - [ ] Return { ratingId, agentRating }
- [ ] GET /api/agents/:agentId (view public rating)
  - [ ] Return agent profile: { name, avgRating, ratingCount, recentRatings, breakdown }
- [ ] POST /api/humans/:humanId/block-agent
  - [ ] Create AgentBlocking record
  - [ ] Notify system (agent can see they're blocked)
  - [ ] Return { blockedAgentId }
- [ ] GET /api/humans/search (updated)
  - [ ] Add query param: excludeAgentId (filter out blocked agents)

#### Agent Rating Aggregation
- [ ] Nightly job: compute Agent.avgRating (simple mean)
- [ ] Compute rating breakdown: avg clarity, professionalism, paymentSpeed, fairPrice
- [ ] Flag high-variance agents (inconsistent ratings)

#### MCP Tools
- [ ] Add CreateAction: leave_agent_review
  - [ ] Schema: { jobId, rating, comment, clarity, professionalism, paymentSpeed, fairPrice }
- [ ] Add CreateAction: view_agent_reputation
  - [ ] Schema: { agentId }
- [ ] Add CreateAction: block_agent
  - [ ] Schema: { agentId, reason }

#### Testing
- [ ] Test rating aggregation
- [ ] Test blocking logic (future offers rejected)
- [ ] Test search filtering with blocked agents

---

### Feature 4: Human Job Browsing + Listings (2.5 weeks)

#### Prisma Schema
- [ ] Create Listing model (agentId, title, description, skills, minPrice, maxPrice, priceUnit, location, deadline, maxApplications, status, applicationCount)
- [ ] Create ListingApplication model (listingId, humanId, coverLetter, proposedPrice, portfolioItems, status, rejectedAt, acceptedJobId)
- [ ] Update Job: add listingApplicationId
- [ ] Migration: `prisma migrate dev --name add_listings`

#### Backend Routes (`backend/src/routes/listings.ts`)
- [ ] POST /api/listings
  - [ ] Validate agent authentication
  - [ ] Create Listing record
  - [ ] Publish to feed
  - [ ] Emit webhook: listing.created
  - [ ] Return { listingId, url }
- [ ] GET /api/listings (public)
  - [ ] Filter: skill, location, radius, minPrice, maxPrice, sortBy (latest|mostApplications|closingSoon)
  - [ ] Return paginated listings + facets
- [ ] GET /api/listings/:listingId (public)
  - [ ] Return full listing
  - [ ] If human authenticated: show their application status
  - [ ] If agent owns: show all applications
- [ ] POST /api/listings/:listingId/apply
  - [ ] Validate human authentication
  - [ ] Create ListingApplication
  - [ ] Notify agent
  - [ ] Return { applicationId, status: "SUBMITTED" }
- [ ] PATCH /api/listings/:listingId/applications/:appId (Agent-only)
  - [ ] If action=accept: create Job from Listing + Application
  - [ ] If action=reject: set rejectedAt, rejectionReason
  - [ ] Emit webhook: application.accepted or application.rejected
- [ ] GET /api/humans/:humanId/applications (Human-only)
  - [ ] Return all applications user submitted
  - [ ] Count by status

#### Search Integration
- [ ] Add Listing to search results (alongside jobs)
- [ ] Rank listings by: closing date, application count, agent rating
- [ ] Show "X humans have applied" for social proof

#### Notifications
- [ ] Agent receives email: "New application from [Human]"
- [ ] Human receives: "Your application for [Listing] was accepted! Job created: [jobId]"

#### MCP Tools
- [ ] Add CreateAction: post_job_listing
  - [ ] Schema: { title, description, skills, minPrice, maxPrice, location, deadline, ... }
- [ ] Add CreateAction: browse_job_listings
  - [ ] Schema: { skill, location, radius, minPrice, maxPrice, sortBy }
- [ ] Add CreateAction: view_listing_applications
  - [ ] Schema: { listingId }
  - [ ] Agent-only, returns applications with portfolios
- [ ] Add CreateAction: accept_application
  - [ ] Schema: { listingId, applicationId }

#### Testing
- [ ] Test listing creation and publication
- [ ] Test application submission
- [ ] Test acceptance → Job creation
- [ ] E2E: post listing → human applies → agent accepts → job created

---

## Phase 2A: Webhooks + Quality (Weeks 5-6)

### Feature 5: Webhooks + Async API (1.5 weeks)

#### Prisma Schema
- [ ] Create WebhookSubscription model (agentId, url, secret, eventTypes, isActive, retryCount, lastDeliveredAt)
- [ ] Create WebhookDelivery model (subscriptionId, eventType, status, httpStatus, responseBody, attemptCount, nextRetryAt)
- [ ] Create WebhookEvent model (eventType, agentId, jobId, listingId, payload)
- [ ] Migration: `prisma migrate dev --name add_webhooks`

#### Queue System
- [ ] If using Redis: implement queue for webhook deliveries
- [ ] If using PgBoss: no additional setup
- [ ] Implement retry logic: 5s, 25s, 125s delays
- [ ] Track delivery attempts in WebhookDelivery

#### Backend Routes (`backend/src/routes/webhooks.ts`)
- [ ] POST /api/webhooks/subscribe
  - [ ] Create WebhookSubscription
  - [ ] Send test event to verify endpoint works
  - [ ] Return { subscriptionId, testEventId }
- [ ] GET /api/webhooks/subscriptions
  - [ ] List all subscriptions for agent
  - [ ] Include delivery history
  - [ ] Return { subscriptions: [...] }
- [ ] DELETE /api/webhooks/subscriptions/:subscriptionId
  - [ ] Soft delete (isActive = false)
  - [ ] Return { subscriptionId }
- [ ] GET /api/webhooks/deliveries/:subscriptionId
  - [ ] Filter by status (success, failed)
  - [ ] Return { deliveries: [...], totalCount }
- [ ] POST /api/webhooks/retry/:deliveryId
  - [ ] Manually retry failed delivery
  - [ ] Return { status }

#### Event Generation
- [ ] Job status changes → emit WebhookEvent
  - [ ] JOB_ACCEPTED (when human accepts)
  - [ ] JOB_WORK_SUBMITTED (when human submits work)
  - [ ] JOB_COMPLETED (when agent approves escrow)
  - [ ] JOB_DISPUTED (when agent disputes)
  - [ ] JOB_CANCELLED, JOB_REJECTED, JOB_UPDATED
- [ ] Escrow status changes → emit WebhookEvent
  - [ ] ESCROW_FUNDED, ESCROW_SUBMITTED, ESCROW_APPROVED, ESCROW_DISPUTED, ESCROW_RESOLVED
- [ ] Listing status changes → emit WebhookEvent
  - [ ] APPLICATION_SUBMITTED, APPLICATION_ACCEPTED, APPLICATION_REJECTED, LISTING_CLOSED
- [ ] Agent rating → emit WebhookEvent
  - [ ] AGENT_RATED

#### Webhook Delivery Logic
- [ ] When WebhookEvent created:
  - [ ] Find subscriptions matching agent + eventType
  - [ ] Create WebhookDelivery records with status=PENDING
  - [ ] Queue for immediate delivery
- [ ] Delivery worker:
  - [ ] POST payload to subscription URL
  - [ ] Include X-HumanPages-Signature header (HMAC-SHA256)
  - [ ] If success (2xx): mark DONE
  - [ ] If failure: increment attemptCount, schedule retry
  - [ ] After 3 failures: mark FAILED, email agent
- [ ] Signature validation (for agents):
  - [ ] Compute: sha256 = HMAC-SHA256(secret, JSON.stringify(event))
  - [ ] Compare: signature_header == sha256
  - [ ] Reject if mismatch

#### MCP Tools
- [ ] Add CreateAction: subscribe_to_webhooks
  - [ ] Schema: { url, secret, eventTypes }
- [ ] Add CreateAction: get_webhook_deliveries
  - [ ] Schema: { subscriptionId, status }

#### Testing
- [ ] Mock webhook delivery (spy on HTTP calls)
- [ ] Test signature generation and validation
- [ ] Test retry backoff timing
- [ ] Test event filtering (agent X only sees their events)
- [ ] E2E: create webhook → job status change → webhook delivered → verified

---

### Feature 6: Quality Scoring Algorithm (1 week)

#### Scoring Formula
```
QualityScore (0-100) =
  (completion_rate * 40%) +
  (response_time_score * 20%) +
  (rating_consistency * 20%) +
  (reliability_score * 20%)
```

#### Data Model
- [ ] Add to Human: qualityScore (0-100), qualityScoreUpdatedAt, completedJobs, cancelledJobs, disputedJobs, avgResponseMinutes, ratingStdDev

#### Batch Job
- [ ] Create `backend/src/scripts/compute-quality-scores.ts`
- [ ] Run nightly (cron job)
- [ ] For each human with 5+ jobs:
  - [ ] Calculate completion_rate = completed / (completed + cancelled + disputed)
  - [ ] Calculate response_time_score = 100 - (avgResponseMinutes / 1440 * 100)
  - [ ] Calculate rating_consistency = (stdDev < 1.0) ? 100 : 100 - (stdDev * 20)
  - [ ] Calculate reliability_score = (100 - disputeRate * 50 - cancelRate * 30)
  - [ ] Compute weighted sum
  - [ ] Update Human.qualityScore + qualityScoreUpdatedAt
- [ ] Create index: @@index([qualityScore])

#### Search Integration
- [ ] GET /api/humans/search
  - [ ] Add param: sortBy=quality (in addition to relevance, newest)
  - [ ] Add param: minQuality=70 (filter by quality threshold)
  - [ ] Return qualityScore in response
- [ ] Default sort: hybrid (relevance * 0.5 + qualityScore * 0.5)

#### API Endpoint (Admin)
- [ ] GET /api/admin/quality-scores
  - [ ] Return top 100 humans by quality score
  - [ ] Show score breakdown: completion%, response_time, consistency, reliability
- [ ] POST /api/admin/recalculate-quality
  - [ ] Trigger batch job on-demand
  - [ ] Return { startedAt, estimatedDurationSeconds }

#### Testing
- [ ] Unit test: scoring formula with edge cases
- [ ] Integration test: quality score persists after batch job
- [ ] Test search ranking by quality
- [ ] Test filtering by minQuality

---

## Phase 2B: Wallets + Bulk (Weeks 7-8)

### Feature 7: Wallet On-Ramp + Off-Ramp (2 weeks)

#### On-Ramp (Coinbase Pay)
- [ ] Coinbase Pay integration (redirect flow)
- [ ] New button in profile: "Top up wallet"
- [ ] Endpoint: GET /api/humans/:humanId/onramp/coinbase-pay
  - [ ] Generate Coinbase Pay session
  - [ ] Return { redirectUrl, sessionId }
- [ ] Webhook: POST /api/webhooks/coinbase-pay
  - [ ] Coinbase notifies us of successful deposit
  - [ ] Update Human.hasFundedWallet = true
  - [ ] Emit webhook: human.wallet_funded

#### Off-Ramp (Wise)
- [ ] Wise API integration (batch transfer API)
- [ ] Endpoint: POST /api/humans/:humanId/offramp/setup
  - [ ] Human inputs bank details
  - [ ] Initiate Wise KYC
  - [ ] Create OffRampAccount record
- [ ] Endpoint: POST /api/humans/:humanId/offramp/withdraw
  - [ ] Validate wallet balance
  - [ ] Create OffRampTransaction
  - [ ] Trigger on-chain USDC transfer to Wise bridge
  - [ ] Return { withdrawalId, estimatedAmount, fee, completedBy }
- [ ] Webhook: POST /api/webhooks/wise
  - [ ] Wise notifies us of successful transfer
  - [ ] Update OffRampTransaction.status = COMPLETED

#### Data Models
- [ ] OnRampTransaction (humanId, provider, externalId, amountUsd, fee, status)
- [ ] OffRampAccount (humanId, provider, accountId, bankDetails, kycStatus)
- [ ] OffRampTransaction (humanId, amountUsdc, amountFiat, status, txHash)
- [ ] Add to Human: hasFundedWallet (Boolean)

#### Payment Readiness API
- [ ] GET /api/humans/:humanId/payment-readiness
  - [ ] Return: { walletAddress, hasFundedWallet, acceptsPayment, preferredPaymentMethod }
  - [ ] Agents call before offering jobs
  - [ ] Signals if human is ready

#### Security
- [ ] Encrypt bank details in OffRampAccount (at-rest)
- [ ] HTTPS-only for all sensitive endpoints
- [ ] No bank details in logs

#### Testing
- [ ] Mock Coinbase Pay callback
- [ ] Mock Wise API calls
- [ ] Test on-chain transfer initiation
- [ ] E2E: human funds wallet via Coinbase → human withdraws via Wise

---

### Feature 8: Bulk Job Posting (0.5 weeks)

#### API Extension
- [ ] POST /api/listings/bulk (same as POST /api/listings, new fields)
  - [ ] New fields: targetCount, pricePerUnit, totalBudget
  - [ ] Response: { listingId, isBulk: true, targetCount }
- [ ] Listing model: add isBulk, targetCount, acceptedCount, totalBudget, pricePerUnit

#### Acceptance Logic
- [ ] PATCH /api/listings/:listingId/applications/:appId
  - [ ] If listing.isBulk && acceptedCount < targetCount:
    - [ ] Create Job from Listing + Application
    - [ ] Increment listing.acceptedCount
    - [ ] If acceptedCount == targetCount: set listing.status = CLOSED
  - [ ] Else: reject with "Listing is full"

#### Testing
- [ ] Test bulk listing creation
- [ ] Test FIFO acceptance (first 5 apps accepted, rest rejected)
- [ ] Test closing when targetCount reached

---

### Feature 9: Supply Analysis Dashboard (0.5 weeks)

#### Admin Endpoint
- [ ] GET /api/admin/supply-analysis
  - [ ] Params: period=7d|30d|90d
  - [ ] Return:
    ```json
    {
      "totalHumans": 1500,
      "activeHumans": 800,
      "skillGaps": [
        { "skill": "drone_operator", "count": 3, "demand": 45 }
      ],
      "locationGaps": [
        { "location": "Lagos, NG", "humans": 5, "jobOffers": 50 }
      ],
      "growthMetrics": { "newHumansLastWeek": 42, ... }
    }
    ```
- [ ] Queries: aggregate skills, count by location, count offers, compute gap_score = (demand - supply) / supply

#### Testing
- [ ] Test skill gap aggregation
- [ ] Test location gap calculation

---

## Phase 3: Calendar + AI + Verify (Weeks 9-10)

### Feature 10: Availability Calendar (1.5 weeks)

#### Prisma Schema
- [ ] Create AvailabilitySlot model (humanId, recurring, dayOfWeek, date, startTime, endTime, capacityHours, timezone, tags, status)
- [ ] Add to Job: scheduledStartAt, scheduledEndAt
- [ ] Migration: `prisma migrate dev --name add_availability`

#### Backend Routes
- [ ] POST /api/humans/:humanId/availability
  - [ ] Create AvailabilitySlot
  - [ ] Return { slotId }
- [ ] GET /api/humans/availability-search
  - [ ] Params: date, startTime, endTime, skill, location
  - [ ] Find humans available in that time window with matching skills
  - [ ] Return humans + their availability + quality + rates
- [ ] POST /api/jobs/:jobId/schedule
  - [ ] Agent provides scheduledStartAt, scheduledEndAt
  - [ ] Update Job fields
  - [ ] Notify human
  - [ ] Human can confirm or suggest alternative
- [ ] GET /api/humans/:humanId/calendar
  - [ ] Return availability slots + scheduled jobs
  - [ ] Visual calendar view

#### MCP Tools
- [ ] Add CreateAction: search_humans_by_availability
  - [ ] Schema: { date, startTime, endTime, skill, location }
- [ ] Add CreateAction: schedule_job
  - [ ] Schema: { jobId, scheduledStartAt, scheduledEndAt }

#### Testing
- [ ] Test slot creation (recurring and one-off)
- [ ] Test availability search query
- [ ] Test scheduling and confirmation flow

---

### Feature 11: AI-Generated Job Descriptions (1 week)

#### Data Model
- [ ] Add to Job: descriptionSource, aiGeneratedDescription, aiGeneratedDuration, humanFeedback

#### Claude API Integration
- [ ] Create `backend/src/lib/ai/jobDescriptionGenerator.ts`
- [ ] Prompt: "Generate a detailed job description for: skill=[skill], budget=[budget], context=[context]"
- [ ] Response: description + estimatedDuration (e.g., "4-6 hours")
- [ ] Compute clarityScore (simple heuristic: word count, sentence count, specificity keywords)

#### Backend Endpoint
- [ ] POST /api/jobs/:jobId/refine-description
  - [ ] Params: skill, budget, context, anythingElse
  - [ ] Call Claude
  - [ ] Return { aiGeneratedDescription, estimatedDuration, clarityScore }
  - [ ] Agent can edit or accept
- [ ] PUT /api/jobs/:jobId
  - [ ] Agent submits final description
  - [ ] Update Job.description, descriptionSource

#### Clarity Feedback
- [ ] POST /api/jobs/:jobId/clarity-check
  - [ ] Human asks clarification question
  - [ ] Added to JobMessage (existing)
  - [ ] Agent responds
  - [ ] Human can accept once satisfied

#### MCP Tools
- [ ] Add CreateAction: generate_job_description
  - [ ] Schema: { skill, budget, context, anythingElse }

#### Testing
- [ ] Mock Claude API calls
- [ ] Test description generation for various skills
- [ ] Test clarity score computation
- [ ] E2E: agent provides brief → Claude generates description → agent offers to human

---

### Feature 12: Autonomous Agent Verification (1 week)

#### Data Model
- [ ] Add to Agent: verificationStatus, coinbaseAgentId, verificationToken, verifiedAt, verificationMethod
- [ ] Add to Job: postedByVerifiedAgent (boolean, denormalized)

#### Registration Endpoint
- [ ] POST /api/agents/register
  - [ ] Params: coinbaseAgentId, agentName, email, apiKey
  - [ ] Call Coinbase AgentKit API to verify credentials
  - [ ] Create or update Agent record
  - [ ] Set verificationStatus = VERIFIED
  - [ ] Return { agentId, verifiedAt }

#### Rate Limit Changes
- [ ] Existing: unverified agents = 30 offers/day
- [ ] New: verified agents = 1000 offers/day
- [ ] Rate limiter logic: check Agent.verificationStatus before applying limit

#### Search Integration
- [ ] GET /api/humans/search
  - [ ] Add param: agentVerified=true (filter for verified agents only)
  - [ ] Display "Verified Agent" badge on job listings
  - [ ] Rank verified agent jobs higher

#### MCP Tools
- [ ] Add CreateAction: register_agent_verified
  - [ ] Schema: { coinbaseAgentId, agentName, email, apiKey }

#### Testing
- [ ] Mock Coinbase AgentKit verification
- [ ] Test rate limit changes (verified vs. unverified)
- [ ] Test search filtering

---

## Cross-Cutting Concerns

### Authentication & Authorization
- [ ] All endpoints require Agent or Human authentication (existing middleware)
- [ ] Agent endpoints: check registeredAgentId or agentId (existing)
- [ ] Admin endpoints: check role = ADMIN
- [ ] Human endpoints: check humanId ownership

### Error Handling
- [ ] All endpoints return consistent error format:
  ```json
  { "error": "...", "statusCode": 400, "details": {...} }
  ```
- [ ] Log all errors (sentry integration)

### Rate Limiting
- [ ] IP-based: 30 offers/day (existing)
- [ ] User-based: tier-based limits (existing + verification tier)
- [ ] Per-endpoint: webhook delivery retries (exponential backoff)

### Testing Strategy
- [ ] Unit tests: isolated functions (scoring, HMAC, etc.)
- [ ] Integration tests: Prisma queries, API endpoints with real DB
- [ ] E2E tests: full workflows (job creation → payment → review)
- [ ] Mock external APIs: Privy, Midata, Wise, Coinbase, Claude

### Deployment
- [ ] Use `PUSH_LITE=1` to skip e2e during heavy phases
- [ ] Incremental rollout: feature flags for each feature
- [ ] Database migrations: `prisma migrate deploy` in prod
- [ ] Verify search indexing after schema changes

---

## Success Metrics

### After All Features
- [ ] Escrow usage: 70%+ of jobs $100+
- [ ] Verified humans: 40%+ of supply
- [ ] Webhook usage: 60%+ of agents
- [ ] Quality search adoption: 30%+ of searches use minQuality
- [ ] On-ramp usage: 50%+ of humans fund wallet
- [ ] Bulk listing usage: 20%+ of listings are bulk
- [ ] Availability adoption: 25%+ of humans post calendar
- [ ] AI description usage: 40%+ of agents use
- [ ] Verified agents: 10%+ of active agents

---

**This checklist is the "how to build it" document. Reference it during each sprint.**
