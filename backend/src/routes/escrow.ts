/**
 * Escrow API routes.
 * All routes gated behind ESCROW_ENABLED env var (checked in app.ts before mounting).
 */
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import { authenticateAgent, AgentAuthRequest } from '../middleware/agentAuth.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { authenticateEither, EitherAuthRequest } from '../middleware/eitherAuth.js';
import { requireActiveAgent } from '../middleware/requireActiveAgent.js';
import { fireWebhook } from '../lib/webhook.js';
import {
  jobIdToHash,
  getEscrowOnChain,
  verifyDeposit,
  markCompleteOnChain,
  releaseOnChain,
  forceReleaseOnChain,
  resolveOnChain,
  acceptCancelOnChain,
  getEscrowContractAddress,
  EscrowState,
  EscrowStateNames,
} from '../lib/blockchain/escrow.js';
import type { Hex } from 'viem';

const router = Router();

// ======================== VERIFY DEPOSIT ========================
// Agent calls after depositing USDC into contract
router.post('/:jobId/verify-deposit', authenticateAgent, requireActiveAgent, async (req: AgentAuthRequest, res) => {
  try {
    const { txHash } = z.object({
      txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/, 'Invalid tx hash'),
    }).parse(req.body);

    const job = await prisma.job.findUnique({ where: { id: req.params.jobId } });
    if (!job) return res.status(404).json({ error: 'Job not found' });
    if (job.registeredAgentId !== req.agent?.id) {
      return res.status(403).json({ error: 'Not your job' });
    }
    if (job.paymentMode !== 'ESCROW') {
      return res.status(400).json({ error: 'Job is not in escrow mode' });
    }
    if (job.escrowStatus && job.escrowStatus !== 'PENDING_DEPOSIT') {
      return res.status(400).json({ error: `Escrow already in ${job.escrowStatus} state` });
    }

    // Check tx not already used
    const existing = await prisma.job.findUnique({ where: { escrowDepositTxHash: txHash } });
    if (existing) {
      return res.status(400).json({ error: 'Transaction already used for another escrow' });
    }

    const jobIdHash = jobIdToHash(job.id);

    // Verify on-chain
    const deposit = await verifyDeposit(txHash as Hex, jobIdHash);

    const updated = await prisma.job.update({
      where: { id: job.id },
      data: {
        status: 'PAID',
        escrowStatus: 'FUNDED',
        escrowContractAddress: getEscrowContractAddress(),
        escrowJobIdHash: jobIdHash,
        escrowDepositTxHash: txHash,
        escrowDepositedAt: new Date(),
        escrowDepositorAddress: deposit.depositor?.toLowerCase() ?? null,
        escrowPayeeAddress: deposit.payee?.toLowerCase() ?? null,
        escrowAmount: deposit.amount?.toString() ?? '0',
        escrowArbitratorAddress: deposit.arbitrator?.toLowerCase() ?? null,
        escrowArbitratorFeeBps: deposit.arbitratorFeeBps,
        escrowDisputeWindow: deposit.disputeWindow,
        paidAt: new Date(),
        paymentNetwork: 'base-sepolia',
        paymentTxHash: txHash,
        paymentAmount: Number(deposit.amount) / 1e6,
      },
    });

    if (job.callbackUrl) {
      fireWebhook(
        { ...updated, callbackUrl: job.callbackUrl, callbackSecret: job.callbackSecret },
        'job.escrow_funded',
      );
    }

    res.json({
      id: updated.id,
      status: updated.status,
      escrowStatus: updated.escrowStatus,
      escrowContractAddress: updated.escrowContractAddress,
      escrowJobIdHash: updated.escrowJobIdHash,
      escrowAmount: Number(updated.escrowAmount),
      escrowArbitratorAddress: updated.escrowArbitratorAddress,
      escrowArbitratorFeeBps: updated.escrowArbitratorFeeBps,
      escrowDisputeWindow: updated.escrowDisputeWindow,
    });
  } catch (error: any) {
    logger.error({ err: error, jobId: req.params.jobId }, 'Verify escrow deposit error');
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// ======================== MARK COMPLETE ========================
// Agent approves work → relayer calls markComplete on-chain
router.post('/:jobId/mark-complete', authenticateAgent, requireActiveAgent, async (req: AgentAuthRequest, res) => {
  try {
    const job = await prisma.job.findUnique({ where: { id: req.params.jobId } });
    if (!job) return res.status(404).json({ error: 'Job not found' });
    if (job.registeredAgentId !== req.agent?.id) {
      return res.status(403).json({ error: 'Not your job' });
    }
    if (job.paymentMode !== 'ESCROW' || job.escrowStatus !== 'FUNDED') {
      return res.status(400).json({ error: 'Escrow not in FUNDED state' });
    }
    if (job.status !== 'SUBMITTED') {
      return res.status(400).json({ error: `Cannot approve completion for job in ${job.status} status` });
    }

    const jobIdHash = job.escrowJobIdHash as Hex;
    const txHash = await markCompleteOnChain(jobIdHash);

    const now = new Date();
    const disputeDeadline = new Date(now.getTime() + (job.escrowDisputeWindow ?? 72 * 3600) * 1000);

    const updated = await prisma.job.update({
      where: { id: job.id },
      data: {
        status: 'COMPLETED',
        escrowStatus: 'COMPLETED_ONCHAIN',
        escrowCompletedAt: now,
        escrowDisputeDeadline: disputeDeadline,
        completedAt: now,
        lastActionBy: 'AGENT',
      },
    });

    if (job.callbackUrl) {
      fireWebhook(
        { ...updated, callbackUrl: job.callbackUrl, callbackSecret: job.callbackSecret },
        'job.escrow_completed',
      );
    }

    res.json({
      id: updated.id,
      status: updated.status,
      escrowStatus: updated.escrowStatus,
      escrowDisputeDeadline: updated.escrowDisputeDeadline,
      markCompleteTxHash: txHash,
      message: `Work approved. Funds auto-release at ${disputeDeadline.toISOString()} unless disputed.`,
    });
  } catch (error: any) {
    logger.error({ err: error, jobId: req.params.jobId }, 'Mark complete error');
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// ======================== ESCROW STATUS ========================
router.get('/:jobId/status', async (req, res) => {
  try {
    const job = await prisma.job.findUnique({
      where: { id: req.params.jobId },
      select: {
        id: true,
        status: true,
        paymentMode: true,
        escrowStatus: true,
        escrowContractAddress: true,
        escrowJobIdHash: true,
        escrowAmount: true,
        escrowArbitratorAddress: true,
        escrowArbitratorFeeBps: true,
        escrowDisputeWindow: true,
        escrowCompletedAt: true,
        escrowDisputeDeadline: true,
        escrowReleasedAt: true,
        escrowDisputedAt: true,
        escrowResolvedAt: true,
        escrowCancelledAt: true,
        escrowVerdictAmountPayee: true,
        escrowVerdictAmountDepositor: true,
        escrowVerdictArbitratorFee: true,
      },
    });

    if (!job) return res.status(404).json({ error: 'Job not found' });
    if (job.paymentMode !== 'ESCROW') {
      return res.status(400).json({ error: 'Job is not in escrow mode' });
    }

    // Include live on-chain state if funded
    let onChainState = null;
    if (job.escrowJobIdHash && job.escrowStatus && job.escrowStatus !== 'PENDING_DEPOSIT') {
      try {
        onChainState = await getEscrowOnChain(job.escrowJobIdHash as Hex);
      } catch {
        // On-chain read may fail, that's ok
      }
    }

    const now = Date.now();
    const timeRemaining = job.escrowDisputeDeadline
      ? Math.max(0, Math.floor((job.escrowDisputeDeadline.getTime() - now) / 1000))
      : null;

    res.json({
      ...job,
      escrowAmount: job.escrowAmount ? Number(job.escrowAmount) : null,
      escrowVerdictAmountPayee: job.escrowVerdictAmountPayee ? Number(job.escrowVerdictAmountPayee) : null,
      escrowVerdictAmountDepositor: job.escrowVerdictAmountDepositor ? Number(job.escrowVerdictAmountDepositor) : null,
      escrowVerdictArbitratorFee: job.escrowVerdictArbitratorFee ? Number(job.escrowVerdictArbitratorFee) : null,
      timeRemaining,
      onChainState,
    });
  } catch (error: any) {
    logger.error({ err: error, jobId: req.params.jobId }, 'Escrow status error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ======================== PROPOSE CANCEL ========================
router.post('/:jobId/propose-cancel', authenticateAgent, requireActiveAgent, async (req: AgentAuthRequest, res) => {
  try {
    const { amountToPayee } = z.object({
      amountToPayee: z.number().min(0),
    }).parse(req.body);

    const job = await prisma.job.findUnique({ where: { id: req.params.jobId } });
    if (!job) return res.status(404).json({ error: 'Job not found' });
    if (job.registeredAgentId !== req.agent?.id) {
      return res.status(403).json({ error: 'Not your job' });
    }
    if (job.paymentMode !== 'ESCROW') {
      return res.status(400).json({ error: 'Not an escrow job' });
    }
    if (!['FUNDED', 'COMPLETED_ONCHAIN'].includes(job.escrowStatus || '')) {
      return res.status(400).json({ error: `Cannot cancel in ${job.escrowStatus} state` });
    }

    // Record the proposal (on-chain proposeCancel is called by the depositor directly)
    res.json({
      message: 'Cancel proposed. The worker must accept on-chain. Proposal expires in 7 days.',
      amountToPayee,
      amountToDepositor: Number(job.escrowAmount || 0) - amountToPayee,
      expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
    });
  } catch (error: any) {
    logger.error({ err: error, jobId: req.params.jobId }, 'Propose cancel error');
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// ======================== ACCEPT CANCEL ========================
router.post('/:jobId/accept-cancel', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const job = await prisma.job.findUnique({ where: { id: req.params.jobId } });
    if (!job) return res.status(404).json({ error: 'Job not found' });
    if (job.humanId !== req.userId) {
      return res.status(403).json({ error: 'Not your job' });
    }
    if (job.paymentMode !== 'ESCROW') {
      return res.status(400).json({ error: 'Not an escrow job' });
    }

    const jobIdHash = job.escrowJobIdHash as Hex;
    const txHash = await acceptCancelOnChain(jobIdHash);

    const updated = await prisma.job.update({
      where: { id: job.id },
      data: {
        status: 'CANCELLED',
        escrowStatus: 'CANCELLED',
        escrowCancelTxHash: txHash,
        escrowCancelledAt: new Date(),
        cancelledAt: new Date(),
        cancelledBy: 'HUMAN',
      },
    });

    if (job.callbackUrl) {
      fireWebhook(
        { ...updated, callbackUrl: job.callbackUrl, callbackSecret: job.callbackSecret },
        'job.escrow_cancelled',
      );
    }

    res.json({
      id: updated.id,
      status: updated.status,
      escrowStatus: updated.escrowStatus,
      cancelTxHash: txHash,
    });
  } catch (error: any) {
    logger.error({ err: error, jobId: req.params.jobId }, 'Accept cancel error');
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// ======================== SUBMIT VERDICT ========================
// Anyone (usually relayer) submits arbitrator's signed verdict
// Transaction pattern: state check + arbitrator verify + on-chain call + DB update (atomic)
router.post('/resolve', authenticateAgent, async (req: AgentAuthRequest, res) => {
  let body: { jobId: string; toPayee: string; toDepositor: string; arbitratorFee: string; nonce: string; signature: string } | undefined;
  try {
    const parsed = z.object({
      jobId: z.string(),
      toPayee: z.string(), // raw USDC amount (6 decimals)
      toDepositor: z.string(),
      arbitratorFee: z.string(),
      nonce: z.string(),
      signature: z.string().regex(/^0x[a-fA-F0-9]+$/),
    }).parse(req.body);
    body = parsed;
    const b = parsed;

    // Use interactive transaction to ensure atomicity.
    // Timeout: 30s to accommodate on-chain call (typical ~5-10s, plus network/RPC delays).
    const result = await prisma.$transaction(
      async (tx): Promise<{error: string; status: number} | {success: true; updated: any; job: any; txHash: string}> => {
        // Fetch job with lock-like semantics (within transaction, read is consistent)
        const job = await tx.job.findUnique({ where: { id: b.jobId } });
        if (!job) {
          return { error: 'Job not found', status: 404 };
        }

        if (job.paymentMode !== 'ESCROW' || job.escrowStatus !== 'DISPUTED') {
          return { error: 'Escrow not in DISPUTED state', status: 400 };
        }

        // Verify the caller is the assigned arbitrator for this job
        if (!job.escrowArbitratorAddress) {
          return { error: 'No arbitrator assigned to this job', status: 400 };
        }

        const callerWallet = await tx.agentWallet.findFirst({
          where: {
            agentId: req.agent!.id,
            address: job.escrowArbitratorAddress.toLowerCase(),
            verified: true,
          },
        });

        if (!callerWallet) {
          return { error: 'Caller is not the assigned arbitrator for this job', status: 403 };
        }

        const arbAgent = await tx.agent.findUnique({ where: { id: req.agent!.id }, select: { arbitratorApproved: true } });
        if (!arbAgent?.arbitratorApproved) {
          return { error: 'Arbitrator not approved', status: 403 };
        }

        // All pre-conditions passed. Now execute on-chain call.
        // If this fails, the transaction rolls back and the error propagates.
        const jobIdHash = job.escrowJobIdHash as Hex;
        let txHash: string;
        try {
          txHash = await resolveOnChain(
            jobIdHash,
            BigInt(b.toPayee),
            BigInt(b.toDepositor),
            BigInt(b.arbitratorFee),
            BigInt(b.nonce),
            b.signature as Hex,
          );
        } catch (onChainError) {
          // On-chain error → transaction rolls back, safe to retry
          logger.error(
            { err: onChainError, jobId: b.jobId },
            'Resolve escrow: on-chain call failed, transaction rolled back'
          );
          throw onChainError;
        }

        // On-chain call succeeded. Now update DB atomically.
        // If this fails after on-chain succeeds, we catch it outside the transaction.
        const updated = await tx.job.update({
          where: { id: job.id },
          data: {
            escrowStatus: 'RESOLVED',
            escrowVerdictAmountPayee: (Number(b.toPayee) / 1e6).toString(),
            escrowVerdictAmountDepositor: (Number(b.toDepositor) / 1e6).toString(),
            escrowVerdictArbitratorFee: (Number(b.arbitratorFee) / 1e6).toString(),
            escrowVerdictSignature: b.signature,
            escrowVerdictNonce: b.nonce,
            escrowResolveTxHash: txHash,
            escrowResolvedAt: new Date(),
          },
        });

        return { success: true, updated, job, txHash };
      },
      { timeout: 30000 } // 30 second timeout for the full transaction
    );

    // Handle transaction-level validation errors (400/403/404)
    if ('error' in result) {
      return res.status(result.status).json({ error: result.error });
    }

    // Transaction succeeded. Fire webhook and return success.
    const { updated, job, txHash } = result;
    if (job.callbackUrl) {
      fireWebhook(
        { ...updated, callbackUrl: job.callbackUrl, callbackSecret: job.callbackSecret },
        'job.escrow_resolved',
      );
    }

    res.json({
      id: updated.id,
      escrowStatus: updated.escrowStatus,
      resolveTxHash: txHash,
      toPayee: b.toPayee,
      toDepositor: b.toDepositor,
      arbitratorFee: b.arbitratorFee,
    });
  } catch (error: any) {
    // CRITICAL: If we reach here, it could be:
    // 1. On-chain call failed (safe, transaction rolled back, can retry)
    // 2. DB update failed AFTER on-chain succeeded (divergence risk)
    // 3. Other unexpected error
    //
    // We cannot reliably determine which case we're in without querying,
    // so we log with all context and return 500. Monitoring/alerting should
    // detect the divergence and trigger manual reconciliation.
    logger.error(
      {
        err: error,
        jobId: body?.jobId,
        verdictData: {
          toPayee: body?.toPayee,
          toDepositor: body?.toDepositor,
          arbitratorFee: body?.arbitratorFee,
        },
      },
      'CRITICAL: Resolve escrow error - possible on-chain/DB divergence. Manual reconciliation may be needed.'
    );
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// ======================== LIST ARBITRATORS ========================
router.get('/arbitrators', async (_req, res) => {
  try {
    const arbitrators = await prisma.agent.findMany({
      where: {
        isArbitrator: true,
        arbitratorApproved: true,  // Only approved arbitrators
        arbitratorHealthy: true,
        status: 'ACTIVE',
      },
      select: {
        id: true,
        name: true,
        description: true,
        isVerified: true,
        arbitratorFeeBps: true,
        arbitratorSpecialties: true,
        arbitratorSla: true,
        arbitratorHealthy: true,
        arbitratorDisputeCount: true,
        arbitratorWinCount: true,
        arbitratorTotalEarned: true,
        arbitratorAvgResponseH: true,
        escrowReleaseCount: true,
        escrowDisputeCount: true,
        wallets: {
          where: { verified: true },
          select: { address: true, network: true },
        },
      },
    });

    res.json(arbitrators.map(a => ({
      ...a,
      arbitratorTotalEarned: Number(a.arbitratorTotalEarned),
    })));
  } catch (error) {
    logger.error({ err: error }, 'List arbitrators error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
