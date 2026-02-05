import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';

const router = Router();

const addWalletSchema = z.object({
  network: z.string().min(1),
  address: z.string().min(1),
  label: z.string().optional(),
});

// Get all wallets for current user
router.get('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const wallets = await prisma.wallet.findMany({
      where: { humanId: req.userId },
    });
    res.json(wallets);
  } catch (error) {
    console.error('Get wallets error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add a new wallet
router.post('/', authenticateToken, async (req: AuthRequest, res) => {
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
      return res.status(400).json({ error: error.errors });
    }
    if ((error as any).code === 'P2002') {
      return res.status(400).json({ error: 'This wallet address is already added for this network' });
    }
    console.error('Add wallet error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete a wallet
router.delete('/:id', authenticateToken, async (req: AuthRequest, res) => {
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
    console.error('Delete wallet error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
