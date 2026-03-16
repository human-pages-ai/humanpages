/**
 * MCP Tool Registry — Shared tool definitions and execution logic.
 *
 * Used by both:
 *   - mcp-remote.ts (Streamable HTTP transport for GPT connectors)
 *   - Any future MCP transports (stdio, etc.)
 *
 * Tool execution resolves the agent's API key server-side via mcp-auth
 * and calls the Human Pages API with appropriate headers.
 *
 * Compliance: All tools include MCP annotations (readOnlyHint, destructiveHint,
 * idempotentHint, openWorldHint) as required by the ChatGPT App Directory.
 * Response minimization strips internal metadata before returning to clients.
 */

import { logger } from './logger.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FETCH_TIMEOUT = 10_000; // 10 seconds per upstream call

// ---------------------------------------------------------------------------
// Tool definitions (MCP schema with annotations)
// ---------------------------------------------------------------------------

export interface McpToolAnnotations {
  /** Tool only retrieves/reads data — does not create, update, or delete anything. */
  readOnlyHint?: boolean;
  /** Tool may permanently modify or delete data. */
  destructiveHint?: boolean;
  /** Calling this tool repeatedly with the same args produces no additional effect. */
  idempotentHint?: boolean;
  /** Tool interacts with external systems, accounts, or public platforms. */
  openWorldHint?: boolean;
}

export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations?: McpToolAnnotations;
}

export const MCP_TOOLS: Record<string, McpToolDefinition> = {
  search_humans: {
    name: 'search_humans',
    description:
      'Search the Human Pages directory for people by skill, location, or availability. ' +
      'Returns a list of matching profiles with name, skills, location, and availability status. ' +
      'Use this to find the right person for a task or project.',
    inputSchema: {
      type: 'object',
      properties: {
        skill: {
          type: 'string',
          description: 'Skill or expertise to search for (e.g. "React developer", "copywriter")',
        },
        location: {
          type: 'string',
          description: 'Geographic location to filter by (e.g. "New York", "Remote")',
        },
        available_only: {
          type: 'boolean',
          description: 'If true, only return people currently marked as available',
        },
      },
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },

  get_human: {
    name: 'get_human',
    description:
      'Retrieve public information about a specific person by their ID. ' +
      'Returns name, skills, location, availability, and a brief bio.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'The unique Human Pages ID of the person to look up' },
      },
      required: ['id'],
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },

  get_human_profile: {
    name: 'get_human_profile',
    description:
      'Retrieve the full authenticated profile of a person, including contact details ' +
      'and extended bio. Requires agent authentication — use this after search_humans ' +
      'when you need complete profile data to initiate contact.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'The unique Human Pages ID of the person' },
      },
      required: ['id'],
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },

  register_agent: {
    name: 'register_agent',
    description:
      'Register a new AI agent on Human Pages. Creates a persistent agent identity ' +
      'that can post jobs and interact with people on the platform.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Display name for the agent (e.g. "Acme Hiring Bot")' },
        description: { type: 'string', description: 'One-sentence summary of what this agent does' },
      },
      required: ['name'],
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
  },

  get_agent: {
    name: 'get_agent',
    description:
      'Retrieve information about a registered agent by ID. ' +
      'Returns the agent\'s name, description, and registration details.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'The unique agent ID to look up' },
      },
      required: ['id'],
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },

  create_job: {
    name: 'create_job',
    description:
      'Post a new job listing on Human Pages. The job becomes visible to people ' +
      'on the platform who match the required skills. Requires a title and description; ' +
      'skills and budget are optional.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Job title (e.g. "Senior React Developer needed")' },
        description: { type: 'string', description: 'Detailed job description with requirements and scope' },
        required_skills: {
          type: 'array',
          items: { type: 'string' },
          maxItems: 10,
          description: 'List of skills required for this job, max 10 (e.g. ["React", "TypeScript"])',
        },
        budget: { type: 'number', description: 'Budget in USD for the job' },
      },
      required: ['title', 'description'],
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
  },

  browse_listings: {
    name: 'browse_listings',
    description:
      'Browse service and product listings on Human Pages. Returns a paginated list ' +
      'of available offerings. Optionally filter by category.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Number of listings to return (default: 10, max: 50)' },
        offset: { type: 'number', description: 'Pagination offset (default: 0)' },
        category: { type: 'string', description: 'Filter by category (e.g. "design", "development")' },
      },
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },

  create_listing: {
    name: 'create_listing',
    description:
      'Create a new service or product listing on Human Pages. The listing becomes ' +
      'publicly visible on the marketplace. Requires title, description, and category.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Listing title (e.g. "Logo Design Package")' },
        description: { type: 'string', description: 'Detailed description of the service or product' },
        category: { type: 'string', description: 'Listing category (e.g. "design", "development", "writing")' },
        price: { type: 'number', description: 'Price in USD' },
      },
      required: ['title', 'description', 'category'],
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
  },

  ping: {
    name: 'ping',
    description: 'Check whether the Human Pages MCP server is reachable and responding.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
};

// ---------------------------------------------------------------------------
// Fetch with timeout
// ---------------------------------------------------------------------------

async function apiFetch(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Response minimization
// ---------------------------------------------------------------------------

/**
 * Fields to strip from upstream API responses before returning to MCP clients.
 * OpenAI's App Directory guidelines require responses to exclude diagnostic,
 * telemetry, and internal metadata that isn't relevant to the user's request.
 */
const STRIPPED_METADATA_FIELDS = new Set([
  // Timing / telemetry
  'timestamp', 'requestId', 'request_id', 'traceId', 'trace_id',
  'correlationId', 'correlation_id',
  // Internal diagnostics
  'duration', 'durationMs', 'duration_ms', 'latency',
  'serverVersion', 'server_version', 'apiVersion', 'api_version',
  // Session / debug info (should never leak to clients)
  'sessionId', 'session_id', 'internalId', 'internal_id',
  'debugInfo', 'debug_info', 'stackTrace', 'stack_trace',
]);

/**
 * Recursively strip internal metadata from upstream API responses.
 * Returns a new object with stripped fields removed at all nesting levels.
 */
export function minimizeResponse(data: unknown): unknown {
  if (data === null || data === undefined) return data;

  if (Array.isArray(data)) {
    return data.map(minimizeResponse);
  }

  if (typeof data === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      if (!STRIPPED_METADATA_FIELDS.has(key)) {
        result[key] = minimizeResponse(value);
      }
    }
    return result;
  }

  return data;
}

// ---------------------------------------------------------------------------
// Tool execution
// ---------------------------------------------------------------------------

/**
 * Execute a named MCP tool against the Human Pages API.
 *
 * @param toolName - one of the keys in MCP_TOOLS
 * @param args     - tool arguments from the client
 * @param agentApiKey - resolved API key for X-Agent-Key header
 */
export async function executeMcpTool(
  toolName: string,
  args: Record<string, unknown>,
  agentApiKey: string,
): Promise<unknown> {
  const baseUrl = process.env.HUMAN_PAGES_API_URL || 'https://humanpages.ai';

  try {
    switch (toolName) {
      case 'search_humans': {
        const params = new URLSearchParams();
        if (args.skill) params.set('skill', String(args.skill));
        if (args.location) params.set('location', String(args.location));
        if (args.available_only) params.set('available_only', String(args.available_only));
        const res = await apiFetch(`${baseUrl}/api/humans/search?${params}`, {
          headers: { 'X-Agent-Key': agentApiKey },
        });
        if (!res.ok) throw new Error(`Upstream error`);
        return minimizeResponse(await res.json());
      }

      case 'get_human': {
        const res = await apiFetch(`${baseUrl}/api/humans/${args.id}`, {
          headers: { 'X-Agent-Key': agentApiKey },
        });
        if (!res.ok) throw new Error(`Upstream error`);
        return minimizeResponse(await res.json());
      }

      case 'get_human_profile': {
        const res = await apiFetch(`${baseUrl}/api/humans/${args.id}/profile`, {
          headers: { 'X-Agent-Key': agentApiKey },
        });
        if (!res.ok) throw new Error(`Upstream error`);
        return minimizeResponse(await res.json());
      }

      case 'register_agent': {
        const res = await apiFetch(`${baseUrl}/api/agents/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Agent-Key': agentApiKey },
          body: JSON.stringify({
            name: args.name,
            description: args.description,
          }),
        });
        if (!res.ok) throw new Error(`Upstream error`);
        return minimizeResponse(await res.json());
      }

      case 'get_agent': {
        const res = await apiFetch(`${baseUrl}/api/agents/${args.id}`, {
          headers: { 'X-Agent-Key': agentApiKey },
        });
        if (!res.ok) throw new Error(`Upstream error`);
        return minimizeResponse(await res.json());
      }

      case 'create_job': {
        const res = await apiFetch(`${baseUrl}/api/jobs`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Agent-Key': agentApiKey },
          body: JSON.stringify({
            title: args.title,
            description: args.description,
            required_skills: args.required_skills,
            budget: args.budget,
          }),
        });
        if (!res.ok) throw new Error(`Upstream error`);
        return minimizeResponse(await res.json());
      }

      case 'browse_listings': {
        const qp = new URLSearchParams();
        qp.set('limit', String(Math.min(Number(args.limit) || 10, 50)));
        qp.set('offset', String(args.offset ?? 0));
        if (args.category) qp.set('category', String(args.category));
        const res = await apiFetch(`${baseUrl}/api/listings?${qp}`, {
          headers: { 'X-Agent-Key': agentApiKey },
        });
        if (!res.ok) throw new Error(`Upstream error`);
        return minimizeResponse(await res.json());
      }

      case 'create_listing': {
        const res = await apiFetch(`${baseUrl}/api/listings`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Agent-Key': agentApiKey },
          body: JSON.stringify({
            title: args.title,
            description: args.description,
            category: args.category,
            price: args.price,
          }),
        });
        if (!res.ok) throw new Error(`Upstream error`);
        return minimizeResponse(await res.json());
      }

      case 'ping':
        return { status: 'ok' };

      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  } catch (error) {
    logger.error({ error, tool: toolName }, 'MCP tool execution failed');
    return { error: 'Tool execution failed' };
  }
}
