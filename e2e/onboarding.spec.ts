import { test, expect } from '@playwright/test';
import { uniqueEmail, signupViaAPI } from './helpers';

test.describe('Onboarding', () => {
  test('single-step flow → lands on /dashboard', async ({ page }) => {
    const email = uniqueEmail();
    const token = await signupViaAPI({ name: 'Onboard Full', email, password: 'TestPass123!' });

    // Inject token and go to onboarding
    await page.goto('/');
    await page.evaluate((t) => localStorage.setItem('token', t), token);
    await page.goto('/onboarding');
    await page.waitForLoadState('networkidle');

    // Single step: location + skills
    await page.waitForSelector('#location-input', { timeout: 5_000 });
    await page.locator('#location-input').fill('New York, NY');
    await page.getByRole('button', { name: 'Local Photography' }).click();
    await page.getByRole('button', { name: 'Complete Profile' }).click();

    await page.waitForURL('**/dashboard', { timeout: 10_000 });
  });

  test('skip → goes to /dashboard', async ({ page }) => {
    const email = uniqueEmail();
    const token = await signupViaAPI({ name: 'Onboard Skip', email, password: 'TestPass123!' });

    await page.goto('/');
    await page.evaluate((t) => localStorage.setItem('token', t), token);
    await page.goto('/onboarding');
    await page.waitForLoadState('networkidle');

    await page.getByText('Skip setup and go to dashboard').click();
    await page.waitForURL('**/dashboard', { timeout: 10_000 });
  });

  test('validation – no location/skills → error', async ({ page }) => {
    const email = uniqueEmail();
    const token = await signupViaAPI({ name: 'Onboard Validate', email, password: 'TestPass123!' });

    await page.goto('/');
    await page.evaluate((t) => localStorage.setItem('token', t), token);
    await page.goto('/onboarding');
    await page.waitForLoadState('networkidle');

    // Click Complete Profile without filling anything
    await page.waitForSelector('#location-input', { timeout: 5_000 });
    await page.getByRole('button', { name: 'Complete Profile' }).click();

    await expect(page.locator('.text-red-600')).toBeVisible({ timeout: 3_000 });
  });

  test('custom skill – add and see in selected list', async ({ page }) => {
    const email = uniqueEmail();
    const token = await signupViaAPI({ name: 'Onboard Custom', email, password: 'TestPass123!' });

    await page.goto('/');
    await page.evaluate((t) => localStorage.setItem('token', t), token);
    await page.goto('/onboarding');
    await page.waitForLoadState('networkidle');

    // Add custom skill directly (no Step 1 to pass through)
    await page.waitForSelector('#custom-skill', { timeout: 5_000 });
    await page.locator('#custom-skill').fill('Underwater Basket Weaving');
    await page.getByRole('button', { name: 'Add', exact: true }).click();

    await expect(page.locator('.bg-blue-50')).toContainText('Underwater Basket Weaving');
  });
});
