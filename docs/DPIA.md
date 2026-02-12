# Data Protection Impact Assessment (DPIA)

**Project:** Human Pages (humanpages.ai)
**Date:** February 9, 2026
**Owner:** Human Pages Team
**Status:** Active

---

## 1. Overview

Human Pages is a discovery platform that connects AI agents with real people for task execution. This DPIA covers the processing of personal data through the platform's public API, which allows AI agents to search for, view, and interact with human profiles.

## 2. Processing Activities Assessed

### 2.1 Agent API Profile Search

**Description:** AI agents (registered or anonymous) can search the human directory via `GET /api/humans/search` to find people with specific skills, locations, and availability.

**Data Processed:**
- Name, username, bio
- Location (city/neighborhood level; precise coordinates used server-side for radius filtering only, never exposed in responses)
- Skills, equipment, languages, availability
- Rates and payment preferences
- Social profile links (LinkedIn, Twitter/X, GitHub, Instagram, YouTube, website)
- Wallet addresses (for payment)
- Humanity verification status and score
- Contact info (email, Telegram, WhatsApp, Signal) — hidden by default via `hideContact` flag
- Services offered (title, description, pricing)

**Volume:** All users with verified email addresses (potentially thousands of profiles)

**Recipients:** Any party with API access (registered agents with API keys, or anonymous searches subject to rate limiting)

### 2.2 Agent API Profile View

**Description:** Individual profiles can be viewed via `GET /api/humans/:id`.

**Data Processed:** Same fields as search results.

### 2.3 Job Offer Creation

**Description:** Registered agents can send job offers to humans via `POST /api/jobs`.

**Data Processed:** Human ID, job title, description, price, agent identity. Upon acceptance, contact details are shared with the agent via webhook callback.

### 2.4 PostHog Analytics

**Description:** Usage events are tracked for product improvement.

**Data Processed:** User ID, page views, feature usage events, IP address (server-side only).

## 3. Necessity and Proportionality

### 3.1 Is this processing necessary?

**Profile search:** Yes — this is the core purpose of the platform. Users sign up specifically to be discoverable by AI agents for work opportunities.

**Job offers:** Yes — the mechanism by which agents hire humans.

**Analytics:** Proportionate — used for product improvement with opt-out available.

### 3.2 Data Minimization

**Current controls:**
- `hideContact` defaults to `true`, hiding contact info from public profiles
- Precise GPS coordinates (`locationLat`, `locationLng`) are used server-side for radius filtering but stripped from all API responses
- Password hashes, email verification tokens, and session data are never included in public responses
- API responses use explicit `select` queries rather than returning full database records

**Recommendation:** Consider adding field-level visibility controls so users can choose which profile fields are publicly visible (e.g., hide social links, hide wallet addresses).

### 3.3 Legal Basis

- **Profile visibility:** Contract (Art. 6(1)(b)) — users agree via Terms of Use that their profile will be publicly searchable
- **Job offers:** Contract + Consent — core service functionality with user notification controls
- **Analytics:** Legitimate interest (Art. 6(1)(f)) with opt-out mechanism

## 4. Risk Assessment

### 4.1 Risk: Mass Profile Enumeration

**Description:** The search API is publicly accessible with rate limits (30 req/min per IP). An adversary could systematically enumerate all user profiles.

**Likelihood:** Medium
**Impact:** Medium (profiles are intentionally public, but bulk harvesting is undesirable)

**Mitigations:**
- Rate limiting: 30 requests/minute per IP for search
- No bulk export endpoint
- Terms of Use prohibit scraping and bulk data extraction
- Registered agents have separate tier-based rate limits (BASIC: 1 offer/2 days, PRO: 15 offers/day; IP limit: 30/day)

**Residual risk:** Low

### 4.2 Risk: Contact Information Exposure

**Description:** Users may inadvertently expose contact information (email, phone numbers) to agents.

**Likelihood:** Low (default is hidden)
**Impact:** Medium (spam, unwanted contact)

**Mitigations:**
- `hideContact` defaults to `true` — users must explicitly choose to show contact info
- Contact info only shared with agents on job acceptance via webhook
- Rate limiting on job offer creation (tier-based: BASIC 1/2 days, PRO 15/day; IP: 30/day)

**Residual risk:** Low

### 4.3 Risk: Wallet Address Association

**Description:** Crypto wallet addresses on profiles could be cross-referenced with blockchain data to determine transaction history and financial activity.

**Likelihood:** Medium (blockchain data is inherently public)
**Impact:** Low-Medium (users voluntarily add wallet addresses for payment purposes)

**Mitigations:**
- Users choose to add wallet addresses; they are not required
- Users can remove wallets at any time
- Platform does not store or expose transaction history

**Residual risk:** Low (accepted risk inherent to cryptocurrency use)

### 4.4 Risk: Analytics Re-identification

**Description:** PostHog analytics could be used to build behavioral profiles of users.

**Likelihood:** Low
**Impact:** Low

**Mitigations:**
- PostHog configured with memory-only persistence (no cookies)
- Auto-capture disabled; only explicit events tracked
- Users can opt out of analytics entirely from their dashboard
- Analytics opt-out immediately stops user identification in PostHog

**Residual risk:** Very Low

### 4.5 Risk: Cross-Border Data Transfer

**Description:** PostHog processes data on US-based servers. Email delivery via US-based providers.

**Likelihood:** Certain (architectural decision)
**Impact:** Medium (requires appropriate safeguards for EU users)

**Mitigations:**
- Data Processing Agreements with PostHog, email provider
- PostHog offers EU-US Data Privacy Framework compliance
- Minimal data sent to third parties (no full profiles sent to analytics)

**Residual risk:** Low (with DPAs in place)

## 5. Data Subject Rights

| Right | Implementation |
|---|---|
| Access (Art. 15) | `GET /api/humans/me/export` — full JSON data export |
| Rectification (Art. 16) | `PATCH /api/humans/me` — edit all profile fields via dashboard |
| Erasure (Art. 17) | `DELETE /api/humans/me` — immediate, permanent deletion with cascade |
| Restriction (Art. 18) | Toggle availability, notification channels, analytics opt-out |
| Portability (Art. 20) | JSON export via dashboard |
| Object (Art. 21) | Analytics opt-out toggle, email unsubscribe |

## 6. Third-Party Processors

| Processor | Purpose | Data Shared | DPA Status |
|---|---|---|---|
| PostHog | Product analytics | User ID, events, IP | Signed (available at posthog.com/dpa) |
| Resend / AWS SES | Transactional emails | Email address, name | Signed (Resend DPA + AWS GDPR DPA) |
| Telegram Bot API | Job offer notifications | Chat ID, job details | Covered by Telegram ToS (user-initiated opt-in) |
| Gitcoin Passport | Humanity verification | Wallet address | Covered by Gitcoin ToS (user-initiated) |
| Google OAuth | Authentication | OAuth tokens (user-initiated) | Covered by Google ToS |

## 7. Conclusion

The processing activities assessed in this DPIA are necessary for the operation of the Human Pages platform. The identified risks have been mitigated to acceptable levels through:

1. Privacy-by-default settings (`hideContact: true`)
2. Data minimization (GPS coordinates never exposed; explicit select queries)
3. User control (analytics opt-out, notification toggles, availability toggle)
4. Technical safeguards (rate limiting, input validation, HTTPS, password hashing)
5. Comprehensive data subject rights (access, export, delete, rectify)
6. Automatic cleanup of stale tokens (OAuth states every 5 min, email verification tokens every hour)

**Outcome:** Processing may proceed with the mitigations documented above.

## 8. Review Schedule

This DPIA should be reviewed:
- Annually
- When new data processing activities are introduced
- When the risk profile of existing processing changes significantly
- When there is a relevant change in applicable data protection law
