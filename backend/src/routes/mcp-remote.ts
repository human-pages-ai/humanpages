/**
 * MCP Streamable HTTP Transport Router
 *
 * Implements the Model Context Protocol (MCP) Streamable HTTP transport
 * to make the Human Pages MCP server compatible with GPT developer mode connectors.
 *
 * Protocol:
 * - POST /mcp: JSON-RPC messages (initialize, tools/list, tools/call)
 * - GET /mcp: Server-initiated notifications via SSE
 * - DELETE /mcp: Terminate session
 * - Session management via Mcp-Session-Id header
 */

import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { logger } from '../lib/logger.js';

const router = Router();

/**
 * Session storage: Map<sessionId, { server: McpServer, transport: StreamableHTTPServerTransport }>
 * In production, this could use Redis or a database for multi-instance deployments.
 */
const activeSessions = new Map<string, {
  createdAt: Date;
  lastActivityAt: Date;
  agentId: string;
  agentApiKey: string;
}>();

// Session cleanup interval: remove stale sessions after 1 hour of inactivity
const SESSION_TIMEOUT = 60 * 60 * 1000; // 1 hour
const CLEANUP_INTERVAL = 15 * 60 * 1000; // 15 minutes

setInterval(() => {
  const now = Date.now();
  let cleaned = 0;

  for (const [sessionId, session] of activeSessions.entries()) {
    if (now - session.lastActivityAt.getTime() > SESSION_TIMEOUT) {
      activeSessions.delete(sessionId);
      cleaned++;
    }
  }

  if (cleaned > 0) {
    logger.info({ cleaned }, 'Cleaned up stale MCP sessions');
  }
}, CLEANUP_INTERVAL);

/**
 * Extract and validate Bearer token from Authorization header.
 * Returns the token or null if invalid/missing.
 */
function extractBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader) return null;
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
}

/**
 * Look up agent API key from OAuth token.
 * In a real implementation, this would query the database or cache.
 * For now, we assume the token encodes the agent ID and the agent has an API key.
 */
async function getAgentApiKeyFromToken(token: string): Promise<{ agentId: string; apiKey: string } | null> {
  try {
    // Decode JWT token (issued by the MCP OAuth endpoint)
    const payload = jwt.decode(token) as Record<string, unknown> | null;
    if (!payload || typeof payload.agentId !== 'string' || typeof payload.apiKey !== 'string') {
      return null;
    }
    return {
      agentId: payload.agentId,
      apiKey: payload.apiKey,
    };
  } catch {
    return null;
  }
}

/**
 * Create a new MCP session.
 * Each session gets a unique ID and stores the agent's API key for tool calls.
 */
function createSession(agentId: string, agentApiKey: string): string {
  const sessionId = `session_${crypto.randomBytes(16).toString('hex')}`;
  const now = new Date();

  activeSessions.set(sessionId, {
    createdAt: now,
    lastActivityAt: now,
    agentId,
    agentApiKey,
  });

  logger.info({ sessionId, agentId }, 'Created MCP session');
  return sessionId;
}

/**
 * Get or create an MCP session from the request.
 * - If Mcp-Session-Id header exists and is valid, return it
 * - Otherwise, create a new session from the Authorization token
 */
async function getOrCreateSession(req: Request): Promise<{ sessionId: string; agentId: string; apiKey: string } | null> {
  const sessionIdFromHeader = req.headers['mcp-session-id'] as string | undefined;
  const authHeader = req.headers['authorization'];

  // Check for existing session
  if (sessionIdFromHeader) {
    const session = activeSessions.get(sessionIdFromHeader);
    if (session) {
      session.lastActivityAt = new Date();
      return {
        sessionId: sessionIdFromHeader,
        agentId: session.agentId,
        apiKey: session.agentApiKey,
      };
    }
  }

  // Create new session from auth token
  const token = extractBearerToken(authHeader);
  if (!token) {
    return null;
  }

  const tokenInfo = await getAgentApiKeyFromToken(token);
  if (!tokenInfo) {
    return null;
  }

  const sessionId = createSession(tokenInfo.agentId, tokenInfo.apiKey);
  return {
    sessionId,
    agentId: tokenInfo.agentId,
    apiKey: tokenInfo.apiKey,
  };
}

/**
 * Tool registry: maps tool names to their implementations.
 * Each tool makes an HTTP call to the Human Pages API.
 */
const TOOLS = {
  search_humans: {
    name: 'search_humans',
    description: 'Search for available humans by skill, location, or availability',
    inputSchema: {
      type: 'object',
      properties: {
        skill: { type: 'string', description: 'Skill to search for (optional)' },
        location: { type: 'string', description: 'Location to filter by (optional)' },
        available_only: { type: 'boolean', description: 'Show only available humans (default: false)' },
      },
    },
  },
  get_human: {
    name: 'get_human',
    description: 'Get detailed information about a specific human',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Human ID' },
      },
      required: ['id'],
    },
  },
  get_human_profile: {
    name: 'get_human_profile',
    description: 'Get the full profile of a human (requires agent authentication)',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Human ID' },
      },
      required: ['id'],
    },
  },
  register_agent: {
    name: 'register_agent',
    description: 'Register a new agent',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Agent name' },
        description: { type: 'string', description: 'Agent description' },
        website_url: { type: 'string', description: 'Website URL (optional)' },
        contact_email: { type: 'string', description: 'Contact email (optional)' },
      },
      required: ['name'],
    },
  },
  get_agent: {
    name: 'get_agent',
    description: 'Get information about an agent',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Agent ID' },
      },
      required: ['id'],
    },
  },
  create_job: {
    name: 'create_job',
    description: 'Create a new job posting',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Job title' },
        description: { type: 'string', description: 'Job description' },
        required_skills: { type: 'array', items: { type: 'string' }, description: 'Required skills' },
        budget: { type: 'number', description: 'Budget for the job' },
      },
      required: ['title', 'description'],
    },
  },
  browse_listings: {
    name: 'browse_listings',
    description: 'Browse available listings',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Number of listings to return (default: 10)' },
        offset: { type: 'number', description: 'Offset for pagination (default: 0)' },
        category: { type: 'string', description: 'Filter by category (optional)' },
      },
    },
  },
  create_listing: {
    name: 'create_listing',
    description: 'Create a new listing for services or products',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Listing title' },
        description: { type: 'string', description: 'Listing description' },
        category: { type: 'string', description: 'Category' },
        price: { type: 'number', description: 'Price' },
      },
      required: ['title', 'description', 'category'],
    },
  },
  ping: {
    name: 'ping',
    description: 'Test server connectivity and get server status',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
};

/**
 * Execute a tool by making an HTTP call to the Human Pages API.
 */
async function executeTool(
  toolName: string,
  args: Record<string, unknown>,
  agentApiKey: string
): Promise<unknown> {
  const baseUrl = process.env.HUMAN_PAGES_API_URL || 'https://api.humanpages.ai';

  try {
    switch (toolName) {
      case 'search_humans': {
        const params = new URLSearchParams();
        if (args.skill) params.set('skill', String(args.skill));
        if (args.location) params.set('location', String(args.location));
        if (args.available_only) params.set('available_only', String(args.available_only));

        const response = await fetch(`${baseUrl}/api/humans/search?${params.toString()}`, {
          headers: { 'X-Agent-Key': agentApiKey },
        });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        return await response.json();
      }

      case 'get_human': {
        const response = await fetch(`${baseUrl}/api/humans/${args.id}`, {
          headers: { 'X-Agent-Key': agentApiKey },
        });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        return await response.json();
      }

      case 'get_human_profile': {
        const response = await fetch(`${baseUrl}/api/humans/${args.id}/profile`, {
          headers: { 'X-Agent-Key': agentApiKey },
        });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        return await response.json();
      }

      case 'register_agent': {
        const response = await fetch(`${baseUrl}/api/agents/register`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Agent-Key': agentApiKey,
          },
          body: JSON.stringify({
            name: args.name,
            description: args.description,
            website_url: args.website_url,
            contact_email: args.contact_email,
          }),
        });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        return await response.json();
      }

      case 'get_agent': {
        const response = await fetch(`${baseUrl}/api/agents/${args.id}`, {
          headers: { 'X-Agent-Key': agentApiKey },
        });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        return await response.json();
      }

      case 'create_job': {
        const response = await fetch(`${baseUrl}/api/jobs`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Agent-Key': agentApiKey,
          },
          body: JSON.stringify({
            title: args.title,
            description: args.description,
            required_skills: args.required_skills,
            budget: args.budget,
          }),
        });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        return await response.json();
      }

      case 'browse_listings': {
        const queryParams = new URLSearchParams();
        queryParams.set('limit', String(args.limit ?? 10));
        queryParams.set('offset', String(args.offset ?? 0));
        if (args.category) queryParams.set('category', String(args.category));

        const response = await fetch(`${baseUrl}/api/listings?${queryParams.toString()}`, {
          headers: { 'X-Agent-Key': agentApiKey },
        });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        return await response.json();
      }

      case 'create_listing': {
        const response = await fetch(`${baseUrl}/api/listings`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Agent-Key': agentApiKey,
          },
          body: JSON.stringify({
            title: args.title,
            description: args.description,
            category: args.category,
            price: args.price,
          }),
        });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        return await response.json();
      }

      case 'ping': {
        return { status: 'ok', service: 'humans-api', timestamp: new Date().toISOString() };
      }

      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  } catch (error) {
    logger.error({ error, tool: toolName }, 'Tool execution failed');
    return {
      error: error instanceof Error ? error.message : 'Unknown error',
      tool: toolName,
    };
  }
}

/**
 * POST /mcp
 * Handles JSON-RPC messages from MCP clients.
 * Implements MCP initialize, tools/list, and tools/call operations.
 */
router.post('/mcp', async (req, res) => {
  try {
    const sessionInfo = await getOrCreateSession(req);
    if (!sessionInfo) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { jsonrpc, method, params, id } = req.body;

    // Validate JSON-RPC structure
    if (jsonrpc !== '2.0' || !method) {
      return res.status(400).json({
        jsonrpc: '2.0',
        error: { code: -32600, message: 'Invalid Request' },
        id: id ?? null,
      });
    }

    logger.info(
      { sessionId: sessionInfo.sessionId, method, agentId: sessionInfo.agentId },
      'MCP request'
    );

    let result: unknown;

    switch (method) {
      case 'initialize': {
        // Respond with server info and available tools
        result = {
          protocolVersion: '2024-11-05',
          capabilities: {},
          serverInfo: {
            name: 'Human Pages MCP Server',
            version: '1.0.0',
          },
        };
        break;
      }

      case 'tools/list': {
        // Return available tools
        result = {
          tools: Object.values(TOOLS),
        };
        break;
      }

      case 'tools/call': {
        // Execute the requested tool
        const { name, arguments: toolArgs } = params as {
          name: string;
          arguments: Record<string, unknown>;
        };

        if (!TOOLS[name as keyof typeof TOOLS]) {
          return res.status(400).json({
            jsonrpc: '2.0',
            error: { code: -32601, message: `Unknown tool: ${name}` },
            id,
          });
        }

        try {
          const toolResult = await executeTool(name, toolArgs, sessionInfo.apiKey);
          result = {
            content: [
              {
                type: 'text',
                text: JSON.stringify(toolResult),
              },
            ],
          };
        } catch (error) {
          return res.status(400).json({
            jsonrpc: '2.0',
            error: {
              code: -32603,
              message: error instanceof Error ? error.message : 'Tool execution failed',
            },
            id,
          });
        }
        break;
      }

      default:
        return res.status(400).json({
          jsonrpc: '2.0',
          error: { code: -32601, message: `Unknown method: ${method}` },
          id,
        });
    }

    // Return JSON-RPC response
    res.set('Mcp-Session-Id', sessionInfo.sessionId);
    return res.json({
      jsonrpc: '2.0',
      result,
      id,
    });
  } catch (error) {
    logger.error({ error }, 'MCP POST error');
    return res.status(500).json({
      jsonrpc: '2.0',
      error: { code: -32603, message: 'Internal server error' },
      id: req.body?.id ?? null,
    });
  }
});

/**
 * GET /mcp
 * Server-Sent Events stream for server-initiated notifications.
 * In a full implementation, this would stream tool calls and updates to the client.
 */
router.get('/mcp', async (req, res) => {
  try {
    const sessionInfo = await getOrCreateSession(req);
    if (!sessionInfo) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Set up SSE headers
    res.set({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Mcp-Session-Id': sessionInfo.sessionId,
    });

    // Allow CORS for SSE
    res.set('Access-Control-Allow-Origin', '*');

    // Send a keep-alive comment every 30 seconds
    const keepAliveInterval = setInterval(() => {
      res.write(': keep-alive\n\n');
    }, 30 * 1000);

    // Clean up on client disconnect
    res.on('close', () => {
      clearInterval(keepAliveInterval);
      logger.info({ sessionId: sessionInfo.sessionId }, 'MCP SSE stream closed');
    });

    logger.info({ sessionId: sessionInfo.sessionId }, 'MCP SSE stream opened');
  } catch (error) {
    logger.error({ error }, 'MCP GET error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /mcp
 * Terminate an MCP session and clean up resources.
 */
router.delete('/mcp', async (req, res) => {
  try {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;

    if (!sessionId || !activeSessions.has(sessionId)) {
      return res.status(404).json({ error: 'Session not found' });
    }

    activeSessions.delete(sessionId);
    logger.info({ sessionId }, 'MCP session terminated');

    return res.json({ success: true });
  } catch (error) {
    logger.error({ error }, 'MCP DELETE error');
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
