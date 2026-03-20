import { Router } from 'express';
import crypto from 'crypto';
import { prisma } from '../lib/prisma.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { isTelegramConfigured, getTelegramBotUsername, getTelegramWebhookSecret, sendTelegramMessage } from '../lib/telegram.js';
import { logger } from '../lib/logger.js';
import { getTranslator } from '../i18n/index.js';

const router = Router();

// Store pending verification codes (in production, use Redis with TTL)
const pendingCodes = new Map<string, { userId: string; expiresAt: number }>();

// Recent webhook events for debugging (circular buffer, last 20)
const recentWebhookEvents: { time: string; type: string; chatId?: string; text?: string; result: string }[] = [];
function logWebhookEvent(event: typeof recentWebhookEvents[0]) {
  recentWebhookEvents.push(event);
  if (recentWebhookEvents.length > 20) recentWebhookEvents.shift();
}

// Clean up expired codes periodically
setInterval(() => {
  const now = Date.now();
  for (const [code, data] of pendingCodes) {
    if (data.expiresAt < now) {
      pendingCodes.delete(code);
    }
  }
}, 60000); // Every minute

// ─── Debug: view recent webhook events (admin only) ───
router.get('/debug', authenticateToken, async (req: AuthRequest, res) => {
  const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim());
  const user = await prisma.human.findUnique({ where: { id: req.userId }, select: { email: true } });
  if (!user?.email || !adminEmails.includes(user.email)) {
    return res.status(403).json({ error: 'Admin only' });
  }

  const secret = getTelegramWebhookSecret();
  res.json({
    webhookConfigured: !!secret,
    botConfigured: isTelegramConfigured(),
    botUsername: getTelegramBotUsername(),
    pendingCodes: pendingCodes.size,
    recentEvents: recentWebhookEvents,
  });
});

// ─── Debug: send a test message to the current user's Telegram (admin only) ───
router.post('/debug/send', authenticateToken, async (req: AuthRequest, res) => {
  const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim());
  const user = await prisma.human.findUnique({
    where: { id: req.userId },
    select: { email: true, telegramChatId: true, name: true },
  });
  if (!user?.email || !adminEmails.includes(user.email)) {
    return res.status(403).json({ error: 'Admin only' });
  }
  if (!user.telegramChatId) {
    return res.status(400).json({ error: 'No Telegram connected to your account' });
  }

  try {
    await sendTelegramMessage({
      chatId: user.telegramChatId,
      text: `🔔 Test message from HumanPages!\n\nHi ${user.name || 'there'}, this confirms your Telegram notifications are working.\n\nTimestamp: ${new Date().toISOString()}`,
    });
    res.json({ success: true, chatId: user.telegramChatId });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to send', details: String(err) });
  }
});

// ─── Get Telegram connection status ───
router.get('/status', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const human = await prisma.human.findUnique({
      where: { id: req.userId },
      select: { telegramChatId: true, telegram: true },
    });

    const botUsername = getTelegramBotUsername();
    const isConfigured = isTelegramConfigured();

    res.json({
      connected: !!human?.telegramChatId,
      telegramUsername: human?.telegram,
      botAvailable: isConfigured && !!botUsername,
      botUsername,
    });
  } catch (error) {
    logger.error({ err: error }, 'Telegram status error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Generate a verification code for linking ───
// Rate-limited: if user already has a pending code, return the same one
router.post('/link', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const botUsername = getTelegramBotUsername();
    if (!isTelegramConfigured() || !botUsername) {
      return res.status(400).json({ error: 'Telegram bot not configured' });
    }

    // Check if user already has a pending (non-expired) code — reuse it
    for (const [existingCode, data] of pendingCodes) {
      if (data.userId === req.userId! && data.expiresAt > Date.now()) {
        const linkUrl = `https://t.me/${botUsername}?start=${existingCode}`;
        const remainingMs = data.expiresAt - Date.now();
        const remainingMin = Math.ceil(remainingMs / 60000);
        return res.json({
          code: existingCode,
          linkUrl,
          expiresIn: `${remainingMin} minute${remainingMin !== 1 ? 's' : ''}`,
        });
      }
    }

    // Generate a unique code
    const code = crypto.randomBytes(4).toString('hex').toUpperCase();

    // Store with 10 minute expiry
    pendingCodes.set(code, {
      userId: req.userId!,
      expiresAt: Date.now() + 10 * 60 * 1000,
    });

    // Deep link to bot with code
    const linkUrl = `https://t.me/${botUsername}?start=${code}`;

    res.json({
      code,
      linkUrl,
      expiresIn: '10 minutes',
    });
  } catch (error) {
    logger.error({ err: error }, 'Telegram link error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Disconnect Telegram ───
router.delete('/link', authenticateToken, async (req: AuthRequest, res) => {
  try {
    await prisma.human.update({
      where: { id: req.userId },
      data: { telegramChatId: null },
    });

    res.json({ message: 'Telegram disconnected' });
  } catch (error) {
    logger.error({ err: error }, 'Telegram disconnect error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Dev-only: simulate Telegram webhook locally ───
router.post('/dev-simulate', authenticateToken, async (req: AuthRequest, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'Not available in production' });
  }

  try {
    const { code } = req.body;
    if (!code || typeof code !== 'string') {
      return res.status(400).json({ error: 'Code required in request body' });
    }

    const pending = pendingCodes.get(code);

    if (!pending) {
      return res.status(400).json({ error: 'Invalid or expired code' });
    }

    if (pending.expiresAt < Date.now()) {
      pendingCodes.delete(code);
      return res.status(400).json({ error: 'Code has expired' });
    }

    // Link the account (same logic as webhook)
    const chatId = `sim_${crypto.randomBytes(8).toString('hex')}`;
    const username = 'dev_user';

    await prisma.human.update({
      where: { id: pending.userId },
      data: {
        telegramChatId: chatId,
        telegram: `@${username}`,
      },
    });

    pendingCodes.delete(code);

    logger.info({ chatId, userId: pending.userId }, 'Telegram linked to user via dev-simulate');

    res.json({
      success: true,
      message: 'Telegram linked successfully',
      chatId,
    });
  } catch (error) {
    logger.error({ err: error }, 'Telegram dev-simulate error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Webhook endpoint for Telegram bot updates ───
// Set this as webhook URL: https://yourapi.com/api/telegram/webhook
router.post('/webhook', async (req, res) => {
  // Webhook secret is REQUIRED — reject all requests if not configured
  const secret = getTelegramWebhookSecret();
  if (!secret) {
    logger.error('Telegram webhook called but TELEGRAM_WEBHOOK_SECRET is not configured — rejecting');
    return res.status(500).json({ error: 'Webhook secret not configured' });
  }

  const headerSecret = req.headers['x-telegram-bot-api-secret-token'];
  if (headerSecret !== secret) {
    logWebhookEvent({ time: new Date().toISOString(), type: 'auth_failed', result: 'wrong secret' });
    return res.status(403).json({ error: 'Forbidden' });
  }

  try {
    const update = req.body;

    // Only handle message updates — ignore callback_query, channel_post, etc.
    if (!update.message?.chat?.id) {
      logWebhookEvent({ time: new Date().toISOString(), type: 'ignored', result: 'no message.chat.id' });
      return res.json({ ok: true });
    }

    const chatId = String(update.message.chat.id);
    const messageText = update.message.text || '';
    const username = update.message.from?.username;
    // Telegram sends user's language_code (e.g. "en", "es", "he")
    const tgLang = update.message.from?.language_code || 'en';

    // Helper: get translator for a user by ID, falling back to Telegram's language_code
    async function getUserTranslator(userId: string) {
      const u = await prisma.human.findUnique({ where: { id: userId }, select: { preferredLanguage: true } });
      return getTranslator(u?.preferredLanguage || tgLang);
    }

    // Helper: get translator for a chatId (already-linked user) or fall back to TG lang
    async function getChatTranslator() {
      const u = await prisma.human.findFirst({ where: { telegramChatId: chatId }, select: { preferredLanguage: true } });
      return getTranslator(u?.preferredLanguage || tgLang);
    }

    // ─── /start CODE — link account ───
    if (messageText.startsWith('/start ')) {
      const code = messageText.replace('/start ', '').trim();

      const pending = pendingCodes.get(code);

      if (!pending) {
        const tt = await getChatTranslator();
        await sendTelegramMessage({ chatId, text: tt('telegram.invalidCode') });
        return res.json({ ok: true });
      }

      const tt = await getUserTranslator(pending.userId);

      if (pending.expiresAt < Date.now()) {
        pendingCodes.delete(code);
        await sendTelegramMessage({ chatId, text: tt('telegram.expiredCode') });
        return res.json({ ok: true });
      }

      // Check if this Telegram chatId is already linked to a DIFFERENT user
      const existingLink = await prisma.human.findFirst({
        where: { telegramChatId: chatId, id: { not: pending.userId } },
        select: { id: true },
      });

      if (existingLink) {
        pendingCodes.delete(code);
        await sendTelegramMessage({ chatId, text: tt('telegram.alreadyLinked') });
        return res.json({ ok: true });
      }

      // Verify the user still exists in the database
      const userExists = await prisma.human.findUnique({
        where: { id: pending.userId },
        select: { id: true, username: true, name: true },
      });

      if (!userExists) {
        pendingCodes.delete(code);
        await sendTelegramMessage({ chatId, text: tt('telegram.accountNotFound') });
        return res.json({ ok: true });
      }

      // Link the account — only update telegram username if present (don't wipe existing)
      await prisma.human.update({
        where: { id: pending.userId },
        data: {
          telegramChatId: chatId,
          ...(username && { telegram: `@${username}` }),
        },
      });

      pendingCodes.delete(code);

      const profileUrl = userExists.username
        ? `https://humanpages.ai/u/${userExists.username}`
        : `https://humanpages.ai/profile/${userExists.id}`;

      await sendTelegramMessage({ chatId, text: tt('telegram.linked', { profileUrl }) });

      logger.info({ chatId, userId: pending.userId }, 'Telegram linked to user');
    }

    // ─── Plain /start (no code) ───
    else if (messageText === '/start') {
      const tt = await getChatTranslator();
      const existingUser = await prisma.human.findFirst({ where: { telegramChatId: chatId }, select: { id: true } });
      if (existingUser) {
        await sendTelegramMessage({ chatId, text: tt('telegram.welcome') });
      } else {
        await sendTelegramMessage({ chatId, text: tt('telegram.welcomeNew') });
      }
    }

    // ─── Raw code (user manually sent the verification code) ───
    else if (/^[A-F0-9]{8}$/i.test(messageText.trim())) {
      const code = messageText.trim().toUpperCase();
      const pending = pendingCodes.get(code);

      if (!pending) {
        const tt = await getChatTranslator();
        await sendTelegramMessage({ chatId, text: tt('telegram.invalidCode') });
      } else if (pending.expiresAt < Date.now()) {
        pendingCodes.delete(code);
        const tt = await getUserTranslator(pending.userId);
        await sendTelegramMessage({ chatId, text: tt('telegram.expiredCode') });
      } else {
        const tt = await getUserTranslator(pending.userId);

        // Check if this Telegram chatId is already linked to a DIFFERENT user
        const existingLink = await prisma.human.findFirst({
          where: { telegramChatId: chatId, id: { not: pending.userId } },
          select: { id: true },
        });

        if (existingLink) {
          pendingCodes.delete(code);
          await sendTelegramMessage({ chatId, text: tt('telegram.alreadyLinked') });
        } else {
          const userExists = await prisma.human.findUnique({
            where: { id: pending.userId },
            select: { id: true, username: true, name: true },
          });

          if (!userExists) {
            pendingCodes.delete(code);
            await sendTelegramMessage({ chatId, text: tt('telegram.accountNotFound') });
          } else {
            await prisma.human.update({
              where: { id: pending.userId },
              data: {
                telegramChatId: chatId,
                ...(username && { telegram: `@${username}` }),
              },
            });
            pendingCodes.delete(code);
            const profileUrl = userExists.username
              ? `https://humanpages.ai/u/${userExists.username}`
              : `https://humanpages.ai/profile/${userExists.id}`;
            await sendTelegramMessage({ chatId, text: tt('telegram.linked', { profileUrl }) });
            logger.info({ chatId, userId: pending.userId }, 'Telegram linked to user via raw code');
          }
        }
      }
    }

    // ─── Any other message — send helpful reply ───
    else {
      logger.info({ messageText, chatId }, 'Unhandled telegram message');
      const tt = await getChatTranslator();
      await sendTelegramMessage({ chatId, text: tt('telegram.unknownMessage') });
    }

    logWebhookEvent({ time: new Date().toISOString(), type: 'message', chatId, text: messageText.substring(0, 50), result: 'processed' });
    res.json({ ok: true });
  } catch (error) {
    logWebhookEvent({ time: new Date().toISOString(), type: 'error', result: String(error) });
    logger.error({ err: error }, 'Telegram webhook error');
    res.json({ ok: true }); // Always return 200 to Telegram
  }
});

// Export pending codes for verification (used by other modules)
export function verifyTelegramCode(code: string): string | null {
  const pending = pendingCodes.get(code);
  if (!pending || pending.expiresAt < Date.now()) {
    return null;
  }
  return pending.userId;
}

export default router;
