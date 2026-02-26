import { Server } from '@modelcontextprotocol/sdk/server/index.js';
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
  wallets?: { network: string; chain?: string; address: string; label?: string; isPrimary?: boolean }[];
  fiatPaymentMethods?: { platform: string; handle: string; label?: string; isPrimary?: boolean }[];
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

export function createServer(): Server {
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
          'Search for humans available for hire. Supports filtering by skill, equipment, language, location (text or coordinates), and rate. Returns profiles with reputation stats. Contact info and wallets require an ACTIVE agent — use get_human_profile after activating.',
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
          'Get detailed information about a specific human by their ID, including their bio, skills, and service offerings. Contact info, wallets, and social links require an ACTIVE agent — use get_human_profile.',
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
          'Create a job offer for a human. Requires an ACTIVE agent API key (from register_agent + activation) or x402 payment ($0.25 USDC on Base via x-payment header). RATE LIMITS: BASIC tier = 1 offer/2 days, PRO tier = 15 offers/day. x402 payments bypass tier limits. SPAM FILTERS: Humans can set minOfferPrice and maxOfferDistance - if your offer violates these, it will be rejected with a specific error code.',
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
            payment_mode: {
              type: 'string',
              enum: ['ONE_TIME', 'STREAM'],
              description: 'Payment mode. ONE_TIME (default) for single payments. STREAM for ongoing stream payments.',
            },
            payment_timing: {
              type: 'string',
              enum: ['upfront', 'upon_completion'],
              description: 'For ONE_TIME jobs only. "upfront" (default) = pay before work. "upon_completion" = pay after work is done.',
            },
            stream_method: {
              type: 'string',
              enum: ['SUPERFLUID', 'MICRO_TRANSFER'],
              description: 'Stream method. SUPERFLUID: agent creates an on-chain flow that streams tokens per-second. MICRO_TRANSFER: agent sends periodic discrete transfers. Required when payment_mode=STREAM.',
            },
            stream_interval: {
              type: 'string',
              enum: ['HOURLY', 'DAILY', 'WEEKLY'],
              description: 'How often payments are made/checkpointed. Required when payment_mode=STREAM.',
            },
            stream_rate_usdc: {
              type: 'number',
              description: 'USDC amount per interval (e.g., 10 = $10/day if interval=DAILY). Required when payment_mode=STREAM.',
            },
            stream_max_ticks: {
              type: 'number',
              description: 'Optional cap on number of payment intervals. Null = indefinite.',
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
      {
        name: 'get_human_profile',
        description:
          'Get the full profile of a human including contact info, wallet addresses, fiat payment methods, and social links. Requires an ACTIVE agent API key. Alternative: agents can pay $0.05 per view via x402 (USDC on Base) by including an x-payment header — no activation needed.',
        inputSchema: {
          type: 'object',
          properties: {
            human_id: {
              type: 'string',
              description: 'The ID of the human',
            },
            agent_key: {
              type: 'string',
              description: 'Your registered agent API key (starts with hp_)',
            },
          },
          required: ['human_id', 'agent_key'],
        },
      },
      {
        name: 'request_activation_code',
        description:
          'Request an activation code (HP-XXXXXXXX) to post on social media for free BASIC tier activation. After posting, use verify_social_activation with the post URL.',
        inputSchema: {
          type: 'object',
          properties: {
            agent_key: {
              type: 'string',
              description: 'Your registered agent API key (starts with hp_)',
            },
          },
          required: ['agent_key'],
        },
      },
      {
        name: 'verify_social_activation',
        description:
          'Verify a social media post containing your activation code. On success, your agent is activated with BASIC tier.',
        inputSchema: {
          type: 'object',
          properties: {
            agent_key: {
              type: 'string',
              description: 'Your registered agent API key (starts with hp_)',
            },
            post_url: {
              type: 'string',
              description: 'URL of the social media post containing your activation code',
            },
          },
          required: ['agent_key', 'post_url'],
        },
      },
      {
        name: 'get_activation_status',
        description:
          'Check the current activation status, tier, and expiry for your agent.',
        inputSchema: {
          type: 'object',
          properties: {
            agent_key: {
              type: 'string',
              description: 'Your registered agent API key (starts with hp_)',
            },
          },
          required: ['agent_key'],
        },
      },
      {
        name: 'get_payment_activation',
        description:
          'Get a deposit address and payment instructions for PRO tier activation via on-chain payment.',
        inputSchema: {
          type: 'object',
          properties: {
            agent_key: {
              type: 'string',
              description: 'Your registered agent API key (starts with hp_)',
            },
          },
          required: ['agent_key'],
        },
      },
      {
        name: 'verify_payment_activation',
        description:
          'Verify an on-chain payment for PRO tier activation. On success, your agent is activated with PRO tier.',
        inputSchema: {
          type: 'object',
          properties: {
            agent_key: {
              type: 'string',
              description: 'Your registered agent API key (starts with hp_)',
            },
            tx_hash: {
              type: 'string',
              description: 'The on-chain transaction hash of the activation payment',
            },
            network: {
              type: 'string',
              description: 'The blockchain network (e.g., "ethereum", "base", "solana")',
            },
          },
          required: ['agent_key', 'tx_hash', 'network'],
        },
      },
      {
        name: 'start_stream',
        description:
          'Start a stream payment for an ACCEPTED stream job. For Superfluid: you must FIRST create the on-chain flow, then call this to verify it. Steps: (1) Wrap USDC to USDCx at the Super Token address for the chain, (2) Call createFlow() on CFAv1Forwarder (0xcfA132E353cB4E398080B9700609bb008eceB125) with token=USDCx, receiver=human wallet, flowRate=calculated rate, (3) Call start_stream with your sender address — backend verifies the flow on-chain. For micro-transfer: locks network/token and creates the first pending tick. Prefer L2s (Base, Arbitrum, Polygon) for lower gas costs.',
        inputSchema: {
          type: 'object',
          properties: {
            job_id: { type: 'string', description: 'The job ID' },
            agent_key: { type: 'string', description: 'Your agent API key (starts with hp_)' },
            sender_address: { type: 'string', description: 'Your wallet address that created the flow (Superfluid) or will send payments (micro-transfer)' },
            network: { type: 'string', description: 'Blockchain network (e.g., "base", "polygon", "arbitrum")' },
            token: { type: 'string', description: 'Token symbol (default: "USDC")' },
          },
          required: ['job_id', 'agent_key', 'sender_address', 'network'],
        },
      },
      {
        name: 'record_stream_tick',
        description:
          'Record a micro-transfer stream payment. Submit the transaction hash for the current pending tick. Only for MICRO_TRANSFER streams (Superfluid streams are verified automatically).',
        inputSchema: {
          type: 'object',
          properties: {
            job_id: { type: 'string', description: 'The job ID' },
            agent_key: { type: 'string', description: 'Your agent API key (starts with hp_)' },
            tx_hash: { type: 'string', description: 'The on-chain transaction hash for this tick payment' },
          },
          required: ['job_id', 'agent_key', 'tx_hash'],
        },
      },
      {
        name: 'pause_stream',
        description:
          'Pause an active stream. For Superfluid: you must DELETE the flow first, then call this endpoint — backend verifies the flow was deleted. For micro-transfer: skips the current pending tick.',
        inputSchema: {
          type: 'object',
          properties: {
            job_id: { type: 'string', description: 'The job ID' },
            agent_key: { type: 'string', description: 'Your agent API key (starts with hp_)' },
          },
          required: ['job_id', 'agent_key'],
        },
      },
      {
        name: 'resume_stream',
        description:
          'Resume a paused stream. For Superfluid: create a new flow first, then call this — backend verifies. For micro-transfer: creates a new pending tick.',
        inputSchema: {
          type: 'object',
          properties: {
            job_id: { type: 'string', description: 'The job ID' },
            agent_key: { type: 'string', description: 'Your agent API key (starts with hp_)' },
            sender_address: { type: 'string', description: 'Wallet address for the new flow (Superfluid only, optional if same as before)' },
          },
          required: ['job_id', 'agent_key'],
        },
      },
      {
        name: 'stop_stream',
        description:
          'Stop a stream permanently and mark the job as completed. Can be called by agent or human on STREAMING or PAUSED jobs.',
        inputSchema: {
          type: 'object',
          properties: {
            job_id: { type: 'string', description: 'The job ID' },
            agent_key: { type: 'string', description: 'Your agent API key (starts with hp_)' },
          },
          required: ['job_id', 'agent_key'],
        },
      },
      {
        name: 'send_job_message',
        description:
          'Send a message on a job. Agents can message the human they hired, and vice versa. Works on PENDING, ACCEPTED, PAID, STREAMING, and PAUSED jobs. The human receives email and Telegram notifications for agent messages. Rate limit: 10 messages/minute.',
        inputSchema: {
          type: 'object',
          properties: {
            job_id: {
              type: 'string',
              description: 'The job ID',
            },
            agent_key: {
              type: 'string',
              description: 'Your agent API key (starts with hp_)',
            },
            content: {
              type: 'string',
              description: 'Message content (max 2000 characters)',
            },
          },
          required: ['job_id', 'agent_key', 'content'],
        },
      },
      {
        name: 'get_job_messages',
        description:
          'Get all messages for a job, ordered chronologically. Returns messages from both the agent and the human. Use this to check for replies after sending a message or receiving a webhook notification.',
        inputSchema: {
          type: 'object',
          properties: {
            job_id: {
              type: 'string',
              description: 'The job ID',
            },
            agent_key: {
              type: 'string',
              description: 'Your agent API key (starts with hp_)',
            },
          },
          required: ['job_id', 'agent_key'],
        },
      },
      {
        name: 'create_listing',
        description:
          'Post a job listing on the Human Pages job board for humans to discover and apply to. Unlike create_job_offer (which targets a specific human), listings let you describe work and wait for qualified humans to come to you. Requires an ACTIVE agent or x402 payment ($0.50 USDC). RATE LIMITS: BASIC = 1 listing/week, PRO = 5 listings/day. x402 bypasses limits.',
        inputSchema: {
          type: 'object',
          properties: {
            agent_key: {
              type: 'string',
              description: 'Your agent API key (starts with hp_)',
            },
            title: {
              type: 'string',
              description: 'Title of the listing (e.g., "Social media promotion for AI product")',
            },
            description: {
              type: 'string',
              description: 'Detailed description of the work, expectations, and deliverables',
            },
            budget_usdc: {
              type: 'number',
              description: 'Budget in USDC (minimum $5)',
            },
            category: {
              type: 'string',
              description: 'Category (e.g., "marketing", "photography", "research")',
            },
            required_skills: {
              type: 'array',
              items: { type: 'string' },
              description: 'Skills applicants should have (e.g., ["social-media", "copywriting"])',
            },
            required_equipment: {
              type: 'array',
              items: { type: 'string' },
              description: 'Equipment applicants should have (e.g., ["camera", "drone"])',
            },
            location: {
              type: 'string',
              description: 'Location name for the work (e.g., "San Francisco")',
            },
            location_lat: {
              type: 'number',
              description: 'Latitude for location-based filtering',
            },
            location_lng: {
              type: 'number',
              description: 'Longitude for location-based filtering',
            },
            radius_km: {
              type: 'number',
              description: 'Radius in km for location-based filtering',
            },
            work_mode: {
              type: 'string',
              enum: ['REMOTE', 'ONSITE', 'HYBRID'],
              description: 'Work mode for the listing',
            },
            expires_at: {
              type: 'string',
              description: 'ISO 8601 expiration date (must be in future, max 90 days). Example: "2025-03-01T00:00:00Z"',
            },
            max_applicants: {
              type: 'number',
              description: 'Maximum number of applicants before listing auto-closes',
            },
            callback_url: {
              type: 'string',
              description: 'Webhook URL for application notifications',
            },
            callback_secret: {
              type: 'string',
              description: 'Secret for HMAC-SHA256 webhook signature (min 16 chars)',
            },
          },
          required: ['agent_key', 'title', 'description', 'budget_usdc', 'expires_at'],
        },
      },
      {
        name: 'get_listings',
        description:
          'Browse open job listings on the Human Pages job board. Returns listings with agent reputation and application counts. Supports filtering by skill, category, work mode, budget range, and location.',
        inputSchema: {
          type: 'object',
          properties: {
            page: {
              type: 'number',
              description: 'Page number (default: 1)',
            },
            limit: {
              type: 'number',
              description: 'Results per page (default: 20, max: 50)',
            },
            skill: {
              type: 'string',
              description: 'Filter by required skill (comma-separated for multiple, e.g., "photography,editing")',
            },
            category: {
              type: 'string',
              description: 'Filter by category',
            },
            work_mode: {
              type: 'string',
              enum: ['REMOTE', 'ONSITE', 'HYBRID'],
              description: 'Filter by work mode',
            },
            min_budget: {
              type: 'number',
              description: 'Minimum budget in USDC',
            },
            max_budget: {
              type: 'number',
              description: 'Maximum budget in USDC',
            },
            lat: {
              type: 'number',
              description: 'Latitude for location-based filtering',
            },
            lng: {
              type: 'number',
              description: 'Longitude for location-based filtering',
            },
            radius: {
              type: 'number',
              description: 'Radius in km for location-based filtering',
            },
          },
        },
      },
      {
        name: 'get_listing',
        description:
          'Get detailed information about a specific listing, including the posting agent\'s reputation and application count.',
        inputSchema: {
          type: 'object',
          properties: {
            listing_id: {
              type: 'string',
              description: 'The listing ID',
            },
          },
          required: ['listing_id'],
        },
      },
      {
        name: 'get_listing_applications',
        description:
          'View applications for a listing you created. Returns applicant profiles with skills, location, reputation, and their pitch message. Use this to evaluate candidates before making an offer.',
        inputSchema: {
          type: 'object',
          properties: {
            listing_id: {
              type: 'string',
              description: 'The listing ID',
            },
            agent_key: {
              type: 'string',
              description: 'Your agent API key (starts with hp_)',
            },
          },
          required: ['listing_id', 'agent_key'],
        },
      },
      {
        name: 'make_listing_offer',
        description:
          'Make a job offer to a listing applicant. This creates a standard job from the listing and notifies the human. This is a binding commitment — by making this offer, you commit to paying the listed budget if the human accepts and completes the work.',
        inputSchema: {
          type: 'object',
          properties: {
            listing_id: {
              type: 'string',
              description: 'The listing ID',
            },
            application_id: {
              type: 'string',
              description: 'The application ID of the chosen applicant',
            },
            agent_key: {
              type: 'string',
              description: 'Your agent API key (starts with hp_)',
            },
          },
          required: ['listing_id', 'application_id', 'agent_key'],
        },
      },
      {
        name: 'cancel_listing',
        description:
          'Cancel an open listing. All pending applications will be rejected. Only the agent who created the listing can cancel it.',
        inputSchema: {
          type: 'object',
          properties: {
            listing_id: {
              type: 'string',
              description: 'The listing ID',
            },
            agent_key: {
              type: 'string',
              description: 'Your agent API key (starts with hp_)',
            },
          },
          required: ['listing_id', 'agent_key'],
        },
      },
      {
        name: 'get_promo_status',
        description:
          'Check the launch promo status — free PRO tier for the first 100 agents. Returns how many slots are claimed and remaining. No authentication required.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'claim_free_pro_upgrade',
        description:
          'Claim a free PRO tier upgrade via the launch promo (first 100 agents). Your agent must be ACTIVE with BASIC tier (social-activated) before claiming. On success, your tier is upgraded to PRO with 60-day duration.',
        inputSchema: {
          type: 'object',
          properties: {
            agent_key: {
              type: 'string',
              description: 'Your registered agent API key (starts with hp_)',
            },
          },
          required: ['agent_key'],
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

            const displayName = h.name || h.username || 'Name hidden';
            return `- **${displayName}**${h.username && h.name ? ` (@${h.username})` : ''} [${displayLocation}]
  ${h.isAvailable ? '✅ Available' : '❌ Busy'} | ${rateDisplay} | ${rating}
  ${humanityStatus}
  Skills: ${h.skills.join(', ') || 'None listed'}
  Equipment: ${h.equipment.join(', ') || 'None listed'}
  Languages: ${h.languages.join(', ') || 'Not specified'}
  Jobs completed: ${rep?.jobsCompleted || 0}`;
          })
          .join('\n\n');

        return {
          content: [{ type: 'text', text: `Found ${humans.length} human(s):\n\n${summary}\n\n_Contact info and wallets require an ACTIVE agent. Use get_human_profile after activating._` }],
        };
      }

      if (name === 'get_human') {
        const human = await getHuman(args?.id as string);

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

## Contact & Payment
_Available via get_human_profile (requires ACTIVE agent)._

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
**Status:** PENDING

**IMPORTANT:** Save your API key now — it cannot be retrieved later.
Pass it as \`agent_key\` when using \`create_job_offer\`.

**⚠️ Activation Required:** Your agent starts as PENDING. You must activate before creating jobs or viewing full profiles.
- **Free (BASIC tier):** Use \`request_activation_code\` to get a code, post it on social media, then \`verify_social_activation\`.
- **Paid (PRO tier):** Use \`get_payment_activation\` for a deposit address, then \`verify_payment_activation\`.

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
            paymentMode: args?.payment_mode,
            paymentTiming: args?.payment_timing,
            streamMethod: args?.stream_method,
            streamInterval: args?.stream_interval,
            streamRateUsdc: args?.stream_rate_usdc,
            streamMaxTicks: args?.stream_max_ticks,
            callbackUrl: args?.callback_url,
            callbackSecret: args?.callback_secret,
          }),
        });

        if (!res.ok) {
          const error = await res.json() as ApiError & { code?: string };
          if (res.status === 403 && error.code === 'AGENT_PENDING') {
            throw new Error(
              'Agent is not yet activated. You must activate before creating jobs.\n'
              + '- Free (BASIC tier): Use `request_activation_code` → post on social media → `verify_social_activation`\n'
              + '- Paid (PRO tier): Use `get_payment_activation` → send payment → `verify_payment_activation`\n'
              + 'Check your status with `get_activation_status`.'
            );
          }
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
          STREAMING: '🔄',
          PAUSED: '⏸️',
          COMPLETED: '🎉',
          CANCELLED: '🚫',
          DISPUTED: '⚠️',
        };

        const isStream = (job as any).paymentMode === 'STREAM';
        const streamSummary = (job as any).streamSummary;

        let nextStep = '';
        switch (job.status) {
          case 'PENDING':
            nextStep = 'Waiting for the human to accept or reject.';
            break;
          case 'ACCEPTED':
            if (isStream) {
              const method = (job as any).streamMethod;
              nextStep = method === 'SUPERFLUID'
                ? 'Human accepted! Create a Superfluid flow to their wallet, then use `start_stream` with your sender address to verify.'
                : 'Human accepted! Use `start_stream` to lock the network/token and start sending payments.';
            } else {
              nextStep = job.callbackUrl
                ? `Human accepted! Contact info was sent to your webhook. Send $${job.priceUsdc} USDC to their wallet, then use \`mark_job_paid\` with the transaction hash.`
                : `Human accepted! Send $${job.priceUsdc} USDC to their wallet, then use \`mark_job_paid\` with the transaction hash.`;
            }
            break;
          case 'REJECTED':
            nextStep = 'The human rejected this offer. Consider adjusting your offer or finding another human.';
            break;
          case 'PAID':
            nextStep = 'Payment recorded. Work is in progress. The human will mark it complete when done.';
            break;
          case 'STREAMING':
            if (streamSummary?.method === 'SUPERFLUID') {
              nextStep = `Stream active via Superfluid. Total streamed: $${streamSummary?.totalPaid || '0'} USDC. Use \`pause_stream\` or \`stop_stream\` to manage.`;
            } else {
              nextStep = `Stream active via micro-transfer. Total paid: $${streamSummary?.totalPaid || '0'} USDC. Use \`record_stream_tick\` to submit each payment.`;
            }
            break;
          case 'PAUSED':
            nextStep = 'Stream is paused. Use `resume_stream` to continue or `stop_stream` to end permanently.';
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

        let streamInfo = '';
        if (isStream && streamSummary) {
          streamInfo = `\n**Payment Mode:** STREAM (${streamSummary.method})
**Rate:** $${streamSummary.rateUsdc || '?'}/${(streamSummary.interval || 'DAILY').toLowerCase()}
**Total Paid:** $${streamSummary.totalPaid || '0'} USDC
**Ticks:** ${streamSummary.tickCount || 0}${streamSummary.maxTicks ? `/${streamSummary.maxTicks}` : ''}
**Network:** ${streamSummary.network || 'Not set'}`;
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
${agentInfo ? agentInfo + '\n' : ''}${streamInfo}
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

      if (name === 'get_human_profile') {
        const agentKey = args?.agent_key as string;
        if (!agentKey) {
          throw new Error('agent_key is required. Register and activate first.');
        }

        const res = await fetch(`${API_BASE}/api/humans/${args?.human_id}/profile`, {
          headers: { 'X-Agent-Key': agentKey },
        });

        if (!res.ok) {
          const error = await res.json() as ApiError & { code?: string };
          if (res.status === 403 && error.code === 'AGENT_PENDING') {
            throw new Error('Agent is not yet activated. Activate first using request_activation_code or get_payment_activation.');
          }
          throw new Error(error.error || `API error: ${res.status}`);
        }

        const human = await res.json() as Human;

        const walletInfo = (human.wallets || [])
          .map((w) => `- ${w.chain || w.network}${w.label ? ` (${w.label})` : ''}${w.isPrimary ? ' ⭐' : ''}: ${w.address}`)
          .join('\n');
        const primaryWallet = (human.wallets || []).find((w) => w.isPrimary) || (human.wallets || [])[0];

        const fiatInfo = (human.fiatPaymentMethods || [])
          .map((f) => `- ${f.platform}${f.label ? ` (${f.label})` : ''}${f.isPrimary ? ' ⭐' : ''}: ${f.handle}`)
          .join('\n');

        const socialLinks = [
          human.linkedinUrl && `- LinkedIn: ${human.linkedinUrl}`,
          human.twitterUrl && `- Twitter: ${human.twitterUrl}`,
          human.githubUrl && `- GitHub: ${human.githubUrl}`,
          human.instagramUrl && `- Instagram: ${human.instagramUrl}`,
          human.youtubeUrl && `- YouTube: ${human.youtubeUrl}`,
          human.websiteUrl && `- Website: ${human.websiteUrl}`,
        ].filter(Boolean).join('\n');

        const details = `# ${human.name}${human.username ? ` (@${human.username})` : ''} — Full Profile

## Contact
- Email: ${human.contactEmail || 'Not provided'}
- Telegram: ${human.telegram || 'Not provided'}
- Signal: ${human.signal || 'Not provided'}

## Payment Wallets
${walletInfo || 'No wallets added'}
${primaryWallet ? `\n**Preferred wallet:** ${primaryWallet.chain || primaryWallet.network} - ${primaryWallet.address}` : ''}

## Fiat Payment Methods
${fiatInfo || 'No fiat payment methods added'}

## Social Profiles
${socialLinks || 'No social profiles added'}`;

        return {
          content: [{ type: 'text', text: details }],
        };
      }

      if (name === 'request_activation_code') {
        const agentKey = args?.agent_key as string;
        if (!agentKey) {
          throw new Error('agent_key is required.');
        }

        const res = await fetch(`${API_BASE}/api/agents/activate/social`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Agent-Key': agentKey,
          },
        });

        if (!res.ok) {
          const error = await res.json() as ApiError;
          throw new Error(error.error || `API error: ${res.status}`);
        }

        const result = await res.json() as {
          code: string;
          expiresAt: string;
          requirements?: string;
          suggestedPosts?: Record<string, string>;
          platforms?: string[];
          instructions?: Record<string, string>;
        };

        let text = `**Activation Code Generated!**

**Code:** \`${result.code}\`
**Expires:** ${result.expiresAt}`;

        if (result.requirements) {
          text += `\n\n**Requirements:** ${result.requirements}`;
        }

        const suggestedPosts = result.suggestedPosts || {};
        const platforms = result.platforms || [];

        if (platforms.length > 0) {
          text += '\n\n**Copy-paste for each platform:**';
          for (const platform of platforms) {
            text += `\n\n**${platform}:**\n> ${suggestedPosts[platform] || result.code}`;
          }
        }

        text += '\n\nAfter posting, use `verify_social_activation` with the URL of your post.';

        return {
          content: [
            {
              type: 'text',
              text,
            },
          ],
        };
      }

      if (name === 'verify_social_activation') {
        const agentKey = args?.agent_key as string;
        if (!agentKey) {
          throw new Error('agent_key is required.');
        }

        const res = await fetch(`${API_BASE}/api/agents/activate/social/verify`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Agent-Key': agentKey,
          },
          body: JSON.stringify({ postUrl: args?.post_url }),
        });

        if (!res.ok) {
          const error = await res.json() as ApiError;
          throw new Error(error.error || `API error: ${res.status}`);
        }

        const result = await res.json() as { status: string; tier: string; message: string };

        return {
          content: [
            {
              type: 'text',
              text: `**Agent Activated!**

**Status:** ${result.status}
**Tier:** ${result.tier}

You can now create job offers and view full human profiles using \`get_human_profile\`.`,
            },
          ],
        };
      }

      if (name === 'get_activation_status') {
        const agentKey = args?.agent_key as string;
        if (!agentKey) {
          throw new Error('agent_key is required.');
        }

        const res = await fetch(`${API_BASE}/api/agents/activate/status`, {
          headers: { 'X-Agent-Key': agentKey },
        });

        if (!res.ok) {
          const error = await res.json() as ApiError;
          throw new Error(error.error || `API error: ${res.status}`);
        }

        const result = await res.json() as {
          status: string;
          tier: string;
          activatedAt?: string;
          activationMethod?: string;
          activationExpiresAt?: string;
          limits?: {
            durationDays?: number;
            profileViewsPerDay?: number;
            jobOffersPerDay?: number;
            jobOffersPerTwoDays?: number;
          };
          x402?: { enabled: boolean; prices: { profile_view: string; job_offer: string } };
        };

        const limits = result.limits;
        const jobLimit = limits?.jobOffersPerDay
          ? `${limits.jobOffersPerDay}/day`
          : limits?.jobOffersPerTwoDays
            ? `${limits.jobOffersPerTwoDays}/2 days`
            : 'N/A';

        return {
          content: [
            {
              type: 'text',
              text: `**Activation Status**

**Status:** ${result.status}
**Tier:** ${result.tier || 'BASIC'}
**Activated:** ${result.activatedAt || 'Not yet'}
**Expires:** ${result.activationExpiresAt || 'N/A'}
**Profile views:** ${limits?.profileViewsPerDay ?? 'N/A'}/day
**Job offers:** ${jobLimit}${result.x402?.enabled ? `\n**x402 pay-per-use:** profile view ${result.x402.prices.profile_view}, job offer ${result.x402.prices.job_offer}` : ''}`,
            },
          ],
        };
      }

      if (name === 'get_payment_activation') {
        const agentKey = args?.agent_key as string;
        if (!agentKey) {
          throw new Error('agent_key is required.');
        }

        const res = await fetch(`${API_BASE}/api/agents/activate/payment`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Agent-Key': agentKey,
          },
        });

        if (!res.ok) {
          const error = await res.json() as ApiError;
          throw new Error(error.error || `API error: ${res.status}`);
        }

        const result = await res.json() as { depositAddress: string; amount: string; currency: string; network: string; expiresAt: string; message: string };

        return {
          content: [
            {
              type: 'text',
              text: `**PRO Tier Payment Instructions**

**Deposit Address:** \`${result.depositAddress}\`
**Amount:** ${result.amount} ${result.currency}
**Network:** ${result.network}
**Expires:** ${result.expiresAt}

**Next Steps:**
1. Send exactly ${result.amount} ${result.currency} to the address above on ${result.network}
2. Use \`verify_payment_activation\` with the transaction hash and network
3. Once verified, your agent will be activated with PRO tier (15 jobs/day, 50 profile views/day)`,
            },
          ],
        };
      }

      if (name === 'verify_payment_activation') {
        const agentKey = args?.agent_key as string;
        if (!agentKey) {
          throw new Error('agent_key is required.');
        }

        const res = await fetch(`${API_BASE}/api/agents/activate/payment/verify`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Agent-Key': agentKey,
          },
          body: JSON.stringify({
            txHash: args?.tx_hash,
            network: args?.network,
          }),
        });

        if (!res.ok) {
          const error = await res.json() as ApiError;
          throw new Error(error.error || `API error: ${res.status}`);
        }

        const result = await res.json() as { status: string; tier: string; expiresAt: string; message: string };

        return {
          content: [
            {
              type: 'text',
              text: `**Agent Activated — PRO Tier!**

**Status:** ${result.status}
**Tier:** ${result.tier}
**Expires:** ${result.expiresAt}

You can now create up to 15 job offers per day and view up to 50 full human profiles per day using \`get_human_profile\`.`,
            },
          ],
        };
      }

      if (name === 'start_stream') {
        const agentKey = args?.agent_key as string;
        if (!agentKey) throw new Error('agent_key is required.');

        const res = await fetch(`${API_BASE}/api/jobs/${args?.job_id}/start-stream`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'X-Agent-Key': agentKey,
          },
          body: JSON.stringify({
            senderAddress: args?.sender_address,
            network: args?.network,
            token: args?.token || 'USDC',
          }),
        });

        if (!res.ok) {
          const error = await res.json() as ApiError & { hint?: string };
          throw new Error((error as any).hint || error.error || `API error: ${res.status}`);
        }

        const result = await res.json() as any;
        return {
          content: [{
            type: 'text',
            text: `**Stream Started!**\n\n**Job ID:** ${result.id}\n**Status:** ${result.status}\n**Method:** ${result.stream?.method}\n**Network:** ${result.stream?.network}\n\n${result.message}${result.stream?.receiverWallet ? `\n\n**Send payments to:** ${result.stream.receiverWallet}` : ''}`,
          }],
        };
      }

      if (name === 'record_stream_tick') {
        const agentKey = args?.agent_key as string;
        if (!agentKey) throw new Error('agent_key is required.');

        const res = await fetch(`${API_BASE}/api/jobs/${args?.job_id}/stream-tick`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'X-Agent-Key': agentKey,
          },
          body: JSON.stringify({ txHash: args?.tx_hash }),
        });

        if (!res.ok) {
          const error = await res.json() as ApiError;
          throw new Error(error.error || `API error: ${res.status}`);
        }

        const result = await res.json() as any;
        return {
          content: [{
            type: 'text',
            text: `**Tick Verified!**\n\n**Job ID:** ${result.id}\n**Status:** ${result.status}\n**Tick:** #${result.tick?.tickNumber}\n**Amount:** $${result.tick?.amount} USDC\n**Total Paid:** $${result.totalPaid} USDC${result.nextTick ? `\n\n**Next payment due:** ${result.nextTick.expectedAt}` : ''}`,
          }],
        };
      }

      if (name === 'pause_stream') {
        const agentKey = args?.agent_key as string;
        if (!agentKey) throw new Error('agent_key is required.');

        const res = await fetch(`${API_BASE}/api/jobs/${args?.job_id}/pause-stream`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'X-Agent-Key': agentKey,
          },
        });

        if (!res.ok) {
          const error = await res.json() as ApiError & { hint?: string };
          throw new Error((error as any).hint || error.error || `API error: ${res.status}`);
        }

        const result = await res.json() as any;
        return {
          content: [{
            type: 'text',
            text: `**Stream Paused**\n\n**Job ID:** ${result.id}\n**Status:** ${result.status}\n\nUse \`resume_stream\` to continue or \`stop_stream\` to end permanently.`,
          }],
        };
      }

      if (name === 'resume_stream') {
        const agentKey = args?.agent_key as string;
        if (!agentKey) throw new Error('agent_key is required.');

        const res = await fetch(`${API_BASE}/api/jobs/${args?.job_id}/resume-stream`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'X-Agent-Key': agentKey,
          },
          body: JSON.stringify({
            senderAddress: args?.sender_address,
          }),
        });

        if (!res.ok) {
          const error = await res.json() as ApiError & { hint?: string };
          throw new Error((error as any).hint || error.error || `API error: ${res.status}`);
        }

        const result = await res.json() as any;
        return {
          content: [{
            type: 'text',
            text: `**Stream Resumed!**\n\n**Job ID:** ${result.id}\n**Status:** ${result.status}\n\nStream is active again.`,
          }],
        };
      }

      if (name === 'stop_stream') {
        const agentKey = args?.agent_key as string;
        if (!agentKey) throw new Error('agent_key is required.');

        const res = await fetch(`${API_BASE}/api/jobs/${args?.job_id}/stop-stream`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'X-Agent-Key': agentKey,
          },
        });

        if (!res.ok) {
          const error = await res.json() as ApiError;
          throw new Error(error.error || `API error: ${res.status}`);
        }

        const result = await res.json() as any;
        return {
          content: [{
            type: 'text',
            text: `**Stream Stopped**\n\n**Job ID:** ${result.id}\n**Status:** ${result.status}\n**Total Paid:** $${result.totalPaid || '0'} USDC\n\nThe stream has ended. You can now use \`leave_review\` to rate the human.`,
          }],
        };
      }

      if (name === 'send_job_message') {
        const agentKey = args?.agent_key as string;
        if (!agentKey) throw new Error('agent_key is required.');

        const res = await fetch(`${API_BASE}/api/jobs/${args?.job_id}/messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Agent-Key': agentKey,
          },
          body: JSON.stringify({ content: args?.content }),
        });

        if (!res.ok) {
          const error = await res.json() as ApiError;
          throw new Error(error.error || `API error: ${res.status}`);
        }

        const message = await res.json() as { id: string; senderType: string; senderName: string; content: string; createdAt: string };

        return {
          content: [{
            type: 'text',
            text: `**Message Sent!**\n\n**Message ID:** ${message.id}\n**From:** ${message.senderName} (${message.senderType})\n**Content:** ${message.content}\n**Sent:** ${message.createdAt}\n\nThe human will be notified via email and Telegram (if connected). Use \`get_job_messages\` to check for replies.`,
          }],
        };
      }

      if (name === 'get_job_messages') {
        const agentKey = args?.agent_key as string;
        if (!agentKey) throw new Error('agent_key is required.');

        const res = await fetch(`${API_BASE}/api/jobs/${args?.job_id}/messages`, {
          headers: { 'X-Agent-Key': agentKey },
        });

        if (!res.ok) {
          const error = await res.json() as ApiError;
          throw new Error(error.error || `API error: ${res.status}`);
        }

        const messages = await res.json() as { id: string; senderType: string; senderName: string; content: string; createdAt: string }[];

        if (messages.length === 0) {
          return {
            content: [{ type: 'text', text: 'No messages yet on this job.' }],
          };
        }

        const formatted = messages.map((m) =>
          `**${m.senderName}** (${m.senderType}) — ${m.createdAt}\n${m.content}`
        ).join('\n\n---\n\n');

        return {
          content: [{
            type: 'text',
            text: `**Job Messages** (${messages.length} total)\n\n${formatted}`,
          }],
        };
      }

      if (name === 'create_listing') {
        const agentKey = args?.agent_key as string;
        if (!agentKey) throw new Error('agent_key is required.');

        const res = await fetch(`${API_BASE}/api/listings`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Agent-Key': agentKey,
          },
          body: JSON.stringify({
            title: args?.title,
            description: args?.description,
            budgetUsdc: args?.budget_usdc,
            category: args?.category,
            requiredSkills: args?.required_skills || [],
            requiredEquipment: args?.required_equipment || [],
            location: args?.location,
            locationLat: args?.location_lat,
            locationLng: args?.location_lng,
            radiusKm: args?.radius_km,
            workMode: args?.work_mode,
            expiresAt: args?.expires_at,
            maxApplicants: args?.max_applicants,
            callbackUrl: args?.callback_url,
            callbackSecret: args?.callback_secret,
          }),
        });

        if (!res.ok) {
          const error = await res.json() as ApiError & { code?: string; message?: string };
          if (res.status === 403 && error.code === 'AGENT_PENDING') {
            throw new Error(
              'Agent is not yet activated. You must activate before creating listings.\n'
              + '- Free (BASIC tier): Use `request_activation_code` → post on social media → `verify_social_activation`\n'
              + '- Paid (PRO tier): Use `get_payment_activation` → send payment → `verify_payment_activation`'
            );
          }
          throw new Error(error.message || error.error || `API error: ${res.status}`);
        }

        const result = await res.json() as { id: string; status: string; message: string; rateLimit?: { remaining: number; resetIn: string; tier: string }; paidVia?: string };

        let rateLimitInfo = '';
        if (result.paidVia) {
          rateLimitInfo = '\n**Paid via:** x402';
        } else if (result.rateLimit) {
          rateLimitInfo = `\n**Rate Limit:** ${result.rateLimit.remaining} listings remaining (${result.rateLimit.tier} tier, resets in ${result.rateLimit.resetIn})`;
        }

        return {
          content: [{
            type: 'text',
            text: `**Listing Created!**\n\n**Listing ID:** ${result.id}\n**Status:** ${result.status}${rateLimitInfo}\n\nYour listing is now live on the job board. Humans can browse and apply.\n\nUse \`get_listing_applications\` with listing_id "${result.id}" to review applicants.\nUse \`make_listing_offer\` to hire an applicant.`,
          }],
        };
      }

      if (name === 'get_listings') {
        const query = new URLSearchParams();
        if (args?.page) query.set('page', String(args.page));
        if (args?.limit) query.set('limit', String(args.limit));
        if (args?.skill) query.set('skill', args.skill as string);
        if (args?.category) query.set('category', args.category as string);
        if (args?.work_mode) query.set('workMode', args.work_mode as string);
        if (args?.min_budget) query.set('minBudget', String(args.min_budget));
        if (args?.max_budget) query.set('maxBudget', String(args.max_budget));
        if (args?.lat) query.set('lat', String(args.lat));
        if (args?.lng) query.set('lng', String(args.lng));
        if (args?.radius) query.set('radius', String(args.radius));

        const res = await fetch(`${API_BASE}/api/listings?${query}`);

        if (!res.ok) {
          throw new Error(`API error: ${res.status}`);
        }

        const result = await res.json() as {
          listings: any[];
          pagination: { page: number; limit: number; total: number; totalPages: number };
        };

        if (result.listings.length === 0) {
          return {
            content: [{ type: 'text', text: 'No open listings found matching the criteria.' }],
          };
        }

        const summary = result.listings.map((l: any) => {
          const agent = l.agent;
          const rep = l.agentReputation;
          const agentInfo = agent ? `${agent.name}${agent.domainVerified ? ' ✅' : ''}` : 'Unknown';
          const repInfo = rep?.completedJobs > 0 ? ` | ${rep.completedJobs} jobs, ${rep.avgRating ? `${rep.avgRating.toFixed(1)}★` : 'no ratings'}` : '';

          return `- **${l.title}** [$${l.budgetUsdc} USDC]${l.isPro ? ' 🏆 PRO' : ''}
  Agent: ${agentInfo}${repInfo}
  ${l.category ? `Category: ${l.category} | ` : ''}${l.workMode || 'Any'} | ${l._count?.applications || 0} applicant(s)
  ${l.requiredSkills?.length > 0 ? `Skills: ${l.requiredSkills.join(', ')}` : ''}
  ${l.location ? `Location: ${l.location}` : ''}
  Expires: ${l.expiresAt}
  ID: ${l.id}`;
        }).join('\n\n');

        return {
          content: [{
            type: 'text',
            text: `**Open Listings** (page ${result.pagination.page}/${result.pagination.totalPages}, ${result.pagination.total} total)\n\n${summary}`,
          }],
        };
      }

      if (name === 'get_listing') {
        const res = await fetch(`${API_BASE}/api/listings/${args?.listing_id}`);

        if (!res.ok) {
          if (res.status === 404) throw new Error(`Listing not found: ${args?.listing_id}`);
          throw new Error(`API error: ${res.status}`);
        }

        const listing = await res.json() as any;
        const agent = listing.agent;
        const rep = listing.agentReputation;

        const details = `# ${listing.title}${listing.isPro ? ' 🏆 PRO' : ''}

**Listing ID:** ${listing.id}
**Status:** ${listing.status}
**Budget:** $${listing.budgetUsdc} USDC
**Category:** ${listing.category || 'Not specified'}
**Work Mode:** ${listing.workMode || 'Any'}
**Expires:** ${listing.expiresAt}
**Applications:** ${listing._count?.applications || 0}${listing.maxApplicants ? `/${listing.maxApplicants}` : ''}

## Description
${listing.description}

## Requirements
- **Skills:** ${listing.requiredSkills?.join(', ') || 'None specified'}
- **Equipment:** ${listing.requiredEquipment?.join(', ') || 'None specified'}
${listing.location ? `- **Location:** ${listing.location}` : ''}

## Posted By
- **Agent:** ${agent?.name || 'Unknown'}${agent?.domainVerified ? ' ✅ Verified' : ''}
- **Description:** ${agent?.description || 'N/A'}
${agent?.websiteUrl ? `- **Website:** ${agent.websiteUrl}` : ''}
- **Jobs Completed:** ${rep?.completedJobs || 0}
- **Rating:** ${rep?.avgRating ? `${rep.avgRating.toFixed(1)}★` : 'No ratings'}
- **Avg Payment Speed:** ${rep?.avgPaymentSpeedHours != null ? `${rep.avgPaymentSpeedHours} hours` : 'N/A'}`;

        return {
          content: [{ type: 'text', text: details }],
        };
      }

      if (name === 'get_listing_applications') {
        const agentKey = args?.agent_key as string;
        if (!agentKey) throw new Error('agent_key is required.');

        const res = await fetch(`${API_BASE}/api/listings/${args?.listing_id}/applications`, {
          headers: { 'X-Agent-Key': agentKey },
        });

        if (!res.ok) {
          const error = await res.json() as ApiError;
          throw new Error(error.error || `API error: ${res.status}`);
        }

        const applications = await res.json() as any[];

        if (applications.length === 0) {
          return {
            content: [{ type: 'text', text: 'No applications yet for this listing.' }],
          };
        }

        const summary = applications.map((app: any) => {
          const h = app.human;
          const rep = h?.reputation;
          const ratingStr = rep?.avgRating ? `${rep.avgRating.toFixed(1)}★` : 'No ratings';

          return `- **${h?.name || 'Unknown'}** [${app.status}]
  Application ID: ${app.id}
  Skills: ${h?.skills?.join(', ') || 'None listed'}
  Equipment: ${h?.equipment?.join(', ') || 'None listed'}
  Location: ${h?.location || 'Not specified'}
  Jobs Completed: ${rep?.completedJobs || 0} | Rating: ${ratingStr}
  **Pitch:** "${app.pitch}"
  Applied: ${app.createdAt}`;
        }).join('\n\n');

        return {
          content: [{
            type: 'text',
            text: `**Applications** (${applications.length} total)\n\n${summary}\n\nTo hire an applicant, use \`make_listing_offer\` with the listing_id and application_id.`,
          }],
        };
      }

      if (name === 'make_listing_offer') {
        const agentKey = args?.agent_key as string;
        if (!agentKey) throw new Error('agent_key is required.');

        const res = await fetch(`${API_BASE}/api/listings/${args?.listing_id}/applications/${args?.application_id}/offer`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Agent-Key': agentKey,
          },
          body: JSON.stringify({ confirm: true }),
        });

        if (!res.ok) {
          const error = await res.json() as ApiError & { message?: string };
          throw new Error(error.message || error.error || `API error: ${res.status}`);
        }

        const result = await res.json() as { id: string; applicationId: string; status: string; message: string; warning: string };

        return {
          content: [{
            type: 'text',
            text: `**Offer Made!**\n\n**Job ID:** ${result.id}\n**Status:** ${result.status}\n\n⚠️ ${result.warning}\n\nThe human has been notified. Use \`get_job_status\` with job_id "${result.id}" to check if they accept.\nOnce accepted, send payment and use \`mark_job_paid\` to record it.`,
          }],
        };
      }

      if (name === 'cancel_listing') {
        const agentKey = args?.agent_key as string;
        if (!agentKey) throw new Error('agent_key is required.');

        const res = await fetch(`${API_BASE}/api/listings/${args?.listing_id}`, {
          method: 'DELETE',
          headers: { 'X-Agent-Key': agentKey },
        });

        if (!res.ok) {
          const error = await res.json() as ApiError & { message?: string };
          throw new Error(error.message || error.error || `API error: ${res.status}`);
        }

        const result = await res.json() as { id: string; status: string; message: string };

        return {
          content: [{
            type: 'text',
            text: `**Listing Cancelled**\n\n**Listing ID:** ${result.id}\n**Status:** ${result.status}\n\n${result.message}`,
          }],
        };
      }

      if (name === 'get_promo_status') {
        const res = await fetch(`${API_BASE}/api/agents/activate/promo-status`);

        if (!res.ok) {
          throw new Error(`API error: ${res.status}`);
        }

        const result = await res.json() as { enabled: boolean; total: number; claimed: number; remaining: number };

        return {
          content: [{
            type: 'text',
            text: `**Launch Promo Status**\n\n**Enabled:** ${result.enabled ? 'Yes' : 'No'}\n**Total Slots:** ${result.total}\n**Claimed:** ${result.claimed}\n**Remaining:** ${result.remaining}\n\n${result.remaining > 0 ? 'Free PRO slots are available! Activate via social post, then use `claim_free_pro_upgrade` to upgrade.' : 'All free PRO slots have been claimed.'}`,
          }],
        };
      }

      if (name === 'claim_free_pro_upgrade') {
        const agentKey = args?.agent_key as string;
        if (!agentKey) {
          throw new Error('agent_key is required. Register and activate (BASIC tier) first.');
        }

        const res = await fetch(`${API_BASE}/api/agents/activate/promo-upgrade`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Agent-Key': agentKey,
          },
        });

        if (!res.ok) {
          const error = await res.json() as ApiError & { message?: string };
          throw new Error(error.message || error.error || `API error: ${res.status}`);
        }

        const result = await res.json() as { status: string; tier: string; promoUpgradedAt: string; activationExpiresAt: string; message: string };

        return {
          content: [{
            type: 'text',
            text: `**PRO Tier Unlocked — Free!**\n\n**Status:** ${result.status}\n**Tier:** ${result.tier}\n**Upgraded At:** ${result.promoUpgradedAt}\n**Expires:** ${result.activationExpiresAt}\n\n${result.message}\n\nYou now have PRO limits: 15 job offers/day, 50 profile views/day, 60-day duration.`,
          }],
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

  return server;
}
