import { test, expect } from '@playwright/test';
import { signupAndGoToDashboard } from './helpers';

// Profile save involves API call + full profile reload (trust score, reputation, etc.)
const SAVE_TIMEOUT = 30_000;

test.describe('Dashboard – Profile', () => {
  test('edit and save profile fields', async ({ page }) => {
    await signupAndGoToDashboard(page);

    // Navigate to Profile tab
    await page.getByRole('tab', { name: /profile/i }).click();

    // Click the first "Edit" link on the page (profile section Edit)
    const editButtons = page.locator('button:has-text("Edit"), a:has-text("Edit")').filter({ hasText: /^Edit$/ });
    await editButtons.first().click();

    await page.waitForSelector('#profile-bio', { timeout: 5_000 });

    await page.locator('#profile-bio').fill('I am an E2E test user.');
    await page.locator('#profile-skills').fill('testing, automation');
    await page.locator('#profile-contact-email').fill('contact@test.com');

    // Wait for auto-save to complete (shows "Saved" indicator)
    await expect(page.locator('text=Saved')).toBeVisible({ timeout: SAVE_TIMEOUT });

    // Click Done to exit edit mode
    await page.getByRole('button', { name: 'Done' }).click();

    // Wait for form to close (bio input disappears)
    await expect(page.locator('#profile-bio')).not.toBeVisible({ timeout: SAVE_TIMEOUT });

    // Reload and navigate back to Profile tab to verify values persisted
    await page.reload();
    await page.getByRole('tab', { name: /profile/i }).click();
    await page.getByRole('heading', { name: 'Profile', exact: true }).waitFor({ timeout: SAVE_TIMEOUT });
    await expect(page.locator('text=I am an E2E test user.')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('text=contact@test.com')).toBeVisible();
  });

  test('social links – add LinkedIn and GitHub', async ({ page }) => {
    await signupAndGoToDashboard(page);

    // Navigate to Profile tab
    await page.getByRole('tab', { name: /profile/i }).click();

    // Click Edit
    const editButtons = page.locator('button:has-text("Edit"), a:has-text("Edit")').filter({ hasText: /^Edit$/ });
    await editButtons.first().click();

    await page.waitForSelector('#profile-linkedin', { timeout: 5_000 });

    await page.locator('#profile-linkedin').fill('https://linkedin.com/in/e2etest');
    await page.locator('#profile-github').fill('https://github.com/e2etest');

    // Wait for auto-save to complete
    await expect(page.locator('text=Saved')).toBeVisible({ timeout: SAVE_TIMEOUT });

    // Click Done to exit edit mode
    await page.getByRole('button', { name: 'Done' }).click();

    // Wait for form to close
    await expect(page.locator('#profile-linkedin')).not.toBeVisible({ timeout: SAVE_TIMEOUT });

    // Reload and navigate back to Profile tab to verify links are saved
    await page.reload();
    await page.getByRole('tab', { name: /profile/i }).click();
    await page.getByRole('heading', { name: 'Profile', exact: true }).waitFor({ timeout: SAVE_TIMEOUT });
    // Social links display as anchor text "LinkedIn", "GitHub" in view mode with URLs in href
    await expect(page.locator('a[href="https://linkedin.com/in/e2etest"]')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('a[href="https://github.com/e2etest"]')).toBeVisible();
  });

  test('dashboard loads with status header on fresh account', async ({ page }) => {
    await signupAndGoToDashboard(page);
    await expect(page.locator('main')).toBeVisible({ timeout: 10_000 });
    // Verify the dashboard loaded — the StatusHeader availability button should be visible
    await expect(page.locator('button').filter({ hasText: /^(Active|Paused)$/ })).toBeVisible();
  });
});
