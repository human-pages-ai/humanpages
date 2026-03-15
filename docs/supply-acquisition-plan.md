# Supply Acquisition Plan — Human Pages

**Created:** 06/03/2026
**Budget:** ~$2,000 out of pocket
**Goal:** ~3,000+ profiles with wallets, 50+ countries, every US state, top 30 Claude/AI countries covered

---

## Phase 1: Acquisition ($1,150)

### MTurk — US + India ($450)

**US:** Separate HIT per state (50 states + DC). Higher caps for CA, TX, NY, FL, IL, WA, MA, GA, NC, CO.

**India:** Single campaign, uncapped.

**Task:** Sign up at humanpages.ai, connect Google, connect Telegram, create wallet (Privy), add skills + location, list at least 1 service. Paste profile URL.

**Validation:** Auto-approve/reject via backend DB check. No screenshots. `AutoApprovalDelayInSeconds` set to 72 hours.

**Pay:** $0.50-$0.75/task (US/India workers expect higher $/hour)

**Expected:** ~700-1,000 profiles

### SproutGigs — High-wage countries ($400)

Target: UK, Germany, France, Canada, Australia, Japan, South Korea, Singapore, UAE, Netherlands, Sweden, Spain, Israel, New Zealand, Switzerland, Taiwan, Poland

**Pay:** $0.35-$0.50/task

**Expected:** ~800-1,000 profiles

### SproutGigs — Top 30 Claude countries minimum fill ($35)

4 workers minimum in each of the 24 countries not already covered by organic or above campaigns: UK, Japan, South Korea, Germany, France, Canada, Australia, Brazil, Israel, Singapore, Indonesia, Netherlands, Vietnam, Turkey, Pakistan, Sweden, Spain, Mexico, Poland, Taiwan, UAE, Argentina, New Zealand, Switzerland.

**Pay:** $0.35/task

**Expected:** 96 profiles (minimum geographic coverage)

### Telegram/WhatsApp — Emerging markets ($100)

Continue existing sponsored posts in Nigeria, Kenya, Ghana, Philippines, Thailand channels. These users sign up organically because they want gig work.

- Lagos Telegram: $27-$30/week (Jobnetworking, MJane)
- Other markets: $3-$15/week per channel

**Expected:** ~1,000+ profiles

### Platform fees + buffer ($165)

MTurk 20% fee + SproutGigs ~10% fee + rejection buffer (~5-10%).

---

## Phase 2: Testimonials via Human Pages jobs ($850)

Post real jobs on Human Pages. Your own agent hires users. Real USDC transactions, real on-chain receipts.

**Target: emerging market users only.** US/EU workers won't post from real social accounts for $1-$3. Nigerian/Filipino/Thai/Kenyan users will — and their content is more compelling anyway.

| Task | Pay | Workers | Cost |
|---|---|---|---|
| Record 30-sec video: "I'm [name] from [city], here's why I joined Human Pages" + post to TikTok/Reels/Shorts | $3 | 100 | $300 |
| Write genuine post about Human Pages on personal Twitter/Facebook/LinkedIn | $1 | 300 | $300 |
| Share Human Pages link on personal social with comment in local language | $0.50 | 500 | $250 |
| **Total** | | **900 tasks** | **$850** |

---

## Expected Outcomes

| Metric | Count |
|---|---|
| Total profiles on platform | ~3,000+ |
| Countries represented | 50+ |
| US states covered | 50 |
| Top 30 Claude/AI countries covered | 30/30 |
| Wallet activations (Privy) | ~3,000 |
| Completed jobs on platform | 900 |
| USDC payment volume | $850 |
| Video testimonials | 100 |
| Written social posts | 300 |
| Social shares | 500 |

---

## Implementation Notes

### MTurk auto-validation script

Runs every 5 minutes:
1. `ListAssignmentsForHIT` (status=Submitted)
2. Extract profile URL/ID from submission
3. Query Human Pages DB: Google connected? Telegram connected? Wallet created? Skills listed? Location set? 1+ service?
4. All pass -> `ApproveAssignment`
5. Any fail -> `RejectAssignment` with reason

### Tracking

- MTurk signups: `humanpages.ai/from/mturk?worker={{workerId}}`
- SproutGigs signups: `humanpages.ai/from/sproutgigs`
- Telegram: existing `/from/` slugs per channel

### Competitor context

| Platform | Employer fee | Worker fee | Supply | API | MCP |
|---|---|---|---|---|---|
| MTurk | 20-40% | 0% | 500K+ (US/India heavy) | Full AWS SDK | No |
| SproutGigs | $0.65/job + 10% | 7-20% withdrawal | Hundreds of thousands (global) | REST JSON | No |
| Microworkers | 7.5-10% + $0.75/campaign | 10% | ~2M (global) | REST | No |
| Human Pages | 0% | 0% | 437 (currently) | REST + MCP | Yes |

### Why emerging markets are organic, high-wage countries are paid

- Nigeria/Philippines/Kenya/Thailand: $0.50-$3 tasks are real income. People sign up willingly via Telegram. They'll post genuine testimonials from real social accounts.
- US/UK/Japan/EU: $0.30 is below acceptable $/hour. Won't sign up organically for a platform with no jobs yet. Will do MTurk task for the payout but won't produce authentic social content.

---

## Ads Analysis (saved for later)

Telegram ($0.10/signup) and MTurk ($0.33/signup) are cheaper per completed profile than ads due to conversion rate differences:

| Channel | Cost per click | Conversion to complete profile | Effective cost per signup |
|---|---|---|---|
| Telegram post | $0.03 | ~30% (they came for jobs) | $0.10 |
| MTurk task | $0.30 | ~90% (paid to complete) | $0.33 |
| Facebook Ad (Nigeria) | $0.10 | ~10% | $1.00 |
| TikTok Ad (Nigeria) | $0.05 | ~5% | $1.00 |

Ads only make sense after maxing out current channels.

---

## Budget Summary

| Phase | Cost |
|---|---|
| Acquisition (MTurk + SproutGigs + Telegram) | $1,150 |
| Testimonials (real jobs via Human Pages) | $850 |
| **Total** | **$2,000** |
