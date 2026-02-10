# Humans: The AI-to-Human Marketplace

This project is a directory marketplace connecting AI agents with humans for real-world tasks. 
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

### Humans
- `GET /api/humans/search` - Search humans (public, for AI agents)
- `GET /api/humans/:id` - Get human details (public)
- `GET /api/humans/me` - Get current user profile (auth required)
- `PATCH /api/humans/me` - Update profile (auth required)

### Wallets
- `GET /api/wallets` - List user's wallets (auth required)
- `POST /api/wallets` - Add wallet (auth required)
- `DELETE /api/wallets/:id` - Remove wallet (auth required)

### Jobs
- `GET /api/jobs` - List user's job listings (auth required)
- `POST /api/jobs` - Create job listing (auth required)
- `PATCH /api/jobs/:id` - Update pending job offer (agent auth)
- `DELETE /api/jobs/:id` - Delete job (auth required)

## Related Repos

- [MCP Server](https://github.com/human-pages-ai/humanpages) — AI agent integration via `npx -y humanpages`
- [Examples](https://github.com/human-pages-ai/examples) — Sample bots and integrations
