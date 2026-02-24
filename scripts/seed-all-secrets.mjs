#!/usr/bin/env node
/**
 * One-time script to seed ALL satellite project secrets into Infisical.
 *
 * Reads each project's .env file and uploads the secrets to the SAME
 * shared Infisical pool (path: /). Duplicate keys across repos are
 * expected (e.g. FAL_KEY used by both video-pipeline and photo-pipeline).
 *
 * The humans backend secrets should already be in Infisical via
 * seed-infisical-secrets.mjs. This script adds any NEW keys from the
 * satellite repos that aren't already present.
 *
 * Prerequisites:
 *   - INFISICAL_CLIENT_ID, INFISICAL_CLIENT_SECRET, INFISICAL_PROJECT_ID
 *     set in the environment
 *
 * Usage (run on the production server):
 *   node scripts/seed-all-secrets.mjs                   # seed all repos
 *   node scripts/seed-all-secrets.mjs video-pipeline     # seed one repo
 *   node scripts/seed-all-secrets.mjs --dry-run          # preview without writing
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __dirname = dirname(fileURLToPath(import.meta.url));
const backendRequire = createRequire(join(__dirname, '..', 'backend', 'package.json'));

// ─── Configuration ──────────────────────────────────────────────────────────

const PROJECTS = {
  'video-pipeline': '/opt/video-pipeline',
  'photo-pipeline': '/opt/photo-pipeline',
  'blog-engine': '/opt/blog-engine',
  'reply-engine': '/opt/reply-engine',
  'youtube-outreach': '/opt/youtube-outreach',
};

// Keys to skip (non-secret config or Infisical meta)
const SKIP_KEYS = new Set([
  'NODE_ENV',
  'PORT',
  'INFISICAL_CLIENT_ID',
  'INFISICAL_CLIENT_SECRET',
  'INFISICAL_PROJECT_ID',
  'INFISICAL_SITE_URL',
  'INFISICAL_ENVIRONMENT',
]);

// ─── Helpers ────────────────────────────────────────────────────────────────

function parseEnvFile(filePath) {
  const content = readFileSync(filePath, 'utf-8');
  const secrets = {};

  for (const raw of content.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;

    const eqIdx = line.indexOf('=');
    if (eqIdx === -1) continue;

    const key = line.slice(0, eqIdx).trim();
    let value = line.slice(eqIdx + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (SKIP_KEYS.has(key)) continue;
    if (!value) continue;

    secrets[key] = value;
  }

  return secrets;
}

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

  console.log(`Connected to Infisical (env: ${environment})`);
  if (dryRun) console.log('DRY RUN — no secrets will be created\n');

  // Get existing secrets from the shared pool
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
    console.log(`Found ${existing.size} existing secret(s) in Infisical.\n`);
  } catch {
    console.log('No existing secrets found (or new environment).\n');
  }

  // Collect all secrets from all projects
  const allNewSecrets = new Map(); // key → { value, source }

  const projectsToProcess = targetProject
    ? { [targetProject]: PROJECTS[targetProject] }
    : PROJECTS;

  if (targetProject && !PROJECTS[targetProject]) {
    console.error(`Unknown project: ${targetProject}`);
    console.error(`Available: ${Object.keys(PROJECTS).join(', ')}`);
    process.exit(1);
  }

  for (const [name, dir] of Object.entries(projectsToProcess)) {
    const envPath = join(dir, '.env');
    if (!existsSync(envPath)) {
      console.log(`── ${name}: SKIP (no .env at ${envPath})`);
      continue;
    }

    const secrets = parseEnvFile(envPath);
    const keys = Object.keys(secrets);
    console.log(`── ${name}: found ${keys.length} secret(s)`);

    for (const [key, value] of Object.entries(secrets)) {
      if (!allNewSecrets.has(key)) {
        allNewSecrets.set(key, { value, source: name });
      }
    }
  }

  console.log(`\nTotal unique keys to sync: ${allNewSecrets.size}\n`);

  // Sync to Infisical
  let created = 0;
  let updated = 0;
  let unchanged = 0;

  for (const [key, { value, source }] of allNewSecrets) {
    try {
      if (existing.has(key)) {
        if (existing.get(key) === value) {
          console.log(`  ✅ ${key} — unchanged (from ${source})`);
          unchanged++;
          continue;
        }
        if (dryRun) {
          console.log(`  [update] ${key}=*** (from ${source})`);
          continue;
        }
        await client.secrets().updateSecret(key, {
          secretValue: value,
          projectId,
          environment,
          secretPath: '/',
        });
        console.log(`  🔄 ${key} — updated (from ${source})`);
        updated++;
      } else {
        if (dryRun) {
          console.log(`  [create] ${key}=*** (from ${source})`);
          continue;
        }
        await client.secrets().createSecret(key, {
          secretValue: value,
          projectId,
          environment,
          secretPath: '/',
        });
        console.log(`  ✨ ${key} — created (from ${source})`);
        created++;
      }
    } catch (error) {
      console.error(`  ❌ ${key} — failed: ${error.message}`);
    }
  }

  console.log(`\n── Summary (${environment}) ──`);
  console.log(`  Created:   ${created}`);
  console.log(`  Updated:   ${updated}`);
  console.log(`  Unchanged: ${unchanged}`);
  console.log('Done.');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
