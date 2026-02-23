import { Prisma } from '@prisma/client';
import { prisma } from './prisma.js';
import { broadcastSSE } from './sse-manager.js';
import { logger } from './logger.js';

interface LogActivityParams {
  humanId: string;
  actionType: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Log a staff activity and broadcast it via SSE.
 * Fire-and-forget — never blocks the caller.
 */
export function logStaffActivity(params: LogActivityParams): void {
  const { humanId, actionType, entityType, entityId, metadata } = params;

  // Create activity record then fetch with human name for broadcast
  prisma.staffActivity
    .create({
      data: {
        humanId,
        actionType,
        entityType: entityType ?? null,
        entityId: entityId ?? null,
        metadata: metadata ? (metadata as Prisma.InputJsonValue) : Prisma.JsonNull,
      },
    })
    .then(async (activity) => {
      const human = await prisma.human.findUnique({
        where: { id: activity.humanId },
        select: { name: true },
      });
      broadcastSSE('staff_activity', {
        id: activity.id,
        humanId: activity.humanId,
        humanName: human?.name ?? 'Unknown',
        actionType: activity.actionType,
        entityType: activity.entityType,
        entityId: activity.entityId,
        metadata: activity.metadata,
        createdAt: activity.createdAt.toISOString(),
      });
    })
    .catch((err) => {
      logger.error({ err, humanId, actionType }, 'Failed to log staff activity');
    });
}
