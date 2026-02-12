# ERC-8004 Reputation Compatibility

**Status:** Data Layer Complete
**Priority:** High
**Motivation:** Make review data trivially exportable to the ERC-8004 on-chain reputation registry for AI agents, without requiring any on-chain calls today.

---

## Overview

ERC-8004 defines an on-chain Reputation Registry where humans can give structured feedback to AI agents via `giveFeedback(agentId, value, valueDecimals, tag1, tag2, feedbackHash)`. Human Pages already stores agent reviews (1-5 stars); this feature adds pre-computed ERC-8004 fields so a future bridge can publish them directly.

---

## What Was Done

1. **Mapping utility** (`backend/src/lib/erc8004.ts`) — pure functions for rating conversion, feedback JSON construction, and hashing
2. **Schema fields** — 5 new columns on `Review` (`erc8004Value`, `erc8004ValueDecimals`, `erc8004Tag1`, `erc8004Tag2`, `erc8004FeedbackHash`) and 1 on `Agent` (`erc8004AgentId`)
3. **Migration with backfill** — existing reviews and agents get ERC-8004 values populated
4. **Eager computation** — new reviews and agents get ERC-8004 fields at creation time
5. **Guard-rail comments** — `trustScore.ts` and `humans.ts` annotated to prevent accidental use of `erc8004Value` where `rating` is expected

---

## What Was NOT Done (Future Work)

- No on-chain calls, ABIs, or contract deployments
- No API surface changes (review request/response shapes unchanged)
- No frontend changes
- No bridge cron job (see architecture sketch in mapping doc)

---

## Key Files

| File | Purpose |
|------|---------|
| `backend/src/lib/erc8004.ts` | Mapping utility (pure functions) |
| `backend/prisma/schema.prisma` | Schema with ERC-8004 fields |
| `docs/ERC-8004-MAPPING.md` | **Full specification** — field mapping, invariants, architecture |

---

## See Also

- [docs/ERC-8004-MAPPING.md](../docs/ERC-8004-MAPPING.md) — the primary reference document
- [features/mutual-ratings.md](./mutual-ratings.md) — ERC-8004 alignment section for human→agent ratings
