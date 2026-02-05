import { execSync } from 'child_process';
import { beforeAll, afterAll } from 'vitest';
import { prisma } from '../lib/prisma.js';

// Migrate test database before all tests
beforeAll(async () => {
  try {
    execSync('npx prisma migrate deploy', {
      env: { ...process.env },
      stdio: 'pipe',
    });
  } catch (error) {
    // If migrate deploy fails, try reset
    execSync('npx prisma migrate reset --force', {
      env: { ...process.env },
      stdio: 'pipe',
    });
  }
});

// Disconnect after all tests
afterAll(async () => {
  await prisma.$disconnect();
});

// Re-export prisma for tests
export { prisma };
