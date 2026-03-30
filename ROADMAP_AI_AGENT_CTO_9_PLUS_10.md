# HumanPages Product Roadmap: From 5/10 to 9+/10 for AI Agent CTOs

**Target Audience:** CTOs at AI agent startups (Rivet, Dara, Caison, etc.)
**Current Score:** 5/10
**Target Score:** 9+/10
**Last Updated:** 2026-03-29

---

## Executive Summary

HumanPages currently fails CTOs because it solves the "find humans" problem but ignores the **trust, quality, and operational** problems that keep agents from deploying at scale:

- **Thin supply** (1,500 humans) means 90% of searches return 0-2 matches
- **No trust layer** (agents won't risk $500+ jobs on unverified humans)
- **Payment friction** (agents can't easily fund wallets; humans distrust crypto)
- **No dispatch integration** (agents must manually create jobs; no webhook callbacks)
- **No quality scoring** beyond 1-5 stars (agents can't optimize for reliability)
- **One-way reputation** (agents get no ratings; no accountability)
- **No discovery mode** (humans can only receive offers, can't browse jobs)

This roadmap sequences 12 features across 3 phases to hit 8/10 (MVP for scale) and 9+/10 (category-defining).

---

## Scoring Framework

**CTO Success Metrics:**
1. **Supply Depth:** Can I find 10+ qualified humans per search?
2. **Trust:** Can I deploy $500+ jobs with confidence?
3. **Automation:** Can I integrate into my agentic workflow?
4. **Economics:** Can I manage costs without surprises?
5. **Reputation:** Can I hold humans (and agents) accountable?
6. **Quality:** Can I optimize for reliability over volume?

---

# PHASE 1: MVP for 8/10 (4 weeks)

## 1. Escrow + Dispute Resolution
**One-liner:** Locked-in funds + 48h human review window + burn-on-dispute for jobs $100+.

**Why It Moves the Needle:**
- Eliminates agent fear of non-payment (top blocker for $500+ jobs)
- Shifts settlement burden from reputation to law (instant confidence)
- Competitors (Fiverr, Upwork) have escrow; agents expect it

**Technical Spec:**

### Data Model (Prisma additions)
```prisma
enum EscrowStatus {
  NOT_REQUIRED        // Job < $100
  PENDING_FUNDING     // Awaiting agent payment
  FUNDED              // Funds locked, human working
  SUBMITTED           // Human submitted work, 48h review window
  APPROVED            // Agent approved, funds released to human
  DISPUTED            // Disagreement on quality
  BURNED              // Escrow burned after dispute
  REFUNDED            // Agent's payment returned (after human rejects or cancel)
}

model Escrow {
  id                  String          @id @default(cuid())
  jobId               String          @unique
  humanId             String
  agentId             String

  // Escrow lifecycle
  status              EscrowStatus    @default(NOT_REQUIRED)
  amountUsdc          Decimal         @db.Decimal(18, 6)

  // Funding (agent deposits funds)
  fundedAt            DateTime?
  fundTxHash          String?         @unique
  fundNetwork         String?

  // Work submission
  submittedAt         DateTime?
  submissionNote      String?         @db.VarChar(2000)

  // Review window (48h from submission)
  reviewDeadlineAt    DateTime?
  reviewedAt          DateTime?
  reviewResult        String?         // "approved", "disputed", "timed_out"
  reviewerNote        String?         @db.VarChar(2000)

  // Dispute resolution
  disputeReason       String?         // "low_quality", "incomplete", "not_delivered"
  disputeEvidenceUrls String[]        @default([])

  // Settlement
  settledAt           DateTime?
  settlementTx        String?
  settlementAmount    Decimal?        @db.Decimal(18, 6) // May differ if partial
  settlementReceiver  String?         // "HUMAN" or "AGENT"
  burnAmount          Decimal?        @db.Decimal(18, 6) // Burned portion on dispute

  createdAt           DateTime        @default(now())
  updatedAt           DateTime        @updatedAt

  job                 Job             @relation(fields: [jobId], references: [id], onDelete: Cascade)
  human               Human           @relation("EscrowAsHuman", fields: [humanId], references: [id])

  @@index([humanId])
  @@index([agentId])
  @@index([status])
}

// Link Job → Escrow (update existing Job model)
// Add: escrowId String? @relation(fields: [...], references: [id])
```

### API Endpoints

**POST /api/jobs/:jobId/escrow/fund** (Agent-only)
```json
{
  "priceUsdc": 500,
  "paymentTxHash": "0x...",
  "paymentNetwork": "base"
}
```
- Validates payment on-chain (already have this in verifyUsdcPayment)
- Creates Escrow record with status = FUNDED
- Emits webhook: `job.escrow.funded`
- Response: `{ escrowId, reviewDeadlineAt, expectedDisbursement }`

**POST /api/jobs/:jobId/escrow/submit-work** (Human-only)
```json
{
  "submissionNote": "Photos uploaded to Google Drive: [link]",
  "evidenceUrls": ["https://drive.google.com/..."]
}
```
- Updates Escrow.status = SUBMITTED
- Sets reviewDeadlineAt = now + 48h
- Notifies agent: "Work submitted. You have 48h to approve or dispute."
- Response: `{ reviewDeadlineAt }`

**POST /api/jobs/:jobId/escrow/approve** (Agent-only)
```json
{}
```
- Validates 48h window not exceeded
- Releases funds to human's wallet (use Privy for on-chain transfer)
- Updates Escrow.status = APPROVED
- Emits webhook: `job.escrow.released`
- Response: `{ disbursementTx, amount }`

**POST /api/jobs/:jobId/escrow/dispute** (Agent-only)
```json
{
  "reason": "low_quality",
  "note": "Photos are blurry, background incorrect"
}
```
- Updates Escrow.status = DISPUTED
- Notifies human + admin for escalation
- Emits webhook: `job.escrow.disputed`
- Response: `{ supportTicketId }`

**PUT /api/jobs/:jobId/escrow/resolve** (Admin-only)
```json
{
  "result": "approved_partial",
  "humanShare": 300,
  "agentShare": 200
}
```
- Splits funds or awards all to one party
- Burns remainder if both agree
- Releases funds via Privy wallet API
- Emits webhook: `job.escrow.resolved`

**MCP Tool Additions**
```typescript
@CreateAction({
  name: "create_job_with_escrow",
  description: "Post a job with automatic escrow for $100+. Agent deposits funds upfront; human submits work; agent has 48h to approve or dispute.",
  schema: CreateJobWithEscrowSchema,
})
async createJobWithEscrow(args): Promise<string>

@CreateAction({
  name: "escrow_approve",
  description: "Approve human's work submission and release escrow funds.",
  schema: EscrowApproveSchema,
})
async escrowApprove(args): Promise<string>

@CreateAction({
  name: "escrow_dispute",
  description: "Dispute work quality. Triggers admin review. Funds held pending decision.",
  schema: EscrowDisputeSchema,
})
async escrowDispute(args): Promise<string>
```

**Effort:** 2 weeks (Prisma schema, API endpoints, wallet release logic, admin dashboard)

**Dependencies:**
- Privy wallet API integration (already have Privy setup)
- Admin dispute resolution UI (basic)

**Score Impact:** +2.5 (eliminates top trust blocker; enables $500+ jobs)

---

## 2. Pre-Hire Verification: Portfolio + Background Check API
**One-liner:** Portfolio review API + pluggable background check (Midata/Stripe integration).

**Why It Moves the Needle:**
- Agents reduce hiring risk via portfolio evidence + ID verification
- Humans with portfolios rank higher in search (credibility signal)
- Stricter vetting locks out low-effort spam accounts

**Technical Spec:**

### Data Model
```prisma
enum PortfolioItemType {
  PHOTO
  VIDEO
  GITHUB_REPO
  WEBSITE
  CERTIFICATE
  CASE_STUDY
}

model PortfolioItem {
  id                String              @id @default(cuid())
  humanId           String
  type              PortfolioItemType
  title             String
  description       String?
  url               String              // External link or R2 key
  thumbnailUrl      String?             // R2 preview
  metadata          Json?               // Format: { fileSize, duration, resolution, etc. }
  verifiedAt        DateTime?           // When admin reviewed
  createdAt         DateTime            @default(now())

  human             Human               @relation(fields: [humanId], references: [id], onDelete: Cascade)
  @@index([humanId])
}

enum VerificationStatus {
  UNVERIFIED
  PENDING
  VERIFIED
  FAILED
}

model IdentityVerification {
  id                String              @id @default(cuid())
  humanId           String              @unique

  // Provider info
  provider          String              // "midata", "stripe", "persona"
  providerId        String?             // External service ID

  // Results
  status            VerificationStatus  @default(UNVERIFIED)
  verifiedAt        DateTime?
  expiresAt         DateTime?           // Some checks expire (e.g. background checks)

  // Verification details (encrypted)
  idType            String?             // "passport", "id_card", "driver_license"
  country           String?
  idNumber          String?             // Last 4 digits only
  dateOfBirth       DateTime?
  firstName         String?
  lastName          String?

  // Background check results
  backgroundCheck   Json?               // { passed: bool, flagged: [...], provider_response: {...} }

  // Risk signal
  riskLevel         String?             // "low", "medium", "high"
  flaggedReasons    String[]            @default([])

  // Audit
  requestedAt       DateTime            @default(now())
  updatedAt         DateTime            @updatedAt

  human             Human               @relation("IdentityVerification", fields: [humanId], references: [id], onDelete: Cascade)
  @@index([status])
  @@index([verifiedAt])
}

// Add to Human model:
// portfolioItems    PortfolioItem[]
// identityVerification IdentityVerification?
// isIdVerified      Boolean            @default(false)
// backgroundCheckPassed Boolean?
```

### API Endpoints

**POST /api/humans/:humanId/portfolio** (Human-only)
```json
{
  "type": "PHOTO",
  "title": "Drone Photography - San Francisco",
  "description": "Aerial photos of downtown SF",
  "url": "https://drive.google.com/...",
  "thumbnailUrl": "https://..."
}
```
- Stores portfolio item metadata
- Generates thumbnail if possible
- Response: `{ portfolioId, verifiedStatus: "pending" }`

**POST /api/humans/:humanId/verify-identity** (Human-only)
```json
{
  "provider": "midata",  // or "stripe"
}
```
- Redirects to provider's verification flow
- Stores callback webhook
- Response: `{ verificationUrl, expiresAt }`

**POST /api/webhooks/identity-verification** (Provider→Backend)
```json
{
  "humanId": "...",
  "provider": "midata",
  "status": "verified",
  "idType": "passport",
  "country": "NG",
  "dateOfBirth": "1985-04-15"
}
```
- Updates IdentityVerification record
- Updates Human.isIdVerified = true
- Updates search ranking
- Emits webhook: `human.identity_verified`

**GET /api/humans/search** (Query params updated)
```
?minVerificationLevel=portfolio  // portfolio, identity, background
```
- Filters by verification status
- Ranks verified humans higher
- Response includes `verificationLevel`, `portfolioCount`, `backgroundCheckPassed`

**MCP Tool Additions**
```typescript
@CreateAction({
  name: "view_human_portfolio",
  description: "Get a human's portfolio items (photos, videos, certificates). Costs 1 profile view.",
  schema: ViewHumanPortfolioSchema,
})
async viewHumanPortfolio(args): Promise<string>

@CreateAction({
  name: "request_identity_verification",
  description: "Request a human verify their identity via Midata. Returns verification link to share.",
  schema: RequestIdentityVerificationSchema,
})
async requestIdentityVerification(args): Promise<string>

@CreateAction({
  name: "search_humans_verified",
  description: "Search humans filtered by verification status (portfolio, identity, background). Higher-quality results.",
  schema: SearchHumansVerifiedSchema,
})
async searchHumansVerified(args): Promise<string>
```

**Effort:** 2 weeks (Midata/Stripe API integration, webhook handling, R2 storage for portfolios, search filtering)

**Dependencies:**
- Midata or Stripe Connect integration
- R2 setup for portfolio thumbnails
- Admin review dashboard

**Score Impact:** +1.5 (enables risk assessment; improves match quality)

---

## 3. Agent Reputation + Reverse Ratings
**One-liner:** Agents also get 1-5 star ratings (for payment timeliness, clarity, professionalism); humans can block agents.

**Why It Moves the Needle:**
- Humans see which agents are bad before accepting jobs
- Agents incentivized to be good clients
- Balances power dynamic (currently one-way trust)
- Enables "preferred agent" filtering

**Technical Spec:**

### Data Model
```prisma
enum ReviewerRole {
  HUMAN
  AGENT
}

model AgentRating {
  id              String        @id @default(cuid())
  jobId           String        @unique
  agentId         String        // Rated agent
  humanId         String        // Rater (human)

  rating          Int           // 1-5 stars
  comment         String?       @db.VarChar(2000)

  // Dimensions
  clarity         Int?          // 1-5: Was the job description clear?
  professionalism Int?          // 1-5: Was communication professional?
  paymentSpeed    Int?          // 1-5: How fast was payment?
  fairPrice       Int?          // 1-5: Was the price fair?

  // Metadata
  jobCategory     String?       // Denormalized for filtering
  jobValue        Decimal?      @db.Decimal(18, 6)

  // Human can respond
  agentResponse   String?       @db.VarChar(2000)
  respondedAt     DateTime?

  createdAt       DateTime      @default(now())

  @@index([agentId])
  @@index([createdAt])
  @@index([rating])
}

model AgentBlocking {
  id          String    @id @default(cuid())
  humanId     String
  blockedAgentId String  // Registered agent ID
  reason      String?   // "spam", "unprofessional", "non_payment", "other"
  createdAt   DateTime  @default(now())

  @@unique([humanId, blockedAgentId])
  @@index([humanId])
}

// Add to Agent model (new table):
model Agent {
  id                String            @id @default(cuid())  // Registered agent
  agentPublicId     String            @unique               // Used in job.agentId
  agentName         String
  email             String

  // Ratings aggregates
  avgRating         Decimal?          @db.Decimal(3, 2)    // 1.0-5.0
  ratingCount       Int               @default(0)
  totalJobsPosted   Int               @default(0)
  completedJobs     Int               @default(0)

  // Risk signals
  status            AgentStatus       @default(ACTIVE)
  abuseScore        Int               @default(0)

  createdAt         DateTime          @default(now())
  updatedAt         DateTime          @updatedAt

  ratings           AgentRating[]
  jobs              Job[]

  @@index([agentPublicId])
  @@index([avgRating])
  @@index([status])
}

// Add to Human model:
// agentRatingsGiven AgentRating[]
// blockedAgents     AgentBlocking[]
```

### API Endpoints

**POST /api/jobs/:jobId/rate-agent** (Human-only)
```json
{
  "rating": 4,
  "comment": "Great communication, but took 3 days to pay",
  "clarity": 5,
  "professionalism": 4,
  "paymentSpeed": 3,
  "fairPrice": 4
}
```
- Creates AgentRating record
- Updates Agent.avgRating, ratingCount
- Emits webhook: `agent.rated`
- Response: `{ ratingId, agentRating }`

**POST /api/agents/:agentId/rate-agent** (Human-only, view public rating)
```json
{}
```
- Returns: `{ agentId, name, avgRating, ratingCount, ratingsBreakdown: { clarity, professionalism, paymentSpeed, fairPrice }, recentRatings: [...] }`

**POST /api/humans/:humanId/block-agent** (Human-only)
```json
{
  "agentId": "...",
  "reason": "unprofessional"
}
```
- Adds to AgentBlocking
- Future job offers from this agent auto-rejected
- Response: `{ blockedAgentId }`

**GET /api/humans/search** (Query params updated)
```
?excludeAgentId=...  // Don't show jobs from blocked agents
```

**MCP Tool Additions**
```typescript
@CreateAction({
  name: "leave_agent_review",
  description: "Rate an agent after job completion. Agents with high ratings are more trustworthy.",
  schema: LeaveAgentReviewSchema,
})
async leaveAgentReview(args): Promise<string>

@CreateAction({
  name: "view_agent_reputation",
  description: "Get an agent's reputation score and recent reviews from humans.",
  schema: ViewAgentReputationSchema,
})
async viewAgentReputation(args): Promise<string>

@CreateAction({
  name: "block_agent",
  description: "Block an agent from sending you job offers.",
  schema: BlockAgentSchema,
})
async blockAgent(args): Promise<string>
```

**Effort:** 1.5 weeks (Prisma schema, API endpoints, rating aggregation logic)

**Dependencies:**
- Agent registration system (lightweight; can reuse existing agent records)

**Score Impact:** +1 (enables bidirectional trust; blocks low-quality agents)

---

## 4. Supply Growth: Human Job Browsing
**One-liner:** Humans can browse open jobs (not just receive offers); post applications with portfolio links; agents see applications.

**Why It Moves the Needle:**
- Decouples supply from direct offers (discovery mode)
- Humans proactively apply for good jobs (higher accept rate)
- Increases engagement (humans feel empowered, not passive)
- Enables bulk job posting (post once, 100+ humans can apply)

**Technical Spec:**

### Data Model
```prisma
enum ApplicationStatus {
  DRAFT
  SUBMITTED
  VIEWED
  REJECTED
  ACCEPTED
  EXPIRED
}

model Listing {
  id                String            @id @default(cuid())
  agentId           String            // Poster (agent)
  registeredAgentId String?
  registeredAgent   Agent?            @relation(fields: [registeredAgentId], references: [id])

  // Job details (same as Job, but open)
  title             String
  description       String
  category          String?
  skills            String[]          @default([])  // Required skills

  // Pricing
  minPrice          Decimal           @db.Decimal(18, 6)
  maxPrice          Decimal?          @db.Decimal(18, 6)
  priceUnit         String?           // "HOURLY", "FLAT_TASK"

  // Geographic targeting
  locationRequired  String?           // City name or radius
  locationLat       Float?
  locationLng       Float?
  radius            Int?              // km
  remote            Boolean           @default(false)

  // Availability
  deadline          DateTime
  deadline_extended DateTime?         // If extended

  // Posting settings
  maxApplications   Int?              // Cap (null = unlimited)
  screeningQuestions String[]         @default([])  // Custom questions

  // Visibility
  status            String            @default("ACTIVE")  // "ACTIVE", "CLOSED", "ARCHIVED"
  isPublished       Boolean           @default(true)
  viewCount         Int               @default(0)
  applicationCount  Int               @default(0)

  // Tracking
  createdAt         DateTime          @default(now())
  updatedAt         DateTime          @updatedAt
  closedAt          DateTime?

  applications      ListingApplication[]

  @@index([agentId])
  @@index([status, deadline])
  @@index([skills], type: Gin)
  @@index([locationLat, locationLng])
  @@index([createdAt])
}

model ListingApplication {
  id                String            @id @default(cuid())
  listingId         String
  humanId           String

  // Human's proposal
  coverLetter       String            @db.VarChar(2000)
  proposedPrice     Decimal?          @db.Decimal(18, 6)
  portfolioItems    String[]          @default([])  // Portfolio item IDs to highlight
  screeningAnswers  Json?             // { questionId: "answer" }

  // Status
  status            ApplicationStatus @default(SUBMITTED)

  // Agent decision
  rejectedAt        DateTime?
  rejectionReason   String?

  acceptedAt        DateTime?
  acceptedJobId     String?           @unique  // Converts to Job

  // Tracking
  viewedAt          DateTime?
  createdAt         DateTime          @default(now())

  listing           Listing           @relation(fields: [listingId], references: [id], onDelete: Cascade)
  human             Human             @relation(fields: [humanId], references: [id], onDelete: Cascade)
  job               Job?              @relation(fields: [acceptedJobId], references: [id])

  @@unique([listingId, humanId])
  @@index([listingId, status])
  @@index([humanId])
  @@index([createdAt])
}

// Add to Job model:
// listingApplicationId  String?
// listingApplication    ListingApplication?
```

### API Endpoints

**POST /api/listings** (Agent-only)
```json
{
  "title": "Photography - Product Shots",
  "description": "Need 50 product photos for e-commerce",
  "skills": ["photography", "product", "lighting"],
  "minPrice": 200,
  "maxPrice": 500,
  "priceUnit": "FLAT_TASK",
  "deadline": "2026-04-10T00:00:00Z",
  "location": "San Francisco, CA",
  "radius": 50,
  "remote": false,
  "screeningQuestions": [
    "What's your portfolio link?",
    "How much experience with product photography?"
  ]
}
```
- Creates Listing
- Posts to public feed
- Emits webhook: `listing.created`
- Response: `{ listingId, url }`

**GET /api/listings** (Public)
```
?skill=photography&location=San+Francisco&radius=50&minPrice=100&maxPrice=1000&sortBy=latest|mostApplications|closingSoon
```
- Returns paginated listings
- Includes application count, deadline, posting agent reputation
- Response: `{ listings: [...], totalCount, facets }`

**GET /api/listings/:listingId** (Public, but shows human's own applications)
```
```
- Returns full listing + application status if human authenticated
- Shows all applications (to agent only) if agent owns listing
- Response: `{ listing, myApplicationStatus?, applications }`

**POST /api/listings/:listingId/apply** (Human-only)
```json
{
  "coverLetter": "I have 10 years of product photography experience...",
  "proposedPrice": 250,
  "portfolioItems": ["portfolio_1", "portfolio_2"],
  "screeningAnswers": {
    "q1": "Here's my portfolio: [link]",
    "q2": "5+ years with e-commerce brands"
  }
}
```
- Creates ListingApplication with status SUBMITTED
- Notifies agent
- Response: `{ applicationId, status: "SUBMITTED" }`

**PATCH /api/listings/:listingId/applications/:appId** (Agent-only)
```json
{
  "action": "accept",  // or "reject"
  "note": "Perfect! Let's start ASAP."
}
```
- If accept: Creates Job from Listing + Application, auto-fills title/description/price
- If reject: Sets rejectedAt, rejectionReason
- Updates ListingApplication.status
- Emits webhook: `application.accepted` or `application.rejected`
- Response: `{ jobId }` (if accepted) or `{ applicationId }`

**GET /api/humans/:humanId/applications** (Human-only)
```
?status=submitted,viewed,accepted
```
- Returns all applications user submitted
- Response: `{ applications: [...], counts: { submitted, viewed, accepted, rejected } }`

**MCP Tool Additions**
```typescript
@CreateAction({
  name: "post_job_listing",
  description: "Post an open job listing where multiple humans can apply. Great for finding multiple contractors for bulk work.",
  schema: PostJobListingSchema,
})
async postJobListing(args): Promise<string>

@CreateAction({
  name: "browse_job_listings",
  description: "Find open job listings posted by agents. Filter by skill, location, price, deadline.",
  schema: BrowseJobListingsSchema,
})
async browseJobListings(args): Promise<string>

@CreateAction({
  name: "view_listing_applications",
  description: "See humans who applied to your job posting. View portfolios, proposed prices, screening answers.",
  schema: ViewListingApplicationsSchema,
})
async viewListingApplications(args): Promise<string>

@CreateAction({
  name: "accept_application",
  description: "Accept a human's application and convert it to a job. Auto-fills job details from listing.",
  schema: AcceptApplicationSchema,
})
async acceptApplication(args): Promise<string>
```

**Effort:** 2.5 weeks (Prisma schema, API endpoints, search filtering, notification system)

**Dependencies:**
- None (can leverage existing infrastructure)

**Score Impact:** +1.5 (enables human discovery, multiplies supply perception)

---

# PHASE 2: Polish for 9/10 (3 weeks)

## 5. Webhook + Async Job Status API
**One-liner:** Agents register webhook callbacks; get real-time job status updates (accepted, work_submitted, completed, disputed).

**Why It Moves the Needle:**
- Agents stop polling `/api/jobs/:jobId` repeatedly
- Integration into agentic workflows (decision trees, workflows)
- Webhooks signed with HMAC-SHA256 (security)
- Allows agents to trigger downstream actions automatically

**Technical Spec:**

### Data Model
```prisma
enum WebhookEventType {
  // Job lifecycle
  JOB_CREATED
  JOB_UPDATED
  JOB_ACCEPTED
  JOB_REJECTED
  JOB_WORK_SUBMITTED
  JOB_COMPLETED
  JOB_CANCELLED
  JOB_DISPUTED

  // Escrow
  ESCROW_FUNDED
  ESCROW_SUBMITTED
  ESCROW_APPROVED
  ESCROW_DISPUTED
  ESCROW_RESOLVED

  // Listing
  LISTING_CREATED
  LISTING_CLOSED
  APPLICATION_SUBMITTED
  APPLICATION_ACCEPTED
  APPLICATION_REJECTED
}

enum WebhookStatus {
  PENDING     // Queued for delivery
  SUCCESS     // Delivered and accepted
  FAILED      // Failed after retries
  DISABLED    // Agent disabled webhook
}

model WebhookSubscription {
  id              String    @id @default(cuid())
  agentId         String

  // Endpoint
  url             String
  secret          String    // HMAC-SHA256 signing key

  // Filtering
  eventTypes      String[]  @default([])  // Empty = all events

  // Retry config
  isActive        Boolean   @default(true)
  retryCount      Int       @default(3)
  retryDelayMs    Int       @default(5000)

  // Monitoring
  lastDeliveredAt DateTime?
  lastFailedAt    DateTime?
  failureCount    Int       @default(0)

  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  @@unique([agentId, url])
  @@index([agentId, isActive])
}

model WebhookDelivery {
  id                String          @id @default(cuid())
  subscriptionId    String

  // Event
  eventType         WebhookEventType
  eventTimestamp    DateTime
  payload           Json            // Full event body

  // Delivery tracking
  url               String
  status            WebhookStatus   @default(PENDING)

  // Response
  httpStatus        Int?
  responseBody      String?         @db.VarChar(5000)

  // Retries
  attemptCount      Int             @default(0)
  nextRetryAt       DateTime?

  // Security
  signatureHeader   String          // X-HumanPages-Signature value sent

  createdAt         DateTime        @default(now())

  subscription      WebhookSubscription @relation(fields: [subscriptionId], references: [id], onDelete: Cascade)

  @@index([subscriptionId, status])
  @@index([createdAt])
}

// Webhook event metadata (for debugging)
model WebhookEvent {
  id                String          @id @default(cuid())
  eventType         WebhookEventType
  agentId           String
  jobId             String?
  listingId         String?

  payload           Json

  createdAt         DateTime        @default(now())

  @@index([agentId, createdAt])
  @@index([jobId])
}
```

### API Endpoints

**POST /api/webhooks/subscribe** (Agent-only)
```json
{
  "url": "https://myagent.io/humanpages-webhook",
  "secret": "whsec_abc123...",
  "eventTypes": ["JOB_ACCEPTED", "JOB_WORK_SUBMITTED", "JOB_COMPLETED", "ESCROW_APPROVED"]
}
```
- Creates WebhookSubscription
- Sends test event to verify endpoint works
- Response: `{ subscriptionId, testEventId }`

**GET /api/webhooks/subscriptions** (Agent-only)
```
```
- Lists all subscriptions for this agent
- Includes delivery history, failure count
- Response: `{ subscriptions: [...] }`

**DELETE /api/webhooks/subscriptions/:subscriptionId** (Agent-only)
```
```
- Disables webhook (can re-enable)
- Response: `{ subscriptionId }`

**GET /api/webhooks/deliveries/:subscriptionId** (Agent-only)
```
?status=success,failed&limit=50
```
- Lists webhook delivery history
- Response: `{ deliveries: [...], totalCount }`

**POST /api/webhooks/retry/:deliveryId** (Agent-only)
```
{}
```
- Manually retry failed delivery
- Response: `{ status }`

### Webhook Payload Spec

```json
{
  "id": "evt_abc123",
  "type": "JOB_ACCEPTED",
  "timestamp": "2026-03-29T15:30:00Z",
  "data": {
    "jobId": "job_xyz789",
    "humanId": "human_456",
    "agentId": "agent_123",
    "title": "Photography",
    "acceptedAt": "2026-03-29T15:30:00Z"
  }
}
```

Signature header:
```
X-HumanPages-Signature: sha256=<HMAC-SHA256(secret, JSON.stringify(event))>
```

### Delivery Logic
- Fire event immediately when job status changes
- Retry with exponential backoff: 5s, 25s, 125s (total 2m 35s)
- After 3 failures, set status=FAILED, notify agent via email
- Agent can manually retry via dashboard/API

### Effort:** 1.5 weeks (Prisma schema, event generation, delivery queue, retry logic, HMAC signing)

**Dependencies:**
- Queue system (can use Redis or PgBoss if already installed)
- Monitoring/alerting

**Score Impact:** +1 (enables automation; improves integration)

---

## 6. Quality Scoring Algorithm
**One-liner:** Composite score (completion rate, response time, rating consistency, dispute rate) ranks humans in search.

**Why It Moves the Needle:**
- Simple 1-5 stars don't capture reliability (high rater might be inconsistent)
- Agents optimize for reliability, not just cost
- Surfaces high-quality humans early in search results
- Penalty for disputes/cancellations discourages flakes

**Technical Spec:**

### Scoring Formula
```
QualityScore (0-100) =
  (completion_rate * 40%) +
  (response_time_score * 20%) +
  (rating_consistency * 20%) +
  (reliability_score * 20%)

Where:
  completion_rate = completed_jobs / (completed_jobs + cancelled_jobs + disputed_jobs)
  response_time_score = 100 - (avg_response_time_minutes / 1440 * 100)  [capped at 100]
  rating_consistency = (std_dev of ratings < 1.0) ? 100 : 100 - (std_dev * 20)
  reliability_score = (100 - dispute_rate * 50 - cancellation_rate * 30)
```

### Data Model Addition
```prisma
// Add to Human model:
completedJobs        Int      @default(0)       // Denormalized
cancelledJobs        Int      @default(0)
disputedJobs         Int      @default(0)
avgResponseMinutes   Float?
qualityScore         Int      @default(50)      // 0-100, recomputed daily
qualityScoreUpdatedAt DateTime?
ratingStdDev         Float?   // For consistency tracking

@@index([qualityScore])
@@index([qualityScoreUpdatedAt])
```

### Computation
- Run nightly (or on-demand via /api/admin/recalculate-quality)
- For each human: aggregate last 30 days of job data
- Update qualityScore column
- Reorder search results by qualityScore (descending)

### API Changes
```
GET /api/humans/search
  ?sortBy=quality  // NEW
  &minQuality=70   // Only show humans with qualityScore >= 70
```

Response includes:
```json
{
  "human": {
    "id": "...",
    "name": "...",
    "qualityScore": 87,
    "completionRate": 0.95,
    "avgRating": 4.8,
    "totalJobs": 25,
    "ratingCount": 24,
    "avgResponseMinutes": 120
  }
}
```

### Effort:** 1 week (scoring formula, batch computation job, API updates)

**Dependencies:**
- None

**Score Impact:** +0.5 (enables quality-first hiring; improves outcomes)

---

## 7. Wallet Onboarding Improvement: Stablecoin on-ramp
**One-liner:** In-profile crypto-to-USDC on-ramp (Coinbase Pay integration) + USDC → Fiat off-ramp via Wise/Stripe.

**Why It Moves the Needle:**
- Eliminates crypto barrier for non-crypto-native humans (biggest friction point)
- Humans earn USDC, cash out to bank directly
- Reduces wallet creation friction (Privy handles it, but 5-10min first-time)
- Agents see "human can receive payment" status upfront

**Technical Spec:**

### Integration Points

**Coinbase Pay (On-Ramp)**
- Add button in profile: "Top up wallet"
- Redirects to Coinbase Pay (existing Coinbase AgentKit integration)
- Returns USDC directly to human's Base wallet
- Humans can deposit $1-50K in one transaction
- Fee: 2-3% (human bears it, better than bank wire)

**Wise API (Off-Ramp)**
- New section: "Cash out earnings"
- Human enters bank details once (KYC via Wise)
- Job completion triggers auto-payout? Or manual "claim" button
- Fee: ~1.5% + small flat fee

### Data Model
```prisma
enum OnRampProvider {
  COINBASE_PAY
  STRIPE  // Future
}

model OnRampTransaction {
  id                String           @id @default(cuid())
  humanId           String

  provider          OnRampProvider
  externalId        String?          // Coinbase tx ID

  amountUsd         Decimal          @db.Decimal(18, 6)
  fee               Decimal          @db.Decimal(18, 6)
  amountReceived    Decimal          @db.Decimal(18, 6)

  status            String           // "pending", "completed", "failed"
  completedAt       DateTime?

  createdAt         DateTime         @default(now())

  human             Human            @relation("OnRampTransactions", fields: [humanId], references: [id])
  @@index([humanId])
}

model OffRampAccount {
  id                String           @id @default(cuid())
  humanId           String           @unique

  provider          String           // "wise"
  accountId         String           // Wise account number

  bankCountry       String
  bankAccountNumber String
  bankRoutingNumber String?
  bankHolder        String

  kycStatus         String           // "pending", "verified", "failed"
  kycVerifiedAt     DateTime?

  createdAt         DateTime         @default(now())
  updatedAt         DateTime         @updatedAt

  human             Human            @relation("OffRampAccount", fields: [humanId], references: [id])
  @@index([kycStatus])
}

model OffRampTransaction {
  id                String           @id @default(cuid())
  humanId           String
  offRampAccountId  String

  amountUsdc        Decimal          @db.Decimal(18, 6)
  amountFiat        Decimal          @db.Decimal(18, 6)
  fiatCurrency      String           // "USD", "EUR", "NGN", etc.

  exchangeRate      Decimal          @db.Decimal(10, 6)
  fee               Decimal          @db.Decimal(18, 6)

  status            String           // "pending", "completed", "failed"
  txHash            String?          // On-chain tx hash
  externalId        String?          // Wise transfer ID

  completedAt       DateTime?
  createdAt         DateTime         @default(now())

  human             Human            @relation("OffRampTransactions", fields: [humanId], references: [id])
  @@index([humanId, status])
}

// Add to Human model:
// onRampTransactions    OnRampTransaction[]
// offRampAccount        OffRampAccount?
// offRampTransactions   OffRampTransaction[]
// hasFundedWallet       Boolean @default(false)  // Signals "ready to receive payment"
```

### API Endpoints

**POST /api/humans/:humanId/onramp/coinbase-pay** (Human-only)
```json
{
  "amountUsd": 50
}
```
- Generates Coinbase Pay session
- Returns redirect URL
- Response: `{ redirectUrl, sessionId }`

**POST /api/humans/:humanId/offramp/setup** (Human-only)
```json
{
  "provider": "wise",
  "bankCountry": "NG",
  "bankAccountNumber": "0123456789",
  "bankRoutingNumber": "011000015",
  "bankHolder": "John Doe"
}
```
- Initiates Wise KYC
- Response: `{ offRampAccountId, kycStatus, nextSteps }`

**POST /api/humans/:humanId/offramp/withdraw** (Human-only)
```json
{
  "amountUsdc": 250,
  "offRampAccountId": "..."
}
```
- Validates wallet balance
- Initiates withdrawal on-chain (bridge USDC from wallet)
- Creates OffRampTransaction with status=pending
- Response: `{ withdrawalId, estimatedAmount, fee, completedBy }`

**GET /api/humans/:humanId/payment-readiness** (Agent-only, public API)
```
```
- Returns: `{ walletAddress, hasFundedWallet, acceptsPayment: true/false, preferredPaymentMethod }`
- Signals if human is ready to receive payment

### Effort:** 2 weeks (Coinbase Pay + Wise API integration, KYC flow, on-chain bridge logic)

**Dependencies:**
- Wise API account + keys
- Coinbase Pay setup

**Score Impact:** +1 (eliminates crypto barrier; signals payment readiness)

---

## 8. Bulk Job Posting API
**One-liner:** POST /api/listings/bulk - agents post 1 listing, up to 100 humans apply; simple FIFO acceptance.

**Why It Moves the Needle:**
- Common use case: "Find 5 photographers in SF this weekend"
- Agents don't manually create 5 separate jobs
- Humans see higher-value opportunities (bulk work)
- Increases job volume perception

**Technical Spec:**

### Endpoint Extension
```
POST /api/listings/bulk

{
  "title": "Product Photography - 20 items",
  "description": "Need 20 product shots for e-commerce website...",
  "skills": ["photography", "product", "ecommerce"],
  "targetCount": 5,  // Accept up to 5 humans
  "pricePerUnit": 100,
  "totalBudget": 500,
  "deadline": "2026-04-05",
  ...
}
```

### Listing Model Addition
```prisma
// Add to Listing:
isBulk              Boolean    @default(false)
targetCount         Int?       // Max humans to accept
acceptedCount       Int        @default(0)  // Running count
totalBudget         Decimal?   @db.Decimal(18, 6)
pricePerUnit        Decimal?   @db.Decimal(18, 6)
```

### Response
```json
{
  "listingId": "list_bulk_123",
  "url": "https://humanpages.io/listings/list_bulk_123",
  "isBulk": true,
  "targetCount": 5,
  "maxApplications": 50  // Arbitrary cap
}
```

### Acceptance Logic
- When agent calls POST /api/listings/:listingId/applications/:appId with action=accept
- Check if acceptedCount < targetCount
- If yes: create Job, increment acceptedCount
- If no: reject with "Listing is full"
- Update Listing.status = CLOSED when acceptedCount == targetCount

### Effort:** 0.5 weeks (minor API/schema changes)

**Dependencies:**
- None (leverages existing Listing infrastructure)

**Score Impact:** +0.5 (improves job volume, enables bulk hiring)

---

## 9. Supply Marketplace Analysis
**One-liner:** Dashboard showing supply gaps (which skills lack humans; which locations are thin) + growth levers.

**Why It Moves the Needle:**
- Identifies bottlenecks: "Only 3 drone operators in Nigeria"
- Data-driven supply acquisition
- Agents see supply depth before signing up

**Technical Spec:**

### New Admin Dashboard Endpoints

**GET /api/admin/supply-analysis** (Admin-only)
```
?period=7d|30d|90d
```
- Returns:
```json
{
  "totalHumans": 1500,
  "activeHumans": 800,  // Logged in last 30d
  "skillGaps": [
    { "skill": "drone_operator", "count": 3, "demand": 45 },
    { "skill": "photographer", "count": 120, "demand": 200 }
  ],
  "locationGaps": [
    { "location": "Lagos, NG", "humans": 5, "jobOffers": 50, "acceptanceRate": 0.4 },
    { "location": "San Francisco, CA", "humans": 180, "jobOffers": 200, "acceptanceRate": 0.8 }
  ],
  "growthMetrics": {
    "newHumansLastWeek": 42,
    "completedJobsLastWeek": 120,
    "totalUsdc": 45000
  }
}
```

### Supply Gap Formula
```
gap_score = (demand - supply) / max(1, supply) * 100

High-gap skills/locations = targets for growth campaigns
```

### Effort:** 0.5 weeks (aggregation queries)

**Dependencies:**
- None

**Score Impact:** +0.25 (strategic info, not directly user-facing)

---

# PHASE 3: Category-Defining Features for 9+/10 (2 weeks)

## 10. Availability Calendar + Task Scheduling
**One-liner:** Humans post availability (time slots, weekly calendar); agents search by "next available" and schedule task.

**Why It Moves the Needle:**
- Reduces job rejection rate (humans can't do tasks next week)
- Enables scheduled tasks ("need someone Friday 2pm EST")
- Human: "I work Mon-Wed 9am-5pm EST" (discovery signal)
- Agent: Can filter for "available this Friday"

**Technical Spec:**

### Data Model
```prisma
model AvailabilitySlot {
  id            String    @id @default(cuid())
  humanId       String

  // Recurring or one-off
  recurring     Boolean   @default(false)
  recurrence    String?   // "weekly", "daily", null = one-off

  // Time window
  dayOfWeek     Int?      // 0-6 (Monday-Sunday), null = specific date
  date          DateTime? // For one-off slots

  startTime     String    // "09:00" (local timezone)
  endTime       String    // "17:00"

  // Capacity
  capacityHours Int       // How many job hours available in this slot

  // Metadata
  timezone      String    // Human's timezone (IANA format)
  tags          String[]  // "remote", "local", "flexible", etc.

  status        String    @default("ACTIVE")  // "ACTIVE", "BOOKED", "EXPIRED"

  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  human         Human     @relation(fields: [humanId], references: [id], onDelete: Cascade)

  @@index([humanId, dayOfWeek])
  @@index([status])
}

// Add to Job:
scheduledStartAt DateTime?  // When human agreed to work
scheduledEndAt   DateTime?
```

### API Endpoints

**POST /api/humans/:humanId/availability** (Human-only)
```json
{
  "dayOfWeek": 1,  // Monday
  "startTime": "09:00",
  "endTime": "17:00",
  "timezone": "America/New_York",
  "capacityHours": 8,
  "recurring": true,
  "tags": ["remote", "flexible"]
}
```
- Creates recurring weekly slot
- Response: `{ slotId }`

**GET /api/humans/availability-search** (Agent-only)
```
?date=2026-04-01&startTime=14:00&endTime=16:00&skill=photography&location=SF
```
- Returns humans available on that date/time with matching skills
- Response: `{ humans: [{ id, name, availability, quality, rate }] }`

**POST /api/jobs/:jobId/schedule** (Agent-only)
```json
{
  "scheduledStartAt": "2026-04-01T14:00:00Z",
  "scheduledEndAt": "2026-04-01T16:00:00Z",
  "notes": "Please confirm this time works"
}
```
- Updates Job.scheduledStartAt/EndAt
- Notifies human of proposed schedule
- Human can confirm or suggest alternative
- Response: `{ jobId, scheduledStartAt }`

**Effort:** 1.5 weeks (Prisma schema, availability queries, calendar UI)

**Dependencies:**
- None

**Score Impact:** +1 (enables predictable scheduling; improves acceptance rate)

---

## 11. AI-Generated Job Descriptions + Verification
**One-liner:** Agent provides bare minimum (skill + budget); Claude generates full job description; human verifies clarity before accepting.

**Why It Moves the Needle:**
- Agents with poor writing skills still get good matches
- Humans see clearer expectations (fewer disputes)
- Auto-generates estimates of work scope ("Should take 4-6 hours")
- Reduces offer rejections due to unclear description

**Technical Spec:**

### New Fields
```prisma
// Add to Job:
descriptionSource  String?  // "agent", "ai", "human_refined"
aiGeneratedDescription String?
aiGeneratedDuration String? // "4-6 hours", "1 day", "3 days"
humanFeedback      String?  // Human's clarification request
```

### Endpoint
**POST /api/jobs/:jobId/refine-description** (Agent-only, called before human sees offer)
```json
{
  "skill": "photography",
  "budget": 500,
  "context": "E-commerce product shots",
  "anythingElse": "Need white background, 3 angles per item"
}
```
- Calls Claude API: "Generate a job description for..."
- Returns: `{ aiGeneratedDescription, estimatedDuration, clarityScore }`
- Agent can edit before offering to human

**POST /api/jobs/:jobId/clarity-check** (Human-only, optional before accepting)
```json
{
  "questionOrClarification": "Do you want indoor or outdoor shots?"
}
```
- Adds to job messages
- Agent responds
- Human can then accept with confidence
- Response: `{ added }`

**Effort:** 1 week (Claude API integration, prompt engineering)

**Dependencies:**
- OpenAI or Claude API access

**Score Impact:** +0.5 (improves clarity, reduces disputes)

---

## 12. Autonomous Agent Verification + Whitelist
**One-liner:** Agents register with Coinbase AgentKit; verified agents bypass rate limits + get search ranking boost.

**Why It Moves the Needle:**
- Legitimate agents get rewards (no rate limiting)
- Spam/low-quality agents throttled
- Verified badge increases human trust
- Self-reinforcing: serious agents only

**Technical Spec:**

### Data Model
```prisma
enum AgentVerificationStatus {
  UNVERIFIED
  PENDING
  VERIFIED
  SUSPENDED
}

// Add to Agent:
verificationStatus    AgentVerificationStatus @default(UNVERIFIED)
coinbaseAgentId       String?  @unique        // From AgentKit registration
verificationToken     String?  @unique        // One-time link for verification
verifiedAt            DateTime?
</SubmissionMethod     String?                 // "agentkit", "manual", "api_key"

// Update Job, Listing:
postedByVerifiedAgent Boolean?  // Denormalized for search ranking
```

### Verification Flow
1. Agent calls `/api/agents/register` with Coinbase AgentKit credentials
2. We validate the credentials with Coinbase API
3. Mark as VERIFIED
4. Rate limits lifted: 1000 offers/day instead of 30
5. Humans see "Verified Agent" badge on job offers

### API Changes
```
GET /api/humans/search
  ?agentVerified=true  // Only show jobs from verified agents
```

**Effort:** 1 week (AgentKit verification, rate limit logic, UI updates)

**Dependencies:**
- Coinbase AgentKit API access

**Score Impact:** +1 (enables scaling; improves job quality signal)

---

# ROADMAP SEQUENCING & TIMELINE

## Critical Path to 9+/10

### Week 1-2 (Phase 1A)
1. Escrow + Dispute Resolution ← **Blocker for trust**
2. Pre-Hire Verification (Portfolio + ID check) ← **Enables risk assessment**

### Week 3-4 (Phase 1B)
3. Agent Reputation + Reverse Ratings ← **Balances power**
4. Human Job Browsing (Listings + Applications) ← **Decouples supply**

### Week 5-6 (Phase 2A)
5. Webhooks + Async API ← **Enables integration**
6. Quality Scoring Algorithm ← **Improves search ranking**

### Week 7 (Phase 2B)
7. Wallet Onboarding (On-ramp + Off-ramp) ← **Removes crypto friction**
8. Bulk Job Posting ← **Increases job volume**

### Week 8 (Phase 2C)
9. Supply Analysis Dashboard ← **Strategic data**

### Week 9-10 (Phase 3)
10. Availability Calendar ← **Improves scheduling**
11. AI-Generated Job Descriptions ← **Reduces disputes**
12. Agent Verification ← **Enables scaling**

---

# Effort & Dependency Summary

| Feature | Effort | Score Δ | Dependencies | Critical Path? |
|---------|--------|---------|--------------|----------------|
| 1. Escrow + Disputes | 2 wks | +2.5 | Privy wallet API | YES |
| 2. Pre-Hire Verification | 2 wks | +1.5 | Midata/Stripe | YES |
| 3. Agent Ratings | 1.5 wks | +1 | None | NO (nice-to-have) |
| 4. Human Job Browsing | 2.5 wks | +1.5 | None | NO (but increases supply) |
| 5. Webhooks | 1.5 wks | +1 | Queue system | YES (for integration) |
| 6. Quality Scoring | 1 wk | +0.5 | None | NO (improves ranking) |
| 7. Wallet On/Off-Ramp | 2 wks | +1 | Coinbase Pay, Wise | YES (removes friction) |
| 8. Bulk Job Posting | 0.5 wks | +0.5 | None | NO (improves perception) |
| 9. Supply Analysis | 0.5 wks | +0.25 | None | NO (strategic) |
| 10. Availability Calendar | 1.5 wks | +1 | None | NO (improves acceptance) |
| 11. AI Job Descriptions | 1 wk | +0.5 | Claude API | NO (reduces disputes) |
| 12. Agent Verification | 1 wk | +1 | AgentKit | NO (scaling) |
| **TOTAL** | **~17 wks** | **+12** | — | — |

---

# Score Progression

```
Current:  5/10
After Phase 1A (Escrow + Verification):        7.0/10
After Phase 1B (Ratings + Listings):           8.0/10  ← MVP for scale
After Phase 2A (Webhooks + Quality):           8.5/10
After Phase 2B (On-ramp + Bulk):               9.0/10
After Phase 2C (Analysis):                     9.1/10
After Phase 3 (Calendar + AI + Verify):        9.5/10
```

---

# Success Metrics (CTO Dashboard)

Once all features ship, track:

1. **Supply Quality**
   - Humans with portfolio: >70%
   - ID verified: >40%
   - QualityScore >70: >30%

2. **Job Success**
   - Acceptance rate: >60% (currently ~30%)
   - Completion rate: >90%
   - Dispute rate: <2%
   - Avg rating: >4.5/5

3. **Agent Confidence**
   - Jobs $500+: >30% of volume (currently ~5%)
   - Repeat agents: >50% (currently ~20%)
   - Webhook usage: >60% of active agents
   - Escrow usage: >70% of jobs $100+

4. **Market Depth**
   - 10,000+ humans in 12 months
   - <2s search response (no zero-hit searches)
   - 50+ skills with 5+ humans each

5. **Unit Economics**
   - Avg job: $250 (currently $100)
   - Monthly active humans: 5,000+
   - Monthly active agents: 200+

---

# Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Escrow requires on-chain fund management | Use Privy (already integrated) + Treasury multi-sig |
| Dispute resolution is manual | Build admin tooling; scale to community arbiter model later |
| Wallet on-ramp adds friction | Offer fiat payment alternative (Stripe Connect) in future |
| AI job descriptions may be generic | Let agent refine; don't replace their intent |
| Supply still thin after Phase 1 | Run parallel growth campaign (TG outreach, referral rewards) |
| Verification (ID checks) slows supply | Make optional; prioritize in search, don't gate access |

---

# Implementation Notes

## Single Point of Truth
All features **must** update `shared/profile-schema.json` when adding fields or enums. The schema is canonical.

## API Layer
- Add all endpoints to `backend/src/routes/` (new `escrow.ts`, `listings.ts`, `verification.ts`)
- Update MCP server: `agentkit/src/humanpagesActionProvider.ts` with new actions
- All endpoints must be Agent-authenticated (existing middleware)

## Testing
- New Prisma models require migrations: `prisma migrate dev --name <feature>`
- Add fixtures in `backend/src/tests/fixtures/` for each model
- Write unit + integration tests (vitest)
- E2E tests for critical paths (e2e/*.ts)

## Deployment
- Use `PUSH_LITE=1 git push` to skip heavy e2e during heavy hook failure phases
- Webhook delivery has exponential backoff; won't overload agents

---

# Go-to-Market

Once all features complete (8/10 internally), target messaging:

**For Agents:**
> "Deploy jobs with confidence. Escrow protects both sides. Humans verified. Real-time webhooks. No middleman fees."

**For Humans:**
> "Curated jobs. Browse, apply, or wait for offers. Get paid instantly in crypto or cash out to your bank. Clear expectations."

**For the Industry:**
> "HumanPages: The agent economy's labor marketplace."

---

# Appendix: MCP Tools Full List (After All Features)

### Current (10 tools)
1. search_humans
2. view_human_profile
3. create_job_offer
4. get_job_status
5. mark_job_paid
6. create_listing
7. browse_listings
8. leave_review
9. send_job_message
10. get_job_messages

### New (12 tools)
11. create_job_with_escrow
12. escrow_approve
13. escrow_dispute
14. view_human_portfolio
15. request_identity_verification
16. search_humans_verified
17. leave_agent_review
18. view_agent_reputation
19. block_agent
20. post_job_listing
21. browse_job_listings
22. view_listing_applications
23. accept_application
24. subscribe_to_webhooks
25. get_webhook_deliveries
26. search_humans_by_availability
27. schedule_job
28. generate_job_description
29. register_agent_verified

**Total: 29 MCP tools** (vs. 10 today) — comprehensive agentic interface

---

**Document prepared by:** Product Architecture Team
**Status:** Ready for engineering review
**Next Step:** Begin Phase 1A (Weeks 1-2)
