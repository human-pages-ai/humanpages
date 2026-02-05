import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./src/tests/setup.ts'],
    testTimeout: 10000,
    hookTimeout: 30000,
    fileParallelism: false, // Run test files sequentially to avoid DB conflicts
    env: {
      DATABASE_URL: 'postgresql://humans:humans_secret@localhost:5432/humans_marketplace_test?schema=public',
      JWT_SECRET: 'test-jwt-secret-for-testing-only',
      PORT: '3002',
    },
  },
});
