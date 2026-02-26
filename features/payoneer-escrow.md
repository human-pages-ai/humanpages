# Payoneer Escrow Integration (Fiat Fallback)

**Status:** Research / Pending Sales Contact
**Depends on:** [escrow-moltcourt.md](./escrow-moltcourt.md) (primary escrow system)
**Priority:** Post-launch, after on-chain escrow is live

---

## Overview

A fiat escrow option using Payoneer's licensed escrow service (Armor Escrow Inc., regulated by California DOB) as a fallback for users who don't want to transact in crypto. Payoneer holds funds, handles compliance, and provides built-in dispute resolution.

This is **not a replacement** for the on-chain MoltCourt escrow — it's a secondary payment rail for fiat-preferring users, especially in markets where crypto adoption is low.

### Why Payoneer Over Stripe Connect?

| | Stripe Connect | Payoneer Escrow |
|---|---|---|
| Real escrow? | No (delayed payouts, you hold liability) | Yes (licensed, Payoneer holds funds) |
| Dispute resolution? | No (you handle it) | Yes (built-in platform) |
| Global coverage | ~46 countries | 190+ countries |
| Target market fit | Misses PH, IN, VN, TH | Covers all our target languages |

Stripe Connect's "escrow" is just delayed payouts where Human Pages would be responsible for custody and disputes — platform liability we don't want. Payoneer is a real licensed escrow agent.

---

## How It Works

### Transaction Flow

```
Agent funds order via Payoneer --> Payoneer holds funds in escrow
  Happy path: Agent confirms completion --> Payoneer releases to Human
  Dispute: Either party disputes --> Payoneer's dispute platform handles it
    └── Parties submit documents, notes, settlement offers
  Resolution: Payoneer decides outcome, distributes funds
```

### Comparison to On-Chain Escrow

| | On-Chain (MoltCourt) | Payoneer Escrow |
|---|---|---|
| Fee | ~$0.05 gas | 1.5% or $10 minimum |
| Dispute resolution | MoltCourt AI (partial splits) | Payoneer internal team |
| Payout speed | Minutes | 2-5 business days |
| Country coverage | Anywhere with a wallet | 190+ countries (KYC required) |
| Platform liability | None (contract holds funds) | None (Payoneer holds funds) |
| Partial splits | Yes (AI-adjudicated) | Settlement offers between parties |
| Minimum viable task | Any amount (gas only) | ~$20+ (due to $10 min fee) |
| KYC required | No | Yes (both parties) |

---

## API Architecture

Payoneer Escrow API is REST-based with HMAC authentication. Two top-level resources:

### Resource Hierarchy

```
Client (API key + secret)
  ├── Accounts
  │   ├── Users (buyer/seller identity)
  │   ├── Bank Accounts (payout destinations)
  │   ├── Orders (escrow transactions)
  │   │   ├── Milestones
  │   │   ├── Documents (proof of work)
  │   │   ├── Notes
  │   │   ├── Disputes
  │   │   │   ├── Documents
  │   │   │   ├── Notes
  │   │   │   └── Offers (settlement proposals)
  │   │   ├── Order Events
  │   │   ├── Payment Instructions
  │   │   └── Shipments (not relevant for services)
  │   └── Documents (KYC docs)
  └── ShipmentCarriers (not relevant)
```

### Mapping to Our Models

| Payoneer Concept | Human Pages Concept |
|------------------|---------------------|
| Account (buyer) | Agent |
| Account (seller) | User (human) |
| Order | Job |
| Milestone | Job completion confirmation |
| Dispute | Job dispute |
| Offer | Settlement proposal |

---

## Integration Requirements

### Business Prerequisites

1. **Payoneer Business Account** — registered business entity, KYC verified
2. **Escrow API Access** — requires contacting Payoneer partnerships/sales team (not self-serve)
3. **Sandbox credentials** — API key + secret for testing
4. **Production credentials** — separate key + secret after review

### User Onboarding

Both parties need Payoneer accounts with identity verification:

- **Agents:** Create Payoneer buyer account on first fiat escrow job
- **Humans:** Create Payoneer seller account + link bank account before accepting fiat jobs
- **KYC friction:** This adds onboarding steps vs. the crypto flow (just connect a wallet)

### Fees

| Fee | Amount |
|-----|--------|
| Escrow fee | 1.5% of transaction value |
| Minimum fee | $10 per transaction |
| Payout fee | Varies by country/method |
| Currency conversion | Payoneer's FX rates apply |

The $10 minimum makes this unsuitable for microtasks under ~$20.

---

## Database Changes

### New Fields on User Model

```prisma
model User {
  // ... existing fields
  payoneerAccountId    String?
  payoneerKycStatus    String?   // PENDING, VERIFIED, REJECTED
}
```

### New Fields on Agent Model

```prisma
model Agent {
  // ... existing fields
  payoneerAccountId    String?
}
```

### New Fields on Job Model

```prisma
model Job {
  // ... existing fields
  payoneerOrderId      String?
  payoneerDisputeId    String?
  paymentMethod        String?   // "crypto" | "payoneer"
}
```

---

## Files to Create

| File | Purpose |
|------|---------|
| `backend/src/lib/payoneer-escrow.ts` | REST client (HMAC auth, account/order management) |
| `backend/src/routes/payoneer.ts` | Webhook receiver + API endpoints |

## Files to Modify

| File | Change |
|------|--------|
| `backend/prisma/schema.prisma` | Add Payoneer fields to User, Agent, Job |
| `backend/src/app.ts` | Mount Payoneer routes |
| `humanpages/src/index.ts` | Add `paymentMethod` option to job MCP tools |

---

## SDK Availability

- **C#/.NET:** [payoneer-escrow-csharp-dotnet](https://github.com/Payoneer-Escrow/payoneer-escrow-csharp-dotnet)
- **Python:** [payoneer-escrow-sdk](https://pypi.org/project/payoneer-escrow-sdk/)
- **Node/TypeScript:** None — would need to write a REST client from scratch

---

## Blockers

1. **Sales contact required** — cannot start integration without API access approval from Payoneer
2. **No Node SDK** — need to build REST client manually
3. **KYC onboarding** — adds friction for both agents and humans, needs UX design pass
4. **$10 minimum fee** — limits usefulness for small tasks
5. **Dispute resolution is Payoneer's** — we lose control vs. MoltCourt; no AI-adjudicated partial splits

---

## Action Items

- [ ] Contact Payoneer partnerships team to request Escrow API access
- [ ] Confirm pricing, supported countries, and any volume requirements
- [ ] Get sandbox credentials
- [ ] Design KYC onboarding flow for agents and humans
- [ ] Ship on-chain escrow first (primary system), then revisit this as fiat fallback

---

## References

- [Payoneer Escrow Developers](https://www.payoneer.com/escrow/developers/)
- [Payoneer Developer Portal](https://www.payoneer.com/developers/)
- [Payoneer Escrow C# SDK](https://github.com/Payoneer-Escrow/payoneer-escrow-csharp-dotnet)
- [Payoneer Escrow Python SDK](https://pypi.org/project/payoneer-escrow-sdk/)
- [Payoneer API Reference](https://developer.payoneer.com/docs/payoneer-api-reference)
