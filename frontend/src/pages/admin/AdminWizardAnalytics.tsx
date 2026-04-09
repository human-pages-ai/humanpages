import { useState, useEffect, useMemo } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  BarChart,
  PieChart,
  Pie,
  Cell,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { api } from '../../lib/api';
import type { WizardAnalyticsResponse } from '../../types/admin';

/* ─── Constants ──────────────────────────────────────────── */

const RANGE_OPTIONS = [
  { label: '7d', value: '7d' },
  { label: '14d', value: '14d' },
  { label: '30d', value: '30d' },
  { label: '60d', value: '60d' },
  { label: '90d', value: '90d' },
] as const;

const STEP_ORDER = ['connect', 'cv', 'skills', 'services', 'payment', 'about'];

const DEVICE_COLORS = {
  mobile: '#3b82f6',
  desktop: '#22c55e',
  inAppBrowser: '#f97316',
};

/* ─── Stat Card Component ──────────────────────────────── */

function StatCard({ label, value, color = 'text-gray-900' }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">{label}</p>
      <p className={`text-2xl font-bold mt-2 ${color}`}>{typeof value === 'number' ? value.toLocaleString() : value}</p>
    </div>
  );
}

/* ─── Chart Section Component ──────────────────────────── */

function ChartSection({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 sm:p-6">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        {description && <p className="text-xs text-gray-500 mt-1">{description}</p>}
      </div>
      {children}
    </div>
  );
}

/* ─── Tooltip Components ──────────────────────────────── */

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-2 text-xs">
      <p className="font-semibold text-gray-700 mb-1">{label}</p>
      {payload.map((entry: any) => (
        <div key={entry.dataKey} className="text-gray-600">
          <span style={{ color: entry.color }}>●</span> {entry.name}: {entry.value?.toLocaleString() ?? 0}
        </div>
      ))}
    </div>
  );
}

/* ─── Main Component ──────────────────────────────────── */

export default function AdminWizardAnalytics() {
  const [range, setRange] = useState<'7d' | '14d' | '30d' | '60d' | '90d'>('30d');
  const [data, setData] = useState<WizardAnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    api
      .getWizardAnalytics(range, 'onboarding')
      .then((res) => setData(res))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [range]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent"></div>
          <p className="text-sm text-gray-500 mt-2">Loading wizard analytics...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-sm text-red-700">Error loading analytics: {error}</p>
      </div>
    );
  }

  if (!data || !data.configured) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <p className="text-sm text-yellow-700 font-medium">Wizard analytics not configured</p>
        <p className="text-xs text-yellow-600 mt-1">{data?.message || 'Set up wizard tracking on the backend to see analytics.'}</p>
      </div>
    );
  }

  /* ─── Compute derived metrics ─────────────────────── */

  const stats = useMemo(() => {
    const started = data.completionRate.started;
    const completed = data.completionRate.completed;
    const abandoned = data.completionRate.abandoned;
    const completionRate = started > 0 ? Math.round((completed / started) * 100) : 0;
    const abandonmentRate = started > 0 ? Math.round((abandoned / started) * 100) : 0;

    // Average steps completed per started wizard
    const funnelSteps = data.funnel.length;
    const avgStepsCompleted = started > 0 ? (funnelSteps).toFixed(1) : '0';

    return {
      started,
      completed,
      abandoned,
      completionRate,
      abandonmentRate,
      avgStepsCompleted,
    };
  }, [data]);

  /* ─── Order funnel steps ─────────────────────────── */

  const orderedFunnel = useMemo(() => {
    return data.funnel.slice().sort((a, b) => {
      const aIdx = STEP_ORDER.indexOf(a.step);
      const bIdx = STEP_ORDER.indexOf(b.step);
      return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx);
    });
  }, [data.funnel]);

  /* ─── Funnel with percentages ──────────────────── */

  const funnelData = useMemo(() => {
    const total = stats.started || 1;
    return orderedFunnel.map((item, idx) => ({
      step: item.step,
      runs: item.unique_runs,
      pct: Math.round((item.unique_runs / total) * 100),
      fill: `hsl(${120 + idx * 8}, 70%, 50%)`, // Blue to green gradient
    }));
  }, [orderedFunnel, stats.started]);

  /* ─── Step timing color coding ────────────────── */

  const stepTimingData = useMemo(() => {
    return data.stepTiming.map((item) => {
      const seconds = item.avg_duration;
      let color = '#22c55e'; // green < 30s
      if (seconds > 60) color = '#ef4444'; // red > 60s
      else if (seconds > 30) color = '#eab308'; // yellow 30-60s

      return {
        ...item,
        step: item.step,
        duration: Math.round(seconds),
        color,
      };
    });
  }, [data.stepTiming]);

  /* ─── Device breakdown data ──────────────────── */

  const deviceData = useMemo(() => {
    const { mobile, desktop, inAppBrowser } = data.deviceBreakdown;
    const total = mobile + desktop + inAppBrowser || 1;
    return [
      { name: 'Mobile', value: mobile, pct: Math.round((mobile / total) * 100) },
      { name: 'Desktop', value: desktop, pct: Math.round((desktop / total) * 100) },
      { name: 'In-App Browser', value: inAppBrowser, pct: Math.round((inAppBrowser / total) * 100) },
    ];
  }, [data.deviceBreakdown]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Wizard Behavior Analytics</h1>
          <p className="text-sm text-gray-500 mt-1">Onboarding wizard performance and user interaction metrics</p>
        </div>
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1 w-fit">
          {RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setRange(opt.value)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                range === opt.value ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Top Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Starts" value={stats.started} color="text-blue-600" />
        <StatCard label="Completion Rate" value={`${stats.completionRate}%`} color="text-green-600" />
        <StatCard label="Avg Steps Completed" value={stats.avgStepsCompleted} color="text-purple-600" />
        <StatCard label="Abandonment Rate" value={`${stats.abandonmentRate}%`} color="text-red-600" />
      </div>

      {/* Funnel Chart */}
      <ChartSection title="Wizard Funnel" description="Unique users reaching each step">
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={funnelData} layout="vertical" margin={{ top: 5, right: 30, left: 80, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis dataKey="step" type="category" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} width={80} />
              <Tooltip
                contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '0.5rem' }}
                formatter={(value: any) => {
                  if (typeof value === 'number') return value.toLocaleString();
                  return value;
                }}
              />
              <Bar dataKey="runs" fill="#3b82f6" radius={[0, 8, 8, 0]}>
                {funnelData.map((entry, idx) => (
                  <Cell key={`cell-${idx}`} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartSection>

      {/* Two-column layout for Charts 2 & 3 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Step Duration */}
        <ChartSection title="Step Duration" description="Avg time (sec) per step — indicates friction points">
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stepTimingData} margin={{ top: 5, right: 20, left: 0, bottom: 35 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis
                  dataKey="step"
                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                  angle={-45}
                  textAnchor="end"
                  height={60}
                />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} label={{ value: 'Seconds', angle: -90, position: 'insideLeft' }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '0.5rem' }}
                  formatter={(value: any) => typeof value === 'number' ? `${value}s` : value}
                />
                <Bar dataKey="duration" radius={[8, 8, 0, 0]}>
                  {stepTimingData.map((entry, idx) => (
                    <Cell key={`cell-${idx}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartSection>

        {/* Daily Activity */}
        <ChartSection title="Daily Activity" description="Sessions and event trends over time">
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data.dailyActivity} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                  interval={Math.max(0, Math.floor(data.dailyActivity.length / 7))}
                />
                <YAxis yAxisId="left" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} label={{ value: 'Events', angle: -90, position: 'insideLeft' }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} label={{ value: 'Sessions', angle: 90, position: 'insideRight' }} />
                <Tooltip content={<CustomTooltip />} cursor={false} />
                <Legend wrapperStyle={{ paddingTop: '1rem' }} />
                <Bar yAxisId="left" dataKey="events" fill="#3b82f6" name="Events" fillOpacity={0.6} radius={[4, 4, 0, 0]} />
                <Line yAxisId="right" type="monotone" dataKey="sessions" stroke="#22c55e" strokeWidth={2} name="Sessions" dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </ChartSection>
      </div>

      {/* Button Clicks */}
      <ChartSection title="Button Click Heatmap" description="Most interacted-with buttons (top 10)">
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.buttonClicks.slice(0, 10)} layout="vertical" margin={{ top: 5, right: 30, left: 120, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis dataKey="button" type="category" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} width={120} />
              <Tooltip
                contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '0.5rem' }}
                formatter={(value: any) => typeof value === 'number' ? value.toLocaleString() : value}
              />
              <Bar dataKey="clicks" fill="#f97316" radius={[0, 8, 8, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartSection>

      {/* Field Engagement */}
      <ChartSection title="Field Engagement" description="Focus, blur, and error counts per field">
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.fieldEngagement} margin={{ top: 5, right: 20, left: 0, bottom: 35 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis
                dataKey="field"
                tick={{ fontSize: 10, fill: '#94a3b8' }}
                axisLine={false}
                tickLine={false}
                angle={-45}
                textAnchor="end"
                height={60}
              />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ paddingTop: '1rem' }} />
              <Bar dataKey="focus" fill="#3b82f6" name="Focus" stackId="engagement" />
              <Bar dataKey="blur" fill="#22c55e" name="Blur" stackId="engagement" />
              <Bar dataKey="errors" fill="#ef4444" name="Errors" stackId="engagement" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartSection>

      {/* Form Lifecycle */}
      <ChartSection title="Form Lifecycle" description="Form open, completion, and abandonment rates">
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.formLifecycle} margin={{ top: 5, right: 20, left: 0, bottom: 35 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis
                dataKey="form"
                tick={{ fontSize: 10, fill: '#94a3b8' }}
                axisLine={false}
                tickLine={false}
                angle={-45}
                textAnchor="end"
                height={60}
              />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ paddingTop: '1rem' }} />
              <Bar dataKey="opened" fill="#3b82f6" name="Opened" stackId="lifecycle" />
              <Bar dataKey="completed" fill="#22c55e" name="Completed" stackId="lifecycle" />
              <Bar dataKey="abandoned" fill="#ef4444" name="Abandoned" stackId="lifecycle" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartSection>

      {/* Device Breakdown Pie */}
      <ChartSection title="Device Breakdown" description="User device distribution">
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart margin={{ top: 5, right: 30, left: 30, bottom: 5 }}>
              <Pie
                data={deviceData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={(entry: any) => `${entry.name} (${entry.pct}%)`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                <Cell fill={DEVICE_COLORS.mobile} />
                <Cell fill={DEVICE_COLORS.desktop} />
                <Cell fill={DEVICE_COLORS.inAppBrowser} />
              </Pie>
              <Tooltip
                contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '0.5rem' }}
                formatter={(value: any) => typeof value === 'number' ? value.toLocaleString() : value}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </ChartSection>

      {/* Abandonment by Step */}
      <ChartSection title="Abandonment by Step" description="Where users drop off in the wizard">
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data.abandonment.slice().sort((a, b) => b.count - a.count)}
              margin={{ top: 5, right: 20, left: 0, bottom: 35 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis
                dataKey="step"
                tick={{ fontSize: 10, fill: '#94a3b8' }}
                axisLine={false}
                tickLine={false}
                angle={-45}
                textAnchor="end"
                height={60}
              />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '0.5rem' }}
                formatter={(value: any) => typeof value === 'number' ? value.toLocaleString() : value}
              />
              <Bar dataKey="count" fill="#ef4444" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartSection>
    </div>
  );
}
