import { test, expect } from '@playwright/test';

/**
 * Mock the /api/geo/language endpoint to simulate different countries.
 * MUST be called before page.goto() so it intercepts the initial fetch.
 */
async function mockGeoLanguage(page: import('@playwright/test').Page, language: string, country: string) {
  await page.route('**/api/geo/language', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ language, country, source: 'ip' }),
    });
  });
}

/**
 * Clear all i18n-related localStorage keys.
 * Call on first visit, then reload to get a clean state with the mock active.
 */
async function clearLanguageState(page: import('@playwright/test').Page) {
  await page.evaluate(() => {
    localStorage.removeItem('i18next_ip_lang');
    localStorage.removeItem('i18next_user_choice');
    localStorage.removeItem('i18nextLng');
  });
}

test.describe('Geo-based Language Detection', () => {

  test('Venezuela IP → page renders in Spanish', async ({ page }) => {
    await mockGeoLanguage(page, 'es', 'VE');

    await page.goto('/');
    await clearLanguageState(page);
    await page.goto('/');

    // Wait for geo fetch to resolve and language to switch
    await expect(page.locator('html')).toHaveAttribute('lang', 'es', { timeout: 5000 });
  });

  test('Brazil IP → page renders in Portuguese', async ({ page }) => {
    await mockGeoLanguage(page, 'pt', 'BR');
    await page.goto('/');
    await clearLanguageState(page);
    await page.goto('/');

    await expect(page.locator('html')).toHaveAttribute('lang', 'pt', { timeout: 5000 });
  });

  test('France IP → page renders in French', async ({ page }) => {
    await mockGeoLanguage(page, 'fr', 'FR');
    await page.goto('/');
    await clearLanguageState(page);
    await page.goto('/');

    await expect(page.locator('html')).toHaveAttribute('lang', 'fr', { timeout: 5000 });
  });

  test('US IP → page renders in English', async ({ page }) => {
    await mockGeoLanguage(page, 'en', 'US');
    await page.goto('/');
    await clearLanguageState(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const lang = await page.locator('html').getAttribute('lang');
    expect(lang).toBe('en');
  });

  test('Mexico IP → page renders in Spanish', async ({ page }) => {
    await mockGeoLanguage(page, 'es', 'MX');
    await page.goto('/');
    await clearLanguageState(page);
    await page.goto('/');

    await expect(page.locator('html')).toHaveAttribute('lang', 'es', { timeout: 5000 });
  });

  test('Turkey IP → page renders in Turkish', async ({ page }) => {
    await mockGeoLanguage(page, 'tr', 'TR');
    await page.goto('/');
    await clearLanguageState(page);
    await page.goto('/');

    await expect(page.locator('html')).toHaveAttribute('lang', 'tr', { timeout: 5000 });
  });

  test('geo result is cached in localStorage for subsequent visits', async ({ page }) => {
    await mockGeoLanguage(page, 'es', 'MX');
    await page.goto('/');
    await clearLanguageState(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Wait for the geo fetch to complete and cache the result
    await expect(async () => {
      const cached = await page.evaluate(() => {
        const raw = localStorage.getItem('i18next_ip_lang');
        return raw ? JSON.parse(raw) : null;
      });
      expect(cached).not.toBeNull();
      expect(cached.language).toBe('es');
      expect(cached.timestamp).toBeGreaterThan(0);
    }).toPass({ timeout: 5000 });
  });

  test('cached result is used on second visit without re-fetching', async ({ page }) => {
    // Track fetch calls
    let geoFetchCount = 0;
    await page.route('**/api/geo/language', (route) => {
      geoFetchCount++;
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ language: 'en', country: 'US', source: 'ip' }),
      });
    });

    // Pre-populate cache BEFORE navigation so main.tsx reads it synchronously on load
    await page.addInitScript(() => {
      localStorage.removeItem('i18next_user_choice');
      localStorage.removeItem('i18nextLng');
      localStorage.setItem('i18next_ip_lang', JSON.stringify({
        language: 'pt',
        timestamp: Date.now(),
      }));
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Should NOT have fetched — cache was used (sync path)
    expect(geoFetchCount).toBe(0);

    // Should be Portuguese from cache
    await expect(page.locator('html')).toHaveAttribute('lang', 'pt', { timeout: 5000 });
  });

  test('manual language choice overrides IP detection', async ({ page }) => {
    await mockGeoLanguage(page, 'es', 'VE');
    await page.goto('/');
    await clearLanguageState(page);
    await page.goto('/');

    // Wait for page to settle in Spanish
    await expect(page.locator('html')).toHaveAttribute('lang', 'es', { timeout: 5000 });

    // User manually switches to English via the language switcher
    const languageSwitcher = page.locator('button[aria-label="Select language"]');
    await languageSwitcher.click();
    await page.getByText('English').click();
    await page.waitForTimeout(500);

    // Verify user choice is stored
    const userChoice = await page.evaluate(() => localStorage.getItem('i18next_user_choice'));
    expect(userChoice).toBe('en');

    // Reload — should stay English despite Venezuelan IP mock
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const lang = await page.locator('html').getAttribute('lang');
    expect(lang).toBe('en');
  });

  test('geo endpoint failure gracefully falls back to English', async ({ page }) => {
    await page.route('**/api/geo/language', (route) => {
      route.fulfill({ status: 500, body: 'Internal Server Error' });
    });
    await page.goto('/');
    await clearLanguageState(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const lang = await page.locator('html').getAttribute('lang');
    expect(lang).toBe('en');
  });

  test('geo endpoint timeout falls back gracefully', async ({ page }) => {
    await page.route('**/api/geo/language', () => {
      // Don't fulfill — let it timeout (1.5s in frontend)
    });
    await page.goto('/');
    await clearLanguageState(page);
    await page.goto('/');

    // Should render immediately despite geo timeout (non-blocking fetch)
    await expect(page.locator('h1')).toBeVisible({ timeout: 5000 });

    const lang = await page.locator('html').getAttribute('lang');
    expect(lang).toBe('en');
  });
});
