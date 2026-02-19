import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { AuthRequest } from './auth.js';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import { HumanRole } from '@prisma/client';

const DEFAULT_ADMIN_EMAILS = 'hello@humanpages.ai';

function getAdminEmails(): Set<string> {
  const raw = process.env.ADMIN_EMAILS || DEFAULT_ADMIN_EMAILS;
  return new Set(
    raw.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean)
  );
}

/**
 * Returns the effective role for a user, accounting for ADMIN_EMAILS env var.
 * If the user's email is in ADMIN_EMAILS, they are always ADMIN regardless of DB role.
 */
export function getEffectiveRole(email: string, dbRole: HumanRole): 'USER' | 'STAFF' | 'ADMIN' {
  const adminEmails = getAdminEmails();
  if (adminEmails.has(email.toLowerCase())) {
    return 'ADMIN';
  }
  return dbRole;
}

/**
 * Checks X-Admin-API-Key header against AI_ADMIN_API_KEY env var.
 * Use on select read-only admin routes to allow CLI/automation access.
 */
export function apiKeyAdmin(req: Request, res: Response, next: NextFunction) {
  const key = req.headers['x-admin-api-key'] as string | undefined;
  const expected = process.env.AI_ADMIN_API_KEY;
  if (key && expected && key.length === expected.length &&
      crypto.timingSafeEqual(Buffer.from(key), Buffer.from(expected))) {
    return next();
  }
  return res.status(401).json({ error: 'Invalid API key' });
}

export async function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const user = await prisma.human.findUnique({
      where: { id: req.userId },
      select: { email: true, role: true },
    });

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    const effectiveRole = getEffectiveRole(user.email, user.role);
    if (effectiveRole !== 'ADMIN') {
      logger.warn({ userId: req.userId, email: user.email }, 'Non-admin attempted admin access');
      return res.status(403).json({ error: 'Admin access required' });
    }

    next();
  } catch (error) {
    logger.error({ err: error }, 'Admin auth check failed');
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export async function requireStaffOrAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const user = await prisma.human.findUnique({
      where: { id: req.userId },
      select: { email: true, role: true },
    });

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    const effectiveRole = getEffectiveRole(user.email, user.role);
    if (effectiveRole !== 'ADMIN' && effectiveRole !== 'STAFF') {
      logger.warn({ userId: req.userId, email: user.email }, 'Unauthorized staff/admin access attempt');
      return res.status(403).json({ error: 'Staff or admin access required' });
    }

    // Attach role to request for downstream use
    (req as any).effectiveRole = effectiveRole;

    next();
  } catch (error) {
    logger.error({ err: error }, 'Staff/admin auth check failed');
    return res.status(500).json({ error: 'Internal server error' });
  }
}
