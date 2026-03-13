/**
 * MCP Streamable HTTP Transport Router
 *
 * Implements the Model Context Protocol (MCP) Streamable HTTP transport
 * for GPT developer mode connectors (and any MCP client using HTTP).
 *
 * Protocol:
 *   - POST /mcp: JSON-RPC messages (initialize, tools/list, tools/call, notifications/*)
 *   - GET  /mcp: Server-initiated notifications via SSE
 *   - DELETE /mcp: Terminate session
 *   - Session management via Mcp-Session-Id header
 *
 * Security:
 *   - JWT verification via jwt.verify() (not jwt.decode())
 *   - Session auth binding (token must match session's agent)
 *   - API keys resolved server-side only (never stored in session)
 *   - Rate limiting
 *   - SSE max duration with auto-cleanup
 *   - LRU eviction when MAX_SESSIONS reached
 *   - Generic error messages to clients
 *   - CORS locked to FRONTEND_URL on SSE
 *
 * Tool definitions and execution imported from shared mcp-tools.ts.
 * Auth utilities imported from shared mcp-auth.ts.
 */

import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import { logger } from '../lib/logger.js';
import { MCP_TOOLS, executeMcpTool } from '../lib/mcp-tools.js';
import {
  extractBearerToken,
  verifyMcpAccessToken,
  getAgentApiKey,
} from '../lib/mcp-auth.js';

const router = Router();

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_SESSIONS = 10_000;
const SESSION_TIMEOUT = 60 * 60 * 1000;
const CLEANUP_INTERVAL = 15 * 60 * 1000;
const SSE_MAX_DURATION = 5 * 60 * 1000;

// ---------------------------------------------------------------------------
// Rate limiter
// ---------------------------------------------------------------------------

const mcpRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: { jsonrpc: '2.0', error: { code: -32000, message: 'Rate limit exceeded' }, id: null },
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  skip: () => process.env.NODE_ENV === 'test',
});

// ---------------------------------------------------------------------------
// Session store — only agentId, never API key
// ---------------------------------------------------------------------------

interface McpSession {
  createdAt: Date;
  lastActivityAt: Date;
  agentId: string;
}

const activeSessions = new Map<string, McpSession>();

setInterval(() => {
  const now = Date.now();
  let cleaned = 0;
  for (const [sessionId, session] of activeSessions.entries()) {
    if (now - session.lastActivityAt.getTime() > SESSION_TIMEOUT) {
      activeSessions.delete(sessionId);
      cleaned++;
    }
  }
  if (cleaned > 0) logger.info({ cleaned }, 'Cleaned up stale MCP sessions');
}, CLEANUP_INTERVAL);

// ---------------------------------------------------------------------------
// Session helpers
// ---------------------------------------------------------------------------

function createSession(agentId: string): string {
  // LRU eviction
  if (activeSessions.size >= MAX_SESSIONS) {
    let oldestKey: string | undefined;
    let oldestTime = Infinity;
    for (const [k, v] of activeSessions) {
      if (v.lastActivityAt.getTime() < oldestTime) {
        oldestTime = v.lastActivityAt.getTime();
        oldestKey = k;
      }
    }
    if (oldestKey) {
      activeSessions.delete(oldestKey);
      logger.info({ evictedSessionId: oldestKey }, 'Evicted oldest MCP session');
    }
  }

  const sessionId = `session_${crypto.randomBytes(16).toString('hex')}`;
  const now = new Date();
  activeSessions.set(sessionId, { createdAt: now, lastActivityAt: now, agentId });
  logger.info({ sessionId, agentId }, 'Created MCP session');
  return sessionId;
}

async function getOrCreateSession(req: Request): Promise<{ sessionId: string; agentId: string } | null> {
  const sessionIdFromHeader = req.headers['mcp-session-id'] as string | undefined;
  const authHeader = req.headers['authorization'];
  const token = extractBearerToken(authHeader);

  if (sessionIdFromHeader) {
    const session = activeSessions.get(sessionIdFromHeader);
    if (session) {
      if (token) {
        const tokenInfo = verifyMcpAccessToken(token);
        if (!tokenInfo || tokenInfo.agentId !== session.agentId) return null;
      }
      session.lastActivityAt = new Date();
      return { sessionId: sessionIdFromHeader, agentId: session.agentId };
    }
  }

  if (!token) return null;
  const tokenInfo = verifyMcpAccessToken(token);
  if (!tokenInfo) return null;

  const sessionId = createSession(tokenInfo.agentId);
  return { sessionId, agentId: tokenInfo.agentId };
}

// ---------------------------------------------------------------------------
// POST /mcp — JSON-RPC messages
// ---------------------------------------------------------------------------

router.post('/mcp', mcpRateLimiter, async (req: Request, res: Response) => {
  try {
    const sessionInfo = await getOrCreateSession(req);
    if (!sessionInfo) {
      return res.status(401).json({
        jsonrpc: '2.0',
        error: { code: -32000, message: 'Unauthorized' },
        id: req.body?.id ?? null,
      });
    }

    const { jsonrpc, method, params, id } = req.body;

    if (jsonrpc !== '2.0' || !method) {
      return res.status(400).json({
        jsonrpc: '2.0',
        error: { code: -32600, message: 'Invalid Request' },
        id: id ?? null,
      });
    }

    logger.info({ sessionId: sessionInfo.sessionId, method, agentId: sessionInfo.agentId }, 'MCP request');

    let result: unknown;

    switch (method) {
      case 'initialize': {
        result = {
          protocolVersion: '2024-11-05',
          capabilities: {},
          serverInfo: { name: 'Human Pages MCP Server', version: '1.0.0' },
        };
        break;
      }

      case 'notifications/initialized': {
        return res.status(204).send();
      }

      case 'tools/list': {
        result = { tools: Object.values(MCP_TOOLS) };
        break;
      }

      case 'tools/call': {
        const { name, arguments: toolArgs } = (params || {}) as {
          name: string;
          arguments: Record<string, unknown>;
        };

        if (!MCP_TOOLS[name]) {
          return res.status(400).json({
            jsonrpc: '2.0',
            error: { code: -32601, message: 'Unknown tool' },
            id,
          });
        }

        const agentApiKey = getAgentApiKey(sessionInfo.agentId);
        if (!agentApiKey) {
          return res.status(401).json({
            jsonrpc: '2.0',
            error: { code: -32000, message: 'Agent session expired. Please re-authorize.' },
            id,
          });
        }

        try {
          const toolResult = await executeMcpTool(name, toolArgs || {}, agentApiKey);
          result = {
            content: [{ type: 'text', text: JSON.stringify(toolResult) }],
          };
        } catch {
          return res.status(500).json({
            jsonrpc: '2.0',
            error: { code: -32603, message: 'Tool execution failed' },
            id,
          });
        }
        break;
      }

      default:
        return res.status(400).json({
          jsonrpc: '2.0',
          error: { code: -32601, message: 'Method not found' },
          id,
        });
    }

    res.set('Mcp-Session-Id', sessionInfo.sessionId);
    return res.json({ jsonrpc: '2.0', result, id });
  } catch (error) {
    logger.error({ error }, 'MCP POST error');
    return res.status(500).json({
      jsonrpc: '2.0',
      error: { code: -32603, message: 'Internal server error' },
      id: req.body?.id ?? null,
    });
  }
});

// ---------------------------------------------------------------------------
// GET /mcp — SSE stream
// ---------------------------------------------------------------------------

router.get('/mcp', async (req: Request, res: Response) => {
  try {
    const sessionInfo = await getOrCreateSession(req);
    if (!sessionInfo) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const frontendUrl = process.env.FRONTEND_URL || 'https://humanpages.ai';
    res.set({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Mcp-Session-Id': sessionInfo.sessionId,
      'Access-Control-Allow-Origin': frontendUrl,
    });

    const maxDurationTimer = setTimeout(() => {
      res.write('event: close\ndata: max duration reached\n\n');
      res.end();
    }, SSE_MAX_DURATION);

    const keepAliveInterval = setInterval(() => {
      res.write(': keep-alive\n\n');
    }, 30 * 1000);

    res.on('close', () => {
      clearTimeout(maxDurationTimer);
      clearInterval(keepAliveInterval);
      logger.info({ sessionId: sessionInfo.sessionId }, 'MCP SSE stream closed');
    });

    logger.info({ sessionId: sessionInfo.sessionId }, 'MCP SSE stream opened');
  } catch (error) {
    logger.error({ error }, 'MCP GET error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// DELETE /mcp — Terminate session
// ---------------------------------------------------------------------------

router.delete('/mcp', async (req: Request, res: Response) => {
  try {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    if (!sessionId || !activeSessions.has(sessionId)) {
      return res.status(404).json({ error: 'Session not found' });
    }

    activeSessions.delete(sessionId);
    logger.info({ sessionId }, 'MCP session terminated');

    return res.status(204).send();
  } catch (error) {
    logger.error({ error }, 'MCP DELETE error');
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
