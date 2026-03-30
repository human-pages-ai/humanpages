# HumanPages Roadmap: 5→9+/10 — Reading Guide

This directory contains the complete product architecture for scaling HumanPages from **5/10** to **9+/10** in the eyes of a CTO at an AI agent startup.

---

## Document Overview

### 1. **EXECUTIVE_SUMMARY_ROADMAP.md** (6 KB) — START HERE
**For:** CTOs, founders, product managers
**Read Time:** 10 minutes
**Contains:**
- The 3-phase roadmap (4 weeks → 3 weeks → 2 weeks)
- Score progression (5/10 → 8/10 → 9/10 → 9.5/10)
- Why each feature moves the needle
- Key metrics to track
- Go-to-market messaging

**Action:** Read this first to understand the big picture.

---

### 2. **ROADMAP_AI_AGENT_CTO_9_PLUS_10.md** (50 KB) — DETAILED SPEC
**For:** Product managers, tech leads, architects
**Read Time:** 45 minutes
**Contains:**
- Complete feature specifications for all 12 features
- Data model changes (Prisma schema additions)
- API endpoint specifications
- MCP tool additions
- Effort estimates & dependencies
- Success metrics
- Risk mitigations

**Sections:**
- Phase 1: Escrow + Verification (Weeks 1-4)
  - Feature 1: Escrow + Dispute Resolution (2 wks)
  - Feature 2: Pre-Hire Verification (2 wks)
  - Feature 3: Agent Reputation + Reverse Ratings (1.5 wks)
  - Feature 4: Human Job Browsing (2.5 wks)
- Phase 2: Webhooks + Quality (Weeks 5-7)
  - Feature 5: Webhooks + Async API (1.5 wks)
  - Feature 6: Quality Scoring Algorithm (1 wk)
  - Feature 7: Wallet On-ramp + Off-ramp (2 wks)
  - Feature 8: Bulk Job Posting (0.5 wks)
  - Feature 9: Supply Analysis Dashboard (0.5 wks)
- Phase 3: Excellence (Weeks 9-12)
  - Feature 10: Availability Calendar (1.5 wks)
  - Feature 11: AI-Generated Job Descriptions (1 wk)
  - Feature 12: Agent Verification (1 wk)

**Action:** Read this to understand what to build and why.

---

### 3. **TECHNICAL_IMPLEMENTATION_CHECKLIST.md** (25 KB) — ENGINEERING GUIDE
**For:** Engineers, tech leads
**Read Time:** 1-2 hours (reference document)
**Contains:**
- Detailed checklist for each feature
- Database schema changes
- Backend routes to implement
- External API integrations needed
- Notification requirements
- MCP tool definitions
- Testing strategy
- Deployment notes

**How to Use:**
- Copy the checklist for each 2-week sprint
- Check off items as you complete them
- Use as the "source of truth" for implementation

**Action:** Reference this while building each feature.

---

### 4. **DETAILED_API_SPECS.md** (32 KB) — API REFERENCE
**For:** Backend engineers, API consumers
**Read Time:** 2-3 hours (reference document)
**Contains:**
- Complete OpenAPI-style specs for all new endpoints
- Request/response JSON examples
- Error codes and messages
- Webhook payload specifications
- HMAC signature validation
- Query parameter definitions
- Status codes (201, 200, 400, 404, 409, 503, etc.)

**Organized By Feature:**
1. Escrow + Dispute Resolution (5 endpoints)
2. Pre-Hire Verification (3 endpoints)
3. Agent Reputation (3 endpoints)
4. Human Job Browsing (4 endpoints)
5. Webhooks (4 endpoints)
6. Quality Scoring (3 endpoints)
7. Wallet On/Off-Ramp (3 endpoints)
8. Bulk Job Posting (extension of existing)
9. Supply Analysis (1 endpoint)
10. Availability Calendar (3 endpoints)
11. AI-Generated Descriptions (2 endpoints)
12. Agent Verification (1 endpoint)

**Total New Endpoints:** ~35 REST endpoints + 19 new MCP tools

**Action:** Use this while implementing backend routes. Copy-paste examples into your code.

---

## Quick Reference Tables

### Effort & Score Impact

| Feature | Effort | Score Δ | Must-Have? |
|---------|--------|---------|-----------|
| 1. Escrow | 2 wks | +2.5 | YES (trust blocker) |
| 2. Verification | 2 wks | +1.5 | YES (risk assessment) |
| 3. Agent Ratings | 1.5 wks | +1 | NO (nice to have) |
| 4. Listings | 2.5 wks | +1.5 | YES (discovery) |
| 5. Webhooks | 1.5 wks | +1 | YES (integration) |
| 6. Quality Scoring | 1 wk | +0.5 | NO (improves ranking) |
| 7. Wallets | 2 wks | +1 | YES (removes friction) |
| 8. Bulk Posting | 0.5 wks | +0.5 | NO (perception) |
| 9. Supply Dashboard | 0.5 wks | +0.25 | NO (strategic) |
| 10. Calendar | 1.5 wks | +1 | NO (scheduling) |
| 11. AI Descriptions | 1 wk | +0.5 | NO (clarity) |
| 12. Agent Verify | 1 wk | +1 | NO (scaling) |
| **TOTAL** | **~17 wks** | **+12** | — |

### Timeline

```
Week 1-2:   Escrow + Verification         → 7.0/10
Week 3-4:   Ratings + Listings            → 8.0/10  ← MVP for Scale
Week 5-6:   Webhooks + Quality            → 8.5/10
Week 7:     Wallets + Bulk                → 9.0/10  ← Category-Defining
Week 8:     Supply Dashboard              → 9.1/10
Week 9-10:  Calendar + AI + Verify        → 9.5/10  ← Excellence
```

### External Integrations Needed

| Integration | Feature | Purpose | Effort |
|-------------|---------|---------|--------|
| Privy Wallet API | Escrow, Wallets | Release funds; transfer USDC | Already integrated |
| Midata / Stripe | Verification | Identity verification + KYC | 2 days setup |
| Coinbase Pay | Wallets | USDC on-ramp | 3 days setup |
| Wise API | Wallets | Off-ramp to 195+ countries | 2 days setup |
| Claude / OpenAI | AI Descriptions | Generate job descriptions | 1 day setup |
| Coinbase AgentKit | Agent Verify | Verify agent credentials | 1 day setup |
| Redis / PgBoss | Webhooks | Queue system for delivery | Already have? |

---

## How to Read This Package

### Scenario 1: "I'm a CTO evaluating this roadmap"
1. Read **EXECUTIVE_SUMMARY_ROADMAP.md** (10 min)
2. Skim **ROADMAP_AI_AGENT_CTO_9_PLUS_10.md** sections on "Why It Moves the Needle" (15 min)
3. Review **Quick Reference Tables** above (5 min)
4. **Total: 30 minutes**

### Scenario 2: "I'm a PM planning sprints"
1. Read **EXECUTIVE_SUMMARY_ROADMAP.md** (10 min)
2. Read full **ROADMAP_AI_AGENT_CTO_9_PLUS_10.md** (45 min)
3. Use **TECHNICAL_IMPLEMENTATION_CHECKLIST.md** for sprint planning (30 min)
4. **Total: 1.5 hours**

### Scenario 3: "I'm an engineer building Feature X"
1. Find Feature X in **ROADMAP_AI_AGENT_CTO_9_PLUS_10.md** (5 min to locate)
2. Read the "Technical Spec" section (10 min)
3. Open **TECHNICAL_IMPLEMENTATION_CHECKLIST.md** to that feature (20 min)
4. Reference **DETAILED_API_SPECS.md** for exact endpoint specs while coding (30+ min)
5. **Total: 1-2 hours per feature**

### Scenario 4: "I'm building an MCP tool to consume these endpoints"
1. Read **EXECUTIVE_SUMMARY_ROADMAP.md** (10 min)
2. Find feature in **DETAILED_API_SPECS.md** (5 min)
3. Copy-paste JSON examples into your MCP tool schema (15 min per endpoint)
4. Test against running backend (30+ min)
5. **Total: 1-2 hours per tool**

---

## Key Concepts

### Why This Roadmap Works

**For Agents (Demand):**
- **Week 1-4:** "Escrow protects me. Verified humans are trustworthy."
- **Week 5-7:** "I can integrate this into my workflows via webhooks."
- **Week 8-12:** "I can find the best humans by quality, not just price."

**For Humans (Supply):**
- **Week 1-4:** "I'm trusted. I trust agents. I can assess risk."
- **Week 5-7:** "I can cash out to my bank in any country."
- **Week 8-12:** "I have agency. I can browse jobs, schedule work, be clear on expectations."

**For Market:**
- **Week 1-4:** Acceptance rate jumps from 30% to 50%+ (escrow + listings)
- **Week 5-7:** 60%+ of agents adopt webhooks (integration)
- **Week 8-12:** Supply depth increases 5-10x (wallets + calendar)

### The 3 Blockers Removed

1. **Trust Blocker:** Agents won't risk $500+ on unverified humans
   - Solved by: Escrow (2 wks) + Pre-Hire Verification (2 wks)
   - Impact: Enables $500+ jobs; 50%+ accept rate

2. **Friction Blocker:** Humans distrust crypto; agents can't integrate
   - Solved by: Wallet on-ramp/off-ramp (2 wks) + Webhooks (1.5 wks)
   - Impact: Removes crypto barrier; enables automation

3. **Supply Blocker:** 1,500 humans; 90% searches return 0-2 matches
   - Solved by: Job Listings (2.5 wks) + Availability Calendar (1.5 wks)
   - Impact: Humans discover work; scheduling reduces rejections

---

## Implementation Tips

### Start with Phase 1A (Weeks 1-2): Escrow + Verification
- **Why first:** Escrow is the #1 trust blocker. Verification shows humans are real.
- **Risk:** Privy wallet API is already integrated, so low technical risk.
- **Dependency:** Midata API signup (1-2 days)
- **Success metric:** 50%+ of new jobs use escrow

### Then Phase 1B (Weeks 3-4): Ratings + Listings
- **Why next:** Listings unlock human discovery (decouples supply from direct offers).
- **Risk:** Mostly database and API; no external dependencies.
- **Dependency:** None
- **Success metric:** 50%+ of humans view listings; 30%+ apply

### Then Phase 2A (Weeks 5-6): Webhooks + Quality
- **Why next:** Webhooks enable agentic integration; quality scoring improves search.
- **Risk:** Queue system might need tuning (Privy payment verification).
- **Dependency:** Redis or PgBoss (likely already have)
- **Success metric:** 60%+ of agents subscribe to webhooks

### Then Phase 2B (Week 7): Wallets + Bulk
- **Why next:** On-ramp/off-ramp removes crypto friction. Bulk posting improves perception.
- **Risk:** Coinbase Pay and Wise API integration (but both well-documented).
- **Dependency:** Coinbase Pay, Wise API signup (1-2 days each)
- **Success metric:** 50%+ of humans fund wallet; 20%+ of agents post bulk listings

### Finally Phase 3 (Weeks 9-12): Calendar + AI + Verify
- **Why last:** Polish features. Nice-to-haves. Lower impact on core metrics.
- **Risk:** Claude API integration (well-documented).
- **Dependency:** Claude API key (free tier available)
- **Success metric:** 25%+ of humans post calendar; 40%+ of agents use AI descriptions

---

## Testing Strategy

### Unit Tests
- Scoring formula (Phase 2 Feature 6)
- HMAC signature generation (Phase 2 Feature 5)
- Escrow state transitions (Phase 1 Feature 1)
- On-ramp/off-ramp calculations (Phase 2 Feature 7)

### Integration Tests
- Full escrow lifecycle: fund → submit → approve/dispute → release
- Full listing lifecycle: create → apply → accept → create job
- Full webhook lifecycle: event → delivery → retry → success
- Full verification lifecycle: request → Midata callback → update profile

### E2E Tests
- Agent posts job → human applies → agent accepts → job created → human submits work → agent approves → funds released → human rates agent
- Agent posts listing → human applies → agent accepts → escrow funded → human submits work → agent approves escrow → funds released
- Human funds wallet via Coinbase Pay → human withdraws via Wise → funds arrive in bank

### Load Tests
- Webhook delivery under 100 agents × 10 jobs/day = 1000 events/day
- Search query performance with quality scoring + verification filters
- Availability calendar query (find humans in time slot)

---

## Monitoring & Alerts

### Success Metrics to Track (Dashboard)
- **Escrow:** % of jobs $100+ using escrow; dispute rate; time-to-resolution
- **Verification:** % of humans with portfolio; % with ID verified; % with background check
- **Listings:** % of humans who browse; % of searches on listings; acceptance rate
- **Webhooks:** % of agents subscribed; delivery success rate; avg latency
- **Quality Score:** adoption in search; correlation with job success
- **Wallets:** on-ramp transaction volume; off-ramp transactions; churn (users who fund but leave)
- **Overall:** acceptance rate; completion rate; dispute rate; avg job value; supply depth (humans per skill)

### Alerts to Set Up
- Webhook delivery failure rate > 5% → page on-call
- Search latency > 500ms → investigate indexing
- Escrow fund release failure > 1% → check Privy API
- Identity verification callback missing → check Midata webhook
- New human signup dropped > 20% MoM → investigate friction

---

## Frequently Asked Questions

**Q: Can I build features out of order?**
A: Not recommended. Phase 1A (Escrow + Verification) is the critical path. Features 3 & 4 can be reordered, but features 5-12 depend on earlier phases.

**Q: How many engineers do I need?**
A: 4-5 backend engineers + 1 PM + 1 designer for 12 weeks. Can parallelize: 2 engineers on Phase 1A, 2 on Phase 1B, etc.

**Q: Can I launch at 8/10 instead of 9/10?**
A: Yes! Phase 1B (4 weeks) gets you to 8/10, which is "MVP for scale." Phase 2B brings you to 9/10.

**Q: What if we run out of time?**
A: Prioritize Phase 1 (Escrow + Verification + Listings + Ratings) = 8/10. Skip Features 9-12 if needed.

**Q: Do I need to implement all 29 MCP tools?**
A: No. Build core tools first: search_humans, create_job_with_escrow, escrow_approve, leave_agent_review, post_job_listing, browse_listings, accept_application. Add others as demand appears.

**Q: What's the cheapest integration path?**
A:
- Privy: Already integrated (free)
- Midata: ~$500-2000/month for verification volume
- Coinbase Pay: Fee-based (2-3% on deposits)
- Wise: Fee-based (~1.5% + fixed fee)
- Claude: $0.003 per 1K input tokens (negligible for descriptions)

**Q: How do I know if the roadmap is working?**
A: Track weekly:
- Acceptance rate (target: 30% → 60%)
- Job value (target: $100 → $250)
- Supply per skill (target: <2 → 10+)
- Escrow adoption (target: 0% → 70%)
- Webhook adoption (target: 0% → 60%)

If any metric stalls, investigate and adjust.

---

## Document Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-03-29 | Initial release |

---

## Contact & Questions

- **Product Questions:** Reference ROADMAP_AI_AGENT_CTO_9_PLUS_10.md
- **Engineering Questions:** Reference TECHNICAL_IMPLEMENTATION_CHECKLIST.md
- **API Questions:** Reference DETAILED_API_SPECS.md
- **General Feedback:** Update this README_ROADMAP.md

---

**This package is the complete product architecture for scaling HumanPages. Everything you need is here. Let's build 9+/10.**

