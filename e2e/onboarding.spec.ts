import { test, expect } from '@playwright/test';
import { uniqueEmail, signupViaAPI } from './helpers';

test.describe('Onboarding', () => {
  test('single-step flow → lands on /dashboard', async ({ page }) => {
    const email = uniqueEmail();
    const token = await signupViaAPI({ name: 'Onboard Full', email, password: 'TestPass123!' });

    // Mock Nominatim geocoding so location selection works offline
    await page.route('**/nominatim.openstreetmap.org/**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{
          display_name: 'New York, New York, United States',
          lat: '40.7128',
          lon: '-74.0060',
          type: 'city',
          class: 'place',
          address: { city: 'New York', state: 'New York', country: 'United States' },
        }]),
      });
    });

    // Inject token and go to onboarding
    await page.goto('/');
    await page.evaluate((t) => localStorage.setItem('token', t), token);
    await page.goto('/onboarding');
    await page.waitForSelector('#location-input', { timeout: 15_000 });
    await page.locator('#location-input').fill('New York');
    // Wait for and click the dropdown result
    await page.locator('ul button', { hasText: 'New York' }).first().click({ timeout: 5_000 });
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
    await page.waitForSelector('#location-input', { timeout: 15_000 });

    await page.getByText('Skip setup and go to dashboard').click();
    await page.waitForURL('**/dashboard', { timeout: 10_000 });
  });

  test('validation – no location/skills → error', async ({ page }) => {
    const email = uniqueEmail();
    const token = await signupViaAPI({ name: 'Onboard Validate', email, password: 'TestPass123!' });

    await page.goto('/');
    await page.evaluate((t) => localStorage.setItem('token', t), token);
    await page.goto('/onboarding');
    await page.waitForSelector('#location-input', { timeout: 15_000 });
    await page.getByRole('button', { name: 'Complete Profile' }).click();

    await expect(page.locator('.text-red-600')).toBeVisible({ timeout: 3_000 });
  });

  test('custom skill – add and see in selected list', async ({ page }) => {
    const email = uniqueEmail();
    const token = await signupViaAPI({ name: 'Onboard Custom', email, password: 'TestPass123!' });

    await page.goto('/');
    await page.evaluate((t) => localStorage.setItem('token', t), token);
    await page.goto('/onboarding');
    await page.waitForSelector('#location-input', { timeout: 15_000 });

    // Add custom skill directly (no Step 1 to pass through)
    await page.waitForSelector('#custom-skill', { timeout: 5_000 });
    await page.locator('#custom-skill').fill('Underwater Basket Weaving');
    await page.getByRole('button', { name: 'Add', exact: true }).click();

    await expect(page.locator('.bg-blue-50')).toContainText('Underwater Basket Weaving');
  });
});
