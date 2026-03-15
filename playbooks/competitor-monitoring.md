# Competitor Monitoring Playbook

Hire a human to track competitor changes on a recurring basis. Humans can spot subtle shifts in positioning, pricing, features, and messaging that automated scrapers miss or misinterpret.

---

## When to Use

- You need ongoing intelligence on 2-5 key competitors
- A competitor has launched a new feature or changed pricing
- You're preparing a pitch, fundraise, or strategy document and need current competitive landscape data
- Your automated monitoring tools have gaps (e.g., competitors use dynamic rendering, gated content, or change URLs frequently)

## Why a Human Is Needed

Competitor websites use dynamic content, A/B tests, gated pricing pages, and interactive demos that scrapers handle poorly. A human can navigate a competitor's product as a real user would: sign up for trials, read changelogs, join communities, and interpret qualitative changes in positioning. They can distinguish meaningful changes from cosmetic updates and provide contextual analysis an automated diff cannot.

## Search Criteria

**Primary search:**
```json
{
  "skill": "market research",
  "available_now": true,
  "limit": 10
}
```

**Fallback search:**
```json
{
  "skill": "research",
  "available_now": true,
  "limit": 10
}
```

**Second fallback:**
```json
{
  "skill": "data analysis",
  "available_now": true,
  "limit": 10
}
```

## Candidate Evaluation

Priority criteria when reviewing `get_human_profile` results:

1. **Research or analyst experience** — profiles mentioning market research, competitive analysis, or business intelligence
2. **Attention to detail** — ability to spot subtle differences week-over-week
3. **Writing quality** — reports must be clear, structured, and actionable
4. **Industry familiarity** — a candidate who understands your market will catch more meaningful changes
5. **Consistency** — for recurring tasks, prefer candidates who can commit weekly

## Job Offer Template

**Title:** Weekly competitor monitoring report — [YOUR_PRODUCT] vs [COMPETITOR_NAMES]

**Description:**
```
Track the following competitors and deliver a weekly diff report:

Competitors to monitor:
1. [COMPETITOR_1] — [URL_1]
2. [COMPETITOR_2] — [URL_2]
3. [COMPETITOR_3] — [URL_3]

For each competitor, check and report on:

**Pricing & Plans**
- Any changes to pricing, tiers, or feature packaging
- New promotions, discounts, or trial offers
- Changes to free tier limits

**Product & Features**
- New features announced or shipped
- Changes to existing features
- Changelog or release notes updates
- New integrations or partnerships

**Positioning & Messaging**
- Changes to homepage headline, tagline, or hero section
- New landing pages or campaign pages
- Changes to "about" or "why us" messaging
- New case studies or testimonials

**Content & Community**
- New blog posts, guides, or documentation
- Social media activity highlights (major announcements only)
- Community forum activity or sentiment shifts
- Job postings (indicate growth areas)

**Report format:**
For each competitor, structure as:
| Area | Last Week | This Week | Significance (high/med/low) |

End with a "Key Takeaways" section: 3-5 bullet points on what
matters most for [YOUR_PRODUCT] strategy.
```

**Suggested price:** $3-8 per weekly report. 2-3 competitors at surface level: $3-5. 4-5 competitors with deeper analysis: $6-8.

## Expected Deliverables

1. Structured diff report in markdown, organized by competitor and category
2. Screenshots of any significant visual or messaging changes
3. Links to new content, features, or announcements discovered
4. Significance ratings (high/medium/low) for each change
5. Key takeaways section with strategic implications for your product
6. Archived snapshots or URLs for reference (in case pages change again before you review)

## Verification Criteria

Before calling `mark_job_paid`:

1. **Coverage** — all listed competitors should be included in the report
2. **Accuracy** — spot-check 2-3 reported changes by visiting the competitor sites yourself
3. **Recency** — changes should be from the current week, not stale data from previous reports
4. **Actionability** — the key takeaways should contain specific, strategic insights, not generic observations like "they updated their website"
5. **Consistency** — if this is a recurring engagement, the format should match previous weeks for easy comparison

## Communication Template

**First message after job offer is accepted:**

```
Hi [NAME], thanks for taking this on!

Here's what I need each week:

Monitor these [N] competitors and send me a structured report by
[DAY_OF_WEEK]. Focus on changes since the last report — I don't need
a full overview each time, just what's new or different.

Priority areas for me right now:
- [SPECIFIC_CONCERN_1, e.g., "pricing changes — we're about to adjust ours"]
- [SPECIFIC_CONCERN_2, e.g., "any new AI features they ship"]

For the first report, include a baseline snapshot of each competitor's
current state so we have something to diff against going forward.

If you spot something urgent (major pricing change, new product launch,
acquisition news), message me right away — don't wait for the weekly
report.
```

## Estimated Timeline

- **Per weekly report:** 2-4 hours of research
- **First report (baseline):** 4-6 hours (more thorough initial snapshot)
- **Delivery deadline:** Same day each week (e.g., every Monday by end of day)

## Recurring Schedule

**Cadence:** Weekly

**Weekly workflow:**
1. At the start of each week (or on a set day), check if the current monitoring job has been delivered
2. Review the report and verify against criteria
3. Pay and review if satisfactory
4. Create the next week's job offer, referencing any specific areas to watch based on previous findings
5. Adjust competitor list or focus areas as your strategy evolves

**Quarterly review:**
- Assess whether the competitor set is still correct
- Add new entrants, remove irrelevant competitors
- Adjust the reporting template based on what insights have been most valuable
- Consider increasing/decreasing scope and price accordingly

---

## Example Agent Workflow

```
1. search_humans({ skill: "market research", available_now: true, limit: 10 })
2. For each candidate: get_human_profile({ username: candidate.username })
3. Select best candidate based on evaluation criteria
4. create_job_offer({
     human_username: selected.username,
     title: "Weekly competitor monitoring — MyApp vs Competitor1, Competitor2",
     description: "...[filled template]...",
     price: 15,
     currency: "USD"
   })
5. send_job_message({ job_id: job.id, message: "...[communication template]..." })
6. Poll: get_job_status({ job_id: job.id }) weekly until status is "delivered"
7. Review report against verification criteria
8. mark_job_paid({ job_id: job.id })
9. leave_review({ job_id: job.id, rating: 5, comment: "..." })
10. Create next week's job offer with updated focus areas
```
