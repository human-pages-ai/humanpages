export interface AdminStats {
  users: {
    total: number;
    verified: number;
    last7d: number;
    last30d: number;
  };
  agents: {
    total: number;
    byStatus: Record<string, number>;
  };
  jobs: {
    total: number;
    byStatus: Record<string, number>;
    last7d: number;
    last30d: number;
    paymentVolume: number;
    paidJobCount?: number;
  };
  reports: {
    total: number;
    pending: number;
  };
  affiliates: {
    total: number;
    approved: number;
  };
  feedback: {
    total: number;
    new: number;
  };
  humanReports: {
    total: number;
    pending: number;
  };
  listings: {
    total: number;
    open: number;
    byStatus: Record<string, number>;
    applications: number;
  };
}

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  username: string | null;
  location: string | null;
  isAvailable: boolean;
  emailVerified: boolean;
  referralCode: string;
  role: 'USER' | 'STAFF' | 'ADMIN';
  isCatchAll: boolean;
  createdAt: string;
  lastActiveAt: string;
  _count: {
    jobs: number;
    reviews: number;
    services: number;
  };
}

export interface AdminAgent {
  id: string;
  name: string;
  description: string | null;
  websiteUrl: string | null;
  contactEmail: string | null;
  status: string;
  activationMethod: string | null;
  activationTier: string;
  domainVerified: boolean;
  abuseScore: number;
  abuseStrikes: number;
  lastActiveAt: string;
  createdAt: string;
  _count: {
    jobs: number;
    reports: number;
  };
}

export interface AdminJob {
  id: string;
  title: string;
  description: string;
  category: string | null;
  status: string;
  priceUsdc: string;
  paymentAmount: string | null;
  paymentNetwork: string | null;
  paidAt: string | null;
  createdAt: string;
  acceptedAt: string | null;
  completedAt: string | null;
  human: { id: string; name: string; email: string };
  registeredAgent: { id: string; name: string } | null;
  agentName: string | null;
  agentId: string;
}

export interface AdminActivity {
  type: 'job' | 'user' | 'agent';
  id: string;
  description: string;
  timestamp: string;
}

export interface AdminFeedback {
  id: string;
  humanId: string | null;
  type: 'BUG' | 'FEATURE' | 'FEEDBACK';
  category: string | null;
  title: string | null;
  description: string;
  sentiment: number | null;
  stepsToReproduce: string | null;
  expectedBehavior: string | null;
  actualBehavior: string | null;
  severity: string | null;
  pageUrl: string | null;
  browser: string | null;
  os: string | null;
  viewport: string | null;
  userAgent: string | null;
  appVersion: string | null;
  screenshotData: string | null;
  status: 'NEW' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  adminNotes: string | null;
  createdAt: string;
  updatedAt: string;
  human: { id: string; name: string; email: string } | null;
}

export interface AdminUserDetail extends AdminUser {
  bio: string | null;
  neighborhood: string | null;
  skills: string[];
  equipment: string[];
  languages: string[];
  preferredLanguage: string;
  minRateUsdc: string | null;
  rateCurrency: string;
  rateType: string;
  workMode: string | null;
  paymentPreferences: string[];
  contactEmail: string | null;
  telegram: string | null;
  whatsapp: string | null;
  signal: string | null;
  hideContact: boolean;
  linkedinVerified: boolean;
  githubVerified: boolean;
  githubUsername: string | null;
  humanityVerified: boolean;
  humanityProvider: string | null;
  humanityScore: number | null;
  humanityVerifiedAt: string | null;
  linkedinUrl: string | null;
  twitterUrl: string | null;
  githubUrl: string | null;
  instagramUrl: string | null;
  youtubeUrl: string | null;
  websiteUrl: string | null;
  referredBy: string | null;
  referralCount: number;
  wallets: Array<{
    id: string;
    network: string;
    chain: string | null;
    address: string;
    label: string | null;
    isPrimary: boolean;
    createdAt: string;
  }>;
  services: Array<{
    id: string;
    title: string;
    description: string;
    category: string;
    priceMin: string | null;
    priceCurrency: string;
    priceUnit: string | null;
    isActive: boolean;
    createdAt: string;
  }>;
  jobs: Array<{
    id: string;
    title: string;
    status: string;
    priceUsdc: string;
    createdAt: string;
    agentName: string | null;
    registeredAgent: { id: string; name: string } | null;
  }>;
  reviews: Array<{
    id: string;
    rating: number;
    comment: string | null;
    createdAt: string;
    jobId: string;
  }>;
  humanReportsReceived: Array<{
    id: string;
    reason: string;
    description: string | null;
    status: string;
    createdAt: string;
    reporter: { id: string; name: string; email: string };
  }>;
  careerApplications: Array<{
    id: string;
    positionId: string;
    positionTitle: string;
    about: string;
    portfolioUrl: string | null;
    availability: string;
    status: string;
    adminNotes: string | null;
    createdAt: string;
    updatedAt: string;
  }>;
  affiliate: {
    id: string;
    status: string;
    totalSignups: number;
    qualifiedSignups: number;
    totalCredits: number;
    creditsRedeemed: number;
    createdAt: string;
  } | null;
  _count: {
    jobs: number;
    reviews: number;
    services: number;
    vouchesGiven: number;
    vouchesReceived: number;
    careerApplications: number;
  };
}
export interface AgentStats {
  listings: { total: number; active: number };
  jobs: { total: number; completed: number; pending: number; paid: number; totalSpendUsdc: string };
  applications: { total: number; avgPerListing: number };
  recentActivity: Array<{ type: 'listing' | 'job'; id: string; title: string; status: string; date: string }>;
}

export interface BulkUpdateRequest {
  agentIds: string[];
  updates: { status?: string; activationTier?: string };
}

export interface BulkUpdateResponse {
  success: number;
  failed: number;
  errors: Array<{ id: string; error: string }>;
}

export interface AdminAgentDetail extends AdminAgent {
  activatedAt: string | null;
  activationPlatform: string | null;
  socialPostUrl: string | null;
  socialAccountSize: number | null;
  paymentTxHash: string | null;
  paymentNetwork: string | null;
  paymentAmount: string | null;
  verifiedAt: string | null;
  verificationToken: string | null;
  listings?: Array<{ id: string; title: string; status: string; budgetUsdc: string; createdAt: string }>;
  jobs: Array<{
    id: string;
    title: string;
    status: string;
    priceUsdc: string;
    createdAt: string;
    human: { id: string; name: string };
  }>;
  reports: Array<{
    id: string;
    reason: string;
    description: string | null;
    status: string;
    createdAt: string;
    reporter: { id: string; name: string; email: string };
  }>;
}

export interface AdminJobDetail extends AdminJob {
  callbackUrl: string | null;
  paymentTiming: string | null;
  paymentMode: string;
  streamMethod: string | null;
  streamInterval: string | null;
  streamRateUsdc: string | null;
  streamFlowRate: string | null;
  streamMaxTicks: number | null;
  streamNetwork: string | null;
  streamToken: string | null;
  streamSuperToken: string | null;
  streamSenderAddress: string | null;
  streamStartedAt: string | null;
  streamPausedAt: string | null;
  streamEndedAt: string | null;
  streamTickCount: number;
  streamMissedTicks: number;
  streamTotalPaid: string | null;
  streamContractId: string | null;
  paymentTxHash: string | null;
  updateCount: number;
  updatedAt: string;
  human: { id: string; name: string; email: string; username: string | null };
  registeredAgent: { id: string; name: string; status: string; domainVerified: boolean } | null;
  messages: Array<{
    id: string;
    senderType: string;
    senderName: string;
    content: string;
    createdAt: string;
  }>;
  review: {
    id: string;
    rating: number;
    comment: string | null;
    createdAt: string;
    humanId: string;
  } | null;
  streamTicks: Array<{
    id: string;
    tickNumber: number;
    status: string;
    expectedAt: string;
    amount: string | null;
    txHash: string | null;
    network: string | null;
    verifiedAt: string | null;
    createdAt: string;
  }>;
}

export const STAFF_CAPABILITIES = [
  'CONTENT_REVIEWER',
  'POSTER',
  'ANALYST',
  'CREATIVE',
  'GROUP_MANAGER',
  'LEAD_GEN',
] as const;

export type StaffCapability = (typeof STAFF_CAPABILITIES)[number];

export interface AdminMeResponse {
  isAdmin: boolean;
  isStaff: boolean;
  role: 'USER' | 'STAFF' | 'ADMIN';
  capabilities: StaffCapability[];
}

// ===== Content Pipeline =====
export type ContentStatus = 'DRAFT' | 'REVIEW' | 'APPROVED' | 'PUBLISHED' | 'REJECTED';
export type ContentPlatform = 'TWITTER' | 'LINKEDIN' | 'BLOG';

export interface ContentItem {
  id: string;
  sourceTitle: string;
  sourceUrl: string | null;
  source: string | null;
  relevanceScore: number | null;
  whyUs: string | null;
  platform: ContentPlatform;
  tweetDraft: string | null;
  linkedinSnippet: string | null;
  blogTitle: string | null;
  blogSlug: string | null;
  blogBody: string | null;
  blogExcerpt: string | null;
  blogReadingTime: string | null;
  metaDescription: string | null;
  imageR2Key: string | null;
  imageUrl: string | null;
  isFeatured: boolean;
  status: ContentStatus;
  publishedAt: string | null;
  publishedUrl: string | null;
  publishError: string | null;
  manualInstructions: string | null;
  devtoUrl: string | null;
  devtoArticleId: string | null;
  hashnodeUrl: string | null;
  hashnodePostId: string | null;
  crosspostErrors: Record<string, string> | null;
  approvedById: string | null;
  approvedAt: string | null;
  rejectionReason: string | null;
  rejectedById: string | null;
  rejectedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ContentStats {
  byStatus: Record<string, number>;
  byPlatform: Record<string, Record<string, number>>;
}

export type PostingGroupStatus = 'PENDING' | 'JOINED' | 'POSTED' | 'REJECTED' | 'SKIPPED';

export type TaskType = 'fb_post' | 'yt_comment' | 'yt_reply' | 'blog_comment';

export interface PostingGroup {
  id: string;
  name: string;
  url: string;
  adId: string;
  language: string;
  country: string;
  status: PostingGroupStatus;
  datePosted: string | null;
  notes: string | null;
  taskType: string;
  campaign: string | null;
  completedBy: { id: string; name: string } | null;
  createdAt: string;
  updatedAt: string;
  ad: {
    id: string;
    adNumber: number;
    language: string;
    title: string;
  };
}

export interface StaffStats {
  period: { days: number; since: string };
  totalPending: number;
  totalCompleted: number;
  staff: Array<{ staffId: string; staffName: string; staffEmail: string; completedCount: number }>;
  daily: Array<{ completedById: string; day: string; count: number }>;
}

export interface AdCopy {
  id: string;
  adNumber: number;
  language: string;
  title: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  _count?: { groups: number };
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  pagination: Pagination;
  [key: string]: T[] | Pagination;
}

export interface StaffMember {
  id: string;
  name: string;
  email: string;
  role: 'STAFF' | 'ADMIN';
  capabilities: StaffCapability[];
  createdAt: string;
  apiKeyStatus: 'active' | 'none';
  apiKeyCreatedAt: string | null;
  totalCompleted: number;
  daily: Array<{ day: string; count: number }>;
  hourly: Array<{ hour: number; count: number }>;
}

export interface TaskSummary {
  capabilities: StaffCapability[];
  summary: Partial<Record<StaffCapability, number>>;
}

export interface GenerateApiKeyResponse {
  apiKey: string;
  prefix: string;
}

export interface ClockStatus {
  clockedIn: boolean;
  since: string | null;
  entryId: string | null;
}

export interface TimeEntry {
  id: string;
  humanId: string;
  clockIn: string;
  clockOut: string | null;
  duration: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface HoursSummary {
  today: { minutes: number; hours: number };
  week: { minutes: number; hours: number };
  month: { minutes: number; hours: number };
}

export interface StaffClockOverview {
  id: string;
  name: string;
  email: string;
  role: string;
  clockedIn: boolean;
  clockedInSince: string | null;
  todayHours: number;
  weekHours: number;
  staffDailyRate: number | null;
  staffDailyHours: number | null;
}

export interface StaffPayment {
  id: string;
  humanId: string;
  amountUsd: string;
  paymentDate: string;
  notes: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  human: { name: string };
  createdBy: { name: string };
}

export interface HoursAdjustment {
  id: string;
  humanId: string;
  date: string;
  minutes: number;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  reviewedById: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
  human: { name: string; email: string };
  reviewedBy: { name: string } | null;
}

// ===== Videos (R2-backed) =====
export type VideoTier = 'NANO' | 'DRAFT' | 'FINAL';
export type VideoStatusType = 'GENERATING' | 'DRAFT' | 'READY' | 'SCHEDULED' | 'PUBLISHED' | 'ARCHIVED';

export interface VideoItem {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  tier: VideoTier;
  status: VideoStatusType;
  durationSeconds: number | null;
  aspectRatio: string;
  thumbnailUrl: string | null;
  estimatedCostUsd: number | null;
  conceptSlug: string | null;
  createdAt: string;
  updatedAt: string;
  _count: { assets: number; schedule: number };
}

export interface VideoAssetItem {
  id: string;
  videoId: string;
  r2Key: string;
  assetType: string;
  filename: string;
  contentType: string;
  fileSize: number | null;
  sceneNumber: number | null;
  url: string | null;
  createdAt: string;
}

export interface VideoDetail extends VideoItem {
  conceptSnapshot: Record<string, unknown>;
  scriptSnapshot: Record<string, unknown> | null;
  videoUrl: string | null;
  videoR2Key: string | null;
  thumbnailR2Key: string | null;
  generatedAt: string | null;
  assets: VideoAssetItem[];
  schedule: ScheduleEntry[];
}

// ===== Publication Schedule =====
export type PublishPlatform = 'TIKTOK' | 'YOUTUBE' | 'INSTAGRAM' | 'LINKEDIN' | 'TWITTER' | 'FACEBOOK' | 'BLOG';
export type PublishContentType = 'VIDEO' | 'ARTICLE' | 'SHORT_POST' | 'IMAGE_POST';
export type PublicationStatusType = 'DRAFT' | 'SCHEDULED' | 'PUBLISHING' | 'PUBLISHED' | 'FAILED' | 'CANCELLED';

export interface ScheduleEntry {
  id: string;
  videoId: string | null;
  contentItemId: string | null;
  title: string | null;
  body: string | null;
  imageR2Key: string | null;
  imageUrl: string | null;
  platform: PublishPlatform;
  contentType: PublishContentType;
  scheduledAt: string | null;
  publishedAt: string | null;
  isAuto: boolean;
  status: PublicationStatusType;
  publishedUrl: string | null;
  errorMessage: string | null;
  platformMeta: Record<string, unknown> | null;
  assignedToId: string | null;
  completedById: string | null;
  assignedTo: { id: string; name: string } | null;
  completedBy: { id: string; name: string } | null;
  video: { id: string; title: string; slug: string; tier?: VideoTier; thumbnailUrl?: string | null } | null;
  contentItem: { id: string; sourceTitle: string; platform: string; blogTitle?: string | null } | null;
  createdAt: string;
  updatedAt: string;
}

export interface ScheduleStats {
  byStatus: Record<string, number>;
  byPlatform: Record<string, number>;
  byContentType: Record<string, number>;
  upcoming: number;
}

// ===== Video Script (Storyboard) =====
export interface VideoScene {
  scene_number: number;
  duration_seconds: number;
  shot_type: string;
  camera_motion: string;
  setting: string;
  image_prompt: string;
  motion_prompt: string;
  overlay_text: string | null;
  dialogue: string | null;
  narration: string | null;
  sound_effect: string | null;
  transition_in: string;
  transition_out: string;
}

export interface VideoScriptData {
  title: string;
  concept: string;
  total_duration_seconds: number;
  visual_style: string;
  music_mood: string;
  color_palette: string;
  characters: Array<{ name: string; description: string }>;
  scenes: VideoScene[];
}

// ===== Video Batches =====
export interface BatchSummary {
  date: string;
  conceptCount: number;
  validConcepts: number;
  approvedCount: number;
  tier: string;
  approvedTier: string | null;
}

export interface BatchDetailConcept {
  number: number;
  title: string;
  concept: string;
  hook: string;
  pillar: string;
  hasThumbnails: boolean;
  thumbnailCount: number;
  approved: boolean;
  approvedTier: string | null;
  failed: boolean;
}

export interface BatchDetail {
  date: string;
  tier: string;
  conceptCount: number;
  concepts: BatchDetailConcept[];
}

export interface BatchConceptDetail {
  number: number;
  title: string;
  concept: string;
  hook: string;
  pillar: string;
  script: VideoScriptData | null;
  images: string[];
  approved: boolean;
  approvedTier: string | null;
  approvedAt: string | null;
}

// ===== Video Concepts =====
export type VideoConceptStatus = 'new' | 'nano_done' | 'approved' | 'draft_done' | 'final_done'
  | 'draft_images_ready' | 'final_images_ready' | 'draft_in_production' | 'final_in_production';

export interface VideoConcept {
  slug: string;
  title: string;
  status: VideoConceptStatus;
  duration: string;
  style: string;
  body: string;
  approvedTier: string | null;
  nanoDir: string | null;
}

export type VideoJobType = 'PREVIEW' | 'PRODUCE';
export type VideoJobStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'CHECKPOINT';

export interface VideoJob {
  id: string;
  conceptSlug: string;
  jobType: VideoJobType;
  tier: string;
  status: VideoJobStatus;
  claimedAt: string | null;
  completedAt: string | null;
  errorMessage: string | null;
  pipelineStep: string | null;
  progressPct: number | null;
  logTail: string | null;
  stepNumber: number | null;
  stepName: string | null;
  parentJobId: string | null;
  stepOutput: string | null;
  stepJobs?: VideoJob[];
  createdAt: string;
}

// ===== Photo Concepts =====
export type PhotoConceptStatus = 'new' | 'approved' | 'rendered' | 'rejected';

export interface PhotoConcept {
  slug: string;
  title: string;
  status: PhotoConceptStatus;
  postType: string;
  targetPlatforms: string[];
  concept: string;
  tone: string;
  imagePrompt?: string;
  imageStyle?: string;
  captionText?: string;
  bodyText?: string;
  topText?: string;
  bottomText?: string;
  statValue?: string;
  statLabel?: string;
  quoteText?: string;
  quoteAttribution?: string;
  jobTitle?: string;
  jobDescription?: string;
  jobBudget?: string;
  pillar?: string;
  hashtags?: string[];
  fontStyle?: string;
  accentColor?: string;
  needsImage?: boolean;
  assessmentScore?: number | null;
  assessmentVerdict?: string | null;
  createdAt: string;
}

// ===== Career Applications =====
export type CareerApplicationStatus = 'PENDING' | 'REVIEWED' | 'CONTACTED' | 'REJECTED' | 'HIRED';

export interface CareerApplication {
  id: string;
  positionId: string;
  positionTitle: string;
  about: string;
  portfolioUrl: string | null;
  availability: string;
  status: CareerApplicationStatus;
  adminNotes: string | null;
  createdAt: string;
  updatedAt: string;
  human: {
    id: string;
    name: string;
    email: string;
    location: string | null;
    username: string | null;
    bio?: string | null;
    skills?: string[];
    linkedinUrl?: string | null;
    githubUrl?: string | null;
    websiteUrl?: string | null;
    linkedinVerified?: boolean;
    githubVerified?: boolean;
  };
}

export interface CareerApplicationStats {
  total: number;
  pending: number;
  byStatus: Record<string, number>;
  byPosition: Record<string, number>;
}

// ===== Staff Productivity Tracking =====

export interface StaffProductivityEntry {
  id: string;
  name: string;
  email: string;
  role: string;
  status: 'active' | 'idle' | 'offline';
  clockedInSince: string | null;
  lastActivityAt: string | null;
  idleMinutes: number;
  todayTaskCount: number;
  workedMinutesToday: number;
  tasksPerHour: number;
}

export interface StaffActivityEvent {
  id: string;
  humanId: string;
  humanName: string;
  actionType: string;
  entityType: string | null;
  entityId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface IdleAlertEntry {
  id: string;
  humanId: string;
  humanName: string;
  status?: string;
  idleSince: string;
  idleMinutes: number;
  resolvedAt?: string | null;
  dismissedById?: string | null;
  createdAt: string;
}

export interface ProductivityDashboardData {
  staff: StaffProductivityEntry[];
  activityFeed: StaffActivityEvent[];
  idleAlerts: IdleAlertEntry[];
  config: { idleThresholdMinutes: number };
}

// ===== Lead Generation =====
export type LeadStatus = 'NEW' | 'VERIFIED' | 'OUTREACH_READY' | 'CONTACTED' | 'REPLIED' | 'ENGAGED' | 'CONVERTED' | 'REJECTED' | 'STALE' | 'BLOCKED';
export type LeadSource = 'MANUAL' | 'CSV_IMPORT' | 'PODCAST_MINE' | 'CONFERENCE' | 'PUBLICATION' | 'CATEGORY_SCAN' | 'REFERRAL';

export interface InfluencerLead {
  id: string;
  name: string;
  platforms: string[];
  handle: string | null;
  followers: string | null;
  email: string | null;
  phone: string | null;
  contactUrl: string | null;
  focusAreas: string | null;
  whyRelevant: string | null;
  notes: string | null;
  list: string;
  country: string | null;
  language: string | null;
  dedupeKey: string;
  source: LeadSource;
  sourceDetail: string | null;
  sourceUrl: string | null;
  status: LeadStatus;
  outreachMessage: string | null;
  outreachSentAt: string | null;
  outreachChannel: string | null;
  lastContactAt: string | null;
  responseNotes: string | null;
  lastActivityAt: string | null;
  lastActivityUrl: string | null;
  activityCheckedAt: string | null;
  pipelinePhase: string | null;
  pipelineRunId: string | null;
  competitorCleared: boolean;
  assignedToId: string | null;
  assignedTo: { id: string; name: string } | null;
  adminNotes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LeadStats {
  total: number;
  byStatus: Record<string, number>;
  byList: Record<string, number>;
  bySource: Record<string, number>;
  recentlyAdded: number;
}

export interface StaffBalance {
  humanId: string;
  name: string;
  email: string;
  staffDailyRate: number;
  staffDailyHours: number;
  hourlyRate: number;
  workedMinutes: number;
  workedHours: number;
  earned: number;
  paid: number;
  owed: number;
  from: string;
  to: string;
}

// ─── Logs (Axiom) ───

export interface LogEntryReq {
  method?: string;
  url?: string;
  statusCode?: number;
  responseTime?: number;
}

export interface LogEntryErr {
  name?: string;
  message?: string;
  stack?: string;
}

export interface LogEntry {
  timestamp: string;
  level: number;
  msg: string;
  req?: LogEntryReq;
  err?: LogEntryErr;
  raw: Record<string, any>;
}

export interface LogQueryResult {
  entries: LogEntry[];
  count: number;
  query: {
    dataset: string;
    timeRange: string;
    level?: string;
    search?: string;
  };
  status: {
    rowsExamined: number;
    rowsMatched: number;
    elapsedTime: number;
  };
}

export interface LogStats {
  timeSeries: any[];
  errorCount: number;
  totalCount: number;
  timeRange: string;
}

// ─── Marketing Ops ───

export interface MktOpsLog {
  id: string;
  timestamp: string;
  event: string;
  staff: string | null;
  prompt: string | null;
  response: string | null;
  model: string | null;
  durationMs: number | null;
  details: Record<string, unknown>;
}

export interface MktOpsDecision {
  id: string;
  createdAt: string;
  resolvedAt: string | null;
  staff: string | null;
  question: string;
  context: string;
  options: Array<{ label: string; callbackData: string }>;
  chosen: string | null;
  telegramMsgId: number | null;
  status: string;
}

export interface MktOpsConfig {
  id: string;
  key: string;
  value: unknown;
  updatedAt: string;
  updatedBy: string | null;
}

export interface MktOpsStaffProfile {
  name: string;
  timezone: string;
  availabilityStart: string;
  availabilityEnd: string;
  availabilityDays: string[];
  skills: string[];
  level: 'basic' | 'strategic' | 'technical';
  notes: string;
}

export interface MktOpsStrategy {
  focusAreas: string[];
  platformPriorities: string[];
  maxTasksPerPersonPerDay: number;
  maxFollowUpsBeforeEscalation: number;
  followUpIntervalHours: number;
}

export interface MktOpsDailyProcedures {
  morningBriefingTemplate: string;
  followUpStyle: string;
  eodQuestions: string[];
}

// ─── Watch Dog: AI Error Monitoring ───

export interface MonitoredError {
  id: string;
  fingerprint: string;
  level: number;
  errorType: string | null;
  message: string;
  firstSeenAt: string;
  lastSeenAt: string;
  occurrences: number;
  aiAnalysis: string | null;
  aiAnalyzedAt: string | null;
  status: 'new' | 'alerted' | 'acknowledged' | 'resolved' | 'ignored';
  alertedAt: string | null;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
  samplePayload: any;
  createdAt: string;
  updatedAt: string;
}

export interface WatchDogStats {
  total: number;
  new: number;
  alerted: number;
  acknowledged: number;
}
