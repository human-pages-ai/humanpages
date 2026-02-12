import { Response, NextFunction } from 'express';
import { X402Request } from './x402PaymentCheck.js';
import { isX402Enabled, buildPaymentRequiredResponse, X402_PRICES } from '../lib/x402.js';

/**
 * Dual-path gate: allows access if the agent is ACTIVE with valid activation OR paid via x402.
 *
 * Decision order:
 * 1. BANNED → 403 (no settlement, no recourse)
 * 2. SUSPENDED → 403 (no settlement)
 * 3. req.x402Paid === true → next() (payment replaces activation)
 * 4. agent.status !== 'ACTIVE' → 402 with payment requirements + activation URL
 * 5. Activation expired → 402 with payment requirements + activation URL
 * 6. ACTIVE with valid activation → next()
 *
 * Key change from requireActiveAgent: PENDING/expired agents get 402 (payable)
 * instead of 403 (blocked) on x402-enabled routes.
 */
export async function requireActiveOrPaid(req: X402Request, res: Response, next: NextFunction) {
  const agent = req.agent;
  if (!agent) {
    return res.status(401).json({ error: 'Agent authentication required' });
  }

  const activationUrl = '/api/agents/activate';

  // 1. BANNED — always reject, never accept payment from banned agents
  if (agent.status === 'BANNED') {
    return res.status(403).json({
      error: 'Agent is banned',
      code: 'AGENT_BANNED',
      message: 'This agent has been banned due to abuse violations.',
    });
  }

  // 2. SUSPENDED — always reject
  if (agent.status === 'SUSPENDED') {
    return res.status(403).json({
      error: 'Agent is suspended',
      code: 'AGENT_SUSPENDED',
      message: 'This agent has been suspended pending review.',
      activationUrl,
    });
  }

  // 3. x402 payment verified → skip activation checks
  if (req.x402Paid === true) {
    return next();
  }

  // 4. Not ACTIVE → 402 with payment requirements (if x402 enabled) or 403
  if (agent.status !== 'ACTIVE') {
    return await sendPayableOrForbidden(req, res, {
      error: 'Agent not activated',
      code: 'AGENT_PENDING',
      message: 'Agent must be activated or pay per use. Tweet about us (free, 30-day access), pay subscription ($10, 60-day access), or use x402 per-request payment.',
      activationUrl,
    });
  }

  // 5. Activation expired → 402 with payment requirements (if x402 enabled) or 403
  if (agent.activationExpiresAt && new Date(agent.activationExpiresAt) < new Date()) {
    return await sendPayableOrForbidden(req, res, {
      error: 'Activation expired',
      code: 'ACTIVATION_EXPIRED',
      message: 'Your agent activation has expired. Re-activate or use x402 per-request payment.',
      activationUrl,
    });
  }

  // 6. ACTIVE with valid activation
  next();
}

/**
 * If x402 is enabled, returns 402 with payment requirements.
 * Otherwise returns 403 like the original requireActiveAgent.
 */
async function sendPayableOrForbidden(
  req: X402Request,
  res: Response,
  body: { error: string; code: string; message: string; activationUrl: string },
) {
  if (!isX402Enabled()) {
    return res.status(403).json(body);
  }

  try {
    const resourceType = req.x402ResourceType || 'profile_view';
    const resourceUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
    const paymentRequired = await buildPaymentRequiredResponse(resourceType, resourceUrl);

    res.setHeader('X-PAYMENT-REQUIREMENTS', JSON.stringify(paymentRequired.accepts));
    return res.status(402).json({
      ...body,
      x402Available: true,
      x402Price: `$${X402_PRICES[resourceType]}`,
      paymentRequired,
    });
  } catch (err) {
    // If we can't build payment requirements, fall back to 403
    return res.status(403).json(body);
  }
}
