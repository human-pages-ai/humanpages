import { z } from "zod";

export const SearchHumansSchema = z
  .object({
    skill: z
      .string()
      .optional()
      .describe("Skill to search for (e.g. 'photography', 'delivery', 'data-entry')"),
    location: z
      .string()
      .optional()
      .describe("Location name to search near (e.g. 'San Francisco', 'London')"),
    lat: z
      .number()
      .optional()
      .describe("Latitude for geo-radius search"),
    lng: z
      .number()
      .optional()
      .describe("Longitude for geo-radius search"),
    radius: z
      .number()
      .optional()
      .describe("Search radius in kilometers (used with lat/lng)"),
    maxRate: z
      .number()
      .optional()
      .describe("Maximum hourly rate in USD"),
    available: z
      .boolean()
      .optional()
      .describe("Only show humans marked as available"),
    workMode: z
      .enum(["remote", "onsite", "hybrid"])
      .optional()
      .describe("Work mode filter"),
    verified: z
      .boolean()
      .optional()
      .describe("Only show identity-verified humans"),
    minExperience: z
      .number()
      .optional()
      .describe("Minimum years of professional experience"),
  })
  .strip()
  .describe("Search for humans available for work on Human Pages");

export const ViewHumanProfileSchema = z
  .object({
    humanId: z
      .string()
      .describe("The ID of the human to view the full profile of"),
  })
  .strict()
  .describe("Get a human's full profile including contact info and wallet addresses");

export const CreateJobOfferSchema = z
  .object({
    humanId: z
      .string()
      .describe("The ID of the human to send the job offer to"),
    agentId: z
      .string()
      .optional()
      .describe("Your agent identifier string. If omitted, defaults to your registered agent ID."),
    title: z
      .string()
      .describe("Short title describing the job (e.g. 'Deliver package to 123 Main St')"),
    description: z
      .string()
      .describe("Detailed description of what needs to be done"),
    priceUsd: z
      .number()
      .describe("Payment amount in USD. Payment method (crypto or fiat) is flexible — agreed after acceptance."),
    paymentMode: z
      .enum(["ONE_TIME", "STREAM"])
      .optional()
      .describe("ONE_TIME for single payment, STREAM for ongoing micro-payments. Defaults to ONE_TIME."),
    paymentTiming: z
      .enum(["upfront", "upon_completion"])
      .optional()
      .describe("When payment is sent. Defaults to upon_completion."),
    callbackUrl: z
      .string()
      .optional()
      .describe("Webhook URL to receive job status updates (accepted, rejected, completed)"),
    callbackSecret: z
      .string()
      .optional()
      .describe("Secret for authenticating webhook callbacks"),
  })
  .strip()
  .describe("Create a job offer for a specific human on Human Pages");

export const GetJobStatusSchema = z
  .object({
    jobId: z
      .string()
      .describe("The ID of the job to check"),
  })
  .strict()
  .describe("Check the current status of a job offer");

export const MarkJobPaidSchema = z
  .object({
    jobId: z
      .string()
      .describe("The ID of the job to mark as paid"),
    paymentMethod: z
      .enum(["usdc", "eth", "sol", "paypal", "bank_transfer", "venmo", "cashapp", "other_crypto", "other_fiat"])
      .describe("How you paid. Crypto (usdc, eth, sol, other_crypto) = verified on-chain. Fiat (paypal, bank_transfer, venmo, cashapp, other_fiat) = human confirms receipt."),
    paymentReference: z
      .string()
      .describe("Transaction hash (crypto) or receipt ID / reference number (fiat)"),
    paymentNetwork: z
      .string()
      .optional()
      .describe("Blockchain network (e.g. 'base', 'ethereum'). Required for crypto, ignored for fiat."),
    paymentAmount: z
      .string()
      .describe("Amount paid in USD equivalent (as string to preserve precision)"),
  })
  .strip()
  .describe("Record payment for an accepted job (crypto or fiat)");

export const CreateListingSchema = z
  .object({
    title: z
      .string()
      .describe("Job listing title (e.g. 'Need local photographer for product shoot')"),
    description: z
      .string()
      .describe("Detailed description of the work needed"),
    budgetUsd: z
      .number()
      .min(5)
      .describe("Budget in USD (minimum $5)"),
    category: z
      .string()
      .optional()
      .describe("Job category (e.g. 'photography', 'delivery', 'data-entry')"),
    requiredSkills: z
      .array(z.string())
      .optional()
      .describe("Skills required for the job"),
    location: z
      .string()
      .optional()
      .describe("Location where work needs to be done"),
    locationLat: z
      .number()
      .optional()
      .describe("Latitude of job location"),
    locationLng: z
      .number()
      .optional()
      .describe("Longitude of job location"),
    radiusKm: z
      .number()
      .optional()
      .describe("Radius in km for location-based matching"),
    workMode: z
      .enum(["remote", "onsite", "hybrid"])
      .optional()
      .describe("Whether the work is remote, onsite, or hybrid"),
    expiresAt: z
      .string()
      .optional()
      .describe("ISO 8601 expiration date for the listing"),
    maxApplicants: z
      .number()
      .optional()
      .describe("Maximum number of applicants to accept"),
    callbackUrl: z
      .string()
      .optional()
      .describe("Webhook URL to receive application notifications"),
    callbackSecret: z
      .string()
      .optional()
      .describe("Secret for authenticating webhook callbacks"),
  })
  .strip()
  .describe("Post a job listing on Human Pages for humans to apply to");

export const BrowseListingsSchema = z
  .object({
    skill: z
      .string()
      .optional()
      .describe("Filter by required skill"),
    category: z
      .string()
      .optional()
      .describe("Filter by job category"),
    workMode: z
      .enum(["remote", "onsite", "hybrid"])
      .optional()
      .describe("Filter by work mode"),
    minBudget: z
      .number()
      .optional()
      .describe("Minimum budget in USD"),
    maxBudget: z
      .number()
      .optional()
      .describe("Maximum budget in USD"),
    lat: z
      .number()
      .optional()
      .describe("Latitude for location-based search"),
    lng: z
      .number()
      .optional()
      .describe("Longitude for location-based search"),
    radius: z
      .number()
      .optional()
      .describe("Search radius in kilometers"),
    page: z
      .number()
      .default(1)
      .describe("Page number for pagination"),
    limit: z
      .number()
      .default(20)
      .describe("Results per page"),
  })
  .strip()
  .describe("Browse open job listings on Human Pages");

export const LeaveReviewSchema = z
  .object({
    jobId: z
      .string()
      .describe("The ID of the completed job to review"),
    rating: z
      .number()
      .min(1)
      .max(5)
      .describe("Star rating from 1 to 5"),
    comment: z
      .string()
      .optional()
      .describe("Optional review comment"),
  })
  .strip()
  .describe("Leave a review for a completed job");

export const SendJobMessageSchema = z
  .object({
    jobId: z
      .string()
      .describe("The ID of the job to send a message on"),
    content: z
      .string()
      .max(2000)
      .describe("Message content (max 2000 characters)"),
  })
  .strict()
  .describe("Send a message to the human on an active job");

export const GetJobMessagesSchema = z
  .object({
    jobId: z
      .string()
      .describe("The ID of the job to get messages for"),
  })
  .strict()
  .describe("Get the conversation history on a job");

export const SetWalletSchema = z
  .object({
    walletAddress: z
      .string()
      .optional()
      .describe("EVM wallet address. If omitted, uses the agent's own wallet address from the wallet provider."),
  })
  .strip()
  .describe("Set and verify the agent's wallet address on Human Pages using EIP-191 signature");
