/**
 * Escrow background worker.
 * - Auto-releases escrowed funds after dispute window passes
 * - Force-releases funds to payee after arbitrator timeout (7 days)
 * - Health-checks arbitrator webhooks
 */
import { prisma } from './prisma.js';
import { logger } from './logger.js';
import { isEscrowEnabled } from './blockchain/escrow.js';
import { releaseOnChain, forceReleaseOnChain } from './blockchain/escrow.js';
import type { Hex } from 'viem';

let releaseInterval: ReturnType<typeof setInterval> | null = null;
let healthInterval: ReturnType<typeof setInterval> | null = null;

const RELEASE_CHECK_MS = 60_000;     // every 60s
const HEALTH_CHECK_MS = 10 * 60_000; // every 10 min

// ======================== AUTO-RELEASE ========================

async function checkAutoRelease() {
  try {
    // Find escrows past dispute deadline with no dispute
    const jobs = await prisma.job.findMany({
      where: {
        escrowStatus: 'COMPLETED_ONCHAIN',
        escrowDisputeDeadline: { lte: new Date() },
      },
      take: 10, // batch
    });

    for (const job of jobs) {
      try {
        if (!job.escrowJobIdHash) continue;
        const txHash = await releaseOnChain(job.escrowJobIdHash as Hex);
        await prisma.job.update({
          where: { id: job.id },
          data: {
            escrowStatus: 'RELEASED',
            escrowReleaseTxHash: txHash,
            escrowReleasedAt: new Date(),
          },
        });
        logger.info({ jobId: job.id, txHash }, 'Escrow auto-released');
      } catch (err) {
        logger.error({ err, jobId: job.id }, 'Failed to auto-release escrow');
      }
    }
  } catch (err) {
    logger.error({ err }, 'Auto-release check failed');
  }
}

// ======================== FORCE-RELEASE (ARBITRATOR TIMEOUT) ========================

async function checkForceRelease() {
  try {
    const ARBITRATOR_TIMEOUT_MS = 7 * 24 * 3600 * 1000; // 7 days
    const cutoff = new Date(Date.now() - ARBITRATOR_TIMEOUT_MS);

    const jobs = await prisma.job.findMany({
      where: {
        escrowStatus: 'DISPUTED',
        escrowDisputedAt: { lte: cutoff },
      },
      take: 10,
    });

    for (const job of jobs) {
      try {
        if (!job.escrowJobIdHash) continue;
        const txHash = await forceReleaseOnChain(job.escrowJobIdHash as Hex);
        await prisma.job.update({
          where: { id: job.id },
          data: {
            escrowStatus: 'RELEASED',
            escrowReleaseTxHash: txHash,
            escrowReleasedAt: new Date(),
          },
        });
        logger.info({ jobId: job.id, txHash }, 'Escrow force-released (arbitrator timeout)');
      } catch (err) {
        logger.error({ err, jobId: job.id }, 'Failed to force-release escrow');
      }
    }
  } catch (err) {
    logger.error({ err }, 'Force-release check failed');
  }
}

// ======================== ARBITRATOR HEALTH CHECK ========================

// Track consecutive failures per arbitrator
const healthFailures = new Map<string, number>();

async function checkArbitratorHealth() {
  try {
    const arbitrators = await prisma.agent.findMany({
      where: {
        isArbitrator: true,
        arbitratorWebhookUrl: { not: null },
      },
      select: {
        id: true,
        arbitratorWebhookUrl: true,
        arbitratorHealthy: true,
      },
    });

    for (const arb of arbitrators) {
      if (!arb.arbitratorWebhookUrl) continue;

      try {
        // Validate URL is safe (no SSRF)
        const url = new URL(arb.arbitratorWebhookUrl);
        if (!['https:'].includes(url.protocol)) {
          logger.warn({ agentId: arb.id }, 'Arbitrator webhook not HTTPS, skipping');
          continue;
        }
        // Block private IPs
        const hostname = url.hostname;
        if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' ||
            hostname.startsWith('10.') || hostname.startsWith('192.168.') ||
            hostname.startsWith('172.') || hostname === '169.254.169.254') {
          logger.warn({ agentId: arb.id, hostname }, 'Arbitrator webhook blocked (private IP)');
          continue;
        }

        const healthUrl = arb.arbitratorWebhookUrl.replace(/\/$/, '') + '/health';
        const response = await fetch(healthUrl, {
          method: 'GET',
          signal: AbortSignal.timeout(5000),
        });

        if (response.ok) {
          healthFailures.set(arb.id, 0);
          if (!arb.arbitratorHealthy) {
            await prisma.agent.update({
              where: { id: arb.id },
              data: { arbitratorHealthy: true, arbitratorLastHealthAt: new Date() },
            });
            logger.info({ agentId: arb.id }, 'Arbitrator back online');
          } else {
            await prisma.agent.update({
              where: { id: arb.id },
              data: { arbitratorLastHealthAt: new Date() },
            });
          }
        } else {
          throw new Error(`Health check returned ${response.status}`);
        }
      } catch {
        const failures = (healthFailures.get(arb.id) || 0) + 1;
        healthFailures.set(arb.id, failures);

        if (failures >= 3 && arb.arbitratorHealthy) {
          await prisma.agent.update({
            where: { id: arb.id },
            data: { arbitratorHealthy: false },
          });
          logger.warn({ agentId: arb.id, failures }, 'Arbitrator marked unhealthy');
        }
      }
    }
  } catch (err) {
    logger.error({ err }, 'Arbitrator health check failed');
  }
}

// ======================== START / STOP ========================

export function startEscrowWorker() {
  if (!isEscrowEnabled()) {
    logger.info('Escrow worker disabled (ESCROW_ENABLED not set)');
    return;
  }

  logger.info('Starting escrow worker');

  releaseInterval = setInterval(async () => {
    await checkAutoRelease();
    await checkForceRelease();
  }, RELEASE_CHECK_MS);

  healthInterval = setInterval(checkArbitratorHealth, HEALTH_CHECK_MS);

  // Run once immediately
  checkAutoRelease();
  checkForceRelease();
  checkArbitratorHealth();
}

export function stopEscrowWorker() {
  if (releaseInterval) clearInterval(releaseInterval);
  if (healthInterval) clearInterval(healthInterval);
  releaseInterval = null;
  healthInterval = null;
}
