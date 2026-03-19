import { Router } from 'express';
import crypto from 'crypto';
import { prisma } from '../lib/prisma.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { isTelegramConfigured, getTelegramBotUsername, getTelegramWebhookSecret, sendTelegramMessage } from '../lib/telegram.js';
import { logger } from '../lib/logger.js';

const router = Router();

// Store pending verification codes (in production, use Redis with TTL)
const pendingCodes = new Map<string, { userId: string; expiresAt: number }>();

// Clean up expired codes periodically
setInterval(() => {
  const now = Date.now();
  for (const [code, data] of pendingCodes) {
    if (data.expiresAt < now) {
      pendingCodes.delete(code);
    }
  }
}, 60000); // Every minute

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
    return res.status(403).json({ error: 'Forbidden' });
  }

  try {
    const update = req.body;

    // Only handle message updates — ignore callback_query, channel_post, etc.
    if (!update.message?.chat?.id) {
      return res.json({ ok: true });
    }

    const chatId = String(update.message.chat.id);
    const messageText = update.message.text || '';
    const username = update.message.from?.username;

    // ─── /start CODE — link account ───
    if (messageText.startsWith('/start ')) {
      const code = messageText.replace('/start ', '').trim();

      const pending = pendingCodes.get(code);

      if (!pending) {
        await sendTelegramMessage({
          chatId,
          text: 'Invalid or expired code. Please generate a new link from your Humans dashboard.',
        });
        return res.json({ ok: true });
      }

      if (pending.expiresAt < Date.now()) {
        pendingCodes.delete(code);
        await sendTelegramMessage({
          chatId,
          text: 'This code has expired. Please generate a new link from your Humans dashboard.',
        });
        return res.json({ ok: true });
      }

      // Check if this Telegram chatId is already linked to a DIFFERENT user
      const existingLink = await prisma.human.findFirst({
        where: {
          telegramChatId: chatId,
          id: { not: pending.userId },
        },
        select: { id: true },
      });

      if (existingLink) {
        pendingCodes.delete(code);
        await sendTelegramMessage({
          chatId,
          text: 'This Telegram account is already linked to another Humans profile. Please disconnect it from the other profile first.',
        });
        return res.json({ ok: true });
      }

      // Verify the user still exists in the database
      const userExists = await prisma.human.findUnique({
        where: { id: pending.userId },
        select: { id: true },
      });

      if (!userExists) {
        pendingCodes.delete(code);
        await sendTelegramMessage({
          chatId,
          text: 'Account not found. Please try again from your Humans dashboard.',
        });
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

      await sendTelegramMessage({
        chatId,
        text: `Your Telegram is now connected to Humans! You'll receive notifications here when you get new job offers.`,
      });

      logger.info({ chatId, userId: pending.userId }, 'Telegram linked to user');
    }

    // ─── Plain /start (no code) ───
    else if (messageText === '/start') {
      await sendTelegramMessage({
        chatId,
        text: `Welcome to HumanPages Bot!\n\nTo connect your account, go to your HumanPages dashboard and click "Connect Telegram" to get a verification link.\n\nIf you already have a code, just send it here as a message.`,
      });
    }

    // ─── Raw code (user manually sent the verification code) ───
    else if (/^[A-F0-9]{8}$/i.test(messageText.trim())) {
      const code = messageText.trim().toUpperCase();
      const pending = pendingCodes.get(code);

      if (!pending) {
        await sendTelegramMessage({
          chatId,
          text: 'Invalid or expired code. Please generate a new link from your HumanPages dashboard.',
        });
      } else if (pending.expiresAt < Date.now()) {
        pendingCodes.delete(code);
        await sendTelegramMessage({
          chatId,
          text: 'This code has expired. Please generate a new link from your HumanPages dashboard.',
        });
      } else {
        // Check if this Telegram chatId is already linked to a DIFFERENT user
        const existingLink = await prisma.human.findFirst({
          where: { telegramChatId: chatId, id: { not: pending.userId } },
          select: { id: true },
        });

        if (existingLink) {
          pendingCodes.delete(code);
          await sendTelegramMessage({
            chatId,
            text: 'This Telegram account is already linked to another profile. Please disconnect it first.',
          });
        } else {
          const userExists = await prisma.human.findUnique({
            where: { id: pending.userId },
            select: { id: true },
          });

          if (!userExists) {
            pendingCodes.delete(code);
            await sendTelegramMessage({ chatId, text: 'Account not found. Please try again from your dashboard.' });
          } else {
            await prisma.human.update({
              where: { id: pending.userId },
              data: {
                telegramChatId: chatId,
                ...(username && { telegram: `@${username}` }),
              },
            });
            pendingCodes.delete(code);
            await sendTelegramMessage({
              chatId,
              text: `Your Telegram is now connected to HumanPages! You'll receive notifications here when you get new job offers.`,
            });
            logger.info({ chatId, userId: pending.userId }, 'Telegram linked to user via raw code');
          }
        }
      }
    }

    // ─── Any other message — send helpful reply ───
    else {
      logger.info({ messageText, chatId }, 'Unhandled telegram message');
      await sendTelegramMessage({
        chatId,
        text: 'I only understand verification codes. Go to your HumanPages dashboard to connect your account.',
      });
    }

    res.json({ ok: true });
  } catch (error) {
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
