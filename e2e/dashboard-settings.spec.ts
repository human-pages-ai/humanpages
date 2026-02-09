import { test, expect, request as pwRequest } from '@playwright/test';
import { signupAndGoToDashboard, getToken, API_BASE } from './helpers';

test.describe('Dashboard – Settings', () => {
  test('toggle availability', async ({ page }) => {
    await signupAndGoToDashboard(page);

    const workStatusSection = page.locator('h2:has-text("Work Status")').locator('..').locator('..');
    const toggleBtn = workStatusSection.locator('button').filter({ hasText: /^(Active|Paused)$/ });
    const initialText = await toggleBtn.textContent();

    await toggleBtn.click();
    await page.waitForTimeout(1_000);

    const newText = await toggleBtn.textContent();
    expect(newText).not.toBe(initialText);

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

    await page.getByRole('button', { name: 'Escrow' }).click();
    await page.waitForTimeout(500);
    await expect(page.getByRole('button', { name: 'Escrow' })).toHaveClass(/bg-indigo-600/);

    await page.getByRole('button', { name: 'Payment Upfront' }).click();
    await page.waitForTimeout(500);
    await expect(page.getByRole('button', { name: 'Payment Upfront' })).toHaveClass(/bg-indigo-600/);
  });

  test('notification toggles', async ({ page }) => {
    await signupAndGoToDashboard(page);

    const workStatusCard = page.locator('h2:has-text("Work Status")').locator('..').locator('..').locator('..');
    const switches = workStatusCard.locator('[role="switch"]');

    const emailSwitch = switches.first();
    const initialState = await emailSwitch.getAttribute('aria-checked');

    await emailSwitch.click();
    await page.waitForTimeout(500);
    const newState = await emailSwitch.getAttribute('aria-checked');
    expect(newState).not.toBe(initialState);

    await emailSwitch.click();
    await page.waitForTimeout(500);
    const restoredState = await emailSwitch.getAttribute('aria-checked');
    expect(restoredState).toBe(initialState);
  });

  test('offer filters – set min price and max distance', async ({ page }) => {
    await signupAndGoToDashboard(page);

    await page.getByRole('button', { name: 'Configure' }).click();

    await page.locator('#filter-min-price').fill('50');
    await page.locator('#filter-max-distance').fill('100');

    await page.getByRole('button', { name: 'Save Filters' }).click();

    await page.waitForTimeout(1_500);

    await expect(page.locator('text=$50')).toBeVisible({ timeout: 5_000 });
    await expect(page.locator('text=100 km')).toBeVisible();
  });
});
