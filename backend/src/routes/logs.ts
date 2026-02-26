import { Router } from 'express';
import { Axiom } from '@axiomhq/js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/adminAuth.js';
import { logger } from '../lib/logger.js';

const router = Router();

function errMsg(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  return String(error);
}

function getAxiomClient(): Axiom | null {
  const token = process.env.AXIOM_TOKEN;
  if (!token) return null;
  return new Axiom({ token });
}

// All routes require admin auth
router.use(authenticateToken, requireAdmin);

// GET /api/admin/logs — Query logs from Axiom
router.get('/', async (req: AuthRequest, res) => {
  try {
    const axiom = getAxiomClient();
    if (!axiom) {
      return res.status(503).json({ error: 'Log shipping not configured. Set AXIOM_DATASET and AXIOM_TOKEN.' });
    }

    const dataset = process.env.AXIOM_DATASET;
    if (!dataset) {
      return res.status(503).json({ error: 'AXIOM_DATASET not configured.' });
    }

    const {
      level,
      search,
      timeRange = '1h',
      limit = '100',
      offset = '0',
    } = req.query as Record<string, string>;

    // Build APL query
    let apl = `['${dataset}']`;

    // Time range filter
    const validRanges: Record<string, string> = {
      '15m': '15m', '30m': '30m', '1h': '1h', '6h': '6h',
      '24h': '24h', '7d': '7d', '30d': '30d',
    };
    const range = validRanges[timeRange] || '1h';
    apl += ` | where _time > ago(${range})`;

    // Level filter
    if (level && ['trace', 'debug', 'info', 'warn', 'error', 'fatal'].includes(level)) {
      // Pino uses numeric levels: 10=trace, 20=debug, 30=info, 40=warn, 50=error, 60=fatal
      const levelMap: Record<string, number> = {
        trace: 10, debug: 20, info: 30, warn: 40, error: 50, fatal: 60,
      };
      apl += ` | where level >= ${levelMap[level]}`;
    }

    // Text search
    if (search) {
      // Escape single quotes in search term
      const escaped = search.replace(/'/g, "\\'");
      apl += ` | search "${escaped}"`;
    }

    // Sort by time descending (newest first)
    apl += ` | sort by _time desc`;

    // Pagination
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 100, 1), 500);
    const offsetNum = Math.max(parseInt(offset, 10) || 0, 0);
    if (offsetNum > 0) {
      apl += ` | skip ${offsetNum}`;
    }
    apl += ` | take ${limitNum}`;

    const result = await axiom.query(apl);

    // Transform matches into a clean format
    const entries = (result.matches || []).map((match: any) => ({
      timestamp: match._time || match.data?._time,
      level: match.data?.level,
      msg: match.data?.msg || match.data?.message,
      // Include request info if present (from pino-http)
      req: match.data?.req ? {
        method: match.data.req.method,
        url: match.data.req.url,
        statusCode: match.data?.res?.statusCode,
        responseTime: match.data?.responseTime,
      } : undefined,
      // Include error info if present
      err: match.data?.err ? {
        name: match.data.err.name || match.data.err.type,
        message: match.data.err.message,
        stack: match.data.err.stack,
      } : undefined,
      // Include the full raw data for expandable view
      raw: match.data,
    }));

    res.json({
      entries,
      count: entries.length,
      query: { dataset, timeRange: range, level, search },
      status: {
        rowsExamined: result.status?.rowsExamined || 0,
        rowsMatched: result.status?.rowsMatched || 0,
        elapsedTime: result.status?.elapsedTime || 0,
      },
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to query Axiom logs');
    res.status(500).json({ error: 'Failed to query logs', detail: errMsg(error) });
  }
});

// GET /api/admin/logs/stats — Log level distribution over time
router.get('/stats', async (req: AuthRequest, res) => {
  try {
    const axiom = getAxiomClient();
    if (!axiom) {
      return res.status(503).json({ error: 'Log shipping not configured.' });
    }

    const dataset = process.env.AXIOM_DATASET;
    if (!dataset) {
      return res.status(503).json({ error: 'AXIOM_DATASET not configured.' });
    }

    const { timeRange = '24h' } = req.query as Record<string, string>;

    const validRanges: Record<string, string> = {
      '1h': '1h', '6h': '6h', '24h': '24h', '7d': '7d', '30d': '30d',
    };
    const range = validRanges[timeRange] || '24h';

    // Get counts by level
    const levelQuery = `['${dataset}'] | where _time > ago(${range}) | summarize count() by bin_auto(_time), level`;
    const levelResult = await axiom.query(levelQuery);

    // Get error count
    const errorQuery = `['${dataset}'] | where _time > ago(${range}) | where level >= 50 | count`;
    const errorResult = await axiom.query(errorQuery);

    // Get total count
    const totalQuery = `['${dataset}'] | where _time > ago(${range}) | count`;
    const totalResult = await axiom.query(totalQuery);

    res.json({
      timeSeries: levelResult.matches || [],
      errorCount: errorResult.matches?.[0]?.data?.['count_'] || 0,
      totalCount: totalResult.matches?.[0]?.data?.['count_'] || 0,
      timeRange: range,
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to query Axiom log stats');
    res.status(500).json({ error: 'Failed to query log stats', detail: errMsg(error) });
  }
});

export default router;
