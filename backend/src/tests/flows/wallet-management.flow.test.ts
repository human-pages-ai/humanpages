/**
 * Integration Test: Wallet Management Flow
 *
 * Simulates a human managing their crypto wallets:
 *   1. Sign up and get authenticated
 *   2. Add wallet on Ethereum (with signature verification)
 *   3. Add wallet on Polygon (same address, different chain)
 *   4. Add wallet on Base (different address)
 *   5. Try duplicate wallet (same address + network) → rejected
 *   6. List all wallets
 *   7. Delete a wallet
 *   8. Try to delete another user's wallet → rejected
 *   9. Verify wallet is used for job payments
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { privateKeyToAccount } from 'viem/accounts';
import app from '../../app.js';
import { prisma } from '../../lib/prisma.js';
import { cleanDatabase, createTestUser, authRequest, TestUser } from '../helpers.js';
import { buildChallengeMessage } from '../../routes/wallets.js';

// Mock email module
vi.mock('../../lib/email.js', () => ({
  sendPasswordResetEmail: vi.fn(() => Promise.resolve()),
  sendVerificationEmail: vi.fn(() => Promise.resolve()),
  sendJobOfferEmail: vi.fn(() => Promise.resolve()),
  sendJobOfferUpdatedEmail: vi.fn(() => Promise.resolve()),
  sendJobMessageEmail: vi.fn(() => Promise.resolve()),
}));

// Deterministic test accounts
const WALLET_ETH = privateKeyToAccount('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80');
const WALLET_BASE = privateKeyToAccount('0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d');
const WALLET_POLY = privateKeyToAccount('0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a');

/** Helper: Request nonce, sign, submit wallet */
async function addWalletSigned(
  token: string,
  account: ReturnType<typeof privateKeyToAccount>,
  network: string,
  label?: string,
) {
  const nonceRes = await authRequest(token)
    .post('/api/wallets/nonce')
    .send({ address: account.address });
  expect(nonceRes.status).toBe(200);

  const { nonce, message } = nonceRes.body;
  const signature = await account.signMessage({ message });

  return authRequest(token)
    .post('/api/wallets')
    .send({ network, address: account.address, label, signature, nonce });
}

let user: TestUser;

beforeEach(async () => {
  await cleanDatabase();
  user = await createTestUser({ email: 'wallet-flow@example.com', name: 'Wallet User' });
});

describe('Flow: Wallet Management — Multi-chain Wallet Lifecycle', () => {

  it('should complete full wallet management: add multi-chain → list → delete → verify isolation', async () => {
    // ─── Step 1: Start with no wallets ─────────────────────────────────
    const emptyRes = await authRequest(user.token).get('/api/wallets');
    expect(emptyRes.status).toBe(200);
    expect(emptyRes.body).toEqual([]);

    // ─── Step 2: Add wallet (auto-registers across all EVM mainnets) ───
    const ethRes = await addWalletSigned(user.token, WALLET_ETH, 'ethereum', 'My ETH Wallet');
    expect(ethRes.status).toBe(201);
    expect(Array.isArray(ethRes.body)).toBe(true);
    expect(ethRes.body).toHaveLength(4);
    const ethWallet = ethRes.body.find((w: any) => w.network === 'ethereum');
    expect(ethWallet).toBeDefined();
    expect(ethWallet.address).toBe(WALLET_ETH.address.toLowerCase());
    expect(ethWallet.label).toBe('My ETH Wallet');
    const ethWalletId = ethWallet.id;

    // ─── Step 3: Add different address (auto-registers across all networks) ──
    const baseRes = await addWalletSigned(user.token, WALLET_BASE, 'base', 'My Base Wallet');
    expect(baseRes.status).toBe(201);
    expect(Array.isArray(baseRes.body)).toBe(true);
    expect(baseRes.body).toHaveLength(4);
    const baseWallet = baseRes.body.find((w: any) => w.network === 'base');
    expect(baseWallet).toBeDefined();
    expect(baseWallet.address).toBe(WALLET_BASE.address.toLowerCase());

    // ─── Step 4: Verify all wallets listed (4 + 4 = 8) ─────────────────
    const listRes = await authRequest(user.token).get('/api/wallets');
    expect(listRes.status).toBe(200);
    expect(listRes.body).toHaveLength(8);

    const ethNetworks = listRes.body
      .filter((w: any) => w.address === WALLET_ETH.address.toLowerCase())
      .map((w: any) => w.network);
    expect(ethNetworks).toContain('ethereum');
    expect(ethNetworks).toContain('polygon');
    expect(ethNetworks).toContain('base');
    expect(ethNetworks).toContain('arbitrum');

    // ─── Step 5: Try duplicate (already on all networks) — returns existing wallets with verified upgrade
    const dupeRes = await addWalletSigned(user.token, WALLET_ETH, 'ethereum');
    expect(dupeRes.status).toBe(200);
    expect(Array.isArray(dupeRes.body)).toBe(true);
    expect(dupeRes.body[0].verified).toBe(true);

    // ─── Step 6: Delete Ethereum wallet ────────────────────────────────
    const deleteRes = await authRequest(user.token).delete(`/api/wallets/${ethWalletId}`);
    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.message).toBe('Wallet deleted');

    // Verify 7 remain (8 - 1 deleted)
    const afterDeleteRes = await authRequest(user.token).get('/api/wallets');
    expect(afterDeleteRes.body).toHaveLength(7);

    // ─── Step 7: Try deleting non-existent wallet ──────────────────────
    const notFoundRes = await authRequest(user.token).delete('/api/wallets/non-existent-id');
    expect(notFoundRes.status).toBe(404);
  });

  it('should prevent cross-user wallet deletion', async () => {
    const otherUser = await createTestUser({ email: 'other-wallet@example.com', name: 'Other' });

    // Add wallet to user 1
    const walletRes = await addWalletSigned(user.token, WALLET_POLY, 'ethereum');
    expect(walletRes.status).toBe(201);

    // User 2 tries to delete user 1's wallet
    const crossDeleteRes = await authRequest(otherUser.token)
      .delete(`/api/wallets/${walletRes.body[0].id}`);
    expect(crossDeleteRes.status).toBe(404);
    expect(crossDeleteRes.body.error).toBe('Wallet not found');
  });

  it('should reject invalid wallet signature', async () => {
    // Get nonce for one address but sign with a different private key
    const nonceRes = await authRequest(user.token)
      .post('/api/wallets/nonce')
      .send({ address: WALLET_ETH.address });

    const { nonce, message } = nonceRes.body;
    // Sign with wrong key
    const signature = await WALLET_BASE.signMessage({ message });

    const res = await authRequest(user.token)
      .post('/api/wallets')
      .send({ network: 'ethereum', address: WALLET_ETH.address, signature, nonce });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Invalid signature');
  });

  it('should reject reused nonce', async () => {
    const nonceRes = await authRequest(user.token)
      .post('/api/wallets/nonce')
      .send({ address: WALLET_ETH.address });

    const { nonce, message } = nonceRes.body;
    const signature = await WALLET_ETH.signMessage({ message });

    // First use — success
    const first = await authRequest(user.token)
      .post('/api/wallets')
      .send({ network: 'ethereum', address: WALLET_ETH.address, signature, nonce });
    expect(first.status).toBe(201);

    // Second use — fail (nonce already consumed)
    const second = await authRequest(user.token)
      .post('/api/wallets')
      .send({ network: 'polygon', address: WALLET_ETH.address, signature, nonce });
    expect(second.status).toBe(400);
    expect(second.body.error).toContain('Invalid or expired nonce');
  });

  it('should reject wallet operations without auth', async () => {
    const listRes = await request(app).get('/api/wallets');
    expect(listRes.status).toBe(401);

    const addRes = await request(app).post('/api/wallets').send({ network: 'ethereum', address: '0x123' });
    expect(addRes.status).toBe(401);

    const deleteRes = await request(app).delete('/api/wallets/some-id');
    expect(deleteRes.status).toBe(401);
  });

  it('should reject invalid wallet address for nonce request', async () => {
    const res = await authRequest(user.token)
      .post('/api/wallets/nonce')
      .send({ address: 'not-an-address' });
    expect(res.status).toBe(400);
  });
});
