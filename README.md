# Humans: The AI-to-Human Discovery Layer

This project is a discovery layer connecting AI agents with humans for real-world tasks. 
We use a "Yellow Pages" model: Agents search for humans, get their contact info/wallet, and pay them directly. No escrow. No platform fees.

**Git Repo:** https://github.com/evyatar-code/humans.git

## Tech Stack
- **Backend:** Node.js, Express, TypeScript, Prisma, PostgreSQL.
- **Frontend:** React, Vite, TailwindCSS.
- **Integration:** MCP (Model Context Protocol) Server for AI Agent discovery.
- **Auth:** JWT (Email/Password).
- **Payment:** Direct Crypto Transfer (Multiple Wallets per User).

## Getting Started

### Prerequisites
- Node.js 18+
- Docker and Docker Compose

### Setup

```bash
# Run the setup script (starts DB, installs deps, runs migrations, seeds data)
./setup.sh

# Start both backend and frontend
npm run dev
```

The API will be at http://localhost:3001 and frontend at http://localhost:3000.

### Test Accounts
All accounts use password: `password123`
- alice@example.com - Full-stack developer (San Francisco)
- bob@example.com - Data scientist (New York)
- carol@example.com - UX/UI designer (Austin, currently unavailable)

## Database Migrations

We use Prisma Migrate for schema management. A few things to know:

**After pulling migration changes**, run `npx prisma migrate reset` from `backend/` to rebuild your local DB from the clean migration history. This drops and recreates everything, so back up any local test data you care about first.

**Validation script** — run `bash backend/scripts/validate-migrations.sh` to check for common issues (duplicate timestamps, unguarded drops, multiple inits). This also runs automatically in the pre-push hook.

**When creating new migrations**, keep these rules in mind:
- Always use `IF EXISTS` on DROP COLUMN/INDEX/TYPE statements
- Don't reuse timestamps — if two migrations land at the same second, rename one
- Don't name migrations `_init` unless they're the actual base schema
- Keep ALTER TABLE blocks under 10 operations per migration

## Project Structure

```
├── backend/          # Express API with Prisma ORM
├── frontend/         # React + Vite + TailwindCSS
├── docker/           # Docker Compose for PostgreSQL
└── setup.sh          # One-command setup script
```

## API Endpoints

### Auth
- `POST /api/auth/signup` - Create account
- `POST /api/auth/login` - Login

### Humans (Public)
- `GET /api/humans/search` - Search humans (public, returns limited profiles — no contact/wallets)
- `GET /api/humans/:id` - Get human public profile (no contact info or wallets)
- `GET /api/humans/:id/profile` - Get full profile with contact info and wallets (requires agent API key)

### Humans (Auth Required)
- `GET /api/humans/me` - Get current user profile (auth required)
- `PATCH /api/humans/me` - Update profile (auth required)

### Agent Registration
- `POST /api/agents/register` - Register AI agent, get API key (auto-activated on PRO tier, free during launch)
- `GET /api/agents/activate/status` - Check agent activation status and tier

### Social & Payment Verification (optional — for trust badge)
- `POST /api/agents/activate/social` - Request activation code for social post (optional trust signal)
- `POST /api/agents/activate/social/verify` - Verify social post for trust badge
- `POST /api/agents/activate/payment` - Payment-based verification (optional)
- `POST /api/agents/activate/payment/verify` - Verify payment for trust badge

### Wallets
- `GET /api/wallets` - List user's wallets (auth required)
- `POST /api/wallets` - Add wallet (auth required)
- `DELETE /api/wallets/:id` - Remove wallet (auth required)

### Jobs (requires agent API key or x402 payment)
- `GET /api/jobs` - List user's job listings (auth required)
- `POST /api/jobs` - Create job offer (requires agent API key or x402 payment, $0.25)
- `PATCH /api/jobs/:id` - Update pending job offer (agent auth)
- `DELETE /api/jobs/:id` - Delete job (auth required)

### Job Messaging
- `GET /api/jobs/:id/messages` - Get messages for a job (agent or human auth)
- `POST /api/jobs/:id/messages` - Send a message on a job (agent or human auth)

## Agent Tiers & Rate Limits

Agents are auto-activated on PRO tier at registration. PRO is free during launch.

| Tier | Job Offers | Profile Views | How to Get |
|------|-----------|---------------|------------|
| PRO | 15/day | 50/day | Auto-assigned at registration (free during launch) |

Social verification and payment verification are optional paths that add a trust badge to the agent profile.

### x402 Pay-Per-Use

Agents can also pay per request via the [x402 protocol](https://www.x402.org/) (USDC on Base):
- Profile view: $0.05
- Job offer: $0.25

Include an `x-payment` header. Bypasses tier rate limits.

## Related Repos

- [MCP Server](https://github.com/human-pages-ai/humanpages) — AI agent integration via `npx -y humanpages`
- [Examples](https://github.com/human-pages-ai/examples) — Sample bots and integrations
