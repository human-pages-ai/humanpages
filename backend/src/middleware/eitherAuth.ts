import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma.js';

export interface EitherAuthRequest extends Request {
  senderType?: 'human' | 'agent';
  senderId?: string;
  senderName?: string;
}

/**
 * Tries human JWT first, then falls back to agent X-Agent-Key.
 * Sets req.senderType, req.senderId, req.senderName on success.
 * Returns 401 if neither succeeds.
 */
export async function authenticateEither(req: EitherAuthRequest, res: Response, next: NextFunction) {
  // Try JWT first
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token) {
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string; iat: number };
      const user = await prisma.human.findUnique({
        where: { id: payload.userId },
        select: { id: true, name: true, tokenInvalidatedAt: true },
      });

      if (user) {
        if (!user.tokenInvalidatedAt || payload.iat * 1000 >= user.tokenInvalidatedAt.getTime()) {
          req.senderType = 'human';
          req.senderId = user.id;
          req.senderName = user.name;
          return next();
        }
      }
    } catch {
      // JWT failed, try agent key below
    }
  }

  // Try agent X-Agent-Key
  const apiKey = req.headers['x-agent-key'] as string | undefined;

  if (apiKey) {
    const prefix = apiKey.substring(0, 8);
    try {
      const agent = await prisma.agent.findUnique({
        where: { apiKeyPrefix: prefix },
        select: { id: true, name: true, apiKeyHash: true, status: true, activationExpiresAt: true },
      });

      if (agent) {
        const valid = await bcrypt.compare(apiKey, agent.apiKeyHash);
        if (valid) {
          // Update lastActiveAt in the background
          prisma.agent.update({
            where: { id: agent.id },
            data: { lastActiveAt: new Date() },
          }).catch(() => {});

          req.senderType = 'agent';
          req.senderId = agent.id;
          req.senderName = agent.name;
          // Store status for requireActiveIfAgent middleware
          (req as any).agentStatus = agent.status;
          (req as any).agentActivationExpiresAt = agent.activationExpiresAt;
          return next();
        }
      }
    } catch {
      // Agent auth failed
    }
  }

  return res.status(401).json({ error: 'Authentication required (JWT or X-Agent-Key)' });
}
