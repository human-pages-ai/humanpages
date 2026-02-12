import { test, expect } from '@playwright/test';
import { signupViaAPI, goToDashboard } from './helpers';

test.describe('Wallet mobile deep links', () => {
  let token: string;

  test.beforeAll(async () => {
    token = await signupViaAPI({
      name: 'Wallet Mobile Test',
      email: `e2e-wallet-mobile-${Date.now()}@test.com`,
      password: 'TestPass123!',
    });
  });

  test('shows MetaMask and Coinbase deep links on mobile (no window.ethereum)', async ({ browser }) => {
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    });
    const page = await context.newPage();

    // Ensure window.ethereum is absent
    await page.addInitScript(() => {
      delete (window as any).ethereum;
    });

    await goToDashboard(page, token);

    // Navigate to payments tab
    await page.getByRole('tab', { name: /payment/i }).click();

    // Deep link buttons should be visible
    const metamaskLink = page.getByRole('link', { name: 'Open in MetaMask' });
    const coinbaseLink = page.getByRole('link', { name: 'Open in Coinbase Wallet' });

    await expect(metamaskLink).toBeVisible({ timeout: 10_000 });
    await expect(coinbaseLink).toBeVisible();

    // Verify hrefs contain the correct deep link prefixes
    const metamaskHref = await metamaskLink.getAttribute('href');
    const coinbaseHref = await coinbaseLink.getAttribute('href');

    expect(metamaskHref).toContain('https://metamask.app.link/dapp/');
    expect(coinbaseHref).toContain('https://go.cb-w.com/dapp?cb_url=');

    // Verify Coinbase link includes the current page URL encoded
    expect(coinbaseHref).toContain(encodeURIComponent('localhost'));

    // "No wallet extension" install text should NOT appear
    await expect(page.getByText('No wallet extension detected')).not.toBeVisible();

    await context.close();
  });

  test('shows install extension links on desktop without window.ethereum', async ({ browser }) => {
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });
    const page = await context.newPage();

    await page.addInitScript(() => {
      delete (window as any).ethereum;
    });

    await goToDashboard(page, token);
    await page.getByRole('tab', { name: /payment/i }).click();

    // Should show "No wallet extension detected" with install links
    await expect(page.getByText('No wallet extension detected')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('link', { name: 'MetaMask' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Coinbase Wallet' })).toBeVisible();

    // Deep link buttons should NOT appear
    await expect(page.getByRole('link', { name: 'Open in MetaMask' })).not.toBeVisible();

    await context.close();
  });

  test('shows deep links in Facebook in-app browser', async ({ browser }) => {
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/438.0.0.0]',
    });
    const page = await context.newPage();

    await page.addInitScript(() => {
      delete (window as any).ethereum;
    });

    await goToDashboard(page, token);
    await page.getByRole('tab', { name: /payment/i }).click();

    await expect(page.getByRole('link', { name: 'Open in MetaMask' })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('link', { name: 'Open in Coinbase Wallet' })).toBeVisible();

    await context.close();
  });
});
