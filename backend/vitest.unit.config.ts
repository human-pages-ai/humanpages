import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // No setupFiles — unit tests don't need database
    testTimeout: 10000,
    include: ['src/tests/email.test.ts'],
    exclude: ['dist/**', 'node_modules/**'],
    env: {
      JWT_SECRET: 'test-jwt-secret-for-testing-only',
      NODE_ENV: 'test',
    },
  },
});
