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
}

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  username: string | null;
  location: string | null;
  isAvailable: boolean;
  emailVerified: boolean;
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
