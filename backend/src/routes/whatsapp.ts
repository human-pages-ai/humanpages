import { Router } from 'express';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import { prisma } from '../lib/prisma.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { isWhatsAppEnabled, getWhatsAppNumber, sendWhatsAppMessage, verifyTwilioSignature } from '../lib/whatsapp.js';
import { logger } from '../lib/logger.js';
import { generateReferralCode } from '../lib/referralCode.js';
import { trackServerEvent } from '../lib/posthog.js';
import jwt from 'jsonwebtoken';

// Rate limit webhook to prevent brute-force on link codes
const webhookRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
});

const router = Router();

// Job status priority for inbound message routing (higher = more likely the target)
const STATUS_PRIORITY: Record<string, number> = {
  STREAMING: 6,
  PAID: 5,
  ACCEPTED: 4,
  SUBMITTED: 3,
  PENDING: 2,
  PAUSED: 1,
};

// ──────────────────────────────────────────────────────────
// GET /api/whatsapp/status — connection status for dashboard
// ──────────────────────────────────────────────────────────
router.get('/status', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const human = await prisma.human.findUnique({
      where: { id: req.userId },
      select: { whatsapp: true, whatsappVerified: true },
    });

    res.json({
      connected: !!human?.whatsappVerified,
      whatsappNumber: human?.whatsapp ?? null,
      botAvailable: isWhatsAppEnabled(),
      botNumber: getWhatsAppNumber(),
    });
  } catch (error) {
    logger.error({ err: error }, 'WhatsApp status error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ──────────────────────────────────────────────────────────
// POST /api/whatsapp/link — generate link code for self-connect
// ──────────────────────────────────────────────────────────
router.post('/link', authenticateToken, async (req: AuthRequest, res) => {
  try {
    if (!isWhatsAppEnabled()) {
      return res.status(400).json({ error: 'WhatsApp not configured' });
    }

    const code = generateLinkCode();
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48h

    await prisma.human.update({
      where: { id: req.userId },
      data: { linkCode: code, linkCodeExpiresAt: expiresAt },
    });

    const botNumber = getWhatsAppNumber();
    const waLink = botNumber ? `https://wa.me/${botNumber.replace('+', '')}?text=${encodeURIComponent(code)}` : null;

    res.json({
      code,
      waLink,
      expiresIn: '48 hours',
    });
  } catch (error) {
    logger.error({ err: error }, 'WhatsApp link error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ──────────────────────────────────────────────────────────
// DELETE /api/whatsapp/link — disconnect WhatsApp
// ──────────────────────────────────────────────────────────
router.delete('/link', authenticateToken, async (req: AuthRequest, res) => {
  try {
    await prisma.human.update({
      where: { id: req.userId },
      data: {
        whatsapp: null,
        whatsappVerified: false,
        linkCode: null,
        linkCodeExpiresAt: null,
      },
    });

    res.json({ message: 'WhatsApp disconnected' });
  } catch (error) {
    logger.error({ err: error }, 'WhatsApp disconnect error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ──────────────────────────────────────────────────────────
// POST /api/whatsapp/incoming — Twilio webhook
// ──────────────────────────────────────────────────────────
router.post('/incoming', webhookRateLimiter, async (req, res) => {
  // Always respond 200 to Twilio (or it retries)
  const reply = (msg: string) => {
    res.set('Content-Type', 'text/xml');
    res.send(`<Response><Message>${escapeXml(msg)}</Message></Response>`);
  };

  const ack = () => {
    res.set('Content-Type', 'text/xml');
    res.send('<Response></Response>');
  };

  try {
    // Verify Twilio signature when credentials are configured (skip in local dev with TWILIO_SKIP_SIGNATURE=1)
    if (isWhatsAppEnabled() && !process.env.TWILIO_SKIP_SIGNATURE) {
      const sig = req.headers['x-twilio-signature'] as string;
      const baseUrl = process.env.BASE_URL || process.env.FRONTEND_URL?.replace(/:\d+$/, ':3001') || `${req.protocol}://${req.get('host')}`;
      const fullUrl = `${baseUrl}${req.originalUrl}`;
      if (!sig || !verifyTwilioSignature(fullUrl, req.body || {}, sig)) {
        logger.warn('Invalid Twilio signature on incoming WhatsApp');
        return res.status(403).send('Forbidden');
      }
    }

    // Validate input types (Twilio sends url-encoded strings, but forged requests could differ)
    const rawFrom = req.body?.From;
    const rawBody = req.body?.Body;
    if (rawFrom && typeof rawFrom !== 'string') return ack();
    if (rawBody && typeof rawBody !== 'string') return ack();

    const from = typeof rawFrom === 'string' ? rawFrom.replace('whatsapp:', '') : '';
    const body = (typeof rawBody === 'string' ? rawBody : '').trim();

    if (!from) {
      return ack();
    }

    // ── 1. Check if message is a link code ──
    const linkResult = await handleLinkCode(from, body);
    if (linkResult) {
      return reply(linkResult);
    }

    // ── 2. Find human by WhatsApp number ──
    const human = await prisma.human.findFirst({
      where: { whatsapp: from, whatsappVerified: true },
      select: {
        id: true,
        name: true,
        whatsappAwaitingJobSelection: true,
        whatsappDisambiguationAt: true,
      },
    });

    if (!human) {
      return await handleInboundSignup(from, body, reply);
    }

    // Update last inbound timestamp (for 24h window tracking)
    await prisma.human.update({
      where: { id: human.id },
      data: { whatsappLastInboundAt: new Date() },
    });

    // ── 3. Flush pending messages if any ──
    const flushed = await flushPendingMessages(human.id, from);

    // ── 4. Check for special keywords ──
    const upperBody = body.toUpperCase();

    if (upperBody === 'LOGIN' || upperBody === 'WALLET') {
      return await handleLoginKeyword(human.id, from, reply);
    }

    // If we just flushed pending messages, swallow this reply (it was the unlock trigger)
    if (flushed) {
      return ack();
    }

    // ── 5. Handle disambiguation response ──
    if (human.whatsappAwaitingJobSelection) {
      const disambResult = await handleDisambiguation(human.id, body, from);
      if (disambResult) {
        return reply(disambResult);
      }
    }

    // ── 6. Route message to active job ──
    return await routeToJob(human.id, human.name, body, from, reply, ack);
  } catch (error) {
    logger.error({ err: error }, 'WhatsApp webhook error');
    return ack();
  }
});

// ──────────────────────────────────────────────────────────
// Link code handler
// ──────────────────────────────────────────────────────────
async function handleLinkCode(from: string, body: string): Promise<string | null> {
  // Extract link code from anywhere in the message (user might quote-reply)
  const match = body.match(/HP-[A-Z0-9]{4}-[A-Z0-9]{2}/i);
  if (!match) {
    return null;
  }

  const code = match[0].toUpperCase();
  const human = await prisma.human.findFirst({
    where: {
      linkCode: code,
      linkCodeExpiresAt: { gt: new Date() },
    },
  });

  if (!human) {
    return 'Invalid or expired link code. Please request a new one.';
  }

  // Check if this phone number is already linked to a different account
  const existing = await prisma.human.findFirst({
    where: { whatsapp: from, whatsappVerified: true, id: { not: human.id } },
  });

  if (existing) {
    return 'This phone number is already linked to another Human Pages account. Please use a different number or contact support.';
  }

  // Bind the phone number and activate
  await prisma.human.update({
    where: { id: human.id },
    data: {
      whatsapp: from,
      whatsappVerified: true,
      linkCode: null,
      linkCodeExpiresAt: null,
      whatsappLastInboundAt: new Date(),
    },
  });

  logger.info({ humanId: human.id, from }, 'WhatsApp linked via code');
  return "You're connected to Human Pages! You'll receive job offers and messages here.";
}

// ──────────────────────────────────────────────────────────
// Flush pending messages (queued while outside 24h window)
// ──────────────────────────────────────────────────────────
async function flushPendingMessages(humanId: string, to: string): Promise<boolean> {
  const pending = await prisma.pendingWhatsAppMessage.findMany({
    where: { humanId },
    orderBy: { createdAt: 'asc' },
  });

  if (pending.length === 0) return false;

  // Format and send
  let body: string;
  if (pending.length === 1) {
    body = pending[0].content;
  } else {
    body = `You have ${pending.length} pending messages:\n\n` +
      pending.map((m, i) => `${i + 1}. ${m.content}`).join('\n\n');
  }

  await sendWhatsAppMessage(to, body);

  // Delete flushed messages
  await prisma.pendingWhatsAppMessage.deleteMany({ where: { humanId } });

  return true;
}

// ──────────────────────────────────────────────────────────
// LOGIN keyword handler — generate magic link
// ──────────────────────────────────────────────────────────
async function handleLoginKeyword(humanId: string, _to: string, reply: (msg: string) => void): Promise<void> {
  const token = jwt.sign({ userId: humanId, type: 'whatsapp_login' }, process.env.JWT_SECRET!, { expiresIn: '5m' });
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const link = `${frontendUrl}/auth/magic?token=${token}`;

  // Reply via TwiML only (not API) to avoid sending two messages
  reply(`Your login link (expires in 5 minutes):\n${link}`);
}

// ──────────────────────────────────────────────────────────
// Disambiguation handler (user is replying to "which job?")
// ──────────────────────────────────────────────────────────
async function handleDisambiguation(humanId: string, body: string, from: string): Promise<string | null> {
  // Check if disambiguation timed out (10 min)
  const human = await prisma.human.findUnique({
    where: { id: humanId },
    select: { whatsappDisambiguationAt: true },
  });

  const tenMinutes = 10 * 60 * 1000;
  if (!human?.whatsappDisambiguationAt || Date.now() - human.whatsappDisambiguationAt.getTime() > tenMinutes) {
    // Timed out, clear state
    await prisma.human.update({
      where: { id: humanId },
      data: { whatsappAwaitingJobSelection: false, whatsappDisambiguationAt: null },
    });
    return null; // Fall through to normal routing
  }

  const pick = parseInt(body, 10);
  if (isNaN(pick) || pick < 1) {
    return 'Please reply with the number of the job you want to message (e.g. "1" or "2").';
  }

  // Get their active jobs in the same order we showed them
  const jobs = await getActiveJobsSorted(humanId);

  if (pick > jobs.length) {
    return `Please pick a number between 1 and ${jobs.length}.`;
  }

  // Clear disambiguation state
  await prisma.human.update({
    where: { id: humanId },
    data: { whatsappAwaitingJobSelection: false, whatsappDisambiguationAt: null },
  });

  const selectedJob = jobs[pick - 1];
  return `Got it! Future messages will be routed to "${selectedJob.title}". Send your message now.`;
}

// ──────────────────────────────────────────────────────────
// Route inbound message to the correct job
// ──────────────────────────────────────────────────────────
async function routeToJob(humanId: string, humanName: string, body: string, from: string, reply: (msg: string) => void, ack: () => void) {
  const jobs = await getActiveJobsSorted(humanId);

  if (jobs.length === 0) {
    return reply('No active jobs found. When you receive a job offer, you can reply here.');
  }

  if (jobs.length === 1) {
    await createJobMessage(jobs[0].id, humanId, humanName, body, jobs[0].callbackUrl, jobs[0].callbackSecret);
    return ack();
  }

  // Multiple active jobs — ask for disambiguation
  const list = jobs.map((j, i) => `${i + 1}. ${j.title} (${j.status})`).join('\n');

  await prisma.human.update({
    where: { id: humanId },
    data: { whatsappAwaitingJobSelection: true, whatsappDisambiguationAt: new Date() },
  });

  return reply(`You have ${jobs.length} active jobs. Which one are you replying to?\n\n${list}\n\nReply with the number.`);
}

// ──────────────────────────────────────────────────────────
// Get active jobs sorted by status priority
// ──────────────────────────────────────────────────────────
async function getActiveJobsSorted(humanId: string) {
  const activeStatuses = ['STREAMING', 'PAID', 'ACCEPTED', 'SUBMITTED', 'PENDING', 'PAUSED'] as const;
  const jobs = await prisma.job.findMany({
    where: { humanId, status: { in: activeStatuses as any } },
    select: { id: true, title: true, status: true, callbackUrl: true, callbackSecret: true },
  });

  return jobs.sort((a, b) => (STATUS_PRIORITY[b.status] || 0) - (STATUS_PRIORITY[a.status] || 0));
}

// ──────────────────────────────────────────────────────────
// Create a job message from inbound WhatsApp
// ──────────────────────────────────────────────────────────
async function createJobMessage(jobId: string, humanId: string, humanName: string, content: string, callbackUrl?: string | null, callbackSecret?: string | null) {
  const message = await prisma.jobMessage.create({
    data: {
      jobId,
      senderType: 'human',
      senderId: humanId,
      senderName: humanName,
      content: content.slice(0, 2000),
    },
  });

  // Fire agent webhook if configured
  if (callbackUrl) {
    const { fireWebhook } = await import('../lib/webhook.js');
    fireWebhook(
      { id: jobId, callbackUrl, callbackSecret } as any,
      'job.message',
      {
        messageId: message.id,
        senderType: 'human',
        senderId: humanId,
        senderName: humanName,
        content: message.content,
        createdAt: message.createdAt.toISOString(),
      },
    );
  }

  logger.info({ jobId, humanId }, 'WhatsApp message routed to job');
}

// ──────────────────────────────────────────────────────────
// Inbound conversational signup
// ──────────────────────────────────────────────────────────
const SIGNUP_SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes
const MAX_SIGNUP_SESSIONS_PER_HOUR = 3;

async function handleInboundSignup(from: string, body: string, reply: (msg: string) => void): Promise<void> {
  // Check for existing session (delete if expired)
  const existing = await prisma.whatsAppSignupSession.findUnique({ where: { phone: from } });
  if (existing && existing.expiresAt < new Date()) {
    await prisma.whatsAppSignupSession.delete({ where: { id: existing.id } });
  }

  const session = existing && existing.expiresAt >= new Date() ? existing : null;

  if (!session) {
    // Rate limit: max 3 new sessions per phone per hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentCount = await prisma.whatsAppSignupSession.count({
      where: { phone: from, createdAt: { gte: oneHourAgo } },
    });
    // Count is 0 after deletion, so this works for both fresh and expired cases
    if (recentCount >= MAX_SIGNUP_SESSIONS_PER_HOUR) {
      return reply('Too many signup attempts. Please try again later.');
    }

    // If the message looks like a link code, tell them it's invalid rather than starting signup
    if (/HP-[A-Z0-9]{4}-[A-Z0-9]{2}/i.test(body)) {
      return reply('Invalid or expired link code. Please request a new one from your dashboard.');
    }

    // Create new session
    await prisma.whatsAppSignupSession.create({
      data: {
        phone: from,
        step: 'AWAITING_NAME',
        expiresAt: new Date(Date.now() + SIGNUP_SESSION_TTL_MS),
      },
    });

    const frontendUrl = process.env.FRONTEND_URL || 'https://humanpages.io';
    return reply(
      `Welcome to Human Pages! 🤝\n\n` +
      `I can create an account for you right here.\n\n` +
      `What's your name?`
    );
  }

  if (session.step === 'AWAITING_NAME') {
    const name = body.slice(0, 100).trim();
    if (!name || name.length < 2) {
      return reply('Please send me your name (at least 2 characters).');
    }

    await prisma.whatsAppSignupSession.update({
      where: { id: session.id },
      data: { name, step: 'AWAITING_TERMS' },
    });

    const frontendUrl = process.env.FRONTEND_URL || 'https://humanpages.io';
    return reply(
      `Thanks, ${name}! One more step.\n\n` +
      `By replying YES, you agree to our Terms of Service and Privacy Policy:\n` +
      `${frontendUrl}/terms\n\n` +
      `Reply YES to create your account.`
    );
  }

  if (session.step === 'AWAITING_TERMS') {
    if (body.toUpperCase() !== 'YES') {
      return reply('Reply YES to accept the terms and create your account, or wait 30 minutes to cancel.');
    }

    const name = session.name || 'Human';
    const phone = session.phone;
    const placeholderEmail = `wa_${phone.replace('+', '')}@whatsapp.hp.internal`;

    // Check if account with this phone already exists (edge case: linked between steps)
    const existingHuman = await prisma.human.findFirst({
      where: { whatsapp: phone, whatsappVerified: true },
    });

    if (existingHuman) {
      await prisma.whatsAppSignupSession.delete({ where: { id: session.id } });
      return reply(`You already have an account! Send LOGIN to get a login link, or just reply to any job offer.`);
    }

    // Check if placeholder email already exists (previous abandoned account)
    const existingEmail = await prisma.human.findFirst({
      where: { email: placeholderEmail },
    });

    if (existingEmail) {
      // Re-link existing placeholder account
      await prisma.human.update({
        where: { id: existingEmail.id },
        data: {
          name,
          whatsapp: phone,
          whatsappVerified: true,
          whatsappLastInboundAt: new Date(),
          termsAcceptedAt: new Date(),
        },
      });
      await prisma.whatsAppSignupSession.delete({ where: { id: session.id } });
      logger.info({ humanId: existingEmail.id, phone }, 'WhatsApp inbound signup re-linked existing account');
      return reply(
        `Welcome back, ${name}! Your account has been reactivated. 🎉\n\n` +
        `You'll receive job offers from AI agents here. Send LOGIN anytime to access your dashboard.`
      );
    }

    // Create new account
    const human = await prisma.human.create({
      data: {
        email: placeholderEmail,
        name,
        whatsapp: phone,
        whatsappVerified: true,
        whatsappLastInboundAt: new Date(),
        referralCode: generateReferralCode(),
        termsAcceptedAt: new Date(),
        utmSource: 'whatsapp_inbound',
      },
      select: { id: true },
    });

    await prisma.whatsAppSignupSession.delete({ where: { id: session.id } });

    trackServerEvent(human.id, 'user_signed_up_server', {
      method: 'whatsapp_inbound',
      phone,
    });

    logger.info({ humanId: human.id, phone }, 'WhatsApp inbound signup completed');

    const frontendUrl = process.env.FRONTEND_URL || 'https://humanpages.io';
    return reply(
      `Account created! Welcome to Human Pages, ${name}! 🎉\n\n` +
      `You'll receive job offers from AI agents right here on WhatsApp.\n\n` +
      `Send LOGIN anytime to get a link to your dashboard where you can add skills, location, and more to get matched with better gigs.\n\n` +
      `${frontendUrl}/onboarding`
    );
  }
}

// ──────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────
function generateLinkCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No I/O/0/1 to avoid confusion
  let code = 'HP-';
  for (let i = 0; i < 4; i++) {
    code += chars[crypto.randomInt(chars.length)];
  }
  code += '-';
  for (let i = 0; i < 2; i++) {
    code += chars[crypto.randomInt(chars.length)];
  }
  return code;
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Export for admin routes
export { generateLinkCode };

export default router;
