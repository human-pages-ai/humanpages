import { test, expect } from '@playwright/test';
import { uniqueEmail, signupViaAPI, bypassRateLimit } from './helpers';

test.describe('Password Reset', () => {
  test('forgot password – submit email shows success', async ({ page }) => {
    await bypassRateLimit(page);
    await page.goto('/forgot-password');

    await page.locator('#email').fill('anyuser@example.com');
    await page.locator('button[type="submit"]').click();

    // Backend always returns success to prevent email enumeration
    // Success screen shows the email and a "Back Sign In" link
    await expect(page.getByText('anyuser@example.com')).toBeVisible({ timeout: 5_000 });
  });

  test('forgot password – back to login link', async ({ page }) => {
    await page.goto('/forgot-password');

    // "Back Sign In" link should go to /login
    const backLink = page.locator('a[href*="/login"]');
    await expect(backLink).toBeVisible();
    await backLink.click();
    await page.waitForURL('**/login', { timeout: 5_000 });
  });

  test('reset password – invalid token shows error page', async ({ page }) => {
    await page.goto('/reset-password?token=invalid-token-12345');

    // Should show invalid token message after validation
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 10_000 });
    // The page links back to forgot-password
    await expect(page.locator('a[href*="/forgot-password"]')).toBeVisible();
  });

  test('reset password – missing token shows error page', async ({ page }) => {
    await page.goto('/reset-password');

    // No token param → should show invalid token page
    await expect(page.locator('a[href*="/forgot-password"]')).toBeVisible({ timeout: 5_000 });
  });
});
