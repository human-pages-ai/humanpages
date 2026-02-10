import { test, expect } from '@playwright/test';
import { signupAndGoToDashboard, signupViaAPI, uniqueEmail, goToDashboard } from './helpers';

test.describe('Account', () => {
  test('export data triggers download', async ({ page }) => {
    await signupAndGoToDashboard(page);

    // Navigate to Settings tab where Account section lives
    await page.getByRole('tab', { name: /settings/i }).click();

    // Expand the danger zone / account management section
    await page.getByText('Account Management').click();

    // The export creates a Blob download via JS. Listen for the download event.
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 10_000 }),
      page.getByRole('button', { name: 'Export Data' }).click(),
    ]);

    expect(download).toBeTruthy();
    const filename = download.suggestedFilename();
    expect(filename).toContain('human-pages-export');
    expect(filename).toContain('.json');
  });

  test('delete account → redirected to /, cannot login', async ({ page }) => {
    const email = uniqueEmail();
    const password = 'TestPass123!';

    const token = await signupViaAPI({ name: 'Delete Me', email, password });

    // Inject token and go to dashboard
    await goToDashboard(page, token);

    // Navigate to Settings tab where Account section lives
    await page.getByRole('tab', { name: /settings/i }).click();

    // Expand account management
    await page.getByText('Account Management').click();

    // Click initial "Delete Account" button text
    await page.getByRole('button', { name: 'Delete Account' }).click();

    // Enter password and confirm
    await page.locator('input[type="password"]').last().fill(password);
    await page.getByRole('button', { name: 'Yes, Delete My Account' }).click();

    // Should redirect to landing page
    await page.waitForURL('/', { timeout: 15_000 });

    // Try to login → should fail
    await page.goto('/login');
    await page.locator('#email').fill(email);
    await page.locator('#password').fill(password);
    await page.locator('button[type="submit"]').click();
    await expect(page.locator('[role="alert"]')).toBeVisible({ timeout: 5_000 });
  });
});
