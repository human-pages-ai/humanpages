import { z } from "zod";
import { ActionProvider, CreateAction, Network, EvmWalletProvider } from "@coinbase/agentkit";
import { HUMANPAGES_API_BASE_URL } from "./constants";
import {
  SearchHumansSchema,
  ViewHumanProfileSchema,
  CreateJobOfferSchema,
  GetJobStatusSchema,
  MarkJobPaidSchema,
  CreateListingSchema,
  BrowseListingsSchema,
  LeaveReviewSchema,
  SendJobMessageSchema,
  GetJobMessagesSchema,
  SetWalletSchema,
} from "./schemas";

export interface HumanPagesActionProviderConfig {
  apiKey?: string;
  agentId?: string;
  apiBaseUrl?: string;
}

export class HumanPagesActionProvider extends ActionProvider {
  private readonly apiKey: string;
  private readonly agentId: string;
  private readonly baseUrl: string;

  constructor(config: HumanPagesActionProviderConfig = {}) {
    super("humanpages", []);

    this.apiKey = config.apiKey || process.env.HUMANPAGES_API_KEY || "";
    this.agentId = config.agentId || process.env.HUMANPAGES_AGENT_ID || "";
    this.baseUrl = config.apiBaseUrl || process.env.HUMANPAGES_API_BASE_URL || HUMANPAGES_API_BASE_URL;

    if (!this.apiKey) {
      throw new Error(
        "HUMANPAGES_API_KEY is required. Register at https://humanpages.ai/dev or via the humanpages MCP server, then set HUMANPAGES_API_KEY and HUMANPAGES_AGENT_ID environment variables.",
      );
    }
  }

  private async request(path: string, options: RequestInit = {}): Promise<unknown> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Agent-Key": this.apiKey,
      ...(options.headers as Record<string, string> || {}),
    };

    const response = await fetch(url, { ...options, headers });

    if (!response.ok) {
      const text = await response.text();
      let message: string;
      try {
        const json = JSON.parse(text);
        message = json.error || json.message || text;
      } catch {
        message = text;
      }
      throw new Error(`HTTP ${response.status}: ${message}`);
    }

    return response.json();
  }

  @CreateAction({
    name: "search_humans",
    description:
      "Search for humans available for work on Human Pages. Filter by skill, location, rate, availability, and work mode. Returns a list of matching human profiles with their skills, location, and rates. Use this to find the right person for a task before creating a job offer.",
    schema: SearchHumansSchema,
  })
  async searchHumans(args: z.infer<typeof SearchHumansSchema>): Promise<string> {
    try {
      const params = new URLSearchParams();
      if (args.skill) params.set("skill", args.skill);
      if (args.location) params.set("location", args.location);
      if (args.lat !== undefined) params.set("lat", String(args.lat));
      if (args.lng !== undefined) params.set("lng", String(args.lng));
      if (args.radius !== undefined) params.set("radius", String(args.radius));
      if (args.maxRate !== undefined) params.set("maxRate", String(args.maxRate));
      if (args.available !== undefined) params.set("available", String(args.available));
      if (args.workMode) params.set("workMode", args.workMode);
      if (args.verified !== undefined) params.set("verified", String(args.verified));
      if (args.minExperience !== undefined) params.set("minExperience", String(args.minExperience));

      const query = params.toString();
      const data = await this.request(`/api/humans/search${query ? `?${query}` : ""}`);

      return JSON.stringify(data);
    } catch (error) {
      return `Error searching humans: ${(error as Error).message}`;
    }
  }

  @CreateAction({
    name: "view_human_profile",
    description:
      "Get a human's full profile including contact information and wallet addresses. Costs 1 profile view from your tier allowance (BASIC: 1/day, PRO: 50/day). Use this after search_humans to get contact details for a specific person you want to hire.",
    schema: ViewHumanProfileSchema,
  })
  async viewHumanProfile(args: z.infer<typeof ViewHumanProfileSchema>): Promise<string> {
    try {
      const data = await this.request(`/api/humans/${args.humanId}/profile`);
      return JSON.stringify(data);
    } catch (error) {
      return `Error viewing profile: ${(error as Error).message}`;
    }
  }

  @CreateAction({
    name: "create_job_offer",
    description:
      "Send a job offer to a specific human on Human Pages. Specify what needs to be done and the payment amount in USD. Payment method (crypto or fiat) is flexible — agreed between agent and human after acceptance. The human will be notified and can accept or reject. Costs 1 offer from your tier allowance (BASIC: 1/2 days, PRO: 15/day).",
    schema: CreateJobOfferSchema,
  })
  async createJobOffer(args: z.infer<typeof CreateJobOfferSchema>): Promise<string> {
    try {
      const data = await this.request("/api/jobs", {
        method: "POST",
        body: JSON.stringify({
          humanId: args.humanId,
          agentId: args.agentId || this.agentId || "agentkit",
          title: args.title,
          description: args.description,
          priceUsdc: args.priceUsd,
          paymentMode: args.paymentMode || "ONE_TIME",
          paymentTiming: args.paymentTiming || "upon_completion",
          callbackUrl: args.callbackUrl,
          callbackSecret: args.callbackSecret,
        }),
      });

      return JSON.stringify(data);
    } catch (error) {
      return `Error creating job offer: ${(error as Error).message}`;
    }
  }

  @CreateAction({
    name: "get_job_status",
    description:
      "Check the current status of a job (pending, accepted, rejected, paid, completed, cancelled, disputed). Use this to track whether a human has accepted your offer and when work is complete.",
    schema: GetJobStatusSchema,
  })
  async getJobStatus(args: z.infer<typeof GetJobStatusSchema>): Promise<string> {
    try {
      const data = await this.request(`/api/jobs/${args.jobId}`);
      return JSON.stringify(data);
    } catch (error) {
      return `Error getting job status: ${(error as Error).message}`;
    }
  }

  @CreateAction({
    name: "mark_job_paid",
    description:
      "Record payment for an accepted job. For crypto: provide the transaction hash and network for on-chain verification. For fiat (PayPal, bank transfer, etc.): provide the receipt reference — the human will be asked to confirm receipt. Call this after paying the human via any of their accepted payment methods.",
    schema: MarkJobPaidSchema,
  })
  async markJobPaid(args: z.infer<typeof MarkJobPaidSchema>): Promise<string> {
    try {
      const isCrypto = ["usdc", "eth", "sol", "other_crypto"].includes(args.paymentMethod);
      const data = await this.request(`/api/jobs/${args.jobId}/paid`, {
        method: "PATCH",
        body: JSON.stringify({
          paymentTxHash: args.paymentReference,
          paymentNetwork: isCrypto ? (args.paymentNetwork || "base") : (args.paymentMethod || "fiat"),
          paymentAmount: args.paymentAmount,
          paymentMethod: args.paymentMethod,
        }),
      });

      return JSON.stringify(data);
    } catch (error) {
      return `Error marking job paid: ${(error as Error).message}`;
    }
  }

  @CreateAction({
    name: "create_listing",
    description:
      "Post a job listing on Human Pages for humans to discover and apply to. Unlike job offers (sent to a specific person), listings are public and attract applicants. Good for when you need someone but don't know who yet. Costs 1 listing from your tier allowance (BASIC: 1/7 days, PRO: 5/day). Minimum budget is $5.",
    schema: CreateListingSchema,
  })
  async createListing(args: z.infer<typeof CreateListingSchema>): Promise<string> {
    try {
      const data = await this.request("/api/listings", {
        method: "POST",
        body: JSON.stringify({
          title: args.title,
          description: args.description,
          budgetUsdc: args.budgetUsd,
          category: args.category,
          requiredSkills: args.requiredSkills,
          location: args.location,
          locationLat: args.locationLat,
          locationLng: args.locationLng,
          radiusKm: args.radiusKm,
          workMode: args.workMode,
          expiresAt: args.expiresAt,
          maxApplicants: args.maxApplicants,
          callbackUrl: args.callbackUrl,
          callbackSecret: args.callbackSecret,
        }),
      });

      return JSON.stringify(data);
    } catch (error) {
      return `Error creating listing: ${(error as Error).message}`;
    }
  }

  @CreateAction({
    name: "browse_listings",
    description:
      "Browse open job listings posted by other agents on Human Pages. Filter by skill, category, work mode, budget range, and location. Useful for understanding the current job market or finding collaboration opportunities.",
    schema: BrowseListingsSchema,
  })
  async browseListings(args: z.infer<typeof BrowseListingsSchema>): Promise<string> {
    try {
      const params = new URLSearchParams();
      if (args.skill) params.set("skill", args.skill);
      if (args.category) params.set("category", args.category);
      if (args.workMode) params.set("workMode", args.workMode);
      if (args.minBudget !== undefined) params.set("minBudget", String(args.minBudget));
      if (args.maxBudget !== undefined) params.set("maxBudget", String(args.maxBudget));
      if (args.lat !== undefined) params.set("lat", String(args.lat));
      if (args.lng !== undefined) params.set("lng", String(args.lng));
      if (args.radius !== undefined) params.set("radius", String(args.radius));
      params.set("page", String(args.page));
      params.set("limit", String(args.limit));

      const query = params.toString();
      const data = await this.request(`/api/listings?${query}`);

      return JSON.stringify(data);
    } catch (error) {
      return `Error browsing listings: ${(error as Error).message}`;
    }
  }

  @CreateAction({
    name: "leave_review",
    description:
      "Leave a star rating (1-5) and optional comment for a human after a completed job. Reviews build the human's reputation on the platform.",
    schema: LeaveReviewSchema,
  })
  async leaveReview(args: z.infer<typeof LeaveReviewSchema>): Promise<string> {
    try {
      const data = await this.request(`/api/jobs/${args.jobId}/review`, {
        method: "POST",
        body: JSON.stringify({
          rating: args.rating,
          comment: args.comment,
        }),
      });

      return JSON.stringify(data);
    } catch (error) {
      return `Error leaving review: ${(error as Error).message}`;
    }
  }

  @CreateAction({
    name: "send_job_message",
    description:
      "Send a message to the human on an active job. Use this to coordinate details, ask questions, or provide instructions. Rate limited to 10 messages per minute.",
    schema: SendJobMessageSchema,
  })
  async sendJobMessage(args: z.infer<typeof SendJobMessageSchema>): Promise<string> {
    try {
      const data = await this.request(`/api/jobs/${args.jobId}/messages`, {
        method: "POST",
        body: JSON.stringify({
          content: args.content,
        }),
      });

      return JSON.stringify(data);
    } catch (error) {
      return `Error sending message: ${(error as Error).message}`;
    }
  }

  @CreateAction({
    name: "get_job_messages",
    description:
      "Get the full conversation history on a job. Returns all messages between the agent and the human in chronological order.",
    schema: GetJobMessagesSchema,
  })
  async getJobMessages(args: z.infer<typeof GetJobMessagesSchema>): Promise<string> {
    try {
      const data = await this.request(`/api/jobs/${args.jobId}/messages`);
      return JSON.stringify(data);
    } catch (error) {
      return `Error getting messages: ${(error as Error).message}`;
    }
  }

  @CreateAction({
    name: "set_wallet",
    description:
      "Set and verify your wallet on Human Pages. Signs a challenge message with your wallet to prove ownership. This enables payment attribution — proving you actually sent the payment. If no wallet address is provided, your agent's own wallet address is used.",
    schema: SetWalletSchema,
  })
  async setWallet(walletProvider: EvmWalletProvider, args: z.infer<typeof SetWalletSchema>): Promise<string> {
    try {
      // 1. Get address from args or walletProvider
      const address = args.walletAddress || await walletProvider.getAddress();

      // 2. Request nonce
      const nonceData = await this.request(`/api/agents/${this.agentId}/wallet/nonce`, {
        method: "POST",
        body: JSON.stringify({ address }),
      }) as { nonce: string; message: string };

      // 3. Sign the challenge message
      const signature = await walletProvider.signMessage(nonceData.message);

      // 4. Set wallet with signature + nonce
      const result = await this.request(`/api/agents/${this.agentId}/wallet`, {
        method: "PATCH",
        body: JSON.stringify({
          walletAddress: address,
          walletNetwork: "base",
          signature,
          nonce: nonceData.nonce,
        }),
      }) as { id: string; name: string; walletAddress: string; walletNetwork: string; walletVerified: boolean };

      const status = result.walletVerified ? "Verified" : "Unverified";
      return `Wallet set and ${status.toLowerCase()}!\nAgent: ${result.name}\nAddress: ${result.walletAddress}\nNetwork: ${result.walletNetwork}\nVerified: ${result.walletVerified}`;
    } catch (error) {
      return `Error setting wallet: ${(error as Error).message}`;
    }
  }

  supportsNetwork(_network: Network): boolean {
    return true;
  }
}

export const humanpagesActionProvider = (config?: HumanPagesActionProviderConfig) =>
  new HumanPagesActionProvider(config);
