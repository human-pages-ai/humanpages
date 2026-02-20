import { x402ResourceServer, HTTPFacilitatorClient } from '@x402/core/server';
import { ExactEvmScheme } from '@x402/evm/exact/server';
import type { Network, PaymentRequired } from '@x402/core/types';
import { logger } from './logger.js';

// --- Configuration from environment ---

const X402_FACILITATOR_URL = process.env.X402_FACILITATOR_URL || 'https://www.x402.org/facilitator';
const X402_PAY_TO_ADDRESS = process.env.X402_PAY_TO_ADDRESS || '';
const X402_NETWORK = (process.env.X402_NETWORK || 'eip155:8453') as Network;

// USDC on Base mainnet
const USDC_BASE_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

export const X402_PRICES = {
  profile_view: parseFloat(process.env.X402_PROFILE_VIEW_PRICE || '0.05'),
  job_offer: parseFloat(process.env.X402_JOB_OFFER_PRICE || '0.25'),
  listing_post: parseFloat(process.env.X402_LISTING_POST_PRICE || '0.50'),
  listing_image_generate: parseFloat(process.env.X402_LISTING_IMAGE_PRICE || '0.10'),
} as const;

export type X402ResourceType = keyof typeof X402_PRICES;

/**
 * Check if x402 payment protocol is enabled.
 * Requires both X402_ENABLED=true and a valid pay-to address.
 */
export function isX402Enabled(): boolean {
  return process.env.X402_ENABLED === 'true' && !!X402_PAY_TO_ADDRESS;
}

// --- Singleton resource server (lazy init) ---

let _resourceServer: x402ResourceServer | null = null;
let _initPromise: Promise<void> | null = null;

/**
 * Get the initialized x402 resource server singleton.
 * Initializes lazily on first call.
 */
export async function getResourceServer(): Promise<x402ResourceServer> {
  if (!_resourceServer) {
    const facilitator = new HTTPFacilitatorClient({ url: X402_FACILITATOR_URL });
    _resourceServer = new x402ResourceServer(facilitator)
      .register(X402_NETWORK, new ExactEvmScheme());
  }

  if (!_initPromise) {
    _initPromise = _resourceServer.initialize().catch((err) => {
      logger.error({ err }, 'x402 resource server initialization failed');
      _initPromise = null; // allow retry
      throw err;
    });
  }

  await _initPromise;
  return _resourceServer;
}

/**
 * Build a 402 Payment Required response body for the given resource type.
 * This is the JSON payload returned with status 402 and the
 * X-PAYMENT-REQUIREMENTS header.
 */
export async function buildPaymentRequiredResponse(
  resourceType: X402ResourceType,
  resourceUrl: string,
): Promise<PaymentRequired> {
  const server = await getResourceServer();
  const price = X402_PRICES[resourceType];

  const requirements = await server.buildPaymentRequirements({
    scheme: 'exact',
    payTo: X402_PAY_TO_ADDRESS,
    price: `$${price}`,
    network: X402_NETWORK,
    maxTimeoutSeconds: 300,
  });

  const descriptions: Record<string, string> = {
    profile_view: 'Full human profile with contact info and wallets',
    listing_post: 'Post a job listing on the board',
    job_offer: 'Create a job offer for a human',
    listing_image_generate: 'Generate an AI cover image for a listing via DALL-E',
  };
  const description = descriptions[resourceType] || 'Access to a paid resource';

  return server.createPaymentRequiredResponse(
    requirements,
    {
      url: resourceUrl,
      description,
      mimeType: 'application/json',
    },
    'Payment required',
  );
}

/**
 * Build just the payment requirements array (for X-PAYMENT-REQUIREMENTS header).
 */
export async function buildPaymentRequirements(resourceType: X402ResourceType) {
  const server = await getResourceServer();
  const price = X402_PRICES[resourceType];

  return server.buildPaymentRequirements({
    scheme: 'exact',
    payTo: X402_PAY_TO_ADDRESS,
    price: `$${price}`,
    network: X402_NETWORK,
    maxTimeoutSeconds: 300,
  });
}

export { X402_NETWORK, USDC_BASE_ADDRESS };
