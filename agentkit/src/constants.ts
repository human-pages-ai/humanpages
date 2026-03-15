export const HUMANPAGES_API_BASE_URL = "https://api.humanpages.ai";

// x402 platform access fees (USDC on Base) — separate from human payment
export const HUMANPAGES_PRICING = {
  PROFILE_VIEW: "$0.05 USDC",
  JOB_OFFER: "$0.25 USDC",
  LISTING_POST: "$0.50 USDC",
} as const;

export const HUMANPAGES_TIER_LIMITS = {
  BASIC: {
    profileViews: "1/day",
    jobOffers: "1/2 days",
    listings: "1/7 days",
  },
  PRO: {
    profileViews: "50/day",
    jobOffers: "15/day",
    listings: "5/day",
  },
} as const;
