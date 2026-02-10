import { Page, expect, request as pwRequest } from '@playwright/test';

/** Backend API server (direct, bypasses Vite proxy) */
export const API_BASE = 'http://localhost:3001';

let ipCounter = Math.floor(Math.random() * 1_000_000);

function uniqueIp(): string {
  ipCounter += 1;
  // Use large random offset so IPs never collide across test runs
  const a = (ipCounter >> 16) & 0xff;
  const b = (ipCounter >> 8) & 0xff;
  const c = ipCounter & 0xff;
  return `10.${a}.${b}.${c}`;
}

export function uniqueEmail(): string {
  return `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.com`;
}

/**
 * Add X-Forwarded-For header to all /api/auth requests to bypass rate limiting.
 * Call this at the start of tests that use UI-based signup/login.
 */
export async function bypassRateLimit(page: Page) {
  const ip = uniqueIp();
  await page.route('**/api/auth/**', (route) => {
    route.continue({
      headers: { ...route.request().headers(), 'X-Forwarded-For': ip },
    });
  });
}

/**
 * Sign up via the UI.
 * Call bypassRateLimit(page) before using this.
 */
export async function signup(
  page: Page,
  { name, email, password }: { name: string; email: string; password: string },
) {
  await page.goto('/signup');
  await page.locator('#name').fill(name);
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.locator('#terms').check();
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(/\/(onboarding|dashboard|welcome)/, { timeout: 15_000 });
}

/**
 * Sign up via the Vite-proxied API with unique X-Forwarded-For.
 * The Vite proxy at :3000 forwards to :3001, and express trusts proxy=1,
 * so it picks up our X-Forwarded-For header.
 * Returns the JWT token.
 */
export async function signupViaAPI(creds: { name: string; email: string; password: string }): Promise<string> {
  const ctx = await pwRequest.newContext();
  const res = await ctx.post(`${API_BASE}/api/auth/signup`, {
    data: { email: creds.email, password: creds.password, name: creds.name, termsAccepted: true, captchaToken: 'test-token' },
    headers: { 'X-Forwarded-For': uniqueIp() },
  });
  if (!res.ok()) {
    const text = await res.text();
    throw new Error(`signupViaAPI failed (${res.status()}): ${text}`);
  }
  const body = await res.json();
  await ctx.dispose();
  return body.token;
}

/**
 * Login via the Vite-proxied API with unique X-Forwarded-For.
 */
export async function loginViaAPI(creds: { email: string; password: string }): Promise<string> {
  const ctx = await pwRequest.newContext();
  const res = await ctx.post(`${API_BASE}/api/auth/login`, {
    data: { email: creds.email, password: creds.password, captchaToken: 'test-token' },
    headers: { 'X-Forwarded-For': uniqueIp() },
  });
  if (!res.ok()) {
    const text = await res.text();
    throw new Error(`loginViaAPI failed (${res.status()}): ${text}`);
  }
  const body = await res.json();
  await ctx.dispose();
  return body.token;
}

export async function skipOnboarding(page: Page) {
  await page.getByText('Skip setup and go to dashboard').click();
  await page.waitForURL('**/dashboard', { timeout: 10_000 });
}

export async function login(
  page: Page,
  { email, password }: { email: string; password: string },
) {
  await page.goto('/login');
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL('**/dashboard', { timeout: 15_000 });
}

/**
 * Create a fresh user via API, inject token into browser, and go to /dashboard.
 */
export async function signupAndGoToDashboard(page: Page) {
  const email = uniqueEmail();
  const password = 'TestPass123!';
  const name = 'E2E User';

  const token = await signupViaAPI({ name, email, password });

  // Inject token into browser and navigate to dashboard
  await page.goto('/');
  await page.evaluate((t) => localStorage.setItem('token', t), token);
  await page.goto('/dashboard');
  await page.waitForLoadState('networkidle', { timeout: 15_000 });

  return { email, password, name, token };
}

export async function getToken(page: Page): Promise<string | null> {
  return page.evaluate(() => localStorage.getItem('token'));
}
