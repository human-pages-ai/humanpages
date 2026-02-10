import { execSync } from 'child_process';
import { beforeAll, afterAll } from 'vitest';
import { Client } from 'pg';
import { prisma } from '../lib/prisma.js';

const dbName = process.env.TEST_DB_NAME!;
const adminUrl = 'postgresql://humans:humans_secret@localhost:5432/postgres';

// Create an ephemeral database for this test run, push schema, tear down after
beforeAll(async () => {
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

    // Create the ephemeral database for this run
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
});

// Drop ephemeral database after all tests
afterAll(async () => {
  await prisma.$disconnect();

  const client = new Client({ connectionString: adminUrl });
  await client.connect();
  try {
    // Terminate any lingering connections to our DB
    await client.query(`
      SELECT pg_terminate_backend(pid)
      FROM pg_stat_activity
      WHERE datname = $1 AND pid <> pg_backend_pid()
    `, [dbName]);
    await client.query(`DROP DATABASE IF EXISTS "${dbName}"`);
  } finally {
    await client.end();
  }
});

// Re-export prisma for tests
export { prisma };
