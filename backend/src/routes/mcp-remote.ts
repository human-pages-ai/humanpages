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
import { MCP_TOOLS, executeMcpTool, type McpToolContext } from '../lib/mcp-tools.js';
import {
  extractBearerToken,
  verifyMcpAccessToken,
  getAgentApiKey,
} from '../lib/mcp-auth.js';
import { trackServerEvent } from '../lib/posthog.js';

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
  handler: (req: Request, res: Response) => {
    trackServerEvent('anonymous', 'mcp_rate_limit_hit', {
      endpoint: 'mcp_post',
    }, req);
    res.status(429).json({ jsonrpc: '2.0', error: { code: -32000, message: 'Rate limit exceeded' }, id: null });
  },
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
  // Session-level funnel tracking
  clientInfo?: { name?: string; version?: string; platform?: string };
  toolCallSequence: string[];
  toolCallCount: number;
  searchQueries: { skill?: string; location?: string; resultCount?: number; timestamp: Date }[];
  viewedHumanIds: string[];
  jobsCreated: string[];
  lastToolCalledAt?: Date;
  errorsEncountered: number;
}

const activeSessions = new Map<string, McpSession>();

setInterval(() => {
  const now = Date.now();
  let cleaned = 0;
  for (const [sessionId, session] of activeSessions.entries()) {
    if (now - session.lastActivityAt.getTime() > SESSION_TIMEOUT) {
      const duration = now - session.createdAt.getTime();
      trackServerEvent(session.agentId, 'mcp_session_ended', {
        session_id: sessionId,
        duration_ms: duration,
        reason: 'timeout',
        tool_calls: session.toolCallCount,
        tools_used: [...new Set(session.toolCallSequence)],
        searches: session.searchQueries.length,
        profiles_viewed: session.viewedHumanIds.length,
        jobs_created: session.jobsCreated.length,
        errors: session.errorsEncountered,
        funnel_stage: session.jobsCreated.length > 0 ? 'hired' :
          session.viewedHumanIds.length > 0 ? 'viewed_profiles' :
          session.searchQueries.length > 0 ? 'searched' :
          session.toolCallCount > 0 ? 'used_tools' : 'idle',
      });
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
  activeSessions.set(sessionId, {
    createdAt: now,
    lastActivityAt: now,
    agentId,
    toolCallSequence: [],
    toolCallCount: 0,
    searchQueries: [],
    viewedHumanIds: [],
    jobsCreated: [],
    errorsEncountered: 0,
  });
  trackServerEvent(agentId, 'mcp_session_started', {
    session_id: sessionId,
  });
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
      trackServerEvent('anonymous', 'mcp_auth_rejected', {
        reason: 'invalid_session_or_token',
        has_session_header: !!req.headers['mcp-session-id'],
        has_auth_header: !!req.headers['authorization'],
      }, req);
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
          protocolVersion: '2025-06-18',
          capabilities: {
            tools: { listChanged: false },
          },
          serverInfo: { name: 'Human Pages MCP Server', version: '1.0.0' },
        };
        // Track client info from initialization params
        if (params?.clientInfo) {
          const session = activeSessions.get(sessionInfo.sessionId);
          if (session) {
            const ci = params.clientInfo as Record<string, unknown>;
            const name = String(ci.name || '').toLowerCase();
            let platform = 'custom';
            if (name.includes('chatgpt') || name.includes('openai') || name.includes('gpt')) platform = 'chatgpt';
            else if (name.includes('claude') || name.includes('anthropic')) platform = 'claude';
            else if (name.includes('gemini') || name.includes('google')) platform = 'gemini';
            else if (name.includes('cursor')) platform = 'cursor';
            else if (name.includes('copilot') || name.includes('github')) platform = 'copilot';
            session.clientInfo = {
              name: String(ci.name || ''),
              version: String(ci.version || ''),
              platform,
            };
            trackServerEvent(sessionInfo.agentId, 'mcp_session_initialized', {
              session_id: sessionInfo.sessionId,
              client_name: session.clientInfo.name,
              client_version: session.clientInfo.version,
              platform,
            });
          }
        }
        break;
      }

      case 'notifications/initialized': {
        return res.status(204).send();
      }

      case 'tools/list': {
        result = { tools: Object.values(MCP_TOOLS) };
        trackServerEvent(sessionInfo.agentId, 'mcp_tools_listed', {
          session_id: sessionInfo.sessionId,
          tool_count: Object.keys(MCP_TOOLS).length,
        });
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
          const session = activeSessions.get(sessionInfo.sessionId);
          const previousTool = session?.toolCallSequence[session.toolCallSequence.length - 1] || null;
          const sequenceNumber = (session?.toolCallCount || 0) + 1;
          const startTime = Date.now();

          // Build context for tool-level funnel tracking
          const toolContext: McpToolContext | undefined = session ? {
            sessionId: sessionInfo.sessionId,
            agentId: sessionInfo.agentId,
            platform: session.clientInfo?.platform,
            searchQueries: session.searchQueries,
            viewedHumanIds: session.viewedHumanIds,
            jobsCreated: session.jobsCreated,
          } : undefined;

          const toolResult = await executeMcpTool(name, toolArgs || {}, agentApiKey, toolContext);

          const latencyMs = Date.now() - startTime;

          // Update session funnel state (context arrays are shared references, already updated by tool)
          if (session) {
            session.toolCallSequence.push(name);
            session.toolCallCount++;
            session.lastToolCalledAt = new Date();
          }

          // Track every tool call with sequence context
          trackServerEvent(sessionInfo.agentId, 'mcp_tool_called', {
            session_id: sessionInfo.sessionId,
            tool_name: name,
            latency_ms: latencyMs,
            sequence_number: sequenceNumber,
            previous_tool: previousTool,
            platform: session?.clientInfo?.platform || 'unknown',
            // Funnel context at time of call
            searches_so_far: session?.searchQueries.length || 0,
            profiles_viewed_so_far: session?.viewedHumanIds.length || 0,
            jobs_created_so_far: session?.jobsCreated.length || 0,
          });

          result = {
            content: [{ type: 'text', text: JSON.stringify(toolResult) }],
          };
        } catch {
          const session = activeSessions.get(sessionInfo.sessionId);
          if (session) session.errorsEncountered++;

          trackServerEvent(sessionInfo.agentId, 'mcp_tool_error', {
            session_id: sessionInfo.sessionId,
            tool_name: name,
            sequence_number: (session?.toolCallCount || 0) + 1,
            platform: session?.clientInfo?.platform || 'unknown',
          });

          return res.status(500).json({
            jsonrpc: '2.0',
            error: { code: -32603, message: 'Tool execution failed' },
            id,
          });
        }
        break;
      }

      default:
        trackServerEvent(sessionInfo.agentId, 'mcp_unknown_method', {
          session_id: sessionInfo.sessionId,
          method,
        }, req);
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

    res.set({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Mcp-Session-Id': sessionInfo.sessionId,
    });

    const maxDurationTimer = setTimeout(() => {
      trackServerEvent(sessionInfo.agentId, 'mcp_sse_max_duration', {
        session_id: sessionInfo.sessionId,
        duration_ms: SSE_MAX_DURATION,
      });
      res.write('event: close\ndata: max duration reached\n\n');
      res.end();
    }, SSE_MAX_DURATION);

    const keepAliveInterval = setInterval(() => {
      res.write(': keep-alive\n\n');
    }, 30 * 1000);

    res.on('close', () => {
      clearTimeout(maxDurationTimer);
      clearInterval(keepAliveInterval);
      trackServerEvent(sessionInfo.agentId, 'mcp_sse_disconnected', {
        session_id: sessionInfo.sessionId,
      });
      logger.info({ sessionId: sessionInfo.sessionId }, 'MCP SSE stream closed');
    });

    logger.info({ sessionId: sessionInfo.sessionId }, 'MCP SSE stream opened');
    trackServerEvent(sessionInfo.agentId, 'mcp_sse_connected', {
      session_id: sessionInfo.sessionId,
    });
  } catch (error) {
    logger.error({ error }, 'MCP GET error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// DELETE /mcp — Terminate session
// ---------------------------------------------------------------------------

const deleteRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { error: 'Rate limit exceeded' },
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  skip: () => process.env.NODE_ENV === 'test',
});

router.delete('/mcp', deleteRateLimiter, async (req: Request, res: Response) => {
  try {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    if (!sessionId) {
      return res.status(400).json({ error: 'Missing session ID' });
    }

    const session = activeSessions.get(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Verify the caller owns this session
    const token = extractBearerToken(req.headers['authorization']);
    if (token) {
      const tokenInfo = verifyMcpAccessToken(token);
      if (!tokenInfo || tokenInfo.agentId !== session.agentId) {
        return res.status(403).json({ error: 'Forbidden' });
      }
    }

    const duration = Date.now() - session.createdAt.getTime();
    trackServerEvent(session.agentId, 'mcp_session_ended', {
      session_id: sessionId,
      duration_ms: duration,
      reason: 'client_terminated',
      tool_calls: session.toolCallCount,
      tools_used: [...new Set(session.toolCallSequence)],
      searches: session.searchQueries.length,
      profiles_viewed: session.viewedHumanIds.length,
      jobs_created: session.jobsCreated.length,
      errors: session.errorsEncountered,
      funnel_stage: session.jobsCreated.length > 0 ? 'hired' :
        session.viewedHumanIds.length > 0 ? 'viewed_profiles' :
        session.searchQueries.length > 0 ? 'searched' :
        session.toolCallCount > 0 ? 'used_tools' : 'idle',
    });

    activeSessions.delete(sessionId);
    logger.info({ sessionId }, 'MCP session terminated');

    return res.status(204).send();
  } catch (error) {
    logger.error({ error }, 'MCP DELETE error');
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
