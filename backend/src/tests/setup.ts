import { execSync } from 'child_process';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { beforeAll, afterAll } from 'vitest';
import { Client } from 'pg';

const adminUrl = 'postgresql://humans:humans_secret@localhost:5432/postgres';

// Each forked worker has its own process.pid — use it for a unique DB & photo dir
const dbName = `humans_test_${process.pid}_${Date.now()}`;
const dbUrl = `postgresql://humans:humans_secret@localhost:5432/${dbName}?schema=public&connection_limit=3`;

// Set env vars BEFORE any module (e.g. prisma) reads them
process.env.DATABASE_URL = dbUrl;
process.env.TEST_DB_NAME = dbName;

// Create a temp photo-pipeline directory for this worker
const photoPipelineDir = join('/tmp', `photo-pipeline-test-${process.pid}`);
mkdirSync(join(photoPipelineDir, 'data', 'queue'), { recursive: true });
mkdirSync(join(photoPipelineDir, 'output'), { recursive: true });
writeFileSync(join(photoPipelineDir, 'suggested_batch.json'), '[]');
writeFileSync(join(photoPipelineDir, 'data', 'photo_status.json'), '{}');
process.env.PHOTO_PIPELINE_DIR = photoPipelineDir;

// Track whether the DB has been created in this worker process.
// setupFiles hooks run per test file, but we only need to create the DB once.
let dbReady = false;

beforeAll(async () => {
  if (dbReady) return;

  const client = new Client({ connectionString: adminUrl });
  await client.connect();
  try {
    // Create this worker's ephemeral DB (name includes pid+timestamp so no collision)
    await client.query(`CREATE DATABASE "${dbName}"`);
  } finally {
    await client.end();
  }

  // Push Prisma schema to the ephemeral database
  try {
    execSync('npx prisma db push --accept-data-loss', {
      env: { ...process.env },
      stdio: 'pipe',
    });
  } catch (error) {
    console.error('Failed to sync test database:', error);
    throw error;
  }

  dbReady = true;
});

// Re-export prisma for tests that import from setup
export { prisma } from '../lib/prisma.js';

// After all files in this worker: disconnect Prisma and drop the ephemeral DB
afterAll(async () => {
  try {
    const { prisma } = await import('../lib/prisma.js');
    if (typeof prisma?.$disconnect === 'function') {
      await prisma.$disconnect();
    }
  } catch {
    // prisma may be mocked in some test files
  }

  const client = new Client({ connectionString: adminUrl });
  await client.connect();
  try {
    await client.query(`
      SELECT pg_terminate_backend(pid)
      FROM pg_stat_activity
      WHERE datname = $1 AND pid <> pg_backend_pid()
    `, [dbName]);
    await client.query(`DROP DATABASE IF EXISTS "${dbName}"`);
  } catch {
    // best-effort cleanup
  } finally {
    await client.end();
  }
});
