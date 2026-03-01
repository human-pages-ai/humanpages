import { logger, initLogShipping } from './logger.js';

const SECRETS_TO_FETCH = [
  'DATABASE_URL',
  'JWT_SECRET',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'LINKEDIN_CLIENT_ID',
  'LINKEDIN_CLIENT_SECRET',
  'RESEND_API_KEY',
  'POSTHOG_KEY',
  'SES_SMTP_USER',
  'SES_SMTP_PASS',
  'GITCOIN_SCORER_API_KEY',
  'GITCOIN_SCORER_ID',
  'TELEGRAM_BOT_TOKEN',
  'TELEGRAM_WEBHOOK_SECRET',
  'TELEGRAM_BOT_USERNAME',
  'TURNSTILE_SECRET_KEY',
  'OPENAI_API_KEY',
  'R2_ACCOUNT_ID',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'AI_ADMIN_API_KEY',
  'GITHUB_CLIENT_ID',
  'GITHUB_CLIENT_SECRET',
  'META_APP_ACCESS_TOKEN',
  'AXIOM_DATASET',
  'AXIOM_TOKEN',
  'ANTHROPIC_API_KEY',
  'TELEGRAM_ADMIN_CHAT_ID',
];

/**
 * Initialize secrets from Infisical in production.
 * In dev/test, secrets come from .env via dotenv (already loaded).
 * Infisical SDK fetches secrets and sets them on process.env so
 * the rest of the app can keep using process.env.* unchanged.
 */
export async function initSecrets(): Promise<void> {
  const clientId = process.env.INFISICAL_CLIENT_ID;
  const clientSecret = process.env.INFISICAL_CLIENT_SECRET;
  const projectId = process.env.INFISICAL_PROJECT_ID;

  if (!clientId || !clientSecret || !projectId) {
    logger.info('Infisical not configured — using environment variables from .env / shell');
    // .env is already loaded by dotenv — enable log shipping if AXIOM_* is set
    initLogShipping();
    return;
  }

  try {
    const { InfisicalSDK } = await import('@infisical/sdk');

    const client = new InfisicalSDK({
      siteUrl: process.env.INFISICAL_SITE_URL || 'https://app.infisical.com',
    });

    await client.auth().universalAuth.login({
      clientId,
      clientSecret,
    });

    const environment = process.env.INFISICAL_ENVIRONMENT || 'prod';

    const allSecrets = await client.secrets().listSecrets({
      environment,
      projectId,
      secretPath: '/',
    });

    let loaded = 0;
    for (const secret of allSecrets.secrets) {
      if (SECRETS_TO_FETCH.includes(secret.secretKey)) {
        process.env[secret.secretKey] = secret.secretValue;
        loaded++;
      }
    }

    logger.info({ loaded, environment }, 'Secrets loaded from Infisical');

    // Now that AXIOM_* env vars are available, enable log shipping
    initLogShipping();
  } catch (error) {
    logger.error({ err: error }, 'Failed to load secrets from Infisical');
    throw new Error('Failed to initialize secrets from Infisical. Cannot start.');
  }
}
