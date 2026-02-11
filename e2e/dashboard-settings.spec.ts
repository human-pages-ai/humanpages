import { test, expect, request as pwRequest } from '@playwright/test';
import { signupAndGoToDashboard, getToken, API_BASE } from './helpers';

// API calls go through profile reload (trust score, reputation, etc.)
// which can take 5-15 s on slow DBs, so we use generous timeouts.
const SAVE_TIMEOUT = 30_000;

test.describe('Dashboard – Settings', () => {
  test('toggle availability', async ({ page }) => {
    await signupAndGoToDashboard(page);

    // Availability toggle is in the StatusHeader, visible on all tabs
    const toggleBtn = page.locator('[data-testid="status-availability"]');
    await toggleBtn.waitFor({ timeout: 10_000 });
    const initialText = await toggleBtn.textContent();
    const expectedText = initialText === 'Active' ? 'Paused' : 'Active';

    // Accept the confirm dialog that appears when toggling availability off
    page.on('dialog', dialog => dialog.accept());

    await toggleBtn.click();

    // Wait for the API round-trip and React state to update
    await expect(toggleBtn).toHaveText(expectedText, { timeout: SAVE_TIMEOUT });

    // Verify via direct API call
    const token = await getToken(page);
    const api = await pwRequest.newContext({ baseURL: API_BASE });
    const res = await api.get('/api/humans/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const profile = await res.json();
    await api.dispose();
    expect(typeof profile.isAvailable).toBe('boolean');
  });

  test('change payment preference', async ({ page }) => {
    await signupAndGoToDashboard(page);

    // Payment preference is in the Profile tab > WorkStatusSection
    await page.getByRole('tab', { name: /profile/i }).click();

    await page.getByRole('button', { name: 'Escrow' }).click();
    await expect(page.getByRole('button', { name: 'Escrow' })).toHaveClass(/bg-indigo-600/, { timeout: SAVE_TIMEOUT });

    await page.getByRole('button', { name: 'Payment Upfront' }).click();
    await expect(page.getByRole('button', { name: 'Payment Upfront' })).toHaveClass(/bg-indigo-600/, { timeout: SAVE_TIMEOUT });
  });

  test('notification toggles', async ({ page }) => {
    await signupAndGoToDashboard(page);

    // Notification toggles are in the Profile tab > WorkStatusSection
    await page.getByRole('tab', { name: /profile/i }).click();

    const workStatusCard = page.locator('h2:has-text("Work Status")').locator('..').locator('..').locator('..');
    const switches = workStatusCard.locator('[role="switch"]');

    const emailSwitch = switches.first();
    const initialState = await emailSwitch.getAttribute('aria-checked');
    const expectedState = initialState === 'true' ? 'false' : 'true';

    await emailSwitch.click();
    // Wait for the API round-trip to complete and aria-checked to update
    await expect(emailSwitch).toHaveAttribute('aria-checked', expectedState, { timeout: SAVE_TIMEOUT });

    // Toggle back
    await emailSwitch.click();
    await expect(emailSwitch).toHaveAttribute('aria-checked', initialState!, { timeout: SAVE_TIMEOUT });
  });

  test('offer filters – set min price and max distance', async ({ page }) => {
    await signupAndGoToDashboard(page);

    // Offer filters are now in the Payments tab
    await page.getByRole('tab', { name: /payment/i }).click();

    await page.getByRole('button', { name: 'Configure' }).click();

    await page.locator('#filter-min-price').fill('50');
    await page.locator('#filter-max-distance').fill('100');

    await page.getByRole('button', { name: 'Save Filters' }).click();

    await expect(page.locator('text=$50')).toBeVisible({ timeout: SAVE_TIMEOUT });
    await expect(page.locator('text=100 km')).toBeVisible();
  });
});
