/**
 * MCP Tool Registry — Shared tool definitions and execution logic.
 *
 * Used by both:
 *   - mcp-remote.ts (Streamable HTTP transport for GPT connectors)
 *   - Any future MCP transports (stdio, etc.)
 *
 * Tool execution resolves the agent's API key server-side via mcp-auth
 * and calls the Human Pages API with appropriate headers.
 */

import { logger } from './logger.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FETCH_TIMEOUT = 10_000; // 10 seconds per upstream call

// ---------------------------------------------------------------------------
// Tool definitions (MCP schema)
// ---------------------------------------------------------------------------

export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export const MCP_TOOLS: Record<string, McpToolDefinition> = {
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
  const baseUrl = process.env.HUMAN_PAGES_API_URL || 'https://api.humanpages.ai';

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
        return await res.json();
      }

      case 'get_human': {
        const res = await apiFetch(`${baseUrl}/api/humans/${args.id}`, {
          headers: { 'X-Agent-Key': agentApiKey },
        });
        if (!res.ok) throw new Error(`Upstream error`);
        return await res.json();
      }

      case 'get_human_profile': {
        const res = await apiFetch(`${baseUrl}/api/humans/${args.id}/profile`, {
          headers: { 'X-Agent-Key': agentApiKey },
        });
        if (!res.ok) throw new Error(`Upstream error`);
        return await res.json();
      }

      case 'register_agent': {
        const res = await apiFetch(`${baseUrl}/api/agents/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Agent-Key': agentApiKey },
          body: JSON.stringify({
            name: args.name,
            description: args.description,
            website_url: args.website_url,
            contact_email: args.contact_email,
          }),
        });
        if (!res.ok) throw new Error(`Upstream error`);
        return await res.json();
      }

      case 'get_agent': {
        const res = await apiFetch(`${baseUrl}/api/agents/${args.id}`, {
          headers: { 'X-Agent-Key': agentApiKey },
        });
        if (!res.ok) throw new Error(`Upstream error`);
        return await res.json();
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
        return await res.json();
      }

      case 'browse_listings': {
        const qp = new URLSearchParams();
        qp.set('limit', String(args.limit ?? 10));
        qp.set('offset', String(args.offset ?? 0));
        if (args.category) qp.set('category', String(args.category));
        const res = await apiFetch(`${baseUrl}/api/listings?${qp}`, {
          headers: { 'X-Agent-Key': agentApiKey },
        });
        if (!res.ok) throw new Error(`Upstream error`);
        return await res.json();
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
        return await res.json();
      }

      case 'ping':
        return { status: 'ok', service: 'humans-api', timestamp: new Date().toISOString() };

      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  } catch (error) {
    logger.error({ error, tool: toolName }, 'MCP tool execution failed');
    return { error: 'Tool execution failed', tool: toolName };
  }
}
