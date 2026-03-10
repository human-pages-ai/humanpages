import { Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma.js';
import { AuthRequest } from './auth.js';

/**
 * Middleware that requires the authenticated user to be a concierge (isCatchAll = true).
 * Must be used AFTER authenticateToken middleware.
 */
export async function requireConcierge(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const user = await prisma.human.findUnique({
      where: { id: req.userId },
      select: { isCatchAll: true, humanStatus: true },
    });

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    if (user.humanStatus !== 'ACTIVE') {
      return res.status(403).json({
        error: 'Account suspended',
        message: 'Your account is not active.',
      });
    }

    if (!user.isCatchAll) {
      return res.status(403).json({
        error: 'Concierge access required',
        message: 'Only concierge staff can access this feature.',
        code: 'NOT_CONCIERGE',
      });
    }

    next();
  } catch (err) {
    console.error('requireConcierge error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
