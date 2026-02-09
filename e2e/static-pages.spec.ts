import { test, expect } from '@playwright/test';

test.describe('Static Pages', () => {
  test('privacy policy page loads', async ({ page }) => {
    await page.goto('/privacy');
    await expect(page.locator('h1')).toBeVisible({ timeout: 5_000 });
    // Page should have meaningful content
    await expect(page.locator('body')).toContainText('Privacy');
  });

  test('terms of use page loads', async ({ page }) => {
    await page.goto('/terms');
    await expect(page.locator('h1')).toBeVisible({ timeout: 5_000 });
    await expect(page.locator('body')).toContainText('Terms');
  });

  test('developers page loads with API docs', async ({ page }) => {
    await page.goto('/dev');
    await expect(page.locator('h1')).toBeVisible({ timeout: 5_000 });
    // Should contain API-related content
    await expect(page.locator('body')).toContainText('API');
  });

  test('blog index page loads', async ({ page }) => {
    await page.goto('/blog');
    await expect(page.locator('h1')).toBeVisible({ timeout: 5_000 });
  });

  test('blog article page loads', async ({ page }) => {
    await page.goto('/blog/ai-agents-hiring-humans');
    await expect(page.locator('h1')).toBeVisible({ timeout: 5_000 });
    // Should have article content
    await expect(page.locator('article')).toBeVisible();
  });

  test('404 page for unknown route', async ({ page }) => {
    await page.goto('/this-route-does-not-exist');
    // Should show some kind of not-found content
    await expect(page.locator('body')).toContainText(/not found|404|page/i, { timeout: 5_000 });
  });
});
