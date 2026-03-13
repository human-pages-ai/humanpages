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
  await prisma.monitoredError.deleteMany();
  await prisma.moderationQueue.deleteMany();
  await prisma.postingGroup.deleteMany();
  await prisma.adCopy.deleteMany();
  await prisma.hoursAdjustment.deleteMany();
  await prisma.staffPayment.deleteMany();
  await prisma.timeEntry.deleteMany();
  await prisma.staffApiKey.deleteMany();
  await prisma.careerApplication.deleteMany();
  await prisma.listingApplication.deleteMany();
  await prisma.listing.deleteMany();
  await prisma.feedback.deleteMany();
  await prisma.affiliateCredit.deleteMany();
  await prisma.affiliateReferral.deleteMany();
  await prisma.affiliate.deleteMany();
  await prisma.pendingNotification.deleteMany();
  await prisma.humanReport.deleteMany();
  await prisma.agentReport.deleteMany();
  await prisma.review.deleteMany();
  await prisma.streamTick.deleteMany();
  await prisma.jobMessage.deleteMany();
  await prisma.job.deleteMany();
  await prisma.vouch.deleteMany();
  await prisma.service.deleteMany();
  await prisma.wallet.deleteMany();
  await prisma.x402Payment.deleteMany();
  await prisma.agent.deleteMany();
  await prisma.human.deleteMany();
  await prisma.passwordReset.deleteMany();
  await prisma.oAuthState.deleteMany();
}

/**
 * Create a test agent with specific activation status
 */
export async function createActiveTestAgent(overrides?: {
  name?: string;
  tier?: string;
  status?: 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'BANNED';
  expiresInDays?: number | null;
}): Promise<TestAgent> {
  const agent = await createTestAgent({
    name: overrides?.name,
    domainVerified: false,
  });

  const status = overrides?.status ?? 'ACTIVE';
  const tier = overrides?.tier ?? 'BASIC';
  // BASIC tier has no expiry by default; PRO expires in 60 days
  const defaultDays = tier === 'BASIC' ? null : 60;
  const expiresInDays = overrides?.expiresInDays !== undefined ? overrides.expiresInDays : defaultDays;
  const expiresAt = expiresInDays === null
    ? null
    : new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);

  await prisma.agent.update({
    where: { id: agent.id },
    data: {
      status,
      activatedAt: status === 'ACTIVE' ? new Date() : null,
      activationMethod: 'SOCIAL',
      activationExpiresAt: expiresAt,
      activationTier: overrides?.tier ?? 'BASIC',
    },
  });

  return agent;
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
    .send({ email, password, name, termsAccepted: true, captchaToken: 'test-token' });

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
    .send({ email, password, captchaToken: 'test-token' });

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
 * Create a stream job directly in the database for testing
 */
export async function createStreamJob(overrides: {
  humanId: string;
  agentId: string;
  registeredAgentId: string;
  method?: 'SUPERFLUID' | 'MICRO_TRANSFER';
  interval?: 'HOURLY' | 'DAILY' | 'WEEKLY';
  rateUsdc?: number;
  maxTicks?: number;
  status?: string;
}): Promise<{ id: string }> {
  const job = await prisma.job.create({
    data: {
      humanId: overrides.humanId,
      agentId: overrides.agentId,
      registeredAgentId: overrides.registeredAgentId,
      title: 'Stream Test Job',
      description: 'Test stream job',
      priceUsdc: overrides.rateUsdc || 10,
      paymentMode: 'STREAM',
      streamMethod: overrides.method || 'SUPERFLUID',
      streamInterval: overrides.interval || 'DAILY',
      streamRateUsdc: overrides.rateUsdc || 10,
      streamMaxTicks: overrides.maxTicks,
      status: (overrides.status as any) || 'ACCEPTED',
    },
  });
  return { id: job.id };
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
