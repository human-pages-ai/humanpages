#!/usr/bin/env node
/**
 * Fetches frontend env vars from Infisical and writes them to frontend/.env
 * for Vite to consume at build time. Run this before `npm run build` in frontend.
 *
 * Requires INFISICAL_CLIENT_ID, INFISICAL_CLIENT_SECRET, INFISICAL_PROJECT_ID
 * to be set in the environment (same ones the backend uses).
 *
 * Usage: node scripts/inject-frontend-env.mjs
 */

import { writeFileSync, unlinkSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FRONTEND_ENV_PATH = join(__dirname, '..', 'frontend', '.env');
// Resolve @infisical/sdk from backend/node_modules where it's installed
const backendRequire = createRequire(join(__dirname, '..', 'backend', 'package.json'));

// Frontend env vars to fetch from Infisical (maps Infisical key → Vite key)
const FRONTEND_SECRETS = {
  POSTHOG_KEY: 'VITE_POSTHOG_KEY',
  TURNSTILE_SITE_KEY: 'VITE_TURNSTILE_SITE_KEY',
};

async function main() {
  const clientId = process.env.INFISICAL_CLIENT_ID;
  const clientSecret = process.env.INFISICAL_CLIENT_SECRET;
  const projectId = process.env.INFISICAL_PROJECT_ID;

  if (!clientId || !clientSecret || !projectId) {
    console.log('Infisical not configured — skipping frontend env injection');
    return;
  }

  try {
    const { InfisicalSDK } = backendRequire('@infisical/sdk');

    const client = new InfisicalSDK({
      siteUrl: process.env.INFISICAL_SITE_URL || 'https://app.infisical.com',
    });

    await client.auth().universalAuth.login({ clientId, clientSecret });

    const environment = process.env.INFISICAL_ENVIRONMENT || 'prod';
    const allSecrets = await client.secrets().listSecrets({
      environment,
      projectId,
      secretPath: '/',
    });

    const lines = [];
    for (const secret of allSecrets.secrets) {
      if (secret.secretKey in FRONTEND_SECRETS) {
        const viteKey = FRONTEND_SECRETS[secret.secretKey];
        lines.push(`${viteKey}=${secret.secretValue}`);
      }
    }

    if (lines.length > 0) {
      writeFileSync(FRONTEND_ENV_PATH, lines.join('\n') + '\n');
      console.log(`Wrote ${lines.length} frontend env var(s) to frontend/.env`);
    } else {
      console.warn('No matching frontend secrets found in Infisical');
    }
  } catch (error) {
    console.error('Failed to fetch frontend secrets from Infisical:', error.message);
    process.exit(1);
  }
}

// Cleanup handler — remove frontend/.env after build
export function cleanup() {
  if (existsSync(FRONTEND_ENV_PATH)) {
    unlinkSync(FRONTEND_ENV_PATH);
    console.log('Cleaned up frontend/.env');
  }
}

main();
