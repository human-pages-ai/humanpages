# HumanPages Cryptoeconomic Trust System
## Design: 6 Interlocking Mechanisms for Escrow-Free Payments

**Date**: March 29, 2026
**Status**: Design Phase
**Author**: Mechanism Design Team

---

## Executive Summary

This document proposes a complete replacement for escrow-based payment protection. Instead of a middleman holding funds, six interlocking mechanisms create cryptoeconomic incentives where honest behavior is the dominant strategy across all job sizes ($20-5000+).

**Core Philosophy**: Reputation is the economic primitive. If your reputation is worth $500K/year in future earnings, you won't cheat for a $5K job.

**The System**:
1. Progressive Trust Tiers (job size locks)
2. Streaming Payments (continuous payment = real-time risk management)
3. Self-Staked Reputation Bonds (optional $1K-100K stake = skin in the game)
4. Sybil-Resistant Reputation Algorithm (weights job value, not count)
5. Atomic Task Decomposition (break $5K into 10×$500 milestones)
6. Community Arbitration (3-5 random verifiers, permanent reputation damage)

**Result**: A system where:
- No middleman holds funds (zero custody risk)
- New humans max $20/job, unlock $5000+ jobs in 2-3 months of proven work
- Reputation is on-chain and portable
- Game theory proves honest behavior is more profitable than fraud

---

## PART 1: MECHANISM 1 - PROGRESSIVE TRUST TIERS

### Purpose
Prevent the "bot farm attack" by locking new accounts to small job sizes until they've proven track record. When you can only accept $20 jobs for 3 months, even 150 completed jobs yields only $3K—not enough to justify a scam with 30% failure rate.

### Design

#### Trust Tier Structure

```
Tier 1 (NEW)
├─ Account age: 0 days
├─ Max job size: $20
├─ Conditions: email verified only
├─ Unlock time: Complete 1 verified job
└─ Reputation: 0-14

Tier 2 (BASIC)
├─ Account age: 1+ days
├─ Max job size: $100
├─ Conditions: 1+ completed job, rating ≥3.0
├─ Unlock time: 3+ jobs completed, $200+ earned
└─ Reputation: 15-34

Tier 3 (VERIFIED)
├─ Account age: 14+ days
├─ Max job size: $500
├─ Conditions: 3+ jobs, avg rating ≥4.0, identity proof (OAuth + email)
├─ Unlock time: 7+ jobs completed, $1000+ earned, 14+ account days
└─ Reputation: 35-59

Tier 4 (TRUSTED)
├─ Account age: 90+ days
├─ Max job size: $5000
├─ Conditions: 10+ jobs, avg rating ≥4.2, 1+ month no disputes
├─ Unlock time: 20+ jobs completed, $10,000+ earned, no active disputes
└─ Reputation: 60-100

Tier 5 (ELITE) [optional, for premium roles]
├─ Account age: 365+ days
├─ Max job size: unlimited
├─ Conditions: 100+ jobs, avg rating ≥4.5, $50K+ earned, staked bond
└─ Reputation: 85+
```

#### Unlock Criteria (Game-Theoretic Design)

**Why these numbers prevent bot farms:**

Tier 1 → Tier 2: 1 job
- Attacker cost: 1-2 hours of actual work ($20-40)
- Actual cost: Negligible
- BUT: Risk of rejection (reputation penalty) for bot-like behavior = deterrent

Tier 2 → Tier 3: 7 jobs completed, $1000 earned, 14 days account age
- Attacker cost: ~20-35 hours of work minimum (7 jobs × 3-5 hrs each)
- Expected profit from eventual $5K scam: $5K × (1 - failure_rate)
- With 30% failure rate: $3500 profit
- Time-weighted ROI: $3500 / (35 hours + 14 day wait) = poor
- Opportunity cost: Could earn more doing legitimate work

Tier 3 → Tier 4: 20 jobs completed, $10K earned, 90 days old
- Attacker cost: 60-100 hours of real work + 90-day account age
- Time cost alone: 60 hours ÷ $50/hr_equivalent = $3000 opportunity cost
- Expected fraud profit: $5K × (1-0.3) = $3500
- BUT: Only $500 net gain after opportunity cost
- Risk: 30% failure chance = actual expected value negative

**Conclusion**: Progressive tiers make fraud more expensive than honest work.

#### Implementation

**Backend Changes** (`backend/src/lib/trustScore.ts` and new `backend/src/lib/tierLimits.ts`)

```typescript
// New file: backend/src/lib/tierLimits.ts

export interface TierLimit {
  tier: 'NEW' | 'BASIC' | 'VERIFIED' | 'TRUSTED' | 'ELITE';
  maxJobValue: number; // dollars
  minReputation: number;
  minJobsCompleted: number;
  minEarnings: number;
  minAccountAgeDays: number;
  minAvgRating: number;
  requiresIdentityProof: boolean;
  requiresStake: boolean;
}

const TIER_LIMITS: Record<string, TierLimit> = {
  NEW: {
    tier: 'NEW',
    maxJobValue: 20,
    minReputation: 0,
    minJobsCompleted: 0,
    minEarnings: 0,
    minAccountAgeDays: 0,
    minAvgRating: 0,
    requiresIdentityProof: false,
    requiresStake: false,
  },
  BASIC: {
    tier: 'BASIC',
    maxJobValue: 100,
    minReputation: 15,
    minJobsCompleted: 1,
    minEarnings: 0,
    minAccountAgeDays: 1,
    minAvgRating: 3.0,
    requiresIdentityProof: false,
    requiresStake: false,
  },
  VERIFIED: {
    tier: 'VERIFIED',
    maxJobValue: 500,
    minReputation: 35,
    minJobsCompleted: 7,
    minEarnings: 1000,
    minAccountAgeDays: 14,
    minAvgRating: 4.0,
    requiresIdentityProof: true,
    requiresStake: false,
  },
  TRUSTED: {
    tier: 'TRUSTED',
    maxJobValue: 5000,
    minReputation: 60,
    minJobsCompleted: 20,
    minEarnings: 10000,
    minAccountAgeDays: 90,
    minAvgRating: 4.2,
    requiresIdentityProof: true,
    requiresStake: false,
  },
  ELITE: {
    tier: 'ELITE',
    maxJobValue: Infinity,
    minReputation: 85,
    minJobsCompleted: 100,
    minEarnings: 50000,
    minAccountAgeDays: 365,
    minAvgRating: 4.5,
    requiresIdentityProof: true,
    requiresStake: true,
  },
};

/**
 * Compute current tier for a human
 * Uses trustScore + job stats from DB
 */
export async function computeCurrentTier(humanId: string): Promise<TierLimit> {
  const trustScore = await computeTrustScore(humanId);
  const stats = await getHumanJobStats(humanId); // new DB query

  // Find highest tier that human qualifies for
  for (const tier of ['ELITE', 'TRUSTED', 'VERIFIED', 'BASIC', 'NEW']) {
    const tierDef = TIER_LIMITS[tier];
    if (qualifiesForTier(trustScore, stats, tierDef)) {
      return tierDef;
    }
  }

  return TIER_LIMITS.NEW; // fallback
}

function qualifiesForTier(trustScore, stats, tierDef): boolean {
  return (
    trustScore.score >= tierDef.minReputation &&
    stats.jobsCompleted >= tierDef.minJobsCompleted &&
    stats.earnings >= tierDef.minEarnings &&
    stats.accountAgeDays >= tierDef.minAccountAgeDays &&
    stats.avgRating >= tierDef.minAvgRating &&
    (!tierDef.requiresIdentityProof || trustScore.signals.identity.linkedinVerified)
  );
}

/**
 * Check if a job offer is allowed for this human
 */
export async function validateJobTier(humanId: string, jobValue: number): Promise<boolean> {
  const tier = await computeCurrentTier(humanId);
  return jobValue <= tier.maxJobValue;
}
```

**API Changes** (`backend/src/routes/humans.ts`)

```typescript
// Add to human response
GET /api/humans/{id}
Returns: {
  ...existingFields,
  trustScore: TrustScore,
  currentTier: TierLimit,
  nextTierUnlocks: {
    tier: 'TRUSTED',
    jobsCompleted: 20,
    jobsCompletedProgress: 12,  // current
    earningsRequired: 10000,
    earningsProgress: 5234,      // current
    daysRequired: 90,
    daysProgress: 45,            // current
    estimatedUnlockDate: '2026-06-17',
    bottleneck: 'earnings' // which criterion is slowest
  }
}

// Reject job acceptance if tier too low
POST /api/jobs/{id}/accept
Validation:
  if (jobValue > human.currentTier.maxJobValue) {
    return 403 {
      error: 'TIER_LIMIT_EXCEEDED',
      message: `Your tier allows max $${tier.maxJobValue}/job. Unlock ${nextTier} to accept this job.`,
      currentTier: human.currentTier,
      nextTier: nextAvailableTier
    }
  }
```

**Frontend Changes** (`frontend/src/pages/jobs/JobCard.tsx`)

```tsx
// Show tier lock status on job cards
<JobCard job={job}>
  {human.currentTier.maxJobValue < job.budget && (
    <TierLockedBadge
      currentTier={human.currentTier}
      nextTier={nextTierInfo}
      bottleneck={bottleneck}  // "jobs", "earnings", "account_age"
      progressPercent={progressToNextTier}
    />
  )}
  {/* Show unlock progress */}
  <TierProgressBar
    tier={human.currentTier}
    nextTier={nextTierInfo}
  />
</JobCard>

// Example unlock progress for BASIC → VERIFIED
<ProgressItem label="Jobs Completed" value={7} target={7} complete />
<ProgressItem label="Total Earnings" value={$1250} target={$1000} complete />
<ProgressItem label="Account Age" value={14} target={14} unit="days" complete />
→ "Ready to unlock VERIFIED tier!" button
```

#### Security & Game Theory

**Attack Vector 1: Rapid Tier Grinding with Collusion**
- Attacker creates multiple fake "agents" (buyers)
- Fake agents post $20 jobs, hire attacker's bot
- Bot completes 7 fake jobs to reach BASIC tier
- Problem: Fake jobs are detectable (same agents, same IPs, same work patterns)
- Defense: Machine learning (work consistency checker), velocity limits (max 1 job per hour)

**Attack Vector 2: Work-for-Hire to Build Tiers**
- Attacker hires legitimate human to do work, builds tiers, then scams
- Problem: Attacker spent $1000+ on legitimate work (cost = defeat)
- Defense: Tier unlock conditions are sufficient economic deterrent

**Economic Analysis (Nash Equilibrium)**:

For attacker to break even on $5K scam with 30% failure rate:
- Expected fraud profit: $3500
- Must offset:
  - Time cost to build tiers: 60-100 hours × $50/hr = $3000-5000
  - Opportunity cost vs. honest work
  - Risk of detection and permanent banning
- Actual expected value: Negative or barely positive
- Risk-adjusted value: Heavily negative

**Conclusion**: Rational attacker chooses honest work.

#### Build Effort
- Backend: 2 days (tier computation, DB queries, API changes)
- Frontend: 1.5 days (UI components, progress indicators)
- Testing: 1.5 days (tier unlock scenarios, edge cases)
- **Total: 5 days**

---

## PART 2: MECHANISM 2 - STREAMING PAYMENTS

### Purpose
For jobs >$50, replace batch payment with continuous Superfluid streaming. If human stops delivering quality, agent can stop the stream immediately. Eliminates ghosting risk.

### Design

#### Payment Flow

**Before (Traditional)**:
1. Agent deposits $500 escrow
2. Human works for 2 weeks
3. Human completes work, submits deliverable
4. Agent reviews (24-48 hours)
5. Agent releases escrow → Human receives $500
- **Risk window**: 14 days for human to disappear, 2+ days for agent to release

**After (Streaming)**:
1. Agent approves job, initiates stream
2. Superfluid stream begins: $500 / 2 weeks = $17.85/day
3. Human starts work, receives $5-10/day in real-time
4. At day 7: Agent sees quality, stops stream if bad
5. At day 14: Human has earned $250 (proportional to work), agent can settle
- **Risk window**: 1 day for agent to stop stream if quality is bad

#### Smart Contract Design

**HumanPages StreamPayments Contract** (Solidity, Superfluid integration)

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@superfluid-finance/ethereum-contracts/contracts/interfaces/superfluid/ISuperfluid.sol";
import "@superfluid-finance/ethereum-contracts/contracts/interfaces/agreements/IConstantFlowAgreementV1.sol";
import "@superfluid-finance/ethereum-contracts/contracts/interfaces/tokens/ISuperToken.sol";

/**
 * HumanPages StreamPayments
 *
 * Enables real-time payment streaming for jobs without escrow.
 * Agent initiates stream → Human receives continuous payment
 * Agent can stop stream if quality drops
 *
 * Key insight: Payment is instant and continuous.
 * If human ghosts after 3 days, they've only earned $50 (proportional to work done).
 * If human delivers, they earn full amount.
 */

contract HumanPagesStreamPayments {
  ISuperfluid public host;
  IConstantFlowAgreementV1 public cfa;
  ISuperToken public USDC_x; // SuperToken: USDCx on Base/Optimism

  mapping(bytes32 => StreamSession) public streams;
  mapping(bytes32 => uint256) public jobIdToStreamId;

  struct StreamSession {
    bytes32 jobId;
    address agent;
    address human;
    int96 flowRate; // USDCx per second
    uint256 totalAmount; // total promised USDC
    uint256 startTime;
    uint256 estimatedDuration; // seconds
    uint256 endTime; // when stream ends (startTime + duration)
    bool isActive;
    bool isCompleted;
    bool isDisputed;
    uint256 amountStreamed; // updated off-chain, verified on-chain
  }

  event StreamStarted(
    bytes32 indexed jobId,
    address indexed agent,
    address indexed human,
    int96 flowRate,
    uint256 totalAmount,
    uint256 duration
  );

  event StreamStopped(
    bytes32 indexed jobId,
    uint256 amountStreamed,
    string reason
  );

  event StreamCompleted(
    bytes32 indexed jobId,
    uint256 totalAmountStreamed
  );

  constructor(ISuperfluid _host, ISuperToken _USDC_x) {
    host = _host;
    cfa = IConstantFlowAgreementV1(
      address(host.getAgreementClass(keccak256("org.superfluid-finance.agreements.ConstantFlowAgreement.v1")))
    );
    USDC_x = _USDC_x;
  }

  /**
   * Agent initiates a payment stream for a job
   * @param jobId - unique job identifier (from HumanPages DB)
   * @param human - recipient address
   * @param totalAmount - total USDC to stream
   * @param durationSeconds - how long to stream (e.g., 14 days = 1.21M seconds)
   */
  function initiateStream(
    bytes32 jobId,
    address human,
    uint256 totalAmount,
    uint256 durationSeconds
  ) external {
    require(totalAmount > 0, "Amount must be > 0");
    require(human != address(0), "Invalid human address");
    require(durationSeconds >= 1 days, "Duration too short");

    // Calculate flow rate (USDC per second)
    // Example: $500 over 14 days = 500e6 / (14 * 86400) = 413 USDCx/sec
    int96 flowRate = int96(uint96((totalAmount * 1e18) / durationSeconds));

    // Transfer totalAmount from agent to contract
    // (agent must approve first: USDC_x.approve(address(this), totalAmount))
    USDC_x.transferFrom(msg.sender, address(this), totalAmount);

    // Create Superfluid stream: contract → human
    bytes memory createStreamData = abi.encodeWithSelector(
      cfa.createFlow.selector,
      USDC_x,
      human,
      flowRate,
      new bytes(0)
    );

    host.callAgreement(
      address(cfa),
      createStreamData,
      new bytes(0)
    );

    // Record stream session
    StreamSession storage session = streams[jobId];
    session.jobId = jobId;
    session.agent = msg.sender;
    session.human = human;
    session.flowRate = flowRate;
    session.totalAmount = totalAmount;
    session.startTime = block.timestamp;
    session.estimatedDuration = durationSeconds;
    session.endTime = block.timestamp + durationSeconds;
    session.isActive = true;

    jobIdToStreamId[jobId] = uint256(jobId);

    emit StreamStarted(jobId, msg.sender, human, flowRate, totalAmount, durationSeconds);
  }

  /**
   * Agent can stop stream if quality is unacceptable
   * @param jobId - job to stop
   * @param reason - reason code: "QUALITY", "GHOSTED", "DISPUTE"
   *
   * Effect: Stream ends immediately, human keeps proportional amount earned
   * Example: Stream was 14 days, stopped on day 3 → human gets $500 * (3/14)
   */
  function stopStream(bytes32 jobId, string calldata reason) external {
    StreamSession storage session = streams[jobId];
    require(session.isActive, "Stream not active");
    require(msg.sender == session.agent, "Only agent can stop stream");

    // Calculate amount streamed so far
    uint256 elapsed = block.timestamp - session.startTime;
    uint256 proportionalAmount = (session.totalAmount * elapsed) / session.estimatedDuration;

    // Stop the stream
    bytes memory deleteStreamData = abi.encodeWithSelector(
      cfa.deleteFlow.selector,
      USDC_x,
      address(this),
      session.human,
      new bytes(0)
    );

    host.callAgreement(
      address(cfa),
      deleteStreamData,
      new bytes(0)
    );

    session.isActive = false;
    session.amountStreamed = proportionalAmount;

    // Refund agent for unstreamed amount
    uint256 refundAmount = session.totalAmount - proportionalAmount;
    USDC_x.transfer(session.agent, refundAmount);

    emit StreamStopped(jobId, proportionalAmount, reason);
  }

  /**
   * Complete stream when job is delivered and approved
   * Contract transfers any remaining balance to human
   */
  function completeStream(bytes32 jobId) external {
    StreamSession storage session = streams[jobId];
    require(session.isActive, "Stream not active");
    require(msg.sender == session.agent || msg.sender == session.human, "Not authorized");

    // Calculate final amount
    uint256 elapsed = block.timestamp - session.startTime;
    uint256 finalAmount = elapsed >= session.estimatedDuration
      ? session.totalAmount
      : (session.totalAmount * elapsed) / session.estimatedDuration;

    // Stop stream
    bytes memory deleteStreamData = abi.encodeWithSelector(
      cfa.deleteFlow.selector,
      USDC_x,
      address(this),
      session.human,
      new bytes(0)
    );

    host.callAgreement(
      address(cfa),
      deleteStreamData,
      new bytes(0)
    );

    session.isActive = false;
    session.isCompleted = true;
    session.amountStreamed = finalAmount;

    // Refund any unstreamed amount
    uint256 refundAmount = session.totalAmount - finalAmount;
    if (refundAmount > 0) {
      USDC_x.transfer(session.agent, refundAmount);
    }

    emit StreamCompleted(jobId, finalAmount);
  }

  /**
   * Query amount streamed so far (off-chain, for UI display)
   */
  function getAmountStreamed(bytes32 jobId) public view returns (uint256) {
    StreamSession storage session = streams[jobId];
    if (!session.isActive) return session.amountStreamed;

    uint256 elapsed = block.timestamp - session.startTime;
    return (session.totalAmount * elapsed) / session.estimatedDuration;
  }
}
```

#### API Integration

**Backend Changes** (`backend/src/routes/jobs.ts`)

```typescript
import { initiateStream, stopStream, completeStream } from '../lib/blockchain/stream-payments.js';

// When agent approves job and initiates payment
POST /api/jobs/{id}/start-streaming
Body: {
  humanAddress: "0x1234...",
  totalAmount: 500,
  estimatedDurationDays: 14
}
Response: {
  jobId: "job_xyz",
  txHash: "0xabc...",
  flowRate: 413, // USDCx per second
  streamStartTime: 1711762800,
  estimatedEndTime: 1712632800,
  amountStreaming: "$500 over 14 days"
}

// When human submits deliverable, agent can review in real-time
GET /api/jobs/{id}/stream-status
Response: {
  status: "STREAMING",
  startTime: 1711762800,
  currentAmountStreamed: 127.50,  // $127.50 after 3.5 days
  totalAmount: 500,
  percentComplete: 25.5,
  flowRate: "$17.85/day"
}

// If agent is unsatisfied, stop stream
POST /api/jobs/{id}/stop-stream
Body: { reason: "QUALITY" }
Response: {
  message: "Stream stopped",
  amountStreamed: 127.50,
  amountRefunded: 372.50,
  txHash: "0xdef..."
}

// When deliverable is approved, complete stream
POST /api/jobs/{id}/complete-stream
Response: {
  message: "Stream completed",
  amountStreamed: 500,
  txHash: "0x789..."
}
```

**Frontend Changes** (`frontend/src/pages/jobs/JobDetail.tsx`)

```tsx
// For human: real-time payment indicator
<StreamPaymentStatus>
  {streaming && (
    <>
      <ProgressBar percent={27} />
      <p>Earning ${27} of ${500} so far</p>
      <p>Flow rate: $17.85/day</p>
      <p>If you complete on time: $500 on {estimatedEndDate}</p>
      <p>If agent stops stream: You keep ${amountStreamed}</p>
    </>
  )}
</StreamPaymentStatus>

// For agent: quality control
<StreamQualityControl>
  <p>Streaming ${500} at $17.85/day</p>
  <p>Days elapsed: 3 / 14</p>
  <p>Amount streamed: ${50.43}</p>

  {qualityIssues && (
    <button onClick={stopStream}>
      Stop Stream ({`$${amountLeft} refunded`})
    </button>
  )}
</StreamQualityControl>
```

#### Security Analysis

**Ghosting Attack**: Human accepts job, receives payment for 3 days ($50), then disappears
- **Old system**: Agent loses $500, must wait for dispute resolution
- **New system**: Agent stops stream after day 1 (when no work appears), human keeps $17.85
- **ROI for attacker**: $17.85 per ghosted job. With 50 parallel attempts = $900/month. Barely worth it.
- **Defense**: Community arbitration (later) reviews patterns. 30+ ghosting attempts = permanent banning.

**Quality Degradation Attack**: Human starts strong, degrades after 7 days
- **Old system**: Agent reviews deliverable, disputes it, goes through arbitration
- **New system**: Agent can see quality declining, stops stream on day 7
- **Result**: Human earned $125 (fair for 7 days), not $500

**Fake Completion**: Agent claims completed when it's not, stops stream immediately
- **Defense**: Dispute system with community arbitration. Arbiters can review on-chain stream timestamps + deliverables. Fake stops are obvious.

#### Build Effort
- Smart contract: 3 days (Superfluid integration, testing on testnet)
- Backend API: 1.5 days (stream initiation, status querying)
- Frontend UI: 1.5 days (real-time amount display, stop button)
- Testing: 2 days (stream lifecycle, edge cases)
- **Total: 8 days**

---

## PART 3: MECHANISM 3 - SELF-STAKED REPUTATION BONDS

### Purpose
Optional but powerful: Human stakes $1K-100K USDC in a smart contract they control. Not escrow (human keeps keys), but economically meaningful. Slashable by community consensus if fraud occurs.

### Design

#### The Bond Contract

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * HumanPages ReputationBond
 *
 * Each human can optionally stake USDC to signal credibility.
 * Bond is self-custodied (human controls it), but slashable by DAO consensus.
 *
 * Economic signal: "I have $10K at risk if I commit fraud."
 *
 * Bond levels:
 * - Tier 1: $1K (unlocks "bonded" badge, 10% discount for agents)
 * - Tier 2: $5K (20% discount, preferred in searches)
 * - Tier 3: $10K (30% discount, featured tier)
 * - Tier 4: $50K (50% discount, elite tier)
 * - Tier 5: $100K (elite tier, premium positioning)
 */

interface ReputationBond {
  humanId: bytes32;
  humanAddress: address;
  amount: uint256;
  level: uint8; // 1-5
  stakedAt: uint256;
  lastSlashProposal: uint256;
  totalSlashed: uint256;
  isActive: bool;
  bondContract: address; // ERC-4626 vault holding funds
}

contract HumanPagesReputationBond {
  IERC20 USDC;
  IMultisig BOND_MULTISIG; // 3-of-5 community signers

  mapping(bytes32 => ReputationBond) public bonds;
  mapping(address => bytes32) public addressToHumanId;

  event BondCreated(bytes32 indexed humanId, uint256 amount, uint8 level);
  event BondIncreased(bytes32 indexed humanId, uint256 newAmount);
  event BondSlashProposed(bytes32 indexed humanId, uint256 amount, string reason);
  event BondSlashed(bytes32 indexed humanId, uint256 amount);
  event BondWithdrawn(bytes32 indexed humanId, uint256 amount);

  /**
   * Human stakes USDC in a personal vault (ERC-4626)
   * Vault is owned by human address (withdraw only with their signature)
   * But governed by multisig for slashing
   */
  function createBond(bytes32 humanId, uint256 amount) external {
    require(amount >= 1000e6, "Min $1K"); // 1000 USDC
    require(amount <= 100000e6, "Max $100K"); // 100000 USDC

    // Create personal vault for this human
    address vault = deployPersonalVault(msg.sender);

    // Human transfers USDC to vault
    USDC.transferFrom(msg.sender, vault, amount);

    // Record bond
    uint8 level = calculateLevel(amount);
    bonds[humanId] = ReputationBond({
      humanId: humanId,
      humanAddress: msg.sender,
      amount: amount,
      level: level,
      stakedAt: block.timestamp,
      lastSlashProposal: 0,
      totalSlashed: 0,
      isActive: true,
      bondContract: vault
    });

    addressToHumanId[msg.sender] = humanId;
    emit BondCreated(humanId, amount, level);
  }

  /**
   * Human can increase bond at any time
   */
  function increaseBond(bytes32 humanId, uint256 additionalAmount) external {
    ReputationBond storage bond = bonds[humanId];
    require(bond.isActive, "Bond not active");
    require(msg.sender == bond.humanAddress, "Not bond owner");

    uint256 newAmount = bond.amount + additionalAmount;
    require(newAmount <= 100000e6, "Max $100K");

    USDC.transferFrom(msg.sender, bond.bondContract, additionalAmount);
    bond.amount = newAmount;
    bond.level = calculateLevel(newAmount);

    emit BondIncreased(humanId, newAmount);
  }

  /**
   * Propose bond slash (community arbitration)
   * Requires 3-of-5 multisig signatures
   */
  function proposeBondSlash(
    bytes32 humanId,
    uint256 amount,
    string calldata reason,
    bytes32 arbitrationCaseId
  ) external onlyMultisig {
    ReputationBond storage bond = bonds[humanId];
    require(bond.isActive, "Bond not active");
    require(amount <= bond.amount, "Slash exceeds bond");

    // Execute slash directly (multisig already voted)
    bond.amount -= amount;
    bond.totalSlashed += amount;

    // Send slashed amount to DAO treasury
    IERC20(bond.bondContract).transfer(DAO_TREASURY, amount);

    if (bond.amount == 0) {
      bond.isActive = false;
    }

    emit BondSlashed(humanId, amount);
  }

  /**
   * Human can withdraw bond (minus slashed amount) after 30-day lock
   */
  function withdrawBond(bytes32 humanId, uint256 amount) external {
    ReputationBond storage bond = bonds[humanId];
    require(msg.sender == bond.humanAddress, "Not bond owner");
    require(amount <= bond.amount, "Amount exceeds bond");

    // Withdraw from personal vault (human's signature required)
    IPersonalVault(bond.bondContract).withdraw(amount, msg.sender, msg.sender);
    bond.amount -= amount;

    if (bond.amount == 0) {
      bond.isActive = false;
    }

    emit BondWithdrawn(humanId, amount);
  }

  function calculateLevel(uint256 amount) private pure returns (uint8) {
    if (amount >= 100000e6) return 5;
    if (amount >= 50000e6) return 4;
    if (amount >= 10000e6) return 3;
    if (amount >= 5000e6) return 2;
    if (amount >= 1000e6) return 1;
    return 0;
  }
}
```

#### Database Schema Extension

```prisma
// backend/prisma/schema.prisma

model ReputationBond {
  id        String    @id @default(cuid())
  humanId   String
  human     Human     @relation(fields: [humanId], references: [id], onDelete: Cascade)

  amount    Decimal   @db.Decimal(18, 2)  // e.g., 10000.00
  level     Int       // 1-5

  vaultAddress    String    // ERC-4626 vault contract
  bondAddress     String    // Bond contract address

  stakedAt        DateTime  @default(now())
  lastSlashAt     DateTime?
  totalSlashed    Decimal   @default(0) @db.Decimal(18, 2)

  isActive        Boolean   @default(true)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([humanId])
  @@index([level])
  @@index([isActive])
}

model Human {
  // ... existing fields
  reputationBond    ReputationBond?
  bondLevel         Int?            // cached from bond.level for quick filtering
  totalStaked       Decimal?        // cached from bond.amount
}
```

#### Economic Analysis

**Why a human stakes $10K**:

If human earns $50K/year in freelance work:
- Stakeholding creates visible commitment: "I have $10K at risk"
- Agents perceive lower fraud risk: 20-30% discount multiplier
- Return on staking: $50K × 0.20 = $10K/year
- Payback period: 1 year
- Opportunity cost: Lost interest on $10K staked = ~$200-400/year
- **Net benefit**: +$9600-9800/year

**If human gets slashed $5K (e.g., for 3 disputed jobs)**:
- Cost: $5K (plus $50K lost in future earnings due to reputation damage)
- Total cost: $55K
- This exceeds any reasonable job fraud profit

**Sybil resistance of staking**:
- Creating 50 bot accounts costs: 50 × $1K (minimum stake) = $50K
- Even if just 5 bots reach $5K bond level = $25K capital requirement
- With only 30% job completion rate (fraud), expected profit = negative

#### Build Effort
- Smart contract: 2.5 days (vault pattern, multisig integration)
- Backend API: 1 day (bond status, level caching)
- Frontend UI: 1 day (bond creation/withdrawal flow)
- Testing: 1.5 days
- **Total: 6 days**

---

## PART 4: MECHANISM 4 - SYBIL-RESISTANT REPUTATION ALGORITHM

### Purpose
Current trust score weights job COUNT equally. This is broken: Bot completes 50 micro-tasks ($20 each), then scams $5K (net: $4000 profit).

New algorithm: Weight JOB VALUE completed, not count. Also: account age, stake amount, social proof consistency.

### Design

#### Current Algorithm (Flawed)

```
reputation_score (0-40 points):
  = completion_rate × 0.3      // ignores fraud at scale
  + (rating / 5) × 0.35         // can fake with easy jobs
  + log(job_count) × 0.2        // rewards sybil farming
  + (dispute_count) × -0.15     // but one dispute isn't enough
```

**Problem**: 50 jobs × $20 + 1 scam × $5000 = net honest earnings $1000, fraud profit $5000. System doesn't capture value mismatch.

#### New Algorithm (Sybil-Resistant)

```
reputation_score (0-100 points):

1. IDENTITY & VERIFICATION (20 points)
   ├─ Email verified: 3 pts
   ├─ OAuth (Google/GitHub/LinkedIn): 3 pts (max 3)
   ├─ LinkedIn verified: 5 pts
   ├─ Social profiles (3+): 3 pts
   ├─ Humanity Pass score ≥ 40: 3 pts
   └─ Account age (cap at 365 days): 0-5 pts

2. JOB VALUE COMPLETED (30 points) ← NEW
   ├─ Total value completed (weighted by job size):
   │   $0-100:     0-5 pts
   │   $100-1K:    5-10 pts
   │   $1K-10K:    10-20 pts
   │   $10K+:      20-30 pts
   └─ Recent large job (≤30 days): +5 pts bonus

3. BEHAVIORAL CONSISTENCY (20 points)
   ├─ Job completion rate: 0-10 pts
   │   (weighted by value: big job completion > many micro-jobs)
   ├─ Avg rating (normalized 1-5 → 0-10 pts): 0-10 pts
   ├─ Consistency check:
   │   If rating_variance > 1.5: -5 pts penalty
   │   If job_size_variance > 2x: -3 pts penalty

4. DISPUTE RESISTANCE (15 points)
   ├─ Zero disputes: 15 pts
   ├─ 1 dispute: 10 pts (can be false accusation)
   ├─ 2+ disputes: 0 pts
   ├─ Each dispute reduces by 15 pts (floor: 0)
   └─ Resolved favorably: +3 pts back

5. STAKE SIGNAL (15 points) ← NEW
   ├─ No stake: 0 pts
   ├─ $1K stake (Level 1): 3 pts
   ├─ $5K stake (Level 2): 6 pts
   ├─ $10K stake (Level 3): 9 pts
   ├─ $50K+ stake (Level 4-5): 15 pts
   └─ Slashed stake: -5 pts

6. CONSISTENCY OVER TIME (0-5 pts bonus)
   ├─ Activity recency (≤7 days): +2 pts
   ├─ No sudden breaks >30 days: +2 pts
   └─ Positive trend (avg rating improving): +1 pt
```

#### Implementation

**Backend Changes** (`backend/src/lib/trustScore.ts` - rewrite reputation section)

```typescript
/**
 * NEW: Compute reputation sub-score WEIGHTED BY JOB VALUE
 *
 * Instead of log(jobCount), use jobValueCompleted as primary signal
 * Sybil defense: Small jobs have low weight; large jobs need long history
 */
function computeReputationScoreSybilResistant(signals: TrustSignals['reputation']): number {
  if (signals.jobsCompleted === 0) return 0;

  let score = 0;

  // 1. COMPLETION RATE (10 points max)
  // Weighted by value: completing 1×$5K job > completing 20×$100 jobs
  // This is tracked separately from job count
  score += signals.completionRate * 10;

  // 2. AVERAGE RATING (10 points max)
  const ratingNorm = signals.avgRating > 0 ? (signals.avgRating - 1) / 4 : 0;
  score += ratingNorm * 10;

  // 3. TOTAL JOB VALUE COMPLETED (20 points max) ← NEW
  // This is the KEY change: value > count
  const totalValueCompleted = signals.totalJobValueCompleted || 0;
  let valueScore = 0;
  if (totalValueCompleted >= 10000) valueScore = 20;           // $10K+
  else if (totalValueCompleted >= 1000) valueScore = 15;       // $1-10K
  else if (totalValueCompleted >= 100) valueScore = 10;        // $100-1K
  else if (totalValueCompleted > 0) valueScore = 5;            // $1-100

  // Bonus for recent large job
  if (signals.mostRecentJobValue >= 500 && signals.daysSinceMostRecentJob <= 30) {
    valueScore += 5;
  }
  score += valueScore;

  // 4. CONSISTENCY CHECK (negative adjustments)
  // If someone has 50 jobs all $20, but then one $5K, that's suspicious
  if (signals.jobSizeVariance > 2.0) {
    score -= 3; // "Sudden jump from micro to macro is risky"
  }
  if (signals.ratingVariance > 1.5) {
    score -= 5; // "Quality is inconsistent, unreliable"
  }

  // 5. DISPUTE PENALTY
  score -= signals.disputeCount * 5;
  if (signals.disputeCount > 1) {
    score -= 10; // Harsh penalty for multiple disputes
  }

  // Clamp to 0-40 (or return raw for normalization)
  return Math.max(0, Math.min(score, 40));
}

/**
 * NEW: Stake signal (15 points max)
 */
function computeStakeScore(signals: TrustSignals['stake']): number {
  if (!signals.hasBond) return 0;

  const stakeAmount = signals.bondAmount || 0;
  if (stakeAmount >= 50000) return 15;
  if (stakeAmount >= 10000) return 9;
  if (stakeAmount >= 5000) return 6;
  if (stakeAmount >= 1000) return 3;
  return 0;
}

/**
 * Updated signals interface
 */
export interface TrustSignals {
  identity: {
    emailVerified: boolean;
    hasGoogle: boolean;
    hasLinkedin: boolean;
    linkedinVerified: boolean;
    humanityVerified: boolean;
    humanityScore: number | null;
    hasGithub: boolean;
    accountAgeDays: number;
  };
  reputation: {
    jobsCompleted: number;
    completionRate: number; // 0-1
    avgRating: number; // 0-5
    reviewCount: number;
    disputeCount: number;
    totalJobValueCompleted: number; // NEW: in USDC
    mostRecentJobValue: number; // NEW
    daysSinceMostRecentJob: number; // NEW
    jobSizeVariance: number; // NEW: stddev / mean
    ratingVariance: number; // NEW: stddev of ratings
  };
  social: {
    vouchCount: number;
    socialProfilesLinked: number;
  };
  stake: { // NEW section
    hasBond: boolean;
    bondAmount: number;
    bondLevel: number;
    totalSlashed: number;
  };
  activity: {
    accountAgeDays: number;
    daysSinceLastActive: number;
    profileCompleteness: number;
  };
}

/**
 * FINAL SCORE: 0-100 (weighted sum)
 */
function computeFinalScore(signals: TrustSignals): number {
  const identity = computeIdentityScore(signals.identity);      // 0-1
  const reputation = computeReputationScoreSybilResistant(signals.reputation); // 0-40
  const social = computeSocialScore(signals.social);            // 0-15
  const stake = computeStakeScore(signals.stake);              // 0-15
  const activity = computeActivityScore(signals.activity);      // 0-15

  // Weighted sum
  return Math.round(
    identity * 20 +
    reputation * 1.0 +
    social * 1.0 +
    stake * 1.0 +
    activity * 1.0
  );
}
```

#### Database Changes

Need to track additional job data:

```prisma
model Job {
  // ... existing
  value           Decimal   @db.Decimal(18, 2)  // total job value in USD
  completedAt     DateTime?
  rating          Int?      // 1-5 (from review)

  // Aggregate fields for quick reputation computation
  human           Human     @relation(fields: [humanId], references: [id])
  humanId         String
}

// Add computed fields to Human view
view HumanReputationStats {
  humanId         String    @unique
  jobsCompleted   Int
  totalValueCompleted Decimal
  avgRating       Decimal
  jobSizeVariance Decimal
  mostRecentJobValue Decimal
  mostRecentJobDate DateTime
}
```

#### Sybil Attack Analysis

**Attack**: Create 50 bot accounts, complete 150×$20 jobs, then scam 10×$5K jobs

**Under OLD algorithm**:
- Reputation per bot: log(3) × 0.2 × 40 = ~7 pts (very low)
- With 50 bots × 7 pts = 350 total pts across fleet
- But each individual bot is caught by tier limits

**Under NEW algorithm**:
- Total value completed per bot: $3000 (150 × $20)
- Value score: 5 pts only (floor for any job value)
- Avg rating: ~4.5 (easy for fake jobs)
- No stake: 0 pts
- Result: ~22 pts / 100 per bot
- **Locked at BASIC tier**: Can't even accept $500 job

**Expected profit for attacker**:
- Time investment: 50 × 150 jobs × 1 hour = 7500 hours
- Bot farm operating cost: ~$5K (infrastructure)
- Actual revenue from $20 jobs: $3000
- Opportunity cost: 7500 hours × $20/hr = $150,000
- If scam succeeds: +$50,000
- **Net loss: $105,000 + opportunity cost**

**Nash Equilibrium**: Attacker's dominant strategy is honest work (positive expected value).

#### Build Effort
- Backend computation: 2 days
- DB schema changes: 1 day
- Testing & tuning: 2 days
- **Total: 5 days**

---

## PART 5: MECHANISM 5 - ATOMIC TASK DECOMPOSITION

### Purpose
Break $5K jobs into 10 milestones of $500 each. Each milestone: deliver, get paid, continue or stop. Agent never sends >$500 unprotected at once. Human never risks >$500 on one deliverable.

### Design

#### Decomposition Flow

**Old**: $5000 job, agent sends full amount (or streams), human works 2 weeks, delivers

**New**: $5000 job becomes:
```
Milestone 1 ($500): Requirements + delivery spec
  → Human delivers in 2-3 days
  → Agent reviews + approves
  → Stream $500 sent
  → Both sign off (blockchain receipt)
  → Continue? Yes → Milestone 2

Milestone 2 ($500): Next chunk
  → Same process
  → Running total: $1000

... (repeat 10 times)

Final: $5000 fully delivered, both have full audit trail on-chain
```

**Protection**:
- Human can't lose >$500 per milestone (if agent ghosts)
- Agent can't lose >$500 (if human ghosts on one chunk)
- Both have on-chain proof of progress at each step

#### Smart Contract Design

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * HumanPages AtomicTaskDecomposition
 *
 * Breaks large jobs into milestone-based payments.
 * Each milestone: delivery + approval + payment
 *
 * Key insight: Removing trust needed per milestone to $500 cap
 */

struct Milestone {
  uint256 index;                    // 1, 2, 3, ...
  string deliverableSpecification;  // IPFS hash of requirements
  bytes32 deliverableHash;          // keccak256 of submitted deliverable

  uint256 amountUSDC;              // $500
  bool isApproved;
  bool isPaid;

  uint256 submittedAt;
  uint256 approvedAt;
  uint256 paidAt;

  string agentFeedback;            // IPFS hash
  bool humanAppealsApproval;       // If rejected, human can dispute
}

struct AtomicJob {
  bytes32 jobId;
  address agent;
  address human;
  uint256 totalValue;              // $5000
  uint256 milestoneDuration;       // e.g., 2 days
  Milestone[] milestones;

  bool isComplete;
  bool isDisputed;
  uint256 totalPaid;
}

contract HumanPagesAtomicTaskDecomposition {
  ISuperToken USDC_x;

  mapping(bytes32 => AtomicJob) public atomicJobs;

  event MilestoneSubmitted(
    bytes32 indexed jobId,
    uint256 milestoneIndex,
    bytes32 deliverableHash
  );

  event MilestoneApproved(
    bytes32 indexed jobId,
    uint256 milestoneIndex
  );

  event MilestoneRejected(
    bytes32 indexed jobId,
    uint256 milestoneIndex,
    string feedback
  );

  event MilestonePaid(
    bytes32 indexed jobId,
    uint256 milestoneIndex,
    uint256 amount
  );

  /**
   * Create atomic job with N milestones
   */
  function createAtomicJob(
    bytes32 jobId,
    address human,
    uint256 totalValue,
    uint256 numMilestones,
    uint256 milestoneDuration
  ) external {
    require(numMilestones >= 2, "Min 2 milestones");
    require(numMilestones <= 20, "Max 20 milestones");
    require(totalValue > 0, "Value must be > 0");

    uint256 perMilestone = totalValue / numMilestones;
    require(perMilestone <= 5000e6, "Max $5K per milestone");

    AtomicJob storage job = atomicJobs[jobId];
    job.jobId = jobId;
    job.agent = msg.sender;
    job.human = human;
    job.totalValue = totalValue;
    job.milestoneDuration = milestoneDuration;
    job.totalPaid = 0;

    // Create N empty milestones
    for (uint256 i = 0; i < numMilestones; i++) {
      job.milestones.push(
        Milestone({
          index: i + 1,
          deliverableSpecification: "",
          deliverableHash: 0,
          amountUSDC: perMilestone,
          isApproved: false,
          isPaid: false,
          submittedAt: 0,
          approvedAt: 0,
          paidAt: 0,
          agentFeedback: "",
          humanAppealsApproval: false
        })
      );
    }
  }

  /**
   * Human submits deliverable for milestone
   */
  function submitDeliverable(
    bytes32 jobId,
    uint256 milestoneIndex,
    bytes32 deliverableHash
  ) external {
    AtomicJob storage job = atomicJobs[jobId];
    require(msg.sender == job.human, "Only human can submit");
    require(!job.isComplete, "Job already complete");

    Milestone storage ms = job.milestones[milestoneIndex];
    require(ms.deliverableHash == 0, "Already submitted");
    require(!ms.isApproved, "Already approved");

    ms.deliverableHash = deliverableHash;
    ms.submittedAt = block.timestamp;

    emit MilestoneSubmitted(jobId, milestoneIndex, deliverableHash);
  }

  /**
   * Agent reviews and approves milestone
   */
  function approveMilestone(
    bytes32 jobId,
    uint256 milestoneIndex,
    string calldata feedback
  ) external {
    AtomicJob storage job = atomicJobs[jobId];
    require(msg.sender == job.agent, "Only agent can approve");

    Milestone storage ms = job.milestones[milestoneIndex];
    require(ms.deliverableHash != 0, "No deliverable submitted");

    ms.isApproved = true;
    ms.approvedAt = block.timestamp;

    emit MilestoneApproved(jobId, milestoneIndex);
  }

  /**
   * Agent rejects milestone, requires resubmission
   */
  function rejectMilestone(
    bytes32 jobId,
    uint256 milestoneIndex,
    string calldata feedback
  ) external {
    AtomicJob storage job = atomicJobs[jobId];
    require(msg.sender == job.agent, "Only agent can reject");

    Milestone storage ms = job.milestones[milestoneIndex];
    require(!ms.isApproved, "Already approved");
    require(!ms.isPaid, "Already paid");

    // Human can resubmit
    ms.deliverableHash = 0;
    ms.submittedAt = 0;
    ms.agentFeedback = feedback;

    emit MilestoneRejected(jobId, milestoneIndex, feedback);
  }

  /**
   * Agent releases payment for milestone
   * Uses Superfluid for instant settlement
   */
  function payMilestone(bytes32 jobId, uint256 milestoneIndex) external {
    AtomicJob storage job = atomicJobs[jobId];
    require(msg.sender == job.agent, "Only agent can pay");

    Milestone storage ms = job.milestones[milestoneIndex];
    require(ms.isApproved, "Milestone not approved");
    require(!ms.isPaid, "Already paid");

    // Transfer USDC to human
    USDC_x.transfer(job.human, ms.amountUSDC);
    ms.isPaid = true;
    ms.paidAt = block.timestamp;

    job.totalPaid += ms.amountUSDC;

    if (job.totalPaid >= job.totalValue) {
      job.isComplete = true;
    }

    emit MilestonePaid(jobId, milestoneIndex, ms.amountUSDC);
  }

  /**
   * Get job status
   */
  function getJobStatus(bytes32 jobId) external view returns (
    uint256 milestoneCount,
    uint256 milestonesApproved,
    uint256 milestonesPaid,
    uint256 totalPaid,
    uint256 totalValue,
    bool isComplete
  ) {
    AtomicJob storage job = atomicJobs[jobId];

    uint256 approved = 0;
    uint256 paid = 0;

    for (uint256 i = 0; i < job.milestones.length; i++) {
      if (job.milestones[i].isApproved) approved++;
      if (job.milestones[i].isPaid) paid++;
    }

    return (
      job.milestones.length,
      approved,
      paid,
      job.totalPaid,
      job.totalValue,
      job.isComplete
    );
  }
}
```

#### API Integration

**Backend Changes** (`backend/src/routes/jobs.ts`)

```typescript
// When creating job, optionally enable atomic milestones
POST /api/jobs
Body: {
  value: 5000,
  humanId: "human_xyz",
  deliverableSpec: "...",
  atomicMilestones: true,
  numMilestones: 10,
  milestoneDuration: 172800  // 2 days in seconds
}
Response: {
  jobId: "job_abc",
  milestonesEnabled: true,
  milestones: [
    { index: 1, amountUSDC: 500, status: "pending_delivery" },
    { index: 2, amountUSDC: 500, status: "pending_delivery" },
    ...
  ]
}

// Submit milestone deliverable
POST /api/jobs/{jobId}/milestones/{index}/submit
Body: {
  deliverableHash: "QmAbc123..."  // IPFS
}
Response: { submitted: true, timestamp: 1711762800 }

// Agent approves milestone
POST /api/jobs/{jobId}/milestones/{index}/approve
Body: { feedback: "Great work!" }
Response: { approved: true, nextMilestoneStatus: "pending_delivery" }

// Agent pays milestone
POST /api/jobs/{jobId}/milestones/{index}/pay
Response: {
  txHash: "0xdef...",
  amountPaid: 500,
  milestonePaidCount: 1,
  totalPaidCount: 1,
  totalJobProgress: "1 of 10",
  nextAction: "human_delivers_milestone_2"
}
```

**Frontend Changes**

```tsx
// Job detail view shows milestone breakdown
<AtomicJobProgress>
  <MilestoneList>
    {milestones.map((m, i) => (
      <MilestoneCard key={i}>
        <MilestoneHeader>
          Milestone {m.index} of 10 — ${m.amountUSDC}
        </MilestoneHeader>

        {m.status === 'pending_delivery' && (
          <HumanView>
            <DeliverableUpload
              onSubmit={(hash) => submitMilestone(hash)}
              placeholder="Submit deliverable for milestone 1..."
            />
          </HumanView>
        )}

        {m.status === 'pending_approval' && (
          <AgentView>
            <DeliverableReview
              deliverable={m.deliverable}
              onApprove={() => approveMilestone(i)}
              onReject={() => rejectMilestone(i)}
            />
          </AgentView>
        )}

        {m.status === 'approved' && (
          <AgentView>
            <button onClick={() => payMilestone(i)}>
              Pay ${m.amountUSDC}
            </button>
          </AgentView>
        )}

        {m.status === 'paid' && (
          <Checkmark>✓ Paid on {m.paidAt}</Checkmark>
        )}
      </MilestoneCard>
    ))}
  </MilestoneList>

  <ProgressSummary>
    Overall progress: 7 of 10 milestones complete
    Total paid: $3500 of $5000
    Estimated completion: {estimatedDate}
  </ProgressSummary>
</AtomicJobProgress>
```

#### Economic Defense Against Agent Fraud

**Attack**: Agent accepts deliverables but refuses to pay

**Under atomic milestones**:
- Deliverable proof is on-chain (hash)
- Community arbitration reviews at each milestone (not just end)
- If agent refuses to pay milestone 1, human can:
  1. File dispute for milestone 1 only ($500)
  2. Stop work (doesn't risk entire $5000 job)
  3. Move on to next job
- Reputation damage is proportional (1 unpaid $500 vs. 1 unpaid $5000)

**Game theory**:
- Agent cheats on 1 of 10 milestones = saves $500
- But reputation damage = massive (1 unpaid milestone = disputed job = reputation hit)
- Better outcome: Pay all 10, build reputation for future $50K+ jobs

#### Build Effort
- Smart contract: 2 days
- Backend API: 1.5 days
- Frontend UI (milestone cards, upload, progress): 2 days
- Testing: 1.5 days
- **Total: 7 days**

---

## PART 6: MECHANISM 6 - COMMUNITY ARBITRATION

### Purpose
When disputes occur, 3 randomly selected high-reputation humans vote. Transparent, permanent on-chain record. Loser's reputation slashed (no funds clawed back—just reputation).

### Design

#### Arbitration Process

```
1. DISPUTE FILING (48-hour window after job completion)
   ├─ Either party files: "Deliverable not acceptable" or "Payment refused"
   ├─ Provide evidence: chat history, deliverables, timestamps
   ├─ Put $100 USDC bond (slashed if frivolous)
   └─ Case enters queue

2. ARBITER SELECTION (random, high-reputation)
   ├─ System selects 3 arbiters with:
   │   ├─ Reputation score ≥ 70
   │   ├─ 20+ completed jobs
   │   ├─ 0 pending disputes
   │   └─ Not related to human or agent
   ├─ Arbiters have 48 hours to review
   └─ Earn $50 each as compensation

3. VOTING & EVIDENCE REVIEW
   ├─ Arbiters review:
   │   ├─ Complete job chat transcript
   │   ├─ Deliverable hash vs. original spec
   │   ├─ On-chain payment/stream records
   │   ├─ Both parties' statements
   │   └─ Historical patterns (is this plaintiff always complaining?)
   │
   ├─ Each votes: "PLAINTIFF_WINS" or "DEFENDANT_WINS"
   ├─ Vote is private (revealed all at once)
   └─ 2-of-3 majority rules

4. EXECUTION & REPUTATION DAMAGE
   ├─ If plaintiff wins:
   │   ├─ Defendant's reputation slashed: -10 points
   │   ├─ Public record on-chain: "Dispute lost on [date]"
   │   ├─ If defendant is human: may drop tier
   │   └─ If defendant is agent: tagged "high refusal rate"
   │
   ├─ If defendant wins:
   │   ├─ Plaintiff's reputation slashed: -5 points (false claim penalty)
   │   ├─ Plaintiff's bond ($100) forfeited
   │   └─ Public record: "Frivolous dispute filed"
   │
   ├─ Loser appeals (1 time only):
   │   ├─ Escalate to 5 arbiters instead of 3
   │   ├─ $500 bond (burned if appeal lost)
   │   └─ Final decision is binding, on-chain forever

5. ON-CHAIN RECORDING
   ├─ Complete case record published to blockchain:
   │   ├─ Case ID
   │   ├─ Plaintiff & defendant addresses
   │   ├─ Evidence hashes (IPFS)
   │   ├─ Arbiter votes (anonymous initially, revealed after)
   │   ├─ Final judgment
   │   └─ Timestamp
   │
   ├─ Reputation damage written to each human's record
   ├─ Public API: /api/humans/{id}/disputes
   └─ Every freelance platform can query this

```

#### Smart Contract Design

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * HumanPages Community Arbitration
 *
 * Decentralized dispute resolution where community votes on job disputes.
 * Arbiters are high-reputation users; decisions are on-chain and immutable.
 *
 * Reputation damage (not fund clawback) is the enforcement mechanism.
 */

struct DisputeCase {
  bytes32 caseId;
  bytes32 jobId;

  address plaintiff;
  address defendant;

  string plaintiffClaim;      // IPFS hash
  string defendantResponse;   // IPFS hash

  enum Status { FILED, ARBITERS_ASSIGNED, VOTING, RESOLVED, APPEALED, FINAL }
  Status status;

  address[3] arbiters;
  bool[3] arbitersVoted;       // which arbiters voted
  bool[3] arbitersVote;        // true = plaintiff, false = defendant

  uint256 createdAt;
  uint256 votingDeadline;
  uint256 resolvedAt;

  bool plaintiffWon;
  uint8 vote_2_to_1_margin;     // 2 vs 1, or unanimous

  uint256 plaintiffBondAmount;  // $100
  uint256 appealBondAmount;     // $500 if appealed
  bool hasAppeal;

  string publicReasoning;       // Arbiters' summary
}

contract HumanPagesArbitration {
  ISuperToken USDC_x;
  IReputationRegistry reputationRegistry; // Can slash reputation

  mapping(bytes32 => DisputeCase) public cases;

  mapping(address => uint256) public arbiterEarnings; // $50 per case

  event DisputeFiled(
    bytes32 indexed caseId,
    bytes32 indexed jobId,
    address indexed plaintiff,
    address defendant
  );

  event ArbitersAssigned(
    bytes32 indexed caseId,
    address[3] arbiters
  );

  event VoteCast(
    bytes32 indexed caseId,
    address indexed arbiter,
    bool plaintiffWins
  );

  event DisputeResolved(
    bytes32 indexed caseId,
    bool plaintiffWon,
    string reasoning
  );

  event ReputationSlashed(
    address indexed loser,
    uint256 pointsSlashed,
    bytes32 caseId
  );

  /**
   * File a dispute within 48 hours of job completion
   */
  function fileDispute(
    bytes32 jobId,
    address defendant,
    string calldata plaintiffClaim
  ) external {
    require(msg.sender != defendant, "Can't dispute self");

    // Check job exists and is completed
    Job storage job = jobs[jobId];
    require(job.isCompleted, "Job not completed");
    require(block.timestamp <= job.completedAt + 48 hours, "Too late to dispute");

    bytes32 caseId = keccak256(abi.encodePacked(jobId, msg.sender, block.timestamp));

    DisputeCase storage case = cases[caseId];
    case.caseId = caseId;
    case.jobId = jobId;
    case.plaintiff = msg.sender;
    case.defendant = defendant;
    case.plaintiffClaim = plaintiffClaim; // IPFS hash
    case.plaintiffBondAmount = 100e6; // $100 USDC
    case.createdAt = block.timestamp;
    case.votingDeadline = block.timestamp + 48 hours;
    case.status = Status.FILED;

    // Take plaintiff's bond
    USDC_x.transferFrom(msg.sender, address(this), 100e6);

    emit DisputeFiled(caseId, jobId, msg.sender, defendant);

    // Assign arbiters (async, off-chain call triggers this)
  }

  /**
   * Off-chain: Select 3 random arbiters with reputation ≥ 70
   * On-chain: Record their addresses
   */
  function assignArbiters(
    bytes32 caseId,
    address[3] calldata arbiters
  ) external onlyArbitrationManager {
    DisputeCase storage case = cases[caseId];
    require(case.status == Status.FILED, "Invalid status");

    // Verify all 3 have reputation ≥ 70, no conflicts
    for (uint i = 0; i < 3; i++) {
      uint256 repScore = reputationRegistry.getReputation(arbiters[i]);
      require(repScore >= 70, "Arbiter reputation too low");
      require(arbiters[i] != case.plaintiff && arbiters[i] != case.defendant, "Conflict");
    }

    case.arbiters = arbiters;
    case.status = Status.ARBITERS_ASSIGNED;

    emit ArbitersAssigned(caseId, arbiters);
  }

  /**
   * Arbiter votes (private; revealed after all vote)
   */
  function castVote(
    bytes32 caseId,
    bool plaintiffWins
  ) external {
    DisputeCase storage case = cases[caseId];
    require(case.status == Status.ARBITERS_ASSIGNED || case.status == Status.VOTING, "Invalid status");
    require(block.timestamp <= case.votingDeadline, "Voting closed");

    // Verify caller is assigned arbiter
    uint arbiterIndex = 999;
    for (uint i = 0; i < 3; i++) {
      if (case.arbiters[i] == msg.sender) {
        arbiterIndex = i;
        break;
      }
    }
    require(arbiterIndex != 999, "Not an arbiter");
    require(!case.arbitersVoted[arbiterIndex], "Already voted");

    case.arbitersVoted[arbiterIndex] = true;
    case.arbitersVote[arbiterIndex] = plaintiffWins;
    case.status = Status.VOTING;

    emit VoteCast(caseId, msg.sender, plaintiffWins);

    // Check if all 3 voted
    uint votedCount = 0;
    for (uint i = 0; i < 3; i++) {
      if (case.arbitersVoted[i]) votedCount++;
    }

    if (votedCount == 3 || block.timestamp > case.votingDeadline) {
      resolveCaseInternal(caseId);
    }
  }

  /**
   * Resolve case after voting ends (majority rules)
   */
  function resolveCaseInternal(bytes32 caseId) internal {
    DisputeCase storage case = cases[caseId];
    require(case.status == Status.VOTING, "Not voting phase");

    uint plaintiffVotes = 0;
    for (uint i = 0; i < 3; i++) {
      if (case.arbitersVoted[i] && case.arbitersVote[i]) {
        plaintiffVotes++;
      }
    }

    case.plaintiffWon = (plaintiffVotes >= 2);
    case.status = Status.RESOLVED;
    case.resolvedAt = block.timestamp;

    if (case.plaintiffWon) {
      // Defendant loses reputation
      reputationRegistry.slash(case.defendant, 10, caseId);
      emit ReputationSlashed(case.defendant, 10, caseId);

      // Refund plaintiff's bond
      USDC_x.transfer(case.plaintiff, 100e6);
    } else {
      // Plaintiff loses reputation + bond
      reputationRegistry.slash(case.plaintiff, 5, caseId);
      emit ReputationSlashed(case.plaintiff, 5, caseId);
      // Bond is forfeited (stays in contract)
    }

    // Pay arbiters $50 each
    for (uint i = 0; i < 3; i++) {
      if (case.arbitersVoted[i]) {
        arbiterEarnings[case.arbiters[i]] += 50e6;
      }
    }

    emit DisputeResolved(caseId, case.plaintiffWon, "2-to-1 majority");
  }

  /**
   * Withdraw arbiter earnings
   */
  function withdrawArbiterEarnings() external {
    uint256 amount = arbiterEarnings[msg.sender];
    require(amount > 0, "No earnings");

    arbiterEarnings[msg.sender] = 0;
    USDC_x.transfer(msg.sender, amount);
  }
}
```

#### API Integration

**Backend Changes** (`backend/src/routes/disputes.ts` - new file)

```typescript
import { fileDispute, getDisputeCase, castVote } from '../lib/blockchain/arbitration.js';

// File a dispute
POST /api/disputes
Body: {
  jobId: "job_xyz",
  defendantId: "human_abc",
  claim: "Deliverable was not acceptable per specification"
}
Response: {
  caseId: "case_123",
  status: "FILED",
  deadline: "2026-03-31T12:00:00Z",
  bondRequired: 100,
  txHash: "0xabc..."
}

// Get case status
GET /api/disputes/{caseId}
Response: {
  caseId: "case_123",
  jobId: "job_xyz",
  plaintiff: { id: "human_1", name: "Alice" },
  defendant: { id: "human_2", name: "Bob" },
  status: "ARBITERS_ASSIGNED",
  arbiters: [
    { address: "0x111", reputation: 85 },
    { address: "0x222", reputation: 78 },
    { address: "0x333", reputation: 92 }
  ],
  votesReceived: 1,
  votingDeadline: "2026-03-31T12:00:00Z",
  evidence: {
    plaintiffClaim: "QmAbc...",
    defendantResponse: null  // defendant hasn't responded yet
  }
}

// Cast vote (arbiter only)
POST /api/disputes/{caseId}/vote
Body: { vote: "PLAINTIFF" | "DEFENDANT" }
Response: { voted: true, remaining: 2 }

// Get resolved case
GET /api/disputes/{caseId}/resolution
Response: {
  caseId: "case_123",
  status: "RESOLVED",
  winner: "PLAINTIFF",
  votes: "2-to-1",
  reputation_change_defendant: -10,
  reputation_change_plaintiff: 0,  // won, no penalty
  on_chain_record: "0xdef...",
  public_summary: "Deliverable did not meet specifications..."
}
```

**Frontend Changes** (`frontend/src/pages/disputes/`)

```tsx
// File dispute
<DisputeForm>
  <h2>File a Dispute</h2>
  <p>You have 48 hours after job completion to file.</p>

  <TextField
    label="Job ID"
    value={jobId}
    readOnly
  />

  <TextField
    label="Describe the issue"
    value={claim}
    onChange={setClaim}
    multiline
  />

  <FileUpload
    label="Evidence (chat, deliverables, etc.)"
    onUpload={uploadToIPFS}
  />

  <Button onClick={submitDispute}>
    File Dispute ($100 bond)
  </Button>
</DisputeForm>

// View case (arbiter view)
<ArbitrationCaseView>
  <h2>Case {caseId}</h2>

  <EvidencePanel>
    <h3>Plaintiff's Claim</h3>
    <p>{case.plaintiffClaim}</p>

    <h3>Defendant's Response</h3>
    {case.defendantResponse ? (
      <p>{case.defendantResponse}</p>
    ) : (
      <p style={{ color: 'red' }}>Defendant has not responded</p>
    )}
  </EvidencePanel>

  <VotingPanel>
    <h3>Your Vote (due {votingDeadline})</h3>
    <Button
      variant={vote === 'PLAINTIFF' ? 'primary' : 'secondary'}
      onClick={() => setVote('PLAINTIFF')}
    >
      Plaintiff wins
    </Button>
    <Button
      variant={vote === 'DEFENDANT' ? 'primary' : 'secondary'}
      onClick={() => setVote('DEFENDANT')}
    >
      Defendant wins
    </Button>
    <Button onClick={submitVote} disabled={!vote}>
      Submit Vote
    </Button>
  </VotingPanel>
</ArbitrationCaseView>

// View resolved case
<ResolvedCaseView>
  <h2>Case {caseId} — {winner === 'PLAINTIFF' ? 'Plaintiff' : 'Defendant'} Wins</h2>

  <Verdict>
    <p>Decision: 2-to-1 majority ({timeToResolve})</p>
    <p>Public reasoning: {publicReasoning}</p>
  </Verdict>

  <ReputationImpact>
    <p>{loserName}: -10 reputation points</p>
    <p>On-chain record: permanent</p>
    <button>View on Etherscan</button>
  </ReputationImpact>

  <AppealOption>
    <p>Disagree? Appeal to 5 arbiters ($500 bond)</p>
    <button onClick={initiateAppeal}>Appeal Decision</button>
  </AppealOption>
</ResolvedCaseView>
```

#### Game Theory: Honest Verdict Incentives

**Why arbiters vote honestly**:

1. **Reputation at stake**: Arbiters are selected from 70+ reputation pool. Voting dishonestly to favor plaintiff/defendant who pays them = fraud. Caught = permanent ban from arbitration = lose $50/case income.

2. **Anonymous voting initially**: Arbiters don't know how others voted until all votes in. Reduces collusion (can't know if you'll be outvoted).

3. **Consensus check**: Any arbiter voting against 2-1 majority is flagged for review by meta-arbiters (next level). Patterns of dishonest voting get caught.

4. **Earnings incentive**: Arbiters earn $50/case (~$5-10/hour for 1-2 hours review). Only sustainable if reputation intact. Cheating once ruins entire arbitration career.

#### Build Effort
- Smart contract: 3 days
- Backend API: 1.5 days
- Frontend UI (case view, voting, evidence): 2 days
- Testing & game theory verification: 2 days
- **Total: 8.5 days**

---

## PART 7: ATTACK SCENARIOS & DEFENSES

Now let's run 3 realistic attacks and show how the combined system defends.

### Attack 1: Bot Farm + Large Job Scam

**Attacker strategy**: Create 50 bot accounts, complete 150×$20 jobs each, then accept 10×$5K jobs and ghost.

**Setup**:
- 50 accounts × 3 jobs each (to hit BASIC tier) = 150 jobs
- Time: 2-3 weeks of automation
- Earnings: $3000 legitimate
- Expected fraud yield: 10 × $5000 × (1 - 30% failure) = $35,000
- Time investment: ~200 hours

#### Defense 1: Progressive Trust Tiers

Bot accounts:
- Tier 1 (NEW): Max $20/job → Can complete only $20 jobs
- Unlock Tier 2: Requires 1 verified job (bot account has 0; it just spams)
- Each bot now needs to complete 1 legitimate $20-100 job per account
- Time cost: 50 accounts × 1 hour = 50 hours
- Result: 50 bots reach BASIC tier (max $100/job)

But to reach VERIFIED tier (required for $500+ jobs):
- Requires: 7 jobs, $1000 earned, 14 days account age
- Per bot: ~10 hours work + 14-day wait
- Total: 50 bots × 10 hours = 500 hours + 14-day calendar wait

**Attacker ROI so far**:
- Time: 200 hours (setup) + 500 hours (tier-grinding) = 700 hours
- Opportunity cost: 700 × $20/hr = $14,000 (vs. legitimate work)
- Fraud profit potential: $35,000
- Gross gain: $21,000
- BUT: This assumes zero detection and zero failure. Actual ROI: worse

#### Defense 2: Sybil-Resistant Reputation (Value-Weighted)

Each bot completes 7×$100 jobs = $700 earned (not 150×$20 = $3000)

Reputation score per bot:
- Total value completed: $700 (NOT 150 jobs)
- Value score: 5 pts (floor, less than $1K)
- Behavioral: ~6 pts (high rating from self-dealing with fake agent)
- Social: 0 pts (no vouches)
- Stake: 0 pts
- **Total: ~11 pts** → Firmly stuck at BASIC tier

To fake $5K completion, bots need $1K+ value:
- Requires 10 jobs × $100 = $700 (still below threshold)
- Or 20 × $50 = $1000
- But $100 is max for BASIC tier anyway (circular limit)

**Attacker pivot**: Bypass tier limits by completing just enough expensive work

If bots do 5 × $500 jobs (unlocks VERIFIED) + 5 × $5K jobs (scam):
- Time per bot: 5 hours work + 14-day wait = 19 hours + 14 days
- Total: 50 × 19 = 950 hours + 14-day calendar wait
- Opportunity cost: 950 × $20 = $19,000
- Fraud yield: 5 × $5000 × 0.7 (30% success) = $17,500 per successful 5-job sequence
- Net: -$1,500 (loss)

**Math**: Attacker needs honest work to exceed fraud profit. Better to just work legitimately.

#### Defense 3: Atomic Task Decomposition + Streaming

Even if bot bypasses tiers (lucky), accepts $5K job:

Job is broken into 10×$500 milestones:
- Milestone 1: Bot must deliver actual work or get paid $0
- Stream payment: $50/day = bot needs to work 10 days minimum to earn $500
- Agent sees quality on day 2-3, stops stream if bad
- Bot's expected earnings: $50-150 (proportional to work done)

**Attack effectiveness**: Each $5K "scam" yields only $50-150, not $5000

#### Defense 4: Community Arbitration + Reputation Slash

If somehow bot completes 10 milestones without agent noticing (unlikely), then:
- Agent reviews final deliverable → Disputes
- Case goes to arbitration
- 3-5 arbiters review entire 10-milestone history
- Pattern obvious: 10 milestones, all copied/low-quality
- Bot loses: -10 reputation points (BASIC tier requires ≥15 pts)
- Result: Banned from platform

#### Combined Defense Result

**Attacker's actual expected value**:
```
Cost:
  - 700 hours work = $14,000 opportunity cost
  - Infrastructure: $5,000
  - Total: $19,000

Benefit:
  - Each bot's fraud success: maybe $100-500 (if smart)
  - 50 bots × $200 average = $10,000

NET LOSS: -$9,000 + time + effort + risk of discovery
```

**Honest work ROI**:
```
700 hours × $50/hour = $35,000

Better to work honestly.
```

### Attack 2: Trusted Account Rug Pull

**Attacker strategy**: Create 1 account, build it legitimately over 6 months ($10K earned, 20 jobs, 4.5 rating), gain TRUSTED tier, then accept 1×$3K job and ghost.

**Setup**:
- 6 months of real work (reputation building)
- Reach TRUSTED tier (60+ reputation, max $5K/job)
- Accept $3K milestone-based job
- After receiving payment for milestones 1-3 ($1500), disappear

#### Defense 1: Streaming Payments

Milestones 1-3:
- Each $300 payment is streamed over 3 days
- Agent sees daily progress (should be visible in deliverable submissions)
- After milestone 1, if no deliverable appears, agent stops stream
- Agent only loses what's been streamed (~$100)

**But attacker is smart**: Submits acceptable milestones 1-2 (keeps agent happy), then ghosts after getting $600

#### Defense 2: Atomic Task Decomposition + Reputation at Stake

On-chain record:
- Milestones 1-2: Completed and paid
- Milestone 3: Submitted but agent rejects (quality drops)
- Milestone 4 onwards: No submission for 5+ days

Agent files dispute for milestones 3-10 (unpaid).

#### Defense 3: Trusted Tier Requirements + Account Age

**Key insight**: 6 months of real work means:
- 20 jobs completed = 200+ hours minimum legitimate work
- $10K earned = actual income (not farmable quickly)
- 4.5 rating = sustained quality (hard to fake)

**Attacker's calculus**:
```
Cost:
  - 6 months × $50/week average = $12,000 opportunity cost

Benefit:
  - Ghost after $600 paid
  - $600 profit

NET LOSS: -$11,400
```

**Even if scam succeeds fully ($3K)**:
```
Cost: $12,000
Benefit: $3,000
Net: -$9,000
```

**Reputation damage from ghosting**:
- Reputation loss: -10 pts (disputed job)
- Falls from TRUSTED (60+) → VERIFIED (50)
- Can no longer take $5K jobs (capped at $500)
- Future earnings destroyed: $50K/year → $5K/year (10x reduction)
- Cost over 5-year career: $225,000 in lost earnings

**Expected value**: Hugely negative

#### Defense 4: Community Arbitration + Permanent Record

Dispute is filed, arbiters vote:
- All milestones 1-2 are paid (obvious)
- Milestones 3+ show no submissions (on-chain, timestamped)
- Arbiter vote: unanimous PLAINTIFF (agent) wins
- Reputation slash: -10 pts
- On-chain record: "Dispute lost, ghosted after 2/10 milestones"
- This record is portable (visible on Base mainnet)

If attacker tries to rebuild reputation:
- New jobs see: "-10 reputation from dispute"
- Agents won't hire (trust recovery takes years)
- Even rebuilding to 60+ takes ~200+ more jobs

**Recovery math**:
- New account from 50 → 60 pts: ~30-50 jobs (~300 hours work)
- Future earnings potential: ~$5000 (capped at VERIFIED tier)
- Cost to recover: ~$3000 opportunity cost
- Original fraud gain: $3000
- Net: break-even, plus permanent reputation scar

### Attack 3: Agent-Side Fraud (Refuses Payment)

**Attacker strategy**: Agent posts $5K job, human delivers, agent claims work was garbage and disputes without paying.

**Setup**:
- Agent: "Deliverable is not acceptable"
- Refuses to pay stream or complete milestones
- Leaves 1-star review
- Hope human has low reputation and dispute system favors agent

#### Defense 1: Streaming Payments

Human has already received:
- $500 (milestone 1 approved and paid)
- Partial stream for milestone 2 (e.g., $150)

Agent can't claw back streamed payments (on-chain, immutable).

**Agent's loss**: $650 minimum for refusing 2+ milestones

#### Defense 2: Atomic Task Decomposition + Evidence

On-chain proof:
- Human submitted deliverables for milestones 1-3 (hash + timestamp)
- Agent approved milestones 1-2 (on-chain approval)
- Agent rejected milestone 3 but didn't pay for 1-2

**This is clear fraud**: Agent can't say "all work was bad" if they already approved 2 milestones and paid them.

#### Defense 3: Community Arbitration (Agent Loss)

Human files dispute for unpaid milestones:

**Evidence**:
1. Milestone 1-2: Agent's own approval (on-chain)
2. Payment receipt: Only $600 paid of $1500 owed
3. Deliverable hashes: All submitted on-time
4. Agent's feedback: "Great, continue to milestone 3" (in chat)
5. Sudden refusal: Only appears after human completes all work

**Arbiter analysis**:
- Pattern is obvious: Agent approved, paid, then disputed
- Motivation: Save $2400 on a $5K job
- Risk to agent: Severe reputation damage

**Arbiters vote**: PLAINTIFF (human) wins unanimously

**Consequences for agent**:
- Reputation loss: -10 pts
- If agent was TRUSTED (high reputation), may fall to VERIFIED
- Tagged: "High dispute rate, payment refusal"
- Loss of future business: Agents are brands too; clients see dispute history

#### Defense 4: Reputation at Stake (Mutual Skin in Game)

If agents had optional staking (bonds to signal trustworthiness):
- Agent stakes $10K to unlock high-value contracts
- Dispute loss: Slash $500 from bond
- Multiple disputes: Slash more; bond depleted
- Result: Fraudulent agents are automatically excluded

But even without agent staking:
- Reputation loss is severe and permanent
- Agent can't hide history (blockchain is public)
- Subsequent clients see: "2 disputes, both agent-side fraud claims"

---

## PART 8: ECONOMIC ANALYSIS & GAME THEORY

### Nash Equilibrium: Honest Behavior is Dominant

Let's model the game for both humans and agents.

#### For Humans (Workers)

**Honest Strategy**:
- Complete jobs reliably
- Build reputation over time
- Earn $40K-100K annually (depending on tier)

**Fraud Strategy**:
- Farm tier 1 jobs
- Scam on $5K job
- Expected return: $3K-5K
- Time cost: 700-1000 hours
- Opportunity cost: $14K-20K
- Risk: 30% failure, reputation slash to 0, banned forever

**Game theory**:
```
Honest: EV = $50K/year × 10 years = $500K (lifetime)
Fraud:  EV = $3K profit - $15K opportunity cost - $500K lost future earnings = -$512K

Dominant strategy: HONEST
```

#### For Agents (Buyers)

**Honest Strategy**:
- Post real jobs
- Pay for real work
- Build reputation as reliable buyer
- Access large pool of TRUSTED workers

**Fraud Strategy**:
- Post job, get work, refuse to pay, dispute
- Gain: Save $5K per fraud
- Cost: Reputation loss (-10 pts), future workers see fraud pattern, can't hire TRUSTED workers
- Loss: Can't access TRUSTED tier (60+) if reputation falls to VERIFIED (50)
- Future cost: Must pay premium wages to convince low-rep workers to work (15-20% premium)

**Game theory**:
```
Honest:  EV = $5M in jobs × 5% margin = $250K profit/year × 10 years = $2.5M
Fraud:   EV = 10 × $5K fraud attempts = $50K - $2.5M lost future earnings = -$2.45M

Dominant strategy: HONEST
```

#### Sybil Resistance Score

**Metric**: "How many bot accounts can profitably attack the system?"

```
Old escrow system:
  - Cost per account: ~$0 (no staking)
  - Profit per successful scam: $5K
  - Threshold for breaking even: ~3 accounts
  - Risk: Medium (can rotate accounts if caught)

  Result: Sybil-vulnerable

New cryptoeconomic system:
  - Cost per account: ~700 hours work = $14K opportunity cost
  - Profit per successful scam: $200-500 (after defenses)
  - Threshold for breaking even: Impossible (costs exceed returns)
  - Risk: Extreme (permanent reputation ban, on-chain forever)

  Result: Sybil-resistant
```

---

## PART 9: IMPLEMENTATION ROADMAP

Total build effort across all 6 mechanisms:

```
Mechanism 1: Progressive Trust Tiers          5 days
Mechanism 2: Streaming Payments               8 days
Mechanism 3: Self-Staked Reputation Bonds     6 days
Mechanism 4: Sybil-Resistant Reputation Algo  5 days
Mechanism 5: Atomic Task Decomposition        7 days
Mechanism 6: Community Arbitration            8.5 days
─────────────────────────────────────────────────────
TOTAL                                         39.5 days (≈ 6-7 weeks)
```

### Phase 1: Foundation (Week 1-2)
- [ ] Mechanism 4: Update trustScore.ts with value-weighted algorithm
- [ ] Mechanism 1: Implement tier limits in backend
- [ ] Database migrations for new fields

### Phase 2: Smart Contracts (Week 3-4)
- [ ] Mechanism 2: Deploy StreamPayments contract
- [ ] Mechanism 3: Deploy ReputationBond contract
- [ ] Mechanism 5: Deploy AtomicTaskDecomposition contract
- [ ] Testnet deployments + stress testing

### Phase 3: Backend APIs (Week 5)
- [ ] Mechanism 1: Tier validation endpoints
- [ ] Mechanism 2: Stream status + stop stream endpoints
- [ ] Mechanism 3: Bond creation + withdrawal endpoints
- [ ] Mechanism 5: Milestone management endpoints
- [ ] Mechanism 6: Dispute filing + arbitration endpoints

### Phase 4: Frontend UX (Week 6)
- [ ] Tier progress indicators
- [ ] Streaming payment dashboard
- [ ] Milestone submission + approval flow
- [ ] Arbitration voting UI

### Phase 5: Testing & Launch (Week 7)
- [ ] End-to-end testing
- [ ] Attack scenario simulations
- [ ] Mainnet launch
- [ ] Monitoring & early fraud detection

---

## PART 10: RISK ANALYSIS & MITIGATIONS

### Technical Risks

**Risk**: Superfluid stream interruption (network congestion, contract failure)
- **Mitigation**: Fallback to daily batch payments if stream fails
- **Cost**: +1 day backend work

**Risk**: Arbitration voting collusion (3 arbiters vote together dishonestly)
- **Mitigation**: Escalate to 5 arbiters for high-value cases; meta-arbitration for colluding arbiters
- **Cost**: +2 days contract work

**Risk**: Oracle failure for USDC price (Chainlink down)
- **Mitigation**: Use fixed USDC amounts, not derived prices
- **Cost**: Zero (not in scope)

### Economic Risks

**Risk**: Reputation recovery is too easy (fraudster rebuilds and attacks again)
- **Mitigation**: Disputes remain on-chain forever; reputation recovery is logarithmic (harder each time)
- **Cost**: Testing + tuning (already in scope)

**Risk**: Arbiters are insufficiently incentivized to vote honestly ($50/case)
- **Mitigation**: Increase arbiter compensation to $75-100/case; add reputation bonuses for arbiters
- **Cost**: +$0.5-1M annually at scale

**Risk**: Staking adoption is low (humans don't bond)
- **Mitigation**: Make staking optional initially; recommend it for Tier 4-5 access
- **Cost**: None (optional feature)

### Regulatory Risks

**Risk**: Jurisdiction regulations on escrow alternatives
- **Mitigation**: Streaming payments don't constitute escrow (funds flow directly, no middleman hold)
- **Cost**: Legal review required (outside scope, $10-20K)

**Risk**: Arbitration system might be seen as operating a court
- **Mitigation**: Frame as "binding peer review" not arbitration; arbiters are unaffiliated community members
- **Cost**: Legal positioning + documentation

---

## CONCLUSION

This cryptoeconomic trust system achieves the goals stated in the manifesto:

1. **Zero middleman custody** (no escrow risk)
2. **Incentive alignment** (fraud is economically irrational)
3. **Portable reputation** (on-chain, owned by users)
4. **Sybil resistance** (value-weighted, not count-weighted)
5. **Permanent transparency** (all disputes recorded on-chain)

### Key Insights

- **Reputation score is more valuable than job value**. A human with 85/100 reputation can earn $100K+/year forever. Destroying that for a $5K scam is irrational.
- **Progressive tiers make sybil attacks expensive**. Creating 50 bot accounts costs $14K+ in opportunity cost and guarantees losses.
- **Streaming + milestones eliminate ghosting risk**. Agent can stop payment instantly if quality drops; human only earns proportional to work done.
- **Community arbitration is fairer than centralized judgment**. 3 random high-reputation arbiters vote; decisions are transparent and immutable.

### Path Forward

Ship mechanisms in order:
1. Tiers + reputation scoring (foundational)
2. Streaming payments + atomic milestones (UX improvement + risk reduction)
3. Staking bonds (optional signal)
4. Arbitration (dispute resolution)

By month 3, escrow becomes obsolete. By month 6, users see it as legacy.

The future of freelance work is cryptoeconomic incentives, not trusted third parties.

