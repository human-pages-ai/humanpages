# On-Chain Trust System Implementation Checklist

**Status**: Ready for Sprint Planning
**Estimated Duration**: 4-6 weeks (20-30 dev days with 2-3 engineers)
**Start Date**: When approved
**Dependencies**: Existing codebase (Prisma, Express, React, Privy)

---

## Phase 1: On-Chain Reputation Score (Weeks 1-2)

### Smart Contract: HumanPagesReputation.sol

- [ ] **Setup**
  - [ ] Create `/backend/contracts` directory
  - [ ] Install Hardhat (or existing Web3 tooling)
  - [ ] Setup: `solc` 0.8.20, OpenZeppelin 5.0

- [ ] **Contract Development** (4-5 days)
  - [ ] Implement `HumanReputation` struct (6 fields: feedback count, last time, cumulative rating, jobs, disputes, hash)
  - [ ] Implement `giveFeedback()` function (onlyOracle)
  - [ ] Implement `getReputationScore()` view function
  - [ ] Implement `getPaymentHistory()` view function (stub for Phase 2)
  - [ ] Emit `PaymentRecorded` event
  - [ ] Add owner/oracle access control (Ownable pattern)
  - [ ] Write unit tests (8-10 test cases)
  - [ ] Gas optimization pass

- [ ] **Contract Deployment**
  - [ ] Deploy to Base Sepolia testnet
  - [ ] Record contract address in `.env`
  - [ ] Verify on BaseScan
  - [ ] Setup Etherscan API key for verification

### Backend: Oracle Bridge

- [ ] **Database Migrations**
  - [ ] Add `Review.publishedToBlockchain: Boolean` field (default: false)
  - [ ] Add `Review.publishedAt: DateTime?` field
  - [ ] Add `Human.onChainReputationAddress: String?` field
  - [ ] Create migration: `npx prisma migrate dev --name add_blockchain_fields`

- [ ] **API Endpoints** (2-3 days)
  - [ ] `POST /api/jobs/{id}/review` (existing, no changes)
  - [ ] `GET /api/humans/:id/reputation/on-chain` (new)
    ```typescript
    // Returns data from smart contract, with RPC call
    {
      score: 72,
      tier: "trusted",
      jobsCompleted: 15,
      avgRating: 4.6,
      reviewCount: 15,
      totalDisputesResolved: 2,
      contractAddress: "0x...",
      lastActivityBlockNumber: 19543210,
      explorerUrl: "https://basescan.org/address/0x..."
    }
    ```
  - [ ] `POST /api/reputation/publish-reviews` (internal, admin only)
    - Publishes batch of unpublished reviews to blockchain
    - Called by: Weekly cron job

- [ ] **Oracle Job** (1 day)
  - [ ] Create `/backend/src/jobs/publishReviewsToBlockchain.ts`
  - [ ] Cron: Run every Sunday at 02:00 UTC
  - [ ] Logic:
    1. Query: `Review.findMany({ where: { publishedToBlockchain: false } })`
    2. Batch into groups of 10 (gas efficiency)
    3. For each review:
       - Call contract: `giveFeedback(human.walletAddress, rating, category, hash)`
       - Verify tx confirmation (wait for 5 blocks)
       - Update: `Review.publishedToBlockchain = true, publishedAt = now()`
    4. Error handling: If tx fails, queue for retry (next run)
    5. Log each batch: "Published 47 reviews to contract 0x..."

- [ ] **RPC Integration**
  - [ ] Use Alchemy SDK for contract calls
  - [ ] Implement caching: Call RPC every 1 hour max (store last reputation in DB)
  - [ ] Fallback: If RPC fails, return cached DB data

### Frontend: Blockchain Badges

- [ ] **Profile Display Changes**
  - [ ] Add "On-Chain Reputation" section to `PublicProfile` component
  - [ ] Show: score, tier, "Last verified: 2 hours ago"
  - [ ] Link to contract on BaseScan
  - [ ] Show feedback count + avg rating (from on-chain)

- [ ] **Dashboard Changes**
  - [ ] Add stats card: "Blockchain Verified Reviews: 15"
  - [ ] Add chart: Reputation score history (weekly snapshots)

### Testing

- [ ] **Unit Tests**
  - [ ] `Oracle Job` tests: Mock Prisma, verify batch publishing
  - [ ] `RPC calls` tests: Mock Alchemy, verify retry logic
  - [ ] Endpoint tests: `GET /api/humans/:id/reputation/on-chain`

- [ ] **Integration Tests**
  - [ ] Create review → Wait 1 hour → Verify on-chain
  - [ ] Network failure → Retry next run → Verify recovery

- [ ] **Manual Testing**
  - [ ] [ ] Deploy to Base Sepolia
  - [ ] [ ] Create 10 test humans with 2-5 reviews each
  - [ ] [ ] Run oracle job, verify all published
  - [ ] [ ] Call contract directly: `getReputationScore(testHumanAddress)`
  - [ ] [ ] Verify BaseScan shows event logs

---

## Phase 2: Payment History Transparency (Weeks 1-2, runs parallel with Phase 1)

### Database Schema

- [ ] **Add fields**
  - [ ] `Human.sharePaymentHistory: Boolean` (default: false)
  - [ ] `Human.paymentHistorySince: DateTime?` (only show after this date)
  - [ ] `Human.totalJobsCompletedDenorm: Int` (recomputed daily)
  - [ ] `Human.totalUSDCEarnedDenorm: Decimal` (recomputed daily)
  - [ ] `Human.lastPaymentAt: DateTime?`
  - [ ] `Human.paymentNetworks: String[]` (enum: ["ethereum", "base", "polygon", "arbitrum"])
  - [ ] `Job.paymentVerifiedAt: DateTime?` (when we last verified on RPC)
  - [ ] `Job.paymentVerificationMethod: String?` (enum: "rpc", "subgraph", "receipt")

- [ ] **Create migration**
  - [ ] `npx prisma migrate dev --name add_payment_history_fields`

### APIs (2-3 days)

- [ ] **GET /api/humans/:id/payment-history**
  - [ ] Requires: Public IF `sharePaymentHistory == true`; else authenticated only
  - [ ] Returns:
    ```typescript
    {
      human: { id, name, address },
      summary: {
        totalJobsCompleted: 15,
        totalAmountUSDC: 5000,
        avgJobValue: 333,
        networks: ["base", "ethereum"],
        lastPaymentDate: "2026-03-15T10:30:00Z"
      },
      payments: [
        {
          jobId: "cuid",
          jobTitle: "Website design",
          amount: 500,
          network: "base",
          txHash: "0xabc123...",
          explorerUrl: "https://basescan.org/tx/0xabc123",
          confirmedAt: "2026-03-15T10:30:00Z",
          category: "design"
        }
      ],
      verification: {
        blockchainVerified: true,
        contractAddress: "0x...",
        onChainLastUpdate: "2026-03-15T09:00:00Z"
      }
    }
    ```
  - [ ] Filtering:
    - [ ] By date range: `?from=2026-01-01&to=2026-03-31`
    - [ ] By network: `?network=base`
    - [ ] Pagination: `?limit=20&offset=0`
  - [ ] Error cases:
    - [ ] 403 if `sharePaymentHistory == false` and not authenticated
    - [ ] 404 if human not found

- [ ] **GET /api/verify-payment/:txHash**
  - [ ] Public endpoint (no auth)
  - [ ] Params: `?network=base`
  - [ ] Returns:
    ```typescript
    {
      confirmed: true,
      txHash: "0x...",
      network: "base",
      amount: "500000000", // USDC smallest unit (6 decimals)
      recipient: "0x...",
      sender: "0x...",
      timestamp: 1710667800,
      blockNumber: 19543210,
      gasUsed: "50000",
      status: "success"
    }
    ```
  - [ ] Caching: Redis 1 hour (keyed by `txHash:network`)
  - [ ] Fallback: If RPC fails, check DB cache

- [ ] **PATCH /api/humans/me**
  - [ ] Existing endpoint, add new fields:
    - [ ] `sharePaymentHistory: boolean` (toggle)
    - [ ] `paymentHistorySince: string` (ISO date, optional)

### Backend Logic (2 days)

- [ ] **Payment History Query**
  - [ ] Build query in `humans.ts` or new file `payment-history.ts`
  - [ ] Filter: `Job.status == "COMPLETED" && Job.paymentTxHash exists && Job.paidAt`
  - [ ] If `sharePaymentHistory == true`: show all; else show only to authenticated owner
  - [ ] Order by `paidAt DESC`

- [ ] **Payment Verification (RPC)**
  - [ ] Implement `/lib/blockchain/verifyPaymentOnChain.ts`
  - [ ] Function: `verifyUSDCTransfer(txHash: string, network: string)`
  - [ ] Logic:
    1. Call `eth_getTransactionReceipt(txHash)` via Alchemy
    2. Parse receipt: check `status == "0x1"` (success)
    3. Decode input data: verify it's USDC transfer to human address
    4. Parse logs: extract amount from `Transfer` event
    5. Return: `{ confirmed, amount, sender, timestamp, blockNumber }`
  - [ ] Caching: Store result in Redis 1 hour
  - [ ] Error handling: Return `{ confirmed: false, error: "..." }` on RPC failure

- [ ] **Denormalization Job**
  - [ ] Create daily cron: `recomputePaymentTotals.ts`
  - [ ] For each human with `sharePaymentHistory == true`:
    1. Query completed jobs with `paymentTxHash`
    2. Sum amounts → `totalUSDCEarnedDenorm`
    3. Count → `totalJobsCompletedDenorm`
    4. Get max `paidAt` → `lastPaymentAt`
    5. Collect unique networks → `paymentNetworks`
    6. Update human record
  - [ ] Run nightly at 03:00 UTC

### Frontend (2 days)

- [ ] **Dashboard: My Payments Tab**
  - [ ] New component: `PaymentHistorySection.tsx`
  - [ ] Show table:
    - [ ] Job title, amount, network, date, status (confirmed), action (link to explorer)
  - [ ] Summary card: "Total earned: $5,000 across 15 jobs"
  - [ ] Filters: Date range, network selector
  - [ ] Privacy toggle: "Share payment history on public profile"
  - [ ] Icon alert: "Payment history is public and permanent"

- [ ] **Profile: Verification Badge**
  - [ ] If `sharePaymentHistory == true`:
    - [ ] Show "Verified Payments" badge on public profile
    - [ ] Link to `/profile/:id/payments` (public view)
  - [ ] If not shared:
    - [ ] Show "Payment history private" text (agents know to ask)

- [ ] **Payment Verification Tool**
  - [ ] New page: `/verify-payment`
  - [ ] Form: Paste txHash + select network
  - [ ] Button: "Verify on Blockchain"
  - [ ] Result:
    - [ ] ✓ "Payment confirmed: $500 USDC to 0x..."
    - [ ] ✗ "Payment not found or failed"

### Testing

- [ ] **Unit Tests**
  - [ ] `verifyUSDCTransfer()`: Mock Alchemy responses
    - [ ] [ ] Success case (status 0x1)
    - [ ] [ ] Failed tx (status 0x0)
    - [ ] [ ] Missing tx
  - [ ] Payment history query: Mock Prisma
    - [ ] [ ] Filter by network
    - [ ] [ ] Pagination
    - [ ] [ ] Privacy check

- [ ] **Integration Tests**
  - [ ] Complete job → Set paymentTxHash → Verify via API
  - [ ] Denormalization cron: Create 5 jobs, run cron, verify totals
  - [ ] RPC failure: Verify fallback to cached data

- [ ] **Manual Testing**
  - [ ] [ ] Create job, mark paid with real tx hash (Base Sepolia)
  - [ ] [ ] Call `/api/verify-payment` with that hash
  - [ ] [ ] Verify RPC returns correct details
  - [ ] [ ] Toggle `sharePaymentHistory` and verify visibility

---

## Phase 3: Progressive Trust Tiers (Week 3)

### Database Schema

- [ ] **Add fields**
  - [ ] `Job.requiredTrustTier: String` (enum: "new", "basic", "verified", "trusted"; default: "new")
  - [ ] `Job.requiredTrustMinimum: Int` (0-100; default: 0)
  - [ ] `Agent.maxJobValueByTier: Json` (default: `{"new": 20, "basic": 100, "verified": 500, "trusted": null}`)
  - [ ] `Agent.enforceJobLocks: Boolean` (default: true)

- [ ] **Create migration**

### APIs

- [ ] **POST /api/jobs** (Create job)
  - [ ] Add optional fields:
    - [ ] `requiredTrustTier?: "basic" | "verified" | "trusted"`
    - [ ] `requiredTrustMinimum?: number` (0-100)
  - [ ] Validation: If provided, must be >= 0

- [ ] **POST /api/jobs/:id/accept** (Existing endpoint)
  - [ ] Add check:
    ```typescript
    const human = await getHuman(humanId);
    const score = await computeTrustScore(humanId);
    const job = await getJob(jobId);

    if (score.score < job.requiredTrustMinimum) {
      return res.status(403).json({
        error: "insufficient_trust",
        currentScore: score.score,
        requiredScore: job.requiredTrustMinimum,
        currentTier: score.level,
        requiredTier: job.requiredTrustTier
      });
    }
    ```

- [ ] **GET /api/jobs/:id/can-accept** (New)
  - [ ] Returns:
    ```typescript
    {
      canAccept: boolean,
      reason?: "insufficient_trust" | "too_expensive" | "not_verified",
      currentScore: number,
      requiredScore: number,
      currentTier: "basic",
      requiredTier: "verified",
      nextMilestone: {
        targetScore: 35,
        jobsNeeded: 2,
        estimatedDaysToReach: 14
      }
    }
    ```

- [ ] **GET /api/agent/:id/job-policy** (New, for agents to set limits)
  - [ ] Returns current policy
  - [ ] Only accessible to agent owner

- [ ] **POST /api/agent/:id/job-policy** (New)
  - [ ] Set custom limits per tier
  - [ ] Example: `{ "new": 5, "basic": 50, "verified": 500, "trusted": null }`

### Frontend

- [ ] **Job Card Changes**
  - [ ] If job requires tier, show lock icon + tier name
  - [ ] Hover: "Requires: Verified (score 35+)"
  - [ ] If user can't accept: Badge: "Unlock at score 35"

- [ ] **Job Detail Page**
  - [ ] Add section: "Requirements"
  - [ ] Show: "Trust tier: Verified (you are: Basic, +11 points needed)"
  - [ ] Button: "Recommended path to unlock"
    - [ ] Shows 2-3 small jobs that would increase score

- [ ] **Profile: Trust Milestone**
  - [ ] Progress bar: "Basic (24/35) → Verified"
  - [ ] Text: "Complete 2 more jobs to unlock $500+ opportunities"
  - [ ] Recommended jobs: Sorted by lowest job value (to build trust fastest)

### Testing

- [ ] **Unit Tests**
  - [ ] Can-accept logic: Mock trust scores
    - [ ] [ ] Score below required
    - [ ] [ ] Score above required
    - [ ] [ ] Edge case: exactly at boundary

- [ ] **Integration Tests**
  - [ ] Create job with `requiredTrustTier: "verified"`
  - [ ] Try to accept as "basic" user → 403
  - [ ] Increase score to "verified" → Accept succeeds

---

## Phase 4: Stake-Based Reputation Bond (Week 4)

### Smart Contract: ReputationStake.sol

- [ ] **Setup**
  - [ ] Same as HumanPagesReputation.sol
  - [ ] Deploy to Base Sepolia + mainnet

- [ ] **Contract Development** (4-5 days)
  - [ ] `Stake` struct: (human, amount, stakedAt, slashableUntil, withdrawn)
  - [ ] `stake(amount)` function
    - [ ] Approve USDC first
    - [ ] Transfer USDC from caller to contract
    - [ ] Record stake
  - [ ] `withdrawStake()` function
    - [ ] Check no active disputes
    - [ ] Transfer USDC back
    - [ ] Mark withdrawn
  - [ ] `slashStake(human, amount, reason)` function (onlyOracle)
  - [ ] `getStake(human)` view function
  - [ ] Tests: 8-10 cases (stake, withdraw, slash, edge cases)

### Backend

- [ ] **Database Schema**
  - [ ] `Human.stakedAmount: Decimal` (default: 0)
  - [ ] `Human.stakedAt: DateTime?`
  - [ ] `Human.stakeNetwork: String?` (locked network)
  - [ ] `Human.stakeContractAddress: String?`
  - [ ] Create migration

- [ ] **APIs**
  - [ ] `GET /api/humans/me/stake` (Get current stake)
  - [ ] `POST /api/humans/me/stake` (Initiate stake)
    - [ ] Validate: amount >= 100 (USDC minimum)
    - [ ] Return: transaction to sign (via Privy)
  - [ ] `POST /api/humans/me/stake/confirm` (Confirm after signing)
    - [ ] Verify tx on-chain
    - [ ] Record `Human.stakedAmount`
  - [ ] `POST /api/humans/me/unstake` (Initiate withdrawal)
  - [ ] Admin: `POST /api/disputes/:id/slash-stake`
    - [ ] Called after dispute resolved
    - [ ] Slash X amount from loser's stake

- [ ] **Trust Score Integration**
  - [ ] In `computeTrustScore()`:
    ```typescript
    const stakeBonusPoints = computeStakeBonus(human.stakedAmount);
    // bonusPoints: 0-15
    finalScore = baseScore + stakeBonusPoints;
    ```

### Frontend

- [ ] **Dashboard: Stake Manager**
  - [ ] New tab: "Reputation Bond"
  - [ ] Show:
    - [ ] "Staked: $1000"
    - [ ] "Trust bonus: +10 points"
    - [ ] "Status: Active (locked until dispute resolves)"
  - [ ] Button: "Withdraw Stake" (disabled if disputes pending)

- [ ] **Staking Flow**
  - [ ] Modal: "Stake USDC as Reputation Bond"
  - [ ] Input: Amount (min $100)
  - [ ] Wallet connect (if needed)
  - [ ] "Review & Sign Transaction"
  - [ ] After tx confirmed: "Stake recorded on blockchain"

### Testing

- [ ] **Unit Tests**
  - [ ] Stake/withdraw logic: Mock contract calls
  - [ ] Trust score bonus calculation

- [ ] **Integration Tests**
  - [ ] Sign stake tx → Confirm in DB → Verify on-chain
  - [ ] Slash stake → Verify amount reduced
  - [ ] Withdraw → Verify locked if disputes pending

---

## Phase 5: Social Proof Aggregation (Week 4-5)

### Database Schema

- [ ] **SocialProofSnapshot model**
  - [ ] Fields: (id, humanId, linkedinJobCount, linkedinEndorsementCount, linkedinVerified, githubPublicRepos, githubStars, githubFollowers, githubActivity, githubVerified, twitterFollowers, twitterVerified, websiteStatus, websiteUpdatedAt, websiteResponseTime, socialTrustScore, updatedAt)

- [ ] **Create migration**

### Backend APIs

- [ ] **GET /api/humans/:id/social-proof**
  - [ ] Returns snapshot + scores
  - [ ] Cached 7 days, refreshed on request

- [ ] **POST /api/humans/me/refresh-social-proof**
  - [ ] Rate-limited: 1x per day per user
  - [ ] Fetches from:
    - [ ] LinkedIn: Job count (via Bright Data API or manual input)
    - [ ] GitHub: Public repos, stars, followers, contributions (GitHub API)
    - [ ] Twitter: Followers, verification (Twitter API v2)
    - [ ] Website: HEAD request, SSL cert check
  - [ ] Updates DB snapshot
  - [ ] Returns fresh data

### External API Integrations

- [ ] **GitHub API** (2-3 days)
  - [ ] Client: Octokit library
  - [ ] Endpoints:
    - [ ] `GET /users/:username` (followers, public repos, profile)
    - [ ] `GET /users/:username/repos` (count stars across repos)
    - [ ] `GET /users/:username/repos?page=1&per_page=100` (public repos list)
  - [ ] Caching: Cache results 30 days
  - [ ] Error handling: Graceful fallback to cached data

- [ ] **LinkedIn Job Count**
  - [ ] Limitation: LinkedIn API doesn't expose job count
  - [ ] Options:
    - [ ] 1. Use Bright Data (paid scraping API) to count jobs listed
    - [ ] 2. Manual entry by user during onboarding
    - [ ] 3. Estimate from GitHub activity + profile completeness
  - [ ] Chose: Option 2 (manual, user controls)

- [ ] **Twitter API v2**
  - [ ] Endpoints:
    - [ ] `GET /users/:id` (followers, verified status)
    - [ ] Requires: API key + auth token
  - [ ] Caching: 30 days

- [ ] **Website Status Checker**
  - [ ] Function: `checkWebsiteStatus(url)`
  - [ ] Logic:
    1. HEAD request to URL
    2. Check status code 200-299
    3. Check SSL cert (expired?)
    4. Measure response time
    5. Return: { status, responseTime, sslValid }
  - [ ] Caching: 7 days

### Trust Score Integration

- [ ] **computeSocialScore() changes**
  - [ ] Add external verification bonuses
  - [ ] GitHub: +10 pts if 5+ public repos, +10 pts if 100+ contributions/year
  - [ ] LinkedIn: +10 pts if 5+ jobs listed
  - [ ] Twitter: +5 pts if verified
  - [ ] Website: +5 pts if reachable + SSL valid

### Frontend

- [ ] **Profile: Social Proof Section**
  - [ ] Card showing:
    - [ ] GitHub: "15 public repos, 250 stars, 500 followers"
    - [ ] LinkedIn: "5 jobs listed" (user input, locked after verification)
    - [ ] Twitter: "250 followers" ✓ (blue check if verified)
    - [ ] Website: "✓ Reachable" (245ms response)
  - [ ] "Last updated: 2 hours ago" + Refresh button

- [ ] **Button: Refresh Social Proof**
  - [ ] Disabled if refreshed < 24h ago
  - [ ] Loading spinner while fetching
  - [ ] Toast: "Social proof updated"

### Testing

- [ ] **Unit Tests**
  - [ ] GitHub API call mocking
  - [ ] Trust bonus calculation

- [ ] **Integration Tests**
  - [ ] Refresh social proof → Verify snapshot updated
  - [ ] Check rate limiting (2nd refresh fails within 24h)

---

## Phase 6: Dispute Resolution (Weeks 5-6)

### Database Schema

- [ ] **Dispute model** (with all fields from design doc)
  - [ ] Create migration
  - [ ] Create `DisputeStatus` and `DisputeDecision` enums
  - [ ] Add indexes: `(jobId)`, `(status)`, `(filedAt)`, `(arbiterId)`

- [ ] **ArbiterProfile model**
  - [ ] Fields: (id, humanId, disputesResolved, averageScore, isActive)

### Backend APIs

- [ ] **POST /api/jobs/:id/dispute** (File dispute)
  - [ ] Payload: { complaint, attachmentUrls }
  - [ ] Validation:
    - [ ] Job must be COMPLETED or PAID
    - [ ] Must be filed within 7 days of completion
    - [ ] Both parties must have wallets
  - [ ] Creates Dispute record, status = FILED
  - [ ] Notifies other party: "Dispute filed against you"
  - [ ] Returns: { disputeId, status, nextStep, estimatedResolution }

- [ ] **POST /api/disputes/:id/respond** (Agent response)
  - [ ] Payload: { response, attachmentUrls }
  - [ ] Validation: Must be filed party (other than complainer)
  - [ ] Updates Dispute.response, status → EVIDENCE
  - [ ] Assigns arbiter from pool

- [ ] **GET /api/disputes/:id** (View dispute details)
  - [ ] Returns: Full dispute data + timeline

- [ ] **GET /api/disputes/:id/timeline**
  - [ ] Chronological events

### Arbiter System

- [ ] **Arbiter Pool Selection**
  - [ ] Criteria: Trust score >= 60, no active disputes as party, < 5 current disputes as arbiter
  - [ ] Random selection (weighting towards higher-score arbiters)
  - [ ] Email notification: "You've been assigned dispute #123"

- [ ] **Arbiter Interface** (Admin portal)
  - [ ] View dispute details (read-only)
  - [ ] Download evidence files
  - [ ] Form: Select winner (HUMAN_WIN | AGENT_WIN | PARTIAL)
  - [ ] Form: Enter reasoning
  - [ ] Form: Recommend reputation damage (0-50 points)
  - [ ] Form: Recommend stake slash % (0-50%)
  - [ ] Submit vote (signs with arbiter key)

- [ ] **Vote Aggregation**
  - [ ] If 1 arbiter: Decision final
  - [ ] If 3 arbiters: Median vote wins
  - [ ] If votes split (e.g., 2-1): Explain in notes

- [ ] **Reputation Damage Calculation**
  - [ ] Function: `calculateReputationDamage(loserScore, jobValue, disputeType)`
  - [ ] Formula (from design doc):
    - [ ] Base: 10-30 pts depending on dispute type
    - [ ] Multiplier: job value / 500
    - [ ] Multiplier: loser's score / 60
    - [ ] Result: loser's score decreased by X

- [ ] **Apply Decision**
  - [ ] After vote resolution:
    1. Update `Dispute.decision`
    2. Apply reputation damage to loser: `computeTrustScore()` will be lower
    3. If staked: slash up to X% of stake
    4. Emit event: `DisputeResolved(disputeId, winner, damage)`
    5. Notify both parties: "Dispute resolved: [winner] decision"

### Frontend

- [ ] **Job Detail: Report Issue Button**
  - [ ] If job `COMPLETED` > 2 hours ago and not reviewed
  - [ ] Button: "Report Issue with This Job"

- [ ] **Dispute Filing Modal**
  - [ ] Form: Complaint description (rich text)
  - [ ] File upload: Screenshots, logs (max 10 MB)
  - [ ] Checkbox: "I confirm this is truthful..."
  - [ ] Submit → Creates dispute

- [ ] **Dispute Dashboard Tab**
  - [ ] List: "My Disputes" (as complainant or respondent)
  - [ ] Filters: Status (filed, evidence, resolved)
  - [ ] Each dispute card:
    - [ ] Job title + price
    - [ ] Status + timeline
    - [ ] "View Details" link

- [ ] **Dispute Detail Page**
  - [ ] Job summary (read-only)
  - [ ] Complaint + attachments
  - [ ] Response section (if responded)
  - [ ] Timeline: Complaint → Response → Arbiter assigned → Decision
  - [ ] If resolved: Decision + reasoning + reputation damage

### Testing

- [ ] **Unit Tests**
  - [ ] Reputation damage calculation: Various scores/values
  - [ ] Vote aggregation: 1, 3 arbiters with different votes

- [ ] **Integration Tests**
  - [ ] File dispute → Verify arbiter assigned → Submit vote → Verify decision applied
  - [ ] Check reputation damage applied to loser's score

- [ ] **Manual Testing**
  - [ ] Complete job → Wait > 2 hours → File dispute
  - [ ] Other party responds with evidence
  - [ ] Arbiter votes on platform
  - [ ] Verify loser's score decreased
  - [ ] Check on-chain event emitted

---

## Cross-Cutting Concerns (Throughout all phases)

### Testing Infrastructure

- [ ] **Setup**
  - [ ] Hardhat test network (local chain for contract testing)
  - [ ] Base Sepolia testnet account (faucet for test USDC)
  - [ ] Alchemy API key for testnet RPC

- [ ] **Test Data**
  - [ ] Seed script: Create 50 test humans with varying scores
  - [ ] Seed script: Create 200 completed jobs with real-ish details
  - [ ] Seed script: Create 50 reviews across jobs

### Documentation

- [ ] **Smart Contract**
  - [ ] Inline comments explaining each function
  - [ ] README: Deploy steps, constructor args
  - [ ] ABI export + TypeScript types

- [ ] **Backend**
  - [ ] JSDoc for new functions
  - [ ] README: New endpoints + examples
  - [ ] API docs: Add to `/api-docs` (if exists)

- [ ] **Frontend**
  - [ ] Component-level comments
  - [ ] Storybook stories for new components

### Monitoring & Alerting

- [ ] **Oracle Job Monitoring**
  - [ ] Log successful publishes: "Published X reviews to contract"
  - [ ] Alert on failure: "Oracle job failed, will retry"
  - [ ] Dashboard: Track publish success rate (target: 99.9%)

- [ ] **RPC Call Monitoring**
  - [ ] Track latency: Alchemy response times
  - [ ] Alert on failures: "RPC call failed 3x in a row"
  - [ ] Cache hit rate: "Using cached reputation 40% of calls"

### Security Checklist

- [ ] **Smart Contracts**
  - [ ] No reentrancy vulnerabilities
  - [ ] Owner/oracle access control tight
  - [ ] Slashing can only reduce stake (not increase)
  - [ ] Event logs for all critical actions

- [ ] **Backend**
  - [ ] Private wallet keys never in logs
  - [ ] Rate limiting on `/verify-payment` endpoint (100 req/min)
  - [ ] Validate all external inputs (txHash format, network name, etc.)
  - [ ] No USDC transfer logic (read-only, blockchain is source of truth)

- [ ] **Frontend**
  - [ ] Never store private keys in localStorage
  - [ ] Use Privy for all signing (don't manage keys)
  - [ ] CSRF tokens on all POST endpoints

---

## Deployment Checklist

### Pre-Launch

- [ ] **Testnet Validation** (Base Sepolia)
  - [ ] [ ] All 6 features deployed and working
  - [ ] [ ] 100+ test humans with complete profiles
  - [ ] [ ] 200+ completed jobs with payments
  - [ ] [ ] 50+ disputes filed and resolved
  - [ ] [ ] Oracle job runs successfully weekly
  - [ ] [ ] RPC calls work reliably

- [ ] **Partner Testing**
  - [ ] [ ] 3-5 agent partners use new flow
  - [ ] [ ] Feedback collected: "Payment verification works great"
  - [ ] [ ] Issues found & fixed

- [ ] **Audit** (Optional but recommended)
  - [ ] [ ] Smart contracts reviewed by third party
  - [ ] [ ] Report filed, issues fixed

- [ ] **Legal/Compliance**
  - [ ] [ ] Terms of Service updated (escrow → on-chain)
  - [ ] [ ] Privacy policy updated (blockchain data = permanent)

### Mainnet Deployment (Phase-by-phase)

- [ ] **Phase 1 & 2 (Week 3 of project)**
  - [ ] Deploy contracts to Base mainnet
  - [ ] Deploy contracts to Ethereum mainnet (optional, higher gas)
  - [ ] Feature flag: Hide blockchain reputation UI until Phase complete
  - [ ] Gradual rollout: 10% of users see "Verify on blockchain" badge
  - [ ] Monitor: RPC latency, error rates

- [ ] **Phase 3** (Week 4)
  - [ ] Enable job tier locks: Agents can now set `requiredTrustTier`
  - [ ] Gradual rollout: 50% of agents use tier system
  - [ ] Monitor: Job acceptance rate by tier (should decrease as tier goes up)

- [ ] **Phase 4** (Week 5)
  - [ ] Enable staking: Users can deposit USDC
  - [ ] Gradual rollout: 20% of users stake
  - [ ] Monitor: Total staked amount, withdrawal success rate

- [ ] **Phase 5** (Week 6)
  - [ ] Enable social proof: Refresh endpoints available
  - [ ] Gradual rollout: 30% of users refresh social data
  - [ ] Monitor: API call latency to GitHub/Twitter

- [ ] **Phase 6** (Week 7-8)
  - [ ] Dispute system live (optional, can wait)
  - [ ] Full rollout: All users can file disputes
  - [ ] Monitor: Average resolution time, appeal rate

### Post-Launch

- [ ] **Monitoring Dashboard**
  - [ ] [ ] Oracle job success rate
  - [ ] [ ] Avg reputation score per tier
  - [ ] [ ] Payment verification speed (p50, p99)
  - [ ] [ ] Stake total per network
  - [ ] [ ] Dispute resolution time
  - [ ] [ ] Reputation damage distribution

- [ ] **Public Communication**
  - [ ] [ ] Blog post: "Why Escrow Is Dead"
  - [ ] [ ] Twitter thread: Thread of 10 tweets explaining system
  - [ ] [ ] Changelog: Detailed technical breakdown
  - [ ] [ ] Help docs: "Verify Your Payments on Blockchain"

- [ ] **Community Building**
  - [ ] [ ] AMAs: Crypto community + freelancers
  - [ ] [ ] Telegram group: Support for new features
  - [ ] [ ] Bug bounty: Reward finding issues

---

## Timeline Summary

| Phase | Features | Duration | Dev Days | Start | End |
|-------|----------|----------|----------|-------|-----|
| 1 | A: On-chain reputation | 2 weeks | 6-9 | Week 1 | Week 2 |
| 2 | B: Payment history | 2 weeks | 5-6 | Week 1 | Week 2 |
| 3 | D: Trust tiers | 1 week | 6-8 | Week 3 | Week 3 |
| 4 | C: Staking, E: Social proof | 2 weeks | 8-11 + 7-10 | Week 4 | Week 5 |
| 5 | F: Disputes | 2 weeks | 13-17 | Week 6-7 | Week 7-8 |
| **Total** | **All 6** | **4-6 weeks** | **45-61** | — | — |

**Optimal team**: 2-3 engineers
- Engineer 1: Smart contracts + oracle job (Phases 1-2)
- Engineer 2: APIs + dispute system (Phases 2, 6)
- Engineer 3: Frontend + integration (all phases, part-time)

---

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| **Smart contract exploit** | Audit by third party; start with small limits |
| **RPC reliability** | Fallback to cached data; use Alchemy + Infura redundancy |
| **Reputation gaming** | Logarithmic scoring; social proof verification; community oversight |
| **Dispute abuse** | Rate limiting; require trust score >= 15 to file; arbiter oversight |
| **Escrow migration** | Keep escrow as option during rollout; don't force immediately |
| **User confusion** | Clear onboarding; help docs; in-app tooltips |

---

## Success Metrics (30-day post-launch)

- [ ] 50%+ of job payments verified via blockchain
- [ ] 10,000+ humans with published reputation on-chain
- [ ] 0 HP-held escrow (100% jobs paid on-chain or user-direct)
- [ ] Avg dispute resolution time < 5 days
- [ ] Arbiter approval rating > 4.5/5
- [ ] Zero smart contract exploits
- [ ] User satisfaction > 4.2/5 (survey)

