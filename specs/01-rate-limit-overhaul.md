# Feature Spec: Rate Limit Overhaul

**Priority:** Phase 1 (Ship Week 1)
**Effort:** 1-2 days
**War Room Verdict:** BLOCKING — every agent in the war room agreed this is killing adoption NOW.

---

## Why This Matters

The current rate limits were designed to prevent abuse, but they're throttling a marketplace with a supply problem, not a demand problem. A vibe-coder on BASIC can post 1 job every 2 days. A crypto trader automating market-sensing tasks needs 20+/day. We're losing users before they ever experience the product value.

Current state:
- **BASIC:** 1 job offer per 2 days, 1 profile view per day
- **PRO:** 15 job offers per day, 50 profile views per day
- **IP limit:** 30 offers/day per IP (anti-spoofing)
- **x402:** Bypasses tier limits entirely (pay-per-request)

Competitors (RentAHuman, HumanAPI) have no artificial limits. Every day we keep these limits is a day users bounce.

---

## What We're Building

A flexible, configurable rate limit system that removes adoption friction while preserving anti-abuse protection. The goal: let legitimate agents work freely while keeping sybil/spam defenses.

### New Tier Limits

| Tier | Job Offers | Profile Views | Job Window |
|------|-----------|---------------|------------|
| BASIC | 10/day | 10/day | 24 hours (was 48) |
| PRO | 100/day | 200/day | 24 hours |
| WHALE | 500/day | unlimited | 24 hours |
| x402 | unlimited | unlimited | per-request payment |

### Additional Changes

1. **Soft limits with warnings** — At 80% of limit, return a `X-RateLimit-Warning` header so agents can adapt
2. **Rate limit headers on every response** — `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` (RFC 6585 compliant)
3. **Configurable via environment variables** — No code deploy needed to adjust limits
4. **Burst allowance** — Allow 3x the hourly rate in a single burst (e.g., PRO can post 12 jobs in one minute, but still capped at 100/day)
5. **Remove the 48-hour window** — All tiers use 24-hour rolling windows

---

## Files to Modify

### Backend

| File | What Changes |
|------|-------------|
| `backend/src/routes/agentActivation.ts` | Update `TIER_CONFIG` with new limits. Add WHALE tier definition. |
| `backend/src/routes/jobs.ts` (lines 147-151) | Update tier-based offer limits. Switch BASIC from 48h to 24h window. Add rate limit headers to response. |
| `backend/src/routes/humans.ts` (lines 1-10) | Update `TIER_PROFILE_LIMITS` from `{BASIC: 1, PRO: 50}` to new values. |
| `backend/src/middleware/rateLimitHeaders.ts` | **NEW FILE.** Middleware to attach RFC 6585 rate limit headers to all gated responses. |
| `backend/src/lib/rateLimitConfig.ts` | **NEW FILE.** Centralized config reading from env vars with fallback defaults. |
| `backend/prisma/schema.prisma` | Add WHALE to any tier-related enums if not already present. |

### Frontend

| File | What Changes |
|------|-------------|
| `frontend/src/pages/Pricing.tsx` (or equivalent) | Update displayed limits to match new tiers. |
| `frontend/src/lib/api.ts` | Parse `X-RateLimit-*` headers from responses. Surface remaining quota to UI. |
| `frontend/src/components/dashboard/RateLimitIndicator.tsx` | **NEW FILE.** Optional: show agents their remaining quota. |

### Config

| File | What Changes |
|------|-------------|
| `.env.example` | Add `RATE_LIMIT_BASIC_JOBS=10`, `RATE_LIMIT_PRO_JOBS=100`, etc. |

---

## Technical Specification

### Rate Limit Config Module

```typescript
// backend/src/lib/rateLimitConfig.ts
export const RATE_LIMITS = {
  BASIC: {
    jobOffersPerDay: parseInt(process.env.RATE_LIMIT_BASIC_JOBS || '10'),
    profileViewsPerDay: parseInt(process.env.RATE_LIMIT_BASIC_PROFILES || '10'),
    windowMs: 24 * 60 * 60 * 1000, // 24 hours
  },
  PRO: {
    jobOffersPerDay: parseInt(process.env.RATE_LIMIT_PRO_JOBS || '100'),
    profileViewsPerDay: parseInt(process.env.RATE_LIMIT_PRO_PROFILES || '200'),
    windowMs: 24 * 60 * 60 * 1000,
  },
  WHALE: {
    jobOffersPerDay: parseInt(process.env.RATE_LIMIT_WHALE_JOBS || '500'),
    profileViewsPerDay: Infinity,
    windowMs: 24 * 60 * 60 * 1000,
  },
};
```

### Rate Limit Headers Middleware

Every response from a rate-limited endpoint must include:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 73
X-RateLimit-Reset: 1711843200
X-RateLimit-Warning: approaching   # Only when remaining < 20%
```

### Migration Path

1. Deploy new config module with current values first (no behavior change)
2. Flip to new values via env vars (instant, no deploy)
3. Monitor for 48 hours
4. Remove old hardcoded values from code

---

## Anti-Abuse Protections (Keep These)

- **IP rate limiter (30/day)** — Keep as-is. This prevents a single machine from spoofing multiple agent IDs.
- **x402 bypass** — Keep as-is. Paying per-request is the ultimate anti-abuse signal.
- **Agent status checks** — Keep BANNED/SUSPENDED blocking. Don't relax these.
- **Job validation** — Keep all offer filters (price, distance, payment preference). These protect humans from spam offers.

### New Anti-Abuse Addition

- **Velocity alert** — If an agent goes from 0 jobs to hitting their daily limit in <1 hour, flag for manual review (don't block, just flag). This catches compromised API keys.

---

## Dev Team Review Checklist

### Architect
- [ ] Rate limit config is centralized in one module, not scattered across route files
- [ ] Env var approach allows per-environment tuning (staging vs production)
- [ ] WHALE tier is properly integrated into the activation flow
- [ ] No breaking changes to x402 payment bypass logic
- [ ] Rate limit storage is appropriate (in-memory for single-instance, Redis-backed if we scale to multiple instances)

### QA
- [ ] Test each tier at exactly the limit boundary (e.g., 10th job on BASIC succeeds, 11th fails with 429)
- [ ] Test window rollover (job posted at 23:59 shouldn't count against next day)
- [ ] Test x402 bypass still works with new limits
- [ ] Test BANNED/SUSPENDED agents are still blocked regardless of limit
- [ ] Test rate limit headers are present on every gated response
- [ ] Test burst allowance works correctly
- [ ] Load test: 100 concurrent agents hitting limits simultaneously

### UX
- [ ] 429 error response includes a clear message: "You've reached your daily limit of X job offers. Upgrade to PRO for Y/day, or use x402 for unlimited."
- [ ] Rate limit warning at 80% is actionable (tells agent what to do)
- [ ] Dashboard quota indicator (if built) is easy to understand at a glance

### Frontend
- [ ] API client parses rate limit headers correctly
- [ ] Rate limit indicator component (if built) updates reactively
- [ ] Pricing page reflects new tier limits
- [ ] Error handling for 429 responses shows upgrade path

### Backend
- [ ] All hardcoded limit values replaced with config module references
- [ ] 48-hour window replaced with 24-hour for BASIC
- [ ] Rate limit counting query is efficient (indexed, no full table scan)
- [ ] Velocity alert fires correctly on suspicious patterns
- [ ] All existing tests updated to reflect new limits
- [ ] No regression in job creation flow

### User Feedback
- [ ] Identify 3 agents currently on BASIC tier and observe if their usage increases after rollout
- [ ] Track daily job creation volume before/after (this is the key metric)
- [ ] Survey: "Did rate limits ever prevent you from using HumanPages?"

### Product Manager
- [ ] New limits align with competitive positioning (more generous than competitors)
- [ ] WHALE tier pricing defined (even if not launched yet)
- [ ] Metrics dashboard tracks: jobs/day by tier, 429 error rate, upgrade conversion from limit hits
- [ ] Feature flag for gradual rollout (start with 2x current limits, monitor, then go to full new limits)

### Critical 3rd-Party Reviewer
- [ ] Rate limit implementation follows RFC 6585 / IETF draft-ietf-httpapi-ratelimit-headers
- [ ] No security implications from relaxed limits (e.g., can an agent DDoS a human's inbox?)
- [ ] Rate limiting is applied consistently across all entry points (REST API, MCP tools, x402)

### Tech Blogger
- [ ] Write a changelog entry: "We've 10x'd rate limits across all tiers. Build faster."
- [ ] Highlight the env-var configurability as a "we listen to developers" signal
- [ ] Compare our limits vs. RentAHuman/HumanAPI (if public) for competitive narrative

---

## Tests to Write

```
backend/src/tests/rate-limits.test.ts (NEW)

describe('Rate Limit Overhaul')
  describe('BASIC tier')
    ✓ allows 10 job offers in 24 hours
    ✓ blocks 11th job offer with 429
    ✓ resets after 24-hour window
    ✓ allows 10 profile views per day
    ✓ blocks 11th profile view with 429

  describe('PRO tier')
    ✓ allows 100 job offers in 24 hours
    ✓ allows 200 profile views per day

  describe('WHALE tier')
    ✓ allows 500 job offers in 24 hours
    ✓ allows unlimited profile views

  describe('x402 bypass')
    ✓ x402 payment bypasses all tier limits
    ✓ x402 does not count against tier quota

  describe('Rate limit headers')
    ✓ includes X-RateLimit-Limit on every gated response
    ✓ includes X-RateLimit-Remaining (decrements correctly)
    ✓ includes X-RateLimit-Reset (correct timestamp)
    ✓ includes X-RateLimit-Warning when remaining < 20%

  describe('Anti-abuse')
    ✓ IP rate limiter (30/day) still enforced
    ✓ BANNED agents blocked regardless of tier
    ✓ SUSPENDED agents blocked regardless of tier
    ✓ velocity alert triggers on rapid limit consumption

  describe('Config')
    ✓ reads limits from environment variables
    ✓ falls back to defaults when env vars missing
    ✓ changing env vars changes behavior (no restart needed if using config reload)

  describe('Migration')
    ✓ existing BASIC agents use new 24h window (not 48h)
    ✓ existing PRO agents get upgraded limits immediately
```

---

## Acceptance Criteria

1. A BASIC agent can post 10 jobs/day (was 1 per 2 days)
2. A PRO agent can post 100 jobs/day (was 15)
3. All rate-limited responses include RFC-compliant headers
4. Limits are configurable via environment variables without code deploy
5. x402 bypass is unaffected
6. Anti-abuse protections (IP limiter, status checks) are preserved
7. All tests pass, including new rate limit test suite
8. Zero downtime deployment — old and new limits are both valid states

---

## Dependencies

- None. This feature is self-contained.
- Ships before or in parallel with all other features.
- The WHALE tier definition here will be referenced by `05-erc8004-bridge.md` and `02-jury-system.md`.
