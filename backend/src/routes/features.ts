import { Router } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/adminAuth.js';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import fs from 'fs';
import path from 'path';

const router = Router();

// ─── Types ───

interface FeatureItem {
  id: string;
  domain: string;
  name: string;
  description: string;
  backendRoutes: string[];
  backendFiles: string[];
  frontendPages: string[];
  dbTables: string[];
  dbColumns: Record<string, string[]>;
  analyticsEvents: string[];
  testFiles: string[];
  testCount: number;
  testCoverage: 'high' | 'medium' | 'low' | 'none';
  hasUnitTests: boolean;
  hasIntegrationTests: boolean;
  hasFlowTests: boolean;
  hasFrontendTests: boolean;
  codeQuality: {
    score: number;
    errorHandling: string;
    inputValidation: string;
    typesSafety: string;
    separation: string;
    duplication: string;
    issues: string[];
  };
  monitoring: {
    currentStatus: string;
    existingMetrics: string[];
    gaps: string[];
  };
  businessValue: {
    score: number;
    category: string;
    rationale: string;
    userImpact: string;
    revenueImpact: string;
  };
  compositeGoal: {
    name: string;
    formula: string;
    target: string;
  };
}

interface FeaturesRegistry {
  version: string;
  generatedAt: string;
  platform: string;
  totalFeatures: number;
  domains: Record<string, number>;
  features: FeatureItem[];
}

interface MetricResult {
  label: string;
  value: number;
  recent?: number;
}

interface SummaryData {
  totalFeatures: number;
  avgCodeQuality: number;
  avgBusinessValue: number;
  testCoverageDistribution: { high: number; medium: number; low: number; none: number };
  monitoringDistribution: { good: number; partial: number; none: number };
  totalTestCount: number;
  totalIssues: number;
}

// ─── Load features.json (cached in memory) ───

let featuresRegistry: FeaturesRegistry | null = null;

function loadFeaturesRegistry(): FeaturesRegistry {
  if (featuresRegistry) return featuresRegistry;

  const registryPath = path.join(process.cwd(), 'src', 'features', 'registry.json');

  try {
    const content = fs.readFileSync(registryPath, 'utf-8');
    const parsed: FeaturesRegistry = JSON.parse(content);
    featuresRegistry = parsed;
    return parsed;
  } catch (error) {
    logger.error({ err: error, registryPath }, 'Failed to load features registry');
    throw new Error('Failed to load features registry');
  }
}

// ─── Summary calculation ───

function calculateSummary(features: FeatureItem[]): SummaryData {
  if (features.length === 0) {
    return {
      totalFeatures: 0,
      avgCodeQuality: 0,
      avgBusinessValue: 0,
      testCoverageDistribution: { high: 0, medium: 0, low: 0, none: 0 },
      monitoringDistribution: { good: 0, partial: 0, none: 0 },
      totalTestCount: 0,
      totalIssues: 0,
    };
  }

  return {
    totalFeatures: features.length,
    avgCodeQuality: Math.round(
      features.reduce((sum, f) => sum + f.codeQuality.score, 0) / features.length,
    ),
    avgBusinessValue: Math.round(
      features.reduce((sum, f) => sum + f.businessValue.score, 0) / features.length,
    ),
    testCoverageDistribution: {
      high: features.filter(f => f.testCoverage === 'high').length,
      medium: features.filter(f => f.testCoverage === 'medium').length,
      low: features.filter(f => f.testCoverage === 'low').length,
      none: features.filter(f => f.testCoverage === 'none').length,
    },
    monitoringDistribution: {
      good: features.filter(f => f.monitoring.currentStatus === 'good').length,
      partial: features.filter(f => f.monitoring.currentStatus === 'partial').length,
      none: features.filter(f => f.monitoring.currentStatus === 'none').length,
    },
    totalTestCount: features.reduce((sum, f) => sum + f.testCount, 0),
    totalIssues: features.reduce((sum, f) => sum + f.codeQuality.issues.length, 0),
  };
}

// ─── Metric queries per DB table ───
// Each returns an array of MetricResult. Only tables with a createdAt field
// include a `recent` count for the given period.

function buildTableMetrics(periodStart: Date): Record<string, () => Promise<MetricResult[]>> {
  return {
    Human: async () => [
      {
        label: 'Total Users',
        value: await prisma.human.count(),
        recent: await prisma.human.count({ where: { createdAt: { gte: periodStart } } }),
      },
    ],
    Wallet: async () => [
      {
        label: 'Total Wallets',
        value: await prisma.wallet.count(),
        recent: await prisma.wallet.count({ where: { createdAt: { gte: periodStart } } }),
      },
      {
        label: 'Verified Wallets',
        value: await prisma.wallet.count({ where: { verified: true } }),
      },
    ],
    Job: async () => [
      {
        label: 'Total Jobs',
        value: await prisma.job.count(),
        recent: await prisma.job.count({ where: { createdAt: { gte: periodStart } } }),
      },
    ],
    Agent: async () => [
      {
        label: 'Total Agents',
        value: await prisma.agent.count(),
        recent: await prisma.agent.count({ where: { createdAt: { gte: periodStart } } }),
      },
    ],
    Review: async () => [
      { label: 'Total Reviews', value: await prisma.review.count() },
    ],
    Service: async () => [
      { label: 'Services Listed', value: await prisma.service.count() },
    ],
    Vouch: async () => [
      { label: 'Total Vouches', value: await prisma.vouch.count() },
    ],
    FiatPaymentMethod: async () => [
      { label: 'Fiat Methods', value: await prisma.fiatPaymentMethod.count() },
    ],
    Listing: async () => [
      { label: 'Active Listings', value: await prisma.listing.count() },
    ],
    ListingApplication: async () => [
      { label: 'Applications', value: await prisma.listingApplication.count() },
    ],
    Education: async () => [
      { label: 'Education Entries', value: await prisma.education.count() },
    ],
    Affiliate: async () => [
      { label: 'Affiliates', value: await prisma.affiliate.count() },
    ],
    ModerationQueue: async () => [
      { label: 'Moderation Items', value: await prisma.moderationQueue.count() },
    ],
    ContentItem: async () => [
      { label: 'Content Items', value: await prisma.contentItem.count() },
    ],
    Video: async () => [
      { label: 'Videos', value: await prisma.video.count() },
    ],
    Feedback: async () => [
      { label: 'Feedback Items', value: await prisma.feedback.count() },
    ],
    PasswordReset: async () => [
      { label: 'Password Resets', value: await prisma.passwordReset.count() },
    ],
    EmailLog: async () => [
      { label: 'Emails Sent', value: await prisma.emailLog.count() },
    ],
  };
}

// ─── Period helpers ───

const VALID_PERIODS = ['24h', '7d', '30d'] as const;
type ValidPeriod = typeof VALID_PERIODS[number];

function parsePeriodDays(period: string): number {
  if (period === '24h') return 1;
  if (period === '30d') return 30;
  return 7; // default 7d
}

function sanitizePeriod(raw: string | undefined): ValidPeriod {
  if (raw && VALID_PERIODS.includes(raw as ValidPeriod)) return raw as ValidPeriod;
  return '7d';
}

// ─── Fetch metrics for a single feature ───

const METRIC_TIMEOUT_MS = 5_000;
const MAX_CONCURRENT_QUERIES = 10; // limit parallel DB queries to prevent connection exhaustion

/** Simple concurrency limiter — runs async tasks with at most `limit` in parallel */
async function parallelLimit<T>(tasks: (() => Promise<T>)[], limit: number): Promise<T[]> {
  const results: T[] = [];
  let i = 0;

  async function runNext(): Promise<void> {
    while (i < tasks.length) {
      const idx = i++;
      results[idx] = await tasks[idx]();
    }
  }

  const workers = Array.from({ length: Math.min(limit, tasks.length) }, () => runNext());
  await Promise.all(workers);
  return results;
}

async function fetchFeatureMetrics(
  feature: FeatureItem,
  periodStart: Date,
): Promise<MetricResult[]> {
  const tableMetrics = buildTableMetrics(periodStart);

  // Collect which tables this feature uses AND have a metric function
  const tablesToQuery = (feature.dbTables || []).filter(t => t in tableMetrics);
  if (tablesToQuery.length === 0) return [];

  // Build tasks with timeout, then run with concurrency limit
  const tasks = tablesToQuery.map(tableName => async (): Promise<MetricResult[]> => {
    try {
      const metricFn = tableMetrics[tableName];
      return await Promise.race([
        metricFn(),
        new Promise<MetricResult[]>((_, reject) =>
          setTimeout(() => reject(new Error(`Timeout querying ${tableName}`)), METRIC_TIMEOUT_MS),
        ),
      ]);
    } catch (err) {
      logger.warn({ err, tableName, featureId: feature.id }, 'Metric query failed');
      return [];
    }
  });

  const allResults = await parallelLimit(tasks, MAX_CONCURRENT_QUERIES);
  return allResults.flat();
}

// ─── Routes ───

// GET /features — list all features with optional live metrics
router.get('/', authenticateToken, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const registry = loadFeaturesRegistry();
    const domainParam = req.query.domain as string | undefined;
    const includeMetrics = req.query.metrics === 'true';
    const period = sanitizePeriod(req.query.period as string | undefined);

    let features = registry.features;

    // Filter by domain — validate against actual domains in the registry
    if (domainParam) {
      const validDomains = new Set(registry.features.map(f => f.domain));
      const requested = domainParam.split(',').map(d => d.trim()).filter(d => validDomains.has(d));
      if (requested.length > 0) {
        features = features.filter(f => requested.includes(f.domain));
      }
    }

    const summary = calculateSummary(features);

    // Optionally attach live metrics (slower — runs DB queries)
    if (includeMetrics) {
      const days = parsePeriodDays(period);
      const periodStart = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      const enriched = await Promise.all(
        features.map(async feature => {
          const metrics = await fetchFeatureMetrics(feature, periodStart);
          return { ...feature, liveMetrics: metrics.length > 0 ? metrics : undefined };
        }),
      );

      return res.json({ summary, features: enriched });
    }

    res.json({ summary, features });
  } catch (error) {
    logger.error({ err: error }, 'Features registry error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /features/:id/metrics — live metrics for a single feature
router.get('/:id/metrics', authenticateToken, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const registry = loadFeaturesRegistry();
    const feature = registry.features.find(f => f.id === req.params.id);

    if (!feature) {
      return res.status(404).json({ error: 'Feature not found' });
    }

    const period = sanitizePeriod(req.query.period as string | undefined);
    const days = parsePeriodDays(period);
    const periodStart = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const metrics = await fetchFeatureMetrics(feature, periodStart);

    res.json({
      featureId: feature.id,
      period,
      fetchedAt: new Date().toISOString(),
      metrics,
    });
  } catch (error) {
    logger.error({ err: error }, 'Feature metrics error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
