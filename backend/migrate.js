#!/usr/bin/env node

/**
 * Production migration runner.
 * - Lists pending migrations
 * - Applies them via `prisma migrate deploy`
 * - Logs exactly which migrations were applied
 *
 * Usage: node migrate.js
 * Exit codes: 0 = success, 1 = failure
 */

const { execSync } = require("child_process");
const { Client } = require("pg");
const path = require("path");
const fs = require("fs");

const MIGRATIONS_DIR = path.join(__dirname, "prisma", "migrations");

async function getMigrationsTable(client) {
  // Check if the _prisma_migrations table exists
  const tableCheck = await client.query(`
    SELECT EXISTS (
      SELECT FROM information_schema.tables
      WHERE table_name = '_prisma_migrations'
    )
  `);

  if (!tableCheck.rows[0].exists) {
    return [];
  }

  const result = await client.query(`
    SELECT migration_name, finished_at, applied_steps_count, logs
    FROM _prisma_migrations
    ORDER BY started_at ASC
  `);
  return result.rows;
}

function getLocalMigrations() {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    return [];
  }
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((entry) => {
      const fullPath = path.join(MIGRATIONS_DIR, entry);
      return (
        fs.statSync(fullPath).isDirectory() &&
        fs.existsSync(path.join(fullPath, "migration.sql"))
      );
    })
    .sort();
}

async function run() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("ERROR: DATABASE_URL is not set");
    process.exit(1);
  }

  const client = new Client({ connectionString: databaseUrl });

  try {
    await client.connect();
  } catch (err) {
    console.error("ERROR: Could not connect to the database");
    console.error(err.message);
    process.exit(1);
  }

  try {
    const appliedMigrations = await getMigrationsTable(client);
    const appliedNames = new Set(appliedMigrations.map((m) => m.migration_name));
    const localMigrations = getLocalMigrations();

    const pending = localMigrations.filter((name) => !appliedNames.has(name));

    if (pending.length === 0) {
      console.log("No pending migrations. Database is up to date.");
      await client.end();
      process.exit(0);
    }

    console.log(`Found ${pending.length} pending migration(s):`);
    pending.forEach((name) => console.log(`  - ${name}`));
    console.log("");

    // Run prisma migrate deploy — it applies all pending migrations in order
    console.log("Applying migrations...\n");
    try {
      execSync("npx prisma migrate deploy", {
        cwd: __dirname,
        stdio: "inherit",
        env: { ...process.env },
      });
    } catch {
      console.error("\nERROR: Migration failed. Check the output above.");
      console.error("The database may be in a partially migrated state.");
      console.error("Fix the failing migration and re-run this script.");
      process.exit(1);
    }

    // Verify what was applied
    const afterMigrations = await getMigrationsTable(client);
    const newlyApplied = afterMigrations.filter(
      (m) => !appliedNames.has(m.migration_name)
    );

    console.log(`\nSuccessfully applied ${newlyApplied.length} migration(s):`);
    newlyApplied.forEach((m) => {
      const status = m.finished_at ? "OK" : "INCOMPLETE";
      console.log(`  [${status}] ${m.migration_name}`);
      if (m.logs) {
        console.log(`         logs: ${m.logs}`);
      }
    });

    // Check for any failed migrations
    const failed = newlyApplied.filter((m) => !m.finished_at);
    if (failed.length > 0) {
      console.error(`\nWARNING: ${failed.length} migration(s) did not complete.`);
      process.exit(1);
    }

    console.log("\nAll migrations applied successfully.");
  } finally {
    await client.end();
  }
}

run();
