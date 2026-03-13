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
      .describe("Maximum hourly rate in USDC"),
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
    title: z
      .string()
      .describe("Short title describing the job (e.g. 'Deliver package to 123 Main St')"),
    description: z
      .string()
      .describe("Detailed description of what needs to be done"),
    priceUsdc: z
      .number()
      .describe("Payment amount in USDC"),
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
    paymentTxHash: z
      .string()
      .describe("On-chain transaction hash of the payment"),
    paymentNetwork: z
      .string()
      .default("base")
      .describe("Network the payment was sent on (e.g. 'base', 'ethereum')"),
    paymentAmount: z
      .string()
      .describe("Amount paid (as string to preserve precision)"),
  })
  .strip()
  .describe("Record an on-chain payment for an accepted job");

export const CreateListingSchema = z
  .object({
    title: z
      .string()
      .describe("Job listing title (e.g. 'Need local photographer for product shoot')"),
    description: z
      .string()
      .describe("Detailed description of the work needed"),
    budgetUsdc: z
      .number()
      .min(5)
      .describe("Budget in USDC (minimum $5)"),
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
      .describe("Minimum budget in USDC"),
    maxBudget: z
      .number()
      .optional()
      .describe("Maximum budget in USDC"),
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
