import { test, expect } from '@playwright/test';
import { signupViaAPI, goToDashboard } from './helpers';

test.describe('Wallet connection (ConnectKit)', () => {
  let token: string;

  test.beforeAll(async () => {
    token = await signupViaAPI({
      name: 'Wallet Mobile Test',
      email: `e2e-wallet-mobile-${Date.now()}@test.com`,
      password: 'TestPass123!',
    });
  });

  test('shows Connect Wallet button on mobile without window.ethereum', async ({ browser }) => {
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    });
    const page = await context.newPage();

    await page.addInitScript(() => {
      delete (window as any).ethereum;
    });

    await goToDashboard(page, token);
    await page.getByRole('tab', { name: /receive money/i }).click();

    // ConnectKit-powered button should be visible (no deep links)
    await expect(page.getByRole('button', { name: /connect wallet/i })).toBeVisible({ timeout: 15_000 });

    // Old deep links should NOT exist
    await expect(page.getByRole('link', { name: 'Open in MetaMask' })).not.toBeVisible();
    await expect(page.getByRole('link', { name: 'Open in Coinbase Wallet' })).not.toBeVisible();

    await context.close();
  });

  test('shows Connect Wallet button on desktop without window.ethereum', async ({ browser }) => {
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });
    const page = await context.newPage();

    await page.addInitScript(() => {
      delete (window as any).ethereum;
    });

    await goToDashboard(page, token);
    await page.getByRole('tab', { name: /receive money/i }).click();

    // ConnectKit button should be visible
    await expect(page.getByRole('button', { name: /connect wallet/i })).toBeVisible({ timeout: 15_000 });

    // Old install extension text should NOT appear
    await expect(page.getByText('No wallet extension detected')).not.toBeVisible();

    await context.close();
  });

  test('shows Connect Wallet button in Facebook in-app browser', async ({ browser }) => {
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/438.0.0.0]',
    });
    const page = await context.newPage();

    await page.addInitScript(() => {
      delete (window as any).ethereum;
    });

    await goToDashboard(page, token);
    await page.getByRole('tab', { name: /receive money/i }).click();

    // ConnectKit button should work in in-app browsers too
    await expect(page.getByRole('button', { name: /connect wallet/i })).toBeVisible({ timeout: 15_000 });

    await context.close();
  });
});
