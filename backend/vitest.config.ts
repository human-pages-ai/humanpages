import { defineConfig } from 'vitest/config';

// Each test run gets its own ephemeral database so concurrent runs never collide
const dbName = `humans_test_${process.pid}_${Date.now()}`;

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./src/tests/setup.ts'],
    testTimeout: 10000,
    hookTimeout: 30000,
    fileParallelism: false, // Sequential within a run (files share one DB)
    exclude: ['dist/**', 'node_modules/**'],
    env: {
      DATABASE_URL: `postgresql://humans:humans_secret@localhost:5432/${dbName}?schema=public`,
      TEST_DB_NAME: dbName,
      JWT_SECRET: 'test-jwt-secret-for-testing-only',
      PORT: '3002',
      NODE_ENV: 'test',
    },
  },
});
