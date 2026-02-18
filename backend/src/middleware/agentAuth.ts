import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';

export interface AgentAuthRequest extends Request {
  agent?: {
    id: string;
    name: string;
    status: string;
    activationExpiresAt: Date | null;
    activationTier: string;
  };
}

/**
 * Requires X-Agent-Key header. Looks up agent by key prefix, bcrypt compares,
 * sets req.agent. Returns 401 on failure.
 */
export async function authenticateAgent(req: AgentAuthRequest, res: Response, next: NextFunction) {
  const apiKey = req.headers['x-agent-key'] as string | undefined;

  if (!apiKey) {
    return res.status(401).json({ error: 'X-Agent-Key header required' });
  }

  const prefix = apiKey.substring(0, 8);

  try {
    const agent = await prisma.agent.findUnique({
      where: { apiKeyPrefix: prefix },
      select: { id: true, name: true, apiKeyHash: true, status: true, activationExpiresAt: true, activationTier: true },
    });

    if (!agent) {
      return res.status(401).json({ error: 'Invalid API key' });
    }

    const valid = await bcrypt.compare(apiKey, agent.apiKeyHash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid API key' });
    }

    // Update lastActiveAt in the background
    prisma.agent.update({
      where: { id: agent.id },
      data: { lastActiveAt: new Date() },
    }).catch((err) => logger.error({ err, agentId: agent.id }, 'Failed to update agent lastActiveAt'));

    req.agent = {
      id: agent.id,
      name: agent.name,
      status: agent.status,
      activationExpiresAt: agent.activationExpiresAt,
      activationTier: agent.activationTier,
    };
    next();
  } catch {
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Same as authenticateAgent but silent on failure — sets req.agent if key present and valid,
 * otherwise just passes through.
 */
export async function optionalAgentAuth(req: AgentAuthRequest, _res: Response, next: NextFunction) {
  const apiKey = req.headers['x-agent-key'] as string | undefined;

  if (!apiKey) {
    return next();
  }

  const prefix = apiKey.substring(0, 8);

  try {
    const agent = await prisma.agent.findUnique({
      where: { apiKeyPrefix: prefix },
      select: { id: true, name: true, apiKeyHash: true, status: true, activationExpiresAt: true, activationTier: true },
    });

    if (!agent) {
      return next();
    }

    const valid = await bcrypt.compare(apiKey, agent.apiKeyHash);
    if (!valid) {
      return next();
    }

    // Update lastActiveAt in the background
    prisma.agent.update({
      where: { id: agent.id },
      data: { lastActiveAt: new Date() },
    }).catch((err) => logger.error({ err, agentId: agent.id }, 'Failed to update agent lastActiveAt'));

    req.agent = {
      id: agent.id,
      name: agent.name,
      status: agent.status,
      activationExpiresAt: agent.activationExpiresAt,
      activationTier: agent.activationTier,
    };
  } catch {
    // Silent failure
  }

  next();
}
