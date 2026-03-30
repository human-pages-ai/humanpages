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
  liveMetrics?: MetricData[];
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
  trend?: number; // percentage change
}

interface MetricData {
  tableName: string;
  metrics: MetricResult[];
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

// ─── Load features.json ───

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

// ─── Helper: Calculate summary ───

function calculateSummary(features: FeatureItem[]): SummaryData {
  const codeQualityScores = features.map(f => f.codeQuality.score);
  const businessValueScores = features.map(f => f.businessValue.score);

  const testCoverageDistribution = {
    high: features.filter(f => f.testCoverage === 'high').length,
    medium: features.filter(f => f.testCoverage === 'medium').length,
    low: features.filter(f => f.testCoverage === 'low').length,
    none: features.filter(f => f.testCoverage === 'none').length,
  };

  const monitoringDistribution = {
    good: features.filter(f => f.monitoring.currentStatus === 'good').length,
    partial: features.filter(f => f.monitoring.currentStatus === 'partial').length,
    none: features.filter(f => f.monitoring.currentStatus === 'none').length,
  };

  const totalIssues = features.reduce((sum, f) => sum + f.codeQuality.issues.length, 0);
  const totalTestCount = features.reduce((sum, f) => sum + f.testCount, 0);

  return {
    totalFeatures: features.length,
    avgCodeQuality: Math.round(codeQualityScores.reduce((a, b) => a + b, 0) / codeQualityScores.length),
    avgBusinessValue: Math.round(businessValueScores.reduce((a, b) => a + b, 0) / businessValueScores.length),
    testCoverageDistribution,
    monitoringDistribution,
    totalTestCount,
    totalIssues,
  };
}

// ─── TABLE_METRICS mapping ───

type PeriodStartGetter = () => Date;

const TABLE_METRICS: Record<string, (prismaInstance: typeof prisma, periodStart: PeriodStartGetter) => Promise<MetricResult[]>> = {
  Human: async (prismaInstance, periodStart) => [
    {
      label: 'Total Users',
      value: await prismaInstance.human.count(),
      recent: await prismaInstance.human.count({ where: { createdAt: { gte: periodStart() } } }),
    },
  ],
  Wallet: async (prismaInstance, periodStart) => [
    {
      label: 'Total Wallets',
      value: await prismaInstance.wallet.count(),
      recent: await prismaInstance.wallet.count({ where: { createdAt: { gte: periodStart() } } }),
    },
    {
      label: 'Verified Wallets',
      value: await prismaInstance.wallet.count({ where: { verified: true } }),
    },
  ],
  Job: async (prismaInstance, periodStart) => [
    {
      label: 'Total Jobs',
      value: await prismaInstance.job.count(),
      recent: await prismaInstance.job.count({ where: { createdAt: { gte: periodStart() } } }),
    },
  ],
  Agent: async (prismaInstance, periodStart) => [
    {
      label: 'Total Agents',
      value: await prismaInstance.agent.count(),
      recent: await prismaInstance.agent.count({ where: { createdAt: { gte: periodStart() } } }),
    },
  ],
  Review: async (prismaInstance, periodStart) => [
    {
      label: 'Total Reviews',
      value: await prismaInstance.review.count(),
    },
  ],
  Service: async (prismaInstance, periodStart) => [
    {
      label: 'Services Listed',
      value: await prismaInstance.service.count(),
    },
  ],
  Vouch: async (prismaInstance, periodStart) => [
    {
      label: 'Total Vouches',
      value: await prismaInstance.vouch.count(),
    },
  ],
  FiatPaymentMethod: async (prismaInstance, periodStart) => [
    {
      label: 'Fiat Methods',
      value: await prismaInstance.fiatPaymentMethod.count(),
    },
  ],
  Listing: async (prismaInstance, periodStart) => [
    {
      label: 'Active Listings',
      value: await prismaInstance.listing.count(),
    },
  ],
  ListingApplication: async (prismaInstance, periodStart) => [
    {
      label: 'Applications',
      value: await prismaInstance.listingApplication.count(),
    },
  ],
  Education: async (prismaInstance, periodStart) => [
    {
      label: 'Education Entries',
      value: await prismaInstance.education.count(),
    },
  ],
  Affiliate: async (prismaInstance, periodStart) => [
    {
      label: 'Affiliates',
      value: await prismaInstance.affiliate.count(),
    },
  ],
  ModerationQueue: async (prismaInstance, periodStart) => [
    {
      label: 'Moderation Items',
      value: await prismaInstance.moderationQueue.count(),
    },
  ],
  ContentItem: async (prismaInstance, periodStart) => [
    {
      label: 'Content Items',
      value: await prismaInstance.contentItem.count(),
    },
  ],
  Video: async (prismaInstance, periodStart) => [
    {
      label: 'Videos',
      value: await prismaInstance.video.count(),
    },
  ],
  Feedback: async (prismaInstance, periodStart) => [
    {
      label: 'Feedback Items',
      value: await prismaInstance.feedback.count(),
    },
  ],
  PasswordReset: async (prismaInstance, periodStart) => [
    {
      label: 'Password Resets',
      value: await prismaInstance.passwordReset.count(),
    },
  ],
  EmailLog: async (prismaInstance, periodStart) => [
    {
      label: 'Emails Sent',
      value: await prismaInstance.emailLog.count(),
    },
  ],
};

// ─── Helper: Parse period parameter ───

function getPeriodDates(period: string): { start: Date; previous: Date } {
  const now = new Date();
  const days = period === '24h' ? 1 : period === '30d' ? 30 : 7; // default 7d
  const start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const previous = new Date(start.getTime() - days * 24 * 60 * 60 * 1000);

  return { start, previous };
}

// ─── Helper: Calculate trend ───

function calculateTrend(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

// ─── Routes ───

// GET /features
router.get('/', authenticateToken, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const registry = loadFeaturesRegistry();
    const domainFilter = (req.query.domain as string)?.split(',').map(d => d.trim()) || null;
    const includeMetrics = req.query.metrics === 'true';
    const period = (req.query.period as string) || '7d';

    let features = registry.features;

    // Filter by domain if specified
    if (domainFilter && domainFilter.length > 0) {
      features = features.filter(f => domainFilter.includes(f.domain));
    }

    // Optionally enrich with live metrics
    if (includeMetrics) {
      const { start: periodStart, previous: previousStart } = getPeriodDates(period);
      const periodStartFn = () => periodStart;
      const previousStartFn = () => previousStart;

      const enrichedFeatures: FeatureItem[] = await Promise.all(
        features.map(async feature => {
          const liveMetrics: MetricData[] = [];

          for (const tableName of feature.dbTables) {
            const metricFn = TABLE_METRICS[tableName];
            if (!metricFn) continue;

            try {
              const currentMetrics = await Promise.race([
                metricFn(prisma, periodStartFn),
                new Promise<MetricResult[]>((_, reject) =>
                  setTimeout(() => reject(new Error('Metric query timeout')), 5000)
                ),
              ]);

              const previousMetrics = await Promise.race([
                metricFn(prisma, previousStartFn),
                new Promise<MetricResult[]>((_, reject) =>
                  setTimeout(() => reject(new Error('Metric query timeout')), 5000)
                ),
              ]);

              // Calculate trends
              const metricsWithTrend = currentMetrics.map(curr => {
                const prev = previousMetrics.find(p => p.label === curr.label);
                if (prev && curr.recent !== undefined) {
                  return {
                    ...curr,
                    trend: calculateTrend(curr.recent, prev.value),
                  };
                }
                return curr;
              });

              liveMetrics.push({
                tableName,
                metrics: metricsWithTrend,
              });
            } catch (error) {
              logger.warn({ err: error, tableName, featureId: feature.id }, 'Failed to fetch metrics for table');
            }
          }

          return {
            ...feature,
            liveMetrics: liveMetrics.length > 0 ? liveMetrics : undefined,
          };
        })
      );

      const summary = calculateSummary(enrichedFeatures);

      return res.json({
        summary,
        features: enrichedFeatures,
      });
    }

    const summary = calculateSummary(features);

    res.json({
      summary,
      features,
    });
  } catch (error) {
    logger.error({ err: error }, 'Features registry error');
    res.status(500).json({ error: 'Internal server error', detail: error instanceof Error ? error.message : String(error) });
  }
});

// GET /features/:id/metrics
router.get('/:id/metrics', authenticateToken, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const registry = loadFeaturesRegistry();
    const feature = registry.features.find(f => f.id === req.params.id);

    if (!feature) {
      return res.status(404).json({ error: 'Feature not found' });
    }

    const period = (req.query.period as string) || '7d';
    const { start: periodStart, previous: previousStart } = getPeriodDates(period);
    const periodStartFn = () => periodStart;
    const previousStartFn = () => previousStart;

    const liveMetrics: MetricData[] = [];

    for (const tableName of feature.dbTables) {
      const metricFn = TABLE_METRICS[tableName];
      if (!metricFn) continue;

      try {
        const currentMetrics = await Promise.race([
          metricFn(prisma, periodStartFn),
          new Promise<MetricResult[]>((_, reject) =>
            setTimeout(() => reject(new Error('Metric query timeout')), 5000)
          ),
        ]);

        const previousMetrics = await Promise.race([
          metricFn(prisma, previousStartFn),
          new Promise<MetricResult[]>((_, reject) =>
            setTimeout(() => reject(new Error('Metric query timeout')), 5000)
          ),
        ]);

        // Calculate trends
        const metricsWithTrend = currentMetrics.map(curr => {
          const prev = previousMetrics.find(p => p.label === curr.label);
          if (prev && curr.recent !== undefined) {
            return {
              ...curr,
              trend: calculateTrend(curr.recent, prev.value),
            };
          }
          return curr;
        });

        liveMetrics.push({
          tableName,
          metrics: metricsWithTrend,
        });
      } catch (error) {
        logger.warn({ err: error, tableName, featureId: feature.id }, 'Failed to fetch metrics for table');
      }
    }

    res.json({
      featureId: feature.id,
      featureName: feature.name,
      period,
      periodStart: periodStart.toISOString(),
      metrics: liveMetrics,
    });
  } catch (error) {
    logger.error({ err: error }, 'Features metrics error');
    res.status(500).json({ error: 'Internal server error', detail: error instanceof Error ? error.message : String(error) });
  }
});

export default router;
