import { Response, NextFunction } from 'express';
import { AgentAuthRequest } from './agentAuth.js';
import {
  isX402Enabled,
  getResourceServer,
  buildPaymentRequiredResponse,
  X402_PRICES,
  type X402ResourceType,
} from '../lib/x402.js';
import type { PaymentPayload, PaymentRequirements } from '@x402/core/types';
import { logger } from '../lib/logger.js';

/**
 * Extended request with x402 payment state.
 * x402PaymentCheck sets these fields when a valid payment is present.
 */
export interface X402Request extends AgentAuthRequest {
  x402Paid?: boolean;
  x402PaymentPayload?: PaymentPayload;
  x402ResourceType?: X402ResourceType;
  x402MatchedRequirements?: PaymentRequirements;
}

/**
 * Factory: returns middleware that checks for an x402 payment header.
 *
 * Placement in middleware chain:
 *   ipRateLimiter → x402PaymentCheck(type) → authenticateAgent → requireActiveOrPaid → handler
 *
 * The middleware runs BEFORE authenticateAgent. It does NOT short-circuit:
 * - If x402 is disabled → next()
 * - If no payment header → next() (fall through to regular auth)
 * - If payment header present → verify via x402 resource server
 *   - Valid: set req.x402Paid = true, store payload, next()
 *   - Invalid: return 402 with payment requirements
 */
export function x402PaymentCheck(resourceType: X402ResourceType) {
  return async (req: X402Request, res: Response, next: NextFunction) => {
    // x402 disabled → pass through
    if (!isX402Enabled()) {
      return next();
    }

    // Check for x402 payment header (standard: x-payment, lowercase)
    const paymentHeader = req.headers['x-payment'] as string | undefined;

    // No payment header → fall through to standard auth path
    if (!paymentHeader) {
      return next();
    }

    // Payment header present → verify it
    try {
      const paymentPayload: PaymentPayload = JSON.parse(paymentHeader);
      const server = await getResourceServer();

      // Build requirements for this resource type
      const resourceUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
      const price = X402_PRICES[resourceType];
      const requirements = await server.buildPaymentRequirements({
        scheme: 'exact',
        payTo: process.env.X402_PAY_TO_ADDRESS || '',
        price: `$${price}`,
        network: (process.env.X402_NETWORK || 'eip155:8453') as `${string}:${string}`,
        maxTimeoutSeconds: 300,
      });

      // Find matching requirements for this payment
      const matched = server.findMatchingRequirements(requirements, paymentPayload);
      if (!matched) {
        const paymentRequired = await buildPaymentRequiredResponse(resourceType, resourceUrl);
        res.setHeader('X-PAYMENT-REQUIREMENTS', JSON.stringify(paymentRequired.accepts));
        return res.status(402).json(paymentRequired);
      }

      // Verify the payment with the facilitator
      const verifyResult = await server.verifyPayment(paymentPayload, matched);
      if (!verifyResult.isValid) {
        logger.warn({ reason: verifyResult.invalidReason }, 'x402 payment verification failed');
        const paymentRequired = await buildPaymentRequiredResponse(resourceType, resourceUrl);
        res.setHeader('X-PAYMENT-REQUIREMENTS', JSON.stringify(paymentRequired.accepts));
        return res.status(402).json({
          ...paymentRequired,
          error: verifyResult.invalidReason || 'Payment verification failed',
        });
      }

      // Payment verified — mark request and store for settlement after handler
      req.x402Paid = true;
      req.x402PaymentPayload = paymentPayload;
      req.x402ResourceType = resourceType;
      req.x402MatchedRequirements = matched;

      // Settle after the response is sent.
      // We hook into res.on('finish') to settle only when the handler completed successfully (2xx).
      let settled = false;
      const settlePayment = async () => {
        if (settled) return;
        settled = true;
        try {
          const settleResult = await server.settlePayment(paymentPayload, matched);
          if (!settleResult.success) {
            logger.error({ reason: settleResult.errorReason }, 'x402 settlement failed');
          } else {
            logger.info(
              { resourceType, transaction: settleResult.transaction, network: settleResult.network },
              'x402 payment settled',
            );
          }
        } catch (err) {
          logger.error({ err }, 'x402 settlement error');
        }
      };

      // Hook into response finish event to trigger settlement on successful responses
      res.on('finish', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          settlePayment();
        }
      });

      next();
    } catch (err) {
      // Malformed payment header or server error → return 402
      logger.warn({ err }, 'x402 payment check error');
      try {
        const resourceUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
        const paymentRequired = await buildPaymentRequiredResponse(resourceType, resourceUrl);
        res.setHeader('X-PAYMENT-REQUIREMENTS', JSON.stringify(paymentRequired.accepts));
        return res.status(402).json({
          ...paymentRequired,
          error: 'Invalid payment header',
        });
      } catch (innerErr) {
        logger.error({ err: innerErr }, 'Failed to build payment requirements');
        return res.status(500).json({ error: 'Payment processing error' });
      }
    }
  };
}
