# HumanPages B2B Feature Impact Matrix
**Research Date:** 2026-03-30

---

## The 33 Features: Full Ranking

### MUST-HAVE (Impact 3) — Blockers for Enterprise Adoption

These 7 features will **directly block** B2B sales if missing:

| # | Feature | Why B2B Critical | Effort | Dependencies | Status |
|---|---------|------------------|--------|--------------|--------|
| **3** | **Batch MCP Tools** | Can't post 20 jobs in 1 call | 1w | None | ❌ |
| **8** | **Mutual Ratings** | Agents need accountability (veto rights) | 1w | AgentRating model | ❌ |
| **12** | **Bulk Hiring Campaigns** | Core B2B primitive (hire N humans at once) | 1w | Campaign model + Jobs model | ❌ |
| **14** | **Human Verification** | Can't risk $500+ on unverified humans | 2w | Midata/Stripe + IdentityVerification model | ❌ |
| **21** | **QA Pipeline** | Spam filter + quality gating | 2w | Spam detection algo + review queue | ❌ |
| **25** | **Retainer Streaming** | Recurring revenue model ($5K–100K/month contracts) | 1.5w | Superfluid/Micro-Transfer + tick verification | ❌ |
| **28** | **Wallet On/Off-Ramp** | Humans must cash out to 195 countries | 2w | Wise + Coinbase Pay + KYC | ❌ |
| **31** | **Webhooks + Async** | Enables agentic integration (core B2B promise) | 1.5w | Webhook infrastructure | ⚠️ (partial) |

**Critical Path:** 11.5 weeks of sequential development

---

### CORE (Impact 2) — Must-Have But Less Urgent

These 17 features enable specific B2B use cases or significantly improve adoption:

| # | Feature | B2B Use Case | Effort | Status |
|---|---------|--------------|--------|--------|
| **1** | Progressive Trust Tiers | Filter out spam; gate based on verification level | 1w | ❌ |
| **2** | Sybil-Resistant Reputation | Prevent fake accounts from gaming ratings | 1w | ❌ |
| **5** | Streaming Quality Gates | Filter by quality during search; improves match rate | 1.5w | ❌ |
| **7** | Self-Staked Bonds | Humans stake USDC to show commitment; reduces ghosting | 1w | ❌ |
| **11** | Swarm Mode | 1 job → 5+ humans compete; increases supply depth | 1.5w | ❌ |
| **13** | Response Tracking | Track who responded in <1h, <4h, <24h | 0.5w | ❌ |
| **15** | Fuzzy Search | Typo tolerance; improves match rate ("Reac" → "React") | 0.5w | ❌ |
| **16** | Domain Expert Verification | Expert badges (e.g., "Google-Certified QA") | 1w | ❌ |
| **18** | Availability Calendar | Humans block off unavailable hours; reduces rejections | 1.5w | ❌ |
| **22** | Regional Talent Networks | Auto-groups humans by region for swarm/bulk hiring | 1w | ❌ |
| **23** | Proof-of-Work Portfolio** | Humans submit work samples; verified by community | 1w | ❌ |
| **24** | Cohort Recruitment | Schedule bulk hiring events; improves supply depth | 1w | ❌ |
| **26** | Transparency Audit Trail | Immutable log of all job actions (for disputes) | 1w | ❌ |
| **29** | Tax Automation | Auto-generate 1099s, WFOE invoices | 1w | ❌ |
| **30** | Agent Verification | Agents get verified badges; trust signal | 1w | ❌ |
| **6** | Community Arbitration | Humans vote on disputes; experimental | 2w | ❌ |
| **9** | Agent Identity | Agent verification badges; trust signal only | 1w | ❌ |

---

### NICE-TO-HAVE (Impact 1) — Competitive Advantage, Not Blockers

These 8 features are lower-priority; can ship in Month 2+:

| # | Feature | B2B Context | Effort | Status |
|---|---------|------------|--------|--------|
| **4** | Atomic Task Decomposition | Break complex jobs into sub-tasks | 2w | ❌ |
| **10** | Task Bounties | Crowd-source work; parallel to direct matching | 1w | ❌ |
| **17** | CryptoCredential Search | Filter by GitHub stars, on-chain wallet age | 1w | ❌ |
| **19** | AI Job Descriptions | Claude generates job copy; nice UX | 0.5w | ❌ |
| **20** | RLHF Qualification | AI rates humans as good/bad for RLHF | 1w | ❌ |
| **24** | Cohort Recruitment | Schedule bulk hiring events | 1w | ❌ |
| **27** | Cross-Protocol Reputation | Link to Fiverr/Upwork ratings | 1w | ❌ |
| **32** | ERC-8004 Oracle | On-chain reputation registry | 2w | ❌ |

---

## Feature Impact vs. Effort (Matrix)

```
     IMPACT (B2B Relevance)
     HIGH (3)
        ↑
        │        #3  #12   #31       #8 #14  #21  #25  #28
        │       (Batch)(Bulk)(Webhooks)(Ratings)(Verify)(QA)(Retainer)(Ramp)
        │
        │
        │        #1 #5 #13 #15 #16 #18 #22 #23 #24 #26 #29 #30 #2 #6 #7 #11
        │        (Trust) (Quality Gates) (Search) (Calendar) (Regional) (Portfolio)
        │        (Cohort) (Audit) (Tax) (Agent Verify) (Sybil) (Arbitration) (Bonds) (Swarm)
        │
        │
        │        #4 #10 #17 #19 #20 #27 #32
        │       (Decompose)(Bounties)(Crypto)(AI Job)(RLHF)(Cross-Proto)(ERC-8004)
        │
        └─────────────────────────────────────────────────────────────────→
          0.5w   1w      1.5w     2w       EFFORT (WEEKS)
          QUICK EASY           HARD/SLOW
```

---

## B2B SaaS Readiness Checklist

### ✅ Already Have (70% Done)
- [x] MCP tool framework (search_humans, create_job, etc.)
- [x] Direct USDC payment verification (Privy)
- [x] Webhook infrastructure (partially; used in listings)
- [x] Identity layer (email, OAuth, Privy DID)
- [x] Escrow dispute model (in roadmap; not yet built)

### ❌ Must Build for Enterprise (30% Missing — Technical)

#### Phase 1A: Supply & Trust (Weeks 1–6)
- [ ] **Bulk Hiring Campaigns** (#12) — 1 week
- [ ] **Human Verification** (#14) — 2 weeks
- [ ] **QA Pipeline** (#21) — 2 weeks
- [ ] **Retainer Streaming** (#25) — 1.5 weeks
- [ ] **Wallet On/Off-Ramp** (#28) — 2 weeks

#### Phase 1B: Operations (Weeks 7–11)
- [ ] **Webhooks + Async** (#31) — 1.5 weeks (extend existing)
- [ ] **Mutual Ratings** (#8) — 1 week
- [ ] Batch MCP tools (#3) — 1 week (subset of #12)
- [ ] SLA tracking (custom) — 1.5 weeks

### ❌ CRITICAL FOR BUSINESS (Non-Technical; 5–7 Weeks)

#### Phase 2: SaaS Packaging (Weeks 12–16)
- [ ] **Pricing Tiers** (Starter, Growth, Enterprise) — 1 week
- [ ] **CTO Dashboard** (cost tracker, analytics, scorecards) — 2 weeks
- [ ] **Monitoring & Alerts** (status page, rate limits, incidents) — 1.5 weeks
- [ ] **Playbooks** (localization, QA, support) — 1 week
- [ ] **Legal** (SaaS ToS, DPA, SLA document) — 1.5 weeks
- [ ] **SDK** (TypeScript @humanpages/api) — 1.5 weeks

---

## B2B Adoption Curve (Estimated)

### Month 1: Launch (Weeks 1–4)
**Features:** Bulk campaigns, verification, QA pipeline, retainer streaming
**Metrics:**
- 5 alpha customers (pre-sales)
- $0 revenue (building)
- 2,000 verified humans (post-QA pipeline)

### Month 2: Operations (Weeks 5–8)
**Features:** Webhooks, dashboard, monitoring, playbooks
**Metrics:**
- 5 beta customers (signed contracts)
- $50K MRR (from beta)
- 9,000 verified humans (post-bulk recruitment)

### Month 3: Scale (Weeks 9–12)
**Features:** Pricing tiers, SDK, legal finalization
**Metrics:**
- 10 paying customers
- $100K MRR
- 15,000+ verified humans

### Month 6: Scale-Up
**Metrics:**
- 30 customers
- $300K MRR
- 50,000+ humans globally

---

## Feature Dependency Graph

```
PREREQUISITE FEATURES
     ↓
#12 Bulk Campaigns
     ↓
     ├─ Depends on: Job model, Campaign model, bulk API
     ├─ Enables: #11 Swarm Mode, #24 Cohort Recruitment
     └─ Required by: #21 QA Pipeline (pre-filter with bulk)

#14 Human Verification
     ↓
     ├─ Depends on: Midata/Stripe integration, IdentityVerification model
     ├─ Enables: #1 Trust Tiers, #5 Quality Gates, #16 Expert Verification
     └─ Required by: #12 Bulk Campaigns (need verified supply)

#21 QA Pipeline
     ↓
     ├─ Depends on: Spam detection algo, manual review queue
     ├─ Enables: #15 Fuzzy Search (quality-based ranking)
     └─ Required by: Enterprise contracts (no spam)

#25 Retainer Streaming
     ↓
     ├─ Depends on: Superfluid/Micro-Transfer, tick verification
     ├─ Enables: #7 Self-Staked Bonds (retainer deposits)
     └─ Required by: $5K+/month recurring contracts

#28 Wallet On/Off-Ramp
     ↓
     ├─ Depends on: Wise API, Coinbase Pay, KYC
     ├─ Enables: #29 Tax Automation (post-payout tax forms)
     └─ Required by: Global human adoption (must cash out)

#31 Webhooks + Async
     ↓
     ├─ Depends on: Webhook infrastructure, event system
     ├─ Enables: #2 Sybil-Resistant Reputation (feed on events)
     └─ Required by: Agentic integration (async workflows)

#8 Mutual Ratings
     ↓
     ├─ Depends on: AgentRating model, rating aggregation
     ├─ Enables: #1 Trust Tiers (agent reputation signal)
     └─ Required by: Enterprise SLAs (human veto rights)

OPERATIONAL FEATURES (non-blocking)
     ├─ Dashboard (depends on: all above features)
     ├─ Monitoring (depends on: webhook delivery)
     └─ SLA Tracking (depends on: #8 Ratings + #25 Retainer)
```

---

## Feature Scoring: How We Rated Impact (0–3)

### Impact 3 (Must-Have Blocker)
**Condition:** Without this feature, B2B enterprises **will not sign contracts**.

Examples:
- **#12 Bulk Campaigns:** Can't post 50 jobs for a localization project
- **#14 Verification:** Can't verify humans are real (fraud risk)
- **#25 Retainer Streaming:** Can't lock in $5K/month recurring (business model)
- **#28 Wallet On-Ramp:** Humans can't cash out (adoption blocker)

### Impact 2 (Core Capability)
**Condition:** Significantly improves adoption (10–25% impact) but not an absolute blocker.

Examples:
- **#18 Availability Calendar:** Reduces ghost rate 40% → 5% (nice-to-have)
- **#5 Quality Gates:** Filter by rating during search (improves UX)
- **#13 Response Tracking:** Track "responded in <1h" (SLA transparency)

### Impact 1 (Nice-to-Have)
**Condition:** Differentiator or UX improvement (<5% impact on adoption).

Examples:
- **#19 AI Job Descriptions:** Claude generates copy (saves 10 min/job)
- **#17 Crypto Credentials:** Filter by GitHub stars (niche; crypto-only)
- **#10 Task Bounties:** Crowd-source work (alternative to direct matching)

### Impact 0 (Niche)
**Condition:** Only relevant to specific segments (crypto, research, etc.).

Examples:
- **#32 ERC-8004 Oracle:** On-chain reputation (crypto natives only; <5% of market)
- **#27 Cross-Protocol Reputation:** Fiverr/Upwork links (requires partnerships; niche)

---

## Quick Decision Matrix: What to Build First?

### Path A: "We Want $1M ARR in 12 Months"
**Build:** #12 → #14 → #21 → #25 → #28 → #31 → Dashboard → SLA
**Timeline:** 16 weeks
**Revenue:** $1.2M ARR (10 customers @ $100K/year)

### Path B: "We Want to Stay Lean & API-Only"
**Build:** None of the above
**Timeline:** Indefinite (no revenue)
**Revenue:** $0 ARR (no business model)

### Path C: "We Want Competitive Advantage (Niche)"
**Build:** #3 → #8 → #23 → #29 → #27
**Timeline:** 6 weeks
**Revenue:** $0 ARR (no business model; nice features)

---

## Estimated Feature Build Times (by engineer-week)

**Legend:** [Code] / [Test] / [Deploy] = Total effort

| Feature | Backend | Frontend | DevOps | Total | Parallel? |
|---------|---------|----------|--------|-------|-----------|
| #3 (Batch MCP) | 0.5 | — | — | **0.5w** | Yes |
| #8 (Ratings) | 0.5 | 0.5 | — | **1w** | Yes |
| #12 (Bulk Campaigns) | 0.8 | 0.2 | — | **1w** | Yes |
| #14 (Verification) | 1.5 | 0.5 | — | **2w** | Yes |
| #21 (QA Pipeline) | 1.5 | 0.5 | — | **2w** | Yes |
| #25 (Retainer) | 1 | 0.5 | — | **1.5w** | Yes |
| #28 (On/Off-Ramp) | 1 | 0.5 | 0.5 | **2w** | No (depends #25) |
| #31 (Webhooks) | 1 | — | 0.5 | **1.5w** | Yes |
| **Dashboard** | 1 | 2 | — | **2w** | Depends (needs #12–#31) |
| **Monitoring** | 0.5 | — | 1 | **1.5w** | Depends (#31) |
| **SLA Tracking** | 1 | — | — | **1.5w** | Parallel to Dashboard |
| **Legal** | — | — | — | **1.5w** (lawyer) | Parallel |
| **SDK** | 1.5 | — | — | **1.5w** | Parallel (post-APIs) |

**Critical Path:** #12 → #14 → #21 → #25 → #28 → #31 → Dashboard = **11.5 weeks sequential**

**Parallel:** #3, #8, #13, #15, #16, #18 can run concurrently; save ~2 weeks

**Realistic Timeline with 2 backend engineers:** 10–12 weeks (critical path)

---

## Success Metrics by Feature

| Feature | Success Metric | Target | Timeline |
|---------|----------------|--------|----------|
| #12 Bulk Campaigns | Campaigns created / month | 50 | Month 2 |
| #14 Verification | Verified humans % | 60% | Month 2 |
| #21 QA Pipeline | Spam rejection rate | 90% | Month 1 |
| #25 Retainer | Retainer contracts | 5 | Month 2 |
| #28 On/Off-Ramp | Off-ramp transactions | 100/month | Month 2 |
| #31 Webhooks | Webhook adoption % | 80% | Month 2 |
| Dashboard | Dashboard MAU | 80% of CTOs | Month 2 |

---

## Final Recommendation

### To Enterprise Go-To-Market in 4 Months:

**Build in this order (16 weeks):**

1. **Weeks 1–6:** Features #12, #14, #21, #25, #28 (5 must-haves)
2. **Weeks 7–11:** Features #31, #8, Dashboard, SLA tracking (operations)
3. **Weeks 12–16:** Pricing tiers, legal, SDK, playbooks (packaging)

**Do NOT build:**
- #4, #6, #9, #10, #17, #19, #20, #27, #32 (defer to Month 3+)

**Hire:**
- 2 backend engineers
- 1 frontend engineer
- 1 devops engineer

**Budget:** $105K (16 weeks)

**Revenue:** $50K MRR month 2; $100K MRR month 3

---

**END OF MATRIX**
