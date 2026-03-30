# HumanPages: Tactical Next Steps (If Team Wants Series A)

## Current Status
- **Score:** 2.5/10 (not investable)
- **Runway:** ~9-12 months (at typical burn)
- **Main gap:** No revenue model; no defensibility

---

## IF TEAM ACCEPTS THE EVALUATION

### Week 1-2: Pivot Decision (Decision Time)

**Choose a path:**

#### Path A: Consumer-Focused (Current)
- Keep building all 33 features
- Target individual freelancers globally
- Result: $5-10M business (if you win)
- Risk: Upwork commoditizes in 6 months
- Timeline to Series A: 15+ months
- **Recommendation from this evaluation: SKIP THIS**

#### Path B: B2B Crypto-Focused (Recommended)
- Pivot to crypto teams as anchor customers
- Build only top 5 features + crypto integrations
- Result: $100M-500M business (if you win)
- Risk: Crypto market downturn
- Timeline to Series A: 6 months
- **Recommendation from this evaluation: DO THIS**

**Decision framework:**
- If you have partnerships with 3+ crypto teams already → Path B (immediate)
- If you're organic growth only → Path A (but understand you won't get this investor's capital)

---

### Week 3-4: Revenue Model Definition (Critical)

**Ship a revenue model in the first 30 days of seed. Not month 6. Month 1.**

**Recommended model:**

| Fee Type | When | Amount | Monthly Revenue (at scale) |
|----------|------|--------|---------------------------|
| **Escrow fee** | Job completed via escrow | 0.5% | $2.5K (on $500K GMV) |
| **Verification fee** | Human verifies ID | $5 one-time | $5K (on 1K humans) |
| **Platform fee** | Job completed | 2% | $10K (on $500K GMV) |
| **Off-ramp fee** | USDC → Fiat | 1.5% | $7.5K (on $500K/mo outflows) |
| **Premium API tier** | Agent + $50K job volume | $500/mo | $10K (20 agents) |

**Target Month 1:** $0 (earn trust)
**Target Month 3:** $10K-20K/mo (fees + verification)
**Target Month 6:** $50K-100K/mo (all levers)

**Implementation:**
1. Month 1: Launch escrow (no fee, earn trust)
2. Month 2: Launch verification ($5 fee)
3. Month 3: Launch 2% platform fee + off-ramp (1.5% fee)
4. Month 4: Launch premium API tier ($500/mo for bulk agents)

---

### Week 5-8: Focus Sprint (Engineering)

**Only build top 5 features. Pause everything else.**

```
Sprint 1 (Weeks 1-2): Escrow + Dispute Resolution
├─ Smart contract for 2-of-3 escrow (or simple contract)
├─ Dispute arbitration: 50/50 split pending human review
├─ Webhook on escrow release
├─ Test with 10 agents, 20 humans
└─ Target: 5 escrowed jobs in 2 weeks

Sprint 2 (Weeks 3-4): Pre-Hire Verification
├─ Integrate Midata for ID verification
├─ Add background check option (Checkr API)
├─ Mark humans as "Verified" or "Unverified"
├─ Show verification badge on public profile
└─ Target: 50 humans verified by end of week 4

Sprint 3 (Weeks 5-6): Wallet On/Off-Ramp
├─ Integrate Coinbase Pay (USDC on-ramp)
├─ Integrate Wise API (off-ramp to 195+ countries)
├─ Auto-conversion from USDC to local currency
├─ Webhook on withdrawal
└─ Target: $10K in test withdrawals by end of week 6

Sprint 4 (Weeks 7-8): Webhooks + API
├─ Full REST API for job creation + updates
├─ HMAC-signed webhooks (job updated, offer accepted, completed)
├─ Rate limiting (100 req/min per agent)
├─ Documentation (OpenAPI 3.0 spec)
└─ Target: 3 agents integrated by end of week 8

Sprint 5 (Weeks 9-10): Quality Scoring
├─ Compute: completion %, dispute rate, response time
├─ Search ranking: quality score weights 50% of ranking
├─ Expose score in API + public profile
├─ A/B test: see if agents prefer quality > price
└─ Target: 80% of agents adopt quality filter by end of week 10

Total: 10 weeks. Deliver 5 features. Ready for Series A conversations.
```

**Team allocation:**
- 2 backend engineers: Escrow (1) + Verification (1)
- 1 full-stack: Off-ramp (Coinbase + Wise integration)
- 1 backend: Webhooks + API
- 1 backend: Quality scoring
- 1 PM: Roadmap + sprints
- 1 designer: UI for verification + escrow flows

**Exit criteria for each sprint:**
- Escrow: 5 jobs completed; 0 disputes in 2 weeks; $1K+ in escrow TVL
- Verification: 50 humans verified; badge visible on 100% of verified profiles
- Off-ramp: 10 test withdrawals successful; < 5 min from request to approval
- Webhooks: 3 agents integrated; 50 events delivered; 0 failures
- Quality: Search results rank verified humans first; 80% adoption in filters

---

### Week 9-10: GTM Sprint (Go-to-Market)

**Stop building. Start selling.**

**Target: 5-10 partnership letters from crypto teams by week 12.**

#### Partnerships List (Starting 20)

**Tier 1: Paradigm Portfolio** (10 portfolio companies)
- Flashbots, dYdX, Idle, Alchemix, etc.
- Contact: Partner managers at Paradigm
- Pitch: "Pay your ops team 50% cheaper + faster than Upwork"
- Goal: Get 2-3 to commit to 10+ hires via HumanPages

**Tier 2: A16z Crypto Portfolio** (30+ portfolio companies)
- Contact: Deal managers
- Same pitch; broader list

**Tier 3: Web3 Accelerators** (Y Combinator, Polkastarter, etc.)
- Contact: Programs team
- Pitch: "Offer HumanPages to all your founders for hiring"
- Goal: Get 5-10 founders to use platform

**Tier 4: DAO Treasuries** (Curve, Aave, Uniswap, etc.)
- Contact: Operations teams
- Pitch: "Hire ops contractors from any country, pay in USDC"
- Goal: Show crypto-native payroll use case

**Outreach template:**
```
Subject: Hire your ops team 70% faster (HumanPages + crypto)

Hi [Name],

You're hiring 10+ contractors this year. Currently you're using Upwork (5-20% fees, 2-3 week onboarding) or Telegram (trust issues, no escrow).

We just shipped something that might help:
- Verified contractors in 50+ countries
- Pay in USDC directly (no banks, no middleman)
- Escrow + dispute resolution (so you're not at risk)
- Hire in 3 days instead of 3 weeks

I'm not trying to sell you SaaS. I'm trying to make your hiring pain go away.

Can I spend 15 min showing you how? We've already verified [X] contractors and have 3 teams running pilots.

Best,
[Name]
```

**Success metrics:**
- Week 9: Identify 20 target contacts
- Week 10: Send 20 outreach emails
- Week 11: Book 10 discovery calls
- Week 12: Convert 3-5 to partnerships / pilots

---

### Month 2-3: Metrics That Matter

**Track weekly. Report monthly. Adjust if numbers are off.**

#### Operational Metrics

| Metric | Week 4 | Week 8 | Week 12 | Target |
|--------|--------|---------|---------|--------|
| Active agents (production) | 50 | 70 | 100 | 100+ |
| Verified humans | 0 | 100 | 300 | 500+ |
| Weekly job volume | 50 | 100 | 200 | 200+ |
| Completion rate | 60% | 75% | 80% | 80%+ |
| Escrow adoption | 0% | 30% | 60% | 60%+ |
| Off-ramp volume | $0 | $10K | $50K | $50K+ |
| Webhook subscriptions | 0 | 5 | 20 | 20+ |

#### Revenue Metrics

| Metric | Month 2 | Month 3 | Month 6 | Target |
|--------|---------|----------|---------|--------|
| Monthly revenue | $0 | $5K-10K | $50K-100K | $50K+ |
| Escrow TVL | $0 | $20K | $100K | $100K+ |
| Verification fees | $0 | $2.5K | $5K | $5K+ |
| Platform fee volume | $0 | $2.5K | $25K | $25K+ |
| Off-ramp fees | $0 | $2K | $10K | $10K+ |
| API tier revenue | $0 | $0 | $5K | $5K+ |

#### Risk Metrics (Watch These)

| Metric | Red Flag | Action If Red |
|--------|----------|--------------|
| Escrow adoption < 30% by week 8 | Trust issue; user fear | Simplify flow; add education |
| Completion rate < 70% | Quality mismatch | Improve matching algo; add verification |
| Off-ramp volume < $10K/mo by month 3 | Fiat friction persists | Simplify conversion; add more rails |
| Webhook adoption < 5 agents by week 8 | Integration friction | Improve docs; add SDK |
| Partnership converts < 1 by month 3 | GTM isn't working | Reassess target list; change pitch |

---

### Month 4-6: Scale If Metrics Hit

**If by month 6 you have:**
- $50K-100K/mo revenue
- 500+ verified humans
- 100+ active agents
- 80%+ completion rate
- 3-5 enterprise partnerships

**Then Series A conversation becomes credible.**

**Ask for: $2M-5M at $15M-25M valuation**

**Use capital for:**
- 3-4 more engineers (scale webhooks, API, quality)
- 1 BD person (expand partnerships from 5 to 30+)
- 1 ops person (scale onboarding, support)
- Marketing budget ($200K/quarter for partner programs)

---

## IF TEAM DECLINES THE EVALUATION

### If They Insist on Building All 33 Features

**My prediction:**
- Month 12: Ship escrow, verification, ratings
- Month 15: Ship webhooks, wallets, quality
- Month 18: Ship 10+ other features
- Month 20: Have 3K humans, 100 agents, $20K/mo revenue
- Month 21: Run out of capital

**Result:** Acquihire at best. More likely: shutdown.

**Why:** Upwork will have shipped escrow + USDC by month 9. By month 15, HumanPages has no competitive advantage. By month 18, you're just another freelance platform.

**Timeline problem:** If you take 18 months to build, competitors take 6 months to copy. You don't win.

---

## Critical Success Factors (CSFs)

**To hit Series A in 6 months, these MUST happen:**

### CSF 1: Revenue by Month 1
- Escrow shipped week 2
- Verification fee launched month 2
- Platform fee launched month 3
- No "we'll monetize later" policy

### CSF 2: Defensibility by Month 3
- Escrow creates legal lock-in
- Verification creates compliance moat
- Off-ramp creates switching cost
- Quality scoring creates data advantage

### CSF 3: GTM by Month 2
- 5+ partnership letters by month 3
- 20+ agents using webhooks by month 4
- 50+ verified humans by month 3
- 80%+ completion rate by month 4

### CSF 4: Execution Speed
- Ship escrow in 2 weeks (not 4)
- Ship verification in 2 weeks (not 6)
- Ship off-ramp in 2 weeks (not 4)
- Ship webhooks in 2 weeks (not 6)

**If ANY of these slip, Series A is at risk.**

---

## Decision Checkpoints (Go/No-Go)

### Checkpoint 1: End of Week 2 (Day 14)
**Go/No-Go: Escrow MVP Works**
- 5 jobs completed via escrow
- 0 failures in fund/release flow
- Team reports no blocking issues

**If No-Go:** Pivot escrow design or pause other features

### Checkpoint 2: End of Month 1 (Day 30)
**Go/No-Go: Verification Adopted by 50+ Humans**
- 50 humans verified their IDs
- Verification fee charged successfully
- Badge visible on profiles

**If No-Go:** Reassess Midata integration; consider Checkr alternative

### Checkpoint 3: End of Month 2 (Day 60)
**Go/No-Go: Off-Ramp Processed $10K**
- $10K+ withdrawn via Wise/Coinbase
- < 5 min from request to approval
- 0 failed withdrawals

**If No-Go:** Add more off-ramp rails (PayPal, Payoneer, etc.)

### Checkpoint 4: End of Month 3 (Day 90)
**Go/No-Go: Revenue $10K-20K & Partnerships 2+**
- $10K-20K MRR (verification + platform fees)
- 2+ signed partnership letters
- 100+ agents on platform

**If No-Go:** Stop and revisit positioning

### Checkpoint 5: End of Month 6 (Day 180)
**Final Decision: Investable?**
- Revenue $50K-100K/mo ✓
- 500+ verified humans ✓
- 100+ active agents ✓
- 80%+ completion rate ✓
- 3-5 partnerships ✓

**If Yes:** Series A campaign opens immediately
**If No:** Either (a) extend and try again, or (b) pivot to acquired/merger

---

## How This Investor Would Re-Engage

**If team hits the checkpoints, re-engagement happens:**

- **Week 13 (after month 3):** "You nailed verification. I'm interested. Tell me about partnerships."
- **Week 20 (after month 5):** "You're at $30K/mo revenue. Serious conversation. Intro to my partner."
- **Week 26 (after month 6):** "You're at $50K+/mo revenue + 3 partnerships. Let's term sheet."

**Term sheet talk (if investor participates):**
- Investment: $2M-5M
- Valuation: $15M-25M (2-3x revenue multiple)
- Board seat + operational support
- 18-month milestone-based releases (tied to hitting metrics)

---

## Final Tactical Checklist

### This Week (Week 1)
- [ ] Team decision: Path A (consumer) or Path B (B2B crypto)?
- [ ] If Path B: Identify 3 crypto team contacts already known to founders
- [ ] Revenue model: Decide on fees (recommend escrow 0.5%, verification $5, platform 2%, off-ramp 1.5%)
- [ ] Engineering: Plan Week 1-2 sprint for escrow MVP

### Next 2 Weeks (Week 2-3)
- [ ] Escrow MVP shipped and tested with 5 jobs
- [ ] Verification: Midata integration started
- [ ] Off-ramp: Coinbase Pay + Wise APIs integrated (test mode)
- [ ] GTM: Identify 20 target partnership contacts

### Month 1 (Week 4)
- [ ] Verification launched + 50 humans verified
- [ ] Escrow TVL > $5K
- [ ] Off-ramp: 5+ successful withdrawals
- [ ] GTM: Send first 10 partnership emails

### Month 2 (Week 8)
- [ ] Webhooks API live + 3 agents integrated
- [ ] Quality scoring algorithm deployed
- [ ] Revenue: $5K-10K MRR
- [ ] GTM: Book 5+ discovery calls

### Month 3 (Week 12)
- [ ] All top 5 features live
- [ ] Revenue: $10K-20K MRR
- [ ] Partnerships: 2-3 signed letters
- [ ] Series A conversations start

---

**If team executes this, they're fundable in 6 months.**

**If team ignores this, they're out of capital in 12 months with no defensibility.**

**Choose wisely.**
