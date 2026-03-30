# HumanPages On-Chain Trust System
## Making Escrow Obsolete with Reputation Economics

**Document**: `TRUST_SYSTEM_DESIGN.md`
**Status**: Design (not yet implemented)
**Philosophy**: "Fiat escrow needs a middleman. Crypto doesn't. The blockchain IS the single source of truth."

---

## Executive Summary

This design replaces traditional escrow (which requires HumanPages to hold funds) with a **reputation-based economic system** where:
- Payment history is immutable and on-chain verifiable
- Trust is the economic primitive (not funds-in-custody)
- Agents send $500+ to strangers based on transparent reputation signals
- Humans build portable, multi-platform reputation that survives account deletion
- Disputes resolved via reputation damage + community mechanisms (not fund recovery)

**Key insight**: Escrow "protects" both parties but requires trust in a middleman. On-chain reputation makes trust in the middleman *unnecessary*—agents can verify entire payment history without asking HumanPages.

---

## System Architecture

### Layers

```
┌─────────────────────────────────────────────────────────────┐
│ Trust Score Engine (Backend)                                 │
│ - Aggregates: reputation, identity, social proof, activity   │
│ - Returns 0-100 score + tier (new/basic/verified/trusted)   │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│ On-Chain Registry (Smart Contract)                            │
│ - ERC-8004: Reputation feedback (pre-computed, SHA-256 hash) │
│ - txHash ledger: Payment history indexed by human address     │
│ - Stake registry: Optional reputation bonds                   │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│ Immutable Data (Blockchain)                                   │
│ - USDC transfers indexed by recipient address                 │
│ - Superfluid streams indexed by receiver                      │
│ - x402 micropayment logs (optional on-chain)                  │
└─────────────────────────────────────────────────────────────┘
```

---

## Feature A: On-Chain Reputation Score

### Current State
- Trust score computed server-side (`trustScore.ts`)
- Signals: identity (30%), reputation (40%), social (15%), activity (15%)
- Formula: `score = 0.3 * identity + 0.4 * reputation + 0.15 * social + 0.15 * activity`
- Range: 0–100
- Tiers: new (<15), basic (15-34), verified (35-59), trusted (60+)

### Design: On-Chain Registry

#### Contract Interface (ERC-8004 compatible)

```solidity
// HumanPagesReputation.sol (not yet deployed)
pragma solidity ^0.8.0;

contract HumanPagesReputation {

    // Core reputation data
    struct HumanReputation {
        uint40 totalFeedbackCount;      // Number of reviews received
        uint40 lastFeedbackTime;        // Block timestamp of most recent review
        uint96 cumulativeRating;        // Sum of all (rating * 20) values, scaled by 100
        uint40 totalJobsCompleted;      // Denormalized from Job.status == COMPLETED
        uint40 totalDisputesResolved;   // Count of DISPUTED → RESOLVED jobs
        bytes32 reputationHash;         // SHA-256(canonicalFeedbackJSON)
        uint64 stakedAmount;            // USDC staked as reputation bond (0 = none)
    }

    // Human address → Reputation data
    mapping(address => HumanReputation) public humans;

    // Verify feedback integrity (called by oracle)
    function giveFeedback(
        address human,
        uint256 rating,              // 1-5 scale (stored as-is, not erc8004Value)
        string memory jobCategory,   // "development", "writing", etc.
        bytes32 feedbackHash,        // SHA-256 of canonical JSON
        string memory tags           // "starred" for star ratings
    ) external onlyOracle {
        // Pre-computed in DB, published here for immutability
        HumanReputation storage rep = humans[human];
        rep.totalFeedbackCount++;
        rep.lastFeedbackTime = uint40(block.timestamp);
        rep.cumulativeRating += uint96(rating * 20);
        rep.reputationHash = feedbackHash;
    }

    // Publish payment history proof
    event PaymentRecorded(
        address indexed human,
        address indexed agent,
        uint256 amount,
        string network,
        bytes32 txHash,
        uint40 jobId          // Reference to HumanPages DB for dispute resolution
    );

    // Query interface: Agent verifies human's payment history
    function getPaymentHistory(address human, uint256 limit)
        external view returns (PaymentRecord[] memory);

    // Stake reputation bond
    function stakeReputation(uint256 amount) external {
        // Human stakes USDC as "skin in the game"
        // Not escrowed (human retains ownership), but slashable in disputes
    }

    // View current score (computed from cumulativeRating, jobsCompleted, stakes)
    function getReputationScore(address human)
        external view returns (uint256 score, string memory tier);
}
```

#### Data Flow

1. **Feedback Created** (DB layer, `POST /api/jobs/{id}/review`)
   - Human submits 1-5 star review
   - Backend computes `erc8004FeedbackHash = SHA256(canonicalFeedbackJSON)`
   - Stores `Review.erc8004Value = rating * 20`, `erc8004FeedbackHash`
   - Stores in `Job.feedback`

2. **Oracle Bridge** (Weekly cron job)
   - Query: `SELECT * FROM Review WHERE publishedToBlockchain = false`
   - For each review:
     - Call `HumanPagesReputation.giveFeedback(humanAddress, rating, category, feedbackHash)`
     - Set `publishedToBlockchain = true` in DB

3. **Public Verification**
   - Agent (or external tool) calls contract: `getReputationScore(humanAddress)`
   - Returns:
     ```json
     {
       "score": 72,
       "tier": "trusted",
       "jobsCompleted": 15,
       "avgRating": 4.6,
       "totalDisputesResolved": 2,
       "lastActivityBlockNumber": 19543210,
       "reputationHash": "0x..."
     }
     ```

### Why This Is Better Than Escrow

| Aspect | Escrow | On-Chain Reputation |
|--------|--------|---------------------|
| **Middleman Risk** | HumanPages holds $500+ per job | Zero custody (blockchain is truth) |
| **Transparency** | Agent trusts HP's records | Agent queries blockchain directly |
| **Portability** | Reputation locked to HP platform | Portable ERC-8004 standard (other platforms can read it) |
| **Dispute Resolution** | HP arbitrates, decides who gets paid | Reputation damage speaks for itself; community arbiters can reference on-chain history |
| **Scalability** | HP backend must handle all payments | Blockchain handles throughput; HP just publishes proofs |
| **Cost** | HP keeps spread on escrow float | Free (no custody cost) |
| **Immutability** | HP can modify past transactions | Blockchain timestamp proves actual history |

### Implementation Effort

**Backend**: 2-3 days
- Add `publishedToBlockchain` boolean to `Review` model
- Add Prisma migration
- Create weekly cron job to batch-publish reviews
- Error handling for failed publishes (retry queue)
- Add `GET /api/humans/:id/reputation/on-chain` endpoint to fetch contract data

**Smart Contract**: 3-4 days
- Deploy ERC-8004 reputation registry
- Oracle role (HP backend signer)
- Gas optimization for batch feedback publishing
- Fallback mechanism if oracle fails

**Frontend**: 1-2 days
- Add "Verify on blockchain" badge to profile
- Show contract address + etherscan link for reputation
- Display on-chain feedback count vs. DB count

**Total**: 6-9 days

---

## Feature B: Payment History Transparency

### Current State
- Jobs store `paymentTxHash` (on-chain)
- Public profiles show no payment history (privacy)
- Only authenticated agents see payment details

### Design: Proof-of-Payment API

#### API Endpoints

```typescript
// GET /api/humans/:id/payment-history
// Requires: agent auth OR public if human.sharePaymentHistory == true
// Returns:
interface PaymentHistoryResponse {
  human: {
    id: string;
    name: string;
    address: string;
  };
  summary: {
    totalJobsCompleted: number;
    totalAmountUSDC: number;
    avgJobValue: number;
    currency: "USDC";
    networks: string[]; // ["ethereum", "base", "polygon"]
    lastPaymentDate: string;
  };
  payments: {
    jobId: string;
    jobTitle: string;
    amount: number;
    network: string;
    txHash: string;
    explorerUrl: string;
    confirmedAt: string;
    category: string;
  }[];
  trustedSince: string; // First payment date
  verification: {
    blockchainVerified: boolean;
    contractAddress: string;
    onChainLastUpdate: string;
  };
}

// GET /api/verify-payment/:txHash?network=base
// Public endpoint, no auth required
// Returns: {confirmed: bool, amount, recipient, sender, timestamp}
// Uses: RPC call to block explorer API (Alchemy, Infura, etc.)

interface PaymentVerification {
  confirmed: boolean;
  txHash: string;
  network: string;
  amount: string; // In USDC smallest unit (6 decimals)
  recipient: string;
  sender: string;
  timestamp: number;
  blockNumber: number;
  gasUsed: string;
  status: "success" | "failed" | "pending";
}
```

#### Data Model Changes

```prisma
model Human {
  // Existing...

  // NEW: Payment history visibility
  sharePaymentHistory  Boolean  @default(false)  // Opt-in for privacy
  paymentHistorySince  DateTime? // Only show payments after this date

  // Denormalized totals (recomputed daily)
  totalJobsCompletedDenorm    Int      @default(0)
  totalUSDCEarnedDenorm       Decimal  @db.Decimal(18, 6)
  lastPaymentAt               DateTime?
  paymentNetworks             String[] @default([]) // ["ethereum", "base"]
}

model Job {
  // Existing...

  // NEW: Payment verification proof
  paymentVerifiedAt           DateTime?  // When we last verified on-chain
  paymentVerificationMethod   String?    // "rpc" | "subgraph" | "receipt"
  paymentVerificationTxHash   String?    // Actual hash we verified
}
```

#### Verification Flow

1. **Human opts in**: `PATCH /api/humans/me { sharePaymentHistory: true }`

2. **Agent queries**: `GET /api/humans/{id}/payment-history`
   - Fetches from DB: all jobs with `status == COMPLETED && paymentTxHash && sharePaymentHistory == true`
   - For each payment, includes blockchain link

3. **Agent independently verifies**: `GET /api/verify-payment/{txHash}?network=base`
   - Hits blockchain RPC: `eth_getTransactionReceipt`
   - Verifies:
     - `status == "0x1"` (success)
     - `to == USDC_ADDRESS` (correct token)
     - `recipient.address == human.address` (correct recipient)
   - Caches result for 1 hour

### Why This Is Better Than Escrow

| Aspect | Escrow | Payment History Transparency |
|--------|--------|-----|
| **Verification Time** | Agent waits for HP to confirm | Agent verifies within seconds via RPC |
| **Privacy** | HP sees all agents' info | Human controls visibility (opt-in) |
| **Dispute Proof** | Agent vs. HP records | Blockchain is immutable proof |
| **Multiple Networks** | HP tracks all chains | Agent sees which chains used (transparency) |
| **No Reversal Risk** | Funds locked | On-chain confirms finality (no chargebacks) |

### Implementation Effort

**Backend**: 3-4 days
- Add schema fields (migration)
- Create `/payment-history` endpoint with filtering
- Create `/verify-payment` endpoint with RPC calls (Alchemy API key)
- Add caching layer (Redis) for RPC calls
- Tests for edge cases (failed txs, missing receipts, etc.)

**Frontend**: 2 days
- Dashboard page: "My Payment History" (with toggle to share)
- Profile: "Verified payments" badge + explorer links
- Copy-to-clipboard for blockchain links

**Smart Contract**: 0 days (uses existing on-chain data)

**Total**: 5-6 days

---

## Feature C: Stake-Based Trust (Optional, "Skin in the Game")

### Concept

Optional non-custodial reputation bond:
- Human stakes USDC in a self-custodied smart contract
- **Not escrowed** by HumanPages (human can withdraw anytime)
- Signals credibility: "I have $1000 at stake if I mess up"
- Can be slashed in severe disputes (fraud, theft, etc.)

### Design: Self-Custodial Stake Registry

#### Contract Interface

```solidity
contract ReputationStake {

    struct Stake {
        address human;
        uint256 amount;        // USDC amount staked
        uint256 stakedAt;      // Block timestamp
        uint256 slashableUntil; // Disputes only slash if created before this date
        bool withdrawn;        // Human withdrew their stake
    }

    // Human address → Active stake
    mapping(address => Stake) public stakes;

    // Slashing history (for disputes)
    event StakeSlashed(
        address indexed human,
        uint256 amount,
        string reason  // "fraud", "undelivered_work", etc.
    );

    // Stake USDC as reputation bond
    function stake(uint256 amount) external {
        // Transfer USDC from human to this contract
        // Human retains full ownership, can withdraw anytime
        // But cannot withdraw if dispute filed within last 30 days
        USDC.transferFrom(msg.sender, address(this), amount);
        stakes[msg.sender] = Stake({
            human: msg.sender,
            amount: amount,
            stakedAt: block.timestamp,
            slashableUntil: block.timestamp + 30 days,
            withdrawn: false
        });
    }

    // Human withdraws stake (only if no active disputes)
    function withdrawStake() external {
        require(!hasActiveDispute(msg.sender), "Pending disputes prevent withdrawal");
        USDC.transfer(msg.sender, stakes[msg.sender].amount);
        stakes[msg.sender].withdrawn = true;
    }

    // Slash stake for fraud (called by oracle/multisig)
    function slashStake(address human, uint256 amount, string reason)
        external onlyDispute {
        require(stakes[human].slashableUntil >= block.timestamp, "Too old");
        stakes[human].amount -= amount;
        // Slashed funds sent to community fund or burned
        emit StakeSlashed(human, amount, reason);
    }

    // Query stake status
    function getStake(address human) external view
        returns (uint256 amount, uint256 stakedAt, bool canWithdraw);
}
```

#### Data Flow

1. **Human stakes** (Optional onboarding step)
   - Frontend calls wallet (via Privy)
   - Approves USDC to contract
   - Calls `ReputationStake.stake(1000e6)` (e.g., $1000)

2. **Stake visible in trust score**
   ```
   Stake bonus calculation:
   - $0: 0 pts
   - $100-500: 5 pts
   - $500-1000: 10 pts
   - $1000+: 15 pts (max)

   Total trust score adjusted: score_final = score_base + stake_bonus
   ```

3. **Dispute filed**
   - If agent claims fraud/non-delivery, files dispute
   - Stake becomes "slashable"
   - If human loses dispute, up to $X can be slashed

4. **Dispute resolved**
   - If human wins: stake remains unstaked but unslashable
   - If human loses: slashed amount distributed to agent/community fund
   - If settled: partial slash negotiated

### Why This Is Better Than Escrow

| Aspect | Escrow | Stake-Based |
|--------|--------|-----|
| **Middleman Custody** | HP holds $100-1000 per dispute risk | Zero custody (human controls keys) |
| **Economic Signal** | No skin in game | $1000 stake = strong credibility signal |
| **Privacy** | HP knows all stakes | Only blockchain knows total staked per human |
| **Slashing Fairness** | HP decides slash amount | Multisig/DAO voting on slashes (transparent) |
| **Withdrawal Speed** | Manual HP approval | Instant on-chain (no disputes) |
| **Reputational Damage** | Lost transaction; still in system | Public record of slashes (portable reputation damage) |

### Implementation Effort

**Smart Contract**: 4-5 days
- Stake contract (60 lines)
- Slashing mechanism (multisig approval)
- Integration with reputation registry
- Audit (if security-critical)

**Backend**: 2-3 days
- Add `stakedAmount` to Human model
- Add `stakeAmount` query to trust score calculation
- Add oracle role for slashing
- Create dispute slashing endpoint (multisig only)

**Frontend**: 2-3 days
- Stake management UI (deposit/withdraw)
- Show "Reputation Bonded: $1000" badge
- Dispute filing form (include slashing proposal)

**Total**: 8-11 days

---

## Feature D: Progressive Trust Tiers + Job Locks

### Concept

Match job value to human trust tier:
- **New** (<15 pts): Micro jobs only ($5-20)
- **Basic** (15-34 pts): Small jobs ($20-100)
- **Verified** (35-59 pts): Medium jobs ($100-500)
- **Trusted** (60+ pts): Unlimited ($500+)

### Design: Job Filter Rules

#### Data Model

```prisma
model Job {
  // Existing...

  // NEW: Trust requirement
  requiredTrustMinimum   Int      @default(0)  // 0-100 trust score
  requiredTrustTier      String   @default("new") // "new", "basic", "verified", "trusted"
}

model Agent {
  // Existing...

  // NEW: Agent job limits
  maxJobValueByTier      Json     @default("{ \"new\": 20, \"basic\": 100, \"verified\": 500, \"trusted\": null }")
  enforceJobLocks        Boolean  @default(true)
}
```

#### Job Acceptance Flow

1. **Agent creates job** with `requiredTrustTier = "verified"`
2. **Job offered to humans** via search/recommendation
3. **Human views job** → "Your trust score: Basic (24/100). This job requires Verified. Complete 2 more jobs to unlock."
4. **Human cannot accept** if score < required (API returns 403)
5. **Human completes jobs** → Score increases → Can now accept

#### Configuration by Agent

```typescript
// POST /api/agent/job-policy
// Set custom rules per agent
interface JobPolicy {
  minTrustTierByJobValue: {
    0: "new",      // $0-20 jobs accept anyone
    20: "basic",   // $20-100 jobs require 'basic'
    100: "verified", // $100+ require 'verified'
    500: "trusted"   // $500+ require 'trusted'
  };
  enforcement: "strict" | "advisory"; // Strict = reject; Advisory = warn
}
```

#### API Changes

```typescript
// GET /api/humans/search?skill=javascript&maxPrice=100&minTrustTier=basic
// Only return humans with score >= 15 ('basic')

// GET /api/jobs/{id}/can-accept
interface CanAcceptResponse {
  canAccept: boolean;
  reason?: "insufficient_trust" | "too_expensive" | "not_verified";
  currentScore: number;
  requiredScore: number;
  nextMilestone: {
    targetScore: number;
    jobsNeeded: number;
    estimatedDaysToReach: number;
  };
}

// POST /api/jobs/{id}/accept (returns 403 if trust too low)
// Error response:
{
  error: "insufficient_trust",
  details: {
    currentTier: "basic",
    requiredTier: "verified",
    currentScore: 34,
    scoreNeeded: 35,
    recommendedNextJobs: [
      { title: "...", price: "$50", trustGain: "~5-10 pts" }
    ]
  }
}
```

### Why This Is Better Than Escrow

| Aspect | Escrow | Progressive Tiers |
|--------|--------|-----|
| **Risk Management** | Escrow holds funds | Economic incentives prevent fraud (can't unlock big jobs) |
| **New User Onboarding** | $0 trust = risk | Small jobs build track record safely |
| **Transparency** | HP decides limits | Public, verifiable trust score determines limits |
| **Gamification** | No progress feedback | Clear "complete 2 more jobs to unlock $500 jobs" |
| **Fraud Prevention** | Blacklist-based | Whitelist-based (reputation gates entry) |

### Implementation Effort

**Backend**: 4-5 days
- Add schema fields
- Implement tier calculation in trust score
- Add job lock check on accept endpoint
- Add recommendations in job-detail response
- Tests for edge cases (score increase mid-job, etc.)

**Frontend**: 2-3 days
- Show "Your tier: Basic" on job cards
- Show lock icon + unlock path on locked jobs
- Add "Next milestone" indicator on profile
- Gamification: progress bar toward next tier

**Total**: 6-8 days

---

## Feature E: Social Proof Integration

### Concept

Amplify trust signals from external platforms:
- LinkedIn job count + verification badge
- GitHub contributions (activity heatmap, public repos)
- Twitter followers + verification (if exists)
- External portfolio links + status check

### Design: Social Proof Aggregator

#### Data Model

```prisma
model SocialProofSnapshot {
  id              String   @id @default(cuid())
  humanId         String
  human           Human    @relation(fields: [humanId], references: [id], onDelete: Cascade)

  // LinkedIn
  linkedinJobCount Int?
  linkedinEndorsementCount Int?
  linkedinVerified Boolean @default(false)

  // GitHub
  githubPublicRepos Int?
  githubStars       Int?        // Total stars across repos
  githubFollowers   Int?
  githubActivity    Int?        // Contributions last 365d
  githubVerified    Boolean @default(false)

  // Twitter
  twitterFollowers  Int?
  twitterVerified   Boolean @default(false) // Has blue check

  // Portfolio
  websiteStatus     String? // "reachable" | "down" | "invalid"
  websiteUpdatedAt  DateTime?
  websiteResponseTime Int? // milliseconds

  // Aggregate
  socialTrustScore  Int     // 0-100 sub-score

  updatedAt         DateTime @default(now()) @updatedAt

  @@index([humanId])
  @@index([linkedinVerified])
  @@index([githubVerified])
}
```

#### API Endpoints

```typescript
// GET /api/humans/:id/social-proof
interface SocialProofResponse {
  linkedIn: {
    jobs: number;
    endorsements: number;
    verified: boolean;
    url: string;
  };
  github: {
    publicRepos: number;
    stars: number;
    followers: number;
    contributions365d: number;
    verified: boolean;
    url: string;
  };
  twitter: {
    followers: number;
    verified: boolean;
    url: string;
  };
  portfolio: {
    status: "reachable" | "down" | "invalid";
    responseTime: number; // ms
    url: string;
  };
  aggregateScore: number; // 0-100
  lastUpdated: string;
}

// POST /api/humans/me/refresh-social-proof
// Manually trigger refresh of all social data (rate-limited: 1x/day)
// Fetches LinkedIn job count, GitHub stats, etc.
```

#### Refresh Mechanism

1. **Onboarding**: When human links LinkedIn/GitHub/Twitter, take snapshot
2. **Daily Cron**: Refresh top 10% most-viewed profiles
3. **On-demand**: Human clicks "Refresh" button (rate-limited to 1x/day)
4. **Fallback**: If LinkedIn/GitHub API fails, use cached data

#### Trust Score Integration

```typescript
function computeSocialScore(signals: TrustSignals['social']): number {
  let score = 0;

  // Vouches (existing)
  const vouchNorm = Math.min(Math.log(signals.vouchCount + 1) / Math.log(11), 1);
  score += vouchNorm * 0.5;

  // Social profiles linked (existing)
  const socialNorm = Math.min(signals.socialProfilesLinked / 4, 1);
  score += socialNorm * 0.2;

  // NEW: External platform verification
  const externalBonus = 0;
  if (signals.linkedinVerified) externalBonus += 0.1;    // +10%
  if (signals.githubVerified) externalBonus += 0.1;      // +10%
  if (signals.twitterVerified) externalBonus += 0.05;    // +5%

  // LinkedIn job count (proxy for experience)
  if (signals.linkedinJobCount >= 5) externalBonus += 0.05; // 5+ jobs = 5% bonus

  // GitHub activity (proxy for consistency)
  if (signals.githubActivity >= 100) externalBonus += 0.05; // 100+ contributions/year

  score += Math.min(externalBonus, 0.3);

  return Math.min(score, 1);
}
```

### Why This Is Better Than Escrow

| Aspect | Escrow | Social Proof |
|--------|--------|-----|
| **Third-Party Verification** | Only HP verifies | GitHub, LinkedIn, Twitter verify for free |
| **Fraud-Resistant** | Can fake profiles | Fake GitHub = 5+ repos + 100 contributions/year |
| **Portable Reputation** | HP-only | Public LinkedIn/GitHub history persists across platforms |
| **Real-World Signals** | No external validation | 10 years LinkedIn employment is strong signal |
| **Sybil-Resistant** | HP manually reviews | Maintaining fake GitHub account for years is hard |

### Implementation Effort

**Backend**: 5-7 days
- Add schema + migration
- LinkedIn API integration (job count via Scraper API if official fails)
- GitHub API integration (public repos, stars, contributors)
- Twitter API integration (followers, verification)
- Website status checker (HEAD request, SSL check)
- Daily cron refresh job
- Error handling for API failures
- Cache layer (cache for 7 days)

**Frontend**: 2-3 days
- Social proof section on profile (badges + counts)
- "Last updated: 2 hours ago" with manual refresh button
- Verification badges (LinkedIn verified ✓)

**Total**: 7-10 days

---

## Feature F: Dispute Resolution Without Escrow

### Concept

Replace fund-holding escrow with reputation-based dispute mechanism:
- Agent and human both have reputational stake (scores public)
- Disputes filed with evidence (chat, deliverables, screenshots)
- Community arbiters review (or centralized panel initially)
- Loser's trust score penalized (can be recovered by building new rep)
- No middleman holds funds

### Design: Dispute Registry

#### Data Model

```prisma
enum DisputeStatus {
  FILED          // Initial complaint
  EVIDENCE       // Both parties submitted evidence
  ARBITRATION    // Arbiter reviewing
  RESOLVED       // Decision made
  APPEALED       // Loser appealed
  CLOSED         // Final decision
}

enum DisputeDecision {
  HUMAN_WIN      // Human gets full payment
  AGENT_WIN      // Agent keeps or gets refund
  PARTIAL        // Settlement
}

model Dispute {
  id              String   @id @default(cuid())
  jobId           String   @unique
  job             Job      @relation(fields: [jobId], references: [id])

  status          DisputeStatus
  filedBy         String   // "human" | "agent"
  filedAt         DateTime @default(now())

  // Complaint
  complaint       String   @db.VarChar(5000)
  attachmentUrls  String[] @default([]) // Screenshots, logs, etc.

  // Agent response
  response        String?  @db.VarChar(5000)
  responseAt      DateTime?

  // Arbiter decision
  decision        DisputeDecision?
  decisionReason  String?
  arbiterNotes    String?
  decidedAt       DateTime?
  arbiterId       String?
  arbiter         Human?   @relation("ArbiterdDisputes", fields: [arbiterId], references: [id])

  // Penalty
  reputationDamage  Int    @default(0) // Points deducted from loser
  stakedAmountSlashed Decimal? @db.Decimal(18, 6) // From stake contract

  // Appeal
  appealed        Boolean  @default(false)
  appealReason    String?
  finalDecision   DisputeDecision?
  finalDecidedAt  DateTime?
}

// Track arbiter activity
model ArbiterProfile {
  id              String   @id @default(cuid())
  humanId         String   @unique
  human           Human    @relation(fields: [humanId], references: [id])

  disputesResolved Int @default(0)
  averageScore    Decimal? // Litigants rate arbiter decisions (1-5)
  isActive        Boolean @default(true)

  disputes        Dispute[] @relation("ArbiterdDisputes")
}
```

#### API Endpoints

```typescript
// POST /api/jobs/{id}/dispute
interface FiledisputeRequest {
  complaint: string;
  attachmentUrls: string[]; // Pre-signed S3 URLs
}

interface DisputeResponse {
  id: string;
  status: "FILED";
  filedAt: string;
  nextStep: "Waiting for agent response (48 hours)";
  estimatedResolutionTime: "5-7 days";
}

// POST /api/disputes/{id}/respond
interface RespondToDisputeRequest {
  response: string;
  attachmentUrls: string[];
}

// GET /api/disputes/:id
interface DisputeDetailsResponse {
  id: string;
  job: { title, priceUsdc };
  human: { id, name, trustScore };
  agent: { id, name }; // agent name, not account

  complaint: { text, attachments, filedAt };
  response?: { text, attachments, respondedAt };

  status: "EVIDENCE"; // Still in evidence phase
  timelineMinutes: 1440; // How long to arbiter review

  // Arbiter info (if assigned)
  arbiter?: {
    name: string;
    disputesResolved: number;
    averageRating: 4.8;
  };

  // Decision (if resolved)
  decision?: {
    winner: "HUMAN" | "AGENT";
    reason: string;
    reputationDamage: number;
    stakedAmountSlashed: number;
    filedAt: string;
  };
}

// GET /api/disputes/:id/timeline
interface DisputeTimelineResponse {
  events: {
    timestamp: string;
    event: "complaint_filed" | "response_submitted" | "arbiter_assigned" | "decision_made";
    actor: string;
  }[];
  estimatedResolution: string; // "Feb 15, 2026"
}
```

#### Dispute Resolution Flow

```
┌─────────────────────────────────────────────────────────┐
│ 1. FILED (Agent claims non-delivery)                    │
│    - Timestamp: Job.completedAt + 2 hours               │
│    - Complaint + screenshots                            │
│    - Job value visible to arbiter                       │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│ 2. EVIDENCE (Human has 48 hours to respond)             │
│    - Human submits deliverables, chat logs, etc.        │
│    - Agent can submit additional evidence               │
│    - Both visible to arbiter                            │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│ 3. ARBITRATION (Arbiter reviews, votes)                 │
│    - Selected from pool of high-reputation arbiters     │
│    - Reviews full job history, reputations              │
│    - Median vote if 3+ arbiters                         │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│ 4. RESOLVED (Decision published)                        │
│    - Winner announced on-chain (ERC-8004 notes it)      │
│    - Loser's score adjusted: -10 to -30 pts             │
│    - If staked: up to 10% slashed per arbiter vote      │
│    - Both can appeal within 7 days                      │
└─────────────────────────────────────────────────────────┘
```

#### Reputation Damage Calculation

```typescript
function calculateReputationDamage(
  loserScore: number,
  jobValue: number,
  disputeType: "non_delivery" | "poor_quality" | "fraud"
): number {
  // Bigger penalty for higher-trust users (more credibility damaged)
  // Fraud > non-delivery > poor quality

  let baseDamage = 10;

  if (disputeType === "fraud") baseDamage = 30;
  else if (disputeType === "non_delivery") baseDamage = 20;

  // Scale by job value (bigger job = bigger credibility damage)
  const jobValueFactor = Math.min(jobValue / 500, 1.5); // Cap at 1.5x

  // Higher score = more credible, bigger damage when lost
  const scoreMultiplier = Math.max(loserScore / 60, 0.5);

  return Math.floor(baseDamage * jobValueFactor * scoreMultiplier);
}
```

### Why This Is Better Than Escrow

| Aspect | Escrow | Reputation-Based Disputes |
|--------|--------|-----|
| **Middleman Custody** | HP holds funds | Zero custody |
| **Appeal Process** | HP final authority | Community arbiters, can appeal |
| **Fraud Recovery** | Clawback from escrow | Reputation slashing + stake slashing |
| **Transparency** | HP arbitrates privately | Public dispute history (on-chain) |
| **Incentive Alignment** | HP takes "middleman cut" | Arbiters earn reputation (or small fee) |
| **Fairness** | Subjective HP decision | Median of 3 arbiters (more objective) |
| **Finality** | HP decision final | On-chain record, permanent reputation mark |

### Implementation Effort

**Backend**: 7-9 days
- Add schema + migration
- Dispute filing endpoint (validate both parties)
- Evidence submission (file upload to S3)
- Arbiter assignment logic (select high-score users as pool)
- Arbiter voting interface (private, HMAC-signed)
- Reputation damage calculation + application
- Timeline tracking + notifications
- Appeal workflow

**Frontend**: 5-6 days
- Job detail: "Report issue" button if overdue
- Dispute filing form (rich text + file upload)
- Dispute dashboard (in-progress disputes + history)
- Arbiter portal (separate UI to vote on disputes)
- Timeline visualization

**Smart Contract**: 1-2 days
- Record disputes on-chain (event logs, no storage needed)
- Emit "DisputeResolved" event with decision for ERC-8004 notes

**Total**: 13-17 days

---

## Integration with Existing Systems

### Profile Schema Changes

Add to `shared/profile-schema.json`:

```json
{
  "fields": {
    "trust": [
      { "field": "sharePaymentHistory", "type": "boolean", "step": "dashboard", "source": ["manual"], "required": false, "db": "Human.sharePaymentHistory", "frontend": "dashboard toggle", "validation": "default false" },
      { "field": "stakedAmount", "type": "decimal", "step": "verification", "source": ["manual:privy"], "required": false, "db": "Human.stakedAmount", "frontend": "form.stakeAmount", "validation": "0 or $100+" }
    ]
  },
  "enums": {
    "TrustTier": ["new", "basic", "verified", "trusted"],
    "DisputeType": ["non_delivery", "poor_quality", "fraud"],
    "DisputeStatus": ["filed", "evidence", "arbitration", "resolved", "appealed", "closed"]
  }
}
```

### Job Model Integration

```typescript
// When agent creates job:
const job = await prisma.job.create({
  data: {
    // ... existing fields
    requiredTrustTier: "verified", // NEW: Optional tier gate
    requiredTrustMinimum: 35,      // NEW: Or specific score
  }
});

// When human tries to accept:
const human = await prisma.human.findUnique({ where: { id: humanId } });
const trustScore = await computeTrustScore(humanId);

if (trustScore.score < job.requiredTrustMinimum) {
  return res.status(403).json({
    error: "insufficient_trust",
    currentScore: trustScore.score,
    requiredScore: job.requiredTrustMinimum,
  });
}
```

### API Versioning

- Existing endpoints unchanged
- New endpoints under `/api/v2/` or separate namespaces:
  - `/api/reputation/*`
  - `/api/disputes/*`
  - `/api/stakes/*`
  - `/api/verify-payment/*`

---

## Rollout Phases

### Phase 1: Foundation (Weeks 1-2, Days 6-9)
- A: On-chain reputation score + ERC-8004 publishing
- B: Payment history transparency API
- **Impact**: Agents can verify payment history without trusting HP

### Phase 2: Advanced Trust (Weeks 3-4, Days 8-11 + 5-6)
- D: Progressive trust tiers + job locks
- E: Social proof aggregation
- **Impact**: New users safely onboard with small jobs; builds verifiable track record

### Phase 3: Economic Incentives (Weeks 5-6, Days 8-11)
- C: Self-custodial stake registry
- **Impact**: High-stakes users signal credibility; reputation bonds strengthen trust

### Phase 4: Governance (Weeks 7-8, Days 13-17)
- F: Community dispute resolution
- **Impact**: Eliminate need for HP escrow entirely; scale to $1000+ jobs

### Go-Live Checklist
- [ ] All 6 features deployed to testnet (Base Sepolia)
- [ ] Audit of smart contracts (if required by compliance)
- [ ] 100+ test humans with varying trust scores
- [ ] Agent integration partners (3-5) validate new flow
- [ ] Mainnet deployment (Ethereum + Base primary)
- [ ] Blog post: "Why Escrow Is Dead"

---

## Technical Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| **Smart Contracts** | Solidity 0.8+ (OpenZeppelin) | ERC-8004 reputation standard, USDC integration |
| **RPC Provider** | Alchemy (Primary), Infura (Fallback) | Verify payment history reliably |
| **On-Chain Data** | Subgraph (The Graph) | Index USDC transfers by recipient (vs. full RPC queries) |
| **DB Changes** | Prisma migrations | Existing pattern, no new tools |
| **Backend API** | Express (existing) | Minimal changes, new endpoints only |
| **Frontend** | React (existing) | Add new pages/components, no framework change |
| **Auth** | Privy (existing) | Wallet connection for staking |
| **Storage** | S3 (existing) | Dispute evidence upload |

---

## Metrics & Success Criteria

### Phase 1 (On-Chain Reputation)
- Target: 10,000+ humans with published feedback on-chain
- Success: Agent can verify human's payment history in <2 seconds via contract call
- Metric: "Blockchain verified" badge appears on 50%+ of profiles

### Phase 2 (Progressive Tiers)
- Target: New users complete 3 micro-jobs ($5-20) before accessing $100+ jobs
- Success: Completion rate of tier-gated jobs > 90%
- Metric: Zero disputes on tier-gated jobs (selection effect)

### Phase 3 (Stake)
- Target: 500+ humans stake >$1000 each
- Success: Disputes involving staked humans 75% lower than average
- Metric: Total staked USDC > $500K

### Phase 4 (Disputes)
- Target: 99% of disputes resolved within 7 days
- Success: Arbiter appeal rate < 5%
- Metric: Average dispute resolution cost = 0 (no custody cost)

### Overall: Escrow Elimination
- Target: 0% of jobs using HP escrow
- Success: Agents confident sending $500+ based on on-chain signals
- Metric: "$0 in escrow held by HumanPages" (announced publicly)

---

## Open Questions & Future Work

1. **Slashing mechanics**: Who decides if disputed human loses stake? Centralized arbiter pool, DAO vote, or multisig?
2. **Appeals process**: Cost to appeal? Who pays arbiter for appeals?
3. **Reputation recovery**: How quickly can slashed user rebuild score? (Logarithmic decay = 3-6 months)
4. **Cross-chain reputation**: If human used Ethereum + Base, how to unify score?
5. **Sybil resistance**: Can fake account farm micro-jobs to build score, then scam on large job?
6. **GDPR**: User requests to delete account—does on-chain reputation get erased? (No = immutable, but private)
7. **Token economics**: Should arbiters earn USDC or HP tokens for dispute resolution?
8. **Competitive moat**: Competitors can read HP's ERC-8004 registry—how to differentiate?

---

## Conclusion

This system makes **escrow unnecessary** by:

1. **Making reputation the economic primitive** (not funds-in-custody)
2. **Publishing immutable proof on-chain** (agents don't ask HP, they ask blockchain)
3. **Creating clear incentives** (good behavior = higher trust tier + bigger jobs)
4. **Enabling transparent disputes** (community arbiters, not middleman)
5. **Giving humans portable reputation** (ERC-8004 standard, multi-platform)

**Cost to user**: Zero (no middleman touch fees)
**Cost to HP**: Storage + oracle publishing (negligible)
**Time to implement**: 4-6 weeks for all 6 features
**Risk if fails**: Fallback to existing escrow (no breaking changes)

**Philosophical shift**: From "trust the platform" → "trust the blockchain"

