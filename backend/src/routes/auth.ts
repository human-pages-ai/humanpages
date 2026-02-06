import { Router } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';

const router = Router();

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1),
  referrerId: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(6),
});

router.post('/signup', async (req, res) => {
  try {
    const { email, password, name, referrerId } = signupSchema.parse(req.body);

    const existingUser = await prisma.human.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Validate referrer exists if provided
    let validReferrerId: string | undefined;
    if (referrerId) {
      const referrer = await prisma.human.findUnique({ where: { id: referrerId } });
      if (referrer) {
        validReferrerId = referrerId;
      }
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const human = await prisma.human.create({
      data: {
        email,
        passwordHash,
        name,
        contactEmail: email,
        referredBy: validReferrerId,
      },
      select: { id: true, email: true, name: true },
    });

    const token = jwt.sign({ userId: human.id }, process.env.JWT_SECRET!, { expiresIn: '7d' });

    res.status(201).json({ human, token });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    const human = await prisma.human.findUnique({ where: { email } });
    if (!human) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check if user has a password (OAuth-only users don't)
    if (!human.passwordHash) {
      return res.status(401).json({ error: 'Please use social login for this account' });
    }

    const validPassword = await bcrypt.compare(password, human.passwordHash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ userId: human.id }, process.env.JWT_SECRET!, { expiresIn: '7d' });

    res.json({
      human: { id: human.id, email: human.email, name: human.name },
      token,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Request password reset
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = forgotPasswordSchema.parse(req.body);

    const human = await prisma.human.findUnique({ where: { email } });

    // Always return success to prevent email enumeration
    if (!human) {
      return res.json({ message: 'If an account exists, a reset link has been sent' });
    }

    // Check if user is OAuth-only
    if (!human.passwordHash && (human.googleId || human.githubId)) {
      return res.json({ message: 'If an account exists, a reset link has been sent' });
    }

    // Generate secure token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Invalidate any existing tokens for this email
    await prisma.passwordReset.updateMany({
      where: { email, usedAt: null },
      data: { usedAt: new Date() },
    });

    // Create new reset token
    await prisma.passwordReset.create({
      data: { email, token, expiresAt },
    });

    // In production, send email here
    // For now, log the reset link
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;
    console.log(`Password reset link for ${email}: ${resetUrl}`);

    res.json({ message: 'If an account exists, a reset link has been sent' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Reset password with token
router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = resetPasswordSchema.parse(req.body);

    const resetRecord = await prisma.passwordReset.findUnique({
      where: { token },
    });

    if (!resetRecord) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    if (resetRecord.usedAt) {
      return res.status(400).json({ error: 'Reset token has already been used' });
    }

    if (resetRecord.expiresAt < new Date()) {
      return res.status(400).json({ error: 'Reset token has expired' });
    }

    const human = await prisma.human.findUnique({
      where: { email: resetRecord.email },
    });

    if (!human) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    // Update password and mark token as used
    const passwordHash = await bcrypt.hash(password, 10);

    await prisma.$transaction([
      prisma.human.update({
        where: { id: human.id },
        data: { passwordHash },
      }),
      prisma.passwordReset.update({
        where: { id: resetRecord.id },
        data: { usedAt: new Date() },
      }),
    ]);

    res.json({ message: 'Password has been reset successfully' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Verify reset token (for frontend to check if token is valid before showing form)
router.get('/verify-reset-token', async (req, res) => {
  try {
    const token = req.query.token as string;

    if (!token) {
      return res.status(400).json({ valid: false, error: 'Token required' });
    }

    const resetRecord = await prisma.passwordReset.findUnique({
      where: { token },
    });

    if (!resetRecord || resetRecord.usedAt || resetRecord.expiresAt < new Date()) {
      return res.json({ valid: false });
    }

    res.json({ valid: true });
  } catch (error) {
    console.error('Verify token error:', error);
    res.status(500).json({ valid: false, error: 'Internal server error' });
  }
});

export default router;
