import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { AuthRequest, authenticateToken } from './auth.js';
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
      logger.warn({ userId: req.userId }, 'Non-admin attempted admin access');
      return res.status(403).json({ error: 'Admin access required' });
    }

    next();
  } catch (error) {
    logger.error({ err: error }, 'Admin auth check failed');
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Tries to authenticate a per-user staff API key.
 * Looks up key by prefix (first 8 chars), then bcrypt-compares the full key.
 * If valid, sets req.userId to the key owner's humanId.
 * If not found/invalid, calls next() without error (fall through to shared key).
 */
async function authenticateStaffApiKey(apiKey: string, req: AuthRequest): Promise<boolean> {
  try {
    const prefix = apiKey.substring(0, 8);
    const staffKey = await prisma.staffApiKey.findUnique({
      where: { apiKeyPrefix: prefix },
    });
    if (!staffKey) return false;

    const valid = await bcrypt.compare(apiKey, staffKey.apiKeyHash);
    if (!valid) return false;

    req.userId = staffKey.humanId;
    return true;
  } catch (error) {
    logger.error({ err: error }, 'Staff API key auth error');
    return false;
  }
}

/**
 * Tries JWT auth first; if no token present, falls back to API key.
 * For API keys, tries per-user staff key first, then shared AI_ADMIN_API_KEY.
 * Use on routes that need to work from both browser (JWT) and extensions/CLI (API key).
 */
export function jwtOrApiKey(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const hasJwt = authHeader && authHeader.startsWith('Bearer ');
  const apiKey = req.headers['x-admin-api-key'] as string | undefined;

  if (hasJwt) {
    // Delegate to standard JWT auth — it will set req.userId
    return authenticateToken(req as AuthRequest, res, next);
  }

  if (apiKey) {
    // Try per-user staff key first, then fall back to shared key
    authenticateStaffApiKey(apiKey, req as AuthRequest).then((matched) => {
      if (matched) {
        return next();
      }
      // Fall back to shared AI_ADMIN_API_KEY
      return apiKeyAdmin(req, res, next);
    }).catch(() => {
      return apiKeyAdmin(req, res, next);
    });
    return;
  }

  return res.status(401).json({ error: 'Authentication required (JWT or API key)' });
}

/**
 * Admin JWT or shared AI_ADMIN_API_KEY only. Staff API keys are rejected.
 * Use on sensitive admin routes that should only be accessible by admin users
 * or the local AI assistant via the shared admin API key.
 */
export function adminJwtOrSharedKey(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const hasJwt = authHeader && authHeader.startsWith('Bearer ');
  const apiKey = req.headers['x-admin-api-key'] as string | undefined;

  if (hasJwt) {
    // JWT path — delegate to JWT auth, then requireAdmin will check role
    return authenticateToken(req as AuthRequest, res, () => {
      return requireAdmin(req as AuthRequest, res, next);
    });
  }

  if (apiKey) {
    // Only accept the shared AI_ADMIN_API_KEY, not per-user staff keys
    const expected = process.env.AI_ADMIN_API_KEY;
    if (expected && apiKey.length === expected.length &&
        crypto.timingSafeEqual(Buffer.from(apiKey), Buffer.from(expected))) {
      (req as any).effectiveRole = 'ADMIN';
      return next();
    }
  }

  return res.status(401).json({ error: 'Admin JWT or AI admin API key required' });
}

/**
 * After jwtOrApiKey, enforce staff/admin for JWT users. API-key users skip this.
 */
export async function requireStaffOrApiKey(req: AuthRequest, res: Response, next: NextFunction) {
  // If userId is set, JWT was used — enforce role check
  if (req.userId) {
    return requireStaffOrAdmin(req, res, next);
  }
  // API key already validated — pass through
  (req as any).effectiveRole = 'ADMIN';
  next();
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
      logger.warn({ userId: req.userId }, 'Unauthorized staff/admin access attempt');
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
