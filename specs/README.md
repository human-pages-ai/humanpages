# HumanPages Feature Specs

Generated from the War Room session on 2026-03-30. Each spec is a self-contained implementation brief designed to be picked up by a new Cowork/Claude Code session with zero context from prior sessions.

---

## How to Start a Session

Each feature gets its own session. The `spec-dev` skill automates the entire workflow — branch creation, phased implementation, 3-round dev team review with self-correction, and final verification.

**Option A: With the spec-dev skill installed (recommended)**

Just say:
```
Implement the feature from specs/01-rate-limit-overhaul.md
```
The `/spec-dev` skill triggers automatically. It reads the project config at `.claude/skills/spec-dev/references/humanpages.md`, creates the branch, and runs the full workflow including 3 rounds of virtual dev team review.

**Option B: Without the skill**

Use this prompt:
```
Read specs/README.md first for project context, then read specs/[XX-feature-name].md and implement it fully. Follow all rules in the README — especially the git workflow, testing, and dev team review process.
```

---

## Git Workflow (CRITICAL — read before touching code)

### Branch Isolation

The repo has a built-in session branching tool. **Every session MUST start with:**

```bash
sh scripts/git-session.sh <feature-name>
```

This creates a branch `session/<YYYYMMDD-HHMMSS>-<feature-name>` off latest master, stashes any uncommitted changes first, and isolates your work completely.

**Examples for these specs:**

```bash
sh scripts/git-session.sh rate-limit-overhaul
sh scripts/git-session.sh jury-system
sh scripts/git-session.sh open-job-posting
sh scripts/git-session.sh result-delivery
sh scripts/git-session.sh erc8004-bridge
sh scripts/git-session.sh online-now-signal
sh scripts/git-session.sh bulk-jobs
```

### Rules

- **NEVER commit directly to master.** The `git-session.sh` script handles branching.
- **NEVER use `--no-verify`** to skip pre-push hooks. If hooks fail, fix the issue.
- **Do NOT push to remote** — leave that for the human reviewer.
- When done, the human runs `sh scripts/git-session-merge.sh` to merge back.
- If sub-agents need to edit code, use `isolation: "worktree"` to give them an isolated copy.
- Before editing anything, run `git status` to verify the working tree is clean. Another session may have uncommitted changes.

### Pre-Push Hooks

The repo has heavy pre-push hooks (TypeScript compilation, Vitest, e2e). Known issues and fixes:

| Issue | Symptom | Fix |
|-------|---------|-----|
| Prisma client corruption | `Cannot find module '.prisma/client/default'` | Add resolve alias in `backend/vitest.config.ts` |
| e2e timeout | Backend can't start within 30s during parallel tests | Use `PUSH_LITE=1 git push` to skip e2e |
| Flaky RouteGuards | Landing page tests fail when i18n doesn't resolve | Known flake — re-run |

---

## Codebase Architecture

### Stack

- **Backend:** Express + TypeScript, Prisma ORM, PostgreSQL, Vitest
- **Frontend:** React + TypeScript, Vite
- **Blockchain:** Viem (payment verification), Superfluid (streaming)
- **Auth:** JWT (humans), API key + bcrypt (agents), OAuth 2.0 (MCP)
- **Payments:** USDC on Ethereum, Base, Polygon, Arbitrum, Optimism + x402 protocol

### Directory Structure

```
├── backend/
│   ├── src/
│   │   ├── routes/         # 45+ route files (jobs.ts, humans.ts, agents.ts, etc.)
│   │   ├── middleware/      # Auth, rate limiting, x402
│   │   ├── lib/            # Business logic, blockchain, notifications
│   │   │   ├── blockchain/ # verify-payment.ts, chains.ts, Superfluid
│   │   │   └── ...
│   │   ├── cron/           # Scheduled tasks
│   │   └── tests/          # 47 test files, per-process ephemeral DBs
│   ├── prisma/
│   │   └── schema.prisma   # 1894 lines — THE data model
│   └── vitest.config.ts
├── frontend/
│   ├── src/
│   │   ├── pages/          # 32 pages
│   │   ├── components/     # 32 component directories
│   │   ├── lib/api.ts      # API client
│   │   └── hooks/
├── shared/
│   └── profile-schema.json # Single source of truth for profile fields
├── mcp-server/             # MCP tool definitions
├── scripts/
│   ├── git-session.sh      # Create isolated session branch
│   ├── git-session-merge.sh # Merge session back to master
│   └── git-safe.sh         # Safe git wrapper
└── specs/                  # ← You are here
```

### Key Files Every Session Should Know

| File | What It Is | When to Read |
|------|-----------|-------------|
| `CLAUDE.md` | Master development rules | **ALWAYS — before any code change** |
| `shared/profile-schema.json` | Field definitions, enums, wizard steps | Before touching any profile/human fields |
| `backend/prisma/schema.prisma` | Full data model (1894 lines) | Before adding any model or field |
| `backend/src/routes/jobs.ts` | Job creation, acceptance, payment flow | For any job-related feature |
| `backend/src/routes/humans.ts` | Human search, profile, rate limits | For search or profile features |
| `backend/src/routes/agentActivation.ts` | Tier config (BASIC/PRO), activation paths | For any tier-related changes |
| `backend/src/middleware/x402PaymentCheck.ts` | x402 per-request payment bypass | If touching rate limits or gating |
| `backend/src/lib/blockchain/verify-payment.ts` | On-chain payment verification | For any payment feature |
| `backend/src/tests/helpers.ts` | `cleanDatabase()`, `createActiveTestAgent()`, etc. | Before writing any tests |

---

## The Three-Layer Sync Rule

From `CLAUDE.md` — this is the #1 source of bugs. Every field must match across:

1. **Prisma schema** (`backend/prisma/schema.prisma`)
2. **Backend Zod validation** (`backend/src/routes/*.ts` — updateProfileSchema, createJobSchema, etc.)
3. **Frontend types** (`frontend/src/pages/onboarding/types.ts`)
4. **Frontend form state** (`frontend/src/pages/onboarding/hooks/useProfileForm.ts`)
5. **Frontend submit payload** (`frontend/src/pages/onboarding/index.tsx`)
6. **Frontend API client** (`frontend/src/lib/api.ts`)

**If you add a field in one layer, wire it through ALL layers.** A frontend input with no backend storage is a data-loss bug. A backend field with no frontend is dead code.

---

## Testing Infrastructure

### How Tests Work

- **Framework:** Vitest with `pool: 'forks'` (up to 8 parallel workers)
- **Database:** Each forked worker creates its own ephemeral PostgreSQL database (`humans_test_<pid>_<timestamp>`)
- **Setup:** `backend/src/tests/setup.ts` handles DB creation/migration/teardown per worker
- **Helpers:** `backend/src/tests/helpers.ts` provides `cleanDatabase()`, `createActiveTestAgent()`, `createTestUser()`, etc.
- **Timeout:** 10s per test, 30s per hook

### Running Tests

```bash
cd backend && npm test          # Run all tests
cd backend && npx vitest run src/tests/jobs.test.ts  # Run specific file
cd backend && npx vitest --watch  # Watch mode
```

### Test Conventions

- Use `cleanDatabase()` in `beforeEach` to ensure clean state
- Use `createActiveTestAgent()` and `createTestUser()` helpers — don't manually insert
- Test files go in `backend/src/tests/<feature>.test.ts`
- Flow tests (multi-step) go in `backend/src/tests/flows/<feature>.test.ts`
- Reference `shared/profile-schema.json` for valid enum values — don't hardcode
- Skip `NODE_ENV === 'test'` checks in rate limiters (already handled)

### After All Code Changes

```bash
cd backend && npm run build     # TypeScript compilation (catches type errors)
cd backend && npm test          # Full test suite
```

Both must pass before the session is considered complete.

---

## Prisma Migration Workflow

When adding new models or fields:

```bash
# 1. Edit backend/prisma/schema.prisma
# 2. Generate the client:
cd backend && npx prisma generate
# 3. Create the migration:
cd backend && npx prisma migrate dev --name <descriptive-name>
# 4. If auto-generated migration conflicts, delete it and re-run
```

**Pitfall:** `prisma migrate dev` may auto-generate an `*_init` migration that conflicts. Delete it and re-run with an explicit name.

**Pitfall:** After migration, update `cleanDatabase()` in `helpers.ts` to include new models in the correct deletion order (respect foreign key constraints).

---

## Virtual Dev Team

Every spec includes a review checklist for these roles. The implementing session should run through each checklist item as a final verification step — either by checking the code meets the requirement, or by spawning a sub-agent to review from that perspective.

| Role | Focus | How to Simulate |
|------|-------|----------------|
| **Architect** | System design, data flow, scalability | Review data model relationships, check for circular deps, verify transaction safety |
| **QA** | Test coverage, edge cases, regression | Write all specified tests, check boundary conditions, test error paths |
| **UX** | User experience, clarity, accessibility | Review error messages, check mobile responsiveness, verify feedback loops |
| **Frontend** | React components, state management | Check component reusability, responsive layout, loading states |
| **Backend** | API design, validation, performance | Verify Zod schemas, check query efficiency, review middleware chain |
| **User Feedback** | Metrics, surveys, adoption | Identify key metrics to track, suggest PostHog events |
| **Product Manager** | Business alignment, premium features | Verify feature aligns with 0% fee model, identify upsell opportunities |
| **Critical 3rd-Party Reviewer** | Security audit, compliance | Check for PII leakage, validate auth on all endpoints, review CORS |
| **Tech Blogger** | Changelog, competitive narrative | Draft a 1-paragraph changelog entry for each feature |

### Review Process

After implementation is complete:

1. Run all tests: `cd backend && npm test`
2. Run build: `cd backend && npm run build`
3. Walk through each checklist item in the spec
4. For any item that's unclear or risky, spawn a sub-agent to do a focused review
5. Fix any issues found
6. Re-run tests and build
7. Final `git status` to verify clean state

---

## Build Order (from War Room Verdict)

### Phase 1 — Ship Weeks 1-3 (parallel, no dependencies between them)

| # | Spec | Effort | Branch Command |
|---|------|--------|---------------|
| 01 | [Rate Limit Overhaul](01-rate-limit-overhaul.md) | 1-2 days | `sh scripts/git-session.sh rate-limit-overhaul` |
| 02 | [Jury System](02-jury-system.md) | 2-3 weeks | `sh scripts/git-session.sh jury-system` |

### Phase 2 — Ship Weeks 4-6

| # | Spec | Effort | Depends On | Branch Command |
|---|------|--------|-----------|---------------|
| 03 | [Open Job Posting](03-open-job-posting.md) | 1-2 weeks | 01 | `sh scripts/git-session.sh open-job-posting` |
| 04 | [Result Delivery](04-result-delivery.md) | 1-2 weeks | 02, 03 | `sh scripts/git-session.sh result-delivery` |

### Phase 3 — Ship Weeks 7-9

| # | Spec | Effort | Depends On | Branch Command |
|---|------|--------|-----------|---------------|
| 05 | [ERC-8004 Reputation Bridge](05-erc8004-bridge.md) | 2 weeks | 02, 04 | `sh scripts/git-session.sh erc8004-bridge` |
| 06 | [Online-Now Signal](06-online-now-signal.md) | 1 week | 01 | `sh scripts/git-session.sh online-now-signal` |
| 07 | [Bulk Jobs](07-bulk-jobs.md) | 1 week | 03, 04 | `sh scripts/git-session.sh bulk-jobs` |

### Dependency Graph

```
01-rate-limits ──────────────┬──→ 03-open-posting ──→ 07-bulk-jobs
                             │         │
02-jury-system ──────────────┤         ↓
                             ├──→ 04-result-delivery
                             │         │
                             │         ↓
                             └──→ 05-erc8004-bridge

01-rate-limits ──────────────→ 06-online-now
```

**Phase 1 specs (01, 02) can run in parallel with zero conflicts** — they touch different files entirely. Phase 2+ specs should wait for their dependencies to be merged to master first.

---

## Key Principles Across All Specs

1. **Clean code**: Zod validation on all inputs, typed Prisma models, follow existing patterns
2. **Tests required**: Each spec defines the exact test suite. No feature ships without tests passing.
3. **Three-layer sync**: Every schema change syncs Prisma → Backend Zod → Frontend types (per CLAUDE.md)
4. **Privacy first**: No PII in public endpoints. Follow `publicHumanSelect` patterns in `humans.ts`.
5. **MCP-native**: Every feature exposes MCP tools so AI agents can use it programmatically
6. **Ecosystem-connected**: Features feed into Moltbook, AgentFlex, and ERC-8004 where applicable
7. **Git isolation**: Each session creates its own branch via `git-session.sh`, never touches master

---

## Existing Enum Values (from shared/profile-schema.json)

These are already defined in the codebase. Use these exact values — don't invent new ones without updating the schema file:

- **RateType** (priceUnit): `HOURLY`, `FLAT_TASK`, `PER_WORD`, `PER_PAGE`, `NEGOTIABLE`
- **WorkType**: `digital`, `physical`, `both`
- **PaymentPreference**: `UPFRONT`, `ESCROW`, `UPON_COMPLETION`, `STREAM`
- **WorkMode**: `REMOTE`, `ONSITE`, `HYBRID`
- **JobStatus**: `PENDING`, `ACCEPTED`, `PAYMENT_CLAIMED`, `PAID`, `STREAMING`, `PAUSED`, `SUBMITTED`, `COMPLETED`, `CANCELLED`, `DISPUTED`, `REJECTED`
- **AgentStatus**: `PENDING`, `ACTIVE`, `SUSPENDED`, `BANNED`
- **ActivationTier**: `BASIC`, `PRO` (adding `WHALE` in spec 01)

---

## Agent Tier Configuration (current)

```
BASIC:  1 job offer per 2 days,  1 profile view per day,  no follower requirement
PRO:   15 job offers per day,   50 profile views per day, requires 1000+ followers
```

Activation paths: AUTO (first 100 free PRO), SOCIAL (post verification), PAYMENT (on-chain), ADMIN (manual).

---

## x402 Payment Protocol

Agents can bypass ALL tier limits by paying per-request via the x402 protocol:

- Profile view: $0.05
- Job offer: $0.25
- Listing post: $0.50
- Network: Base (eip155:8453)

Middleware chain: `ipRateLimiter → x402PaymentCheck → authenticateAgent → requireActiveOrPaid → handler`

This MUST be preserved in all features that touch rate limiting or gating.

---

## Common Pitfalls (from CLAUDE.md + experience)

1. **priceUnit mismatch**: Frontend sends `"per hour"`, backend expects `"HOURLY"`. The UNIT_MAP in `services.ts` transforms. Don't skip it.
2. **Education year fields**: Use `startYear` / `endYear`, not legacy `year` field.
3. **Languages format**: Stored as `"Language (Proficiency)"` strings, NOT ISO codes.
4. **Equipment format**: `"Category - Tool"` (e.g., `"Phone - iPhone 15"`) or just category.
5. **Prisma migrations**: `setup.sh` runs `prisma migrate dev` which may auto-generate conflicting `*_init` migrations. Delete and re-run.
6. **SPA + OG tags**: `react-helmet-async` tags are invisible to social crawlers. Pages needing OG previews need server-side injection in `backend/src/lib/seo.ts`.
7. **English-only pages**: `/dev/*`, `/dev/connect/*`, and `/prompt-to-completion` have no `/:lang` prefix.

---

## Session Completion Checklist

Before ending any session, verify:

- [ ] Feature branch created via `sh scripts/git-session.sh <name>`
- [ ] All code changes committed to the session branch (not master)
- [ ] `cd backend && npm run build` passes (no TypeScript errors)
- [ ] `cd backend && npm test` passes (all tests green)
- [ ] New test file(s) created per the spec's test section
- [ ] Dev Team Review Checklist walked through (all items checked)
- [ ] `cleanDatabase()` in `helpers.ts` updated if new models were added
- [ ] `shared/profile-schema.json` updated if new enums or fields were added
- [ ] No hardcoded secrets, no `.env` files committed
- [ ] `git status` shows clean working tree
- [ ] Branch NOT pushed to remote (human reviews first)
