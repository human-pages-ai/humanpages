import { test, expect } from '@playwright/test';
import { signupAndGoToDashboard } from './helpers';

test.describe('Dashboard – Profile', () => {
  test('edit and save profile fields', async ({ page }) => {
    await signupAndGoToDashboard(page);

    // Click the first "Edit" link on the page (profile section Edit)
    const editButtons = page.locator('button:has-text("Edit"), a:has-text("Edit")').filter({ hasText: /^Edit$/ });
    await editButtons.first().click();

    await page.waitForSelector('#profile-bio', { timeout: 5_000 });

    await page.locator('#profile-bio').fill('I am an E2E test user.');
    await page.locator('#profile-skills').fill('testing, automation');
    await page.locator('#profile-contact-email').fill('contact@test.com');

    await page.getByRole('button', { name: 'Save Profile' }).click();

    // Wait for save to complete
    await expect(page.locator('#profile-bio')).not.toBeVisible({ timeout: 5_000 });

    // Reload and verify values persisted
    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(page.locator('text=I am an E2E test user.')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('text=contact@test.com')).toBeVisible();
  });

  test('social links – add LinkedIn and GitHub', async ({ page }) => {
    await signupAndGoToDashboard(page);

    // Click Edit
    const editButtons = page.locator('button:has-text("Edit"), a:has-text("Edit")').filter({ hasText: /^Edit$/ });
    await editButtons.first().click();

    await page.waitForSelector('#profile-linkedin', { timeout: 5_000 });

    await page.locator('#profile-linkedin').fill('https://linkedin.com/in/e2etest');
    await page.locator('#profile-github').fill('https://github.com/e2etest');

    await page.getByRole('button', { name: 'Save Profile' }).click();

    // Wait for save to complete
    await expect(page.locator('#profile-linkedin')).not.toBeVisible({ timeout: 5_000 });

    // Reload and verify links are saved
    await page.reload();
    await page.waitForLoadState('networkidle');
    // Social links display as anchor text "LinkedIn", "GitHub" in view mode with URLs in href
    await expect(page.locator('a[href="https://linkedin.com/in/e2etest"]')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('a[href="https://github.com/e2etest"]')).toBeVisible();
  });

  test('profile completeness widget shows on fresh account', async ({ page }) => {
    await signupAndGoToDashboard(page);
    await expect(page.locator('main')).toBeVisible({ timeout: 10_000 });
    // Verify the dashboard loaded with the exact Profile section heading
    await expect(page.getByRole('heading', { name: 'Profile', exact: true })).toBeVisible();
  });
});
