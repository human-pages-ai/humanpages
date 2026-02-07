import 'dotenv/config';
import app from './app.js';
import { verifyEmailConfig } from './lib/email.js';
import { logger } from './lib/logger.js';

const PORT = process.env.PORT || 3001;

app.listen(PORT, async () => {
  logger.info({ port: PORT }, 'Humans API started');
  await verifyEmailConfig();
});
