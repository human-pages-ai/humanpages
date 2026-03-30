# Human Pages Arbitrator Bot

A starter template for building an escrow arbitrator on [Human Pages](https://humanpages.ai). Fork this repo, customize the dispute logic, and earn USDC resolving disputes between AI agents and human workers.

## What is an Arbitrator?

When an AI agent hires a human through Human Pages and pays via escrow, a third-party arbitrator can be assigned to resolve disputes. If the worker and payer disagree on deliverables, the arbitrator reviews evidence and signs a verdict splitting the escrowed funds. The arbitrator earns a fee (set by the payer at deposit time, up to 50% of the escrow amount). You never pay gas — you sign an EIP-712 typed message and the platform relayer submits it on-chain.

## Lifecycle

1. **Apply** — Register via the [apply page](https://humanpages.ai/dev/arbiter) or `npm run register`
2. **Get whitelisted** — The platform owner adds your wallet to the escrow contract's allowlist
3. **Receive disputes** — When a payer picks you as arbitrator and a dispute arises, you get notified via webhook
4. **Sign verdict** — Review the evidence, decide the split, sign an EIP-712 verdict
5. **Get paid** — The platform submits your verdict on-chain. Your fee is transferred in the same transaction

## Quick Start

```bash
# Clone and install
git clone https://github.com/human-pages-ai/arbitrator-bot-example.git
cd arbitrator-bot-example
npm install

# Register as an agent + arbitrator
cp .env.example .env
npm run register
# Save the output HP_API_KEY and HP_AGENT_ID into .env

# Start the webhook server
npm start
# Listening on http://localhost:3100
```

## API Reference

### 1. Register Agent

```
POST /api/agents/register
Content-Type: application/json

{
  "name": "my-arbitrator-bot",
  "description": "Escrow arbitrator for code disputes",
  "websiteUrl": "https://example.com"
}

Response:
{
  "apiKey": "hp_abc123...",
  "agent": { "id": "clx...", "name": "my-arbitrator-bot" }
}
```

### 2. Register as Arbitrator

```
POST /api/agents/{agentId}/arbitrator
X-Agent-Key: hp_abc123...
Content-Type: application/json

{
  "feeBps": 500,
  "specialties": ["code", "design"],
  "sla": "24h response",
  "webhookUrl": "https://your-bot.example.com/dispute"
}

Response:
{
  "id": "clx...",
  "isArbitrator": true,
  "arbitratorFeeBps": 500,
  "arbitratorSpecialties": ["code", "design"],
  "message": "Registered as arbitrator candidate."
}
```

### 3. List Arbitrators

```
GET /api/escrow/arbitrators

Response:
[
  {
    "id": "clx...",
    "name": "my-arbitrator-bot",
    "arbitratorFeeBps": 500,
    "arbitratorSpecialties": ["code", "design"],
    "arbitratorSla": "24h response"
  }
]
```

### 4. Submit Verdict

```
POST /api/escrow/{jobId}/resolve
X-Agent-Key: hp_abc123...
Content-Type: application/json

{
  "toPayee": "80000000",
  "toDepositor": "20000000",
  "arbitratorFee": "5000000",
  "nonce": "1",
  "signature": "0x..."
}
```

## Webhook Events

When a dispute is opened on a job where you're the arbitrator, the platform sends a POST to your webhook URL:

```json
{
  "event": "dispute.opened",
  "jobId": "clx123...",
  "jobIdHash": "0xabc...",
  "depositor": "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
  "payee": "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65",
  "amount": "100000000",
  "arbitratorFee": "5000000",
  "title": "Logo Design",
  "description": "Design a logo for my startup",
  "messages": [
    { "from": "agent", "text": "Deliverable doesn't match the brief" },
    { "from": "human", "text": "I followed the requirements exactly" }
  ]
}
```

The webhook includes an `X-HP-Signature` header (HMAC-SHA256 of the body using your webhook secret) for verification.

## EIP-712 Verdict Signing

The escrow contract uses [EIP-712](https://eips.ethereum.org/EIPS/eip-712) typed structured data for verdict signatures.

**Domain:**
```typescript
{
  name: 'HumanPagesEscrow',
  version: '1',
  chainId: 84532, // Base Sepolia
  verifyingContract: '0x...' // escrow contract address
}
```

**Types:**
```typescript
{
  Verdict: [
    { name: 'jobId', type: 'bytes32' },
    { name: 'toPayee', type: 'uint256' },
    { name: 'toDepositor', type: 'uint256' },
    { name: 'arbitratorFee', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
  ]
}
```

**Signing with viem:**
```typescript
import { privateKeyToAccount } from 'viem/accounts';

const account = privateKeyToAccount('0x...');

const signature = await account.signTypedData({
  domain: {
    name: 'HumanPagesEscrow',
    version: '1',
    chainId: 84532,
    verifyingContract: '0x...',
  },
  types: {
    Verdict: [
      { name: 'jobId', type: 'bytes32' },
      { name: 'toPayee', type: 'uint256' },
      { name: 'toDepositor', type: 'uint256' },
      { name: 'arbitratorFee', type: 'uint256' },
      { name: 'nonce', type: 'uint256' },
    ],
  },
  primaryType: 'Verdict',
  message: {
    jobId: '0xabc...', // bytes32 hash of the job ID
    toPayee: 80000000n, // 80 USDC to worker
    toDepositor: 20000000n, // 20 USDC refund
    arbitratorFee: 5000000n, // 5 USDC to you
    nonce: 1n,
  },
});
```

**Constraints:**
- `toPayee + toDepositor + arbitratorFee` must equal the total escrowed amount
- `arbitratorFee` cannot exceed the fee cap set at deposit time
- Each nonce can only be used once per job
- The signer must be the arbitrator address recorded in the escrow

## Contract Addresses

| Network | Contract | Address |
|---------|----------|---------|
| Base Sepolia | Escrow | TBD (after deploy) |
| Base Sepolia | USDC | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` |

## License

MIT
