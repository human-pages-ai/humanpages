import 'dotenv/config';
import express from 'express';
import crypto from 'crypto';
import { privateKeyToAccount } from 'viem/accounts';
import type { Hex } from 'viem';

const app = express();
app.use(express.json());

const PORT = parseInt(process.env.PORT || '3100');
const HP_API_URL = process.env.HP_API_URL || 'https://humanpages.ai/api';
const HP_API_KEY = process.env.HP_API_KEY || '';
const ESCROW_CONTRACT = process.env.ESCROW_CONTRACT as Hex | undefined;
const CHAIN_ID = parseInt(process.env.CHAIN_ID || '84532');

// --- Health check ---

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// --- Dispute webhook ---

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;
if (!WEBHOOK_SECRET) {
  console.error('FATAL: WEBHOOK_SECRET is not set. The /dispute endpoint would accept unsigned requests.');
  console.error('Set WEBHOOK_SECRET in your .env file to secure the webhook.');
  process.exit(1);
}

app.post('/dispute', async (req, res) => {
  // Verify HMAC signature (mandatory)
  const sig = req.headers['x-hp-signature'] as string;
  const expected = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(JSON.stringify(req.body))
    .digest('hex');
  if (!sig || sig.length !== expected.length ||
      !crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex'))) {
    console.warn('Rejected request with invalid webhook signature');
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const { jobId, depositor, payee, amount, arbitratorFee } = req.body;
  console.log('Dispute received:', { jobId, depositor, payee, amount, arbitratorFee });

  // TODO: Implement your dispute resolution logic here.
  // For now, just acknowledge receipt.
  res.json({ received: true, jobId });
});

// --- EIP-712 verdict signing ---

const VERDICT_TYPES = {
  Verdict: [
    { name: 'jobId', type: 'bytes32' },
    { name: 'toPayee', type: 'uint256' },
    { name: 'toDepositor', type: 'uint256' },
    { name: 'arbitratorFee', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
  ],
} as const;

/**
 * Sign an EIP-712 verdict for a dispute.
 * Call this after you've decided how to split the escrow.
 */
export async function signVerdict(params: {
  jobId: Hex;
  toPayee: bigint;
  toDepositor: bigint;
  arbitratorFee: bigint;
  nonce: bigint;
}): Promise<Hex> {
  const pk = process.env.ARBITRATOR_PRIVATE_KEY as Hex;
  if (!pk) throw new Error('ARBITRATOR_PRIVATE_KEY not set');
  if (!ESCROW_CONTRACT) throw new Error('ESCROW_CONTRACT not set');

  // Validate amounts before signing
  if (params.toPayee < 0n || params.toDepositor < 0n || params.arbitratorFee < 0n) {
    throw new Error('Verdict amounts must be non-negative');
  }
  if (params.toPayee + params.toDepositor + params.arbitratorFee === 0n) {
    throw new Error('Verdict total must be greater than zero');
  }

  const account = privateKeyToAccount(pk);

  const signature = await account.signTypedData({
    domain: {
      name: 'AgentEscrow',
      version: '2',
      chainId: CHAIN_ID,
      verifyingContract: ESCROW_CONTRACT,
    },
    types: VERDICT_TYPES,
    primaryType: 'Verdict',
    message: {
      jobId: params.jobId,
      toPayee: params.toPayee,
      toDepositor: params.toDepositor,
      arbitratorFee: params.arbitratorFee,
      nonce: params.nonce,
    },
  });

  console.log('Verdict signed:', { jobId: params.jobId, signature: signature.slice(0, 20) + '...' });
  return signature;
}

/**
 * Submit a signed verdict to the Human Pages API.
 * The platform relayer will execute it on-chain — you pay zero gas.
 */
export async function submitVerdict(
  jobId: string,
  verdict: {
    toPayee: string;
    toDepositor: string;
    arbitratorFee: string;
    nonce: string;
    signature: string;
  },
): Promise<void> {
  const res = await fetch(`${HP_API_URL}/escrow/${jobId}/resolve`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Agent-Key': HP_API_KEY,
    },
    body: JSON.stringify(verdict),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Submit verdict failed (${res.status}): ${body}`);
  }

  console.log('Verdict submitted for job:', jobId);
}

// --- Start ---

app.listen(PORT, () => {
  console.log(`Arbitrator bot listening on http://localhost:${PORT}`);
  console.log(`  Health:  GET  http://localhost:${PORT}/health`);
  console.log(`  Webhook: POST http://localhost:${PORT}/dispute`);
});
