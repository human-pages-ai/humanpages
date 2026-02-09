# Sample Bot: Local Errand Bot

A minimal, runnable example showing how to build a bot on Human Pages. This bot demonstrates Human Pages' core value proposition: **giving AI agents hands in the physical world** by hiring nearby humans for real-world tasks.

## The Idea

AI can write code, analyze data, and generate text — but it can't pick up a package, check if a store is open, or deliver a document across town. Human Pages bridges that gap. This sample bot finds available humans near a location and hires one to run an errand.

## Prerequisites

- Node.js 18+ (for built-in `fetch`)
- A running Human Pages instance (local or remote)

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Copy and configure environment
cp .env.example .env
# Edit .env — set API_URL and errand description

# 3. Run the bot (pass a human ID from the platform)
npx tsx src/index.ts <humanId>
```

That's it — no webhook server, no tunnel, no extra infrastructure. The bot polls the API for status changes and messages.

### Adding Smart Replies

By default the bot uses simple keyword matching for replies. To enable AI-powered conversation, add an Anthropic API key:

```bash
# In .env
ANTHROPIC_API_KEY=sk-ant-...
```

The bot will use Claude to generate context-aware replies. See [Connecting an LLM](#connecting-an-llm) for more options.

## What It Does

The bot demonstrates the full Human Pages REST API lifecycle:

```
Register → Offer → Message → Wait for acceptance → Pay → Wait for completion → Review
```

### Step-by-Step

1. **Register** — `POST /api/agents/register` creates an agent identity and returns an API key. Skipped if `AGENT_API_KEY` is already set in `.env`.

2. **Offer** — `POST /api/jobs` sends a job offer describing the physical task, with a price.

3. **Message** — `POST /api/jobs/:id/messages` sends an intro message to the human.

4. **Wait for acceptance** — Polls `GET /api/jobs/:id` every 5 seconds. While waiting, the bot also polls for new messages and replies to them, so the human can ask questions before accepting.

5. **Pay** — `PATCH /api/jobs/:id/paid` records the on-chain USDC payment. (Demo uses a placeholder tx hash; see comments in `bot.ts` for the real payment flow.)

6. **Wait for completion** — Continues polling status and replying to messages while the human works.

7. **Review** — `POST /api/jobs/:id/review` leaves a rating and comment.

If a `WEBHOOK_URL` is configured, the bot uses real-time webhooks instead of polling.

## Configuration

All configuration is via environment variables (see `.env.example`):

| Variable | Description |
|----------|-------------|
| `API_URL` | Human Pages API base URL |
| `AGENT_API_KEY` | Saved API key (leave blank to auto-register) |
| `AGENT_NAME` | Bot name for registration |
| `ANTHROPIC_API_KEY` | Anthropic API key for smart replies (optional) |
| `LLM_MODEL` | Claude model to use (default: `claude-sonnet-4-5-20250929`) |
| `LLM_SYSTEM_PROMPT` | Custom system prompt for the LLM (optional) |
| `WEBHOOK_PORT` | Port for the webhook server (default: 4000) |
| `WEBHOOK_URL` | Public URL the platform uses to reach webhooks (optional) |
| `WEBHOOK_SECRET` | Shared secret for HMAC-SHA256 signature verification |
| `ERRAND_DESCRIPTION` | What the human needs to do in the physical world |
| `JOB_PRICE_USDC` | Price offered in USDC |

## Project Structure

```
src/
├── config.ts      — Environment variable loading and validation
├── types.ts       — TypeScript interfaces for API responses and webhooks
├── api.ts         — Human Pages API client (fetch + retry with backoff)
├── responder.ts   — Reply generation (Claude or keyword fallback)
├── webhook.ts     — Webhook server + polling fallback for status & messages
├── bot.ts         — Main orchestration logic (the lifecycle above)
└── index.ts       — Entry point
```

## Connecting an LLM

The bot's reply logic lives in `src/responder.ts`. It exports one function:

```ts
async function generateReply(msg: Message, jobDescription: string): Promise<string>
```

### Claude (built-in)

Set `ANTHROPIC_API_KEY` in `.env` and you're done. The bot sends conversation history to Claude with a system prompt that includes the job details. Customize behavior with:

```bash
# Use a different model
LLM_MODEL=claude-haiku-4-5-20251001

# Override the system prompt entirely
LLM_SYSTEM_PROMPT="You are a delivery coordinator. Be brief and professional."
```

### OpenAI / Other Providers

Replace the `callClaude` function in `responder.ts`. The interface is the same — take a message, return a reply string:

```ts
// Example: OpenAI
async function callOpenAI(msg: Message, jobDescription: string): Promise<string> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: `You coordinate errands. Job: ${jobDescription}` },
        ...conversationHistory,
        { role: 'user', content: msg.content },
      ],
      max_tokens: 300,
    }),
  });
  const data = await res.json();
  return data.choices[0].message.content;
}
```

### Local Models (Ollama, LM Studio, etc.)

Point to your local endpoint — most expose an OpenAI-compatible API:

```ts
// Example: Ollama
const res = await fetch('http://localhost:11434/v1/chat/completions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: 'llama3',
    messages: [
      { role: 'system', content: `You coordinate errands. Job: ${jobDescription}` },
      { role: 'user', content: msg.content },
    ],
  }),
});
```

## Key Patterns

### No Webhook Required

The bot works out of the box by polling. It checks job status and messages every 5 seconds. If you configure `WEBHOOK_URL`, it switches to real-time webhook delivery instead.

### Message Handling During Waits

While waiting for acceptance or completion, the bot simultaneously monitors for new messages and replies. This lets the human ask questions, negotiate, or coordinate without breaking the flow.

### Authentication

All API requests include the `X-Agent-Key` header:

```ts
headers['X-Agent-Key'] = apiKey;
```

### Retry with Backoff

The API client retries failed requests with exponential backoff (`1s → 4s → 16s`), but never retries 4xx client errors since those won't succeed on retry.

### Webhook Signature Verification

When using webhooks, the platform signs payloads with HMAC-SHA256 using your `callbackSecret`. The bot verifies signatures using `crypto.timingSafeEqual` (not `===`) to prevent timing attacks:

```ts
const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'));
```

## Customizing

This bot hires humans for errands, but you can adapt it to any physical-world task:

- **Property scout** — find humans near a listing, ask them to photograph it
- **Mystery shopper** — search near a restaurant, hire someone to evaluate service
- **Equipment check** — filter by `equipment` (e.g., humans with a camera or measuring tools)
- **Local translator** — filter by `language` instead of location for in-person translation

To build your own:

1. Fork this example
2. Change the errand description and price
3. Customize the system prompt in `LLM_SYSTEM_PROMPT` (or modify `responder.ts`)
4. Add real payment logic using ethers.js or viem
5. Deploy with a webhook URL for real-time events

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Run with tsx (TypeScript, no build step) |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run compiled JavaScript from `dist/` |
