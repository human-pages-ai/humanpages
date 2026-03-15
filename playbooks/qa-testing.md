# QA Testing Playbook

Hire a human to manually test your product across devices, browsers, and user flows. Humans catch UX issues, visual glitches, and edge cases that automated tests miss.

---

## When to Use

- A new release or feature is ready for deployment
- A critical bug fix needs regression testing before shipping
- Users have reported issues you cannot reproduce
- You need testing on specific devices or browsers you don't have access to
- Accessibility or usability testing is needed

## Why a Human Is Needed

Automated tests verify expected behavior. Humans find unexpected behavior: broken layouts on specific screen sizes, confusing UX flows, text truncation, slow interactions that feel wrong, accessibility barriers, and the countless edge cases that no test suite anticipates. A human tester also provides subjective feedback on whether something *feels* right.

## Search Criteria

**Primary search:**
```json
{
  "skill": "qa testing",
  "available_now": true,
  "limit": 10
}
```

**Fallback search:**
```json
{
  "skill": "mobile testing",
  "available_now": true,
  "limit": 10
}
```

**Second fallback:**
```json
{
  "skill": "testing",
  "available_now": true,
  "limit": 10
}
```

## Candidate Evaluation

Priority criteria when reviewing `get_human_profile` results:

1. **QA or testing experience** — look for mentions of bug reporting, test cases, or QA in their profile
2. **Device diversity** — candidates who mention specific devices (iPhone, Android, tablets) are more valuable
3. **Communication clarity** — bug reports require clear, precise writing
4. **Technical awareness** — understands browser dev tools, can capture console errors
5. **Availability** — testing is time-sensitive around releases; prefer candidates available within 24 hours

## Job Offer Template

**Title:** QA test [PRODUCT_NAME] — [FEATURE/RELEASE] on [PLATFORM]

**Description:**
```
Test [PRODUCT_NAME] ([PRODUCT_URL]) focusing on [FEATURE_OR_AREA].

Test environment:
- URL: [STAGING_URL]
- Test account: [TEST_CREDENTIALS] (will send securely via message)
- Branch/version: [VERSION]

Test cases to cover:
1. [TEST_CASE_1]
2. [TEST_CASE_2]
3. [TEST_CASE_3]
... (list 5-15 specific flows)

For each issue found, report:
- Steps to reproduce (numbered)
- Expected behavior
- Actual behavior
- Screenshot or screen recording
- Device, OS, browser, and screen size
- Severity: critical / major / minor / cosmetic
- Console errors (if any — open browser dev tools > Console tab)

Also note:
- Any flow that felt confusing or slow (even if technically "working")
- Suggestions for improvement

Deliver as a markdown document or structured table.
```

**Suggested price:** $3-10 per testing session. A focused session (5-10 test cases, single platform) is $3-5. A comprehensive session (15+ cases, multiple devices) is $8-10.

## Expected Deliverables

1. Bug report document with all issues found, each containing steps to reproduce, expected vs. actual behavior, and severity
2. Screenshots or screen recordings for every visual or interaction bug
3. Device and browser information for each issue
4. Console error logs where applicable
5. Summary of flows tested with pass/fail status
6. Subjective UX feedback — anything that felt off, even if not a "bug"

## Verification Criteria

Before calling `mark_job_paid`:

1. **Reproducibility** — attempt to reproduce at least 2 reported bugs; they should be real
2. **Completeness** — all requested test cases should be covered (marked pass or fail)
3. **Detail quality** — each bug report should have clear reproduction steps, not vague descriptions like "it didn't work"
4. **Screenshots present** — visual bugs must have visual evidence
5. **No fabrication** — reported issues should correspond to real product behavior, not invented problems to pad the report

## Communication Template

**First message after job offer is accepted:**

```
Hi [NAME], thanks for picking this up!

Here are the test credentials (please don't share these):
- URL: [STAGING_URL]
- Username: [USERNAME]
- Password: [PASSWORD]

Please focus on [PRIORITY_AREA] first, then work through the other
test cases. I'm most concerned about [SPECIFIC_CONCERN].

A few notes:
- Test on [TARGET_DEVICE/BROWSER] if you can
- If you find a critical bug (app crash, data loss, security issue),
  message me immediately — don't wait for the full report
- Include your device/browser info with each issue
- Screenshots are essential for any visual bugs

Take your time and be thorough. Let me know if any test case is
unclear.
```

## Estimated Timeline

- **Focused session (5-10 test cases):** 2-4 hours
- **Comprehensive session (15+ test cases, multiple devices):** 4-8 hours
- **Turnaround expectation:** 24-48 hours from acceptance

## Recurring Schedule

**Cadence:** Per release

**Per-release workflow:**
1. When a release is tagged or a staging deployment is ready, trigger this playbook
2. Create a job with the release-specific test cases
3. Include regression tests for previously reported bugs (verify they're still fixed)
4. After verification, update your known-issues list with any new findings
5. If critical bugs are found, fix and re-test before deploying to production

**Recommended testing matrix rotation:**
- Release 1: Desktop Chrome + Mobile Safari
- Release 2: Desktop Firefox + Mobile Chrome (Android)
- Release 3: Desktop Safari + Tablet
- Rotate to cover all platforms over time

---

## Example Agent Workflow

```
1. search_humans({ skill: "qa testing", available_now: true, limit: 10 })
2. For each candidate: get_human_profile({ username: candidate.username })
3. Select best candidate based on evaluation criteria
4. create_job_offer({
     human_username: selected.username,
     title: "QA test MyApp — v2.3 signup flow on mobile",
     description: "...[filled template]...",
     price: 25,
     currency: "USD"
   })
5. send_job_message({
     job_id: job.id,
     message: "...[credentials + instructions]..."
   })
6. Poll: get_job_status({ job_id: job.id }) until status is "delivered"
7. Review bug report against verification criteria
8. If critical bugs found: file them, fix, create new test job for regression
9. mark_job_paid({ job_id: job.id })
10. leave_review({ job_id: job.id, rating: 5, comment: "..." })
```
