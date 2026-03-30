import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import type { AdminFeaturesResponse, FeatureItem, FeatureLiveMetric } from '../../types/admin';

/* ─── Helpers ──────────────────────────────────────────────── */

function fmt(n: number) {
  return n.toLocaleString();
}

function scoreColor(score: number): string {
  if (score >= 80) return 'bg-green-100 text-green-800';
  if (score >= 60) return 'bg-yellow-100 text-yellow-800';
  return 'bg-red-100 text-red-800';
}

function monitoringColor(status: string): string {
  if (status === 'good') return 'bg-green-100 text-green-800';
  if (status === 'partial') return 'bg-yellow-100 text-yellow-800';
  return 'bg-red-100 text-red-800';
}

function monitoringDotColor(status: string): string {
  if (status === 'good') return 'bg-green-500';
  if (status === 'partial') return 'bg-yellow-500';
  return 'bg-red-500';
}

function truncate(text: string, len: number): string {
  return text.length > len ? text.substring(0, len) + '...' : text;
}

const GITHUB_BASE = 'https://github.com/humanpages/humans/blob/master/';

/* ─── KPI Cards ──────────────────────────────────────────────── */

function KpiCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-gray-900">
        {typeof value === 'number' ? fmt(value) : value}
      </p>
      {sub && <p className="mt-1 text-sm text-gray-400">{sub}</p>}
    </div>
  );
}

/* ─── Feature Card Components ──────────────────────────────── */

function FeatureCardCollapsed({ feature }: { feature: FeatureItem }) {
  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-gray-900">{feature.name}</h3>
        <p className="text-xs text-gray-500 mt-1">{truncate(feature.description, 120)}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <span className={`text-xs font-medium px-2 py-1 rounded-full ${scoreColor(feature.codeQuality.score)}`}>
          Code Quality: {feature.codeQuality.score}
        </span>
        <span className={`text-xs font-medium px-2 py-1 rounded-full ${scoreColor(feature.businessValue.score)}`}>
          Business Value: {feature.businessValue.score}
        </span>
        <span className={`text-xs font-medium px-2 py-1 rounded-full ${
          feature.testCoverage === 'high'
            ? 'bg-green-100 text-green-800'
            : feature.testCoverage === 'medium'
              ? 'bg-blue-100 text-blue-800'
              : feature.testCoverage === 'low'
                ? 'bg-yellow-100 text-yellow-800'
                : 'bg-gray-100 text-gray-800'
        }`}>
          Tests: {feature.testCoverage}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className={`w-2.5 h-2.5 rounded-full ${monitoringDotColor(feature.monitoring.currentStatus)}`} />
        <span className="text-xs text-gray-600">
          Monitoring: <span className="font-medium capitalize">{feature.monitoring.currentStatus}</span>
        </span>
        {feature.monitoring.gaps.length > 0 && (
          <span className="text-xs font-medium text-red-600">{feature.monitoring.gaps.length} gaps</span>
        )}
      </div>
    </div>
  );
}

function FeatureCardExpanded({
  feature,
  metrics,
  metricsLoading,
}: {
  feature: FeatureItem;
  metrics?: FeatureLiveMetric[];
  metricsLoading: boolean;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-gray-900">{feature.name}</h3>
        <p className="text-sm text-gray-600 mt-2">{feature.description}</p>
      </div>

      {/* Scores Section */}
      <div className="border-t border-gray-200 pt-3">
        <h4 className="text-xs font-semibold text-gray-700 uppercase">Code Quality Breakdown</h4>
        <div className="mt-2 space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-gray-600">Error Handling</span>
            <span className="text-gray-900 font-medium">{feature.codeQuality.errorHandling}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-gray-600">Input Validation</span>
            <span className="text-gray-900 font-medium">{feature.codeQuality.inputValidation}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-gray-600">Type Safety</span>
            <span className="text-gray-900 font-medium">{feature.codeQuality.typesSafety}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-gray-600">Separation of Concerns</span>
            <span className="text-gray-900 font-medium">{feature.codeQuality.separation}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-gray-600">Code Duplication</span>
            <span className="text-gray-900 font-medium">{feature.codeQuality.duplication}</span>
          </div>
        </div>
      </div>

      {/* Business Value */}
      <div className="border-t border-gray-200 pt-3">
        <h4 className="text-xs font-semibold text-gray-700 uppercase">Business Value</h4>
        <div className="mt-2 space-y-1 text-xs">
          <div className="flex justify-between">
            <span className="text-gray-600">Category</span>
            <span className="text-gray-900 font-medium capitalize">{feature.businessValue.category}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Score</span>
            <span className="text-gray-900 font-medium">{feature.businessValue.score}</span>
          </div>
          <p className="text-gray-600 mt-2">Rationale: {feature.businessValue.rationale}</p>
          <p className="text-gray-600">User Impact: {feature.businessValue.userImpact}</p>
          <p className="text-gray-600">Revenue Impact: {feature.businessValue.revenueImpact}</p>
        </div>
      </div>

      {/* Source Files Section */}
      <div className="border-t border-gray-200 pt-3">
        <h4 className="text-xs font-semibold text-gray-700 uppercase">Source Files</h4>
        <div className="mt-2 space-y-2 text-xs">
          {feature.backendRoutes.length > 0 && (
            <div>
              <p className="text-gray-600 font-medium">Backend Routes</p>
              <p className="text-gray-500">{feature.backendRoutes.join(', ')}</p>
            </div>
          )}
          {feature.backendFiles.length > 0 && (
            <div>
              <p className="text-gray-600 font-medium">Backend Files</p>
              <div className="space-y-0.5">
                {feature.backendFiles.map((file, idx) => (
                  <a
                    key={idx}
                    href={`${GITHUB_BASE}${file}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 block"
                  >
                    {file}
                  </a>
                ))}
              </div>
            </div>
          )}
          {feature.frontendPages.length > 0 && (
            <div>
              <p className="text-gray-600 font-medium">Frontend Pages</p>
              <div className="space-y-0.5">
                {feature.frontendPages.map((page, idx) => (
                  <a
                    key={idx}
                    href={`${GITHUB_BASE}${page}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 block"
                  >
                    {page}
                  </a>
                ))}
              </div>
            </div>
          )}
          {feature.dbTables.length > 0 && (
            <div>
              <p className="text-gray-600 font-medium">DB Tables</p>
              <p className="text-gray-500">{feature.dbTables.join(', ')}</p>
            </div>
          )}
          {feature.analyticsEvents.length > 0 && (
            <div>
              <p className="text-gray-600 font-medium">Analytics Events</p>
              <p className="text-gray-500">{feature.analyticsEvents.join(', ')}</p>
            </div>
          )}
        </div>
      </div>

      {/* Monitoring Section */}
      <div className="border-t border-gray-200 pt-3">
        <h4 className="text-xs font-semibold text-gray-700 uppercase">Monitoring</h4>
        <div className="mt-2 space-y-2 text-xs">
          <div>
            <p className={`inline-block px-2 py-1 rounded-full font-medium ${monitoringColor(feature.monitoring.currentStatus)}`}>
              {feature.monitoring.currentStatus.toUpperCase()}
            </p>
          </div>
          {feature.monitoring.existingMetrics.length > 0 && (
            <div>
              <p className="text-gray-600 font-medium">Existing Metrics</p>
              <p className="text-gray-500">{feature.monitoring.existingMetrics.join(', ')}</p>
            </div>
          )}
          {feature.monitoring.gaps.length > 0 && (
            <div>
              <p className="text-red-700 font-medium">Gaps ({feature.monitoring.gaps.length})</p>
              <ul className="list-disc list-inside text-red-600 space-y-0.5">
                {feature.monitoring.gaps.map((gap, idx) => (
                  <li key={idx}>{gap}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Code Quality Issues */}
      {feature.codeQuality.issues.length > 0 && (
        <div className="border-t border-gray-200 pt-3">
          <h4 className="text-xs font-semibold text-gray-700 uppercase">Code Quality Issues ({feature.codeQuality.issues.length})</h4>
          <ul className="mt-2 list-disc list-inside space-y-1 text-xs text-gray-600">
            {feature.codeQuality.issues.map((issue, idx) => (
              <li key={idx}>{issue}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Composite Goal */}
      <div className="border-t border-gray-200 pt-3">
        <h4 className="text-xs font-semibold text-gray-700 uppercase">Composite Goal</h4>
        <div className="mt-2 space-y-1 text-xs">
          <p className="text-gray-600">
            <span className="font-medium">{feature.compositeGoal.name}</span>
          </p>
          <p className="text-gray-500">Formula: {feature.compositeGoal.formula}</p>
          <p className="text-gray-500">Target: {feature.compositeGoal.target}</p>
        </div>
      </div>

      {/* Live Metrics Section */}
      <div className="border-t border-gray-200 pt-3">
        <h4 className="text-xs font-semibold text-gray-700 uppercase">Live Metrics</h4>
        {metricsLoading ? (
          <p className="text-xs text-gray-500 mt-2">Loading metrics...</p>
        ) : metrics && metrics.length > 0 ? (
          <div className="mt-2 space-y-2">
            {metrics.map((metric, idx) => (
              <div key={idx} className="flex justify-between items-center text-xs">
                <span className="text-gray-600">{metric.label}</span>
                <div className="text-right">
                  <span className="text-gray-900 font-semibold">{fmt(metric.value)}</span>
                  {metric.recent !== undefined && (
                    <p className="text-gray-400 text-[10px]">Recent: {fmt(metric.recent)}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-gray-400 mt-2">No metrics available</p>
        )}
      </div>

      {/* Test Coverage */}
      <div className="border-t border-gray-200 pt-3">
        <h4 className="text-xs font-semibold text-gray-700 uppercase">Test Coverage</h4>
        <div className="mt-2 space-y-1 text-xs">
          <div className="flex justify-between">
            <span className="text-gray-600">Total Tests</span>
            <span className="text-gray-900 font-medium">{feature.testCount}</span>
          </div>
          <div className="flex gap-2 mt-2">
            {feature.hasUnitTests && (
              <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-[11px] font-medium">Unit</span>
            )}
            {feature.hasIntegrationTests && (
              <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-[11px] font-medium">Integration</span>
            )}
            {feature.hasFlowTests && (
              <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded text-[11px] font-medium">Flow</span>
            )}
            {feature.hasFrontendTests && (
              <span className="px-2 py-1 bg-orange-100 text-orange-800 rounded text-[11px] font-medium">Frontend</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Component ───────────────────────────────────────── */

export default function AdminFeatures() {
  const [data, setData] = useState<AdminFeaturesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [domainFilter, setDomainFilter] = useState<string>('all');
  const [monitoringFilter, setMonitoringFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('businessValue');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [expandedDomains, setExpandedDomains] = useState<Set<string>>(new Set());
  const [expandedFeature, setExpandedFeature] = useState<string | null>(null);
  const [metricsMap, setMetricsMap] = useState<Record<string, any>>({});
  const [metricsLoading, setMetricsLoading] = useState<Record<string, boolean>>({});

  useEffect(() => {
    api
      .getAdminFeatures()
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const fetchMetrics = async (featureId: string) => {
    setMetricsLoading((prev) => ({ ...prev, [featureId]: true }));
    try {
      const metrics = await api.getAdminFeatureMetrics(featureId);
      setMetricsMap((prev) => ({ ...prev, [featureId]: metrics.metrics }));
    } catch (err) {
      console.error('Failed to fetch metrics:', err);
    } finally {
      setMetricsLoading((prev) => ({ ...prev, [featureId]: false }));
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-32 bg-gray-200 animate-pulse rounded-lg" />
        <div className="grid grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-20 bg-gray-200 animate-pulse rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (error) return <p className="text-red-600 text-sm">{error}</p>;
  if (!data) return null;

  const { summary, features } = data;

  // Filter features
  let filtered = features;
  if (search) {
    const q = search.toLowerCase();
    filtered = filtered.filter(
      (f) =>
        f.name.toLowerCase().includes(q) ||
        f.description.toLowerCase().includes(q),
    );
  }
  if (domainFilter !== 'all') {
    filtered = filtered.filter((f) => f.domain === domainFilter);
  }
  if (monitoringFilter !== 'all') {
    filtered = filtered.filter((f) => f.monitoring.currentStatus === monitoringFilter);
  }

  // Sort
  filtered.sort((a, b) => {
    let aVal = 0,
      bVal = 0;
    if (sortBy === 'codeQuality') {
      aVal = a.codeQuality.score;
      bVal = b.codeQuality.score;
    } else if (sortBy === 'businessValue') {
      aVal = a.businessValue.score;
      bVal = b.businessValue.score;
    } else if (sortBy === 'name') {
      return sortOrder === 'asc'
        ? a.name.localeCompare(b.name)
        : b.name.localeCompare(a.name);
    }
    return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
  });

  // Group by domain
  const domains = Array.from(new Set(filtered.map((f) => f.domain))).sort();
  const allDomains = Array.from(new Set(features.map((f) => f.domain))).sort();

  const toggleDomain = (domain: string) => {
    setExpandedDomains((prev) => {
      const next = new Set(prev);
      if (next.has(domain)) next.delete(domain);
      else next.add(domain);
      return next;
    });
  };

  const toggleFeature = (featureId: string) => {
    setExpandedFeature((prev) => (prev === featureId ? null : featureId));
    if (expandedFeature !== featureId && !metricsMap[featureId]) {
      fetchMetrics(featureId);
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Header KPIs ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
        <KpiCard label="Total Features" value={summary.totalFeatures} />
        <KpiCard
          label="Avg Code Quality"
          value={summary.avgCodeQuality.toFixed(0)}
          sub="out of 100"
        />
        <KpiCard
          label="Avg Business Value"
          value={summary.avgBusinessValue.toFixed(0)}
          sub="out of 100"
        />
        <KpiCard
          label="Total Tests"
          value={summary.totalTestCount}
          sub={`Avg ${(summary.totalTestCount / summary.totalFeatures).toFixed(1)} per feature`}
        />
        <KpiCard
          label="Monitoring"
          value={`${summary.monitoringDistribution.good} good`}
          sub={`${summary.monitoringDistribution.partial} partial, ${summary.monitoringDistribution.none} none`}
        />
        <KpiCard label="Code Quality Issues" value={summary.totalIssues} />
      </div>

      {/* ── Filter Bar ───────────────────────────────────────── */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Search
            </label>
            <input
              type="text"
              placeholder="Feature name or description..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Domain
            </label>
            <select
              value={domainFilter}
              onChange={(e) => setDomainFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Domains</option>
              {allDomains.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Monitoring
            </label>
            <select
              value={monitoringFilter}
              onChange={(e) => setMonitoringFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Status</option>
              <option value="good">Good</option>
              <option value="partial">Partial</option>
              <option value="none">None</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Sort By
            </label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="businessValue">Business Value</option>
              <option value="codeQuality">Code Quality</option>
              <option value="name">Name</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Order
            </label>
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as 'asc' | 'desc')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="desc">Descending</option>
              <option value="asc">Ascending</option>
            </select>
          </div>
        </div>
      </div>

      {/* ── Feature Groups ────────────────────────────────────── */}
      <div className="space-y-4">
        {domains.map((domain) => {
          const domainFeatures = filtered.filter((f) => f.domain === domain);
          const domainAllFeatures = features.filter((f) => f.domain === domain);
          const avgQuality = domainFeatures.length
            ? (domainFeatures.reduce((sum, f) => sum + f.codeQuality.score, 0) / domainFeatures.length).toFixed(0)
            : 0;
          const avgValue = domainFeatures.length
            ? (domainFeatures.reduce((sum, f) => sum + f.businessValue.score, 0) / domainFeatures.length).toFixed(0)
            : 0;
          const isExpanded = expandedDomains.has(domain);

          return (
            <div key={domain}>
              <button
                onClick={() => toggleDomain(domain)}
                className="w-full flex items-center justify-between bg-white rounded-lg border border-gray-200 p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3 flex-1">
                  <span className={`transition-transform ${isExpanded ? 'rotate-90' : ''}`}>
                    ▶
                  </span>
                  <div className="text-left">
                    <h3 className="font-semibold text-gray-900">
                      {domain}
                    </h3>
                    <p className="text-xs text-gray-500">
                      {domainFeatures.length} of {domainAllFeatures.length} features
                      • Avg Quality: {avgQuality} • Avg Value: {avgValue}
                    </p>
                  </div>
                </div>
              </button>

              {isExpanded && (
                <div className="mt-2 space-y-2 ml-4">
                  {domainFeatures.map((feature) => {
                    const isFeatureExpanded = expandedFeature === feature.id;

                    return (
                      <button
                        key={feature.id}
                        onClick={() => toggleFeature(feature.id)}
                        className="w-full bg-white rounded-lg border border-gray-200 p-4 hover:border-blue-300 hover:bg-blue-50 transition-colors text-left"
                      >
                        {isFeatureExpanded ? (
                          <FeatureCardExpanded
                            feature={feature}
                            metrics={metricsMap[feature.id]}
                            metricsLoading={metricsLoading[feature.id] || false}
                          />
                        ) : (
                          <FeatureCardCollapsed feature={feature} />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
          <p className="text-gray-500">No features match your filters</p>
        </div>
      )}
    </div>
  );
}
