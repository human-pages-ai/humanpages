import { defineConfig } from 'vitest/config';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

// Each test run gets its own ephemeral database so concurrent runs never collide
const dbName = `humans_test_${process.pid}_${Date.now()}`;

// Create a temp photo-pipeline directory for tests (paths are resolved at module import)
const photoPipelineDir = join('/tmp', `photo-pipeline-test-${process.pid}`);
mkdirSync(join(photoPipelineDir, 'data', 'queue'), { recursive: true });
mkdirSync(join(photoPipelineDir, 'output'), { recursive: true });
writeFileSync(join(photoPipelineDir, 'suggested_batch.json'), '[]');
writeFileSync(join(photoPipelineDir, 'data', 'photo_status.json'), '{}');

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
      PHOTO_PIPELINE_DIR: photoPipelineDir,
      AI_ADMIN_API_KEY: 'test-admin-api-key-12345',
    },
  },
});
