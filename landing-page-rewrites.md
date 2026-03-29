# Landing Page Rewrites — Pain → Solution → How

**Core principle:** Every dev who lands on these pages is asking three questions in order:
1. "Why should I care?" (PAIN)
2. "What does this do for me?" (SOLUTION)
3. "How does it work?" (HOW)

The current pages skip #1 and rush into #3. Here's the rewrite.

---

## PAGE 1: /dev?promo=Itai-loves-you (or any promo page)

### ABOVE THE FOLD — The Pain

**Headline:**
> You shipped your app.
> Now who's doing the SEO, QA, and directory submissions?

**Subhead:**
> You didn't become a developer to spend 6 hours on Fiverr comparing freelancers. Your AI agent can handle all of that — finding the right human, sending the brief, and getting results back.

**Visual:** Side-by-side comparison.
- LEFT: "The old way" — screenshot of a dev with 14 browser tabs open on Fiverr, Upwork, email threads. Cluttered, stressful.
- RIGHT: "The new way" — one terminal prompt, one result delivered. Clean.

*(No CTA button yet. Don't ask them to do anything before they understand the value.)*

---

### SECTION 2 — The Solution (What)

**Headline:**
> One MCP. 1,500 freelancers. Your agent picks the right one.

**Three cards, but framed as outcomes, not services:**

| Instead of... | Your agent does this |
|---|---|
| Spending 3 hours submitting to directories manually | "Submit my app to 80+ directories" → Done in 3 days. $5–15. |
| Hiring a social media manager and managing them | "Post about my launch on Twitter/LinkedIn daily" → Done. $15–40/week. |
| Searching for a VA on Upwork, writing a brief, waiting | "Find someone to research competitors in my space" → Done. $5–10. |

**Key line:**
> Your agent searches providers, creates the job, negotiates, and delivers results. You approve. That's it.

---

### SECTION 3 — The How (3 steps, clean)

**Headline:**
> How it works

**Step 1:** Install the MCP in Cursor / Claude / any agent framework. (30 seconds)
**Step 2:** Tell your agent what you need. It searches 1,500+ verified freelancers and hires the right one.
**Step 3:** Get your deliverable. Review it. Done.

**Visual:** GIF or embedded video (30 sec) showing the actual flow in a terminal.

---

### SECTION 4 — The Promo Offer (NOW the free credits make sense)

**Headline:**
> Try it free — Itai loves you

> Your first $10 is on us. Pick any task below and your agent handles the rest.
> No credit card. No commitment. Just see it work.

**Three service cards** (same as current: SEO, SMM, VA) — but now the visitor understands WHY they'd want these.

**Remove** the "0/100 claimed" counter. Replace with:
> 1,500+ freelancers ready to work. Average task delivery: 2 days.

---

### SECTION 5 — Pricing (simple)

**Headline:**
> $10/month for unlimited searches. Pay only for the tasks you book.

| Free | Pro — $10/mo |
|---|---|
| 3 searches/day | Unlimited searches |
| Community support | Priority matching |
| | Domain verification badge |

**Or pay-per-use:** $0.05/profile view, $0.25/job offer via USDC on Base.

---

### SECTION 6 — Footer CTA

> Give your AI agent hiring powers.
> [Install the MCP] — single green button

**Remove** "Start your profile" from this page entirely. This is a dev page, not a provider page. Don't confuse the audience.

---
---

## PAGE 2: /prompt-to-completion

### ABOVE THE FOLD — The Pain (specific to SEO/directories)

**Headline:**
> You built something great.
> Nobody can find it.

**Subhead:**
> Your app isn't on Product Hunt, AI tool directories, SaaS listings, or dev platforms. Submitting manually takes 10+ hours and dozens of CAPTCHAs. Your AI agent can hire a human to do all 80+ in one prompt.

**Visual:** A list of ~15 directory logos (Product Hunt, AI Tool Directory, SaaS Hub, etc.) with checkmarks appearing one by one — implying "all handled."

---

### SECTION 2 — The Solution

**Headline:**
> One prompt. 80+ directories. A human handles every form.

**Key line:**
> Your agent hires a directory submission specialist. They handle the manual forms, CAPTCHAs, email confirmations — everything that can't be automated. You get a spreadsheet with every URL, status, and note.

**3-day delivery guarantee** (keep this — it's strong).

---

### SECTION 3 — How it works (keep the current 4-step flow — it's good)

1. Your agent searches for a human with directory submission experience
2. It creates a job offer with your product details + matched directory list
3. The human submits to each directory (manual forms, CAPTCHAs, confirmations)
4. You get a deliverable — table with every URL, status, and notes

*(This section is already well-done on the current page. Keep it.)*

---

### SECTION 4 — Pricing for this specific task

> **Directory submissions: $5–15 depending on scope**
> 80+ directories. 3-day delivery. Guaranteed.

*(Don't bury pricing. Devs want to know cost immediately.)*

---

### SECTION 5 — More things your agent can hire for

*(Keep the current card grid — QA Testing, Play Store Beta Testers, Localization, SMM, etc. This section is good. But move it AFTER the dev already understands the core value.)*

---

### SECTION 6 — CTA

> Ready? One prompt, real results.
> [Register your agent] — single green button

**Remove** "COMING SOON: Physical services" — it weakens confidence. Save it for a blog post or changelog.
**Remove** the newsletter signup — it's a distraction from the primary CTA.

---
---

## GENERAL UI/UX FIXES FOR BOTH PAGES

### Remove or fix:
- **"Start your profile" in nav on dev pages.** Devs aren't providers. Show "Install MCP" or "Developers" as primary nav CTA.
- **Emoji icons on service cards.** Replace with clean SVG icons or minimal illustrations. Emojis feel casual for a dev tool that handles money.
- **"0/100 claimed" counter.** Negative social proof. Remove entirely.
- **"COMING SOON" section.** Signals incompleteness. Cut from landing pages.
- **Mixed audiences.** Each page should serve ONE audience. /dev pages = devs only. No provider signup CTAs.

### Add:
- **A demo video or GIF above the fold.** 30-60 seconds of an agent hiring a human in a terminal. This is the single highest-impact addition.
- **Social proof that works.** "1,500+ freelancers ready" is better than "0 claimed." Even better: "47 tasks completed this week" (if true).
- **Speed/cost anchors.** "Average task: $8. Average delivery: 2 days." Concrete numbers beat vague promises.

### Visual hierarchy:
- Current pages have too much vertical whitespace between sections — the page feels "empty" rather than "clean."
- Headlines should be darker/bolder. Subtext is fine in gray but the contrast ratio between headline and body text could be stronger.
- The green CTA buttons are good. Keep them. But only show ONE primary CTA per section, not competing buttons.
