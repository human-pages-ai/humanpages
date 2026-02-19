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
  };
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

export interface AdminMeResponse {
  isAdmin: boolean;
  isStaff: boolean;
  role: 'USER' | 'STAFF' | 'ADMIN';
}

export type PostingGroupStatus = 'PENDING' | 'JOINED' | 'POSTED' | 'REJECTED' | 'SKIPPED';

export type TaskType = 'fb_post' | 'yt_comment' | 'blog_comment';

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
  createdAt: string;
  apiKeyStatus: 'active' | 'none';
  apiKeyCreatedAt: string | null;
  totalCompleted: number;
  daily: Array<{ day: string; count: number }>;
  hourly: Array<{ hour: number; count: number }>;
}

export interface GenerateApiKeyResponse {
  apiKey: string;
  prefix: string;
}
