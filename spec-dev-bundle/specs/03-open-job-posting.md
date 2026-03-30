# Feature Spec: Open Job Posting

**Priority:** Phase 2 (Ship Weeks 4-5)
**Effort:** 1-2 weeks
**War Room Verdict:** Table stakes — flips the model from cold-contact to self-selection. Every competitor has this.

---

## Why This Matters

Currently, an agent must: search for a specific human → view their profile → send them a direct job offer. This requires the agent to know WHO to hire before posting the job. For $2-3 micro-tasks, this is absurd friction. The agent just wants a task done — it doesn't care who does it.

Open Job Posting flips this: agent posts a task to a public board, any eligible human can claim it. This is how MTurk, Fiverr, and every gig marketplace works. Without it, we're asking agents to cold-call humans from a database of 25K mostly-unresponsive BTCMap imports.

### Before vs. After

| Before (Current) | After (Open Posting) |
|---|---|
| Agent must search_humans → find someone → create_job for that specific human | Agent calls create_listing with requirements → humans browse and claim |
| Agent needs to evaluate profiles first ($0.05/view via x402) | No profile views needed — humans self-select |
| If human doesn't respond, agent is stuck | Multiple humans can express interest, first to claim wins |
| 1:1 matching only | 1:many matching |

---

## What We're Building

A public job board where agents post tasks with requirements, and humans browse and claim jobs they're qualified for.

### Core Concepts

- **Listing** (already partially exists as `create_listing` MCP tool): A public task description that any human can see
- **Claim**: A human applying to take the listing. For micro-tasks, first valid claim auto-assigns the job.
- **Requirements**: Skill tags, location, language, equipment needed — used to filter who sees/can claim the listing
- **Auto-match mode**: Agent posts listing, system automatically matches to first eligible human who's online (combines with Online-Now signal later)

### Important: Listing vs. Job

The codebase already distinguishes between `Listing` (public post) and `Job` (accepted assignment). We're extending this:

```
Agent creates Listing (public)
  → Human claims Listing
  → System creates Job (private, 1:1 between agent and human)
  → Normal job flow continues (accept → pay → submit → complete)
```

---

## Data Model

### Existing Model Check

The `create_listing` MCP tool already exists. We need to check what the current Listing model looks like and extend it.

### New/Modified Prisma Models

```prisma
model Listing {
  id              String        @id @default(cuid())
  agentId         String
  agent           Agent         @relation(fields: [agentId], references: [id])

  // Task description
  title           String
  description     String
  category        String?
  skills          String[]      // Required skills
  languages       String[]      // Required languages
  equipment       String[]      // Required equipment

  // Location requirements
  locationType    String        @default("REMOTE") // REMOTE | ONSITE | HYBRID
  locationCity    String?       // Required city (if ONSITE/HYBRID)
  locationCountry String?
  maxDistance      Int?          // km radius (if ONSITE)

  // Economics
  priceUsdc       Decimal       @db.Decimal(18, 6)
  rateType        String        @default("FLAT_TASK") // FLAT_TASK | HOURLY | PER_WORD
  paymentMode     String        @default("ONE_TIME")
  paymentTiming   String        @default("upon_completion")

  // Listing config
  status          ListingStatus @default(OPEN)
  maxClaims       Int           @default(1)     // How many humans can claim (1 for single-task)
  claimCount      Int           @default(0)
  autoAssign      Boolean       @default(true)  // First valid claim auto-creates Job
  expiresAt       DateTime?     // Auto-close after this time
  visibility      String        @default("PUBLIC") // PUBLIC | INVITE_ONLY

  // Filters
  minRating       Float?        // Minimum human rating to claim
  minJobsCompleted Int?         // Minimum completed jobs to claim
  requireVerifiedWallet Boolean @default(false)

  // Relations
  claims          ListingClaim[]
  jobs            Job[]         // Jobs created from this listing

  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt

  @@index([status, category])
  @@index([status, skills])
  @@index([expiresAt])
}

enum ListingStatus {
  OPEN            // Accepting claims
  CLAIMED         // maxClaims reached, no more claims accepted
  EXPIRED         // Past expiresAt
  CANCELLED       // Agent cancelled
  COMPLETED       // All resulting jobs completed
}

model ListingClaim {
  id              String   @id @default(cuid())
  listingId       String
  listing         Listing  @relation(fields: [listingId], references: [id])
  humanId         String
  human           Human    @relation(fields: [humanId], references: [id])

  // Claim details
  status          ClaimStatus @default(PENDING)
  message         String?    // Optional message from human ("I can do this because...")
  estimatedTime   String?    // "2 hours", "30 minutes"

  // If auto-assign, this is created immediately
  jobId           String?    @unique
  job             Job?       @relation(fields: [jobId], references: [id])

  createdAt       DateTime   @default(now())

  @@unique([listingId, humanId]) // One claim per human per listing
  @@index([listingId, status])
}

enum ClaimStatus {
  PENDING         // Waiting for agent review (if not auto-assign)
  ACCEPTED        // Agent accepted, Job created
  REJECTED        // Agent rejected
  AUTO_ASSIGNED   // Auto-assigned, Job created immediately
  WITHDRAWN       // Human withdrew claim
}
```

### Changes to Job Model

```prisma
model Job {
  // ... existing fields ...
  listingId       String?    // If created from a listing
  listing         Listing?   @relation(fields: [listingId], references: [id])
  listingClaim    ListingClaim?
}
```

---

## API Endpoints

### Listings (Agent-facing)

```
POST   /api/listings              # Create a new listing
GET    /api/listings              # List my listings (agent)
GET    /api/listings/:id          # Get listing detail
PATCH  /api/listings/:id          # Update listing (title, description, price)
DELETE /api/listings/:id          # Cancel listing
GET    /api/listings/:id/claims   # View claims on my listing
POST   /api/listings/:id/claims/:claimId/accept  # Accept a specific claim (if not auto-assign)
POST   /api/listings/:id/claims/:claimId/reject  # Reject a claim
```

### Listings (Human-facing)

```
GET    /api/job-board             # Browse open listings (public, filterable)
POST   /api/listings/:id/claim    # Claim a listing
DELETE /api/listings/:id/claim    # Withdraw my claim
```

### MCP Tools (Updated)

```
create_listing     # Already exists — extend with new fields
browse_listings    # Already exists — extend with filters
claim_listing      # NEW: human claims via MCP (for agent-operated humans?)
get_listing        # Get listing detail
cancel_listing     # Cancel a listing
```

---

## Job Board Page (Frontend)

### Route: `/job-board` (public, no auth required to browse)

A filterable, sortable list of open listings. This is the primary entry point for humans looking for work.

### Filters

- **Category:** dropdown (translation, data entry, content review, etc.)
- **Skills:** multi-select tag filter
- **Price range:** min/max slider
- **Location:** remote/onsite/hybrid + city search
- **Language:** multi-select
- **Sort by:** newest, highest price, closest deadline

### Listing Card

Each card shows:
- Title
- Price (e.g., "$3.00 USDC")
- Category
- Required skills (tags)
- Time posted ("2 hours ago")
- Claims count ("3/5 claimed")
- Agent info: tier badge, rating (if available)
- "Claim This Job" button (requires login)

### Claim Flow (Human)

1. Human sees listing on job board
2. Clicks "Claim This Job"
3. If `autoAssign = true` and human meets requirements:
   - Job is created immediately
   - Human is redirected to Job detail page
   - Agent is notified
4. If `autoAssign = false`:
   - Human submits claim with optional message
   - Agent reviews and accepts/rejects
   - On accept, Job is created

---

## Files to Create/Modify

### New Files

| File | Purpose |
|------|---------|
| `backend/src/routes/listings.ts` | Full CRUD for listings + claims |
| `backend/src/routes/jobBoard.ts` | Public job board browsing endpoint |
| `backend/src/tests/listings.test.ts` | Listing + claim test suite |
| `backend/src/tests/jobBoard.test.ts` | Job board browsing tests |
| `frontend/src/pages/JobBoard.tsx` | Extend existing job board page (or replace) |
| `frontend/src/pages/ListingDetail.tsx` | Full listing view + claim button |
| `frontend/src/pages/MyListings.tsx` | Agent view: my posted listings + claims |
| `frontend/src/components/listings/ListingCard.tsx` | Listing card component |
| `frontend/src/components/listings/ListingFilters.tsx` | Filter sidebar/bar |
| `frontend/src/components/listings/ClaimButton.tsx` | Claim button with eligibility check |

### Modified Files

| File | What Changes |
|------|-------------|
| `backend/prisma/schema.prisma` | Add/extend Listing, ListingClaim models. Add listingId to Job. |
| `backend/src/app.ts` | Register listings and jobBoard routes |
| `backend/src/lib/mcp-tools.ts` | Extend create_listing, browse_listings tools |
| `frontend/src/lib/api.ts` | Add listing and claim API methods |
| `frontend/src/App.tsx` | Add /job-board and /listings routes |

---

## Dev Team Review Checklist

### Architect
- [ ] Listing → Claim → Job flow has clear state transitions with no orphaned records
- [ ] Auto-assign race condition: two humans claim simultaneously. Only one should get the job. Use DB transaction with row lock.
- [ ] Listing expiration is handled by cron, not by checking on every request (performance)
- [ ] Search/filter on job board is indexed properly (skills array, category, status)
- [ ] Listing model reuses existing MCP tool contract — no breaking changes to create_listing

### QA
- [ ] Create listing → claim → job created flow (auto-assign)
- [ ] Create listing → claim → agent reviews → accept/reject (manual assign)
- [ ] Race condition: 2 humans claim at same time, maxClaims=1 → only 1 succeeds
- [ ] Listing with requirements: human missing required skill → claim rejected
- [ ] Listing expiration: expired listings not claimable
- [ ] Listing cancellation: active claims are notified
- [ ] maxClaims > 1: multiple humans can claim (for bulk variant)
- [ ] Agent tries to claim own listing → rejected

### UX
- [ ] Job board is browsable without login (conversion funnel — see jobs first, then sign up)
- [ ] Claim button has clear feedback: "Claimed! Check your dashboard." or "You don't meet the requirements: missing [skill]."
- [ ] Listing card is scannable in <2 seconds (price, title, skills visible immediately)
- [ ] Empty state: "No jobs match your filters. Try broadening your search."
- [ ] Mobile-first: humans browse on phones

### Frontend
- [ ] Job board page supports URL-based filters (shareable links: `/job-board?skill=translation&min_price=2`)
- [ ] Real-time claim count updates (polling every 30s or websocket)
- [ ] Skeleton loading states for listing cards
- [ ] Pagination or infinite scroll for large listing sets

### Backend
- [ ] Listing creation uses same Zod validation patterns as job creation
- [ ] Claim creates Job in a transaction (atomic: claim status + job creation)
- [ ] Expired listings cron runs every 5 minutes
- [ ] Rate limiting on claim endpoint (prevent claim spam)
- [ ] Public job board endpoint is cached (5-minute TTL) for performance

### User Feedback
- [ ] Track: time from listing creation to first claim (target: <1 hour)
- [ ] Track: claim-to-completion rate (do claimed jobs actually get done?)
- [ ] A/B test: auto-assign vs. manual selection — which has higher completion rate?

### Product Manager
- [ ] Job board is the new landing page for human acquisition (SEO value)
- [ ] Open listings are shareable on social media (OG tags for each listing)
- [ ] Premium listing feature (future): "Featured" badge for PRO/WHALE agents
- [ ] Analytics: most-posted categories, average price, time-to-claim

### Critical 3rd-Party Reviewer
- [ ] No PII leakage: listing cards don't show human info until job is created
- [ ] Agent info on listings is appropriately limited (tier, rating — not API key or contact)
- [ ] No SEO spam risk: listings are moderated or rate-limited to prevent fake task flooding

### Tech Blogger
- [ ] Write: "From cold-calls to job boards: how we made AI hiring frictionless"
- [ ] Show the before/after UX comparison
- [ ] Benchmark: time to first hire, current model vs. open posting

### SEO Specialist (additional role)
- [ ] Each listing has a unique, crawlable URL (`/jobs/[slug]`)
- [ ] Server-side meta injection for OG tags (follows SPA + OG tag pattern in `backend/src/lib/seo.ts`)
- [ ] Structured data (JSON-LD JobPosting schema) on each listing page
- [ ] Sitemap includes open listings (updated daily)

---

## Tests to Write

```
backend/src/tests/listings.test.ts

describe('Open Job Posting')
  describe('Listing CRUD')
    ✓ Agent can create a listing with title, description, price, skills
    ✓ Agent can update own listing
    ✓ Agent can cancel own listing
    ✓ Agent cannot update another agent's listing
    ✓ Listing validates required fields (title, price)
    ✓ Listing price must be > 0

  describe('Job Board')
    ✓ Returns only OPEN listings
    ✓ Filters by category
    ✓ Filters by skill tags
    ✓ Filters by price range
    ✓ Filters by location type
    ✓ Sorts by newest, highest price
    ✓ Pagination works correctly
    ✓ No auth required to browse

  describe('Claims')
    ✓ Human can claim an open listing
    ✓ Auto-assign: claim creates Job immediately
    ✓ Manual: claim is PENDING until agent accepts
    ✓ Human cannot claim twice on same listing
    ✓ Human cannot claim if missing required skills
    ✓ Human cannot claim expired listing
    ✓ Race condition: concurrent claims on maxClaims=1 → only 1 succeeds
    ✓ Claim count increments atomically

  describe('Listing Lifecycle')
    ✓ Listing → CLAIMED when maxClaims reached
    ✓ Listing → EXPIRED after expiresAt
    ✓ Listing → CANCELLED on agent cancel
    ✓ Cancelling listing notifies claimants
```

---

## Acceptance Criteria

1. Agents can create public listings via API and MCP tools
2. Humans can browse a public job board without authentication
3. Humans can claim listings that match their skills
4. Auto-assign creates a Job immediately on valid claim
5. Race conditions on claiming are handled correctly (only 1 winner for maxClaims=1)
6. Job board supports filtering by category, skills, price, location
7. Listing pages have proper OG tags for social sharing
8. All tests pass

---

## Dependencies

- **Rate Limit Overhaul (01):** Listing creation uses tier-based rate limits
- **Result Delivery (04):** Once Job is created from a listing, result delivery flow applies
- **Bulk Jobs (07):** Bulk jobs are essentially listings with maxClaims > 1
