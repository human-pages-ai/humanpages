import { Router } from 'express';
import { z } from 'zod';
import { verifyMessage } from 'viem';
import { prisma } from '../lib/prisma.js';
import { authenticateToken, requireEmailVerified, AuthRequest } from '../middleware/auth.js';
import { SUPPORTED_NETWORKS } from '../lib/blockchain/chains.js';
import { nonceStore } from '../lib/nonce-store.js';
import { logger } from '../lib/logger.js';

const router = Router();

const EVM_ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

function buildChallengeMessage(address: string, nonce: string): string {
  return `Sign this message to verify you own this wallet on Human Pages.\n\nAddress: ${address.toLowerCase()}\nNonce: ${nonce}`;
}

const nonceRequestSchema = z.object({
  address: z.string().regex(EVM_ADDRESS_RE, 'Invalid EVM address format'),
});

const addWalletSchema = z.object({
  network: z.enum(SUPPORTED_NETWORKS as [string, ...string[]]),
  address: z.string().regex(EVM_ADDRESS_RE, 'Invalid EVM address format'),
  label: z.string().max(50).optional(),
  signature: z.string().min(1, 'Signature is required'),
  nonce: z.string().min(1, 'Nonce is required'),
});

// Get all wallets for current user
router.get('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const wallets = await prisma.wallet.findMany({
      where: { humanId: req.userId },
    });
    res.json(wallets);
  } catch (error) {
    logger.error({ err: error }, 'Get wallets error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Request a nonce for wallet verification
router.post('/nonce', authenticateToken, requireEmailVerified, async (req: AuthRequest, res) => {
  try {
    const { address } = nonceRequestSchema.parse(req.body);
    const nonce = nonceStore.generate(req.userId!, address);
    const message = buildChallengeMessage(address, nonce);
    res.json({ nonce, message });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors.map(e => e.message).join(', ') });
    }
    logger.error({ err: error }, 'Nonce generation error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add a new wallet (with signature verification)
router.post('/', authenticateToken, requireEmailVerified, async (req: AuthRequest, res) => {
  try {
    const { network, address, label, signature, nonce } = addWalletSchema.parse(req.body);

    // Verify nonce is valid and not expired/reused
    if (!nonceStore.verify(req.userId!, address, nonce)) {
      return res.status(400).json({ error: 'Invalid or expired nonce. Please request a new one.' });
    }

    // Reconstruct the challenge message and verify signature
    const message = buildChallengeMessage(address, nonce);
    const valid = await verifyMessage({
      address: address as `0x${string}`,
      message,
      signature: signature as `0x${string}`,
    });

    if (!valid) {
      return res.status(400).json({ error: 'Invalid signature. Wallet ownership could not be verified.' });
    }

    const wallet = await prisma.wallet.create({
      data: {
        humanId: req.userId!,
        network,
        address,
        label,
      },
    });

    res.status(201).json(wallet);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors.map(e => e.message).join(', ') });
    }
    if ((error as any).code === 'P2002') {
      return res.status(400).json({ error: 'This wallet address is already added for this network' });
    }
    logger.error({ err: error }, 'Add wallet error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete a wallet
router.delete('/:id', authenticateToken, requireEmailVerified, async (req: AuthRequest, res) => {
  try {
    const wallet = await prisma.wallet.findFirst({
      where: { id: req.params.id, humanId: req.userId },
    });

    if (!wallet) {
      return res.status(404).json({ error: 'Wallet not found' });
    }

    await prisma.wallet.delete({ where: { id: req.params.id } });
    res.json({ message: 'Wallet deleted' });
  } catch (error) {
    logger.error({ err: error }, 'Delete wallet error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Exported for tests
export { buildChallengeMessage };
export default router;
