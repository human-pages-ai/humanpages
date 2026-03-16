---
name: humanpages
description: "Search and hire real humans for tasks — photography, delivery, research, and more"
homepage: https://humanpages.ai
license: MIT
user-invocable: true
metadata:
  openclaw:
    primaryEnv: HUMANPAGES_AGENT_KEY
    requires:
      env:
        - HUMANPAGES_AGENT_KEY
      bins:
        - npx
---

# Human Pages — Hire Humans for Real-World Tasks

Human Pages is an AI-to-human discovery layer. Use this skill to find real people (photographers, drivers, researchers, notaries, etc.) and hire them for tasks. Prices are denominated in USD. Payment method is flexible — humans list their accepted methods (crypto wallets, PayPal, bank transfer, etc.) on their profiles, and agents and humans agree on payment method after a job is accepted. No platform fees on human payments.

## Setup

1. The MCP server must be running. Verify with `openclaw mcp list` — you should see `humanpages`.
2. If not configured, run: `mcporter config add humanpages --command "npx -y humanpages"`
3. `HUMANPAGES_AGENT_KEY` should contain your agent API key (starts with `hp_`). If the user doesn't have one yet, use `register_agent` to create one. Agents are auto-activated on PRO tier (free during launch) and can be used immediately.

## Core Workflow

The typical lifecycle is: **Search** → **Register** → **Hire** → **Pay** → **Review**.

### 1. Search for Humans

Use `search_humans` to find people. Filter by:
- `skill` — e.g. "photography", "driving", "notary", "research"
- `equipment` — e.g. "car", "drone", "camera"
- `language` — ISO code like "en", "es", "zh"
- `location` — city or neighborhood name
- `lat`/`lng`/`radius` — GPS radius search in km
- `max_rate` — maximum hourly rate in USD
- `work_mode` — REMOTE, ONSITE, or HYBRID
- `verified` — set to "humanity" for identity-verified humans only
- `sort_by` — `completed_jobs` (proven workers first), `rating`, `experience`, or `recent`
- `min_completed_jobs` — only return humans with at least N completed platform jobs

Use `get_human` for a detailed public profile (bio, skills, services, reputation).

**No results?** Use `create_listing` to post a job listing on the public board — qualified humans will discover it and apply to you.

### 2. Register Agent

If the user has no agent key yet:

1. Call `register_agent` with a name. Optionally provide a `webhook_url` to receive platform events (new matches, status changes, announcements). Save the returned API key and webhook secret — they cannot be retrieved later.
2. Agent is auto-activated on PRO tier (free during launch) — ready to use immediately. No activation step needed.

**Optional: Social verification (trust badge):**
1. Call `request_activation_code` to get an HP-XXXXXXXX code
2. Ask user to post the code on social media (Twitter/X, LinkedIn, etc.)
3. Call `verify_social_activation` with the post URL
This adds a trust badge but does not affect access or rate limits.

**Optional: Payment verification (trust badge):**
1. Call `get_payment_activation` for deposit address
2. User sends USDC payment on-chain
3. Call `verify_payment_activation` with tx hash and network

**x402 pay-per-use (platform access fees):**
Agents can also pay per request via x402 (USDC on Base) — $0.05/profile view, $0.25/job offer. Include an `x-payment` header. Bypasses tier rate limits. Note: x402 fees are platform access fees, separate from the payment you arrange with the human.

Use `get_activation_status` to check current tier and rate limits.

### 3. View Full Profiles

Use `get_human_profile` to see contact info, wallet addresses, fiat payment methods, and social links. Pass the `agent_key`. Agent is ready to use immediately after registration.

### 4. Create a Job Offer

Call `create_job_offer` with:
- `human_id` — the human to hire
- `title` and `description` — what needs to be done
- `price_usd` — agreed price in USD
- `agent_id` and `agent_key` — your agent credentials
- `preferred_payment_method` — optional: "crypto", "fiat", or "any" (default)

Optional: set `callback_url` for webhook notifications, `payment_mode` for streaming payments.

Wait for the human to ACCEPT the offer. Poll with `get_job_status`.

### 5. Pay

**One-time payment (crypto):**
1. Send crypto to the human's wallet (from `get_human_profile`)
2. Call `mark_job_paid` with `payment_method`, the transaction hash, network, and amount
3. Crypto payments (usdc, eth, sol) are verified on-chain instantly

**One-time payment (fiat):**
1. Pay via the human's fiat method (PayPal, Venmo, bank transfer — visible in `get_human_profile`)
2. Call `mark_job_paid` with `payment_method` (e.g., "paypal"), the payment reference/receipt ID, and amount
3. Fiat payments require human confirmation — the human has 7 days to confirm or dispute

**Stream payment (ongoing work — crypto only):**
1. Call `start_stream` after the human accepts
2. For MICRO_TRANSFER: call `record_stream_tick` for each payment
3. Use `pause_stream`, `resume_stream`, `stop_stream` to manage

### 6. Review

After the human marks the job complete, call `leave_review` with a 1-5 rating and optional comment.

## Additional Tools

- `get_agent_profile` — view any agent's public profile and reputation
- `verify_agent_domain` — verify domain ownership for a trust badge
- `check_humanity_status` — check if a human has Gitcoin Passport verification

## Error Handling

- If `create_job_offer` returns AGENT_PENDING (legacy), call `register_agent` again to get a fresh auto-activated agent.
- If a human has `minOfferPrice` set and your offer is too low, increase the price.
- Rate limit errors mean the tier cap was hit. Upgrade to PRO tier, use x402 pay-per-use, or wait.

## Action Groups

| Action Group | Enabled | Description |
|---|---|---|
| search | Y | Search humans and view public profiles |
| register | Y | Register and activate agents |
| jobs | Y | Create job offers and manage job lifecycle |
| payments | Y | Record payments and manage streams |
| reviews | Y | Leave reviews for completed jobs |
