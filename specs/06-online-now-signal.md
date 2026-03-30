# Feature Spec: Online-Now Signal

**Priority:** Phase 3 (Ship Weeks 7-8)
**Effort:** 1 week
**War Room Verdict:** Defer until user base >1K. Hidden infrastructure cost (Redis/websocket). Only justified if it unlocks differentiation.

---

## Why This Matters

For $2-3 micro-tasks, response time is everything. An agent needs a human NOW — not in 4 hours. Currently there's no way to know if a human is online and available. The agent sends a job offer into the void and waits.

Online-Now lets agents filter for humans who are actively available, dramatically reducing time-to-acceptance for micro-tasks. This is the difference between "your task is done in 5 minutes" and "your task is done tomorrow."

### Use Cases

- Vibe-coder needs a quick translation — filter for online translators
- Crypto trader needs manual verification of a DeFi position — find someone online NOW
- Mobile dev needs a screenshot from a specific device — find someone with that device who's online

---

## What We're Building

A real-time presence system that tracks which humans are currently online and surfaces this in search results and the job board.

### Presence States

| State | Meaning | How Set |
|-------|---------|---------|
| `ONLINE` | Human is actively browsing HumanPages | Heartbeat from frontend (every 60s) |
| `RECENTLY_ACTIVE` | Was online in last 15 minutes | Auto-transition after heartbeat gap |
| `AWAY` | Was online in last 2 hours | Auto-transition |
| `OFFLINE` | Not seen in 2+ hours | Default state |
| `DO_NOT_DISTURB` | Online but not accepting tasks | Manually set by human |

### Architecture Decision: Redis vs. Database

**Recommendation: Redis** (even though it's new infrastructure)

Why:
- Presence data is ephemeral (doesn't need persistence)
- High write frequency (heartbeat every 60s per user)
- High read frequency (every search query checks presence)
- TTL-based auto-expiry is built into Redis
- DB writes every 60s per user would be expensive at scale

If Redis is too much infra for now, **fallback: database with aggressive caching.**

```
Option A: Redis (recommended)
  - SETEX user:{id}:presence "ONLINE" 120  (120s TTL, auto-expires)
  - GET user:{id}:presence → returns state or nil (OFFLINE)
  - No cron needed — TTL handles transitions

Option B: DB + Cache (simpler)
  - lastSeenAt DateTime on Human model
  - Heartbeat: UPDATE humans SET lastSeenAt = NOW() WHERE id = ?
  - Query: WHERE lastSeenAt > NOW() - INTERVAL 15 MINUTES
  - Cache search results for 30s
```

---

## Data Model

### Redis Keys (Option A)

```
presence:{humanId}        → "ONLINE" | "DND"     (TTL: 120s)
presence:online_set       → ZSET of humanIds      (score: timestamp)
presence:stats:online     → INT count of online    (TTL: 60s)
```

### Database Changes (both options)

```prisma
model Human {
  // ... existing fields ...
  lastSeenAt          DateTime?
  presenceStatus      String    @default("OFFLINE") // ONLINE | RECENTLY_ACTIVE | AWAY | OFFLINE | DO_NOT_DISTURB
  acceptingTasks      Boolean   @default(true) // Can be toggled independently
}
```

---

## API Endpoints

### Presence Management (Human)

```
POST   /api/presence/heartbeat    # Send heartbeat (authenticated human)
PUT    /api/presence/status       # Set DND/available (manual toggle)
GET    /api/presence/me           # Get my current presence state
```

### Presence Query (Agent/Public)

```
GET    /api/presence/online       # List currently online humans (with filters)
GET    /api/presence/count        # Count of online humans (public stat)
GET    /api/humans/search?online=true  # Extend existing search with online filter
```

### MCP Tools (Updated)

```
search_humans   # Add online_only parameter
get_human       # Include presence_status in response
```

---

## Frontend Integration

### Heartbeat System

```typescript
// frontend/src/hooks/usePresence.ts
function usePresence() {
  useEffect(() => {
    // Send heartbeat on mount and every 60s
    const sendHeartbeat = () => api.post('/presence/heartbeat');
    sendHeartbeat();
    const interval = setInterval(sendHeartbeat, 60_000);

    // Send heartbeat on tab focus (user returned)
    const onFocus = () => sendHeartbeat();
    window.addEventListener('focus', onFocus);

    // Clear on tab close
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, []);
}
```

### Visual Indicators

- **Green dot** — ONLINE
- **Yellow dot** — RECENTLY_ACTIVE
- **Gray dot** — AWAY / OFFLINE
- **Red dot** — DO_NOT_DISTURB
- Shown on: search results, profile cards, job board claims, dashboard

### DND Toggle

Simple toggle in the human dashboard: "Available for tasks" on/off. When off, presence shows as DND and agent searches with `online=true` exclude this human.

---

## Files to Create/Modify

### New Files

| File | Purpose |
|------|---------|
| `backend/src/routes/presence.ts` | Heartbeat, status, online query endpoints |
| `backend/src/lib/presence.ts` | Presence logic (Redis or DB implementation) |
| `backend/src/lib/redis.ts` | Redis client singleton (if using Redis) |
| `backend/src/tests/presence.test.ts` | Presence system tests |
| `frontend/src/hooks/usePresence.ts` | Heartbeat hook |
| `frontend/src/components/presence/OnlineIndicator.tsx` | Green/yellow/gray/red dot component |
| `frontend/src/components/presence/AvailabilityToggle.tsx` | DND toggle for dashboard |

### Modified Files

| File | What Changes |
|------|-------------|
| `backend/prisma/schema.prisma` | Add lastSeenAt, presenceStatus, acceptingTasks to Human |
| `backend/src/app.ts` | Register presence routes |
| `backend/src/routes/humans.ts` | Add online filter to search endpoint |
| `backend/src/lib/mcp-tools.ts` | Add online_only param to search_humans |
| `frontend/src/pages/Dashboard.tsx` | Add availability toggle |
| `frontend/src/pages/PublicProfile.tsx` | Show presence indicator |
| `frontend/src/components/search/HumanCard.tsx` | Show presence dot |
| `frontend/src/lib/api.ts` | Add presence API methods |

---

## Dev Team Review Checklist

### Architect
- [ ] Redis vs. DB decision is documented with rationale
- [ ] If Redis: connection pooling, reconnection strategy, fallback if Redis goes down
- [ ] If DB: heartbeat writes are batched/debounced (not 1 write per heartbeat per user)
- [ ] Heartbeat endpoint is lightweight (no auth DB lookup on every ping — use JWT cache)
- [ ] Presence data never blocks search queries (timeout: return OFFLINE if presence check fails)
- [ ] No privacy leakage: presence is only visible to agents who can already search this human

### QA
- [ ] Heartbeat updates presence to ONLINE
- [ ] Missing 2 heartbeats (>120s) transitions to RECENTLY_ACTIVE
- [ ] Missing heartbeats for 15+ minutes transitions to AWAY
- [ ] Missing heartbeats for 2+ hours transitions to OFFLINE
- [ ] DND toggle overrides all automatic transitions
- [ ] search_humans with online=true returns only ONLINE humans
- [ ] search_humans with online=true returns empty when nobody is online (not an error)
- [ ] Presence indicator updates on profile page without refresh
- [ ] Tab focus triggers immediate heartbeat
- [ ] Closing tab stops heartbeats (presence eventually expires)

### UX
- [ ] Presence dots are colorblind-friendly (use shapes or labels in addition to color)
- [ ] DND is easy to find and toggle (dashboard, not buried in settings)
- [ ] "Last seen 2 hours ago" is shown for AWAY humans (useful context)
- [ ] No notifications about presence changes (that would be creepy)

### Frontend
- [ ] usePresence hook only runs for authenticated humans (not agents, not public visitors)
- [ ] Heartbeat is debounced (don't send 10 heartbeats on rapid tab switches)
- [ ] OnlineIndicator is a tiny, reusable component (8-12px dot)
- [ ] Service worker keeps heartbeat alive when tab is backgrounded (optional, mobile-important)

### Backend
- [ ] Heartbeat endpoint returns 204 (no body, minimal bandwidth)
- [ ] Rate limit on heartbeat: max 1 per 30 seconds per user (prevent accidental hammering)
- [ ] Presence data is NOT included in public human select (privacy — only shown to searching agents)
- [ ] Redis key TTL matches the ONLINE→RECENTLY_ACTIVE transition (120s)

### User Feedback
- [ ] Track: what % of humans have the tab open (heartbeat rate)
- [ ] Track: do agents filter by online? How often?
- [ ] Track: time-to-acceptance for online vs. offline humans

### Product Manager
- [ ] Presence is a premium signal (free users see "Active recently," PRO agents see real-time status)
- [ ] Dashboard shows "X humans online now" as a health metric
- [ ] Marketing: "Get your task done in minutes, not hours"

### Critical 3rd-Party Reviewer
- [ ] Presence tracking complies with GDPR (user can opt out / disable heartbeat)
- [ ] No surveillance concerns: presence is only active while user is on the platform
- [ ] Redis (if used) is not exposed to the internet (internal network only)
- [ ] Heartbeat data is not logged or stored long-term (ephemeral only)

### Tech Blogger
- [ ] Write: "Real-time human availability: how we built instant task matching"
- [ ] If Redis: talk about the infra decision and tradeoffs
- [ ] Benchmark: time-to-first-response with vs. without online filtering

### Infrastructure Engineer (additional role)
- [ ] Redis deployment plan (managed Redis via Upstash/Railway, or self-hosted)
- [ ] Redis memory estimation: 1000 users × ~100 bytes/key = ~100KB (negligible)
- [ ] Redis availability: if Redis goes down, graceful degradation to "everyone appears OFFLINE"
- [ ] Monitoring: Redis latency, connection count, memory usage

---

## Tests to Write

```
backend/src/tests/presence.test.ts

describe('Online-Now Signal')
  describe('Heartbeat')
    ✓ POST /presence/heartbeat sets status to ONLINE
    ✓ Heartbeat updates lastSeenAt
    ✓ Heartbeat requires authentication
    ✓ Rate-limited to 1 per 30 seconds

  describe('Status Transitions')
    ✓ No heartbeat for 120s → RECENTLY_ACTIVE
    ✓ No heartbeat for 15min → AWAY
    ✓ No heartbeat for 2h → OFFLINE
    ✓ DND overrides automatic transitions
    ✓ Heartbeat after DND stays DND (must manually toggle back)

  describe('Search Integration')
    ✓ search_humans with online=true returns only ONLINE humans
    ✓ search_humans without online param returns all humans (no filter)
    ✓ DND humans excluded from online=true search
    ✓ Presence info included in search results

  describe('MCP')
    ✓ search_humans tool accepts online_only parameter
    ✓ get_human tool returns presence_status
```

---

## Acceptance Criteria

1. Humans send heartbeat every 60s while on platform
2. Presence auto-transitions: ONLINE → RECENTLY_ACTIVE → AWAY → OFFLINE
3. DND toggle available in human dashboard
4. Agent search supports online_only filter
5. MCP search_humans tool supports online_only parameter
6. Presence indicators visible on search results and profiles
7. Graceful degradation if Redis is unavailable
8. All tests pass

---

## Dependencies

- **Rate Limit Overhaul (01):** Presence filtering is more useful with relaxed rate limits (agents can search more)
- **Open Job Posting (03):** Job board shows presence on listing claims
- **Infra:** Redis deployment (or DB fallback decision)
