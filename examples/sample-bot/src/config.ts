import 'dotenv/config';

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optional(name: string, fallback: string): string {
  return process.env[name] || fallback;
}

export const config = {
  // API
  apiUrl: required('API_URL'),
  agentApiKey: process.env.AGENT_API_KEY || '',

  // Agent registration (used if agentApiKey is blank)
  agentName: optional('AGENT_NAME', 'Errand Bot'),
  agentDescription: optional(
    'AGENT_DESCRIPTION',
    'Hires nearby humans for physical-world tasks that AI cannot do alone',
  ),
  agentContactEmail: process.env.AGENT_CONTACT_EMAIL || undefined,

  // Webhook
  webhookPort: parseInt(optional('WEBHOOK_PORT', '4000'), 10),
  webhookHost: optional('WEBHOOK_HOST', '0.0.0.0'),
  webhookUrl: process.env.WEBHOOK_URL || '',
  webhookSecret: process.env.WEBHOOK_SECRET || '',

  // LLM (optional — enables smart replies instead of keyword matching)
  //
  // Works with any OpenAI-compatible API:
  //   Ollama, LM Studio, OpenRouter, Cloudflare Workers AI, Google Gemini,
  //   Together, Groq, Fireworks, vLLM, etc.
  //
  // Also supports Anthropic's native API (different format, auto-detected).
  //
  // No LLM_BASE_URL and no ANTHROPIC_API_KEY → keyword fallback.
  llmBaseUrl: process.env.LLM_BASE_URL || '',
  llmApiKey: process.env.LLM_API_KEY || '',
  llmModel: optional('LLM_MODEL', 'llama3'),
  llmSystemPrompt: process.env.LLM_SYSTEM_PROMPT || '',

  // Telegram notifications to the bot owner (optional)
  // When set, the bot pings you on Telegram for key events:
  //   - Job accepted / rejected / completed
  //   - LLM errors (so you know replies fell back to keywords)
  //   - Human messages the LLM couldn't handle
  ownerTelegramBotToken: process.env.OWNER_TELEGRAM_BOT_TOKEN || '',
  ownerTelegramChatId: process.env.OWNER_TELEGRAM_CHAT_ID || '',

  // Payment (optional — enables real on-chain USDC transfers)
  walletPrivateKey: process.env.WALLET_PRIVATE_KEY || '',
  paymentNetwork: optional('PAYMENT_NETWORK', 'base-sepolia'),

  // Errand params
  errandDescription: optional(
    'ERRAND_DESCRIPTION',
    'Pick up a package from the FedEx at 123 Main St and deliver it to 456 Oak Ave.',
  ),
  jobPriceUsdc: parseFloat(optional('JOB_PRICE_USDC', '15')),
};

// Validate webhook secret length (platform requires 16-256 chars) — only if webhook is configured
if (config.webhookSecret && (config.webhookSecret.length < 16 || config.webhookSecret.length > 256)) {
  throw new Error('WEBHOOK_SECRET must be between 16 and 256 characters');
}
