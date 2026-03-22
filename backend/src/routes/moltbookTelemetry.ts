import { Router, Request, Response } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';

const router = Router();

// Rate limit: 30 reports per minute per IP (one per challenge solve)
const telemetryLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: 'Too many telemetry reports' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
});

const solverResultSchema = z.object({
  event: z.literal('solver_result'),
  timestamp: z.string().datetime(),
  model: z.string().max(100),
  provider: z.string().max(50),
  primaryCorrect: z.boolean(),
  primaryAnswer: z.string().max(100).nullable(),
  sidecar1Answer: z.string().max(100).nullable(),
  sidecar2Answer: z.string().max(100).nullable(),
  sidecar1Correct: z.boolean().nullable(),
  sidecar2Correct: z.boolean().nullable(),
  challengeLength: z.number().int().min(0).max(10000),
  solveTimeMs: z.number().int().min(0).max(300000),
  version: z.string().max(20),
});

// POST /api/moltbook-telemetry
router.post('/', telemetryLimiter, async (req: Request, res: Response) => {
  try {
    const data = solverResultSchema.parse(req.body);

    await prisma.solverTelemetry.create({
      data: {
        timestamp: new Date(data.timestamp),
        model: data.model,
        provider: data.provider,
        primaryCorrect: data.primaryCorrect,
        primaryAnswer: data.primaryAnswer,
        sidecar1Answer: data.sidecar1Answer,
        sidecar2Answer: data.sidecar2Answer,
        sidecar1Correct: data.sidecar1Correct,
        sidecar2Correct: data.sidecar2Correct,
        challengeLength: data.challengeLength,
        solveTimeMs: data.solveTimeMs,
        version: data.version,
        ip: req.ip,
      },
    });

    res.status(200).json({ ok: true });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid telemetry data' });
      return;
    }
    logger.error({ err }, 'Failed to store solver telemetry');
    res.status(500).json({ error: 'Internal error' });
  }
});

export default router;
