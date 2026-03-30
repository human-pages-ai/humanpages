# HumanPages Agent MCP: Quick Reference Card

## 7 New Tools (In Priority Order)

### MUST-HAVE (Core Autonomy)

1. **`agent_search_with_suggestions`** — Find workers
   - Input: `skill`, `location`, `budget`, `minVouches`
   - Output: `directMatches[]`, `alternativeMatches[]`, `supplyGapAnalysis`
   - Solves: 0% search success rate → 85%+
   - Effort: 2 weeks

2. **`agent_bulk_job_operations`** — Hire 100 at once
   - Input: `jobs[]` array (1-1000)
   - Output: `batchId`, `jobsCreated`, `jobsFailed`
   - Solves: Rate limits (15/day → 5000/day)
   - Effort: 1 week

3. **`agent_create_job_with_stream`** — Real-time payments
   - Input: `humanId`, `streamConfig` (Superfluid, $15/hr), `webhookUrl`
   - Output: `jobId`, `streamAddress`, `status`
   - Solves: Autonomy (10% → 95%, no polling)
   - Effort: 3 weeks (includes webhook infra)

4. **`agent_validate_deliverable`** — Auto-QA
   - Input: `deliverableId`, `validationRules[]` (schema, custom, audit)
   - Output: `overallValid`, `action`, `streamTicked`
   - Solves: QA latency (24 hrs → 30 sec)
   - Effort: 2 weeks

### SHOULD-HAVE (Trust & Quality)

5. **`agent_analyze_human_fraud_risk`** — Know who's trustworthy
   - Input: `humanId`, `analysisDepth`
   - Output: `fraudRiskScore` (0-1), `riskFactors[]`, `recommendations[]`
   - Solves: Reputation gameable → ML-detected fraud
   - Effort: 3 weeks

6. **`agent_browse_pre_built_services`** — Discover gigs
   - Input: `category`, `minRating`, `maxPrice`, `sortBy`
   - Output: `services[]` with pricing, SLA, reviews
   - Solves: Hiring friction (5 min → 10 sec)
   - Effort: 2 weeks

### NICE-TO-HAVE (Convenience)

7. **`agent_quick_hire_service`** — Buy with 1 click
   - Input: `serviceId`
   - Output: `jobId` (created immediately)
   - Solves: Same as #6
   - Effort: 1 week

---

## Implementation Timeline: 14 Weeks

**Phase 1 (Weeks 1-4):** Search + Bulk + Rate Limits
**Phase 2 (Weeks 5-8):** Streaming + QA
**Phase 3 (Weeks 9-12):** Fraud Detection
**Phase 4 (Weeks 13-14):** Pre-built Gigs + SLA

---

## Files to Read

1. **ARCHITECTURE_SUMMARY.md** — 5-minute read, all 6 problems + 7 solutions
2. **AGENT_ARCHITECTURE.md** — 30-minute deep dive, both scenarios with code
3. **MCP_API_SPEC.md** — Full OpenAPI spec for integration
4. **IMPLEMENTATION_ROADMAP.md** — Week-by-week code + database changes

---

**Expected Score: 3/10 → 9/10**

