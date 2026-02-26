import pino from 'pino';

function buildTransport(): pino.TransportSingleOptions | pino.TransportMultiOptions | undefined {
  const targets: pino.TransportTargetOptions[] = [];

  // Always log to stdout (PM2 captures this into log files)
  targets.push({
    target: 'pino/file',
    options: { destination: 1 },
  });

  // Ship to Axiom if configured (free tier: 500GB/month, 30-day retention)
  if (process.env.AXIOM_DATASET && process.env.AXIOM_TOKEN) {
    targets.push({
      target: '@axiomhq/pino',
      options: {
        dataset: process.env.AXIOM_DATASET,
        token: process.env.AXIOM_TOKEN,
      },
    });
  }

  return { targets };
}

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  redact: ['authorization', 'password', 'passwordHash', 'token', 'req.headers.authorization', 'callbackSecret'],
  transport: buildTransport(),
});
