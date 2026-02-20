import 'dotenv/config';
import app from './app.js';
import { verifyEmailConfig } from './lib/email.js';
import { startDigestWorker, stopDigestWorker } from './lib/digest.js';
import { startStreamMonitor, stopStreamMonitor } from './lib/stream-monitor.js';
import { startProfileNudgeWorker, stopProfileNudgeWorker } from './lib/profile-nudge.js';
import { startListingExpiryWorker, stopListingExpiryWorker } from './lib/listing-expiry.js';
import { startModerationWorker, stopModerationWorker } from './lib/moderation-worker.js';
import { logger } from './lib/logger.js';
import { shutdownPostHog } from './lib/posthog.js';
import { initSecrets } from './lib/secrets.js';

async function start() {
  await initSecrets();

  const PORT = process.env.PORT || 3001;

  const server = app.listen(PORT, async () => {
    logger.info({ port: PORT }, 'Humans API started');
    await verifyEmailConfig();
    startDigestWorker();
    startStreamMonitor();
    startProfileNudgeWorker();
    startListingExpiryWorker();
    startModerationWorker();
  });

  process.on('SIGTERM', async () => {
    logger.info('SIGTERM received, shutting down gracefully');
    stopDigestWorker();
    stopStreamMonitor();
    stopProfileNudgeWorker();
    stopListingExpiryWorker();
    stopModerationWorker();
    await shutdownPostHog();
    server.close(() => {
      logger.info('Server closed');
      process.exit(0);
    });
  });

  process.on('SIGINT', async () => {
    logger.info('SIGINT received, shutting down gracefully');
    stopDigestWorker();
    stopStreamMonitor();
    stopProfileNudgeWorker();
    stopListingExpiryWorker();
    stopModerationWorker();
    await shutdownPostHog();
    server.close(() => {
      logger.info('Server closed');
      process.exit(0);
    });
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
