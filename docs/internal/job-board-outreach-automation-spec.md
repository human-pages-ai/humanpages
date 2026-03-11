# Job Board Outreach — Automation Spec v5

**Date:** 2026-03-11 | **Status:** Draft — awaiting team review

---

## Why This Exists

We have a CSV of ~15,000 job boards — website, admin email, country, field, language, draft email. The idea: contact them, negotiate partnerships where they promote HumanPages to their user base, and we pay them for it.

This spec covers everything the dev needs to build the automation pipeline. It's honest about what we know, what we're guessing, and what could go wrong.

---

## What We Tested (Research Summary)

Before building, we stress-tested every assumption in this plan. Here's what the data says.

### The Numbers We Wanted vs the Numbers We Got

| Assumption | What we hoped | What research says | Source |
|---|---|---|---|
| Reply rate (cold B2B email) | 5-10% | 1-5% (median ~3%) | Backlinko, Brevo, Woodpecker |
| % of replies that are positive | 50%+ | 30-40% | Woodpecker 2024 benchmark |
| Close rate (interested → deal signed) | 15-25% | 5-15% | HubSpot B2B sales funnel data |
| Board accepts $15-50 for email blast | Most will | Unknown — no precedent | Newsletter sponsorships start at $150+ for 5K lists |
| Avg active list size | 15-25K | 1-5K active (lists decay 22-30%/yr) | ZeroBounce, MailerLite |
| Partner activation (actually sends blast) | 60%+ | 30-50% | Affiliate marketing activation benchmarks |
| Email blast → verified signup conversion | 0.1-3% | 0.01-0.3% (median 0.11%) | MarketingSherpa, Brevo |
| Users find jobs within 30 days | Yes | No — Q2 target is 100-300 jobs/mo total | Our own GTM doc |

### Simulation Results

Using research-backed inputs across three scenarios:

| | Pessimistic | Realistic | Optimistic |
|---|---|---|---|
| Deliverable emails (after filtering) | 10,500 | 10,500 | 10,500 |
| Reply rate | 1.5% | 3% | 5% |
| Replies | 157 | 315 | 525 |
| Positive / interested | 47 | 126 | 262 |
| Developing-market deals closed | 2 | 11 | 39 |
| Developed-market deals closed | 0 | 5 | 15 |
| Partners who actually send blast | 0 | 8 | 34 |
| People reached by blasts | 3K | 47K | 204K |
| Blast → signup conversion | 0.05% | 0.10% | 0.30% |
| **Total signups** | **1** | **47** | **614** |
| Total cost | $30 | $170 | $644 |
| Cost per signup | $20.00 | $3.58 | $1.05 |

### What This Means

The realistic outcome of this channel is **15-55 deals and 50-600 signups for $200-$700**. Not 5M signups for $20K.

**Context from our other channels:** Telegram in Lagos already converts at ~$0.08/signup. University bounties may be even cheaper. So the real question isn't "is this channel good?" — it's "is this channel better than what we already have?"

At $1-4/signup, the answer is no. But at scale, if Phase 1 shows boards accept $15-50 flat and 50%+ actually send the blast, the CPA could drop to $0.30-0.80 — competitive with Telegram. And the infrastructure (enrichment, tracking slugs, inbox monitor, negotiation bot) is reusable for any partnership outreach.

The mistake would be building a massive system for 2,000+ deals when we're likely to see 15-55. Build lean, validate fast, kill it if the CPA doesn't compete with $0.08.

### The Deeper Problem: Supply Side

Even if we 10x the optimistic scenario, we have a value delivery problem:

- **Q2 job supply:** 100-300 jobs/month from 20-50 AI agents
- **Users this supports:** ~200-500 active users getting work
- **What happens at 1,000+ signups:** Most users see zero jobs, churn in 14 days, and tell their network it's a scam
- **The metric that matters:** Jobs per active user per month. Below 0.5, users churn. We're currently at ~0.1.

This isn't a reason to skip the channel. It's a reason to **sequence it** — don't pour users in until there's something for them to do.

---

## Strategy: Three Phases, Not One Big Bang

Instead of building the full 8-task pipeline and blasting 15K boards, we phase it:

### Phase 1: Manual Validation (Week 1-2)

**Goal:** Test whether boards will actually respond and close at our price points.

- Hand-pick 50 developing-market boards from the CSV (Nigeria, India, Philippines — our strongest regions)
- Send personalized emails manually (or via Instantly, but no bot, no automation)
- Test pricing: start at $50-150 per blast (closer to market rate) and work down to see the floor
- Target: 3-5 deals closed
- Measure everything: reply rate, close rate, what pricing they accept, whether they actually send the blast, signup conversion

**Build requirement: Tasks 1-3 only** (CSV import, enrichment, slugs to DB).

**Decision gate:** If we close 3+ deals AND at least 1 partner actually sends a blast AND the CPA is under $0.50/signup → proceed to Phase 2. If CPA is $0.50-$2, consider whether the volume justifies the cost vs Telegram ($0.08/signup). If CPA is >$2, kill this channel and redirect to proven channels.

### Phase 2: Small-Batch Automation (Week 3-6)

**Goal:** Automate what worked in Phase 1 with a 500-board batch.

- Use the winning pitch + pricing from Phase 1
- Build email template engine (Task 4)
- Send to 500 boards via Instantly (top-scored from enrichment)
- Build inbox monitor (Task 5) to catch replies
- Respond manually at first — the bot comes later
- Target: 15-25 deals
- Measure: does the pricing that worked in manual outreach hold at scale?

**Build requirement: Tasks 4-5.**

**Decision gate:** If reply rate holds at 2%+ AND close rate is 5%+ AND signups are flowing → proceed to Phase 3. Also: check jobs-per-user ratio. If new signups are churning because there are no jobs, **stop scaling signups and focus on agent integrations.**

### Phase 3: Full Automation (Week 7-12)

**Goal:** Scale to 5,000+ boards with the AI negotiation bot.

- Build the dual-mode negotiation bot (Task 6) — now you have real conversation data to train it on
- Build partner onboarding (Task 7) with activation nudges
- Scale to remaining boards
- Target: 50-200 deals

**Build requirement: Tasks 6-7.**

**Why Phase 3 last:** Building an AI negotiation bot before you have 20+ real negotiations to learn from is building blind. Phase 1 and 2 give you the training data.

---

## Two-Track Strategy: Developing vs Developed Markets

The 15K boards split into two fundamentally different negotiations. The bot needs a `market` parameter that changes its entire approach.

| | Developing Markets | Developed Markets |
|---|---|---|
| **Countries** | Nigeria, Ghana, Kenya, India, Philippines, Thailand, Brazil, Mexico, Indonesia, Vietnam, South Asia, MENA, Eastern Europe | USA, UK, Canada, Australia, EU, Japan |
| **Est. count in CSV** | ~8,000-10,000 boards | ~5,000-7,000 boards |
| **Board economics** | Low or zero revenue. Any income is welcome. | Some revenue, more selective about partners. |
| **Our offer** | Flat fee for email blast. Start at $50-100 in Phase 1 (validate the floor). In Phase 2+, go as low as deals allow. | Per-signup ($0.15-$1.50) or flat monthly ($50-$200). |
| **Why they accept** | Real income for zero-effort work (forward an email). | Traffic monetization is familiar. Partnership framing. |
| **Bot mode** | Aggressive. Close fast. 3 replies max. | Standard negotiation. 5 replies max. Frame as "trial." |

**Critical pricing note:** Our original plan assumed $15-50 flat fees. Research shows newsletter sponsorships start at $150+ even for small lists. Phase 1 must test whether boards will accept lower. They might — these aren't newsletters, they're stale job boards. But we don't know yet. Don't hardcode pricing assumptions until Phase 1 data is in.

---

## Business Context

**What is HumanPages:** A marketplace where AI agents hire real humans for tasks — photography, errands, research, translation, local services. Payment in USDC with fiat offramps (PayPal, Wise, MercadoPago).

**Pitch to boards:** "Your users can earn real income from AI agents. No interview, no fees. We'll pay you to promote us."

**For developing markets specifically:** Lead with concrete earning potential. "Tasks pay $5-$50 in USD. Your users just need a phone and a verified profile."

**Sending infrastructure:** Instantly.ai (or similar) for warm-up, throttling, bounce tracking, scheduling, A/B testing, follow-up sequences. No custom email infra.

**What we build:** Lead scoring with market classification, email template engine, inbox monitoring, and eventually an AI negotiation bot with two modes. Phased — not all at once.

---

## The Pipeline

```
CSV → [Import] → DB → [Enrich + Classify Market] → [Score/Tier] → [Upload to Instantly]
                                                                         ↓
                                                        sends emails (3-step sequence)
                                                                         ↓
                                          replies land in inbox ← ← ← ← ←
                                                                         ↓
                                          [Inbox Monitor] → classify reply
                                                                         ↓
                                          Phase 1-2: human responds
                                          Phase 3:   [AI Bot] responds (developing or developed mode)
                                                                         ↓
                                          deal agreed → [Onboarding] → tracking slug + creative kit
                                                                         ↓
                                          partner sends blast → signups flow in → track + pay
```

---

## Task 1: CSV Import (Phase 1)

Adapt `import-leads-csv.ts`. Map fields into `InfluencerLead`:

| CSV Column | DB Field | Notes |
|---|---|---|
| website | `contactUrl` | |
| email of admin | `email` | |
| country | `country` | |
| specified field | `focusAreas` | |
| language | `language` | |
| personalized email | `outreachMessage` | |
| — | `list` | hardcode `"job-boards"` |
| — | `source` | `CSV_IMPORT` |
| — | `dedupeKey` | normalize domain: lowercase, strip `www.`, strip trailing `/`, strip protocol |

Store enrichment data in `notes` as JSON. This field becomes a grab-bag for anything we learn about the board.

**Edge cases:**
- Duplicate domains with different emails → keep both, dedupe on domain+email pair
- Missing country → try to infer from TLD (.ng, .in, .ph), else mark `UNKNOWN`
- Missing email → mark as `SKIP` (can't contact)

---

## Task 2: Enrichment + Market Classification (Phase 1)

Two jobs: (1) validate whether the board is alive and contactable, (2) classify developing vs developed market.

### Pre-send checks (run on all 15K)

```typescript
interface EnrichmentResult {
  domainAlive: boolean;      // HTTP HEAD → 200/301/302 = alive
  emailValid: boolean;       // MX record exists + email verification API
  isCompetitor: boolean;     // domain in blocklist
  isGovernment: boolean;     // .gov, .go.*, .mil
  market: 'developing' | 'developed';
  country: string;
  field: string;
}
```

**Competitor blocklist:** indeed.com, linkedin.com, glassdoor.com, ziprecruiter.com, monster.com, careerbuilder.com, snagajob.com, rentahuman.ai, and any site already in our `FROM_SLUGS` map.

### Market classification

```typescript
const DEVELOPING_MARKETS = [
  'NG', 'GH', 'KE', 'ZA', 'TZ', 'UG', 'ET', 'SN', 'CM',  // Africa
  'IN', 'BD', 'PK', 'LK', 'NP',                              // South Asia
  'PH', 'TH', 'VN', 'ID', 'MY', 'MM', 'KH', 'LA',          // SE Asia
  'BR', 'MX', 'CO', 'AR', 'PE', 'CL', 'VE', 'EC',          // Latin America
  'EG', 'MA', 'TN', 'JO',                                     // MENA
  'UA', 'RO', 'BG', 'RS',                                     // Eastern Europe
];
// Everything else = developed
```

### Scoring (4 factors)

| Factor | Points | Logic |
|---|---|---|
| Domain alive + email valid | 30 | Both = 30, domain only = 10, email only = 5, neither = 0 |
| Developing market | 30 | Developing = 30, developed = 15 |
| Priority country | 20 | NG, IN, PH, KE, GH, TH = 20 (markets where we have existing presence), other = 5 |
| Field match | 20 | gig/freelance/remote/general/labor = 20, other = 10 |

**Why developing markets score higher:** They're the primary target for Phase 1 validation. We have existing presence in Nigeria/Kenya/Philippines/Thailand, the boards are cheaper to close, and the user bases are in our target regions.

### Tiering

| Tier | Score | Expected count | Action |
|---|---|---|---|
| 1 | 80-100 | ~2,000 | Developing-market boards in priority countries with valid domains. Phase 1 picks from here. |
| 2 | 50-79 | ~5,000 | Mix of markets. Phase 2 batch. |
| 3 | 25-49 | ~4,000 | Lower-priority. Phase 3 or skip. English only. |
| SKIP | <25 | ~4,000 | Dead domains, bounced emails, competitors, government sites. Don't contact. |

### Post-reply enrichment (Phase 2+)

When someone replies, THEN learn more about them:
- Ask list size directly: "How many active users/subscribers does {board_name} have?"
- Check SimilarWeb/traffic estimate if available
- This determines what offer to make — don't waste API calls on the 95%+ who never reply

---

## Task 3: Move `FROM_SLUGS` to DB (Phase 1 — parallel with Tasks 1-2)

Currently hardcoded in `backend/src/app.ts` line 279. Move to a DB table so we can auto-create tracking slugs per partner without deploys.

```typescript
model TrackingSlug {
  slug        String   @id           // e.g. "board-nursingjobs-ng"
  utmSource   String                 // e.g. "job-board"
  utmMedium   String                 // e.g. "referral"
  utmCampaign String                 // e.g. "nursingjobs-ng"
  partnerId   String?               // link to InfluencerLead.id
  createdAt   DateTime @default(now())
}
```

**Migration steps:**
1. Add `TrackingSlug` model to `schema.prisma`
2. Run `npx prisma migrate dev --name add-tracking-slug`
3. Seed table with existing `FROM_SLUGS` entries
4. Update `app.ts` to query this table instead of the hardcoded map
5. Keep the hardcoded map as fallback during transition (read from DB first, fall back to map)

---

## Task 4: Email Template Engine (Phase 2)

Takes a lead + tier + market → outputs a ready-to-send email.

```typescript
interface EmailInput {
  lead: InfluencerLead;
  tier: 1 | 2 | 3;
  market: 'developing' | 'developed';
}

interface EmailOutput {
  subject: string;
  body: string;
  language: string;
}
```

### Template logic by market

| | Developing Market | Developed Market |
|---|---|---|
| **Pitch angle** | "Your users can earn real USD income from AI agents. We'll pay you to promote us." | "The AI economy is creating new work categories. Partner with us to monetize your traffic." |
| **Offer structure** | Flat fee for email blast. "We'll pay you $X to send one email to your users." | Per-signup. "$0.15-$0.30 per verified signup." |
| **Opening offer** | Use pricing validated in Phase 1 (test range: $50-150, adjust based on what closes) | $0.15/signup |
| **CTA** | "Reply 'yes' and I'll send you the email template + payment details" | "Reply with your preferred promotion format" |
| **Tone** | Direct, simple, no jargon. Short sentences. | Professional, partnership-focused. |

**Language:** For non-English leads in Tier 1 & 2, translate via LLM. Tier 3 = English only.

**Output format:** CSV for Instantly bulk import (columns: email, first_name, subject, body, custom variables).

### Follow-up sequence (configured in Instantly)

| Step | Timing | Content |
|---|---|---|
| Email 1 | Day 0 | Full pitch with market-appropriate offer |
| Email 2 | Day 5 (no reply) | Short bump. Developing: "Just $X for one email to your users — interested?" Developed: "Following up on my partnership note — would love to chat." |
| Email 3 | Day 12 (no reply) | Breakup. "Won't follow up again. If timing changes, reply anytime." |

### A/B testing (in Instantly)

Test on first 20% of sends, auto-send winner to rest:

| Test | Variant A | Variant B |
|---|---|---|
| Subject | "Partnership idea for {{board_name}}" | "Earn $X promoting AI jobs to your users" |
| Offer | Flat fee | Per-signup |
| CTA | "Reply yes" | "Jump on a quick call" |

---

## Task 5: Inbox Monitor + Reply Classifier (Phase 2)

Poll the Instantly inbox (or connected email via IMAP) for replies. Match to leads by sender email.

### Classification (LLM call per reply)

```typescript
type ReplyClass =
  | 'INTERESTED'       // wants to proceed
  | 'NEGOTIATING'      // wants different terms
  | 'QUESTION'         // asking about HumanPages, legitimacy, etc.
  | 'NOT_INTERESTED'   // explicit pass
  | 'OUT_OF_OFFICE'    // auto-reply
  | 'SPAM'             // irrelevant or automated
  | 'NEEDS_HUMAN';     // complex, legal, angry, or bot confidence < 70%
```

Save classification + full reply text to DB. Update lead status.

**Polling cadence:** Every 5 minutes.

**Important for Phase 2:** The classifier runs, but humans respond (not the bot). The classifier just routes and prioritizes. The bot comes in Phase 3.

---

## Task 6: AI Negotiation Bot (Phase 3 — after real conversation data exists)

LLM-powered email responder with **two negotiation modes** based on market classification.

**Why Phase 3:** Building this before you have 20+ real negotiations means guessing at what objections come up, what pricing works, and what tone closes. Phase 1-2 conversations become the training data. Don't build blind.

### Mode 1: Developing Markets (aggressive, close fast)

```
You are Alex from HumanPages Partnerships. You're negotiating with
{board_name} ({website}), a {field} job board in {country} (developing market).

GOAL: Get them to send ONE email blast to their user list promoting HumanPages.
We pay a flat fee. Close fast.

CONTEXT: You have data from {deal_count} previous deals. Average close price: ${avg_price}.
The partner's list size is {list_size} (if known — ask if unknown).

DEVELOPING MARKET RULES:
- Offer a one-time flat fee for an email blast to their list
  * Pricing tiers (adjust based on Phase 1 data):
    Small board (<5K users): ${small_board_price}
    Medium board (5-20K users): ${medium_board_price}
    Large board (20K+ users): ${large_board_price}
  * If unsure of size: start at ${default_price}, ask how many users they have
- If they want more: go up in small increments, max ${max_blast_price} for one blast
- For ongoing partnerships: ${monthly_low}-${monthly_high}/month for a permanent banner + quarterly email
- ALWAYS push for email blast over banner — blasts convert 10-20x better
- Ask their list size early: "How many active users/subscribers does {board_name} have?"
- Payment: PayPal, Wise, or USDC — their choice
- Close FAST. Don't overthink. If they say yes, close immediately.
- Frame it: "We pay you $X, you send one email, your users get access to AI-powered jobs that pay in USD"

HARD LIMITS:
- One-time blast: ${min_blast_price} - ${max_blast_price}
- Monthly ongoing: ${monthly_low} - ${monthly_high}
- NEVER agree to exclusivity
- NEVER promise signup numbers or earnings to their users
- Max 3 bot replies. Close or escalate.
- Tone: friendly, direct, no corporate jargon. Short sentences.
```

**Note:** The `${}` variables are filled from a config that gets updated after Phase 1 data. Don't hardcode dollar amounts.

### Mode 2: Developed Markets (standard negotiation)

```
You are Alex from HumanPages Partnerships. You're negotiating with
{board_name} ({website}), a {field} job board in {country} (developed market).

DEVELOPED MARKET RULES:
- Default offer: per-signup pricing
  * Start at $0.15/verified signup
  * Can go up to $0.50/signup if they push
  * For high-traffic boards: offer rev share (1-5%) instead of raising per-signup rate
- Alternative: flat monthly fee if they prefer
  * Start at $50/month
  * Can go up to $200/month
- Default: 3-month trial
- Payment: USDC, PayPal, or Wise
- Counter tactics: if they want more money, offer rev share or performance tiers instead of more $/signup

HARD LIMITS:
- Per-signup: $0.10 - $1.50
- Flat monthly: $10 - $200
- Rev share: 1% - 5%
- Duration: 1-12 months (default 3-month trial)
- NEVER agree to exclusivity
- Max 5 bot replies. Then escalate.
```

### Bot actions by reply classification

| Class | Developing Market | Developed Market |
|---|---|---|
| `INTERESTED` | Send pre-written email template they can blast + payment details. Ask list size if unknown. Close in next reply. | Send partnership summary, tracking link info, ask promo format preference. |
| `NEGOTIATING` | Go up incrementally. "How about $X?" If still no: "What number works for you?" | Counter within guardrails. Offer rev share instead of more $/signup. |
| `QUESTION` | Simple answers. "HumanPages connects AI agents with real people for tasks. Your users can earn real USD. Here's our site: humanpages.ai" | Detailed FAQ. Link to site, explain payments, mention existing partners if any. |
| `NOT_INTERESTED` | "No worries! If you change your mind, just reply." Mark REJECTED. | Same. |
| `NEEDS_HUMAN` | Flag + notify team immediately. | Flag + notify team. |

### Sending behavior

- Developing markets: respond within 1-2 hours (faster = more closes)
- Developed markets: respond within 2-4 hours
- Never respond 11pm-7am in the board's timezone
- CC monitoring inbox on every bot-sent email
- Include an easy "talk to a human" escape hatch in every bot email

---

## Task 7: Partner Onboarding (Phase 2 for manual, Phase 3 for automated)

### Deal-close flow

```
Path A (Bot closes — Phase 3):
  Bot detects agreement ("yes", "ok let's do it", "send payment details", etc.)
  → Bot confirms: "Great — $X flat for one email blast to your list. PayPal to {email}. Correct?"
  → Partner confirms
  → Status = PENDING_REVIEW
  → Team gets notified (you choose how — Slack, email, admin panel, webhook)
  → Team approves → Status = AGREED → onboarding triggers

Path B (Human closes — Phase 1-2):
  Human negotiates → manually sets AGREED when terms are confirmed
```

**Approval method is up to you.** Whatever fits the stack. The spec doesn't prescribe this.

### When status = AGREED, auto-trigger:

1. Auto-generate tracking slug → insert into `TrackingSlug` table
2. Send onboarding email with:
   - **For developing markets:** Pre-written email they can copy-paste to blast their list. Make it dead simple — they literally just forward it. Include the tracking link embedded in the email body. Payment instructions (PayPal/Wise/USDC).
   - **For developed markets:** Tracking link, creative assets (banners in 3 sizes, sample email copy, landing page text), payment setup.
3. Create partner record with agreed terms (price, type, duration)

### Activation nudge (critical)

Follow up 3 days after onboarding: "Did you send the email yet?"

Research shows 30-50% of partners who agree never actually send the blast. This nudge is the difference between a deal on paper and actual signups. Send it automatically. If no response after 7 days, flag for human follow-up.

### The pre-written blast email (for developing markets)

This is what the partner forwards to their list. It should be:
- Short (under 150 words)
- Mobile-friendly (most developing-market users read on phones)
- One clear CTA: "Sign up free at [tracking link]"
- No corporate language. Write it like a friend telling you about a side hustle.
- Translated into partner's language if not English

Example structure:
```
Subject: New way to earn USD with your phone

Hey [board_name] community,

We partnered with HumanPages — a platform where AI companies pay real people for tasks like photography, research, delivery, and translation.

It's free to sign up. No interview. Payment in USD via PayPal, Wise, or crypto.

People are already earning $5-$50 per task.

Sign up here: [tracking_link]

— [board_name] team
```

---

## Task 8 (Later): Partner Dashboard

Simple read-only page. Magic link auth. Shows: signups referred, jobs completed by referrals, earnings accrued, next payout.

**Build AFTER 10+ active partners.** Before that, update partners manually via email.

---

## Build Order

| Phase | Tasks | What's built | Decision gate |
|---|---|---|---|
| **Phase 1** (Week 1-2) | Tasks 1, 2, 3 | CSV import, enrichment + scoring, TrackingSlug table | ≥3 deals closed AND ≥1 blast sent AND ≥10 signups |
| **Phase 2** (Week 3-6) | Tasks 4, 5, 7 (manual) | Email templates, inbox monitor, manual onboarding | Reply rate ≥2% AND close rate ≥5% AND jobs-per-user ratio checked |
| **Phase 3** (Week 7-12) | Tasks 6, 7 (automated) | AI negotiation bot, automated onboarding + nudges | Phase 2 metrics hold at 500-board scale |
| **Later** | Task 8 | Partner dashboard | 10+ active partners |

**Parallel with all phases:** Task 3 (FROM_SLUGS to DB) can start immediately and runs independently.

---

## Negotiation Quick Reference

### Developing Markets

**Phase 1 test range:** $50-150 per blast. Find the floor.

**Phase 2+ (once we know the floor):**

| Board size | One-time blast fee | Monthly ongoing |
|---|---|---|
| <5K users | $Floor - $Floor×1.5 | Negotiate based on Phase 1 |
| 5-20K users | $Floor×1.5 - $Floor×2.5 | Negotiate |
| 20K+ users | $Floor×2.5 - $Floor×4 | Negotiate |

**Bot behavior:** 3 replies max. Start at the floor price. Go up in small increments. Always push for email blast over banner. Ask list size. Close within 2 exchanges if possible.

### Developed Markets

| | Opening | Ceiling | Counter tactic |
|---|---|---|---|
| Per-signup | $0.15 | $1.50 | Offer rev share instead of raising rate |
| Flat monthly | $50 | $200 | Offer 3-month trial to reduce perceived risk |
| Rev share | 2% | 5% | Only for high-traffic Tier 1 |

**Bot behavior:** 5 replies max. Standard negotiation. Frame everything as "trial" and "partnership."

---

## Risks and Mitigations

### Risk 1: Users sign up but there are no jobs

**Severity: Critical.** This is the biggest risk in the plan. If 500 people sign up from a partner blast and zero of them find a job within 2 weeks, we've burned that entire community's trust.

**Mitigation:**
- Track `jobs_per_active_user_per_month`. Below 0.5 → pause outreach scaling, focus on agent integrations.
- Sequence outreach with agent-side GTM. Don't scale human supply ahead of demand.
- In the onboarding email to users, set honest expectations: "Tasks are posted by AI agents. Volume is growing — early users get priority access."
- Consider a waitlist model if job supply can't keep up.
- The "default humans" arbitrage (staff subcontracting to Fiverr/TaskRabbit) can absorb some demand but only at ~10-30 jobs/month.

### Risk 2: Pricing floor is higher than expected

**Severity: Medium.** If no board accepts under $150, the developing-market volume play doesn't work at our budget.

**Mitigation:** Phase 1 tests this explicitly. If the floor is $150+, pivot to per-signup model for all markets (cheaper for us if conversion is low). Or pivot to Telegram/WhatsApp channels where we're already getting $0.30/signup.

### Risk 3: Partners agree but never send the blast

**Severity: Medium.** Research suggests 30-50% activation rate.

**Mitigation:** 3-day nudge email. 7-day human follow-up. For developing markets, make the blast email so simple they literally just forward it. Consider paying 50% upfront, 50% after blast is confirmed sent (tracking link gets first click).

### Risk 4: Legal compliance

**Severity: Medium-High.** Third-party email blasts can violate CAN-SPAM, GDPR, Nigeria NDPA, Brazil LGPD.

**Mitigation:**
- The partner is the sender, not us. We're paying for promotion, like a newsletter sponsorship.
- Ensure the blast email includes an unsubscribe link.
- We are NOT buying or receiving their email list. The partner sends to their own list.
- Keep records of partner consent for compliance.
- Separate sending domain for our outreach (not humanpages.ai).

### Risk 5: Email deliverability

**Severity: Medium.** 10,500 cold emails across multiple weeks. Risk of domain/IP blacklisting.

**Mitigation:**
- Use Instantly.ai (or similar) — they handle warm-up, throttling, rotation across multiple domains/IPs
- Separate sending domain (e.g., `humanpages-partners.com`)
- Start slow: 50/day Week 1, ramp to 200/day by Week 3
- Monitor bounce rate. Above 5% → pause and clean list.
- Unsubscribe link + physical address in every email (RFC 8058 one-click unsubscribe header)

---

## Success Metrics (Honest)

### Phase 1 (Week 1-2)

| Metric | Target | "Stop and rethink" threshold |
|---|---|---|
| Emails sent (manual) | 50 | — |
| Reply rate | ≥5% (2-3 replies) | <2% (0-1 replies) |
| Deals closed | ≥3 | 0 |
| Blasts actually sent | ≥1 | 0 |
| Signups from blasts | ≥10 | 0 |
| Lowest accepted price | Record this — it's the most important data point | — |

### Phase 2 (Week 3-6)

| Metric | Target | "Stop and rethink" threshold |
|---|---|---|
| Emails sent | 500 | — |
| Reply rate | ≥3% (15+ replies) | <1.5% |
| Deals closed | ≥15 | <5 |
| Partner activation rate | ≥50% | <25% |
| Signups | ≥50 | <10 |
| Cost per signup | <$0.50 (competitive with TG $0.08) | >$2 (kill channel — Telegram is 25x cheaper) |
| Jobs-per-user ratio | ≥0.3 | <0.1 (pause ALL user acquisition, not just this channel) |

### Phase 3 (Week 7-12)

| Metric | Target | "Stop and rethink" threshold |
|---|---|---|
| Emails sent | 5,000+ | — |
| Deals closed | ≥50 | <20 |
| Partner activation | ≥50% | <30% |
| Total signups | ≥200 | <50 |
| Bot close rate (vs human) | Track for comparison | — |
| Cost per signup | <$0.50 | >$1 (losing to Telegram/university channels) |

---

## Compliance Checklist

- [ ] Separate sending domain (not humanpages.ai)
- [ ] Unsubscribe link in every outreach email
- [ ] Physical address in footer
- [ ] One-click unsubscribe header (RFC 8058)
- [ ] Auto-remove on hard bounce
- [ ] Respect opt-outs within 24 hours
- [ ] Blocklist: competitors, .gov, .mil, .edu
- [ ] Partner blast email includes unsubscribe
- [ ] We never receive or store partner email lists
- [ ] Payment records for all partner deals (tax/compliance)

---

## Appendix A: What If This Channel Underperforms?

If Phase 1 fails (0 deals, or boards only accept $150+ and activation is <25%), redirect the engineering effort to:

1. **Telegram/WhatsApp outreach automation** — Lagos channels convert at $0.08/signup. The inbox monitor + bot infrastructure built here works for automating Telegram partnership outreach too.
2. **University bounty campaigns** — Even cheaper than Telegram. The tracking slug + onboarding infrastructure transfers directly.
3. **Direct partnership outreach** — Skip mass emailing. Hand-pick 20 high-value boards, offer them real money ($200-500), and negotiate properly.

The infrastructure built in Phase 1 (CSV import, enrichment, tracking slugs) is useful regardless. Nothing is wasted.

## Appendix B: Channel CPA Benchmarks (for decision gates)

These are our actual numbers from other channels. This channel needs to compete.

| Channel | CPA (cost per verified signup) | Status |
|---|---|---|
| Telegram Lagos (sponsored posts) | ~$0.08 | Running, proven |
| University bounties | TBD (expected < $0.08) | Planned |
| Affiliate program (emerging markets) | ~$1.00-$1.50 | Running |
| Newsletter ads (Phase 1 test) | ~$2-5 | Testing |
| **Job board outreach (this channel)** | **$0.30-$4.00 (projected)** | **Needs Phase 1 validation** |

If this channel lands above $1/signup, it's a worse use of budget than Telegram or affiliates. The only justification at higher CPA would be if the user quality is meaningfully better (more likely to complete jobs, higher retention). Track this.
