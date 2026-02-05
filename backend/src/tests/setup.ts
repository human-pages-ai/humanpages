import { execSync } from 'child_process';
import { beforeAll, afterAll } from 'vitest';
import { prisma } from '../lib/prisma.js';

// Sync test database schema before all tests
beforeAll(async () => {
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

// Disconnect after all tests
afterAll(async () => {
  await prisma.$disconnect();
});

// Re-export prisma for tests
export { prisma };
