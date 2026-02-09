import { config } from './config.js';
import { startWebhookServer } from './webhook.js';
import { runBot } from './bot.js';

async function main() {
  const humanId = process.argv[2];
  if (!humanId) {
    console.error('Usage: npx tsx src/index.ts <humanId>');
    process.exit(1);
  }

  // Start the webhook server only if a public URL is configured
  if (config.webhookUrl) {
    await startWebhookServer();
  } else {
    console.log('No WEBHOOK_URL configured — using polling mode');
  }

  try {
    await runBot(humanId);
  } catch (err) {
    console.error('Bot error:', (err as Error).message);
    process.exit(1);
  }
}

main();
