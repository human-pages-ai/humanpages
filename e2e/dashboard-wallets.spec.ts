import { test, expect } from '@playwright/test';
import { privateKeyToAccount } from 'viem/accounts';
import { signupAndGoToDashboard } from './helpers';

// Deterministic test private key (Hardhat account #0)
const TEST_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const testAccount = privateKeyToAccount(TEST_PRIVATE_KEY);

/**
 * Inject a mock window.ethereum provider that auto-approves connections
 * and signs messages with the given private key.
 */
async function mockEthereum(page: import('@playwright/test').Page) {
  await page.addInitScript(`
    window.__mockEthPendingSign = [];

    window.ethereum = {
      isMetaMask: true,
      request: async ({ method, params }) => {
        if (method === 'eth_requestAccounts') {
          return ['${testAccount.address}'];
        }
        if (method === 'personal_sign') {
          return new Promise((resolve, reject) => {
            window.__mockEthPendingSign.push({ params, resolve, reject });
          });
        }
        throw new Error('Unsupported method: ' + method);
      },
      on: () => {},
      removeListener: () => {},
    };
  `);
}

/** Helper: open the add-wallet form, pick network/label, connect + sign, and wait for wallet to appear */
async function connectAndAddWallet(
  page: import('@playwright/test').Page,
  opts: { network: string; label: string },
) {
  // Click "Add Wallet" to open the form
  await page.getByRole('button', { name: /Add Wallet/i }).click();

  // Select network and fill label
  await page.locator('#wallet-network').selectOption(opts.network);
  await page.locator('#wallet-label').fill(opts.label);

  // Intercept the nonce API call to capture the message for signing
  let capturedMessage = '';
  await page.route('**/api/wallets/nonce', async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    capturedMessage = body.message;
    await route.fulfill({ response });
  });

  // Click "Connect Wallet & Verify" (combined connect + sign flow)
  await page.getByRole('button', { name: /Connect Wallet & Verify/i }).click();

  // Wait for the nonce request to complete
  await page.waitForResponse('**/api/wallets/nonce');

  // Sign the message in Node and resolve the pending ethereum request
  const signature = await testAccount.signMessage({ message: capturedMessage });
  await page.evaluate((sig) => {
    const pending = (window as any).__mockEthPendingSign;
    if (pending.length > 0) {
      pending.shift().resolve(sig);
    }
  }, signature);

  // Wait for wallet to appear (involves API call + profile reload)
  await expect(page.locator(`text=${opts.label}`)).toBeVisible({ timeout: 30_000 });
}

test.describe('Dashboard – Wallets', () => {
  test('add wallet via connect + sign flow', async ({ page }) => {
    await mockEthereum(page);
    await signupAndGoToDashboard(page);
    await page.getByRole('tab', { name: /payment/i }).click();

    await connectAndAddWallet(page, { network: 'ethereum', label: 'Main Wallet' });

    // Verify wallet details appear in the list
    await expect(page.locator('text=Main Wallet')).toBeVisible();
    await expect(page.getByLabel(/wallet address/i).first()).toBeVisible();
  });

  test('delete wallet', async ({ page }) => {
    await mockEthereum(page);
    await signupAndGoToDashboard(page);
    await page.getByRole('tab', { name: /payment/i }).click();

    await connectAndAddWallet(page, { network: 'polygon', label: 'Delete Me' });

    // Delete it
    await page.getByRole('button', { name: 'Delete' }).click();

    // Confirm deletion in dialog
    await page.locator('[role="alertdialog"]').getByRole('button', { name: 'Confirm' }).click();

    // Verify wallet is gone
    await expect(page.locator('text=Delete Me')).not.toBeVisible({ timeout: 30_000 });
  });

  test('shows install wallet message when no extension', async ({ page }) => {
    // Don't mock window.ethereum — it won't exist
    await signupAndGoToDashboard(page);
    await page.getByRole('tab', { name: /payment/i }).click();

    // Should show MetaMask and Coinbase Wallet links in the empty wallet state
    await expect(page.locator('a[href*="metamask.io"]').first()).toBeVisible();
    await expect(page.locator('a[href*="coinbase.com/wallet"]').first()).toBeVisible();
  });
});
