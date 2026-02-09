import request from 'supertest';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import app from '../app.js';
import { prisma } from '../lib/prisma.js';

export interface TestUser {
  id: string;
  email: string;
  name: string;
  token: string;
}

export interface TestAgent {
  id: string;
  name: string;
  apiKey: string;
}

/**
 * Clean all data from the database - call this in beforeEach
 */
export async function cleanDatabase(): Promise<void> {
  // Delete in order respecting foreign key constraints
  await prisma.review.deleteMany();
  await prisma.job.deleteMany();
  await prisma.service.deleteMany();
  await prisma.wallet.deleteMany();
  await prisma.agent.deleteMany();
  await prisma.human.deleteMany();
  await prisma.passwordReset.deleteMany();
  await prisma.oAuthState.deleteMany();
}

/**
 * Create a test agent with an API key directly in the database
 */
export async function createTestAgent(overrides?: {
  name?: string;
  websiteUrl?: string;
  domainVerified?: boolean;
}): Promise<TestAgent> {
  const name = overrides?.name || `Test Agent ${Date.now()}`;
  const keyBytes = crypto.randomBytes(24).toString('hex');
  const apiKey = `hp_${keyBytes}`;
  const apiKeyPrefix = apiKey.substring(0, 8);
  const apiKeyHash = await bcrypt.hash(apiKey, 10);
  const verificationToken = crypto.randomBytes(32).toString('hex');

  const agent = await prisma.agent.create({
    data: {
      name,
      apiKeyHash,
      apiKeyPrefix,
      verificationToken,
      websiteUrl: overrides?.websiteUrl,
      domainVerified: overrides?.domainVerified ?? false,
      ...(overrides?.domainVerified ? { verifiedAt: new Date() } : {}),
    },
  });

  return { id: agent.id, name: agent.name, apiKey };
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
