import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    pool: 'forks',              // Each worker is a separate process with its own pid
    poolOptions: {
      forks: {
        maxForks: 8,            // Cap workers to avoid exhausting PG max_connections (100)
      },
    },
    setupFiles: ['./src/tests/setup.ts'],
    testTimeout: 10000,
    hookTimeout: 30000,
    // fileParallelism defaults to true — each forked worker gets its own DB
    exclude: ['dist/**', 'node_modules/**'],
    env: {
      JWT_SECRET: 'test-jwt-secret-for-testing-only',
      PORT: '3002',
      NODE_ENV: 'test',
      AI_ADMIN_API_KEY: 'test-admin-api-key-12345',
      BCRYPT_ROUNDS: '1',
    },
  },
});
