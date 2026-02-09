import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authenticateToken, requireEmailVerified, AuthRequest } from '../middleware/auth.js';
import { SUPPORTED_NETWORKS } from '../lib/blockchain/chains.js';
import { logger } from '../lib/logger.js';

const router = Router();

const addWalletSchema = z.object({
  network: z.enum(SUPPORTED_NETWORKS as [string, ...string[]]),
  address: z.string().regex(/^0x[0-9a-fA-F]{40}$/, 'Invalid EVM address format'),
  label: z.string().max(50).optional(),
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

// Add a new wallet
router.post('/', authenticateToken, requireEmailVerified, async (req: AuthRequest, res) => {
  try {
    const { network, address, label } = addWalletSchema.parse(req.body);

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

export default router;
