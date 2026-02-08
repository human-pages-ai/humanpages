import { logger } from './logger.js';

const SECRETS_TO_FETCH = [
  'DATABASE_URL',
  'JWT_SECRET',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'RESEND_API_KEY',
  'POSTHOG_KEY',
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
  } catch (error) {
    logger.error({ err: error }, 'Failed to load secrets from Infisical');
    throw new Error('Failed to initialize secrets from Infisical. Cannot start.');
  }
}
