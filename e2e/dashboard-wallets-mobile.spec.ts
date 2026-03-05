import { test, expect } from '@playwright/test';
import { signupViaAPI, goToDashboard } from './helpers';

test.describe('Wallet connection options', () => {
  let token: string;

  test.beforeAll(async () => {
    token = await signupViaAPI({
      name: 'Wallet Mobile Test',
      email: `e2e-wallet-mobile-${Date.now()}@test.com`,
      password: 'TestPass123!',
    });
  });

  test('shows wallet connect button on mobile', async ({ browser }) => {
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    });
    const page = await context.newPage();

    await page.addInitScript(() => {
      delete (window as any).ethereum;
    });

    await goToDashboard(page, token);
    await page.getByRole('tab', { name: /receive money/i }).click();

    // Should show single "Connect or Create Wallet" button (Privy handles all methods)
    await expect(page.getByText('Connect or Create Wallet')).toBeVisible({ timeout: 15_000 });

    // Should show manual address paste input
    await expect(page.getByPlaceholder('0x...')).toBeVisible();

    // Old per-connector buttons should NOT exist
    await expect(page.getByText('Coinbase Smart Wallet')).not.toBeVisible();
    await expect(page.getByText('MetaMask')).not.toBeVisible();
    await expect(page.getByText('Browser Extension')).not.toBeVisible();

    await context.close();
  });

  test('shows wallet connect button on desktop', async ({ browser }) => {
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });
    const page = await context.newPage();

    await page.addInitScript(() => {
      delete (window as any).ethereum;
    });

    await goToDashboard(page, token);
    await page.getByRole('tab', { name: /receive money/i }).click();

    // Should show single connect button
    await expect(page.getByText('Connect or Create Wallet')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByPlaceholder('0x...')).toBeVisible();

    await context.close();
  });

  test('shows wallet connect button in Facebook in-app browser', async ({ browser }) => {
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/438.0.0.0]',
    });
    const page = await context.newPage();

    await page.addInitScript(() => {
      delete (window as any).ethereum;
    });

    await goToDashboard(page, token);
    await page.getByRole('tab', { name: /receive money/i }).click();

    // Should work in in-app browsers too
    await expect(page.getByText('Connect or Create Wallet')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByPlaceholder('0x...')).toBeVisible();

    await context.close();
  });
});
