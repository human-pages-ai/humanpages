import { defineConfig } from 'vitest/config';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

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
    setupFiles: ['./src/tests/setup-no-db.ts'],
    testTimeout: 10000,
    hookTimeout: 30000,
    include: ['src/tests/photoConcepts.test.ts'],
    exclude: ['dist/**', 'node_modules/**'],
    env: {
      DATABASE_URL: 'postgresql://unused:unused@localhost:5432/unused',
      JWT_SECRET: 'test-jwt-secret-for-testing-only',
      PORT: '3002',
      NODE_ENV: 'test',
      PHOTO_PIPELINE_DIR: photoPipelineDir,
      AI_ADMIN_API_KEY: 'test-admin-api-key-12345',
    },
  },
});
