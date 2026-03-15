# Localization Review Playbook

Hire a native speaker to review your product's localization in context. This goes beyond translation — a human uses the actual product and flags text that sounds unnatural, UI elements that break with longer strings, cultural mismatches, and formatting issues specific to their locale.

---

## When to Use

- A new language has been added to the product
- A release includes new user-facing strings that have been machine-translated
- Users in a specific locale report that something "sounds wrong"
- You're launching in a new market and need cultural/linguistic validation
- Date, currency, or number formatting needs locale-specific verification

## Why a Human Is Needed

Machine translation produces grammatically correct text that often sounds robotic or culturally off. Only a native speaker can judge whether a translated string sounds natural in context. Beyond language, localization involves checking that dates, currencies, and numbers follow local conventions, that text fits within UI elements (German and Finnish strings are often 30-40% longer than English), and that imagery or idioms are culturally appropriate. This requires a human navigating every screen.

## Search Criteria

**Primary search (language-specific):**
```json
{
  "skill": "translation",
  "available_now": true,
  "limit": 10
}
```

**Fallback search:**
```json
{
  "skill": "localization",
  "available_now": true,
  "limit": 10
}
```

**Second fallback (for specific languages, search by language name):**
```json
{
  "skill": "[LANGUAGE_NAME]",
  "available_now": true,
  "limit": 10
}
```

Example: `{ "skill": "Spanish", ... }`, `{ "skill": "Japanese", ... }`

When reviewing candidates, confirm they are a **native speaker** of the target language, not just someone who lists it as a skill.

## Candidate Evaluation

Priority criteria when reviewing `get_human_profile` results:

1. **Native speaker** — must be a native speaker of the target language, not just bilingual
2. **Locale specificity** — Latin American Spanish differs from European Spanish; Brazilian Portuguese from European Portuguese. Match the candidate to your target market
3. **Technical product familiarity** — a candidate who uses similar products will catch more contextual issues
4. **Attention to detail** — localization review is meticulous work; look for QA or editorial backgrounds
5. **Screenshot capability** — they need to be able to capture and annotate screenshots

## Job Offer Template

**Title:** Localization review — [PRODUCT_NAME] in [LANGUAGE] ([LOCALE])

**Description:**
```
Review the [LANGUAGE] localization of [PRODUCT_NAME] ([PRODUCT_URL])
as a native [LANGUAGE] speaker from [COUNTRY/REGION].

What to do:
1. Go through every screen and feature of the product in [LANGUAGE]
2. For each issue found, document it in the table format below
3. Take annotated screenshots showing the issue in context

Issue categories to check:
- **Translation quality**: Unnatural phrasing, overly literal translations,
  wrong register (too formal/informal), inconsistent terminology
- **Truncation/overflow**: Text cut off, overlapping other elements,
  or breaking the layout
- **Formatting**: Dates, times, currencies, numbers, addresses not
  matching [LOCALE] conventions
- **Missing translations**: Any strings still in English or another language
- **Cultural issues**: Idioms, humor, imagery, or examples that don't
  work in [CULTURE]
- **Placeholder errors**: Variables like {name} or %s visible to the user
- **Encoding**: Character display issues (mojibake, missing accents/diacritics)

Deliver as a markdown table:
| Screen/Location | Original (EN) | Current ([LANG]) | Suggested Fix | Category | Severity | Screenshot |

Severity levels:
- **Critical**: Meaning is wrong or offensive
- **Major**: Sounds clearly unnatural or causes confusion
- **Minor**: Grammatically correct but a native speaker would phrase differently
- **Cosmetic**: Truncation or formatting that doesn't affect comprehension

Also provide:
- Overall quality score (1-10) for the localization
- Top 3 systemic issues (patterns you noticed across multiple strings)
```

**Suggested price:** $5-15 per language. A small app (10-20 screens): $5. A larger product (50+ screens): $10-15.

## Expected Deliverables

1. Issue table in markdown with all fields filled (screen, original, current, suggested fix, category, severity, screenshot)
2. Annotated screenshots for every issue, with the problematic text highlighted or circled
3. Overall quality score with brief justification
4. Top 3 systemic issues — patterns the agent can use to improve the translation process
5. Count of total issues by severity (critical/major/minor/cosmetic)

## Verification Criteria

Before calling `mark_job_paid`:

1. **Coverage** — the reviewer should have visited all major screens (check against a screen list if you have one)
2. **Suggested fixes provided** — every issue should include a suggested correction, not just "this sounds wrong"
3. **Screenshots present** — each issue should have a corresponding screenshot showing the problem in context
4. **Severity is reasonable** — spot-check a few issues: cosmetic issues should truly be cosmetic, critical issues should truly be critical
5. **Systemic patterns identified** — the top-3 list should contain actionable patterns, not individual issues restated

## Communication Template

**First message after job offer is accepted:**

```
Hi [NAME], thanks for helping with this!

Please review [PRODUCT_NAME] in [LANGUAGE] as if you were a regular
user from [COUNTRY]. Here's how to switch the language:
[INSTRUCTIONS_TO_SWITCH_LANGUAGE]

Test account (if needed):
- URL: [URL]
- Username: [USERNAME]
- Password: [PASSWORD]

The key screens to cover:
1. [SCREEN_1, e.g., "Landing page and signup flow"]
2. [SCREEN_2, e.g., "Dashboard and settings"]
3. [SCREEN_3, e.g., "Payment and checkout"]
... (list all major areas)

Focus especially on:
- [PRIORITY, e.g., "The onboarding flow — we just rewrote it"]
- [PRIORITY, e.g., "Error messages — these were machine-translated"]

For each issue, please suggest how a native speaker would say it.
Don't just flag problems — give me the fix so I can apply it directly.
```

## Estimated Timeline

- **Small app (10-20 screens):** 3-5 hours
- **Medium app (20-50 screens):** 5-8 hours
- **Large app (50+ screens):** 8-12 hours (consider splitting into multiple jobs by section)
- **Turnaround expectation:** 48-72 hours

## Recurring Schedule

**Cadence:** Per release (for any release containing new or changed user-facing strings)

**Per-release workflow:**
1. When a release includes new strings in supported languages, trigger this playbook
2. Provide the reviewer with a list of changed screens/areas so they can focus on what's new
3. Include a regression check: verify that previously reported issues have been fixed
4. Update your translation memory or glossary based on the reviewer's systemic feedback

**Language expansion:**
When adding a new language:
1. Run a full review (all screens) for the initial launch
2. Subsequent releases only need delta reviews (changed screens)
3. Build a relationship with a reliable reviewer per language for consistency

---

## Example Agent Workflow

```
1. search_humans({ skill: "translation", available_now: true, limit: 10 })
   — or for a specific language:
   search_humans({ skill: "Spanish", available_now: true, limit: 10 })
2. For each candidate: get_human_profile({ username: candidate.username })
3. Confirm native speaker status and locale match
4. create_job_offer({
     human_username: selected.username,
     title: "Localization review — MyApp in Spanish (Mexico)",
     description: "...[filled template]...",
     price: 20,
     currency: "USD"
   })
5. send_job_message({ job_id: job.id, message: "...[credentials + screen list]..." })
6. Poll: get_job_status({ job_id: job.id }) until status is "delivered"
7. Review issue table against verification criteria
8. Apply suggested fixes to translation files
9. mark_job_paid({ job_id: job.id })
10. leave_review({ job_id: job.id, rating: 5, comment: "..." })
```
