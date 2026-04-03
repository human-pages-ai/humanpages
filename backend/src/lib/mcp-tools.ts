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
import { trackServerEvent } from './posthog.js';

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

/** Session context passed from mcp-remote for funnel tracking */
export interface McpToolContext {
  sessionId: string;
  agentId: string;
  platform?: string;
  searchQueries: { skill?: string; location?: string; resultCount?: number; timestamp: Date }[];
  viewedHumanIds: string[];
  jobsCreated: string[];
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
        timezone: {
          type: 'string',
          description:
            'IANA timezone filter (e.g. "America/New_York", "Asia/Tokyo"). ' +
            'Use this to find people in a specific timezone for scheduling or overlap.',
        },
        min_capacity: {
          type: 'number',
          description:
            'Minimum weekly hours available. Common values: 5 (side hustle), 10 (part-time light), ' +
            '20 (part-time), 30 (near full-time), 40 (full-time). ' +
            'Use this to filter out people who can\'t commit enough hours to your task.',
        },
        response_time: {
          type: 'string',
          enum: ['within_1h', 'within_4h', 'within_24h', 'flexible'],
          description:
            'Maximum acceptable response time. "within_1h" = urgent tasks, "within_4h" = same-day, ' +
            '"within_24h" = next-day, "flexible" = no SLA. Agents should match this to task urgency.',
        },
        work_type: {
          type: 'string',
          enum: ['digital', 'physical', 'both'],
          description:
            'Type of work: "digital" for remote/online tasks, "physical" for on-site tasks, ' +
            '"both" for people open to either. Physical tasks also need a location filter.',
        },
        min_experience: {
          type: 'number',
          description:
            'Minimum years of professional experience. Use for tasks requiring seniority ' +
            '(e.g. 5 for mid-level, 10 for senior). Omit for entry-level tasks.',
        },
        industry: {
          type: 'string',
          description:
            'Industry/domain filter. Examples: "Healthcare", "Finance & Banking", "E-commerce & Retail", ' +
            '"Education", "Legal", "SaaS & Technology", "Real Estate". ' +
            'Use this when domain expertise matters (e.g. medical transcription, legal research).',
        },
        equipment: {
          type: 'string',
          description:
            'Required equipment filter. Examples: "DSLR Camera", "Drone", "Car/Vehicle", "Microphone". ' +
            'Use for physical tasks that need specific gear.',
        },
        schedule_pattern: {
          type: 'string',
          enum: ['morning', 'afternoon', 'evening', 'flexible'],
          description:
            'When the human is available: "morning" (6am-12pm local), "afternoon" (12pm-6pm local), ' +
            '"evening" (6pm-12am local), "flexible" (any time). Includes humans marked as "flexible".',
        },
        task_duration: {
          type: 'string',
          enum: ['micro', 'half_day', 'full_project', 'any'],
          description:
            'Preferred task length: "micro" (1-2 hours), "half_day" (3-5 hours), ' +
            '"full_project" (10+ hours), "any" (open to all). Includes humans marked as "any".',
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
 * @param context  - optional session context for funnel tracking
 */
export async function executeMcpTool(
  toolName: string,
  args: Record<string, unknown>,
  agentApiKey: string,
  context?: McpToolContext,
): Promise<unknown> {
  const baseUrl = process.env.HUMAN_PAGES_API_URL || 'https://humanpages.ai';

  try {
    switch (toolName) {
      case 'search_humans': {
        // Validate string param lengths
        const MAX_PARAM = 500;
        for (const key of ['skill', 'location', 'equipment', 'industry'] as const) {
          if (args[key] && String(args[key]).length > MAX_PARAM) {
            return { error: `${key} parameter exceeds maximum length of ${MAX_PARAM}` };
          }
        }
        if (args.timezone && String(args.timezone).length > 100) {
          return { error: 'timezone parameter exceeds maximum length' };
        }
        // Validate numeric params
        if (args.min_capacity !== undefined) {
          const val = Number(args.min_capacity);
          if (isNaN(val) || val < 0 || val > 168) return { error: 'min_capacity must be 0-168' };
        }
        if (args.min_experience !== undefined) {
          const val = Number(args.min_experience);
          if (isNaN(val) || val < 0 || val > 70) return { error: 'min_experience must be 0-70' };
        }
        // Validate skills array if provided (for future array-based searches)
        if (args.skills && Array.isArray(args.skills)) {
          if (args.skills.length > 10) return { error: 'skills array exceeds maximum length of 10' };
          for (let i = 0; i < args.skills.length; i++) {
            const skill = String(args.skills[i]);
            if (skill.length > 100) {
              return { error: `skills[${i}] exceeds maximum length of 100 characters` };
            }
          }
        }

        const params = new URLSearchParams();
        if (args.skill) params.set('skill', String(args.skill));
        if (args.location) params.set('location', String(args.location));
        if (args.available_only) params.set('available', 'true');
        if (args.timezone) params.set('timezone', String(args.timezone));
        if (args.min_capacity) params.set('minCapacity', String(args.min_capacity));
        if (args.response_time) params.set('responseTime', String(args.response_time));
        if (args.work_type) params.set('workType', String(args.work_type));
        if (args.min_experience) params.set('minExperience', String(args.min_experience));
        if (args.industry) params.set('industry', String(args.industry));
        if (args.equipment) params.set('equipment', String(args.equipment));
        if (args.schedule_pattern) params.set('schedulePattern', String(args.schedule_pattern));
        if (args.task_duration) params.set('taskDuration', String(args.task_duration));
        const res = await apiFetch(`${baseUrl}/api/humans/search?${params}`, {
          headers: { 'X-Agent-Key': agentApiKey },
        });
        if (!res.ok) throw new Error(`Upstream error`);
        const searchResult = minimizeResponse(await res.json()) as any;
        const resultCount = Array.isArray(searchResult?.humans) ? searchResult.humans.length :
                           Array.isArray(searchResult) ? searchResult.length : 0;

        // Update session context for funnel tracking
        if (context) {
          context.searchQueries.push({
            skill: args.skill ? String(args.skill) : undefined,
            location: args.location ? String(args.location) : undefined,
            resultCount,
            timestamp: new Date(),
          });
        }

        trackServerEvent(context?.agentId || 'anonymous', 'mcp_search_executed', {
          session_id: context?.sessionId,
          skill: args.skill ? String(args.skill) : undefined,
          location: args.location ? String(args.location) : undefined,
          result_count: resultCount,
          has_filters: !!(args.timezone || args.min_capacity || args.response_time || args.work_type || args.min_experience || args.industry || args.equipment),
          filters_used: Object.keys(args).filter(k => args[k] !== undefined && k !== 'skill' && k !== 'location'),
          platform: context?.platform,
          views_so_far: context?.viewedHumanIds.length || 0,
          jobs_so_far: context?.jobsCreated.length || 0,
        });

        return searchResult;
      }

      case 'get_human': {
        const res = await apiFetch(`${baseUrl}/api/humans/${args.id}`, {
          headers: { 'X-Agent-Key': agentApiKey },
        });
        if (!res.ok) throw new Error(`Upstream error`);
        const profile = minimizeResponse(await res.json());

        const humanId = String(args.id || '');
        if (context && humanId) {
          context.viewedHumanIds.push(humanId);
        }

        trackServerEvent(context?.agentId || 'anonymous', 'mcp_profile_viewed', {
          session_id: context?.sessionId,
          human_id: humanId,
          is_authenticated: false,
          view_type: 'public',
          platform: context?.platform,
          views_before_this: context?.viewedHumanIds.length ? context.viewedHumanIds.length - 1 : 0,
          searches_before_this: context?.searchQueries.length || 0,
          came_from_search: (context?.searchQueries.length || 0) > 0,
          last_search_skill: context?.searchQueries[context.searchQueries.length - 1]?.skill,
        });

        return profile;
      }

      case 'get_human_profile': {
        const res = await apiFetch(`${baseUrl}/api/humans/${args.id}/profile`, {
          headers: { 'X-Agent-Key': agentApiKey },
        });
        if (!res.ok) throw new Error(`Upstream error`);
        const profile = minimizeResponse(await res.json());

        const humanId = String(args.id || '');
        if (context && humanId && !context.viewedHumanIds.includes(humanId)) {
          context.viewedHumanIds.push(humanId);
        }

        trackServerEvent(context?.agentId || 'anonymous', 'mcp_profile_viewed', {
          session_id: context?.sessionId,
          human_id: humanId,
          is_authenticated: true,
          view_type: 'full_profile',
          platform: context?.platform,
          unique_profiles_viewed: context?.viewedHumanIds.length || 0,
          searches_before_this: context?.searchQueries.length || 0,
          came_from_search: (context?.searchQueries.length || 0) > 0,
          last_search_skill: context?.searchQueries[context.searchQueries.length - 1]?.skill,
        });

        return profile;
      }

      case 'register_agent': {
        const res = await apiFetch(`${baseUrl}/api/agents/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Agent-Key': agentApiKey },
          body: JSON.stringify({
            name: args.name,
            description: args.description,
            acceptTos: true,
          }),
        });
        if (!res.ok) throw new Error(`Upstream error`);
        const agentResult = minimizeResponse(await res.json());

        trackServerEvent(context?.agentId || 'anonymous', 'mcp_agent_registered_via_tool', {
          session_id: context?.sessionId,
          agent_name: args.name ? String(args.name) : undefined,
          platform: context?.platform,
        });

        return agentResult;
      }

      case 'get_agent': {
        const res = await apiFetch(`${baseUrl}/api/agents/${args.id}`, {
          headers: { 'X-Agent-Key': agentApiKey },
        });
        if (!res.ok) throw new Error(`Upstream error`);
        return minimizeResponse(await res.json());
      }

      case 'create_job': {
        const body: Record<string, unknown> = {
          humanId: args.humanId,
          title: args.title,
          description: args.description,
          priceUsdc: args.priceUsdc,
        };
        if (args.paymentMode !== undefined) body.paymentMode = args.paymentMode;
        if (args.paymentTiming !== undefined) body.paymentTiming = args.paymentTiming;
        if (args.streamMethod !== undefined) body.streamMethod = args.streamMethod;
        if (args.streamInterval !== undefined) body.streamInterval = args.streamInterval;
        if (args.streamRateUsdc !== undefined) body.streamRateUsdc = args.streamRateUsdc;
        if (args.callbackUrl !== undefined) body.callbackUrl = args.callbackUrl;
        if (args.callbackSecret !== undefined) body.callbackSecret = args.callbackSecret;
        if (args.category !== undefined) body.category = args.category;
        const res = await apiFetch(`${baseUrl}/api/jobs`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Agent-Key': agentApiKey },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error(`Upstream error`);
        const jobResult = minimizeResponse(await res.json()) as any;

        const jobId = jobResult?.id || jobResult?.job?.id || '';
        if (context && jobId) {
          context.jobsCreated.push(jobId);
        }

        // Calculate time from first search to hire
        const firstSearch = context?.searchQueries[0];
        const timeFromFirstSearchMs = firstSearch ? Date.now() - firstSearch.timestamp.getTime() : null;

        trackServerEvent(context?.agentId || 'anonymous', 'mcp_job_created', {
          session_id: context?.sessionId,
          job_id: jobId,
          human_id: args.humanId ? String(args.humanId) : undefined,
          price_usdc: args.priceUsdc || args.budget,
          has_callback: !!(args.callbackUrl),
          payment_mode: args.paymentMode ? String(args.paymentMode) : undefined,
          platform: context?.platform,
          // Full funnel context
          searches_before_hire: context?.searchQueries.length || 0,
          profiles_viewed_before_hire: context?.viewedHumanIds.length || 0,
          time_from_first_search_ms: timeFromFirstSearchMs,
          viewed_this_human_before: context?.viewedHumanIds.includes(String(args.humanId || '')) || false,
          is_first_job_in_session: (context?.jobsCreated.length || 0) <= 1,
        });

        return jobResult;
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
        const listings = minimizeResponse(await res.json());

        trackServerEvent(context?.agentId || 'anonymous', 'mcp_listings_browsed', {
          session_id: context?.sessionId,
          limit: args.limit,
          offset: args.offset,
          category: args.category ? String(args.category) : undefined,
          platform: context?.platform,
        });

        return listings;
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
        const listingResult = minimizeResponse(await res.json());

        trackServerEvent(context?.agentId || 'anonymous', 'mcp_listing_created', {
          session_id: context?.sessionId,
          title: args.title ? String(args.title) : undefined,
          category: args.category ? String(args.category) : undefined,
          price: args.price,
          platform: context?.platform,
        });

        return listingResult;
      }

      case 'ping':
        trackServerEvent(context?.agentId || 'anonymous', 'mcp_ping', {
          session_id: context?.sessionId,
          platform: context?.platform,
        });
        return { status: 'ok' };

      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error({ error, tool: toolName }, 'MCP tool execution failed');
    trackServerEvent(context?.agentId || 'anonymous', 'mcp_tool_execution_error', {
      session_id: context?.sessionId,
      tool: toolName,
      error: errorMessage,
      platform: context?.platform,
    });
    return { error: errorMessage || 'Tool execution failed' };
  }
}
