import { Router } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { verifyMessage } from 'viem';
import { prisma } from '../lib/prisma.js';
import { authenticateToken, requireEmailVerified, AuthRequest } from '../middleware/auth.js';
import { SUPPORTED_NETWORKS, EVM_MAINNET_NETWORKS } from '../lib/blockchain/chains.js';
import { nonceStore } from '../lib/nonce-store.js';
import { logger } from '../lib/logger.js';
import { verifyIdentityToken, getEmbeddedWalletAddresses, getPrivyUserByDid } from '../lib/privy.js';

const router = Router();

// Rate limit wallet creation: 20 per hour per user
const walletCreateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: { error: 'Too many wallet operations. Limit: 20 per hour.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: AuthRequest) => req.userId || 'unknown',
  validate: false,
  skip: () => process.env.NODE_ENV === 'test',
});

const EVM_ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

function buildChallengeMessage(address: string, nonce: string): string {
  return `Sign this message to verify you own this wallet on Human Pages.\n\nAddress: ${address.toLowerCase()}\nNonce: ${nonce}`;
}

const nonceRequestSchema = z.object({
  address: z.string().regex(EVM_ADDRESS_RE, 'Invalid EVM address format'),
});

const addWalletSchema = z.object({
  network: z.enum(SUPPORTED_NETWORKS as [string, ...string[]]).optional(),
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
router.post('/nonce', authenticateToken, async (req: AuthRequest, res) => {
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
// Creates wallet records for all supported EVM mainnet networks
router.post('/', authenticateToken, walletCreateLimiter, async (req: AuthRequest, res) => {
  try {
    const { address, label, signature, nonce } = addWalletSchema.parse(req.body);

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

    // Normalize address to lowercase to prevent EIP-55 checksum casing issues
    const normalizedAddress = address.toLowerCase();

    // Find which EVM mainnet networks already have this address registered
    const existing = await prisma.wallet.findMany({
      where: {
        humanId: req.userId!,
        address: normalizedAddress,
        network: { in: EVM_MAINNET_NETWORKS },
      },
    });
    const existingNetworks = new Set(existing.map((w) => w.network));
    const missingNetworks = EVM_MAINNET_NETWORKS.filter((n) => !existingNetworks.has(n));

    if (missingNetworks.length === 0) {
      // If already registered, mark them as verified (signature proves ownership)
      await prisma.wallet.updateMany({
        where: { humanId: req.userId!, address: normalizedAddress },
        data: { verified: true },
      });
      const wallets = await prisma.wallet.findMany({
        where: { humanId: req.userId!, address: normalizedAddress },
      });
      return res.json(wallets);
    }

    // Create wallet records for all missing networks in a transaction
    // Signature-verified wallets are born verified
    const created = await prisma.$transaction(
      missingNetworks.map((network) =>
        prisma.wallet.create({
          data: {
            humanId: req.userId!,
            network,
            address: normalizedAddress,
            label,
            verified: true,
          },
        })
      )
    );

    res.status(201).json(created);
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

// Add a wallet — Privy wallets verified via identity token, manual_paste stays unverified
const addWalletManualSchema = z.object({
  address: z.string().regex(EVM_ADDRESS_RE, 'Invalid EVM address'),
  label: z.string().max(50).optional(),
  source: z.enum(['privy', 'manual_paste']).optional().default('manual_paste'),
});

router.post('/manual', authenticateToken, walletCreateLimiter, async (req: AuthRequest, res) => {
  try {
    const { address, label, source } = addWalletManualSchema.parse(req.body);
    const normalizedAddress = address.toLowerCase();
    let verified = false;

    // For Privy wallets, verify ownership via identity token
    if (source === 'privy') {
      const idToken = req.headers['privy-id-token'] as string | undefined;
      if (!idToken) {
        return res.status(401).json({ error: 'Privy identity token required for embedded wallet registration' });
      }

      try {
        // Verify the identity token and extract wallet addresses
        const privyUser = await verifyIdentityToken(idToken);
        const ownedAddresses = getEmbeddedWalletAddresses(privyUser);

        if (!ownedAddresses.includes(normalizedAddress)) {
          // Fallback: fetch fresh user data via REST in case identity token is stale
          // (e.g. wallet was just created and token hasn't refreshed yet)
          const human = await prisma.human.findUnique({ where: { id: req.userId! }, select: { privyDid: true } });
          if (human?.privyDid) {
            const freshUser = await getPrivyUserByDid(human.privyDid);
            const freshAddresses = getEmbeddedWalletAddresses(freshUser);
            if (!freshAddresses.includes(normalizedAddress)) {
              logger.warn({ userId: req.userId, address: normalizedAddress }, 'Privy wallet ownership verification failed');
              return res.status(403).json({ error: 'This wallet is not linked to your Privy account' });
            }
          } else {
            logger.warn({ userId: req.userId, address: normalizedAddress }, 'Privy wallet claim without privyDid binding');
            return res.status(403).json({ error: 'This wallet is not linked to your Privy account' });
          }
        }

        // Bind privyDid if not already bound
        const privyDid = privyUser.id;
        await prisma.human.update({
          where: { id: req.userId! },
          data: { privyDid },
        }).catch((err: any) => {
          // P2002 = unique constraint violation — another account already has this privyDid
          if (err.code === 'P2002') {
            logger.error({ userId: req.userId, privyDid }, 'Privy DID already bound to another account');
            throw new Error('PRIVY_DID_CONFLICT');
          }
          // Ignore if already set to same value
          if (err.code !== 'P2025') throw err;
        });

        verified = true;
      } catch (err: any) {
        if (err.message === 'PRIVY_DID_CONFLICT') {
          return res.status(409).json({ error: 'This Privy account is already linked to a different Human Pages account' });
        }
        logger.error({ err, userId: req.userId }, 'Privy identity token verification failed');
        return res.status(401).json({ error: 'Invalid or expired Privy identity token' });
      }
    }

    // Upsert: if wallets already exist, update them; otherwise create
    const existing = await prisma.wallet.findMany({
      where: {
        humanId: req.userId!,
        address: normalizedAddress,
        network: { in: EVM_MAINNET_NETWORKS },
      },
    });
    const existingNetworks = new Set(existing.map((w) => w.network));
    const missingNetworks = EVM_MAINNET_NETWORKS.filter((n) => !existingNetworks.has(n));

    if (missingNetworks.length === 0) {
      // Already registered — if now verified, upgrade existing records
      if (verified) {
        await prisma.wallet.updateMany({
          where: { humanId: req.userId!, address: normalizedAddress },
          data: { verified: true, source },
        });
      }
      const wallets = await prisma.wallet.findMany({
        where: { humanId: req.userId!, address: normalizedAddress },
      });
      return res.json(wallets);
    }

    const created = await prisma.$transaction(
      missingNetworks.map((network) =>
        prisma.wallet.create({
          data: {
            humanId: req.userId!,
            network,
            address: normalizedAddress,
            label,
            source,
            verified,
          },
        })
      )
    );

    res.status(201).json(created);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors.map(e => e.message).join(', ') });
    }
    if ((error as any).code === 'P2002') {
      return res.status(400).json({ error: 'This wallet address is already added for this network' });
    }
    logger.error({ err: error }, 'Add wallet manual error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update wallet label (updates all wallets with the same address for this user)
const updateLabelSchema = z.object({
  label: z.string().max(50).optional(),
});

router.patch('/:address/label', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const address = req.params.address;
    if (!EVM_ADDRESS_RE.test(address)) {
      return res.status(400).json({ error: 'Invalid EVM address format' });
    }

    const { label } = updateLabelSchema.parse(req.body);

    const result = await prisma.wallet.updateMany({
      where: { humanId: req.userId!, address },
      data: { label: label || null },
    });

    if (result.count === 0) {
      return res.status(404).json({ error: 'No wallets found with this address' });
    }

    res.json({ message: 'Label updated', count: result.count });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors.map(e => e.message).join(', ') });
    }
    logger.error({ err: error }, 'Update wallet label error');
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
    logger.error({ err: error }, 'Delete wallet error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Exported for tests
export { buildChallengeMessage };
export default router;
