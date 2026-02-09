#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

const API_BASE = process.env.HUMANS_API_URL || process.env.API_BASE_URL || 'http://localhost:3001';

async function searchHumans(params) {
  const query = new URLSearchParams();
  if (params.skill) query.set('skill', params.skill);
  if (params.location) query.set('location', params.location);
  if (params.available_only) query.set('available', 'true');

  const res = await fetch(`${API_BASE}/api/humans/search?${query}`);
  if (!res.ok) {
    throw new Error(`API error: ${res.status}`);
  }
  return res.json();
}

async function getHuman(id) {
  const res = await fetch(`${API_BASE}/api/humans/${id}`);
  if (!res.ok) {
    throw new Error(`Human not found: ${id}`);
  }
  return res.json();
}

const server = new Server(
  {
    name: 'humans-mcp-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'search_humans',
      description:
        'Search for humans available for hire. Returns a list of humans matching the criteria with their contact info and wallet addresses for direct payment.',
      inputSchema: {
        type: 'object',
        properties: {
          skill: {
            type: 'string',
            description: 'Filter by skill (e.g., "javascript", "design", "data-analysis")',
          },
          location: {
            type: 'string',
            description: 'Filter by location (partial match, e.g., "San Francisco")',
          },
          available_only: {
            type: 'boolean',
            description: 'Only return humans who are currently available (default: true)',
            default: true,
          },
        },
      },
    },
    {
      name: 'get_human',
      description:
        'Get detailed information about a specific human by their ID, including their bio, skills, contact info, wallet addresses, and service offerings.',
      inputSchema: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'The unique ID of the human',
          },
        },
        required: ['id'],
      },
    },
    {
      name: 'record_job',
      description:
        'Record that a job/task has been assigned to a human. Use this to track job assignments for analytics and to help the human build their reputation.',
      inputSchema: {
        type: 'object',
        properties: {
          human_id: {
            type: 'string',
            description: 'The ID of the human assigned to the job',
          },
          task_description: {
            type: 'string',
            description: 'Brief description of the task assigned',
          },
          task_category: {
            type: 'string',
            description: 'Category of the task (e.g., "research", "development", "design")',
          },
          agreed_price: {
            type: 'string',
            description: 'The agreed price for the task (optional)',
          },
        },
        required: ['human_id', 'task_description'],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (name === 'search_humans') {
      const humans = await searchHumans({
        skill: args?.skill,
        location: args?.location,
        available_only: args?.available_only !== false,
      });

      if (humans.length === 0) {
        return {
          content: [{ type: 'text', text: 'No humans found matching the criteria.' }],
        };
      }

      const summary = humans
        .map((h) => {
          const walletInfo = h.wallets.map((w) => `${w.network}: ${w.address}`).join(', ');
          const contact = [h.contactEmail, h.telegram].filter(Boolean).join(' | ');
          return `- **${h.name}** (${h.location || 'Location not specified'})
  Skills: ${h.skills.join(', ')}
  Contact: ${contact}
  Wallets: ${walletInfo}
  Services: ${h.services.map((s) => `${s.title} (${s.priceRange || 'Price negotiable'})`).join(', ')}`;
        })
        .join('\n\n');

      return {
        content: [{ type: 'text', text: `Found ${humans.length} human(s):\n\n${summary}` }],
      };
    }

    if (name === 'get_human') {
      const human = await getHuman(args?.id);

      const walletInfo = human.wallets
        .map((w) => `- ${w.network}${w.label ? ` (${w.label})` : ''}: ${w.address}`)
        .join('\n');

      const servicesInfo = human.services
        .map((s) => `- **${s.title}** [${s.category}]\n  ${s.description}\n  Price: ${s.priceRange || 'Negotiable'}`)
        .join('\n\n');

      const details = `# ${human.name}
${human.isAvailable ? '✅ Available' : '❌ Not Available'}

## Bio
${human.bio || 'No bio provided'}

## Location
${human.location || 'Not specified'}

## Skills
${human.skills.join(', ') || 'None listed'}

## Contact
- Email: ${human.contactEmail || 'Not provided'}
- Telegram: ${human.telegram || 'Not provided'}

## Wallets
${walletInfo || 'No wallets added'}

## Services Offered
${servicesInfo || 'No services listed'}`;

      return {
        content: [{ type: 'text', text: details }],
      };
    }

    if (name === 'record_job') {
      const humanId = args?.human_id;
      const taskDescription = args?.task_description;
      const taskCategory = args?.task_category;
      const agreedPrice = args?.agreed_price;

      // Verify the human exists
      const human = await getHuman(humanId);

      // Log the job record
      const jobRecord = {
        humanId,
        humanName: human.name,
        taskDescription,
        taskCategory: taskCategory || 'general',
        agreedPrice: agreedPrice || 'Not specified',
        recordedAt: new Date().toISOString(),
      };

      console.error('Job recorded:', JSON.stringify(jobRecord));

      return {
        content: [
          {
            type: 'text',
            text: `Job recorded successfully!\n\n**Human:** ${human.name}\n**Task:** ${taskDescription}\n**Category:** ${taskCategory || 'general'}\n**Price:** ${agreedPrice || 'Not specified'}\n\nContact ${human.name} at: ${human.contactEmail || human.telegram || 'See profile for contact info'}`,
          },
        ],
      };
    }

    return {
      content: [{ type: 'text', text: `Unknown tool: ${name}` }],
      isError: true,
    };
  } catch (error) {
    return {
      content: [{ type: 'text', text: `Error: ${error.message}` }],
      isError: true,
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Humans MCP Server running on stdio');
}

main().catch(console.error);
