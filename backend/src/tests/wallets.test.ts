import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { createTestUser, authRequest, cleanDatabase, TestUser } from './helpers.js';

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
      // Create a wallet first
      await authRequest(user.token)
        .post('/api/wallets')
        .send({ network: 'ethereum', address: '0x123', label: 'Main' });

      const response = await authRequest(user.token).get('/api/wallets');

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].network).toBe('ethereum');
      expect(response.body[0].address).toBe('0x123');
    });

    it('should reject unauthenticated request', async () => {
      const response = await request(app).get('/api/wallets');

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/wallets', () => {
    it('should create a new wallet', async () => {
      const response = await authRequest(user.token)
        .post('/api/wallets')
        .send({
          network: 'ethereum',
          address: '0xabcdef1234567890',
          label: 'My ETH Wallet',
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body.network).toBe('ethereum');
      expect(response.body.address).toBe('0xabcdef1234567890');
      expect(response.body.label).toBe('My ETH Wallet');
    });

    it('should create wallet without label', async () => {
      const response = await authRequest(user.token)
        .post('/api/wallets')
        .send({
          network: 'solana',
          address: 'SolanaAddress123',
        });

      expect(response.status).toBe(201);
      expect(response.body.network).toBe('solana');
      expect(response.body.label).toBeNull();
    });

    it('should reject duplicate wallet address for same network', async () => {
      await authRequest(user.token)
        .post('/api/wallets')
        .send({ network: 'ethereum', address: '0xduplicate' });

      const response = await authRequest(user.token)
        .post('/api/wallets')
        .send({ network: 'ethereum', address: '0xduplicate' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('already added');
    });

    it('should allow same address on different networks', async () => {
      await authRequest(user.token)
        .post('/api/wallets')
        .send({ network: 'ethereum', address: '0xmultichain' });

      const response = await authRequest(user.token)
        .post('/api/wallets')
        .send({ network: 'polygon', address: '0xmultichain' });

      expect(response.status).toBe(201);
    });

    it('should reject empty network', async () => {
      const response = await authRequest(user.token)
        .post('/api/wallets')
        .send({ network: '', address: '0x123' });

      expect(response.status).toBe(400);
    });

    it('should reject empty address', async () => {
      const response = await authRequest(user.token)
        .post('/api/wallets')
        .send({ network: 'ethereum', address: '' });

      expect(response.status).toBe(400);
    });

    it('should reject unauthenticated request', async () => {
      const response = await request(app)
        .post('/api/wallets')
        .send({ network: 'ethereum', address: '0x123' });

      expect(response.status).toBe(401);
    });
  });

  describe('DELETE /api/wallets/:id', () => {
    it('should delete own wallet', async () => {
      const createResponse = await authRequest(user.token)
        .post('/api/wallets')
        .send({ network: 'ethereum', address: '0xtodelete' });

      const walletId = createResponse.body.id;

      const response = await authRequest(user.token).delete(`/api/wallets/${walletId}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Wallet deleted');

      // Verify deletion
      const listResponse = await authRequest(user.token).get('/api/wallets');
      expect(listResponse.body).toHaveLength(0);
    });

    it('should not delete another user wallet', async () => {
      // Create another user with a wallet
      const otherUser = await createTestUser({ email: 'other@example.com' });
      const createResponse = await authRequest(otherUser.token)
        .post('/api/wallets')
        .send({ network: 'ethereum', address: '0xother' });

      const walletId = createResponse.body.id;

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
