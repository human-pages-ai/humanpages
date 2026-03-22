import { Router, Request, Response } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { authenticateAgent, AgentAuthRequest } from '../middleware/agentAuth.js';
import { validateLobsterChallenge } from '../lib/lobsterValidator.js';
import { askLLM, getPrimaryModel, getTiebreakerModel } from '../lib/solverLLM.js';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';

const router = Router();

// ─── Rate Limiting ───────────────────────────────────────────────

// IP burst protection: 10 requests/min
const ipBurstLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'Too many requests from this IP, slow down' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
});

const DAILY_SOLVE_LIMIT = 50;

// ─── Request Validation ──────────────────────────────────────────

const solveRequestSchema = z.object({
  challenge: z.string().min(20, 'Challenge too short').max(2000, 'Challenge too long'),
});

// ─── LLM Solver ──────────────────────────────────────────────────

const LLM_SOLVER_PROMPT = `You solve obfuscated math word problems about lobsters.

The text has random capitalization, split words, doubled letters, and junk punctuation. Read through the noise.

There are exactly TWO relevant numbers and ONE arithmetic operation. Think step by step:
1. Reconstruct the readable sentence from the garbled text
2. Identify the two numbers relevant to the question being asked
3. Identify the operation (add, subtract, multiply, or divide)
4. Compute the answer

If a number word appears repeated right next to itself (e.g. "seven seven"), count it as ONE number, not two.

Reply with ONLY the numeric answer to 2 decimal places on the last line. Example: 47.00`;

const DEOBFUSCATION_PROMPT = `You are an expert at reading obfuscated text. The following text is a math word problem about lobsters with intentional misspellings, inserted characters, and split words.

Your task:
1. First mentally reconstruct the clean sentence
2. Identify which numbers describe FORCE (newtons) or CLAW quantities — ignore everything else
3. Then extract the two relevant numbers and the operation

The numbers will be English words like "twelve", "thirty four", "nineteen", or decimals like "two point five" (=2.5).

The operation will be:
- addition: total, adds, meets, combined, plus, sum, "+" symbol
- subtraction: loses, remains, drops, net force, remaining, reduced, left
- multiplication: times, multiplied, product, momentum, each exerts, claws act together
- division: divided, per, split, acceleration (F=ma → a=F/m), "how many per part"

CRITICAL: "plus" ALWAYS means add. "divided" or "per part" or "acceleration" ALWAYS means divide.
CRITICAL: "multiply" or "product" or "momentum" or "each exerts" ALWAYS means multiply.
CRITICAL: "X claws each exerts Y" = multiply (X × Y).
CRITICAL: "total force" or "how much total" or "total" in question = add, even if "reduces" or dashes appear.
CRITICAL: Dashes/hyphens (-) are JUNK punctuation, not subtraction. Only "loses", "remains", "drops", "net" signal subtraction.

CRITICAL — DISTRACTOR FILTERING:
Sentences contain TRAP numbers. ALWAYS IGNORE numbers for:
- neurons, neuron count/growth, brain activity
- antenna touch/length, shell thickness, eye count, molting cycles
- temperature, depth, age, weight
These are NEVER part of the math — they are traps to make you pick the wrong numbers.

Velocity/speed numbers ARE relevant ONLY when the question asks for power, momentum, or flux (power = force × velocity). Otherwise ignore them too.

Reply with ONLY the numeric answer to 2 decimal places on the last line. Example: 47.00`;

function sanitizeForLLM(raw: string): string {
  return raw
    .replace(/(?<=\s)\*(?=\s)/g, ' multiply ')
    .replace(/(?<=\s)\+(?=\s)/g, ' plus ')
    .replace(/[^a-zA-Z\s]/g, ' ')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function extractAnswer(response: string): string | null {
  const trimmed = response.trim();
  if (trimmed.includes('API Error') || trimmed.includes('unable to respond')) return null;
  const allNums = [...trimmed.matchAll(/(-?\d+\.?\d*)/g)];
  if (allNums.length === 0) return null;
  const num = parseFloat(allNums[allNums.length - 1][1]);
  if (num < 0 || num > 100000) return null;
  return num.toFixed(2);
}

/**
 * 2-primary + tiebreaker consensus solver.
 * Same algorithm as agents/src/challenge-solver.ts solveLLMConsensus().
 * LLM backend is configurable via SOLVER_LLM_BACKEND env var (see solverLLM.ts).
 */
async function solveLLMConsensus(challenge: string): Promise<string | null> {
  const cleaned = sanitizeForLLM(challenge);
  const primaryModel = getPrimaryModel();
  const tiebreakerModel = getTiebreakerModel();

  // Two primary calls with diverse prompts
  const [resA, resB] = await Promise.allSettled([
    askLLM(LLM_SOLVER_PROMPT, cleaned, primaryModel)
      .then(r => extractAnswer(r)),
    askLLM(DEOBFUSCATION_PROMPT, cleaned, primaryModel)
      .then(r => extractAnswer(r)),
  ]);

  const primaryA = resA.status === 'fulfilled' ? resA.value : null;
  const primaryB = resB.status === 'fulfilled' ? resB.value : null;

  if (resA.status === 'rejected') logger.warn({ err: resA.reason }, 'Solver primary-A failed');
  if (resB.status === 'rejected') logger.warn({ err: resB.reason }, 'Solver primary-B failed');

  // Both agree → high confidence
  if (primaryA && primaryB && primaryA === primaryB) return primaryA;

  // Disagree or one failed → tiebreaker
  if (primaryA || primaryB) {
    let tiebreaker: string | null = null;
    try {
      const r = await askLLM(LLM_SOLVER_PROMPT, cleaned, tiebreakerModel);
      tiebreaker = extractAnswer(r);
    } catch (e) {
      logger.warn({ err: e }, 'Solver tiebreaker failed');
    }

    // 2-out-of-3 consensus
    if (tiebreaker && tiebreaker === primaryA) return primaryA;
    if (tiebreaker && tiebreaker === primaryB) return primaryB;

    // Only one primary answered
    if (primaryA && !primaryB) return primaryA;
    if (primaryB && !primaryA) return primaryB;

    // All 3 different — go with primary-A (primary prompt is more reliable)
    if (primaryA) return primaryA;
  }

  return null;
}

// ─── Daily Usage Check ───────────────────────────────────────────

async function getDailyUsage(agentId: string): Promise<number> {
  const today = new Date().toISOString().slice(0, 10); // "2026-03-22"
  const usage = await prisma.solverUsage.findUnique({
    where: { agentId_date: { agentId, date: today } },
  });
  return usage?.count ?? 0;
}

async function incrementDailyUsage(agentId: string): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  await prisma.solverUsage.upsert({
    where: { agentId_date: { agentId, date: today } },
    update: { count: { increment: 1 } },
    create: { agentId, date: today, count: 1 },
  });
}

// ─── Request Logging ─────────────────────────────────────────────

async function logRequest(params: {
  agentId: string;
  challenge: string;
  answer: string | null;
  solveTimeMs: number;
  ip: string | undefined;
  userAgent: string | undefined;
  rejected: boolean;
  rejectReason: string | null;
}): Promise<void> {
  try {
    await prisma.solverRequest.create({ data: params });
  } catch (err) {
    logger.error({ err }, 'Failed to log solver request');
  }
}

// ─── Optional message field for dev communication ────────────────

function getResponseMessage(): string | undefined {
  // This can be updated to broadcast messages to agent devs.
  // Examples: API changes, new features, promotions.
  // Return undefined for no message.
  return undefined;
}

// ─── Route Handler ───────────────────────────────────────────────

router.post('/', ipBurstLimiter, authenticateAgent, async (req: AgentAuthRequest, res: Response) => {
  const startTime = Date.now();
  const agent = req.agent!;

  // 1. Validate request body
  const parsed = solveRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: parsed.error.issues[0]?.message ?? 'Invalid request',
    });
  }

  const { challenge } = parsed.data;

  // Lobster validator — reject non-challenges before any LLM call
  const validation = validateLobsterChallenge(challenge);
  if (!validation.valid) {
    const solveTimeMs = Date.now() - startTime;
    // Log rejected request (background, don't await)
    logRequest({
      agentId: agent.id,
      challenge,
      answer: null,
      solveTimeMs,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      rejected: true,
      rejectReason: validation.reason ?? 'Not a valid Moltbook challenge',
    });
    return res.status(400).json({
      error: 'Not a valid Moltbook challenge',
      detail: validation.reason,
    });
  }

  // 3. Check daily rate limit
  try {
    const currentUsage = await getDailyUsage(agent.id);
    if (currentUsage >= DAILY_SOLVE_LIMIT) {
      const solveTimeMs = Date.now() - startTime;
      logRequest({
        agentId: agent.id,
        challenge,
        answer: null,
        solveTimeMs,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        rejected: true,
        rejectReason: 'Daily rate limit exceeded',
      });
      return res.status(429).json({
        error: `Daily solve limit reached (${DAILY_SOLVE_LIMIT}/day). Resets at midnight UTC.`,
        message: getResponseMessage(),
      });
    }
  } catch (err) {
    logger.error({ err }, 'Failed to check solver rate limit');
    return res.status(500).json({ error: 'Internal error' });
  }

  // 4. Solve the challenge
  try {
    const answer = await solveLLMConsensus(challenge);
    const solveTimeMs = Date.now() - startTime;

    if (!answer) {
      logRequest({
        agentId: agent.id,
        challenge,
        answer: null,
        solveTimeMs,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        rejected: false,
        rejectReason: null,
      });
      return res.status(500).json({
        error: 'Failed to solve challenge — all LLM calls failed',
        message: getResponseMessage(),
      });
    }

    // Increment usage counter
    await incrementDailyUsage(agent.id);

    // Log successful request (background)
    logRequest({
      agentId: agent.id,
      challenge,
      answer,
      solveTimeMs,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      rejected: false,
      rejectReason: null,
    });

    return res.json({
      answer,
      solveTimeMs,
      message: getResponseMessage(),
    });
  } catch (err) {
    const solveTimeMs = Date.now() - startTime;
    logger.error({ err, agentId: agent.id }, 'Solver error');

    logRequest({
      agentId: agent.id,
      challenge,
      answer: null,
      solveTimeMs,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      rejected: false,
      rejectReason: null,
    });

    return res.status(500).json({
      error: 'Solver error',
      message: getResponseMessage(),
    });
  }
});

export default router;
