import pino from 'pino';

const REDACT_PATHS = ['authorization', 'password', 'passwordHash', 'token', 'req.headers.authorization', 'req.headers.cookie', 'cookie', 'callbackSecret'];

/**
 * Build the initial logger — stdout only.
 * Axiom transport gets added later via `initLogShipping()` after secrets load.
 */
export let logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  redact: REDACT_PATHS,
  transport: {
    targets: [
      { target: 'pino/file', options: { destination: 1 } },
    ],
  },
});

/**
 * Call AFTER secrets are loaded (process.env.AXIOM_* available).
 * Recreates the logger with an additional Axiom transport target.
 * If Axiom isn't configured, this is a no-op.
 */
export function initLogShipping(): void {
  const dataset = process.env.AXIOM_DATASET;
  const token = process.env.AXIOM_TOKEN;

  if (!dataset || !token) {
    logger.debug('Axiom not configured — logs stay local only');
    return;
  }

  logger = pino({
    level: process.env.LOG_LEVEL || 'info',
    redact: REDACT_PATHS,
    transport: {
      targets: [
        { target: 'pino/file', options: { destination: 1 } },
        {
          target: '@axiomhq/pino',
          options: { dataset, token },
        },
      ],
    },
  });

  logger.info({ dataset }, 'Log shipping to Axiom enabled');
}
