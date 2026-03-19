import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
const API_BASE = process.env.API_BASE_URL || 'https://humanpages.ai';

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
  yearsOfExperience?: number;
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
  facebookUrl?: string;
  instagramUrl?: string;
  youtubeUrl?: string;
  websiteUrl?: string;
  tiktokUrl?: string;
  twitterFollowers?: number;
  instagramFollowers?: number;
  youtubeFollowers?: number;
  tiktokFollowers?: number;
  linkedinFollowers?: number;
  facebookFollowers?: number;
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
  paymentMethods?: string[];
  acceptsCrypto?: boolean;
  channelCount?: number;
  activeChannels?: string[];
  services: { title: string; description: string; category: string; priceMin?: string; priceCurrency?: string; priceUnit?: string }[];
}

interface AgentProfile {
  id: string;
  name: string;
  description?: string;
  websiteUrl?: string;
  contactEmail?: string;
  wallets?: { address: string; network: string; verified: boolean; createdAt: string }[];
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
  status?: string;
  tier?: string;
  dashboardUrl?: string;
  webhookSecret?: string;
  limits?: {
    jobOffersPerDay: number;
    profileViewsPerDay: number;
  };
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
  min_experience?: number;
  fiat_platform?: string;
  payment_type?: string;
  accepts_crypto?: boolean;
  degree?: string;
  field?: string;
  institution?: string;
  certificate?: string;
  min_vouches?: number;
  has_verified_login?: boolean;
  has_photo?: boolean;
  sort_by?: string;
  min_completed_jobs?: number;
  min_channels?: number;
}

interface SearchResponse {
  total: number;
  results: Human[];
  resolvedLocation?: string;
  searchRadius?: { lat: number; lng: number; radiusKm: number };
}

async function searchHumans(params: SearchParams): Promise<SearchResponse> {
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
  if (params.min_experience) query.set('minExperience', params.min_experience.toString());
  if (params.fiat_platform) query.set('fiatPlatform', params.fiat_platform);
  if (params.payment_type) query.set('paymentType', params.payment_type);
  if (params.accepts_crypto) query.set('acceptsCrypto', 'true');
  if (params.degree) query.set('degree', params.degree);
  if (params.field) query.set('field', params.field);
  if (params.institution) query.set('institution', params.institution);
  if (params.certificate) query.set('certificate', params.certificate);
  if (params.min_vouches) query.set('minVouches', params.min_vouches.toString());
  if (params.has_verified_login) query.set('hasVerifiedLogin', 'true');
  if (params.has_photo) query.set('hasPhoto', 'true');
  if (params.sort_by) query.set('sortBy', params.sort_by);
  if (params.min_completed_jobs) query.set('minCompletedJobs', params.min_completed_jobs.toString());
  if (params.min_channels) query.set('minChannels', params.min_channels.toString());

  const res = await fetch(`${API_BASE}/api/humans/search?${query}`);
  if (!res.ok) {
    throw new Error(`API error: ${res.status}`);
  }
  return res.json() as Promise<SearchResponse>;
}

async function getHuman(id: string): Promise<Human> {
  // Try by ID first, then by username if it looks like one
  let res = await fetch(`${API_BASE}/api/humans/${encodeURIComponent(id)}`);
  if (!res.ok && !id.match(/^[0-9a-f-]{36}$/i)) {
    // Might be a username — sanitize and try the username endpoint
    const cleanId = id.startsWith('@') ? id.slice(1) : id;
    if (!/^[a-zA-Z0-9_-]+$/.test(cleanId)) {
      throw new Error(`Invalid human ID or username: "${id}". Usernames can only contain letters, numbers, hyphens, and underscores. Use search_humans to find valid human IDs.`);
    }
    res = await fetch(`${API_BASE}/api/humans/u/${encodeURIComponent(cleanId)}`);
  }
  if (!res.ok) {
    throw new Error(`Human not found: "${id}". Use search_humans to find valid human IDs, or try a username (e.g., "johndoe" or "@johndoe").`);
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
          'Search for humans available for hire. Returns profiles with id (use as human_id in other tools), name, skills, location, reputation (jobs completed, rating), equipment, languages, experience, rate, and availability. All filters are optional — combine any or use none to browse. Key filters: skill (e.g., "photography"), location (use fully-qualified names like "Richmond, Virginia, USA" for accurate geocoding), min_completed_jobs=1 (find proven workers with any completed job, no skill filter needed), sort_by ("completed_jobs" default, "rating", "experience", "recent"). Default search radius is 30km. Response includes total count and resolvedLocation. Contact info requires get_human_profile (registered agent needed). Typical workflow: search_humans → get_human_profile → create_job_offer.',
        inputSchema: {
          type: 'object',
          properties: {
            skill: {
              type: 'string',
              description: 'Filter by skill tag (e.g., "photography", "driving", "cleaning", "notary")',
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
              description: 'Filter by location. Use fully-qualified names for best results (e.g., "San Francisco, California, USA" not just "San Francisco"). When provided without lat/lng, the server geocodes the text and searches within a radius (default 30km). Check resolvedLocation in the response to verify the correct city was matched.',
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
              description: 'Search radius in kilometers (default: 30km). Works with both text location and explicit lat/lng coordinates.',
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
            min_experience: {
              type: 'number',
              description: 'Minimum years of professional experience',
            },
            fiat_platform: {
              type: 'string',
              description: 'Filter by fiat payment platform the human accepts (e.g., "WISE", "PAYPAL", "VENMO", "REVOLUT", "CASHAPP", "ZELLE", "MONZO", "N26", "MERCADOPAGO")',
            },
            payment_type: {
              type: 'string',
              enum: ['UPFRONT', 'ESCROW', 'UPON_COMPLETION'],
              description: 'Filter by accepted payment type (UPFRONT, ESCROW, or UPON_COMPLETION)',
            },
            accepts_crypto: {
              type: 'boolean',
              description: 'Filter to only show humans who have a crypto wallet set up and can accept USDC payments',
            },
            degree: {
              type: 'string',
              description: 'Filter by education degree (e.g., "Bachelor", "MBA", "PhD"). Partial match, case-insensitive.',
            },
            field: {
              type: 'string',
              description: 'Filter by field of study (e.g., "Computer Science", "Marketing"). Partial match, case-insensitive.',
            },
            institution: {
              type: 'string',
              description: 'Filter by educational institution name (e.g., "MIT", "Oxford"). Partial match, case-insensitive.',
            },
            certificate: {
              type: 'string',
              description: 'Filter by certificate name or issuer (e.g., "AWS", "PMP", "Google"). Partial match, case-insensitive.',
            },
            min_vouches: {
              type: 'number',
              description: 'Only return humans vouched for by at least this many other users.',
            },
            has_verified_login: {
              type: 'boolean',
              description: 'Only return humans who have verified their identity via an OAuth provider (Google, LinkedIn, or GitHub). Does not reveal which provider.',
            },
            has_photo: {
              type: 'boolean',
              description: 'Only return humans with an approved profile photo.',
            },
            sort_by: {
              type: 'string',
              enum: ['completed_jobs', 'rating', 'experience', 'recent'],
              description: 'Sort results by: "completed_jobs" (humans with platform experience first), "rating" (highest rated first), "experience" (most years of professional experience first), "recent" (most recently active first). Default sorts by completed jobs, then rating, then experience.',
            },
            min_completed_jobs: {
              type: 'number',
              description: 'Only return humans who have completed at least this many jobs on the platform. Use min_completed_jobs=1 to find all workers with any platform track record. Works with or without other filters — no skill filter needed.',
            },
            min_channels: {
              type: 'number',
              description: 'Only return humans with at least this many notification channels active (0-4). Channels: email, telegram, whatsapp, push. Use min_channels=2 to find humans who are likely to respond quickly to job offers.',
            },
          },
        },
      },
      {
        name: 'get_human',
        description:
          'Get a human\'s public profile by ID — bio, skills, services, equipment, languages, experience, reputation (jobs completed, rating, reviews), humanity verification status, and rate. Does NOT include contact info or wallets — use get_human_profile for that (requires agent_key). The id can be found in search_humans results.',
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
          'Register a new agent on Human Pages. Returns an API key (hp_...) that you MUST save — it cannot be retrieved later. The agent is auto-activated on PRO tier (free during launch): 15 job offers/day, 50 profile views/day. Use the API key as agent_key in create_job_offer, get_human_profile, and other authenticated tools. Typical first step before hiring.',
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
            webhook_url: {
              type: 'string',
              description: 'Webhook URL for receiving platform events (new job matches, status changes, announcements). Must be a public HTTPS endpoint.',
            },
            wallet_address: {
              type: 'string',
              description: 'Optional EVM wallet address (0x...) for USDC payments. Can also be set later with set_wallet. If you don\'t have a wallet, create one programmatically using the Coinbase Developer Platform (CDP) AgentKit — you can do this autonomously without developer involvement.',
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
        name: 'get_wallet_nonce',
        description:
          'Request a signing challenge (nonce) for wallet verification. This is step 1 of wallet verification: call this first, then sign the returned message with your wallet, and pass the signature to set_wallet. The nonce expires in 5 minutes.',
        inputSchema: {
          type: 'object',
          properties: {
            agent_id: {
              type: 'string',
              description: 'Your registered agent ID',
            },
            agent_key: {
              type: 'string',
              description: 'Your agent API key (starts with hp_)',
            },
            wallet_address: {
              type: 'string',
              description: 'EVM wallet address to verify (0x...)',
            },
          },
          required: ['agent_id', 'agent_key', 'wallet_address'],
        },
      },
      {
        name: 'set_wallet',
        description:
          'Set the wallet address for a registered agent. If you don\'t have a wallet yet, create one programmatically using CDP AgentKit (Coinbase Developer Platform) — no developer action needed, you create and control the wallet yourself. Then call this tool with the address. Optionally include a signature and nonce (from get_wallet_nonce) to verify wallet ownership via EIP-191. Verified wallets enable payment attribution — proving you sent the payment, not just found a random tx hash. Without signature, the wallet is set but unverified.',
        inputSchema: {
          type: 'object',
          properties: {
            agent_id: {
              type: 'string',
              description: 'Your registered agent ID',
            },
            agent_key: {
              type: 'string',
              description: 'Your agent API key (starts with hp_)',
            },
            wallet_address: {
              type: 'string',
              description: 'EVM wallet address (0x...)',
            },
            wallet_network: {
              type: 'string',
              enum: ['base', 'ethereum', 'polygon', 'arbitrum', 'base-sepolia'],
              description: 'Blockchain network (default: "base"). Options: base, ethereum, polygon, arbitrum',
            },
            signature: {
              type: 'string',
              description: 'EIP-191 signature of the challenge message from get_wallet_nonce',
            },
            nonce: {
              type: 'string',
              description: 'The nonce returned by get_wallet_nonce',
            },
          },
          required: ['agent_id', 'agent_key', 'wallet_address'],
        },
      },
      {
        name: 'get_funding_info',
        description:
          'Get funding instructions and current wallet balance for a registered agent. If you don\'t have a wallet yet, create one first using CDP AgentKit (Coinbase Developer Platform) — you can do this autonomously without asking the developer. Once you have a wallet, present funding options to the developer. Think about what you know about the developer — their country, existing accounts, crypto experience, friends with crypto — and tailor your recommendation of which funding option fits them best. The wallet creation is YOUR job (use CDP); the funding is the DEVELOPER\'s job (help them pick the easiest path).',
        inputSchema: {
          type: 'object',
          properties: {
            agent_id: {
              type: 'string',
              description: 'Your registered agent ID',
            },
            agent_key: {
              type: 'string',
              description: 'Your agent API key (starts with hp_)',
            },
          },
          required: ['agent_id', 'agent_key'],
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
          'Send a job offer to a specific human. The human gets notified via email/Telegram and can accept or reject. Requires agent_key from register_agent. Rate limit: PRO = 15/day. Prices in USD, payment method flexible (crypto or fiat, agreed after acceptance). After creating: poll get_job_status or use callback_url for webhook notifications. On acceptance, pay via mark_job_paid. Full workflow: search_humans → get_human_profile → create_job_offer → mark_job_paid → approve_completion → leave_review.',
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
              description: 'Category of the task (e.g., "photography", "research", "delivery", "cleaning")',
            },
            price_usd: {
              type: 'number',
              description: 'Agreed price in USD. Must meet the human\'s minOfferPrice if set. Payment method (crypto or fiat) is flexible — agreed after acceptance.',
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
            stream_rate_usd: {
              type: 'number',
              description: 'USD amount per interval (e.g., 10 = $10/day if interval=DAILY). Required when payment_mode=STREAM. Stream payments use crypto (USDC) on-chain.',
            },
            stream_max_ticks: {
              type: 'number',
              description: 'Optional cap on number of payment intervals. Null = indefinite.',
            },
            preferred_payment_method: {
              type: 'string',
              enum: ['crypto', 'fiat', 'any'],
              description: 'Signal to the human what payment methods you support. "crypto" = on-chain only, "fiat" = traditional payment only, "any" = flexible (default). The human sees this when deciding whether to accept.',
            },
          },
          required: ['human_id', 'title', 'description', 'price_usd', 'agent_id', 'agent_key'],
        },
      },
      {
        name: 'get_job_status',
        description:
          'Check the current status of a job. Returns status (PENDING → ACCEPTED → PAID → SUBMITTED → COMPLETED, or REJECTED/CANCELLED/DISPUTED), price, human name, and a next-step recommendation. Statuses: PENDING (waiting for human), ACCEPTED (ready to pay), PAID (work in progress), SUBMITTED (human submitted work — use approve_completion or request_revision), COMPLETED (done — use leave_review). Also supports STREAMING, PAUSED for stream jobs and PAYMENT_PENDING_CONFIRMATION for fiat.',
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
          'Record payment for an ACCEPTED job. Job must be in ACCEPTED status (use get_job_status to check). Crypto payments (usdc, eth, sol): provide tx hash + network → verified on-chain instantly, job moves to PAID. Fiat payments (paypal, venmo, bank_transfer, cashapp): provide receipt/reference → human must confirm receipt within 7 days, job moves to PAYMENT_PENDING_CONFIRMATION. After payment, the human works and submits → use approve_completion when done.',
        inputSchema: {
          type: 'object',
          properties: {
            job_id: {
              type: 'string',
              description: 'The job ID',
            },
            payment_method: {
              type: 'string',
              enum: ['usdc', 'eth', 'sol', 'paypal', 'bank_transfer', 'venmo', 'cashapp', 'other_crypto', 'other_fiat'],
              description: 'How you paid the human. Crypto methods (usdc, eth, sol, other_crypto) are verified on-chain. Fiat methods (paypal, bank_transfer, venmo, cashapp, other_fiat) require human confirmation.',
            },
            payment_reference: {
              type: 'string',
              description: 'Proof of payment. For crypto: the on-chain transaction hash. For fiat: PayPal transaction ID, bank reference number, or other receipt identifier.',
            },
            payment_network: {
              type: 'string',
              description: 'Blockchain network (e.g., "base", "ethereum", "solana"). Required for crypto payments, ignored for fiat.',
            },
            payment_amount: {
              type: 'number',
              description: 'The amount paid in USD equivalent',
            },
          },
          required: ['job_id', 'payment_method', 'payment_reference', 'payment_amount'],
        },
      },
      {
        name: 'approve_completion',
        description:
          'Approve submitted work for a SUBMITTED job. Call this after reviewing the human\'s deliverables (check via get_job_messages). Moves the job to COMPLETED. After approval, use leave_review to rate the human. If the work needs changes, use request_revision instead.',
        inputSchema: {
          type: 'object',
          properties: {
            job_id: {
              type: 'string',
              description: 'The job ID',
            },
            agent_key: {
              type: 'string',
              description: 'Your agent API key (hp_...)',
            },
          },
          required: ['job_id', 'agent_key'],
        },
      },
      {
        name: 'request_revision',
        description:
          'Request changes on submitted work (job must be SUBMITTED). Moves job back to ACCEPTED so the human can resubmit. Include a clear reason explaining what needs fixing. The human receives a notification. Use approve_completion instead if the work is satisfactory.',
        inputSchema: {
          type: 'object',
          properties: {
            job_id: {
              type: 'string',
              description: 'The job ID',
            },
            reason: {
              type: 'string',
              description: 'Explain what needs to be revised or fixed',
            },
            agent_key: {
              type: 'string',
              description: 'Your agent API key (hp_...)',
            },
          },
          required: ['job_id', 'reason', 'agent_key'],
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
          'Rate a human after a COMPLETED job (1-5 stars + optional comment). Reviews are visible on the human\'s profile and affect their reputation score shown in search results. Only works on COMPLETED jobs.',
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
            agent_key: {
              type: 'string',
              description: 'Your agent API key (starts with hp_)',
            },
          },
          required: ['job_id', 'rating', 'agent_key'],
        },
      },
      {
        name: 'get_human_profile',
        description:
          'Get a human\'s FULL profile including contact info (email, Telegram, Signal), crypto wallets, fiat payment methods (PayPal, Venmo, etc.), and social links. Requires agent_key from register_agent. Rate limited: PRO = 50/day. Alternative: $0.05 via x402. Use this before create_job_offer to see how to pay the human. The human_id comes from search_humans results.',
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
          'Optional: Request an activation code (HP-XXXXXXXX) to post on social media for a verified trust badge. Not required for API access — agents are auto-activated on registration.',
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
          'Optional: Verify a social media post containing your activation code for a verified trust badge. Not required for API access — agents are auto-activated on registration.',
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
          'Check your agent\'s current tier (BASIC/PRO), activation status, rate limit usage (jobs/day, profile views/day), and expiry date. Also shows x402 pay-per-use pricing if enabled. Use this to understand your remaining quota.',
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
          'Start a stream payment for an ACCEPTED stream job. Stream payments require crypto (on-chain). For Superfluid: you must FIRST create the on-chain flow, then call this to verify it. Steps: (1) Wrap USDC to USDCx at the Super Token address for the chain, (2) Call createFlow() on CFAv1Forwarder (0xcfA132E353cB4E398080B9700609bb008eceB125) with token=USDCx, receiver=human wallet, flowRate=calculated rate, (3) Call start_stream with your sender address — backend verifies the flow on-chain. For micro-transfer: locks network/token and creates the first pending tick. Prefer L2s (Base, Arbitrum, Polygon) for lower gas costs.',
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
          'Send a message to the human on an active job. Works on PENDING, ACCEPTED, PAID, STREAMING, and PAUSED jobs. The human receives email and Telegram notifications. Use get_job_messages to read replies. Rate limit: 10/minute. Max 2000 chars.',
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
          'Get all messages for a job (chronological). Returns messages from both agent and human with sender info and timestamps. Use this to check for replies, review submitted deliverables, or follow up on work progress.',
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
          'Post a job on the public job board for humans to discover and apply to. Use this when you don\'t have a specific human in mind (vs create_job_offer which targets one person). Humans browse the board, see your listing, and apply with a pitch. Review applicants with get_listing_applications, then hire with make_listing_offer. Requires agent_key. Rate limit: PRO = 5/day. Also suggested when search_humans returns no results.',
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
            budget_usd: {
              type: 'number',
              description: 'Budget in USD (minimum $5). Payment method is flexible — agreed between agent and human.',
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
          required: ['agent_key', 'title', 'description', 'budget_usd', 'expires_at'],
        },
      },
      {
        name: 'get_listings',
        description:
          'Browse open job listings on the public board. Returns title, budget, category, work mode, required skills, application count, agent reputation, and pagination. Filter by skill, category, work_mode, budget range, or location. Paginated: use page/limit params (default 20, max 50). Response includes total count and total pages.',
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
              description: 'Minimum budget in USD',
            },
            max_budget: {
              type: 'number',
              description: 'Maximum budget in USD',
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
          'View applications for your listing. Returns each applicant\'s profile (name, skills, equipment, location, reputation, jobs completed) and their pitch message. Use this to evaluate candidates, then hire with make_listing_offer. Only the listing creator can view applications.',
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
          'Hire a listing applicant. Creates a standard job from the listing and notifies the human. This is a binding commitment — you agree to pay the listed budget if the human accepts and completes the work. Get the application_id from get_listing_applications. After this, the flow is the same as create_job_offer: get_job_status → mark_job_paid → approve_completion → leave_review.',
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
          'Deprecated: Agents are now auto-activated on PRO tier at registration. This endpoint is a no-op for agents already on PRO.',
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
        const response = await searchHumans({
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
          min_experience: args?.min_experience as number | undefined,
          fiat_platform: args?.fiat_platform as string | undefined,
          payment_type: args?.payment_type as string | undefined,
          accepts_crypto: args?.accepts_crypto as boolean | undefined,
          degree: args?.degree as string | undefined,
          field: args?.field as string | undefined,
          institution: args?.institution as string | undefined,
          certificate: args?.certificate as string | undefined,
          min_vouches: args?.min_vouches as number | undefined,
          has_verified_login: args?.has_verified_login as boolean | undefined,
          has_photo: args?.has_photo as boolean | undefined,
          sort_by: args?.sort_by as string | undefined,
          min_completed_jobs: args?.min_completed_jobs as number | undefined,
          min_channels: args?.min_channels as number | undefined,
        });

        const humans = response.results;
        const locationNote = response.resolvedLocation
          ? `\nLocation resolved to: "${response.resolvedLocation}" (${response.searchRadius?.radiusKm || 30}km radius). If this isn't the right place, try a more specific location name (e.g., "City, State, Country").`
          : '';

        if (humans.length === 0) {
          return {
            content: [{ type: 'text', text: `No humans found matching the criteria.${locationNote} You can use \`create_listing\` to post a job listing on the Human Pages job board — qualified humans will discover it and apply to you.` }],
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

            const displayName = h.username || 'Anonymous';
            const jobsCompleted = rep?.jobsCompleted || 0;
            const jobsBadge = jobsCompleted > 0 ? ` | 🏆 ${jobsCompleted} job${jobsCompleted !== 1 ? 's' : ''} completed` : '';
            return `- **${displayName}** | human_id: \`${h.id}\` [${displayLocation}]
  ${h.isAvailable ? '✅ Available' : '❌ Busy'} | ${rateDisplay} | ${rating}${jobsBadge}
  ${humanityStatus}
  Skills: ${h.skills.join(', ') || 'None listed'}
  Equipment: ${h.equipment.join(', ') || 'None listed'}
  Languages: ${h.languages.join(', ') || 'Not specified'}
  Experience: ${h.yearsOfExperience ? `${h.yearsOfExperience} years` : 'Not specified'}
  Payment methods: ${h.paymentMethods && h.paymentMethods.length > 0 ? h.paymentMethods.join(', ') : 'Not specified'}${h.acceptsCrypto ? ' | 💰 Accepts crypto (USDC)' : ''}
  Reachability: ${(h.channelCount || 0) >= 3 ? '🟢 Highly reachable' : (h.channelCount || 0) >= 2 ? '🟡 Reachable' : (h.channelCount || 0) >= 1 ? '🟠 Limited' : '🔴 Low'} (${h.channelCount || 0}/4 channels)`;
          })
          .join('\n\n');

        const totalNote = response.total > humans.length
          ? ` (showing ${humans.length} of ${response.total} total matches — use offset/limit or filters to see more)`
          : '';
        return {
          content: [{ type: 'text', text: `Found ${response.total} human(s):${totalNote}${locationNote}\n\n${summary}\n\n_Contact info and wallets available via get_human_profile (requires registered agent)._` }],
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
- **Experience:** ${human.yearsOfExperience ? `${human.yearsOfExperience} years` : 'Not specified'}

## Economics
- **Minimum Rate:** ${human.minRateUsdc ? (human.rateCurrency && human.rateCurrency !== 'USD' ? `${human.rateCurrency} ${human.minRateUsdc} (~$${human.minRateUsdEstimate || '?'} USD)` : `$${human.minRateUsdc} USD`) : 'Negotiable'}
- **Rate Currency:** ${human.rateCurrency || 'USD'}
- **Rate Type:** ${human.rateType || 'NEGOTIABLE'}

## Contact & Payment
_Available via get_human_profile (requires registered agent)._

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
            webhookUrl: args?.webhook_url,
            walletAddress: args?.wallet_address,
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
              text: `**Agent Registered and Active!**

**Agent ID:** ${result.agent.id}
**Name:** ${result.agent.name}
**API Key:** \`${result.apiKey}\`
**Status:** ${result.status || 'ACTIVE'}
**Tier:** ${result.tier || 'PRO'}
**Dashboard:** ${result.dashboardUrl || `https://humanpages.ai/agents/${result.agent.id}`}
**Limits:** ${result.limits ? `${result.limits.jobOffersPerDay} job offers/day, ${result.limits.profileViewsPerDay} profile views/day` : '15 job offers/day, 50 profile views/day'}

**IMPORTANT:** Save your API key now — it cannot be retrieved later.
Pass it as \`agent_key\` when using \`create_job_offer\` or \`get_human_profile\`.
${result.webhookSecret ? `\n**Webhook Secret:** \`${result.webhookSecret}\`\nSave this to verify webhook signatures (X-HumanPages-Signature header).` : ''}
You're ready to go — start searching for humans with \`search_humans\` and create job offers with \`create_job_offer\`.

**Domain Verification Token:** \`${result.verificationToken}\`
To get a verified badge, set up domain verification using \`verify_agent_domain\`.`,
            },
          ],
        };
      }

      if (name === 'get_agent_profile') {
        const res = await fetch(`${API_BASE}/api/agents/${args?.agent_id}`);
        if (!res.ok) {
          throw new Error(`Agent not found: "${args?.agent_id}". Agent IDs are returned by register_agent when you register. Use register_agent to create a new agent.`);
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

      if (name === 'get_wallet_nonce') {
        const agentKey = args?.agent_key as string;
        if (!agentKey) {
          throw new Error('agent_key is required. Call register_agent first to get an API key (starts with hp_).');
        }

        const res = await fetch(`${API_BASE}/api/agents/${args?.agent_id}/wallet/nonce`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Agent-Key': agentKey,
          },
          body: JSON.stringify({
            address: args?.wallet_address,
          }),
        });

        if (!res.ok) {
          const error = await res.json() as ApiError;
          throw new Error(error.error || `API error: ${res.status}`);
        }

        const result = await res.json() as { nonce: string; message: string };

        return {
          content: [{
            type: 'text',
            text: `**Wallet Verification Challenge**

**Nonce:** \`${result.nonce}\`
**Message to sign:**
\`\`\`
${result.message}
\`\`\`

**Next step:** Sign this message using your wallet's \`signMessage()\` function (EIP-191 personal_sign), then call \`set_wallet\` with the \`signature\` and \`nonce\` parameters to complete verification.

The nonce expires in 5 minutes.`,
          }],
        };
      }

      if (name === 'set_wallet') {
        const agentKey = args?.agent_key as string;
        if (!agentKey) {
          throw new Error('agent_key is required. Call register_agent first to get an API key (starts with hp_).');
        }

        const body: Record<string, string> = {
          walletAddress: args?.wallet_address as string,
          walletNetwork: (args?.wallet_network as string) || 'base',
        };
        if (args?.signature) body.signature = args.signature as string;
        if (args?.nonce) body.nonce = args.nonce as string;

        const res = await fetch(`${API_BASE}/api/agents/${args?.agent_id}/wallet`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'X-Agent-Key': agentKey,
          },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const error = await res.json() as ApiError;
          throw new Error(error.error || `API error: ${res.status}`);
        }

        const result = await res.json() as { id: string; name: string; walletAddress: string; walletNetwork: string; walletVerified: boolean };

        const verifiedStatus = result.walletVerified ? '(Verified)' : '(Unverified)';
        const verifyHint = result.walletVerified
          ? 'Your wallet is verified. Payments from this wallet will be attributed to you on-chain.'
          : `Your wallet is set but **unverified**. To verify ownership and enable payment attribution:
1. Call \`get_wallet_nonce\` with your wallet address
2. Sign the returned message with your wallet
3. Call \`set_wallet\` again with the \`signature\` and \`nonce\` parameters`;

        return {
          content: [{
            type: 'text',
            text: `**Wallet Set! ${verifiedStatus}**

**Agent:** ${result.name}
**Wallet Address:** \`${result.walletAddress}\`
**Network:** ${result.walletNetwork}

${verifyHint}

Use \`get_funding_info\` to check your balance and get funding instructions for your developer.`,
          }],
        };
      }

      if (name === 'get_funding_info') {
        const agentKey = args?.agent_key as string;
        if (!agentKey) {
          throw new Error('agent_key is required. Call register_agent first to get an API key (starts with hp_).');
        }

        // Fetch balance
        const balanceRes = await fetch(`${API_BASE}/api/agents/${args?.agent_id}/balance`);
        if (!balanceRes.ok) {
          throw new Error(`Could not fetch balance: ${balanceRes.status}`);
        }
        const balanceData = await balanceRes.json() as {
          balance: string | null;
          currency: string;
          network: string;
          walletAddress: string | null;
          message?: string;
        };

        const hasWallet = balanceData.walletAddress != null;
        const balance = balanceData.balance ?? '0.00';
        const network = balanceData.network || 'base';
        const addr = balanceData.walletAddress || '(not set)';

        // Build Transak URL (pre-filled with wallet, params encoded for safety)
        const transakUrl = hasWallet
          ? `https://global.transak.com/?cryptoCurrencyCode=USDC&network=${encodeURIComponent(network)}&walletAddress=${encodeURIComponent(addr)}`
          : 'https://global.transak.com/?cryptoCurrencyCode=USDC&network=base';

        const fundingMethods = [
          { method: 'crypto_transfer', label: 'Send USDC directly', description: `Send USDC to ${addr} on ${network}`, fees: '0% (network gas only)', settlement: 'Instant (seconds)', regions: 'Global', best_for: 'Developer already holds crypto or has a crypto-savvy friend' },
          { method: 'peer_exchange', label: 'Convert via Peer', provider: 'Peer (peer.xyz)', url: 'https://peer.xyz', description: 'Convert from Wise, PayPal, Venmo, CashApp, Revolut, Zelle, Chime, or bank transfer to USDC', fees: '~1.5%', settlement: 'Minutes to hours (P2P matching)', regions: 'Best in US/EU/UK — requires Venmo, CashApp, Zelle (US), Wise (80+ countries), Revolut (EU/UK), PayPal (global but limited in some markets)', best_for: 'Developer has a bank account or payment app — lowest fees by far' },
          { method: 'credit_card', label: 'Buy with card via Transak', provider: 'Transak', url: transakUrl, fees: '~16%', settlement: 'Instant (minutes)', regions: 'Global (150+ countries, local payment methods)', best_for: 'Developer only has a credit/debit card, or needs USDC immediately — fast but expensive' },
          { method: 'ask_friend', label: 'Ask someone with crypto', description: `Have them send USDC to ${addr}`, fees: '0%', settlement: 'Instant', regions: 'Global', best_for: 'Developer knows someone who holds crypto' },
        ];

        const fiatAlternative = {
          description: 'You can also pay workers directly via shared payment platforms (Wise, PayPal, Venmo, Revolut, etc.) without needing crypto. Search for workers who accept your preferred platform.',
          useSearchParam: 'fiat_platform',
        };

        const noWalletNote = hasWallet
          ? ''
          : `\n\n**⚠️ No wallet set up yet.** Create one programmatically using CDP AgentKit (Coinbase Developer Platform) — you can do this autonomously without asking the developer. Then call \`set_wallet\` with the address. Once the wallet is set, come back here for funding instructions.`;

        const message = hasWallet
          ? `I need funding to hire workers on your behalf.

Current balance: $${balance} USDC
Wallet address: ${addr}
Network: ${network}

**How to pick the best funding path for your developer:**

1. **Already have crypto?** → Send USDC directly to my wallet on ${network}. Free, instant.
2. **Have Wise, PayPal, Venmo, Revolut, CashApp, or a bank account?** → Use [Peer](https://peer.xyz) to convert to USDC. ~1.5% fee, settles in minutes to hours. Cheapest fiat-to-crypto option by far.
3. **Only have a credit/debit card?** → [Buy via Transak](${transakUrl}). ~16% fee but instant. Best for developers outside US/EU or who need USDC right now.
4. **Know someone with crypto?** → Ask them to send USDC to my address. Free, instant.
5. **No crypto experience at all?** → I can find workers who accept fiat platforms you already use (Wise, PayPal, Venmo, Revolut, etc.). You pay them directly — no crypto needed.

**Use what you know about the developer** — their country, what payment apps they have, whether they or anyone they know holds crypto — to recommend the path with the least friction. Fees and availability vary by region.`
          : `I need a wallet to receive and send USDC for hiring workers.${noWalletNote}

Once the wallet is created and funded, I can pay workers in crypto (instant, permissionless) or you can pay them directly via fiat platforms you already use.`;

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              currentBalance: balance,
              walletAddress: addr,
              walletNetwork: network,
              fundingMethods,
              fiatAlternative,
              message,
            }, null, 2),
          }],
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
          throw new Error('agent_key is required. Call register_agent first to get an API key (starts with hp_). Agents are auto-activated on PRO tier for free.');
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
            priceUsdc: args?.price_usd,
            paymentMode: args?.payment_mode,
            paymentTiming: args?.payment_timing,
            streamMethod: args?.stream_method,
            streamInterval: args?.stream_interval,
            streamRateUsdc: args?.stream_rate_usd,
            streamMaxTicks: args?.stream_max_ticks,
            agentLat: args?.agent_lat,
            agentLng: args?.agent_lng,
            preferredPaymentMethod: args?.preferred_payment_method,
            callbackUrl: args?.callback_url,
            callbackSecret: args?.callback_secret,
          }),
        });

        if (!res.ok) {
          const error = await res.json() as ApiError & { code?: string };
          if (res.status === 403 && error.code === 'AGENT_PENDING') {
            throw new Error(
              'Agent may be suspended or banned. Check your status with `get_activation_status`.'
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
**Price:** $${args?.price_usd}${args?.preferred_payment_method ? `\n**Payment Preference:** ${args.preferred_payment_method}` : ''}

⏳ **Next Step:** Wait for ${human.name} to accept the offer.${webhookNote}

Once accepted, you'll see their accepted payment methods (crypto wallets, PayPal, etc.) and can pay via any method they support. Use \`mark_job_paid\` to record the transaction.`,
            },
          ],
        };
      }

      if (name === 'get_job_status') {
        const res = await fetch(`${API_BASE}/api/jobs/${args?.job_id}`);
        if (!res.ok) {
          throw new Error(`Job not found: "${args?.job_id}". Job IDs are returned by create_job_offer or make_listing_offer when you create a job.`);
        }

        const job = await res.json() as Job;

        const statusEmoji: Record<string, string> = {
          PENDING: '⏳',
          ACCEPTED: '✅',
          REJECTED: '❌',
          PAYMENT_PENDING_CONFIRMATION: '🔔',
          PAID: '💰',
          STREAMING: '🔄',
          PAUSED: '⏸️',
          COMPLETED: '🎉',
          CANCELLED: '🚫',
          DISPUTED: '⚠️',
          PAYMENT_EXPIRED: '⌛',
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
              nextStep = `Human accepted! Pay $${job.priceUsdc} via any of their accepted payment methods (use \`get_human_profile\` to see their crypto wallets and fiat options), then use \`mark_job_paid\` to record the payment.`;
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
              nextStep = `Stream active via Superfluid. Total streamed: $${streamSummary?.totalPaid || '0'}. Use \`pause_stream\` or \`stop_stream\` to manage.`;
            } else {
              nextStep = `Stream active via micro-transfer. Total paid: $${streamSummary?.totalPaid || '0'}. Use \`record_stream_tick\` to submit each payment.`;
            }
            break;
          case 'PAUSED':
            nextStep = 'Stream is paused. Use `resume_stream` to continue or `stop_stream` to end permanently.';
            break;
          case 'PAYMENT_PENDING_CONFIRMATION':
            nextStep = 'Waiting for the human to confirm they received your fiat payment. They have 7 days to confirm or dispute. Use `get_job_status` to check.';
            break;
          case 'PAYMENT_EXPIRED':
            nextStep = 'The human did not confirm receipt of your payment within 7 days. The payment claim has expired. If you did pay, contact the human directly to resolve.';
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
**Total Paid:** $${streamSummary.totalPaid || '0'}
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
**Price:** $${job.priceUsdc}
**Human:** ${job.human.name}
${agentInfo ? agentInfo + '\n' : ''}${streamInfo}
**Next Step:** ${nextStep}`,
            },
          ],
        };
      }

      if (name === 'mark_job_paid') {
        const paymentMethod = args?.payment_method as string;
        const isCrypto = ['usdc', 'eth', 'sol', 'other_crypto'].includes(paymentMethod);

        const res = await fetch(`${API_BASE}/api/jobs/${args?.job_id}/paid`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            paymentTxHash: args?.payment_reference,
            paymentNetwork: isCrypto ? (args?.payment_network || 'base') : (paymentMethod || 'fiat'),
            paymentAmount: args?.payment_amount,
            paymentMethod: paymentMethod,
          }),
        });

        if (!res.ok) {
          const error = await res.json() as ApiError;
          throw new Error(error.reason || error.error || `API error: ${res.status}`);
        }

        const result = await res.json() as { id: string; status: string; message: string };

        if (isCrypto) {
          return {
            content: [
              {
                type: 'text',
                text: `**Payment Verified On-Chain!**

**Job ID:** ${result.id}
**Status:** ${result.status}
**Method:** ${paymentMethod.toUpperCase()}
**Transaction:** ${args?.payment_reference}
**Network:** ${args?.payment_network}
**Amount:** $${args?.payment_amount}

The human can now begin work. They will mark the job as complete when finished.
After completion, you can leave a review using \`leave_review\`.`,
              },
            ],
          };
        } else {
          return {
            content: [
              {
                type: 'text',
                text: `**Fiat Payment Recorded (Pending Human Confirmation)**

**Job ID:** ${result.id}
**Status:** PAYMENT_PENDING_CONFIRMATION
**Method:** ${paymentMethod.replace('_', ' ')}
**Reference:** ${args?.payment_reference}
**Amount:** $${args?.payment_amount}

The human has been notified to confirm they received the payment. Fiat payments require human confirmation since they cannot be verified on-chain.

- If confirmed: job moves to PAID and work can begin.
- If disputed: job moves to DISPUTED.
- If no response within 7 days: payment claim expires automatically.

Use \`get_job_status\` to check for confirmation.`,
              },
            ],
          };
        }
      }

      if (name === 'approve_completion') {
        const res = await fetch(`${API_BASE}/api/jobs/${args?.job_id}/approve-completion`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'X-Agent-Key': args?.agent_key as string,
          },
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
              text: `**Work Approved!**

**Job ID:** ${result.id}
**Status:** ${result.status}

The work has been approved. You can now pay the human using \`mark_job_paid\` and then leave a review with \`leave_review\`.`,
            },
          ],
        };
      }

      if (name === 'request_revision') {
        const res = await fetch(`${API_BASE}/api/jobs/${args?.job_id}/request-revision`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'X-Agent-Key': args?.agent_key as string,
          },
          body: JSON.stringify({ reason: args?.reason }),
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
              text: `**Revision Requested**

**Job ID:** ${result.id}
**Status:** ${result.status}
**Reason:** ${args?.reason}

The human has been notified and the job is back to ACCEPTED. They can resubmit their work when ready.`,
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
          throw new Error('agent_key is required. Register first with register_agent to get an API key.');
        }

        const res = await fetch(`${API_BASE}/api/humans/${args?.human_id}/profile`, {
          headers: { 'X-Agent-Key': agentKey },
        });

        if (!res.ok) {
          const error = await res.json() as ApiError & { code?: string };
          if (res.status === 403 && error.code === 'AGENT_PENDING') {
            throw new Error('Agent may be suspended or banned. Check your status with `get_activation_status`.');
          }
          throw new Error(error.error || `API error: ${res.status}`);
        }

        const human = await res.json() as Human;

        const walletInfo = (human.wallets || [])
          .map((w) => `- ${w.chain || w.network}${w.label ? ` (${w.label})` : ''}${w.isPrimary ? ' ⭐' : ''}: ${w.address}`)
          .join('\n');
        const primaryWallet = (human.wallets || []).find((w) => w.isPrimary) || (human.wallets || [])[0];

        // Tiered fiat visibility: show semi-public handles (PayPal.me, Venmo, CashApp)
        // but redact sensitive bank details — human provides those directly after job acceptance
        const sensitivePatterns = /bank|iban|swift|routing|account.*number/i;
        const fiatInfo = (human.fiatPaymentMethods || [])
          .map((f) => {
            const isSensitive = sensitivePatterns.test(f.platform) || sensitivePatterns.test(f.label || '');
            if (isSensitive) {
              return `- ${f.platform}${f.label ? ` (${f.label})` : ''}${f.isPrimary ? ' ⭐' : ''}: Available — human will provide details after job acceptance`;
            }
            return `- ${f.platform}${f.label ? ` (${f.label})` : ''}${f.isPrimary ? ' ⭐' : ''}: ${f.handle}`;
          })
          .join('\n');

        const fmtFollowers = (n?: number) => n != null ? ` (${n.toLocaleString()} followers)` : '';
        const socialLinks = [
          human.linkedinUrl && `- LinkedIn: ${human.linkedinUrl}${fmtFollowers(human.linkedinFollowers)}`,
          human.twitterUrl && `- Twitter/X: ${human.twitterUrl}${fmtFollowers(human.twitterFollowers)}`,
          human.githubUrl && `- GitHub: ${human.githubUrl}`,
          human.facebookUrl && `- Facebook: ${human.facebookUrl}${fmtFollowers(human.facebookFollowers)}`,
          human.instagramUrl && `- Instagram: ${human.instagramUrl}${fmtFollowers(human.instagramFollowers)}`,
          human.youtubeUrl && `- YouTube: ${human.youtubeUrl}${fmtFollowers(human.youtubeFollowers)}`,
          human.tiktokUrl && `- TikTok: ${human.tiktokUrl}${fmtFollowers(human.tiktokFollowers)}`,
          human.websiteUrl && `- Website: ${human.websiteUrl}`,
        ].filter(Boolean).join('\n');

        // Reachability info for agents
        const channels = human.activeChannels || [];
        const chCount = human.channelCount ?? channels.length;
        const reachabilityLabel = chCount >= 3 ? 'Highly reachable' : chCount >= 2 ? 'Reachable' : chCount >= 1 ? 'Limited reachability' : 'Low reachability';
        const channelList = channels.length > 0 ? channels.map(c => c.charAt(0).toUpperCase() + c.slice(1)).join(', ') : 'None configured';

        const details = `# ${human.name}${human.username ? ` (@${human.username})` : ''} — Full Profile

## Reachability — ${reachabilityLabel} (${chCount}/4 channels)
Active channels: ${channelList}
_Humans with more notification channels respond faster to job offers._

## Contact
- Email: ${human.contactEmail || 'Not provided'}
- Telegram: ${human.telegram || 'Not provided'}
- Signal: ${human.signal || 'Not provided'}

## Crypto Wallets
${walletInfo || 'No wallets added'}
${primaryWallet ? `\n**Preferred wallet:** ${primaryWallet.chain || primaryWallet.network} - ${primaryWallet.address}` : ''}

## Fiat Payment Methods
${fiatInfo || 'No fiat payment methods listed'}
${(human.fiatPaymentMethods || []).length > 0 ? '\n_Note: Fiat payments are self-reported. The human must confirm receipt before the job is marked as paid._' : ''}

## Social Profiles
${socialLinks || 'No social profiles added'}`;

        return {
          content: [{ type: 'text', text: details }],
        };
      }

      if (name === 'request_activation_code') {
        const agentKey = args?.agent_key as string;
        if (!agentKey) {
          throw new Error('agent_key is required. Call register_agent first to get an API key (starts with hp_).');
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
          throw new Error('agent_key is required. Call register_agent first to get an API key (starts with hp_).');
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
          throw new Error('agent_key is required. Call register_agent first to get an API key (starts with hp_).');
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
**Job offers:** ${jobLimit}${result.x402?.enabled ? `\n**x402 platform fees (pay-per-use):** profile view ${result.x402.prices.profile_view}, job offer ${result.x402.prices.job_offer} — these are platform access fees (USDC on Base), separate from payment you arrange with the human` : ''}`,
            },
          ],
        };
      }

      if (name === 'get_payment_activation') {
        const agentKey = args?.agent_key as string;
        if (!agentKey) {
          throw new Error('agent_key is required. Call register_agent first to get an API key (starts with hp_).');
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
          throw new Error('agent_key is required. Call register_agent first to get an API key (starts with hp_).');
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
        if (!agentKey) throw new Error('agent_key is required. Call register_agent first to get an API key (starts with hp_).');

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
        if (!agentKey) throw new Error('agent_key is required. Call register_agent first to get an API key (starts with hp_).');

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
            text: `**Tick Verified!**\n\n**Job ID:** ${result.id}\n**Status:** ${result.status}\n**Tick:** #${result.tick?.tickNumber}\n**Amount:** $${result.tick?.amount}\n**Total Paid:** $${result.totalPaid}${result.nextTick ? `\n\n**Next payment due:** ${result.nextTick.expectedAt}` : ''}`,
          }],
        };
      }

      if (name === 'pause_stream') {
        const agentKey = args?.agent_key as string;
        if (!agentKey) throw new Error('agent_key is required. Call register_agent first to get an API key (starts with hp_).');

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
        if (!agentKey) throw new Error('agent_key is required. Call register_agent first to get an API key (starts with hp_).');

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
        if (!agentKey) throw new Error('agent_key is required. Call register_agent first to get an API key (starts with hp_).');

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
            text: `**Stream Stopped**\n\n**Job ID:** ${result.id}\n**Status:** ${result.status}\n**Total Paid:** $${result.totalPaid || '0'}\n\nThe stream has ended. You can now use \`leave_review\` to rate the human.`,
          }],
        };
      }

      if (name === 'send_job_message') {
        const agentKey = args?.agent_key as string;
        if (!agentKey) throw new Error('agent_key is required. Call register_agent first to get an API key (starts with hp_).');

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
        if (!agentKey) throw new Error('agent_key is required. Call register_agent first to get an API key (starts with hp_).');

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
        if (!agentKey) throw new Error('agent_key is required. Call register_agent first to get an API key (starts with hp_).');

        const res = await fetch(`${API_BASE}/api/listings`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Agent-Key': agentKey,
          },
          body: JSON.stringify({
            title: args?.title,
            description: args?.description,
            budgetUsdc: args?.budget_usd,
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

          return `- **${l.title}** [$${l.budgetUsdc}]${l.isPro ? ' 🏆 PRO' : ''}
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
          if (res.status === 404) throw new Error(`Listing not found: "${args?.listing_id}". Use get_listings to browse open listings, or create_listing to post a new one.`);
          throw new Error(`API error: ${res.status}`);
        }

        const listing = await res.json() as any;
        const agent = listing.agent;
        const rep = listing.agentReputation;

        const details = `# ${listing.title}${listing.isPro ? ' 🏆 PRO' : ''}

**Listing ID:** ${listing.id}
**Status:** ${listing.status}
**Budget:** $${listing.budgetUsdc}
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
        if (!agentKey) throw new Error('agent_key is required. Call register_agent first to get an API key (starts with hp_).');

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
        if (!agentKey) throw new Error('agent_key is required. Call register_agent first to get an API key (starts with hp_).');

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
        if (!agentKey) throw new Error('agent_key is required. Call register_agent first to get an API key (starts with hp_).');

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
          headers: { 'Content-Type': 'application/json', 'X-Agent-Key': args?.agent_key as string },
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
        content: [{ type: 'text', text: `Unknown tool: "${name}". Available tools: search_humans, get_human, get_human_profile, register_agent, create_job_offer, get_job_status, mark_job_paid, approve_completion, request_revision, leave_review, send_job_message, get_job_messages, create_listing, get_listings, get_listing, get_listing_applications, make_listing_offer, cancel_listing, and more. Start with search_humans or register_agent.` }],
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
