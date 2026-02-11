import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { privateKeyToAccount } from 'viem/accounts';
import app from '../app.js';
import { createTestUser, authRequest, cleanDatabase, TestUser } from './helpers.js';
import { buildChallengeMessage } from '../routes/wallets.js';

// Deterministic test accounts from private keys
const ACCOUNT_1 = privateKeyToAccount('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80');
const ACCOUNT_2 = privateKeyToAccount('0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d');
const ACCOUNT_DEL = privateKeyToAccount('0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a');
const ACCOUNT_OTHER = privateKeyToAccount('0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6');
const ACCOUNT_DUP = privateKeyToAccount('0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a');
const ACCOUNT_MULTI = privateKeyToAccount('0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba');

/** Helper: get nonce, sign, submit */
async function addWalletWithSignature(
  token: string,
  account: ReturnType<typeof privateKeyToAccount>,
  network: string,
  label?: string,
) {
  // 1. Request nonce
  const nonceRes = await authRequest(token)
    .post('/api/wallets/nonce')
    .send({ address: account.address });
  expect(nonceRes.status).toBe(200);
  const { nonce, message } = nonceRes.body;

  // 2. Sign the challenge
  const signature = await account.signMessage({ message });

  // 3. Submit
  return authRequest(token)
    .post('/api/wallets')
    .send({
      network,
      address: account.address,
      label,
      signature,
      nonce,
    });
}

describe('Wallets API', () => {
  let user: TestUser;

  beforeEach(async () => {
    await cleanDatabase();
    user = await createTestUser({ email: 'wallet@example.com' });
  });

  describe('GET /api/wallets', () => {
    it('should return empty array when no wallets', async () => {
      const response = await authRequest(user.token).get('/api/wallets');

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });

    it('should return user wallets', async () => {
      await addWalletWithSignature(user.token, ACCOUNT_1, 'ethereum', 'Main');

      const response = await authRequest(user.token).get('/api/wallets');

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(4);
      const networks = response.body.map((w: any) => w.network);
      expect(networks).toContain('ethereum');
      expect(networks).toContain('polygon');
      expect(networks).toContain('base');
      expect(networks).toContain('arbitrum');
      expect(response.body[0].address).toBe(ACCOUNT_1.address);
    });

    it('should reject unauthenticated request', async () => {
      const response = await request(app).get('/api/wallets');

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/wallets/nonce', () => {
    it('should return a nonce and challenge message', async () => {
      const response = await authRequest(user.token)
        .post('/api/wallets/nonce')
        .send({ address: ACCOUNT_1.address });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('nonce');
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain(ACCOUNT_1.address.toLowerCase());
      expect(response.body.message).toContain(response.body.nonce);
    });

    it('should reject invalid address', async () => {
      const response = await authRequest(user.token)
        .post('/api/wallets/nonce')
        .send({ address: 'not-an-address' });

      expect(response.status).toBe(400);
    });

    it('should reject unauthenticated request', async () => {
      const response = await request(app)
        .post('/api/wallets/nonce')
        .send({ address: ACCOUNT_1.address });

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/wallets', () => {
    it('should create a new wallet with valid signature', async () => {
      const response = await addWalletWithSignature(user.token, ACCOUNT_2, 'ethereum', 'My ETH Wallet');

      expect(response.status).toBe(201);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(4);
      const ethWallet = response.body.find((w: any) => w.network === 'ethereum');
      expect(ethWallet).toBeDefined();
      expect(ethWallet).toHaveProperty('id');
      expect(ethWallet.address).toBe(ACCOUNT_2.address);
      expect(ethWallet.label).toBe('My ETH Wallet');
    });

    it('should create wallet without label', async () => {
      const response = await addWalletWithSignature(user.token, ACCOUNT_1, 'base');

      expect(response.status).toBe(201);
      expect(Array.isArray(response.body)).toBe(true);
      const baseWallet = response.body.find((w: any) => w.network === 'base');
      expect(baseWallet).toBeDefined();
      expect(baseWallet.label).toBeNull();
    });

    it('should reject duplicate wallet address when already registered on all networks', async () => {
      await addWalletWithSignature(user.token, ACCOUNT_DUP, 'ethereum');

      const response = await addWalletWithSignature(user.token, ACCOUNT_DUP, 'ethereum');

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('already registered on all supported networks');
    });

    it('should auto-register wallet across all EVM mainnet networks', async () => {
      const response = await addWalletWithSignature(user.token, ACCOUNT_MULTI, 'ethereum');

      expect(response.status).toBe(201);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(4);
      const networks = response.body.map((w: any) => w.network);
      expect(networks).toContain('ethereum');
      expect(networks).toContain('polygon');
      expect(networks).toContain('base');
      expect(networks).toContain('arbitrum');
    });

    it('should reject invalid signature', async () => {
      // Get nonce for ACCOUNT_1 but sign with ACCOUNT_2
      const nonceRes = await authRequest(user.token)
        .post('/api/wallets/nonce')
        .send({ address: ACCOUNT_1.address });
      const { nonce, message } = nonceRes.body;

      // Sign with the wrong account
      const signature = await ACCOUNT_2.signMessage({ message });

      const response = await authRequest(user.token)
        .post('/api/wallets')
        .send({
          network: 'ethereum',
          address: ACCOUNT_1.address,
          signature,
          nonce,
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid signature');
    });

    it('should reject expired/invalid nonce', async () => {
      const signature = await ACCOUNT_1.signMessage({
        message: buildChallengeMessage(ACCOUNT_1.address, 'fake-nonce'),
      });

      const response = await authRequest(user.token)
        .post('/api/wallets')
        .send({
          network: 'ethereum',
          address: ACCOUNT_1.address,
          signature,
          nonce: 'fake-nonce',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid or expired nonce');
    });

    it('should reject reused nonce', async () => {
      // Get a nonce and use it
      const nonceRes = await authRequest(user.token)
        .post('/api/wallets/nonce')
        .send({ address: ACCOUNT_1.address });
      const { nonce, message } = nonceRes.body;
      const signature = await ACCOUNT_1.signMessage({ message });

      // First use — should succeed
      const first = await authRequest(user.token)
        .post('/api/wallets')
        .send({
          network: 'ethereum',
          address: ACCOUNT_1.address,
          signature,
          nonce,
        });
      expect(first.status).toBe(201);

      // Second use of same nonce — should fail
      const second = await authRequest(user.token)
        .post('/api/wallets')
        .send({
          network: 'polygon',
          address: ACCOUNT_1.address,
          signature,
          nonce,
        });
      expect(second.status).toBe(400);
      expect(second.body.error).toContain('Invalid or expired nonce');
    });

    it('should reject request without signature', async () => {
      const response = await authRequest(user.token)
        .post('/api/wallets')
        .send({ network: 'ethereum', address: ACCOUNT_1.address });

      expect(response.status).toBe(400);
    });

    it('should reject empty address', async () => {
      const response = await authRequest(user.token)
        .post('/api/wallets')
        .send({ network: 'ethereum', address: '', signature: '0x1234', nonce: 'abc' });

      expect(response.status).toBe(400);
    });

    it('should reject unauthenticated request', async () => {
      const response = await request(app)
        .post('/api/wallets')
        .send({ network: 'ethereum', address: ACCOUNT_1.address });

      expect(response.status).toBe(401);
    });
  });

  describe('DELETE /api/wallets/:id', () => {
    it('should delete own wallet', async () => {
      const createResponse = await addWalletWithSignature(user.token, ACCOUNT_DEL, 'ethereum');

      const walletId = createResponse.body[0].id;

      const response = await authRequest(user.token).delete(`/api/wallets/${walletId}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Wallet deleted');

      // Verify deletion (3 remaining from the 4 auto-created)
      const listResponse = await authRequest(user.token).get('/api/wallets');
      expect(listResponse.body).toHaveLength(3);
    });

    it('should not delete another user wallet', async () => {
      // Create another user with a wallet
      const otherUser = await createTestUser({ email: 'other@example.com' });
      const createResponse = await addWalletWithSignature(otherUser.token, ACCOUNT_OTHER, 'ethereum');

      const walletId = createResponse.body[0].id;

      // Try to delete with first user's token
      const response = await authRequest(user.token).delete(`/api/wallets/${walletId}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Wallet not found');
    });

    it('should return 404 for non-existent wallet', async () => {
      const response = await authRequest(user.token).delete('/api/wallets/nonexistent-id');

      expect(response.status).toBe(404);
    });

    it('should reject unauthenticated request', async () => {
      const response = await request(app).delete('/api/wallets/some-id');

      expect(response.status).toBe(401);
    });
  });
});
