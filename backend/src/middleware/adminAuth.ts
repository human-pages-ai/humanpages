import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.js';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';

const DEFAULT_ADMIN_EMAILS = 'hello@humanpages.ai';

function getAdminEmails(): Set<string> {
  const raw = process.env.ADMIN_EMAILS || DEFAULT_ADMIN_EMAILS;
  return new Set(
    raw.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean)
  );
}

export async function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const user = await prisma.human.findUnique({
      where: { id: req.userId },
      select: { email: true },
    });

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    const adminEmails = getAdminEmails();
    if (!adminEmails.has(user.email.toLowerCase())) {
      logger.warn({ userId: req.userId, email: user.email }, 'Non-admin attempted admin access');
      return res.status(403).json({ error: 'Admin access required' });
    }

    next();
  } catch (error) {
    logger.error({ err: error }, 'Admin auth check failed');
    return res.status(500).json({ error: 'Internal server error' });
  }
}
