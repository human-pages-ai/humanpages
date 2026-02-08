import request from 'supertest';
import app from '../app.js';
import { prisma } from '../lib/prisma.js';

export interface TestUser {
  id: string;
  email: string;
  name: string;
  token: string;
}

/**
 * Clean all data from the database - call this in beforeEach
 */
export async function cleanDatabase(): Promise<void> {
  // Delete in order respecting foreign key constraints
  await prisma.service.deleteMany();
  await prisma.wallet.deleteMany();
  await prisma.human.deleteMany();
  await prisma.passwordReset.deleteMany();
  await prisma.oAuthState.deleteMany();
}

/**
 * Create a test user and return their info with auth token
 */
export async function createTestUser(overrides?: {
  email?: string;
  password?: string;
  name?: string;
}): Promise<TestUser> {
  const email = overrides?.email || `test-${Date.now()}@example.com`;
  const password = overrides?.password || 'password123';
  const name = overrides?.name || 'Test User';

  const response = await request(app)
    .post('/api/auth/signup')
    .send({ email, password, name, termsAccepted: true });

  if (response.status !== 201) {
    throw new Error(`Failed to create test user: ${JSON.stringify(response.body)}`);
  }

  return {
    id: response.body.human.id,
    email: response.body.human.email,
    name: response.body.human.name,
    token: response.body.token,
  };
}

/**
 * Login and get token for existing user
 */
export async function loginUser(email: string, password: string): Promise<string> {
  const response = await request(app)
    .post('/api/auth/login')
    .send({ email, password });

  if (response.status !== 200) {
    throw new Error(`Failed to login: ${JSON.stringify(response.body)}`);
  }

  return response.body.token;
}

/**
 * Create a test user and update their profile with additional fields
 */
export async function createTestUserWithProfile(
  profileOverrides: Record<string, any>,
  userOverrides?: { email?: string; password?: string; name?: string }
): Promise<TestUser> {
  const user = await createTestUser(userOverrides);
  await prisma.human.update({
    where: { id: user.id },
    data: profileOverrides,
  });
  return user;
}

/**
 * Make an authenticated request
 */
export function authRequest(token: string) {
  return {
    get: (url: string) => request(app).get(url).set('Authorization', `Bearer ${token}`),
    post: (url: string) => request(app).post(url).set('Authorization', `Bearer ${token}`),
    patch: (url: string) => request(app).patch(url).set('Authorization', `Bearer ${token}`),
    delete: (url: string) => request(app).delete(url).set('Authorization', `Bearer ${token}`),
  };
}
