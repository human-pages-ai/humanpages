/**
 * Setup file for tests that don't need a database.
 * Mocks @prisma/client with all enums and a Proxy-based PrismaClient.
 */
import { vi } from 'vitest';

// ─── Prisma Enums (from schema.prisma) ───
const enums: Record<string, Record<string, string>> = {
  RateType: { HOURLY: 'HOURLY', FLAT_TASK: 'FLAT_TASK', NEGOTIABLE: 'NEGOTIABLE' },
  WorkMode: { REMOTE: 'REMOTE', ONSITE: 'ONSITE', HYBRID: 'HYBRID' },
  PaymentMode: { ONE_TIME: 'ONE_TIME', STREAM: 'STREAM' },
  StreamInterval: { HOURLY: 'HOURLY', DAILY: 'DAILY', WEEKLY: 'WEEKLY' },
  StreamMethod: { SUPERFLUID: 'SUPERFLUID', MICRO_TRANSFER: 'MICRO_TRANSFER' },
  TickStatus: { PENDING: 'PENDING', VERIFIED: 'VERIFIED', MISSED: 'MISSED', SKIPPED: 'SKIPPED' },
  AgentStatus: { PENDING: 'PENDING', ACTIVE: 'ACTIVE', SUSPENDED: 'SUSPENDED', BANNED: 'BANNED' },
  HumanStatus: { ACTIVE: 'ACTIVE', FLAGGED: 'FLAGGED', SUSPENDED: 'SUSPENDED', BANNED: 'BANNED' },
  HumanRole: { USER: 'USER', STAFF: 'STAFF', ADMIN: 'ADMIN' },
  PostingGroupStatus: { PENDING: 'PENDING', JOINED: 'JOINED', POSTED: 'POSTED', REJECTED: 'REJECTED', SKIPPED: 'SKIPPED' },
  ActivationMethod: { SOCIAL: 'SOCIAL', PAYMENT: 'PAYMENT', ADMIN: 'ADMIN' },
  ReportReason: { SPAM: 'SPAM', FRAUD: 'FRAUD', HARASSMENT: 'HARASSMENT', IRRELEVANT: 'IRRELEVANT', OTHER: 'OTHER' },
  ReportStatus: { PENDING: 'PENDING', REVIEWED: 'REVIEWED', DISMISSED: 'DISMISSED' },
  LeadStatus: { NEW: 'NEW', VERIFIED: 'VERIFIED', OUTREACH_READY: 'OUTREACH_READY', CONTACTED: 'CONTACTED', REPLIED: 'REPLIED', ENGAGED: 'ENGAGED', CONVERTED: 'CONVERTED', REJECTED: 'REJECTED', STALE: 'STALE', BLOCKED: 'BLOCKED' },
  LeadSource: { MANUAL: 'MANUAL', CSV_IMPORT: 'CSV_IMPORT', PODCAST_MINE: 'PODCAST_MINE', CONFERENCE: 'CONFERENCE', PUBLICATION: 'PUBLICATION', CATEGORY_SCAN: 'CATEGORY_SCAN', REFERRAL: 'REFERRAL' },
  IdleAlertStatus: { ACTIVE: 'ACTIVE', RESOLVED: 'RESOLVED', DISMISSED: 'DISMISSED' },
  EmailDigestMode: { REALTIME: 'REALTIME', HOURLY: 'HOURLY', DAILY: 'DAILY' },
  JobStatus: { PENDING: 'PENDING', ACCEPTED: 'ACCEPTED', REJECTED: 'REJECTED', PAYMENT_CLAIMED: 'PAYMENT_CLAIMED', PAID: 'PAID', STREAMING: 'STREAMING', PAUSED: 'PAUSED', COMPLETED: 'COMPLETED', CANCELLED: 'CANCELLED', DISPUTED: 'DISPUTED' },
  AffiliateStatus: { APPROVED: 'APPROVED', SUSPENDED: 'SUSPENDED' },
  FeedbackType: { BUG: 'BUG', FEATURE: 'FEATURE', FEEDBACK: 'FEEDBACK' },
  FeedbackStatus: { NEW: 'NEW', IN_PROGRESS: 'IN_PROGRESS', RESOLVED: 'RESOLVED', CLOSED: 'CLOSED' },
  ListingStatus: { OPEN: 'OPEN', CLOSED: 'CLOSED', EXPIRED: 'EXPIRED', CANCELLED: 'CANCELLED' },
  ApplicationStatus: { PENDING: 'PENDING', OFFERED: 'OFFERED', REJECTED: 'REJECTED', WITHDRAWN: 'WITHDRAWN' },
  CareerApplicationStatus: { PENDING: 'PENDING', REVIEWED: 'REVIEWED', CONTACTED: 'CONTACTED', REJECTED: 'REJECTED', HIRED: 'HIRED' },
  AdjustmentStatus: { PENDING: 'PENDING', APPROVED: 'APPROVED', REJECTED: 'REJECTED' },
  ContentStatus: { DRAFT: 'DRAFT', REVIEW: 'REVIEW', APPROVED: 'APPROVED', PUBLISHED: 'PUBLISHED', REJECTED: 'REJECTED' },
  ContentPlatform: { TWITTER: 'TWITTER', LINKEDIN: 'LINKEDIN', BLOG: 'BLOG' },
  VideoTier: { NANO: 'NANO', DRAFT: 'DRAFT', FINAL: 'FINAL' },
  VideoStatus: { GENERATING: 'GENERATING', DRAFT: 'DRAFT', READY: 'READY', SCHEDULED: 'SCHEDULED', PUBLISHED: 'PUBLISHED', ARCHIVED: 'ARCHIVED' },
  VideoJobType: { PREVIEW: 'PREVIEW', PRODUCE: 'PRODUCE' },
  VideoJobStatus: { PENDING: 'PENDING', RUNNING: 'RUNNING', COMPLETED: 'COMPLETED', FAILED: 'FAILED', CANCELLED: 'CANCELLED', CHECKPOINT: 'CHECKPOINT' },
  PublishPlatform: { TIKTOK: 'TIKTOK', YOUTUBE: 'YOUTUBE', INSTAGRAM: 'INSTAGRAM', LINKEDIN: 'LINKEDIN', TWITTER: 'TWITTER', FACEBOOK: 'FACEBOOK', BLOG: 'BLOG' },
  PublishContentType: { VIDEO: 'VIDEO', ARTICLE: 'ARTICLE', SHORT_POST: 'SHORT_POST', IMAGE_POST: 'IMAGE_POST' },
  PublicationStatus: { DRAFT: 'DRAFT', SCHEDULED: 'SCHEDULED', PUBLISHING: 'PUBLISHING', PUBLISHED: 'PUBLISHED', FAILED: 'FAILED', CANCELLED: 'CANCELLED' },
};

// ─── Mock model (all Prisma model methods) ───
function mockModel() {
  return {
    findMany: vi.fn().mockResolvedValue([]),
    findFirst: vi.fn().mockResolvedValue(null),
    findUnique: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue({}),
    update: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({}),
    count: vi.fn().mockResolvedValue(0),
    upsert: vi.fn().mockResolvedValue({}),
    deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    createMany: vi.fn().mockResolvedValue({ count: 0 }),
    aggregate: vi.fn().mockResolvedValue({}),
    groupBy: vi.fn().mockResolvedValue([]),
  };
}

function createMockPrisma() {
  return new Proxy({}, {
    get(_target, prop) {
      if (prop === '$use') return vi.fn();
      if (prop === '$connect') return vi.fn().mockResolvedValue(undefined);
      if (prop === '$disconnect') return vi.fn().mockResolvedValue(undefined);
      if (prop === '$on') return vi.fn();
      if (prop === '$transaction') return vi.fn().mockImplementation((fn: any) => fn(_target));
      if (typeof prop === 'string' && !prop.startsWith('_')) return mockModel();
      return undefined;
    },
  });
}

vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn().mockImplementation(() => createMockPrisma()),
  Prisma: { JsonNull: null, DbNull: null, AnyNull: null },
  ...enums,
}));

vi.mock('../lib/prisma.js', () => ({
  prisma: createMockPrisma(),
}));
