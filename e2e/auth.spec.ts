import { test, expect } from '@playwright/test';
import { uniqueEmail, signup, login, signupViaAPI, bypassRateLimit, getToken, goToDashboard } from './helpers';

test.describe('Auth', () => {
  test('signup happy path → redirects to onboarding', async ({ page }) => {
    await bypassRateLimit(page);
    const email = uniqueEmail();
    await signup(page, { name: 'Signup Test', email, password: 'TestPass123!' });
    expect(page.url()).toContain('/onboarding');
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

  test('logout → redirects to login and clears token', async ({ page }) => {
    const email = uniqueEmail();
    const password = 'TestPass123!';
    const token = await signupViaAPI({ name: 'Logout Test', email, password });

    // Inject token and go to dashboard
    await goToDashboard(page, token);

    // Click the Logout button specifically
    await page.getByRole('button', { name: 'Logout' }).click();
    await page.waitForURL('**/login', { timeout: 10_000 });

    const storedToken = await getToken(page);
    expect(storedToken).toBeNull();
  });
});
