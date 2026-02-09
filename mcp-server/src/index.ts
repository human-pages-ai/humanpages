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
  neighborhood?: string;
  locationGranularity?: string;
  locationLat?: number;
  locationLng?: number;
  skills: string[];
  equipment: string[];
  languages: string[];
  isAvailable: boolean;
  minRateUsdc?: string;
  rateCurrency?: string;
  minRateUsdEstimate?: string;
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
  humanityVerified?: boolean;
  humanityScore?: number;
  humanityProvider?: string;
  humanityVerifiedAt?: string;
  lastActiveAt?: string;
  createdAt?: string;
  reputation?: {
    jobsCompleted: number;
    avgRating: number;
    reviewCount: number;
  };
  wallets: { network: string; chain?: string; address: string; label?: string; isPrimary?: boolean }[];
  services: { title: string; description: string; category: string; priceMin?: string; priceCurrency?: string; priceUnit?: string }[];
}

interface AgentProfile {
  id: string;
  name: string;
  description?: string;
  websiteUrl?: string;
  contactEmail?: string;
  domainVerified: boolean;
  verifiedAt?: string;
  lastActiveAt?: string;
  createdAt?: string;
  reputation?: {
    totalJobs: number;
    completedJobs: number;
    paidJobs: number;
    avgPaymentSpeedHours: number | null;
  };
}

interface RegisterAgentResponse {
  agent: AgentProfile;
  apiKey: string;
  verificationToken: string;
  message: string;
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
  callbackUrl?: string;
  human: { id: string; name: string };
  review?: { id: string; rating: number; comment?: string };
  registeredAgent?: { id: string; name: string; description?: string; websiteUrl?: string; domainVerified: boolean };
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
  work_mode?: string;
  verified?: string;
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
  if (params.work_mode) query.set('workMode', params.work_mode);
  if (params.verified) query.set('verified', params.verified);

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
    name: 'humanpages',
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
            description: 'Filter by location name or neighborhood (partial match, e.g., "San Francisco" or "Mission District")',
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
            description: 'Maximum hourly rate in USD. Humans who set rates in other currencies are auto-converted to USD for comparison.',
          },
          available_only: {
            type: 'boolean',
            description: 'Only return humans who are currently available (default: true)',
            default: true,
          },
          work_mode: {
            type: 'string',
            enum: ['REMOTE', 'ONSITE', 'HYBRID'],
            description: 'Filter by work mode preference (REMOTE, ONSITE, or HYBRID)',
          },
          verified: {
            type: 'string',
            enum: ['humanity'],
            description: 'Filter by verification status. Use "humanity" to only return humans who have verified their identity via Gitcoin Passport (score >= 20).',
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
      name: 'register_agent',
      description:
        'Register as an agent on Human Pages. Returns an API key that you MUST save and use for all subsequent job creation calls. The API key cannot be retrieved later.',
      inputSchema: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Display name for your agent (e.g., "Acme AI Assistant")',
          },
          description: {
            type: 'string',
            description: 'Brief description of what your agent does (max 500 chars)',
          },
          website_url: {
            type: 'string',
            description: 'Your website URL (can be verified later for a trust badge)',
          },
          contact_email: {
            type: 'string',
            description: 'Contact email for the agent operator',
          },
        },
        required: ['name'],
      },
    },
    {
      name: 'get_agent_profile',
      description:
        'Get a registered agent\'s public profile including reputation stats (total jobs, completed jobs, payment speed).',
      inputSchema: {
        type: 'object',
        properties: {
          agent_id: {
            type: 'string',
            description: 'The registered agent ID',
          },
        },
        required: ['agent_id'],
      },
    },
    {
      name: 'verify_agent_domain',
      description:
        'Verify domain ownership for a registered agent. The agent must have a websiteUrl set. Supports two methods: "well-known" (place a file at /.well-known/humanpages-verify.txt) or "dns" (add a TXT record at _humanpages.yourdomain.com).',
      inputSchema: {
        type: 'object',
        properties: {
          agent_id: {
            type: 'string',
            description: 'The registered agent ID',
          },
          agent_key: {
            type: 'string',
            description: 'The agent API key (starts with hp_)',
          },
          method: {
            type: 'string',
            enum: ['well-known', 'dns'],
            description: 'Verification method: "well-known" or "dns"',
          },
        },
        required: ['agent_id', 'agent_key', 'method'],
      },
    },
    {
      name: 'create_job_offer',
      description:
        'Create a job offer for a human. Requires a registered agent API key (from register_agent). The human must ACCEPT the offer before you can proceed with payment. RATE LIMIT: 20 offers per hour per registered agent. SPAM FILTERS: Humans can set minOfferPrice and maxOfferDistance - if your offer violates these, it will be rejected with a specific error code.',
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
            description: 'Your unique agent identifier (any string)',
          },
          agent_key: {
            type: 'string',
            description: 'Your registered agent API key (starts with hp_). Required.',
          },
          agent_name: {
            type: 'string',
            description: 'Display name override (defaults to registered agent name)',
          },
          agent_lat: {
            type: 'number',
            description: 'Agent latitude for distance filtering. Required if human has maxOfferDistance set.',
          },
          agent_lng: {
            type: 'number',
            description: 'Agent longitude for distance filtering. Required if human has maxOfferDistance set.',
          },
          callback_url: {
            type: 'string',
            description: 'Webhook URL to receive job status updates (ACCEPTED, REJECTED, PAID, COMPLETED). Must be a public HTTP(S) endpoint.',
          },
          callback_secret: {
            type: 'string',
            description: 'Secret for HMAC-SHA256 signature verification (min 16 chars). The signature is sent in X-HumanPages-Signature header.',
          },
        },
        required: ['human_id', 'title', 'description', 'price_usdc', 'agent_id', 'agent_key'],
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
      name: 'check_humanity_status',
      description:
        'Check the humanity verification status for a specific human. Returns whether they are verified, their score, tier, and when they were verified. This is read-only.',
      inputSchema: {
        type: 'object',
        properties: {
          human_id: {
            type: 'string',
            description: 'The ID of the human to check',
          },
        },
        required: ['human_id'],
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
        work_mode: args?.work_mode as string | undefined,
        verified: args?.verified as string | undefined,
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

          const humanityStatus = h.humanityVerified
            ? `🛡️ Verified Human (score: ${h.humanityScore})`
            : h.humanityScore ? `🛡️ Partially verified (score: ${h.humanityScore})` : '🛡️ Not verified';

          const rateDisplay = h.minRateUsdc
            ? (h.rateCurrency && h.rateCurrency !== 'USD'
              ? `${h.rateCurrency} ${h.minRateUsdc}+ (~$${h.minRateUsdEstimate || '?'} USD)`
              : `$${h.minRateUsdc}+`)
            : 'Rate negotiable';

          const displayLocation = h.locationGranularity === 'neighborhood' && h.neighborhood && h.location
            ? `${h.neighborhood}, ${h.location}`
            : h.location || 'Location not specified';

          return `- **${h.name}**${h.username ? ` (@${h.username})` : ''} [${displayLocation}]
  ${h.isAvailable ? '✅ Available' : '❌ Busy'} | ${rateDisplay} | ${rating}
  ${humanityStatus}
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
        .map((s) => {
          let price = 'Negotiable';
          const cur = s.priceCurrency || 'USD';
          if (s.priceUnit === 'NEGOTIABLE') price = 'Negotiable';
          else if (s.priceMin) {
            const sym = cur === 'USD' ? '$' : cur + ' ';
            price = s.priceUnit === 'HOURLY' ? `${sym}${s.priceMin}/hr` : s.priceUnit === 'FLAT_TASK' ? `${sym}${s.priceMin}/task` : `${sym}${s.priceMin}`;
          }
          return `- **${s.title}** [${s.category}]\n  ${s.description}\n  Price: ${price}`;
        })
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

      const humanityTier = human.humanityScore
        ? (human.humanityScore >= 40 ? 'Gold' : human.humanityScore >= 20 ? 'Silver' : 'Bronze')
        : 'Not verified';

      const details = `# ${human.name}${human.username ? ` (@${human.username})` : ''}
${human.isAvailable ? '✅ Available' : '❌ Not Available'}

## Humanity Verification
- **Status:** ${human.humanityVerified ? '🛡️ Verified' : '❌ Not Verified'}
- **Score:** ${human.humanityScore ?? 'N/A'}
- **Tier:** ${humanityTier}
- **Provider:** ${human.humanityProvider || 'N/A'}
- **Verified At:** ${human.humanityVerifiedAt || 'N/A'}

## Reputation
- Jobs completed: ${rep?.jobsCompleted || 0}
- Rating: ${rating}

## Bio
${human.bio || 'No bio provided'}

## Location
${human.locationGranularity === 'neighborhood' && human.neighborhood && human.location
  ? `${human.neighborhood}, ${human.location}`
  : human.location || 'Not specified'}

## Capabilities
- **Skills:** ${human.skills.join(', ') || 'None listed'}
- **Equipment:** ${human.equipment.join(', ') || 'None listed'}
- **Languages:** ${human.languages.join(', ') || 'Not specified'}

## Economics
- **Minimum Rate:** ${human.minRateUsdc ? (human.rateCurrency && human.rateCurrency !== 'USD' ? `${human.rateCurrency} ${human.minRateUsdc} (~$${human.minRateUsdEstimate || '?'} USD)` : `$${human.minRateUsdc} USD`) : 'Negotiable'}
- **Rate Currency:** ${human.rateCurrency || 'USD'}
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

    if (name === 'register_agent') {
      const res = await fetch(`${API_BASE}/api/agents/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: args?.name,
          description: args?.description,
          websiteUrl: args?.website_url,
          contactEmail: args?.contact_email,
        }),
      });

      if (!res.ok) {
        const error = await res.json() as ApiError;
        throw new Error(error.error || `API error: ${res.status}`);
      }

      const result = await res.json() as RegisterAgentResponse;

      return {
        content: [
          {
            type: 'text',
            text: `**Agent Registered!**

**Agent ID:** ${result.agent.id}
**Name:** ${result.agent.name}
**API Key:** \`${result.apiKey}\`

**IMPORTANT:** Save your API key now — it cannot be retrieved later.
Pass it as \`agent_key\` when using \`create_job_offer\`.

**Domain Verification Token:** \`${result.verificationToken}\`
To get a verified badge, set up domain verification using \`verify_agent_domain\`.`,
          },
        ],
      };
    }

    if (name === 'get_agent_profile') {
      const res = await fetch(`${API_BASE}/api/agents/${args?.agent_id}`);
      if (!res.ok) {
        throw new Error(`Agent not found: ${args?.agent_id}`);
      }

      const agent = await res.json() as AgentProfile;
      const rep = agent.reputation;

      const details = `# ${agent.name}${agent.domainVerified ? ' ✅ Verified' : ''}

## Profile
- **Description:** ${agent.description || 'No description'}
- **Website:** ${agent.websiteUrl || 'Not set'}
- **Contact:** ${agent.contactEmail || 'Not provided'}
- **Domain Verified:** ${agent.domainVerified ? `Yes (${agent.verifiedAt})` : 'No'}
- **Registered:** ${agent.createdAt}
- **Last Active:** ${agent.lastActiveAt}

## Reputation
- **Total Jobs:** ${rep?.totalJobs || 0}
- **Completed Jobs:** ${rep?.completedJobs || 0}
- **Paid Jobs:** ${rep?.paidJobs || 0}
- **Avg Payment Speed:** ${rep?.avgPaymentSpeedHours != null ? `${rep.avgPaymentSpeedHours} hours` : 'N/A'}`;

      return {
        content: [{ type: 'text', text: details }],
      };
    }

    if (name === 'verify_agent_domain') {
      const res = await fetch(`${API_BASE}/api/agents/${args?.agent_id}/verify-domain`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Agent-Key': args?.agent_key as string,
        },
        body: JSON.stringify({
          method: args?.method,
        }),
      });

      if (!res.ok) {
        const error = await res.json() as ApiError & { message?: string };
        throw new Error(error.message || error.error || `API error: ${res.status}`);
      }

      const result = await res.json() as { domainVerified: boolean; domain: string; message: string };

      return {
        content: [
          {
            type: 'text',
            text: `**Domain Verified!**

**Domain:** ${result.domain}
**Status:** Verified

Your agent profile now shows a verified badge. Humans will see this when reviewing your job offers.`,
          },
        ],
      };
    }

    if (name === 'create_job_offer') {
      const agentKey = args?.agent_key as string;
      if (!agentKey) {
        throw new Error('agent_key is required. Register first with register_agent to get an API key.');
      }

      const res = await fetch(`${API_BASE}/api/jobs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Agent-Key': agentKey,
        },
        body: JSON.stringify({
          humanId: args?.human_id,
          agentId: args?.agent_id,
          agentName: args?.agent_name,
          title: args?.title,
          description: args?.description,
          category: args?.category,
          priceUsdc: args?.price_usdc,
          callbackUrl: args?.callback_url,
          callbackSecret: args?.callback_secret,
        }),
      });

      if (!res.ok) {
        const error = await res.json() as ApiError;
        throw new Error(error.error || `API error: ${res.status}`);
      }

      const job = await res.json() as Job;
      const human = await getHuman(args?.human_id as string);

      const webhookNote = args?.callback_url
        ? `\n\n🔔 **Webhook configured.** Status updates will be sent to your callback URL. On acceptance, the human's contact info will be included in the webhook payload.`
        : `\n\nUse \`get_job_status\` with job_id "${job.id}" to check if they've accepted.`;

      return {
        content: [
          {
            type: 'text',
            text: `**Job Offer Created!**

**Job ID:** ${job.id}
**Status:** ${job.status}
**Human:** ${human.name}
**Price:** $${args?.price_usdc} USDC

⏳ **Next Step:** Wait for ${human.name} to accept the offer.${webhookNote}

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
          nextStep = job.callbackUrl
            ? `Human accepted! Contact info was sent to your webhook. Send $${job.priceUsdc} USDC to their wallet, then use \`mark_job_paid\` with the transaction hash.`
            : `Human accepted! Send $${job.priceUsdc} USDC to their wallet, then use \`mark_job_paid\` with the transaction hash.`;
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

      const agentInfo = job.registeredAgent
        ? `**Agent:** ${job.registeredAgent.name}${job.registeredAgent.domainVerified ? ' ✅ Verified' : ''}`
        : job.agentName
          ? `**Agent:** ${job.agentName}`
          : '';

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
${agentInfo ? agentInfo + '\n' : ''}
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

    if (name === 'check_humanity_status') {
      const human = await getHuman(args?.human_id as string);
      const tier = human.humanityScore
        ? (human.humanityScore >= 40 ? 'Gold' : human.humanityScore >= 20 ? 'Silver' : 'Bronze')
        : 'None';

      return {
        content: [
          {
            type: 'text',
            text: `**Humanity Verification Status**

**Human:** ${human.name}${human.username ? ` (@${human.username})` : ''}
**Verified:** ${human.humanityVerified ? '✅ Yes' : '❌ No'}
**Score:** ${human.humanityScore ?? 'Not checked'}
**Tier:** ${tier}
**Provider:** ${human.humanityProvider || 'N/A'}
**Last Verified:** ${human.humanityVerifiedAt || 'Never'}

${human.humanityVerified
  ? 'This human has verified their identity through Gitcoin Passport.'
  : human.humanityScore
    ? 'This human has checked their score but does not meet the verification threshold (20+).'
    : 'This human has not yet verified their identity.'}`,
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
  console.error('Human Pages MCP Server running on stdio');
}

main().catch(console.error);
