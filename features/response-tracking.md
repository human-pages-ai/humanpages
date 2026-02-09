# Response Time & Activity Tracking

**Status:** Planned (Post-Launch)
**Priority:** Medium
**Motivation:** Agents value predictability. Knowing how quickly a human responds helps agents choose the right person.

---

## Overview

When an agent sends a job offer, they have no idea if the human will respond in 5 minutes or 5 days. This uncertainty reduces trust and makes agents less likely to use the platform. Similarly, humans with fast response times deserve to be rewarded with better visibility.

This feature tracks response behavior and surfaces it as a trust signal on profiles and in search results.

---

## Design

### Metrics Tracked

| Metric | Definition | Displayed As |
|--------|-----------|--------------|
| Median response time | Time from offer creation to accept/reject | "Typically responds in 2h" |
| Response rate | % of offers responded to (accepted or rejected) vs ignored | "Responds to 85% of offers" |
| Completion rate | % of accepted jobs that reach COMPLETED status | "Completes 95% of accepted jobs" |
| Last active | Most recent profile visit or job interaction | "Active 3 hours ago" |
| Read receipt | Whether the human has viewed a specific offer | "Seen" / "Not yet seen" |

### Response Time Buckets

| Bucket | Label | Badge |
|--------|-------|-------|
| < 1 hour | "Responds quickly" | Lightning bolt |
| 1-4 hours | "Responds in a few hours" | Clock |
| 4-24 hours | "Responds within a day" | Calendar |
| > 24 hours | "May take a few days" | None |
| No data | "New to platform" | None |

### Schema Changes

```prisma
model Human {
  // ... existing fields

  // Response metrics (computed periodically)
  medianResponseMinutes  Int?       // Median time to respond to offers
  responseRate           Float?     // 0.0 - 1.0
  completionRate         Float?     // 0.0 - 1.0
}

model Job {
  // ... existing fields
  viewedAt               DateTime?  // When human first viewed the offer
}
```

### Computation

Response metrics are recomputed:
- On each job status change (accept/reject/complete)
- Via a nightly cron job for staleness cleanup

Only considers the last 30 jobs to keep metrics current (a human who was slow 6 months ago shouldn't be penalized forever).

```typescript
async function computeResponseMetrics(humanId: string) {
  const recentJobs = await prisma.job.findMany({
    where: { humanId, status: { not: 'PENDING' } },
    orderBy: { createdAt: 'desc' },
    take: 30,
  });

  const responseTimes = recentJobs
    .filter(j => j.acceptedAt || j.status === 'REJECTED')
    .map(j => {
      const respondedAt = j.acceptedAt || j.updatedAt;
      return (respondedAt.getTime() - j.createdAt.getTime()) / 60000; // minutes
    });

  const responded = recentJobs.filter(
    j => j.status !== 'PENDING' && j.status !== 'CANCELLED'
  ).length;

  const completed = recentJobs.filter(j => j.status === 'COMPLETED').length;
  const accepted = recentJobs.filter(
    j => ['ACCEPTED', 'PAID', 'COMPLETED'].includes(j.status)
  ).length;

  await prisma.human.update({
    where: { id: humanId },
    data: {
      medianResponseMinutes: median(responseTimes),
      responseRate: recentJobs.length > 0 ? responded / recentJobs.length : null,
      completionRate: accepted > 0 ? completed / accepted : null,
    },
  });
}
```

---

## API Changes

### Search Results (Updated)
```
GET /api/humans/search?skill=photography

Response items now include:
{
  "id": "...",
  "name": "...",
  ...
  "responsiveness": {
    "medianResponseMinutes": 45,
    "responseRate": 0.92,
    "completionRate": 0.97,
    "label": "Responds quickly",
    "lastActiveAt": "2026-02-09T10:30:00Z"
  }
}
```

### Read Receipts
```
// When human views a job offer in dashboard, backend records:
PATCH /api/jobs/:id/viewed   (called automatically by frontend)

// Agent can check:
GET /api/jobs/:id
{
  ...
  "viewedAt": "2026-02-09T10:35:00Z"  // or null if not yet seen
}
```

---

## MCP Server Changes

- `search_humans` results include responsiveness data
- `get_human` includes full response metrics
- `get_job_status` includes `viewedAt` field

---

## Frontend Changes

### Public Profile
- [ ] Response time badge ("Typically responds in 2h")
- [ ] Response rate ("Responds to 92% of offers")
- [ ] Completion rate ("Completes 97% of accepted jobs")
- [ ] Last active indicator

### Search Results
- [ ] Response time label next to each result
- [ ] Sort/filter by response time option

### Human Dashboard
- [ ] "Your responsiveness" stats card
- [ ] Tips: "Respond to offers within 4 hours to earn the 'Responds quickly' badge"

---

## Implementation Phases

### Phase 1: Data Collection
- [ ] Add `viewedAt` to Job model
- [ ] Track offer view events from frontend
- [ ] Add response metric fields to Human model

### Phase 2: Computation
- [ ] Response metric computation function
- [ ] Trigger on job status changes
- [ ] Nightly cron for recomputation

### Phase 3: Display
- [ ] Surface in search results and profiles
- [ ] Read receipt in job status API
- [ ] Responsiveness badges

### Phase 4: Agent Integration
- [ ] Update MCP tools with responsiveness data
- [ ] Allow search filtering by response time

---

## Open Questions

1. **Should agents see read receipts?** Could create pressure on humans. Maybe opt-in for humans?
2. **Minimum jobs before showing metrics?** Probably 5+ to be statistically meaningful.
3. **Should response metrics affect search ranking?** Or just display? Ranking feels more impactful.
4. **Time zone awareness?** An offer sent at 3am shouldn't penalize response time. Consider "business hours" adjustment.
