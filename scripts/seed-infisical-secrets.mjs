#!/usr/bin/env node
/**
 * One-time script to seed secrets into Infisical for a given environment.
 *
 * Usage:
 *   INFISICAL_CLIENT_ID=xxx \
 *   INFISICAL_CLIENT_SECRET=xxx \
 *   INFISICAL_PROJECT_ID=xxx \
 *   node scripts/seed-infisical-secrets.mjs [environment]
 *
 * The [environment] argument defaults to "prod".
 *
 * The script reads secrets from stdin as KEY=VALUE lines (same format as .env).
 * Pipe your production .env into it:
 *
 *   cat /opt/human-pages/backend/.env | \
 *     INFISICAL_CLIENT_ID=xxx \
 *     INFISICAL_CLIENT_SECRET=xxx \
 *     INFISICAL_PROJECT_ID=xxx \
 *     node scripts/seed-infisical-secrets.mjs prod
 *
 * Or run it on the production server itself:
 *
 *   ssh deploy@84.32.22.94 "cat /opt/human-pages/backend/.env" | \
 *     INFISICAL_CLIENT_ID=xxx \
 *     INFISICAL_CLIENT_SECRET=xxx \
 *     INFISICAL_PROJECT_ID=xxx \
 *     node scripts/seed-infisical-secrets.mjs prod
 *
 * It will:
 *  1. Parse each KEY=VALUE line (ignoring comments and blank lines)
 *  2. Connect to Infisical using Universal Auth
 *  3. Check if the secret already exists in the target environment
 *  4. Create or update accordingly
 */

import { createInterface } from 'readline';
import { createRequire } from 'module';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
// Resolve @infisical/sdk from backend/node_modules where it's installed
const backendRequire = createRequire(join(__dirname, '..', 'backend', 'package.json'));

// --- Configuration -----------------------------------------------------------

// Keys we DON'T want in Infisical (they're config, not secrets,
// or handled separately on the server)
const SKIP_KEYS = new Set([
  'NODE_ENV',
  'PORT',
  'FRONTEND_URL',
  'FROM_EMAIL',
  'FROM_NAME',
  'INFISICAL_CLIENT_ID',
  'INFISICAL_CLIENT_SECRET',
  'INFISICAL_PROJECT_ID',
  'INFISICAL_SITE_URL',
  'INFISICAL_ENVIRONMENT',
]);

// Rename keys if needed (e.g. VITE_POSTHOG_KEY → POSTHOG_KEY in vault)
const KEY_RENAMES = {
  VITE_POSTHOG_KEY: 'POSTHOG_KEY',
};

// --- Helpers -----------------------------------------------------------------

function parseEnvLines(lines) {
  const secrets = {};
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;

    const eqIdx = line.indexOf('=');
    if (eqIdx === -1) continue;

    let key = line.slice(0, eqIdx).trim();
    let value = line.slice(eqIdx + 1).trim();

    // Strip surrounding quotes
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (SKIP_KEYS.has(key)) {
      console.log(`  ⏭  Skipping ${key} (non-secret config)`);
      continue;
    }

    if (key in KEY_RENAMES) {
      console.log(`  🔄 Renaming ${key} → ${KEY_RENAMES[key]}`);
      key = KEY_RENAMES[key];
    }

    secrets[key] = value;
  }
  return secrets;
}

async function readStdin() {
  return new Promise((resolve) => {
    const lines = [];
    const rl = createInterface({ input: process.stdin, terminal: false });
    rl.on('line', (line) => lines.push(line));
    rl.on('close', () => resolve(lines));
  });
}

// --- Main --------------------------------------------------------------------

async function main() {
  const environment = process.argv[2] || 'prod';

  const clientId = process.env.INFISICAL_CLIENT_ID;
  const clientSecret = process.env.INFISICAL_CLIENT_SECRET;
  const projectId = process.env.INFISICAL_PROJECT_ID;

  if (!clientId || !clientSecret || !projectId) {
    console.error(
      'Error: INFISICAL_CLIENT_ID, INFISICAL_CLIENT_SECRET, and INFISICAL_PROJECT_ID must be set.'
    );
    process.exit(1);
  }

  // 1. Read .env content from stdin
  console.log('Reading secrets from stdin...');
  const lines = await readStdin();
  const secrets = parseEnvLines(lines);
  const keys = Object.keys(secrets);

  if (keys.length === 0) {
    console.log('No secrets to add. Exiting.');
    return;
  }

  console.log(`\nParsed ${keys.length} secret(s): ${keys.join(', ')}\n`);

  // 2. Connect to Infisical
  console.log('Connecting to Infisical...');
  const { InfisicalSDK } = backendRequire('@infisical/sdk');

  const client = new InfisicalSDK({
    siteUrl: process.env.INFISICAL_SITE_URL || 'https://app.infisical.com',
  });

  await client.auth().universalAuth.login({ clientId, clientSecret });
  console.log('Authenticated with Infisical.\n');

  // 3. List existing secrets in the target environment
  let existing = new Map();
  try {
    const result = await client.secrets().listSecrets({
      environment,
      projectId,
      secretPath: '/',
    });
    for (const s of result.secrets) {
      existing.set(s.secretKey, s.secretValue);
    }
    console.log(
      `Found ${existing.size} existing secret(s) in "${environment}" environment.\n`
    );
  } catch {
    console.log(
      `No existing secrets found in "${environment}" (or environment is new).\n`
    );
  }

  // 4. Create or update each secret
  let created = 0;
  let updated = 0;
  let skippedSame = 0;

  for (const [key, value] of Object.entries(secrets)) {
    try {
      if (existing.has(key)) {
        if (existing.get(key) === value) {
          console.log(`  ✅ ${key} — already exists with same value, skipping`);
          skippedSame++;
          continue;
        }
        await client.secrets().updateSecret(key, {
          secretValue: value,
          projectId,
          environment,
          secretPath: '/',
        });
        console.log(`  🔄 ${key} — updated`);
        updated++;
      } else {
        await client.secrets().createSecret(key, {
          secretValue: value,
          projectId,
          environment,
          secretPath: '/',
        });
        console.log(`  ✨ ${key} — created`);
        created++;
      }
    } catch (error) {
      console.error(`  ❌ ${key} — failed: ${error.message}`);
    }
  }

  console.log(`\n--- Summary (${environment}) ---`);
  console.log(`  Created:   ${created}`);
  console.log(`  Updated:   ${updated}`);
  console.log(`  Unchanged: ${skippedSame}`);
  console.log(`  Total:     ${keys.length}`);
  console.log('\nDone!');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
