import { execSync } from 'child_process';
import { beforeAll, afterAll } from 'vitest';
import { Client } from 'pg';
import { prisma } from '../lib/prisma.js';

const dbName = process.env.TEST_DB_NAME!;
const adminUrl = 'postgresql://humans:humans_secret@localhost:5432/postgres';

// Track whether the DB has been created in this worker process.
// setupFiles hooks run per test file, but we only need to create the DB once.
let dbReady = false;

beforeAll(async () => {
  if (dbReady) return;

  const client = new Client({ connectionString: adminUrl });
  await client.connect();
  try {
    // Clean up stale test DBs with no active connections (from crashed runs)
    const stale = await client.query(`
      SELECT datname FROM pg_database
      WHERE datname LIKE 'humans_test_%'
        AND datname <> $1
        AND datname NOT IN (
          SELECT DISTINCT datname FROM pg_stat_activity WHERE datname LIKE 'humans_test_%'
        )
    `, [dbName]);
    for (const row of stale.rows) {
      await client.query(`DROP DATABASE IF EXISTS "${row.datname}"`).catch(() => {});
    }

    // Terminate any lingering connections, then create fresh DB
    await client.query(`
      SELECT pg_terminate_backend(pid)
      FROM pg_stat_activity
      WHERE datname = $1 AND pid <> pg_backend_pid()
    `, [dbName]);
    await client.query(`DROP DATABASE IF EXISTS "${dbName}"`);
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

// Disconnect Prisma after each file (it reconnects lazily on next use).
// The DB itself persists across files — data cleanup is handled by
// cleanDatabase() in each test's beforeEach.
afterAll(async () => {
  await prisma.$disconnect();
});

// Re-export prisma for tests
export { prisma };
