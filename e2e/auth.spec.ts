import { test, expect } from '@playwright/test';
import { uniqueEmail, signup, login, signupViaAPI, bypassRateLimit, getToken } from './helpers';

test.describe('Auth', () => {
  test('signup happy path → redirects to onboarding', async ({ page }) => {
    await bypassRateLimit(page);
    const email = uniqueEmail();
    await signup(page, { name: 'Signup Test', email, password: 'TestPass123!' });
    expect(page.url()).toContain('/onboarding');
  });

  test('signup validation – terms checkbox required', async ({ page }) => {
    await page.goto('/signup');
    await page.locator('#name').fill('No Terms');
    await page.locator('#email').fill(uniqueEmail());
    await page.locator('#password').fill('TestPass123!');
    // Do NOT check #terms
    await expect(page.locator('button[type="submit"]')).toBeDisabled();
  });

  test('login happy path → redirects to dashboard', async ({ page }) => {
    await bypassRateLimit(page);
    const email = uniqueEmail();
    const password = 'TestPass123!';
    // Create account via API to save rate limit
    await signupViaAPI({ name: 'Login Test', email, password });
    await login(page, { email, password });
    expect(page.url()).toContain('/dashboard');
  });

  test('login with invalid credentials → shows error', async ({ page }) => {
    await bypassRateLimit(page);
    await page.goto('/login');
    await page.locator('#email').fill('nonexistent@test.com');
    await page.locator('#password').fill('WrongPassword');
    await page.locator('button[type="submit"]').click();
    await expect(page.locator('[role="alert"]')).toBeVisible({ timeout: 5_000 });
  });

  test('logout → redirects to login and clears token', async ({ page }) => {
    const email = uniqueEmail();
    const password = 'TestPass123!';
    const token = await signupViaAPI({ name: 'Logout Test', email, password });

    // Inject token and go to dashboard
    await page.goto('/');
    await page.evaluate((t) => localStorage.setItem('token', t), token);
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Click the Logout button specifically
    await page.getByRole('button', { name: 'Logout' }).click();
    await page.waitForURL('**/login', { timeout: 10_000 });

    const storedToken = await getToken(page);
    expect(storedToken).toBeNull();
  });
});
