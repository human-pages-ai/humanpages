/**
 * ERC-8004 Reputation Registry — off-chain mapping utilities.
 *
 * These functions translate Human Pages' internal review data into
 * the format specified by ERC-8004's `giveFeedback(agentId, value,
 * valueDecimals, tag1, tag2, feedbackHash)`.
 *
 * NO on-chain calls are made here. The goal is data-layer readiness:
 * every Review row stores pre-computed ERC-8004 fields so a future
 * bridge can publish them without re-deriving anything.
 *
 * See docs/ERC-8004-MAPPING.md for the full specification.
 */

import crypto from 'crypto';

// ---------------------------------------------------------------------------
// Rating conversion
// ---------------------------------------------------------------------------

/**
 * Convert a 1-5 star rating to an ERC-8004 percent-scale value.
 *
 * Encoding: stars * 20  →  1★=20, 2★=40, 3★=60, 4★=80, 5★=100
 * Decimals are always 0 (integer percent).
 */
export function starRatingToERC8004Value(stars: 1 | 2 | 3 | 4 | 5): {
  value: number;
  valueDecimals: number;
} {
  return { value: stars * 20, valueDecimals: 0 };
}

/**
 * Convert an ERC-8004 value back to a 1-5 star rating.
 *
 * Handles both 0-decimal integer percent (20,40,60,80,100) and
 * arbitrary-decimal values by rounding to the nearest star.
 */
export function erc8004ValueToStarRating(
  value: number,
  decimals: number,
): 1 | 2 | 3 | 4 | 5 {
  const normalized = decimals > 0 ? value / 10 ** decimals : value;
  const stars = Math.round(normalized / 20);
  return Math.max(1, Math.min(5, stars)) as 1 | 2 | 3 | 4 | 5;
}

// ---------------------------------------------------------------------------
// Off-chain feedback JSON
// ---------------------------------------------------------------------------

/** Canonical off-chain feedback object matching the ERC-8004 spec. */
export interface ERC8004Feedback {
  /** ERC-8004 agent ID (sequential integer). */
  agentId: number;
  /** Percent-scale value (20-100). */
  value: number;
  /** Always 0 for our encoding. */
  valueDecimals: number;
  /** Primary tag — always "starred" for star ratings. */
  tag1: string;
  /** Secondary tag — job category (e.g. "delivery", "research"). */
  tag2: string;
  /** Human Pages review ID (cuid). */
  reviewId: string;
  /** Human Pages job ID (cuid). */
  jobId: string;
  /** ISO-8601 timestamp of review creation. */
  createdAt: string;
  /** EIP-155 chain ID where the feedback *could* be published. */
  chainId: string;
}

/**
 * Build a canonical off-chain feedback JSON object.
 *
 * The returned object can be hashed with `hashFeedbackJSON` to produce
 * the `feedbackHash` parameter for ERC-8004's `giveFeedback()`.
 */
export function buildFeedbackJSON(params: {
  agentId: number;
  rating: 1 | 2 | 3 | 4 | 5;
  tag2: string;
  reviewId: string;
  jobId: string;
  createdAt: Date;
  network?: string;
}): ERC8004Feedback {
  const { value, valueDecimals } = starRatingToERC8004Value(params.rating);
  return {
    agentId: params.agentId,
    value,
    valueDecimals,
    tag1: 'starred',
    tag2: params.tag2 || '',
    reviewId: params.reviewId,
    jobId: params.jobId,
    createdAt: params.createdAt.toISOString(),
    chainId: networkToChainId(params.network),
  };
}

// ---------------------------------------------------------------------------
// Hashing
// ---------------------------------------------------------------------------

/**
 * SHA-256 hash of a canonical feedback JSON (deterministic, sorted keys).
 *
 * This produces the `feedbackHash` parameter for `giveFeedback()`.
 */
export function hashFeedbackJSON(feedback: ERC8004Feedback): string {
  const canonical = JSON.stringify(feedback, Object.keys(feedback).sort());
  return crypto.createHash('sha256').update(canonical).digest('hex');
}

// ---------------------------------------------------------------------------
// Network → chain ID
// ---------------------------------------------------------------------------

const NETWORK_CHAIN_IDS: Record<string, string> = {
  ethereum: '1',
  base: '8453',
  polygon: '137',
  arbitrum: '42161',
  optimism: '10',
  sepolia: '11155111',
};

/**
 * Map a Human Pages network name to its EIP-155 chain ID.
 * Defaults to "8453" (Base) when the network is unknown or not provided.
 */
export function networkToChainId(network?: string | null): string {
  if (!network) return NETWORK_CHAIN_IDS.base;
  return NETWORK_CHAIN_IDS[network.toLowerCase()] ?? NETWORK_CHAIN_IDS.base;
}
