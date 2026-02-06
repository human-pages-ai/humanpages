import 'dotenv/config';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

const API_BASE = process.env.API_BASE_URL || 'http://localhost:3001';

interface Human {
  id: string;
  name: string;
  username?: string;
  bio?: string;
  avatarUrl?: string;
  location?: string;
  locationLat?: number;
  locationLng?: number;
  skills: string[];
  equipment: string[];
  languages: string[];
  isAvailable: boolean;
  minRateUsdc?: string;
  rateType?: string;
  contactEmail?: string;
  telegram?: string;
  signal?: string;
  linkedinUrl?: string;
  twitterUrl?: string;
  githubUrl?: string;
  instagramUrl?: string;
  youtubeUrl?: string;
  websiteUrl?: string;
  lastActiveAt?: string;
  createdAt?: string;
  reputation?: {
    jobsCompleted: number;
    avgRating: number;
    reviewCount: number;
  };
  wallets: { network: string; chain?: string; address: string; label?: string; isPrimary?: boolean }[];
  services: { title: string; description: string; category: string; priceRange?: string }[];
}

interface Job {
  id: string;
  humanId: string;
  agentId: string;
  agentName?: string;
  title: string;
  description: string;
  category?: string;
  priceUsdc: string;
  paymentTxHash?: string;
  paymentNetwork?: string;
  paymentAmount?: string;
  paidAt?: string;
  status: string;
  createdAt: string;
  acceptedAt?: string;
  completedAt?: string;
  human: { id: string; name: string };
  review?: { id: string; rating: number; comment?: string };
}

interface ApiError {
  error?: string;
  reason?: string;
}

interface SearchParams {
  skill?: string;
  equipment?: string;
  language?: string;
  location?: string;
  lat?: number;
  lng?: number;
  radius?: number;
  max_rate?: number;
  available_only?: boolean;
}

async function searchHumans(params: SearchParams): Promise<Human[]> {
  const query = new URLSearchParams();
  if (params.skill) query.set('skill', params.skill);
  if (params.equipment) query.set('equipment', params.equipment);
  if (params.language) query.set('language', params.language);
  if (params.location) query.set('location', params.location);
  if (params.lat) query.set('lat', params.lat.toString());
  if (params.lng) query.set('lng', params.lng.toString());
  if (params.radius) query.set('radius', params.radius.toString());
  if (params.max_rate) query.set('maxRate', params.max_rate.toString());
  if (params.available_only) query.set('available', 'true');

  const res = await fetch(`${API_BASE}/api/humans/search?${query}`);
  if (!res.ok) {
    throw new Error(`API error: ${res.status}`);
  }
  return res.json() as Promise<Human[]>;
}

async function getHuman(id: string): Promise<Human> {
  const res = await fetch(`${API_BASE}/api/humans/${id}`);
  if (!res.ok) {
    throw new Error(`Human not found: ${id}`);
  }
  return res.json() as Promise<Human>;
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
        'Search for humans available for hire. Supports filtering by skill, equipment, language, location (text or coordinates), and rate. Returns profiles with contact info, wallet addresses, and reputation stats.',
      inputSchema: {
        type: 'object',
        properties: {
          skill: {
            type: 'string',
            description: 'Filter by skill tag (e.g., "photography", "driving", "notary")',
          },
          equipment: {
            type: 'string',
            description: 'Filter by equipment (e.g., "car", "drone", "camera")',
          },
          language: {
            type: 'string',
            description: 'Filter by language ISO code (e.g., "en", "es", "zh")',
          },
          location: {
            type: 'string',
            description: 'Filter by location name (partial match, e.g., "San Francisco")',
          },
          lat: {
            type: 'number',
            description: 'Latitude for radius search (requires lng and radius)',
          },
          lng: {
            type: 'number',
            description: 'Longitude for radius search (requires lat and radius)',
          },
          radius: {
            type: 'number',
            description: 'Search radius in kilometers (requires lat and lng)',
          },
          max_rate: {
            type: 'number',
            description: 'Maximum hourly rate in USDC (filters by minRateUsdc)',
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
      name: 'create_job_offer',
      description:
        'Create a job offer for a human. The human must ACCEPT the offer before you can proceed with payment. RATE LIMIT: 5 offers per hour per agent_id. SPAM FILTERS: Humans can set minOfferPrice and maxOfferDistance - if your offer violates these, it will be rejected with a specific error code (PRICE_TOO_LOW, BELOW_MIN_RATE, TOO_FAR, LOCATION_REQUIRED). The error will tell you exactly what the human requires.',
      inputSchema: {
        type: 'object',
        properties: {
          human_id: {
            type: 'string',
            description: 'The ID of the human to hire',
          },
          title: {
            type: 'string',
            description: 'Title of the job/task',
          },
          description: {
            type: 'string',
            description: 'Detailed description of what needs to be done',
          },
          category: {
            type: 'string',
            description: 'Category of the task (e.g., "photography", "research", "delivery")',
          },
          price_usdc: {
            type: 'number',
            description: 'Agreed price in USDC. Must meet the human\'s minOfferPrice if set.',
          },
          agent_id: {
            type: 'string',
            description: 'Your unique agent identifier',
          },
          agent_name: {
            type: 'string',
            description: 'Display name for your agent (optional)',
          },
          agent_lat: {
            type: 'number',
            description: 'Agent latitude for distance filtering. Required if human has maxOfferDistance set.',
          },
          agent_lng: {
            type: 'number',
            description: 'Agent longitude for distance filtering. Required if human has maxOfferDistance set.',
          },
        },
        required: ['human_id', 'title', 'description', 'price_usdc', 'agent_id'],
      },
    },
    {
      name: 'get_job_status',
      description:
        'Check the status of a job offer. Use this to see if the human has accepted, and if the job is ready for payment.',
      inputSchema: {
        type: 'object',
        properties: {
          job_id: {
            type: 'string',
            description: 'The job ID returned from create_job_offer',
          },
        },
        required: ['job_id'],
      },
    },
    {
      name: 'mark_job_paid',
      description:
        'Record that payment has been sent for an ACCEPTED job. The job must be accepted by the human first. Payment amount must match or exceed the agreed price.',
      inputSchema: {
        type: 'object',
        properties: {
          job_id: {
            type: 'string',
            description: 'The job ID',
          },
          payment_tx_hash: {
            type: 'string',
            description: 'The on-chain transaction hash',
          },
          payment_network: {
            type: 'string',
            description: 'The blockchain network (e.g., "ethereum", "solana")',
          },
          payment_amount: {
            type: 'number',
            description: 'The amount paid in USDC',
          },
        },
        required: ['job_id', 'payment_tx_hash', 'payment_network', 'payment_amount'],
      },
    },
    {
      name: 'leave_review',
      description:
        'Leave a review for a COMPLETED job. Reviews are only allowed after the human marks the job as complete.',
      inputSchema: {
        type: 'object',
        properties: {
          job_id: {
            type: 'string',
            description: 'The job ID',
          },
          rating: {
            type: 'number',
            description: 'Rating from 1-5 stars',
          },
          comment: {
            type: 'string',
            description: 'Optional review comment',
          },
        },
        required: ['job_id', 'rating'],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (name === 'search_humans') {
      const humans = await searchHumans({
        skill: args?.skill as string | undefined,
        equipment: args?.equipment as string | undefined,
        language: args?.language as string | undefined,
        location: args?.location as string | undefined,
        lat: args?.lat as number | undefined,
        lng: args?.lng as number | undefined,
        radius: args?.radius as number | undefined,
        max_rate: args?.max_rate as number | undefined,
        available_only: args?.available_only !== false,
      });

      if (humans.length === 0) {
        return {
          content: [{ type: 'text', text: 'No humans found matching the criteria.' }],
        };
      }

      const summary = humans
        .map((h) => {
          const primaryWallet = h.wallets.find((w) => w.isPrimary) || h.wallets[0];
          const walletInfo = primaryWallet
            ? `${primaryWallet.chain || primaryWallet.network}: ${primaryWallet.address}`
            : 'No wallet';
          const contact = [h.contactEmail, h.telegram, h.signal].filter(Boolean).join(' | ');
          const rep = h.reputation;
          const rating = rep && rep.avgRating > 0 ? `${rep.avgRating}★ (${rep.reviewCount} reviews)` : 'No reviews';

          return `- **${h.name}**${h.username ? ` (@${h.username})` : ''} [${h.location || 'Location not specified'}]
  ${h.isAvailable ? '✅ Available' : '❌ Busy'} | ${h.minRateUsdc ? `$${h.minRateUsdc}+` : 'Rate negotiable'} | ${rating}
  Skills: ${h.skills.join(', ') || 'None listed'}
  Equipment: ${h.equipment.join(', ') || 'None listed'}
  Languages: ${h.languages.join(', ') || 'Not specified'}
  Contact: ${contact || 'See profile'}
  Wallet: ${walletInfo}
  Jobs completed: ${rep?.jobsCompleted || 0}`;
        })
        .join('\n\n');

      return {
        content: [{ type: 'text', text: `Found ${humans.length} human(s):\n\n${summary}` }],
      };
    }

    if (name === 'get_human') {
      const human = await getHuman(args?.id as string);

      const primaryWallet = human.wallets.find((w) => w.isPrimary) || human.wallets[0];
      const walletInfo = human.wallets
        .map((w) => `- ${w.chain || w.network}${w.label ? ` (${w.label})` : ''}${w.isPrimary ? ' ⭐' : ''}: ${w.address}`)
        .join('\n');

      const servicesInfo = human.services
        .map((s) => `- **${s.title}** [${s.category}]\n  ${s.description}\n  Price: ${s.priceRange || 'Negotiable'}`)
        .join('\n\n');

      const socialLinks = [
        human.linkedinUrl && `- LinkedIn: ${human.linkedinUrl}`,
        human.twitterUrl && `- Twitter: ${human.twitterUrl}`,
        human.githubUrl && `- GitHub: ${human.githubUrl}`,
        human.instagramUrl && `- Instagram: ${human.instagramUrl}`,
        human.youtubeUrl && `- YouTube: ${human.youtubeUrl}`,
        human.websiteUrl && `- Website: ${human.websiteUrl}`,
      ].filter(Boolean).join('\n');

      const rep = human.reputation;
      const rating = rep && rep.avgRating > 0 ? `${rep.avgRating}★ (${rep.reviewCount} reviews)` : 'No reviews yet';

      const details = `# ${human.name}${human.username ? ` (@${human.username})` : ''}
${human.isAvailable ? '✅ Available' : '❌ Not Available'}

## Reputation
- Jobs completed: ${rep?.jobsCompleted || 0}
- Rating: ${rating}

## Bio
${human.bio || 'No bio provided'}

## Location
${human.location || 'Not specified'}

## Capabilities
- **Skills:** ${human.skills.join(', ') || 'None listed'}
- **Equipment:** ${human.equipment.join(', ') || 'None listed'}
- **Languages:** ${human.languages.join(', ') || 'Not specified'}

## Economics
- **Minimum Rate:** ${human.minRateUsdc ? `$${human.minRateUsdc} USDC` : 'Negotiable'}
- **Rate Type:** ${human.rateType || 'NEGOTIABLE'}

## Contact
- Email: ${human.contactEmail || 'Not provided'}
- Telegram: ${human.telegram || 'Not provided'}
- Signal: ${human.signal || 'Not provided'}

## Payment Wallets
${walletInfo || 'No wallets added'}
${primaryWallet ? `\n**Preferred wallet:** ${primaryWallet.chain || primaryWallet.network} - ${primaryWallet.address}` : ''}

## Social Profiles (Trust Verification)
${socialLinks || 'No social profiles added'}

## Services Offered
${servicesInfo || 'No services listed'}`;

      return {
        content: [{ type: 'text', text: details }],
      };
    }

    if (name === 'create_job_offer') {
      const res = await fetch(`${API_BASE}/api/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          humanId: args?.human_id,
          agentId: args?.agent_id,
          agentName: args?.agent_name,
          title: args?.title,
          description: args?.description,
          category: args?.category,
          priceUsdc: args?.price_usdc,
        }),
      });

      if (!res.ok) {
        const error = await res.json() as ApiError;
        throw new Error(error.error || `API error: ${res.status}`);
      }

      const job = await res.json() as Job;
      const human = await getHuman(args?.human_id as string);

      return {
        content: [
          {
            type: 'text',
            text: `**Job Offer Created!**

**Job ID:** ${job.id}
**Status:** ${job.status}
**Human:** ${human.name}
**Price:** $${args?.price_usdc} USDC

⏳ **Next Step:** Wait for ${human.name} to accept the offer.
Use \`get_job_status\` with job_id "${job.id}" to check if they've accepted.

Once accepted, you can send payment to their wallet and use \`mark_job_paid\` to record the transaction.`,
          },
        ],
      };
    }

    if (name === 'get_job_status') {
      const res = await fetch(`${API_BASE}/api/jobs/${args?.job_id}`);
      if (!res.ok) {
        throw new Error(`Job not found: ${args?.job_id}`);
      }

      const job = await res.json() as Job;

      const statusEmoji: Record<string, string> = {
        PENDING: '⏳',
        ACCEPTED: '✅',
        REJECTED: '❌',
        PAID: '💰',
        COMPLETED: '🎉',
        CANCELLED: '🚫',
        DISPUTED: '⚠️',
      };

      let nextStep = '';
      switch (job.status) {
        case 'PENDING':
          nextStep = 'Waiting for the human to accept or reject.';
          break;
        case 'ACCEPTED':
          nextStep = `Human accepted! Send $${job.priceUsdc} USDC to their wallet, then use \`mark_job_paid\` with the transaction hash.`;
          break;
        case 'REJECTED':
          nextStep = 'The human rejected this offer. Consider adjusting your offer or finding another human.';
          break;
        case 'PAID':
          nextStep = 'Payment recorded. Work is in progress. The human will mark it complete when done.';
          break;
        case 'COMPLETED':
          nextStep = job.review
            ? `Review submitted: ${job.review.rating}/5 stars`
            : 'Job complete! You can now use `leave_review` to rate the human.';
          break;
      }

      return {
        content: [
          {
            type: 'text',
            text: `**Job Status**

**Job ID:** ${job.id}
**Status:** ${statusEmoji[job.status] || ''} ${job.status}
**Title:** ${job.title}
**Price:** $${job.priceUsdc} USDC
**Human:** ${job.human.name}

**Next Step:** ${nextStep}`,
          },
        ],
      };
    }

    if (name === 'mark_job_paid') {
      const res = await fetch(`${API_BASE}/api/jobs/${args?.job_id}/paid`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentTxHash: args?.payment_tx_hash,
          paymentNetwork: args?.payment_network,
          paymentAmount: args?.payment_amount,
        }),
      });

      if (!res.ok) {
        const error = await res.json() as ApiError;
        throw new Error(error.reason || error.error || `API error: ${res.status}`);
      }

      const result = await res.json() as { id: string; status: string; message: string };

      return {
        content: [
          {
            type: 'text',
            text: `**Payment Recorded!**

**Job ID:** ${result.id}
**Status:** ${result.status}
**Transaction:** ${args?.payment_tx_hash}
**Network:** ${args?.payment_network}
**Amount:** $${args?.payment_amount} USDC

The human can now begin work. They will mark the job as complete when finished.
After completion, you can leave a review using \`leave_review\`.`,
          },
        ],
      };
    }

    if (name === 'leave_review') {
      const res = await fetch(`${API_BASE}/api/jobs/${args?.job_id}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rating: args?.rating,
          comment: args?.comment,
        }),
      });

      if (!res.ok) {
        const error = await res.json() as ApiError;
        throw new Error(error.reason || error.error || `API error: ${res.status}`);
      }

      const _review = await res.json() as { id: string; rating: number; message: string };

      return {
        content: [
          {
            type: 'text',
            text: `**Review Submitted!**

**Rating:** ${'⭐'.repeat(args?.rating as number)}
${args?.comment ? `**Comment:** ${args?.comment}` : ''}

Thank you for your feedback. This helps build the human's reputation.`,
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
      content: [{ type: 'text', text: `Error: ${(error as Error).message}` }],
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
