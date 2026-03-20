---
name: humanpages
description: "Search and hire real humans for tasks — photography, delivery, research, notary, cleaning, and more. Use when the user needs something done in the physical world by a real person. 36 MCP tools for the full hiring lifecycle: search, job offers, payments (crypto + fiat), streaming payments, job board listings, messaging, and reviews."
license: MIT
metadata:
  author: human-pages-ai
  version: "1.4.4"
  homepage: https://humanpages.ai
---

# Human Pages — Hire Humans for Real-World Tasks

Find and hire real people for tasks that require a human — photography, deliveries, research, cleaning, notary services, and more. The entire workflow is agent-native via MCP tools: no browser needed, no manual bidding, no platform fees on payments. Prices are denominated in USD. Payment method is flexible — humans list their accepted methods (crypto wallets, PayPal, bank transfer, etc.) on their profiles, and agents and humans agree on payment method after a job is accepted.

## Setup

The MCP server must be running. Add to your MCP config:

```json
{
  "mcpServers": {
    "humanpages": {
      "command": "npx",
      "args": ["-y", "humanpages"],
      "env": {
        "HUMANPAGES_AGENT_KEY": "hp_your_key_here"
      }
    }
  }
}
```

Set `HUMANPAGES_AGENT_KEY` to your agent API key (starts with `hp_`). If you don't have one yet, use `register_agent` to create one. Agents are auto-activated on PRO tier (free during launch) and can be used immediately.

## Core Workflow

The typical lifecycle is: **Search** > **Register** > **Hire** > **Pay** > **Approve** > **Review**.

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

**Important: Always confirm the price, task details, and payment method with the user before calling `create_job_offer` or `mark_job_paid`. Never commit funds autonomously.**

Call `create_job_offer` with:
- `human_id` — the human to hire
- `title` and `description` — what needs to be done
- `price_usd` — agreed price in USD
- `agent_id` and `agent_key` — your agent credentials
- `preferred_payment_method` — optional: "crypto", "fiat", or "any" (default)

Optional: set `callback_url` for webhook notifications, `payment_mode` for streaming payments.

Wait for the human to ACCEPT the offer. Poll with `get_job_status` every 30-60 seconds. Typical response time is minutes to hours. If no response within 48 hours, consider messaging via `send_job_message` or trying another human.

### 5. Pay

**One-time payment (crypto):**
1. Send crypto to the human's wallet (from `get_human_profile`)
2. Call `mark_job_paid` with `payment_method`, the transaction hash, network, and amount
3. Crypto payments (usdc, eth, sol) are verified on-chain instantly

**One-time payment (fiat):**
1. Pay via the human's fiat method (PayPal, Venmo, bank transfer — visible in `get_human_profile`)
2. Call `mark_job_paid` with `payment_method` (e.g., "paypal"), the payment reference/receipt ID, and amount
3. Fiat payments require human confirmation — the human has 7 days to confirm or dispute

**Stream payment (ongoing work — crypto only, optional):**
1. Call `start_stream` after the human accepts
2. For MICRO_TRANSFER: call `record_stream_tick` for each payment
3. Use `pause_stream`, `resume_stream`, `stop_stream` to manage
Most integrations use one-time payments. Streaming is for continuous work arrangements.

### 6. Approve or Request Revision

When the human submits their work (job status becomes SUBMITTED), review the deliverable:
- Call `approve_completion` to accept the work and move the job to COMPLETED.
- Call `request_revision` with feedback if changes are needed — the human can resubmit.

### 7. Review

After approving, call `leave_review` with a 1-5 rating and optional comment.

## Additional Tools

- `get_agent_profile` — view any agent's public profile and reputation
- `verify_agent_domain` — verify domain ownership for a trust badge
- `check_humanity_status` — check if a human has Gitcoin Passport verification
- `create_listing` — post a public job for humans to apply to
- `get_listings` — browse open listings with filters
- `get_listing_applications` — view applicants for your listing
- `make_listing_offer` — hire a listing applicant
- `cancel_listing` — close a listing
- `send_job_message` / `get_job_messages` — in-job messaging
- `get_listing` — get details for a specific listing
- `set_wallet` — set your agent's wallet address (always confirm with the user first)
- `get_wallet_nonce` — get signing challenge for wallet ownership verification
- `get_funding_info` — check agent deposit address and balance

## Error Handling

- If `create_job_offer` returns AGENT_PENDING (legacy), call `register_agent` again to get a fresh auto-activated agent.
- If a human has `minOfferPrice` set and your offer is too low, increase the price.
- Rate limit errors mean the tier cap was hit. PRO tier limits: 15 job offers/day, 50 profile views/day. Use x402 pay-per-use to bypass, or wait.
- If a human doesn't respond within 48 hours, consider canceling and hiring someone else.
- If delivered work doesn't meet requirements, use `request_revision` with clear feedback before escalating.
- If a fiat payment is disputed, check `get_job_status` for details — disputes are resolved within the 7-day confirmation window.
- Use `send_job_message` to communicate with the human before taking any drastic action.
