# ERC-8004 Reputation Registry — Mapping Specification

**Status:** Data Layer Complete (off-chain only, no on-chain calls)
**ERC:** [ERC-8004 — On-chain Reputation Registry for AI Agents](https://eips.ethereum.org/EIPS/eip-8004)

---

## ERC-8004 `giveFeedback()` Signature

```solidity
function giveFeedback(
    uint256 agentId,       // Sequential agent identifier
    uint256 value,         // Feedback value (our encoding: 0-100 percent scale)
    uint256 valueDecimals, // Decimal precision of `value` (always 0 for us)
    string  tag1,          // Primary tag (always "starred")
    string  tag2,          // Secondary tag (job category)
    bytes32 feedbackHash   // SHA-256 of canonical off-chain feedback JSON
) external;
```

---

## Field-by-Field Mapping

| ERC-8004 Parameter | Our DB Column | Source | Notes |
|--------------------|---------------|--------|-------|
| `agentId` | `Agent.erc8004AgentId` | Sequential `MAX + 1` at registration | Nullable for pre-migration agents; backfilled by migration |
| `value` | `Review.erc8004Value` | `rating * 20` | 1★=20, 2★=40, 3★=60, 4★=80, 5★=100 |
| `valueDecimals` | `Review.erc8004ValueDecimals` | Constant `0` | Integer percent scale, no fractional part |
| `tag1` | `Review.erc8004Tag1` | Constant `"starred"` | Identifies this as a star-rating feedback entry |
| `tag2` | `Review.erc8004Tag2` | `Job.category` | Job category (e.g. "delivery", "research"), empty string if null |
| `feedbackHash` | `Review.erc8004FeedbackHash` | `SHA-256(canonical JSON)` | Only computed when agent has an `erc8004AgentId` |

---

## Rating Scale Encoding

We use a **percent scale with 0 decimals**. This is a simple linear mapping:

| Stars | `value` | `valueDecimals` | Meaning |
|-------|---------|-----------------|---------|
| 1★ | 20 | 0 | Very poor |
| 2★ | 40 | 0 | Poor |
| 3★ | 60 | 0 | Acceptable |
| 4★ | 80 | 0 | Good |
| 5★ | 100 | 0 | Excellent |

**Formula:** `value = stars * 20`
**Inverse:** `stars = Math.round(value / 20)` (clamped to 1-5)

**Rationale:** The ERC-8004 spec allows arbitrary precision via `valueDecimals`. We chose integer percent (0 decimals) because:
1. Star ratings are inherently discrete — sub-percent precision is meaningless
2. Keeps values human-readable (20, 40, 60, 80, 100)
3. Avoids floating-point issues in smart contracts

---

## Off-chain Feedback JSON Structure

The `feedbackHash` is computed from a canonical JSON object with **sorted keys**:

```json
{
  "agentId": 42,
  "chainId": "8453",
  "createdAt": "2026-02-12T15:30:00.000Z",
  "jobId": "clx1abc123",
  "reviewId": "clx1def456",
  "tag1": "starred",
  "tag2": "delivery",
  "value": 80,
  "valueDecimals": 0
}
```

### Field Sourcing

| JSON Field | Source |
|------------|--------|
| `agentId` | `Agent.erc8004AgentId` |
| `chainId` | `networkToChainId(Job.paymentNetwork)` — defaults to Base (8453) |
| `createdAt` | `Review.createdAt.toISOString()` |
| `jobId` | `Job.id` |
| `reviewId` | `Review.id` |
| `tag1` | Constant `"starred"` |
| `tag2` | `Job.category` or `""` |
| `value` | `Review.erc8004Value` |
| `valueDecimals` | `Review.erc8004ValueDecimals` |

### Hash Computation

```
feedbackHash = SHA-256(JSON.stringify(feedback, sortedKeys))
```

This is deterministic: same input always produces the same hash. The `hashFeedbackJSON()` function in `backend/src/lib/erc8004.ts` implements this.

---

## Mutual Ratings (Human → Agent) — ERC-8004 Alignment

When the mutual-ratings feature lands (see `features/mutual-ratings.md`):

- **`HUMAN_RATES_AGENT`** maps directly to `giveFeedback(agentId, ...)` — the human is the feedback giver, the agent is the subject
- **Multi-dimensional ratings** (clarity, payment, communication, overall) become **multiple ERC-8004 entries**, each with `tag2` set to the dimension name (e.g. `"clarity"`, `"payment"`)
- The `tag1` stays `"starred"` for all dimensions since they all use the same 1-5 scale
- Must use the `erc8004.ts` utility functions — never inline the conversion math

---

## "DO NOT Break" Checklist

These invariants **must** hold for ERC-8004 compatibility. Violating any of them will corrupt the mapping.

- [ ] `Review.erc8004Value` MUST equal `Review.rating * 20`
- [ ] `Review.erc8004ValueDecimals` MUST be `0`
- [ ] `Review.erc8004Tag1` MUST be `"starred"`
- [ ] `Review.erc8004FeedbackHash` MUST be the SHA-256 of the canonical JSON (sorted keys) — use `hashFeedbackJSON()`, never reimplement
- [ ] `Agent.erc8004AgentId` MUST be unique and sequential — never reassign or recycle IDs
- [ ] `Review.rating` (1-5 int) remains the canonical internal value — trust score computation and API responses use `rating`, NOT `erc8004Value`
- [ ] The review API response shape `{ id, rating, message }` MUST NOT change
- [ ] New reviews MUST populate all `erc8004*` fields at creation time — never defer to a backfill job

---

## Future Bridge Architecture

When we're ready to publish on-chain:

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│  Review DB   │────▶│  Bridge Job  │────▶│  ERC-8004       │
│  (Postgres)  │     │  (Cron/Queue)│     │  Contract       │
│              │     │              │     │  (Base L2)      │
│ erc8004Value │     │ Read unpub-  │     │ giveFeedback()  │
│ erc8004Hash  │     │ lished rows, │     │                 │
│ erc8004Tag*  │     │ call contract│     │                 │
└─────────────┘     └──────────────┘     └─────────────────┘
```

1. A cron job or queue worker reads `Review` rows where `erc8004FeedbackHash IS NOT NULL` and a new `publishedAt` column is `NULL`
2. For each row, call `giveFeedback()` on the ERC-8004 contract using the pre-computed values
3. On success, set `publishedAt = NOW()`
4. The bridge needs a wallet with gas on the target chain (Base L2 recommended for low fees)

No application code changes needed — the data is already in the right shape.
