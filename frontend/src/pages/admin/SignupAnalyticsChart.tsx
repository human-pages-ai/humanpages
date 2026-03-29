import { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts';
import type { AdminStats } from '../../types/admin';

/* ─── Types ──────────────────────────────────────────────── */

type DaySeries = { day: string; count: number }[];

interface ChartRow {
  day: string;
  // Raw counts
  total: number;
  active: number;
  crypto: number;
  cv: number;
  verified: number;
  cumulative: number;
  jobs: number;
  paidJobs: number;
  paymentVolume: number;
  applications: number;
  agents: number;
  // Computed rates (%)
  verifiedRate: number;
  cryptoRate: number;
  cvRate: number;
  appsPerJob: number;
  // 7-day rolling averages
  totalMa7: number;
  activeMa7: number;
  jobsMa7: number;
  [key: string]: string | number;
}

type ViewMode = 'timeseries' | 'rates' | 'stacked';

interface SeriesConfig {
  key: string;
  label: string;
  color: string;
  type: 'line' | 'bar';
  defaultOn: boolean;
  dashArray?: string;
  group: string;
  views: ViewMode[];
  unit?: string;
}

/* ─── Series Config ───────────────────────────────────────── */

const SERIES: SeriesConfig[] = [
  // ─ Signups
  { key: 'total',      label: 'All Signups',         color: '#3b82f6', type: 'bar',  defaultOn: true,  group: 'onboarding', views: ['timeseries', 'stacked'] },
  { key: 'verified',   label: 'Verified',            color: '#22c55e', type: 'line', defaultOn: true,  group: 'onboarding', views: ['timeseries', 'stacked'] },
  { key: 'crypto',     label: 'With Crypto Wallet',  color: '#f97316', type: 'line', defaultOn: true,  group: 'onboarding', views: ['timeseries', 'stacked'] },
  { key: 'cv',         label: 'With CV',             color: '#8b5cf6', type: 'line', defaultOn: true,  group: 'onboarding', views: ['timeseries', 'stacked'] },
  // ─ Engagement
  { key: 'active',     label: 'Active Users',        color: '#06b6d4', type: 'line', defaultOn: false, group: 'engagement', views: ['timeseries'], dashArray: '5 3' },
  { key: 'agents',     label: 'New Agents',          color: '#ec4899', type: 'line', defaultOn: false, group: 'engagement', views: ['timeseries'] },
  { key: 'activeMa7',  label: 'Active (7d avg)',     color: '#06b6d4', type: 'line', defaultOn: false, group: 'engagement', views: ['timeseries'], dashArray: '2 2' },
  // ─ Marketplace
  { key: 'jobs',          label: 'Jobs Created',     color: '#eab308', type: 'line', defaultOn: false, group: 'marketplace', views: ['timeseries'] },
  { key: 'paidJobs',      label: 'Paid Jobs',        color: '#16a34a', type: 'line', defaultOn: false, group: 'marketplace', views: ['timeseries'] },
  { key: 'applications',  label: 'Applications',     color: '#14b8a6', type: 'line', defaultOn: false, group: 'marketplace', views: ['timeseries'] },
  // ─ Revenue
  { key: 'paymentVolume', label: 'Payment Vol ($)',   color: '#dc2626', type: 'bar',  defaultOn: false, group: 'revenue',     views: ['timeseries'], unit: '$' },
  // ─ Trends
  { key: 'totalMa7',     label: 'Signups (7d avg)',  color: '#1d4ed8', type: 'line', defaultOn: false, group: 'trends',      views: ['timeseries'], dashArray: '2 2' },
  { key: 'jobsMa7',      label: 'Jobs (7d avg)',     color: '#a16207', type: 'line', defaultOn: false, group: 'trends',      views: ['timeseries'], dashArray: '2 2' },
  { key: 'cumulative',   label: 'Cumulative Total',  color: '#64748b', type: 'line', defaultOn: false, group: 'trends',      views: ['timeseries'], dashArray: '3 3' },
  // ─ Conversion rates (rates view only)
  { key: 'verifiedRate', label: 'Verified %',        color: '#22c55e', type: 'line', defaultOn: true,  group: 'rates',       views: ['rates'], unit: '%' },
  { key: 'cryptoRate',   label: 'Crypto Adoption %', color: '#f97316', type: 'line', defaultOn: true,  group: 'rates',       views: ['rates'], unit: '%' },
  { key: 'cvRate',       label: 'CV Upload %',       color: '#8b5cf6', type: 'line', defaultOn: true,  group: 'rates',       views: ['rates'], unit: '%' },
  { key: 'appsPerJob',   label: 'Apps / Job',        color: '#14b8a6', type: 'line', defaultOn: true,  group: 'rates',       views: ['rates'] },
];

const GROUPS: { key: string; label: string; views: ViewMode[] }[] = [
  { key: 'onboarding',  label: 'Onboarding',   views: ['timeseries', 'stacked'] },
  { key: 'engagement',  label: 'Engagement',    views: ['timeseries'] },
  { key: 'marketplace', label: 'Marketplace',   views: ['timeseries'] },
  { key: 'revenue',     label: 'Revenue',       views: ['timeseries'] },
  { key: 'trends',      label: 'Trends',        views: ['timeseries'] },
  { key: 'rates',       label: 'Conversion',    views: ['rates'] },
];

const RANGE_OPTIONS = [
  { label: '7d',  days: 7 },
  { label: '14d', days: 14 },
  { label: '30d', days: 30 },
  { label: '60d', days: 60 },
  { label: '90d', days: 90 },
] as const;

const VIEW_MODES: { key: ViewMode; label: string }[] = [
  { key: 'timeseries', label: 'Time Series' },
  { key: 'rates',      label: 'Conversion Rates' },
  { key: 'stacked',    label: 'Signup Breakdown' },
];

/* ─── Helpers ─────────────────────────────────────────────── */

function addSeries(map: Map<string, Record<string, number>>, series: DaySeries, key: string) {
  for (const s of series) {
    const row = map.get(s.day) || {};
    row[key] = s.count;
    map.set(s.day, row);
  }
}

function rollingAvg(arr: number[], window: number): number[] {
  return arr.map((_, i) => {
    const start = Math.max(0, i - window + 1);
    const slice = arr.slice(start, i + 1);
    return slice.length > 0 ? Math.round(slice.reduce((a, b) => a + b, 0) / slice.length * 10) / 10 : 0;
  });
}

function safeDiv(a: number, b: number): number {
  return b > 0 ? Math.round((a / b) * 1000) / 10 : 0;
}

function mergeSeriesData(usage: NonNullable<AdminStats['usage']>): ChartRow[] {
  const map = new Map<string, Record<string, number>>();

  addSeries(map, usage.signupsByDay, 'total');
  addSeries(map, usage.activeByDay, 'active');
  addSeries(map, usage.cryptoSignupsByDay, 'crypto');
  addSeries(map, usage.cvSignupsByDay, 'cv');
  addSeries(map, usage.verifiedSignupsByDay, 'verified');
  addSeries(map, usage.cumulativeSignups, 'cumulative');
  addSeries(map, usage.jobsByDay, 'jobs');
  addSeries(map, usage.paidJobsByDay, 'paidJobs');
  addSeries(map, usage.paymentVolumeByDay, 'paymentVolume');
  addSeries(map, usage.applicationsByDay, 'applications');
  addSeries(map, usage.agentsByDay, 'agents');

  const sorted = Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));

  // Extract raw arrays for rolling averages
  const totals = sorted.map(([, v]) => v.total || 0);
  const actives = sorted.map(([, v]) => v.active || 0);
  const jobsArr = sorted.map(([, v]) => v.jobs || 0);
  const totalMa7 = rollingAvg(totals, 7);
  const activeMa7 = rollingAvg(actives, 7);
  const jobsMa7 = rollingAvg(jobsArr, 7);

  return sorted.map(([day, v], i) => {
    const t = v.total || 0;
    const j = v.jobs || 0;
    return {
      day,
      total: t,
      active: v.active || 0,
      crypto: v.crypto || 0,
      cv: v.cv || 0,
      verified: v.verified || 0,
      cumulative: v.cumulative || 0,
      jobs: j,
      paidJobs: v.paidJobs || 0,
      paymentVolume: v.paymentVolume || 0,
      applications: v.applications || 0,
      agents: v.agents || 0,
      // Computed rates
      verifiedRate: safeDiv(v.verified || 0, t),
      cryptoRate: safeDiv(v.crypto || 0, t),
      cvRate: safeDiv(v.cv || 0, t),
      appsPerJob: j > 0 ? Math.round(((v.applications || 0) / j) * 10) / 10 : 0,
      // Rolling averages
      totalMa7: totalMa7[i],
      activeMa7: activeMa7[i],
      jobsMa7: jobsMa7[i],
    };
  });
}

function formatDate(day: string) {
  const d = new Date(day + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function delta(current: number, previous: number): { pct: number; dir: 'up' | 'down' | 'flat' } {
  if (previous === 0) return { pct: current > 0 ? 100 : 0, dir: current > 0 ? 'up' : 'flat' };
  const pct = Math.round(((current - previous) / previous) * 100);
  return { pct: Math.abs(pct), dir: pct > 0 ? 'up' : pct < 0 ? 'down' : 'flat' };
}

/* ─── Custom Tooltip ──────────────────────────────────────── */

function ChartTooltip({ active, payload, label, viewMode, prevRow }: any) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload as ChartRow | undefined;

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-sm min-w-[200px] max-w-[280px]">
      <p className="font-semibold text-gray-700 mb-1.5">{formatDate(label)}</p>
      {payload.map((entry: any) => {
        const seriesCfg = SERIES.find(s => s.key === entry.dataKey);
        const unit = seriesCfg?.unit || '';
        const formattedVal = unit === '$'
          ? `$${entry.value?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
          : `${entry.value?.toLocaleString() ?? 0}${unit}`;

        return (
          <div key={entry.dataKey} className="flex items-center gap-2 py-0.5">
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: entry.color }} />
            <span className="text-gray-600 truncate">{entry.name}:</span>
            <span className="font-semibold text-gray-900 ml-auto pl-2 whitespace-nowrap">{formattedVal}</span>
          </div>
        );
      })}
      {/* Contextual ratios in time series view */}
      {viewMode === 'timeseries' && row && row.total > 0 && (
        <div className="mt-2 pt-2 border-t border-gray-100 space-y-0.5">
          <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Conversion Rates</p>
          <div className="text-xs text-gray-500 flex justify-between">
            <span>Verified:</span> <span className="font-medium text-gray-700">{row.verifiedRate}%</span>
          </div>
          <div className="text-xs text-gray-500 flex justify-between">
            <span>Crypto:</span> <span className="font-medium text-gray-700">{row.cryptoRate}%</span>
          </div>
          <div className="text-xs text-gray-500 flex justify-between">
            <span>CV:</span> <span className="font-medium text-gray-700">{row.cvRate}%</span>
          </div>
          {row.jobs > 0 && (
            <div className="text-xs text-gray-500 flex justify-between">
              <span>Apps/Job:</span> <span className="font-medium text-gray-700">{row.appsPerJob}</span>
            </div>
          )}
        </div>
      )}
      {/* Day-over-day change */}
      {prevRow && row && viewMode === 'timeseries' && (
        <div className="mt-2 pt-2 border-t border-gray-100">
          <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">vs Previous Day</p>
          {[
            { key: 'total', label: 'Signups' },
            { key: 'active', label: 'Active' },
            { key: 'jobs', label: 'Jobs' },
          ].map(({ key, label: lbl }) => {
            const curr = Number(row[key]) || 0;
            const prev = Number(prevRow[key]) || 0;
            const d = delta(curr, prev);
            return (
              <div key={key} className="text-xs text-gray-500 flex justify-between">
                <span>{lbl}:</span>
                <span className={d.dir === 'up' ? 'text-green-600 font-medium' : d.dir === 'down' ? 'text-red-500 font-medium' : 'text-gray-400'}>
                  {d.dir === 'flat' ? '--' : `${d.dir === 'up' ? '\u2191' : '\u2193'} ${d.pct}%`}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ─── Trend Badge ─────────────────────────────────────────── */

function TrendBadge({ current, previous }: { current: number; previous: number }) {
  const { pct, dir } = delta(current, previous);
  if (dir === 'flat') return <span className="text-[10px] text-gray-400">--</span>;
  const isUp = dir === 'up';
  return (
    <span className={`text-[10px] font-medium ${isUp ? 'text-green-600' : 'text-red-500'}`}>
      {isUp ? '\u2191' : '\u2193'} {pct}%
    </span>
  );
}

/* ─── Main Component ──────────────────────────────────────── */

export default function SignupAnalyticsChart({ usage }: { usage: NonNullable<AdminStats['usage']> }) {
  const [range, setRange] = useState(30);
  const [viewMode, setViewMode] = useState<ViewMode>('timeseries');
  const [enabledSeries, setEnabledSeries] = useState<Set<string>>(
    () => new Set(SERIES.filter(s => s.defaultOn).map(s => s.key))
  );

  const allData = useMemo(() => mergeSeriesData(usage), [usage]);
  const data = useMemo(() => allData.slice(-range), [allData, range]);

  const toggleSeries = (key: string) => {
    setEnabledSeries(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Summary stats with period-over-period comparison
  const stats = useMemo(() => {
    const half = Math.floor(data.length / 2);
    const recent = data.slice(half);
    const prior = data.slice(0, half);

    const sum = (arr: ChartRow[], key: keyof ChartRow) =>
      arr.reduce((s, d) => s + (Number(d[key]) || 0), 0);

    const totalSignups = sum(data, 'total');
    const avgPerDay = data.length > 0 ? Math.round(totalSignups / data.length * 10) / 10 : 0;
    const totalVerified = sum(data, 'verified');
    const totalJobs = sum(data, 'jobs');
    const totalPaidJobs = sum(data, 'paidJobs');
    const totalPaymentVol = Math.round(sum(data, 'paymentVolume') * 100) / 100;

    return {
      totalSignups, avgPerDay,
      totalVerified,
      totalCrypto: sum(data, 'crypto'),
      totalCV: sum(data, 'cv'),
      totalJobs,
      totalPaidJobs,
      totalPaymentVol,
      totalApps: sum(data, 'applications'),
      fillRate: totalJobs > 0 ? Math.round((totalPaidJobs / totalJobs) * 100) : 0,
      avgVerifiedRate: totalSignups > 0 ? Math.round((totalVerified / totalSignups) * 100) : 0,
      signupsTrend: { current: sum(recent, 'total'), previous: sum(prior, 'total') },
      cryptoTrend: { current: sum(recent, 'crypto'), previous: sum(prior, 'crypto') },
      jobsTrend: { current: sum(recent, 'jobs'), previous: sum(prior, 'jobs') },
      revenueTrend: { current: sum(recent, 'paymentVolume'), previous: sum(prior, 'paymentVolume') },
    };
  }, [data]);

  // Auto-detect right Y-axis for scale mismatches
  const { rightAxisKeys, showRightAxis } = useMemo(() => {
    const visibleSeries = SERIES.filter(s => s.views.includes(viewMode) && enabledSeries.has(s.key));
    const enabledKeys = visibleSeries.map(s => s.key);
    if (enabledKeys.length < 2) return { rightAxisKeys: new Set<string>(), showRightAxis: false };

    const maxByKey = new Map<string, number>();
    for (const key of enabledKeys) {
      maxByKey.set(key, Math.max(...data.map(d => Number(d[key]) || 0), 1));
    }

    const maxValues = [...maxByKey.values()].sort((a, b) => a - b);
    const median = maxValues[Math.floor(maxValues.length / 2)];
    const threshold = median * 5;

    const rightKeys = new Set<string>();
    for (const [key, max] of maxByKey) {
      if (max > threshold) rightKeys.add(key);
    }

    return { rightAxisKeys: rightKeys, showRightAxis: rightKeys.size > 0 };
  }, [data, enabledSeries, viewMode]);

  // Filtered series for current view
  const visibleSeries = useMemo(
    () => SERIES.filter(s => s.views.includes(viewMode) && enabledSeries.has(s.key)),
    [viewMode, enabledSeries],
  );
  const visibleGroups = GROUPS.filter(g => g.views.includes(viewMode));

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-800">Growth Analytics</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            {viewMode === 'rates' ? 'Conversion rates' : viewMode === 'stacked' ? 'Signup composition' : 'Daily metrics'} — last {range} days
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* View mode switcher */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
            {VIEW_MODES.map(v => (
              <button
                key={v.key}
                onClick={() => setViewMode(v.key)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                  viewMode === v.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {v.label}
              </button>
            ))}
          </div>
          {/* Range switcher */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
            {RANGE_OPTIONS.map(opt => (
              <button
                key={opt.days}
                onClick={() => setRange(opt.days)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                  range === opt.days ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Summary Stats with Trends */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5 mb-5">
        {[
          { label: 'Signups', value: stats.totalSignups, color: 'text-blue-600', trend: stats.signupsTrend },
          { label: 'Avg/Day', value: stats.avgPerDay, color: 'text-gray-700', trend: null },
          { label: 'Verified %', value: `${stats.avgVerifiedRate}%`, color: 'text-green-600', trend: null },
          { label: 'W/ Crypto', value: stats.totalCrypto, color: 'text-orange-600', trend: stats.cryptoTrend },
          { label: 'Jobs', value: stats.totalJobs, color: 'text-yellow-600', trend: stats.jobsTrend },
          { label: 'Fill Rate', value: `${stats.fillRate}%`, color: stats.fillRate > 50 ? 'text-green-600' : 'text-red-500', trend: null },
          { label: 'Revenue', value: `$${stats.totalPaymentVol.toLocaleString()}`, color: 'text-red-600', trend: stats.revenueTrend },
          { label: 'Applications', value: stats.totalApps, color: 'text-teal-600', trend: null },
        ].map(s => (
          <div key={s.label} className="text-center">
            <p className={`text-base font-bold ${s.color}`}>{typeof s.value === 'number' ? s.value.toLocaleString() : s.value}</p>
            <p className="text-[10px] text-gray-400 uppercase tracking-wide">{s.label}</p>
            {s.trend && <TrendBadge current={s.trend.current} previous={s.trend.previous} />}
          </div>
        ))}
      </div>

      {/* Series Toggles (grouped) */}
      <div className="flex flex-wrap gap-x-5 gap-y-2 mb-4">
        {visibleGroups.map(g => {
          const groupSeries = SERIES.filter(s => s.group === g.key && s.views.includes(viewMode));
          if (groupSeries.length === 0) return null;
          return (
            <div key={g.key} className="flex items-center gap-1.5">
              <span className="text-[10px] text-gray-400 uppercase tracking-wider font-medium mr-1">{g.label}</span>
              {groupSeries.map(s => (
                <button
                  key={s.key}
                  onClick={() => toggleSeries(s.key)}
                  className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium transition-all border ${
                    enabledSeries.has(s.key) ? 'border-transparent shadow-sm' : 'border-gray-200 bg-white text-gray-400'
                  }`}
                  style={enabledSeries.has(s.key) ? {
                    backgroundColor: s.color + '18',
                    color: s.color,
                    borderColor: s.color + '40',
                  } : undefined}
                >
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: enabledSeries.has(s.key) ? s.color : '#d1d5db' }} />
                  {s.label}
                </button>
              ))}
            </div>
          );
        })}
      </div>

      {/* Chart */}
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 5, right: showRightAxis ? 10 : 5, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis
              dataKey="day"
              tickFormatter={formatDate}
              tick={{ fontSize: 11, fill: '#94a3b8' }}
              axisLine={{ stroke: '#e2e8f0' }}
              tickLine={false}
              interval={range <= 7 ? 0 : range <= 14 ? 1 : range <= 30 ? 'preserveStartEnd' : Math.floor(range / 10)}
            />
            <YAxis
              yAxisId="left"
              tick={{ fontSize: 11, fill: '#94a3b8' }}
              axisLine={false}
              tickLine={false}
              width={40}
              tickFormatter={viewMode === 'rates'
                ? (v: number) => `${v}%`
                : (v: number) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v)}
            />
            {showRightAxis && (
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                axisLine={false}
                tickLine={false}
                width={55}
                tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v)}
              />
            )}
            <Tooltip
              content={(props: any) => {
                const idx = data.findIndex(d => d.day === props.label);
                const prevRow = idx > 0 ? data[idx - 1] : null;
                return <ChartTooltip {...props} viewMode={viewMode} prevRow={prevRow} />;
              }}
            />

            {/* Stacked bar mode */}
            {viewMode === 'stacked' && (
              <>
                {enabledSeries.has('total') && (
                  <Bar yAxisId="left" dataKey="total" name="All Signups" stackId="signup" fill="#3b82f6" fillOpacity={0.3} radius={[0, 0, 0, 0]} barSize={range <= 14 ? 22 : range <= 30 ? 14 : 8} />
                )}
                {enabledSeries.has('verified') && (
                  <Bar yAxisId="left" dataKey="verified" name="Verified" stackId="quality" fill="#22c55e" fillOpacity={0.7} radius={[0, 0, 0, 0]} barSize={range <= 14 ? 22 : range <= 30 ? 14 : 8} />
                )}
                {enabledSeries.has('crypto') && (
                  <Line yAxisId="left" type="monotone" dataKey="crypto" name="With Crypto" stroke="#f97316" strokeWidth={2} dot={range <= 14 ? { r: 3, strokeWidth: 2, fill: '#fff' } : false} />
                )}
                {enabledSeries.has('cv') && (
                  <Line yAxisId="left" type="monotone" dataKey="cv" name="With CV" stroke="#8b5cf6" strokeWidth={2} dot={range <= 14 ? { r: 3, strokeWidth: 2, fill: '#fff' } : false} />
                )}
              </>
            )}

            {/* Time series + rates modes */}
            {viewMode !== 'stacked' && (
              <>
                {/* Bars */}
                {visibleSeries.filter(s => s.type === 'bar').map(s => (
                  <Bar
                    key={s.key}
                    yAxisId={rightAxisKeys.has(s.key) ? 'right' : 'left'}
                    dataKey={s.key}
                    name={s.label}
                    fill={s.color}
                    fillOpacity={0.2}
                    stroke={s.color}
                    strokeWidth={0}
                    radius={[3, 3, 0, 0]}
                    barSize={range <= 14 ? 20 : range <= 30 ? 12 : 6}
                  />
                ))}
                {/* Lines */}
                {visibleSeries.filter(s => s.type === 'line').map(s => (
                  <Line
                    key={s.key}
                    yAxisId={rightAxisKeys.has(s.key) ? 'right' : 'left'}
                    type="monotone"
                    dataKey={s.key}
                    name={s.label}
                    stroke={s.color}
                    strokeWidth={2}
                    strokeDasharray={s.dashArray}
                    dot={range <= 14 ? { r: 3, strokeWidth: 2, fill: '#fff' } : false}
                    activeDot={{ r: 5, strokeWidth: 2, fill: '#fff' }}
                  />
                ))}
              </>
            )}

            {/* Zero reference line for rates view */}
            {viewMode === 'rates' && (
              <ReferenceLine yAxisId="left" y={50} stroke="#e2e8f0" strokeDasharray="4 4" label={{ value: '50%', fill: '#94a3b8', fontSize: 10, position: 'left' }} />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
