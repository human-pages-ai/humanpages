# Sample Bot: Local Errand Bot

A minimal, runnable example showing how to build a bot on Human Pages. This bot demonstrates Human Pages' core value proposition: **giving AI agents hands in the physical world** by hiring nearby humans for real-world tasks.

## The Idea

AI can write code, analyze data, and generate text — but it can't pick up a package, check if a store is open, or deliver a document across town. Human Pages bridges that gap. This sample bot finds available humans near a location and hires one to run an errand.

## Prerequisites

- Node.js 18+ (for built-in `fetch`)
- A running Human Pages instance (local or remote)
- Seeded database with users who have locations set

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Copy and configure environment
cp .env.example .env
# Edit .env — set API_URL, coordinates, and errand description

# 3. Run in development mode
npm run dev
```

## What It Does

The bot demonstrates the full Human Pages REST API lifecycle:

```
Register → Search nearby humans → Select → Offer errand → Wait for acceptance →
Pay → Wait for completion → Review
```

### Step-by-Step

1. **Register** — `POST /api/agents/register` creates an agent identity and returns an API key. Skipped if `AGENT_API_KEY` is already set in `.env`.

2. **Search nearby** — `GET /api/humans/search?lat=34.05&lng=-118.24&radius=25&available=true` finds available humans within a radius of the errand location.

3. **Select** — Picks the best candidate by reputation (completed jobs, rating).

4. **Offer** — `POST /api/jobs` sends a job offer describing the physical task, with a price and webhook callback URL.

5. **Wait for acceptance** — The bot's webhook server receives a `job.accepted` event when the human accepts. The payload includes the human's contact info for coordination.

6. **Pay** — `PATCH /api/jobs/:id/paid` records the on-chain USDC payment. (Demo uses a placeholder tx hash; see comments in `bot.ts` for the real payment flow.)

7. **Wait for completion** — Webhook `job.completed` event arrives when the human finishes the errand.

8. **Review** — `POST /api/jobs/:id/review` leaves a rating and comment.

## Configuration

All configuration is via environment variables (see `.env.example`):

| Variable | Description |
|----------|-------------|
| `API_URL` | Human Pages API base URL |
| `AGENT_API_KEY` | Saved API key (leave blank to auto-register) |
| `AGENT_NAME` | Bot name for registration |
| `WEBHOOK_PORT` | Port for the webhook server (default: 4000) |
| `WEBHOOK_URL` | Public URL the platform uses to reach webhooks |
| `WEBHOOK_SECRET` | Shared secret for HMAC-SHA256 signature verification |
| `ERRAND_LAT` | Latitude of the errand location |
| `ERRAND_LNG` | Longitude of the errand location |
| `ERRAND_RADIUS_KM` | Search radius in kilometers |
| `ERRAND_DESCRIPTION` | What the human needs to do in the physical world |
| `JOB_PRICE_USDC` | Price offered in USDC |

## Project Structure

```
src/
├── config.ts    — Environment variable loading and validation
├── types.ts     — TypeScript interfaces for API responses and webhooks
├── api.ts       — Human Pages API client (fetch + retry with backoff)
├── webhook.ts   — Express webhook server with HMAC signature verification
├── bot.ts       — Main orchestration logic (the lifecycle above)
└── index.ts     — Entry point
```

## Key Patterns

### Authentication

All API requests include the `X-Agent-Key` header:

```ts
headers['X-Agent-Key'] = apiKey;
```

### Retry with Backoff

The API client retries failed requests with exponential backoff (`1s → 4s → 16s`), but never retries 4xx client errors since those won't succeed on retry.

### Webhook Signature Verification

The platform signs webhook payloads with HMAC-SHA256 using your `callbackSecret`. The bot verifies signatures using `crypto.timingSafeEqual` (not `===`) to prevent timing attacks:

```ts
const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'));
```

### Event Buffering

Webhook events are buffered so they aren't lost if they arrive before the bot starts waiting. This handles race conditions where the human accepts very quickly.

## Customizing

This bot hires humans for errands, but you can adapt it to any physical-world task:

- **Property scout** — change the search to find humans near a listing, ask them to photograph it
- **Mystery shopper** — search near a restaurant, hire someone to evaluate service
- **Equipment check** — filter by `equipment` (e.g., humans with a camera or measuring tools)
- **Local translator** — filter by `language` instead of location for in-person translation

To build your own:

1. Fork this example
2. Change the search filters in `api.ts` (location, skills, equipment, language)
3. Write your errand description
4. Add real payment logic using ethers.js or viem
5. Implement any coordination between acceptance and completion

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Run with tsx (TypeScript, no build step) |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run compiled JavaScript from `dist/` |
