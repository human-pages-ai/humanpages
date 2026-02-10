import { test, expect } from '@playwright/test';

test.describe('Landing Page', () => {
  test('renders hero, task cards, and CTAs', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Hero section
    await expect(page.locator('h1')).toBeVisible();

    // At least one CTA links to /signup
    const signupLinks = page.locator('a[href*="/signup"]');
    await expect(signupLinks.first()).toBeVisible();

    // Task cards section – check a few tasks render
    await expect(page.getByRole('heading', { name: 'Photography' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Research' })).toBeVisible();
  });

  test('FAQ items expand and collapse', async ({ page }) => {
    await page.goto('/');

    // Scroll to FAQ section – heading text is "Questions & answers"
    const faqHeading = page.getByRole('heading', { name: /questions/i });
    await faqHeading.scrollIntoViewIfNeeded();

    // Find first FAQ button (aria-expanded)
    const firstFaq = page.locator('button[aria-expanded]').first();
    await expect(firstFaq).toHaveAttribute('aria-expanded', 'false');

    // Click to expand
    await firstFaq.click();
    await expect(firstFaq).toHaveAttribute('aria-expanded', 'true');

    // Click again to collapse
    await firstFaq.click();
    await expect(firstFaq).toHaveAttribute('aria-expanded', 'false');
  });

  test('JSON-LD structured data present', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Wait for React/Helmet to inject all JSON-LD scripts (static + dynamic)
    await expect(async () => {
      const scripts = await page.locator('script[type="application/ld+json"]').allTextContents();
      expect(scripts.length).toBeGreaterThan(0);
      const allJsonLd = scripts.join(' ');
      expect(allJsonLd).toContain('Organization');
      expect(allJsonLd).toContain('FAQPage');
    }).toPass({ timeout: 5_000 });
  });

  test('footer links navigate correctly', async ({ page }) => {
    await page.goto('/');

    // Privacy link
    const privacyLink = page.locator('footer a[href*="/privacy"]');
    await expect(privacyLink).toBeVisible();

    // Terms link
    const termsLink = page.locator('footer a[href*="/terms"]');
    await expect(termsLink).toBeVisible();

    // Dev link
    const devLink = page.locator('footer a[href*="/dev"]');
    await expect(devLink).toBeVisible();
  });
});
