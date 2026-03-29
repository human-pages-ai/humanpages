# War Room: TG Bot Onboarding Flow for HumanPages

## Plan Debated
Build a Telegram-based onboarding flow for freelancers recruited via TG ads in developing markets. Original proposal: hybrid model (basics in TG bot, complex steps via web wizard link). Debated by 6 agents across 2 rounds.

## Roles
- **Devil's Advocate** — attacked context-switching friction
- **Plan Champion** — defended pragmatic hybrid approach
- **User/Customer Advocate** — represented developing-market freelancers
- **Execution Realist** — assessed buildability and timeline
- **UX Researcher** — analyzed completion funnel and usability
- **Growth Strategist** — evaluated acquisition and activation mechanics

---

## Verdict: GO WITH CHANGES

---

## Key Issues (ranked by severity)

### 1. Backend Draft Persistence Required — BLOCKING
TG form inputs currently lost on context switch; localStorage-only drafts evaporate on browser close/device restart. Without backend persistence, the handoff psychology fails ("Where did my data go?").
- **Flagged by**: UX Researcher, Execution Realist, User Advocate, Devil's Advocate
- **Cost**: +3-4 days (straightforward: new `TelegramDraft` table + CRUD endpoint)
- **Status**: All agents converged — this is non-negotiable for v1

### 2. Bot→Web Handoff Churn (60-75%) — SERIOUS
Context-switching tax; users drop off after TG step, never reach web wizard.
- **Flagged by**: Devil's Advocate, Growth Strategist, User Advocate
- **Resolution**: Partially solved by emergent "Minimum Matchable Profile" concept (see Revised Plan)

### 3. Matching Quality on 30% Complete Profiles — SERIOUS
TG-only profiles (name + skills + location) produce shallow matches; first job notification may be poor-fit.
- **Flagged by**: Growth Strategist, UX Researcher
- **Mitigation**: Tune matching for low-signal profiles; first notification must be high-precision

### 4. Web Wizard Conditional Logic Breakage — SERIOUS
Existing wizard has conditional branching; naive pre-fill from TG data may break existing flows.
- **Flagged by**: Execution Realist
- **Mitigation**: Map conditionals explicitly, add test coverage on all branches

### 5. Trust & Legitimacy on Handoff — MINOR
Users in developing markets may distrust "TG bot → external website" pattern.
- **Flagged by**: User Advocate
- **Mitigation**: Consistent branding, explicit "Your data is saved" messaging, progress indicators

---

## Points of Consensus

1. Backend draft persistence is mandatory for Phase 1
2. "Minimum Matchable Profile" inverts motivation — job notification triggers profile completion, not the inverse
3. Hybrid architecture (TG + web) is pragmatically sound — no role argued for pure in-bot wizard
4. Execution is feasible in 2-2.5 weeks (v1)
5. Matching quality is the long pole — requires post-launch tuning

---

## Key Emergent Concept: Minimum Matchable Profile

The debate produced a powerful reframe that all agents rallied around:

**Instead of**: "Basics in TG, complex on web" (original hybrid)
**Reframe to**: "Enough to be matchable in TG, everything else AFTER first job notification"

**The flow becomes:**
1. User sees ad in TG → taps "Start earning" → bot opens
2. Bot collects: **name, skills (button selection), location** → user is LISTED
3. Matching engine runs on this minimal profile
4. When a match arrives, TG bot notifies: "You have a job match! Complete your profile to accept"
5. User clicks link → web wizard (pre-filled) → completes remaining steps → accepts job

**Why this works:** Users see value (job match) BEFORE investing in the full wizard. Completion is motivated by an actual opportunity, not a vague promise.

---

## Revised Plan

### Phase 1 (v1): Minimum Matchable Profile — 2-2.5 weeks

**Workstream 1: TG Bot State Machine + Draft Persistence (5-7 days)**
- Collect: name, skills (top 20 categories via buttons), location
- New `TelegramDraft` table (userId, step, draftData JSON, timestamps)
- Endpoints: `POST /api/telegram/drafts`, `GET /api/telegram/drafts/:userId`
- Handoff link includes `?draft_id=<uuid>`

**Workstream 2: Deep Linking + Web Pre-Fill (2-3 days)**
- Web wizard receives `?draft_id`, calls draft API on mount
- Pre-filled fields marked with UI indicator ("From Telegram")
- User can revise or skip TG-collected steps

**Workstream 3: Conditional Logic Mapping (2 days)**
- Document wizard branching in `shared/profile-schema.json`
- Test coverage: TG draft + all conditional branches

**Workstream 4: Matching Engine for Low-Signal Profiles (2-3 days)**
- Define acceptable match quality at 30% completeness
- Acceptance criteria: first notification within 48-72 hours

**Workstream 5: Trust & Handoff Messaging (1 day)**
- Bot: "Your skills are saved! Complete your profile to start receiving jobs: [link]"
- Web: progress indicator showing what's done vs remaining

**Workstream 6: Minimum Profile = Visible in Job Feed (1-2 days)**
- Users with name + skills + location appear in matching
- First notification triggers on match quality threshold

### Phase 2 (post-v1 metrics): Wallet, Photo, Verification
- Move payment setup to after first job match
- Photo upload via TG camera
- Verification gated to job acceptance, not profile completion

---

## Dissenting Opinion
None survived scrutiny. Devil's Advocate softened after "Minimum Matchable Profile" reframe. All concerns were absorbed into the plan as explicit risks with mitigations.

---

*Generated: March 20, 2026*
