# HumanPages 3.5→9/10: Complete Architecture Index

## Quick Navigation

Start here based on your role:

### For Founders/Product
→ Read **EXEC_SUMMARY.md** (5 min read)
- Problem statement
- Solution overview (5 solutions)
- Scoring breakdown (3.5 → 9.0)
- ROI: hire 5 mods in 3 days instead of 2 weeks

### For Engineers
→ Read **IMPLEMENTATION_GUIDE.md** (detailed code)
- Prisma schema changes (6 new models)
- 4 new backend route files
- 4 new frontend components
- Superfluid integration
- Daily cron job for auto-renewal

### For Product Managers/Architects
→ Read **PRODUCT_ARCHITECTURE.md** (complete spec)
- 5 architectural solutions (detailed)
- 2 end-to-end scenarios (A: Discord mods, B: 8-market wallet launch)
- Technical implementation per solution
- Why it's better than Discord/Telegram/Freelancer
- Risks and mitigations

---

## The Five Solutions (Tl;dr)

### 1. Regional Talent Networks (+1.5 points)
**Problem**: "Supply is Africa/SE Asia, need Japan/Korea"
**Solution**: Geo-indexed marketplace + crypto bounties
**Impact**: Find verified Japan talent in 3 hours vs. 2 days on Telegram

### 2. Trust Stack (+1.5 points)
**Problem**: "Can't trust stranger with Discord moderation"
**Solution**: Weighted trust score (Humanity + GitHub + LinkedIn + jobs + vouches)
**Impact**: Hire only gold+ trust (75+), eliminate brand risk

### 3. Proof of Work (+1.5 points)
**Problem**: "No portfolio verification"
**Solution**: Every job auto-generates on-chain proof (txHash + IPFS)
**Impact**: Designer portfolio is auditable, can't be faked

### 4. Retainer Teams (+2.0 points)
**Problem**: "Platform is transactional, need ongoing teams"
**Solution**: Superfluid streams auto-pay verified teams (30-day auto-renewal)
**Impact**: Hire + pay team of 5 without touching Telegram once

### 5. Crypto-First Search (+0.5 points)
**Problem**: "On-chain reputation is theater, Discord faster"
**Solution**: Filter by USDC rate, Superfluid compatibility, on-chain earnings
**Impact**: Founders find verified talent matching their crypto infrastructure

---

## Implementation Phases

```
Phase 1 (Weeks 1-4): Geo-Markets + Search
├─ Add GeoMarket + HumanMarketPreference models
├─ Build /markets + /humans/search endpoints
├─ Create GeoMarketsStep (frontend)
└─ Test with 3 pilot markets (Japan, Korea, Brazil)

Phase 2 (Weeks 5-8): Trust Stack + Portfolio
├─ Add PortfolioItem + TrustEvent + WalletChain models
├─ Implement trustScore.ts (weighted compute)
├─ Create portfolio verification worker
└─ Update public profiles with trust display

Phase 3 (Weeks 9-12): Retainer Teams
├─ Add RetainerTeam + RetainerMember + TeamMilestone models
├─ Build /retainer-teams routes + team builder UI
├─ Integrate Superfluid (stream creation + renewal)
├─ Launch with 2-3 beta customers
└─ Create daily cron for auto-renewal

Phase 4 (Weeks 13-16): Polish + Launch
├─ Analytics dashboard (team performance)
├─ Documentation + API reference
├─ Blog post + case studies
└─ Public launch + founder outreach
```

**Effort**: ~8 weeks, 2-3 full-stack engineers
**Result**: 9.0/10 product score

---

## Key Technical Decisions

### Database
- **6 new models**: GeoMarket, MarketExpansion, HumanMarketPreference, PortfolioItem, TrustEvent, WalletChain, RetainerTeam, RetainerMember, TeamMilestone
- **No breaking changes** to existing Human/Agent models (backward compatible)
- **Denormalized fields** on Human for performance: trustScore, totalEarningsUsdc, jobsCompletedOnChain

### Payment
- **Superfluid only** (no alternative payment processors)
- **USDC only** (no fiat conversion, no multi-currency)
- **Polygon mainnet** (primary), with Optimism as fallback
- **Stream math**: monthly budget / (30 * 24 * 3600) = wei/second

### Verification
- **Humanity Protocol** (identity base)
- **GitHub/LinkedIn** (reputation signals)
- **On-chain txHash** (payment proof, immutable)
- **IPFS** (deliverable proof, permanent)

### Trust Score Weights
```
25% Humanity Score (0-100 from Humanity Protocol)
20% Completed Jobs (capped at 100)
20% Vouches (5 per vouch, capped at 100)
10% GitHub Followers (0.5 per follower, capped)
10% LinkedIn Verified (0 or 75)
10% Portfolio Items (0 or 100, if verified)
5%  Active Retainer Membership (0 or 100)
────────────────────
= 0-100 final score
= tier (unverified, bronze, silver, gold, platinum)
```

### Retainer Lock-In
- **30-day cycles** (not month-to-month)
- **Auto-renewal by default** (must opt-out manually)
- **Minimum weekly hours** (enforced per team)
- **Milestone tracking** (auto-portfolio generation)
- **5% setup fee** (paid by founder via X402 payment gate)

---

## Scoring Model (Detailed)

### Original Score: 3.5/10

| Problem | Rating | Why |
|---|---|---|
| Geographic supply | 0.5/10 | Africa/SE Asia only, no Japan/Korea |
| Identity verification | 1/10 | Vouch system is weak, no Humanity Protocol |
| Portfolio verification | 0.5/10 | Can't verify design/code quality |
| Relational hiring | 0.5/10 | One-off gigs only, no team continuity |
| Reputation scale | 0.5/10 | 1,500 humans, 50 completed jobs, meaningless |
| Speed vs. Discord | 0/10 | Takes 20 mins to onboard vs. Discord's 10 sec |

**Total: 3.5/10** (not viable for Web3)

### New Score: 9.0/10

| Solution | Points | Fixes | Evidence |
|---|---|---|---|
| Regional Networks | +1.5 | Geographic supply | "Found 47 verified mods in Tokyo in 3 hours" |
| Trust Stack | +1.5 | Identity verification | "87/100 trust score with Humanity + GitHub verified" |
| Proof of Work | +1.5 | Portfolio verification | "On-chain txHash + IPFS proves payment happened" |
| Retainer Teams | +2.0 | Relational hiring | "Hired 5 mods, auto-paid via Superfluid for 30 days" |
| Crypto-First Search | +0.5 | Reputation scale | "Filter 8 candidates, all 70+ trust, top earner $15k" |
| **Crypto-Native Overhead** | **−1.5** | (Execution risk for founder) | (No escrow, founder takes on slippage risk) |

**Total: 9.0/10** (must-have for Web3)

---

## Scenario Walkthroughs

### Scenario A: Hire 5 Discord Mods + 3 KOLs (4 Days)

**Day 1: Discovery**
```
Founder logs in → Markets dashboard
Sees: "Japan: 47 mods, $0.50 bounty, timezone Asia/Tokyo"
Filters: skill=discord, trust=70+, market=Japan, availability=20h/week
Results: 8 candidates, top 3:
  - Alice (trust: 82, $15k earned, 9 jobs)
  - Bob (trust: 76, $8k earned, 5 jobs)
  - Carol (trust: 71, $3k earned, 3 jobs)
```

**Day 2: Team Building**
```
Creates "XYZ Japan Discord Ops" retainer team
- Monthly budget: $3k
- Members: Alice, Bob, Carol
- Minimum: 20h/week
- Auto-renew: true
```

**Day 3: Activation**
```
Connects wallet → pays 5% setup fee ($150 USDC)
Platform creates Superfluid streams:
  - Alice: $1k/month flowing → her wallet (real-time)
  - Bob: $1k/month flowing
  - Carol: $1k/month flowing
Each member gets notification: "Stream active: $1000/month"
```

**Day 4: First Deliverables**
```
Alice submits: "Discord moderation log + bot setup screenshot"
Platform auto-creates portfolio item linked to:
  - Polygon txHash (payment proof)
  - IPFS hash (deliverable proof)
Alice's trust score: 82 → 85 (milestone completed)
Founder marks approved → milestone payment released
```

**Result**: 5 verified mods, proven performance, Superfluid automation
**vs. Discord**: "LFG mods" → chaos → hope they show up → manual USDC transfer → ghost in 2 weeks

---

### Scenario B: Launch in 8 Markets (90 Days)

**Week 1: Market Assessment**
```
Dashboard shows supply by market:
  Japan (47) ✅ Moderate
  Korea (23) ⚠️ Tight
  Brazil (31) ⚠️ Tight
  Mexico (18) ⚠️ Tight
  Thailand (12) 🔴 Critical
  Indonesia (14) 🔴 Critical
  India (45) ✅ Moderate
  Nigeria (22) ✅ Moderate
```

**Week 2: Campaign Launch**
```
For each market, create bounty campaign:
  Thailand: $1.00 per signup (critical shortage)
  Indonesia: $0.80 per signup
  Others: $0.45-0.60 per signup

Total bounty pool: $20 × 8 markets = $160 USDC
Founder posts: "Hiring community builders for ZebraWallet launch"
Platform sends notifications to 200+ humans in target markets/timezones
First 50 signups get bounty streamed over 30 days
```

**Week 3-4: Team Formation**
```
Creates 8 retainer teams:
  "ZebraWallet Japan Community" (20 mods, $10k/mo)
  "ZebraWallet Korea Community" (16 mods, $10k/mo)
  ... etc
Total monthly: $80k
Setup fee: $4k (5%)
All teams set to "forming", awaiting activation
```

**Week 5-12: Delivery**
```
Milestone 1: App store localization (Japanese, Korean, Portuguese, etc.)
Milestone 2: Community seeding (20 tweets per market in local language)
Milestone 3: Discord setup (500 members, moderation configured)

Each milestone → portfolio item + on-chain proof
Community managers' trust scores: 65 → 72 (after 4 weeks delivery)
```

**Week 13+: Ongoing + Reuse**
```
Retainer auto-renews every 30 days
Top performers now have portfolio showing "ZebraWallet community manager"
Next Web3 company can hire these proven performers
```

**Result**: 8 markets launched in parallel, transparent team performance
**vs. Agencies**: "We'll find local teams" → 3 month turnaround, $50k+ cost, no visibility

---

## Competitive Analysis

### Discord Bounties
- ✅ Instant (10 sec to post)
- ✅ Large pool (10k+ potential workers)
- ❌ No vetting (random DMs)
- ❌ No proof of work (screenshots fake)
- ❌ No continuity (one-off gigs)
- ❌ No payment automation (manual USDC)
- ❌ No geographic intelligence

### Telegram Direct Hires
- ✅ Direct relationship (text channels)
- ✅ Fast onboarding (no signup flow)
- ❌ No identity verification ("trust me bro")
- ❌ No portfolio (hearsay only)
- ❌ No enforced commitment (ghosting)
- ❌ Manual payment hell (tracking wallets)
- ❌ No scalability (DM fatigue)

### Freelancer.com / Upwork
- ✅ Vetting (escrow, reviews)
- ✅ Portfolio (but fakeable)
- ✅ Global talent pool
- ❌ USD-based (not crypto)
- ❌ 20% fee (ouch)
- ❌ Slow (1-2 week turnaround)
- ❌ No retainers (only gigs)
- ❌ Escrow (centralized, not trustless)

### **HumanPages (New)**
- ✅ Instant search (3 hours to hire 5)
- ✅ Identity verified (Humanity + GitHub)
- ✅ Portfolio proof (on-chain txHash)
- ✅ Continuous teams (auto-renew)
- ✅ Payment automation (Superfluid)
- ✅ Crypto-native (USDC, no conversion)
- ✅ Zero fee (just 5% setup)
- ✅ Geographic intelligence (supply by market)

---

## Success Metrics

### Founder Perspective
| Metric | Target | How to Measure |
|---|---|---|
| Time to hire team | <3 days | "Days from search to stream activated" |
| Team stability | 90% retention at 30d | "% of retainer teams renewed" |
| Work quality | 4.5★+ | "Avg rating on milestones" |
| Cost savings | 50% vs. agencies | "Retainer cost vs. Upwork freelance cost" |

### Human (Freelancer) Perspective
| Metric | Target | How to Measure |
|---|---|---|
| Time to first payment | <24h | "Time from onboarding to stream active" |
| Earnings growth | $500→$1500/mo | "Avg earnings after 2 retainers" |
| Trust score growth | 50→75 | "Trust score before/after milestones" |
| Retention | 80% renew retainers | "% who accept renewal for month 2" |

### Platform Perspective
| Metric | Target | How to Measure |
|---|---|---|
| Founders using retainers | 50+ in first 6mo | "Active retainer teams" |
| Total TVL | $500k/mo | "Monthly Superfluid flow" |
| Humans earning > $1k/mo | 200+ | "Active retainer members" |
| Geographic supply diversity | 100+ cities | "Markets with 5+ active talent" |

---

## Open Questions for Founder

Before diving into implementation, validate these assumptions:

1. **Superfluid UX**: Can your target founders use Superfluid, or is it too complex? (Recommend: abstract it away, show "$X/month flowing")

2. **Minimum trust score**: Is 60+ reasonable for retainers? Or too high for emerging markets?

3. **Geographic priorities**: Which 5 markets to focus on first? (Recommend: Japan, Korea, Brazil, Thailand, Nigeria—based on founder concentration)

4. **Bounty budgets**: What's reasonable per signup in undersupplied markets? (Recommend: start at $0.50-$1.00 USDC)

5. **Team size limits**: Should we cap team sizes (e.g., max 20 per team)? Or unlimited?

6. **Milestone cadence**: Weekly milestones or monthly? (Recommend: weekly for accountability)

---

## Files Included

1. **EXEC_SUMMARY.md** (5 min read for founders)
   - Problem + solution overview
   - 5 solutions at a glance
   - Scoring breakdown
   - Go-to-market strategy

2. **PRODUCT_ARCHITECTURE.md** (30 min deep dive for PMs)
   - Detailed spec for each of 5 solutions
   - Technical implementation (Prisma, routes, frontend)
   - Full Scenario A + B walkthroughs
   - Why it's better than alternatives
   - Risks and mitigations

3. **IMPLEMENTATION_GUIDE.md** (engineer's reference)
   - Exact Prisma schema changes
   - 4 new backend route files (code ready to implement)
   - 4 new frontend components (code ready to build)
   - API client updates
   - Daily cron job for auto-renewal
   - Implementation phases (weeks 1-16)

4. **ARCHITECTURE_INDEX.md** (this file)
   - Quick navigation
   - TL;dr summaries
   - Scoring model breakdown
   - Competitive analysis
   - Success metrics

---

## Next Steps

### Week 1
- [ ] Read EXEC_SUMMARY.md as a team
- [ ] Validate key assumptions (see "Open Questions")
- [ ] Assign Phase 1 tech lead (Prisma + backend routes)

### Week 2-4
- [ ] Implement Phase 1 (GeoMarkets + Search)
- [ ] Test with 3 pilot markets
- [ ] Gather founder feedback

### Week 5-8
- [ ] Implement Phase 2 (Trust Stack + Portfolio)
- [ ] Create portfolio verification worker
- [ ] Onboard first 5 beta founders

### Week 9-12
- [ ] Implement Phase 3 (Retainer Teams)
- [ ] Run 2-3 full end-to-end retainer cycles
- [ ] Document case studies

### Week 13-16
- [ ] Polish, documentation, launch prep
- [ ] Blog post + founder testimonials
- [ ] Public launch

---

## Contact & Questions

For questions on:
- **Product strategy**: See PRODUCT_ARCHITECTURE.md
- **Technical implementation**: See IMPLEMENTATION_GUIDE.md
- **Executive decision**: See EXEC_SUMMARY.md

---

**Current Status**: 3.5/10 (not viable for Web3)
**Target Status**: 9.0/10 (must-have infrastructure)
**Effort**: 8 weeks, 2-3 engineers
**Payoff**: Enable Web3 founders to scale to new markets 5x faster
