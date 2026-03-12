import { logger } from './logger.js';

export async function verifyCaptcha(token: string): Promise<boolean> {
  if (process.env.NODE_ENV === 'test') return true;

  // Allow e2e tests running against the dev server to bypass captcha
  if (process.env.NODE_ENV !== 'production' && token === 'test-token') return true;

  // Embedded browser fallback: Turnstile often fails in FB/TG WebViews.
  // Accept bypass token — request is already rate-limited (10/15min per IP + global 100/min).
  if (token === '__webview_bypass__') {
    logger.info('Captcha bypassed (embedded browser fallback)');
    return true;
  }

  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    logger.warn('TURNSTILE_SECRET_KEY not set, skipping captcha verification');
    return true;
  }

  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ secret, response: token }),
  });

  const data = await res.json() as { success: boolean };
  return data.success;
}
