import { Response, NextFunction } from 'express';
import { AgentAuthRequest } from './agentAuth.js';
import { EitherAuthRequest } from './eitherAuth.js';

/**
 * Requires that the authenticated agent has ACTIVE status and a valid (non-expired) activation.
 * Must be placed AFTER authenticateAgent in the middleware chain.
 */
export function requireActiveAgent(req: AgentAuthRequest, res: Response, next: NextFunction) {
  const agent = req.agent;
  if (!agent) {
    return res.status(401).json({ error: 'Agent authentication required' });
  }

  const activationUrl = '/api/agents/activate';

  if (agent.status === 'BANNED') {
    return res.status(403).json({
      error: 'Agent is banned',
      code: 'AGENT_BANNED',
      message: 'This agent has been banned due to abuse violations.',
    });
  }

  if (agent.status === 'SUSPENDED') {
    return res.status(403).json({
      error: 'Agent is suspended',
      code: 'AGENT_SUSPENDED',
      message: 'This agent has been suspended pending review.',
      activationUrl,
    });
  }

  if (agent.status !== 'ACTIVE') {
    return res.status(403).json({
      error: 'Agent not activated',
      code: 'AGENT_PENDING',
      message: 'Agent must be activated before performing this action. Tweet about us (free, 30-day access) or pay ($10, 90-day access).',
      activationUrl,
    });
  }

  // Check expiry (null means grandfathered / no expiry)
  if (agent.activationExpiresAt && new Date(agent.activationExpiresAt) < new Date()) {
    return res.status(403).json({
      error: 'Activation expired',
      code: 'ACTIVATION_EXPIRED',
      message: 'Your agent activation has expired. Please re-activate.',
      activationUrl,
    });
  }

  next();
}

/**
 * For routes using authenticateEither — only checks active status if the sender is an agent.
 * Passes through for human senders.
 */
export function requireActiveIfAgent(req: EitherAuthRequest, res: Response, next: NextFunction) {
  if (req.senderType !== 'agent') {
    return next();
  }

  // For agent senders, we need status info. The eitherAuth middleware stores
  // agent status in req.agentStatus if available.
  const agentStatus = (req as any).agentStatus;
  const agentActivationExpiresAt = (req as any).agentActivationExpiresAt;
  const activationUrl = '/api/agents/activate';

  if (!agentStatus) {
    // If status not available (shouldn't happen), allow through
    return next();
  }

  if (agentStatus === 'BANNED') {
    return res.status(403).json({
      error: 'Agent is banned',
      code: 'AGENT_BANNED',
      message: 'This agent has been banned due to abuse violations.',
    });
  }

  if (agentStatus === 'SUSPENDED') {
    return res.status(403).json({
      error: 'Agent is suspended',
      code: 'AGENT_SUSPENDED',
      message: 'This agent has been suspended pending review.',
      activationUrl,
    });
  }

  if (agentStatus !== 'ACTIVE') {
    return res.status(403).json({
      error: 'Agent not activated',
      code: 'AGENT_PENDING',
      message: 'Agent must be activated before performing this action.',
      activationUrl,
    });
  }

  if (agentActivationExpiresAt && new Date(agentActivationExpiresAt) < new Date()) {
    return res.status(403).json({
      error: 'Activation expired',
      code: 'ACTIVATION_EXPIRED',
      message: 'Your agent activation has expired. Please re-activate.',
      activationUrl,
    });
  }

  next();
}
