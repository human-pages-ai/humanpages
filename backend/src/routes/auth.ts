import { Router } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { BCRYPT_ROUNDS } from '../lib/bcrypt-rounds.js';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import { sendPasswordResetEmail, sendVerificationEmail } from '../lib/email.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { trackServerEvent } from '../lib/posthog.js';
import { recordAffiliateReferral } from './affiliate.js';
import { generateReferralCode } from '../lib/referralCode.js';
import { verifyCaptcha } from '../lib/captcha.js';

const router = Router();

async function generateUsername(name: string): Promise<string> {
  const firstName = name.split(/\s+/)[0].replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  const base = firstName.length >= 2 ? firstName : 'user';

  // Try up to 20 times to find a unique username with improved suffix
  for (let i = 0; i < 20; i++) {
    const suffix = Math.random().toString(36).slice(2, 6); // 4-char alphanumeric
    const candidate = `${base}_${suffix}`;
    const existing = await prisma.human.findUnique({
      where: { username: candidate },
      select: { id: true },
    });
    if (!existing) return candidate;
  }
  // Ultra-fallback: timestamp-based, virtually impossible to collide
  return `${base}_${Date.now().toString(36)}`;
}

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(72),
  name: z.string().min(1),
  referrerId: z.string().optional(),
  termsAccepted: z.literal(true, { errorMap: () => ({ message: 'You must accept the Terms of Use and Privacy Policy' }) }),
  captchaToken: z.string().min(1),
  utmSource: z.string().max(100).optional(),
  utmMedium: z.string().max(100).optional(),
  utmCampaign: z.string().max(200).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
  captchaToken: z.string().min(1),
});


const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8).max(72),
});

// Rate limit auth endpoints: 10 requests per 15 minutes per IP
const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: {
    error: 'Too many requests',
    message: 'Rate limit: 10 requests per 15 minutes. Try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  skip: () => process.env.NODE_ENV === 'test',
});

// Global signup throttle: max 100 signups per minute across ALL IPs
// Prevents distributed bot attacks using proxy rotation
const globalSignupThrottle = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: {
    error: 'Too many signups',
    message: 'The service is experiencing high signup volume. Please try again in a minute.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: () => 'global', // Single shared bucket for all IPs
  validate: false,
  skip: () => process.env.NODE_ENV === 'test',
});

router.post('/signup', globalSignupThrottle, authRateLimiter, async (req, res) => {
  try {
    const { email, password, name, referrerId, termsAccepted, captchaToken, utmSource, utmMedium, utmCampaign } = signupSchema.parse(req.body);

    const captchaValid = await verifyCaptcha(captchaToken);
    if (!captchaValid) {
      return res.status(400).json({ error: 'CAPTCHA verification failed. Please try again.' });
    }

    const existingUser = await prisma.human.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Validate referrer exists if provided (accepts referralCode or legacy id)
    let validReferrerId: string | undefined;
    if (referrerId) {
      const referrer = await prisma.human.findUnique({ where: { referralCode: referrerId } })
        ?? await prisma.human.findUnique({ where: { id: referrerId } });
      if (referrer) {
        validReferrerId = referrer.id;
      }
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const username = await generateUsername(name);
    const human = await prisma.human.create({
      data: {
        email,
        passwordHash,
        name,
        username,
        contactEmail: email,
        referredBy: validReferrerId,
        referralCode: generateReferralCode(),
        termsAcceptedAt: new Date(),
        utmSource: utmSource || undefined,
        utmMedium: utmMedium || undefined,
        utmCampaign: utmCampaign || undefined,
      },
      select: { id: true, email: true, name: true, username: true },
    });

    // Track signup in PostHog (pass req for country geolocation)
    trackServerEvent(human.id, 'user_signed_up_server', {
      method: 'email',
      utm_source: utmSource || undefined,
      utm_medium: utmMedium || undefined,
      utm_campaign: utmCampaign || undefined,
    }, req);

    // Record affiliate referral if the referrer is an affiliate
    if (validReferrerId) {
      const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip;
      const userAgentStr = req.headers['user-agent'] as string;
      recordAffiliateReferral(validReferrerId, human.id, clientIp, userAgentStr).catch((err) =>
        logger.error({ err }, 'Failed to record affiliate referral')
      );
    }

    const token = jwt.sign({ userId: human.id }, process.env.JWT_SECRET!, { expiresIn: '7d' });

    // Send verification email
    const verificationToken = crypto.randomBytes(32).toString('hex');
    await prisma.human.update({
      where: { id: human.id },
      data: { emailVerificationToken: verificationToken },
    });
    const verifyUrl = `${process.env.FRONTEND_URL}/api/auth/verify-email?token=${verificationToken}`;
    sendVerificationEmail(email, verifyUrl).catch((err) =>
      logger.error({ err }, 'Failed to send verification email')
    );

    res.status(201).json({ human, token });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors.map(e => e.message).join(', ') });
    }
    logger.error({ err: error }, 'Signup error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/login', authRateLimiter, async (req, res) => {
  try {
    const { email, password, captchaToken } = loginSchema.parse(req.body);

    const captchaValid = await verifyCaptcha(captchaToken);
    if (!captchaValid) {
      return res.status(400).json({ error: 'CAPTCHA verification failed. Please try again.' });
    }

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
      return res.status(400).json({ error: error.errors.map(e => e.message).join(', ') });
    }
    logger.error({ err: error }, 'Login error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Request password reset
router.post('/forgot-password', authRateLimiter, async (req, res) => {
  try {
    const { email } = forgotPasswordSchema.parse(req.body);

    const human = await prisma.human.findUnique({ where: { email } });

    // Always return success to prevent email enumeration
    if (!human) {
      return res.json({ message: 'If an account exists, a reset link has been sent' });
    }

    // Check if user is OAuth-only
    if (!human.passwordHash && human.googleId) {
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

    // Send password reset email
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;
    await sendPasswordResetEmail(email, resetUrl);
    logger.info({ email }, 'Password reset link generated');

    res.json({ message: 'If an account exists, a reset link has been sent' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors.map(e => e.message).join(', ') });
    }
    logger.error({ err: error }, 'Forgot password error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Reset password with token
router.post('/reset-password', authRateLimiter, async (req, res) => {
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
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

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
      return res.status(400).json({ error: error.errors.map(e => e.message).join(', ') });
    }
    logger.error({ err: error }, 'Reset password error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Verify reset token (for frontend to check if token is valid before showing form)
router.get('/verify-reset-token', authRateLimiter, async (req, res) => {
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
    logger.error({ err: error }, 'Verify token error');
    res.status(500).json({ valid: false, error: 'Internal server error' });
  }
});

// Verify email
router.get('/verify-email', async (req, res) => {
  try {
    const token = req.query.token as string;
    if (!token) {
      return res.redirect(`${process.env.FRONTEND_URL}/dashboard?emailVerifyError=true`);
    }

    const human = await prisma.human.findFirst({
      where: { emailVerificationToken: token },
    });

    if (!human) {
      return res.redirect(`${process.env.FRONTEND_URL}/dashboard?emailVerifyError=true`);
    }

    await prisma.human.update({
      where: { id: human.id },
      data: { emailVerified: true, emailVerificationToken: null },
    });

    res.redirect(`${process.env.FRONTEND_URL}/email-verified`);
  } catch (error) {
    logger.error({ err: error }, 'Verify email error');
    res.redirect(`${process.env.FRONTEND_URL}/dashboard?emailVerifyError=true`);
  }
});

// Unsubscribe from email notifications
router.get('/unsubscribe', async (req, res) => {
  try {
    const token = req.query.token as string;
    if (!token) {
      return res.redirect(`${process.env.FRONTEND_URL}/dashboard`);
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string; action: string };
    if (payload.action !== 'unsubscribe') {
      return res.redirect(`${process.env.FRONTEND_URL}/dashboard`);
    }

    await prisma.human.update({
      where: { id: payload.userId },
      data: { emailNotifications: false },
    });

    res.redirect(`${process.env.FRONTEND_URL}/dashboard?unsubscribed=true`);
  } catch (error) {
    logger.error({ err: error }, 'Unsubscribe error');
    res.redirect(`${process.env.FRONTEND_URL}/dashboard`);
  }
});

// Resend verification email
router.post('/resend-verification', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const human = await prisma.human.findUnique({ where: { id: req.userId } });
    if (!human) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (human.emailVerified) {
      return res.json({ message: 'Email already verified' });
    }

    const verificationToken = crypto.randomBytes(32).toString('hex');
    await prisma.human.update({
      where: { id: human.id },
      data: { emailVerificationToken: verificationToken },
    });

    const verifyUrl = `${process.env.FRONTEND_URL}/api/auth/verify-email?token=${verificationToken}`;
    await sendVerificationEmail(human.email, verifyUrl);

    res.json({ message: 'Verification email sent' });
  } catch (error) {
    logger.error({ err: error }, 'Resend verification error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Logout from all devices (invalidates all existing tokens)
router.post('/logout-all', authenticateToken, async (req: AuthRequest, res) => {
  try {
    await prisma.human.update({
      where: { id: req.userId },
      data: { tokenInvalidatedAt: new Date() },
    });

    res.json({ message: 'Logged out from all devices' });
  } catch (error) {
    logger.error({ err: error }, 'Logout all error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// WhatsApp magic link login
router.post('/magic-login', authRateLimiter, async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ error: 'Token required' });
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string; type: string };
    if (payload.type !== 'whatsapp_login') {
      return res.status(400).json({ error: 'Invalid token type' });
    }

    const human = await prisma.human.findUnique({ where: { id: payload.userId } });
    if (!human) {
      return res.status(404).json({ error: 'Account not found' });
    }

    const authToken = jwt.sign({ userId: human.id }, process.env.JWT_SECRET!, { expiresIn: '7d' });

    res.json({
      token: authToken,
      user: {
        id: human.id,
        email: human.email,
        name: human.name,
      },
    });
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Magic link expired. Send LOGIN to WhatsApp to get a new one.' });
    }
    logger.error({ err: error }, 'Magic login error');
    res.status(400).json({ error: 'Invalid or expired token' });
  }
});

// ──────────────────────────────────────────────────────────
// WhatsApp OTP: Send code
// ──────────────────────────────────────────────────────────
const whatsappSendOtpSchema = z.object({
  phone: z.string().min(8).max(20).regex(/^\+\d+$/, 'Phone must be in E.164 format (e.g. +972506910990)'),
  captchaToken: z.string().min(1),
});

router.post('/whatsapp/send-otp', authRateLimiter, async (req, res) => {
  try {
    const { phone, captchaToken } = whatsappSendOtpSchema.parse(req.body);

    const captchaValid = await verifyCaptcha(captchaToken);
    if (!captchaValid) {
      return res.status(400).json({ error: 'CAPTCHA verification failed. Please try again.' });
    }

    const { isWhatsAppEnabled, sendWhatsAppMessage } = await import('../lib/whatsapp.js');
    if (!isWhatsAppEnabled()) {
      return res.status(503).json({ error: 'WhatsApp is not available at the moment' });
    }

    // Rate limit: max 3 OTPs per phone per 15 minutes
    const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000);
    const recentOtps = await prisma.whatsAppOTP.count({
      where: { phone, createdAt: { gt: fifteenMinAgo } },
    });
    if (recentOtps >= 3) {
      return res.status(429).json({ error: 'Too many codes requested. Please wait a few minutes.' });
    }

    // Generate 6-digit OTP
    const code = String(crypto.randomInt(100000, 999999));
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    await prisma.whatsAppOTP.create({
      data: { phone, code, expiresAt },
    });

    // Send via WhatsApp
    await sendWhatsAppMessage(phone, `Your Human Pages verification code is: ${code}\n\nThis code expires in 5 minutes.`);

    logger.info({ phone: phone.slice(0, 6) + '***' }, 'WhatsApp OTP sent');
    res.json({ message: 'Verification code sent to your WhatsApp' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors.map(e => e.message).join(', ') });
    }
    logger.error({ err: error }, 'WhatsApp send OTP error');
    res.status(500).json({ error: 'Failed to send verification code' });
  }
});

// ──────────────────────────────────────────────────────────
// WhatsApp OTP: Verify code & login/signup
// ──────────────────────────────────────────────────────────
const whatsappVerifyOtpSchema = z.object({
  phone: z.string().min(8).max(20).regex(/^\+\d+$/),
  code: z.string().length(6),
  // For signup only (optional — if existing account, these are ignored)
  name: z.string().min(1).optional(),
  termsAccepted: z.boolean().optional(),
  referrerId: z.string().optional(),
  utmSource: z.string().max(100).optional(),
  utmMedium: z.string().max(100).optional(),
  utmCampaign: z.string().max(200).optional(),
});

router.post('/whatsapp/verify-otp', authRateLimiter, async (req, res) => {
  try {
    const { phone, code, name, termsAccepted, referrerId, utmSource, utmMedium, utmCampaign } = whatsappVerifyOtpSchema.parse(req.body);

    // Find valid OTP
    const otp = await prisma.whatsAppOTP.findFirst({
      where: {
        phone,
        code,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!otp) {
      // Increment attempts on most recent OTP for this phone
      const latest = await prisma.whatsAppOTP.findFirst({
        where: { phone, usedAt: null, expiresAt: { gt: new Date() } },
        orderBy: { createdAt: 'desc' },
      });
      if (latest) {
        if (latest.attempts >= 4) {
          // Burn the OTP after 5 failed attempts
          await prisma.whatsAppOTP.update({
            where: { id: latest.id },
            data: { usedAt: new Date() },
          });
          return res.status(400).json({ error: 'Too many attempts. Please request a new code.' });
        }
        await prisma.whatsAppOTP.update({
          where: { id: latest.id },
          data: { attempts: { increment: 1 } },
        });
      }
      return res.status(400).json({ error: 'Invalid or expired code' });
    }

    // Check if phone number is already linked to an account
    let human = await prisma.human.findFirst({
      where: { whatsapp: phone, whatsappVerified: true },
      select: { id: true, email: true, name: true },
    });

    let isNew = false;

    if (human) {
      // Existing user — login. Consume OTP now.
      await prisma.whatsAppOTP.update({
        where: { id: otp.id },
        data: { usedAt: new Date() },
      });
      await prisma.human.update({
        where: { id: human.id },
        data: { whatsappLastInboundAt: new Date() },
      });
    } else {
      // New user — need name + terms to complete signup. OTP stays valid.
      if (!name || !termsAccepted) {
        return res.json({ needsSignup: true, message: 'Phone verified. Please provide your name to create an account.' });
      }

      // All fields present — consume OTP now
      await prisma.whatsAppOTP.update({
        where: { id: otp.id },
        data: { usedAt: new Date() },
      });

      // Validate referrer
      let validReferrerId: string | undefined;
      if (referrerId) {
        const referrer = await prisma.human.findUnique({ where: { referralCode: referrerId } })
          ?? await prisma.human.findUnique({ where: { id: referrerId } });
        if (referrer) validReferrerId = referrer.id;
      }

      // Create account with WhatsApp as primary identity (no email/password needed)
      const placeholderEmail = `wa_${phone.replace('+', '')}@whatsapp.hp.internal`;
      const username = await generateUsername(name);

      human = await prisma.human.create({
        data: {
          email: placeholderEmail,
          name,
          username,
          contactEmail: null,
          whatsapp: phone,
          whatsappVerified: true,
          whatsappLastInboundAt: new Date(),
          referredBy: validReferrerId,
          referralCode: generateReferralCode(),
          termsAcceptedAt: new Date(),
          utmSource: utmSource || undefined,
          utmMedium: utmMedium || undefined,
          utmCampaign: utmCampaign || undefined,
        },
        select: { id: true, email: true, name: true, username: true },
      });

      isNew = true;

      trackServerEvent(human.id, 'user_signed_up_server', {
        method: 'whatsapp',
        utm_source: utmSource || undefined,
        utm_medium: utmMedium || undefined,
        utm_campaign: utmCampaign || undefined,
      }, req);

      if (validReferrerId) {
        const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip;
        const userAgentStr = req.headers['user-agent'] as string;
        recordAffiliateReferral(validReferrerId, human.id, clientIp, userAgentStr).catch((err) =>
          logger.error({ err }, 'Failed to record affiliate referral')
        );
      }
    }

    const token = jwt.sign({ userId: human.id }, process.env.JWT_SECRET!, { expiresIn: '7d' });

    logger.info({ humanId: human.id, isNew, phone: phone.slice(0, 6) + '***' }, 'WhatsApp OTP login');
    res.json({ human, token, isNew });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors.map(e => e.message).join(', ') });
    }
    logger.error({ err: error }, 'WhatsApp verify OTP error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

export { generateUsername };
export default router;
