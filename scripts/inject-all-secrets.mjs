#!/usr/bin/env node
/**
 * Deploy-time secret injection for ALL repos.
 *
 * Pulls ALL secrets from Infisical (single pool at path: /) and writes
 * .env files to each project directory, filtered to only the keys each
 * project needs. All repos share the same Infisical project.
 *
 * The backend still loads its own secrets at runtime via the Infisical SDK.
 * This script handles ONLY the satellite repos that read from .env files.
 *
 * Prerequisites:
 *   - INFISICAL_CLIENT_ID, INFISICAL_CLIENT_SECRET, INFISICAL_PROJECT_ID
 *     set in the environment (from /opt/human-pages/backend/.env)
 *
 * Usage:
 *   node scripts/inject-all-secrets.mjs                  # inject all repos
 *   node scripts/inject-all-secrets.mjs video-pipeline    # inject one repo
 *   node scripts/inject-all-secrets.mjs --dry-run         # show what would be written
 */

import { writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __dirname = dirname(fileURLToPath(import.meta.url));
const backendRequire = createRequire(join(__dirname, '..', 'backend', 'package.json'));

// ─── Which keys each project needs ─────────────────────────────────────────
// Use '*' to inject ALL non-blocked secrets.
// Otherwise list specific keys the project reads from .env.

const PROJECTS = {
  'video-pipeline': {
    dir: '/opt/video-pipeline',
    keys: [
      'FAL_KEY',
      'ELEVENLABS_API_KEY',
      'RUNWAY_API_KEY',
      'YOUTUBE_API_KEY',
      'YOUTUBE_CHANNEL_ID',
    ],
  },
  'photo-pipeline': {
    dir: '/opt/photo-pipeline',
    keys: [
      'FAL_KEY',
    ],
  },
  'blog-engine': {
    dir: '/opt/blog-engine',
    keys: [
      'HP_ADMIN_API_KEY',
      'AI_ADMIN_API_KEY',
      'GOOGLE_ALERTS_RSS',
    ],
  },
  'reply-engine': {
    dir: '/opt/reply-engine',
    keys: '*', // uses many platform keys
  },
  'youtube-outreach': {
    dir: '/opt/youtube-outreach',
    keys: [
      'YOUTUBE_API_KEY',
      'YOUTUBE_CHANNEL_ID',
    ],
  },
};

// Keys that should never be written to satellite .env files
const NEVER_WRITE = new Set([
  'INFISICAL_CLIENT_ID',
  'INFISICAL_CLIENT_SECRET',
  'INFISICAL_PROJECT_ID',
  'INFISICAL_SITE_URL',
  'INFISICAL_ENVIRONMENT',
  'DATABASE_URL',
  'DIRECT_DATABASE_URL',
  'JWT_SECRET',
]);

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const targetProject = args.find(a => !a.startsWith('--'));

  const clientId = process.env.INFISICAL_CLIENT_ID;
  const clientSecret = process.env.INFISICAL_CLIENT_SECRET;
  const projectId = process.env.INFISICAL_PROJECT_ID;

  if (!clientId || !clientSecret || !projectId) {
    console.error('Error: INFISICAL_CLIENT_ID, INFISICAL_CLIENT_SECRET, and INFISICAL_PROJECT_ID must be set.');
    console.error('Hint: export $(grep INFISICAL /opt/human-pages/backend/.env | xargs)');
    process.exit(1);
  }

  const { InfisicalSDK } = backendRequire('@infisical/sdk');

  const client = new InfisicalSDK({
    siteUrl: process.env.INFISICAL_SITE_URL || 'https://app.infisical.com',
  });

  await client.auth().universalAuth.login({ clientId, clientSecret });
  const environment = process.env.INFISICAL_ENVIRONMENT || 'prod';

  // Fetch ALL secrets once from the single shared pool
  console.log(`Fetching secrets from Infisical (env: ${environment}, path: /)...`);
  const result = await client.secrets().listSecrets({
    environment,
    projectId,
    secretPath: '/',
  });

  const allSecrets = new Map();
  for (const secret of result.secrets) {
    allSecrets.set(secret.secretKey, secret.secretValue);
  }
  console.log(`Found ${allSecrets.size} total secret(s) in Infisical.\n`);

  if (dryRun) console.log('DRY RUN — no files will be written\n');

  // Filter to single project if specified
  const projectsToProcess = targetProject
    ? { [targetProject]: PROJECTS[targetProject] }
    : PROJECTS;

  if (targetProject && !PROJECTS[targetProject]) {
    console.error(`Unknown project: ${targetProject}`);
    console.error(`Available: ${Object.keys(PROJECTS).join(', ')}`);
    process.exit(1);
  }

  let totalWritten = 0;
  let totalSkipped = 0;

  for (const [name, config] of Object.entries(projectsToProcess)) {
    console.log(`── ${name} ──`);

    if (!existsSync(config.dir)) {
      console.log(`  SKIP: ${config.dir} does not exist\n`);
      totalSkipped++;
      continue;
    }

    // Filter secrets for this project
    const lines = [];
    for (const [key, value] of allSecrets) {
      if (NEVER_WRITE.has(key)) continue;
      if (config.keys !== '*' && !config.keys.includes(key)) continue;

      const needsQuotes = /[\s#"'\\$`!]/.test(value);
      lines.push(`${key}=${needsQuotes ? `"${value}"` : value}`);
    }

    if (lines.length === 0) {
      console.log(`  SKIP: no matching secrets found\n`);
      totalSkipped++;
      continue;
    }

    const envPath = join(config.dir, '.env');

    if (dryRun) {
      console.log(`  Would write ${lines.length} secret(s) to ${envPath}:`);
      for (const line of lines) {
        const [key] = line.split('=');
        console.log(`    ${key}=***`);
      }
    } else {
      writeFileSync(envPath, lines.join('\n') + '\n', { mode: 0o600 });
      console.log(`  Wrote ${lines.length} secret(s) to ${envPath} (mode 600)`);
    }

    totalWritten++;
    console.log('');
  }

  console.log(`── Summary ──`);
  console.log(`  Written: ${totalWritten}`);
  console.log(`  Skipped: ${totalSkipped}`);
  console.log('Done.');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
