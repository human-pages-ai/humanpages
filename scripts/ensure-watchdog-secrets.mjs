#!/usr/bin/env node
/**
 * Ensure Watch Dog secrets exist in Infisical.
 *
 * Reads the Telegram bot token from Infisical, auto-discovers the admin
 * chat ID from the Telegram API, fetches or prompts for the Anthropic key,
 * and creates any missing secrets in Infisical.
 *
 * Usage:
 *   node scripts/ensure-watchdog-secrets.mjs
 *   node scripts/ensure-watchdog-secrets.mjs --dry-run
 */

import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { readFileSync, existsSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const backendRequire = createRequire(join(__dirname, '..', 'backend', 'package.json'));

// Keys Watch Dog needs
const WATCHDOG_KEYS = [
  'ANTHROPIC_API_KEY',
  'TELEGRAM_ADMIN_CHAT_ID',
  'AXIOM_TOKEN',
  'AXIOM_DATASET',
];

// ── Helpers ────────────────────────────────────────────────────────

function loadBackendEnv() {
  const envPath = join(__dirname, '..', 'backend', '.env');
  if (!existsSync(envPath)) return {};
  const env = {};
  for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx < 0) continue;
    const key = trimmed.slice(0, eqIdx);
    let val = trimmed.slice(eqIdx + 1);
    // Strip surrounding quotes
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    env[key] = val;
  }
  return env;
}

async function discoverTelegramChatId(botToken) {
  if (!botToken) return null;
  try {
    const resp = await fetch(`https://api.telegram.org/bot${botToken}/getUpdates`);
    const data = await resp.json();
    if (!data.ok || !data.result?.length) {
      console.log('  ℹ️  No Telegram updates found. Send a message to your bot first.');
      return null;
    }
    // Find the most recent chat ID from a private message (admin)
    for (const update of data.result.reverse()) {
      const chat = update.message?.chat || update.my_chat_member?.chat;
      if (chat && chat.type === 'private') {
        console.log(`  ✅ Discovered Telegram chat ID: ${chat.id} (user: ${chat.first_name || chat.username || 'unknown'})`);
        return String(chat.id);
      }
    }
    // Fallback: any chat
    const firstChat = data.result[0]?.message?.chat;
    if (firstChat) {
      console.log(`  ✅ Discovered Telegram chat ID: ${firstChat.id}`);
      return String(firstChat.id);
    }
    return null;
  } catch (err) {
    console.log(`  ⚠️  Failed to query Telegram API: ${err.message}`);
    return null;
  }
}

// ── Main ───────────────────────────────────────────────────────────

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║     Watch Dog — Secret Configuration             ║');
  console.log('╚══════════════════════════════════════════════════╝');
  console.log('');

  // Load Infisical credentials
  const localEnv = loadBackendEnv();
  const clientId = process.env.INFISICAL_CLIENT_ID || localEnv.INFISICAL_CLIENT_ID;
  const clientSecret = process.env.INFISICAL_CLIENT_SECRET || localEnv.INFISICAL_CLIENT_SECRET;
  const projectId = process.env.INFISICAL_PROJECT_ID || localEnv.INFISICAL_PROJECT_ID;

  if (!clientId || !clientSecret || !projectId) {
    console.error('Error: INFISICAL_CLIENT_ID, INFISICAL_CLIENT_SECRET, and INFISICAL_PROJECT_ID must be set.');
    process.exit(1);
  }

  const { InfisicalSDK } = backendRequire('@infisical/sdk');

  const client = new InfisicalSDK({
    siteUrl: process.env.INFISICAL_SITE_URL || localEnv.INFISICAL_SITE_URL || 'https://app.infisical.com',
  });

  await client.auth().universalAuth.login({ clientId, clientSecret });
  const environment = process.env.INFISICAL_ENVIRONMENT || localEnv.INFISICAL_ENVIRONMENT || 'prod';

  console.log(`→ Connected to Infisical (env: ${environment})`);

  // Fetch all existing secrets
  const result = await client.secrets().listSecrets({
    environment,
    projectId,
    secretPath: '/',
  });

  const existingSecrets = new Map();
  for (const secret of result.secrets) {
    existingSecrets.set(secret.secretKey, secret.secretValue);
  }

  console.log(`  Found ${existingSecrets.size} existing secret(s)\n`);

  // Determine what's missing or empty
  const missing = [];
  const present = [];

  for (const key of WATCHDOG_KEYS) {
    const val = existingSecrets.get(key);
    if (val && val.trim()) {
      present.push(key);
    } else {
      missing.push(key);
    }
  }

  if (present.length) {
    console.log('✅ Already configured:');
    for (const key of present) console.log(`   ${key}`);
    console.log('');
  }

  if (missing.length === 0) {
    console.log('✅ All Watch Dog secrets are configured!');
    return;
  }

  console.log('⚠️  Missing secrets:');
  for (const key of missing) console.log(`   ${key}`);
  console.log('');

  // ── Auto-discover values ─────────────────────────────────────

  const toCreate = new Map();

  for (const key of missing) {
    // 1. Check if it's in the local .env
    if (localEnv[key] && localEnv[key].trim()) {
      console.log(`→ ${key}: found in backend/.env`);
      toCreate.set(key, localEnv[key].trim());
      continue;
    }

    // 2. Check process.env (might be passed as env var)
    if (process.env[key] && process.env[key].trim()) {
      console.log(`→ ${key}: found in environment`);
      toCreate.set(key, process.env[key].trim());
      continue;
    }

    // 3. Special case: auto-discover TELEGRAM_ADMIN_CHAT_ID
    if (key === 'TELEGRAM_ADMIN_CHAT_ID') {
      const botToken = existingSecrets.get('TELEGRAM_BOT_TOKEN') || localEnv.TELEGRAM_BOT_TOKEN;
      console.log(`→ ${key}: attempting auto-discovery from Telegram API...`);
      const chatId = await discoverTelegramChatId(botToken);
      if (chatId) {
        toCreate.set(key, chatId);
        continue;
      }
    }

    console.log(`→ ${key}: NOT FOUND — pass it as an environment variable:`);
    console.log(`   ${key}=<value> node scripts/ensure-watchdog-secrets.mjs`);
  }

  console.log('');

  if (toCreate.size === 0) {
    console.log('⚠️  No new values to add. Pass missing keys as env vars and re-run.');
    process.exit(1);
  }

  // ── Create secrets in Infisical ──────────────────────────────

  console.log(`→ Adding ${toCreate.size} secret(s) to Infisical...`);

  for (const [key, value] of toCreate) {
    if (dryRun) {
      console.log(`  DRY RUN: would create ${key}=***`);
      continue;
    }

    try {
      // Check if key exists but is empty — update instead of create
      if (existingSecrets.has(key)) {
        await client.secrets().updateSecret({
          environment,
          projectId,
          secretPath: '/',
          secretKey: key,
          secretValue: value,
        });
        console.log(`  ✅ Updated: ${key}`);
      } else {
        await client.secrets().createSecret({
          environment,
          projectId,
          secretPath: '/',
          secretKey: key,
          secretValue: value,
        });
        console.log(`  ✅ Created: ${key}`);
      }
    } catch (err) {
      console.error(`  ❌ Failed to set ${key}: ${err.message}`);
    }
  }

  // ── Report final status ──────────────────────────────────────

  const stillMissing = missing.filter(k => !toCreate.has(k));
  console.log('');
  if (stillMissing.length > 0) {
    console.log('⚠️  Still missing (requires manual setup):');
    for (const key of stillMissing) console.log(`   ${key}`);
    process.exit(1);
  } else {
    console.log('✅ All Watch Dog secrets are now configured in Infisical!');
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
