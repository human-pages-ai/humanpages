import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma.js';

export interface AuthRequest extends Request {
  userId?: string;
}

export async function requireEmailVerified(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const user = await prisma.human.findUnique({
      where: { id: req.userId },
      select: { emailVerified: true },
    });

    if (!user || !user.emailVerified) {
      return res.status(403).json({
        error: 'This feature requires email verification. Please check your inbox and verify your email.',
        code: 'EMAIL_NOT_VERIFIED',
      });
    }

    next();
  } catch {
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export async function authenticateToken(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string; iat: number };

    // Check if token has been invalidated
    const user = await prisma.human.findUnique({
      where: { id: payload.userId },
      select: { tokenInvalidatedAt: true },
    });

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    // If tokenInvalidatedAt is set and token was issued before that time, reject it
    if (user.tokenInvalidatedAt && payload.iat * 1000 < user.tokenInvalidatedAt.getTime()) {
      return res.status(401).json({ error: 'Token has been revoked' });
    }

    req.userId = payload.userId;
    if ((req as any).log) {
      (req as any).log = (req as any).log.child({ userId: payload.userId });
    }
    next();
  } catch {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
}
