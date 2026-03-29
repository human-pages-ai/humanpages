import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import type { AdminStats } from '../../types/admin';
import SignupAnalyticsChart from './SignupAnalyticsChart';
import SignupFunnelChart from './SignupFunnelChart';

/* ─── Helpers ──────────────────────────────────────────────── */

function fmt(n: number) {
  return n.toLocaleString();
}

function pct(part: number, whole: number) {
  if (whole === 0) return 0;
  return Math.round((part / whole) * 100);
}

/* ─── Reusable Components ──────────────────────────────────── */

function StatCard({
  label,
  value,
  sub,
  to,
  accent,
}: {
  label: string;
  value: string | number;
  sub?: string;
  to?: string;
  accent?: string;
}) {
  const content = (
    <>
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${accent || 'text-gray-900'}`}>
        {typeof value === 'number' ? fmt(value) : value}
      </p>
      {sub && <p className="mt-1 text-sm text-gray-400">{sub}</p>}
    </>
  );

  if (to) {
    return (
      <Link to={to} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md hover:border-blue-200 transition-all block">
        {content}
      </Link>
    );
  }
  return <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">{content}</div>;
}

function MiniStat({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const p = pct(value, total);
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex justify-between text-xs mb-1">
          <span className="text-gray-600 font-medium">{label}</span>
          <span className="text-gray-900 font-semibold">{fmt(value)} <span className="text-gray-400 font-normal">({p}%)</span></span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${p}%` }} />
        </div>
      </div>
    </div>
  );
}

function StatusBar({ data, colorMap, linkPrefix }: { data: Record<string, number>; colorMap: Record<string, string>; linkPrefix?: string }) {
  const total = Object.values(data).reduce((s, v) => s + v, 0);
  if (total === 0) return <p className="text-sm text-gray-400">No data</p>;

  return (
    <div>
      <div className="flex h-3 rounded-full overflow-hidden bg-gray-100">
        {Object.entries(data).map(([status, count]) => (
          <div
            key={status}
            className={`transition-all duration-500 ${colorMap[status] || 'bg-gray-300'}`}
            style={{ width: `${(count / total) * 100}%` }}
            title={`${status}: ${count}`}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-3 mt-2">
        {Object.entries(data).map(([status, count]) => (
          linkPrefix ? (
            <Link key={status} to={`${linkPrefix}?status=${status}`} className="text-xs text-gray-500 hover:text-blue-600">
              <span className={`inline-block w-2 h-2 rounded-full mr-1 ${colorMap[status] || 'bg-gray-300'}`} />
              {status}: {fmt(count)}
            </Link>
          ) : (
            <span key={status} className="text-xs text-gray-500">
              <span className={`inline-block w-2 h-2 rounded-full mr-1 ${colorMap[status] || 'bg-gray-300'}`} />
              {status}: {fmt(count)}
            </span>
          )
        ))}
      </div>
    </div>
  );
}

function RingChart({ value, max, size = 80, stroke = 8, color = '#f97316' }: { value: number; max: number; size?: number; stroke?: number; color?: string }) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const p = max > 0 ? Math.min(value / max, 1) : 0;
  const dashOffset = circumference * (1 - p);

  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#f3f4f6" strokeWidth={stroke} />
      <circle
        cx={size / 2} cy={size / 2} r={radius} fill="none"
        stroke={color} strokeWidth={stroke} strokeLinecap="round"
        strokeDasharray={circumference} strokeDashoffset={dashOffset}
        className="transition-all duration-1000"
      />
    </svg>
  );
}

function RankedList({ items, labelKey, valueKey, barColor = 'bg-orange-400' }: { items: Record<string, unknown>[]; labelKey: string; valueKey: string; barColor?: string }) {
  if (!items || items.length === 0) return <p className="text-sm text-gray-400">No data</p>;
  const maxVal = Math.max(...items.map(i => Number(i[valueKey]) || 0));

  return (
    <div className="space-y-2.5">
      {items.map((item, idx) => {
        const label = String(item[labelKey]);
        const value = Number(item[valueKey]);
        return (
          <div key={idx}>
            <div className="flex justify-between text-xs text-gray-600 mb-0.5">
              <span className="truncate mr-2 font-medium">{label}</span>
              <span className="font-semibold text-gray-900">{fmt(value)}</span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div className={`h-full ${barColor} rounded-full transition-all duration-700`} style={{ width: `${maxVal > 0 ? (value / maxVal) * 100 : 0}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Sparkline({ data, color = '#3b82f6', height = 32 }: { data: number[]; color?: string; height?: number }) {
  if (!data || data.length < 2) return null;
  const max = Math.max(...data, 1);
  const width = 120;
  const points = data.map((v, i) => `${(i / (data.length - 1)) * width},${height - (v / max) * (height - 4)}`).join(' ');
  return (
    <svg width={width} height={height} className="flex-shrink-0">
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SectionHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="pt-2">
      <h2 className="text-base font-semibold text-gray-800">{title}</h2>
      {description && <p className="text-xs text-gray-400 mt-0.5">{description}</p>}
    </div>
  );
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-white rounded-xl shadow-sm border border-gray-100 p-5 ${className}`}>{children}</div>;
}

function CardTitle({ children }: { children: React.ReactNode }) {
  return <p className="text-sm font-medium text-gray-500 mb-3">{children}</p>;
}

/* ─── Skeleton Loader ──────────────────────────────────────── */

function SkeletonCard() {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 animate-pulse">
      <div className="h-3 bg-gray-200 rounded w-24 mb-3" />
      <div className="h-6 bg-gray-200 rounded w-16 mb-2" />
      <div className="h-3 bg-gray-100 rounded w-32" />
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => <SkeletonCard key={i} />)}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 animate-pulse">
            <div className="h-3 bg-gray-200 rounded w-28 mb-4" />
            <div className="h-3 bg-gray-100 rounded-full w-full mb-3" />
            <div className="flex gap-4">
              <div className="h-2 bg-gray-100 rounded w-16" />
              <div className="h-2 bg-gray-100 rounded w-16" />
              <div className="h-2 bg-gray-100 rounded w-16" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Color Maps ───────────────────────────────────────────── */

const agentColors: Record<string, string> = {
  ACTIVE: 'bg-green-500',
  PENDING: 'bg-yellow-400',
  SUSPENDED: 'bg-blue-600',
  BANNED: 'bg-red-500',
};

const listingColors: Record<string, string> = {
  OPEN: 'bg-green-500',
  CLOSED: 'bg-blue-500',
  EXPIRED: 'bg-gray-400',
  CANCELLED: 'bg-red-400',
};

const jobColors: Record<string, string> = {
  COMPLETED: 'bg-green-500',
  PAID: 'bg-blue-500',
  ACCEPTED: 'bg-blue-400',
  PENDING: 'bg-yellow-400',
  REJECTED: 'bg-gray-400',
  CANCELLED: 'bg-gray-300',
  DISPUTED: 'bg-red-500',
};

const completenessColors: Record<string, string> = {
  '0-19': 'bg-red-400',
  '20-39': 'bg-orange-400',
  '40-59': 'bg-yellow-400',
  '60-79': 'bg-blue-400',
  '80-100': 'bg-green-500',
};

/* ─── Main Component ───────────────────────────────────────── */

export default function AdminOverview() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getAdminStats()
      .then(setStats)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSkeleton />;
  if (error) return <p className="text-red-600">{error}</p>;
  if (!stats) return null;

  const ins = stats.insights;
  const total = stats.users.total;

  return (
    <div className="space-y-6">

      {/* ── Core KPIs ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Users" value={total} sub={`${fmt(stats.users.verified)} verified (${pct(stats.users.verified, total)}%)`} to="/admin/users" />
        <StatCard label="Total Agents" value={stats.agents.total} sub={`${stats.agents.byStatus['ACTIVE'] || 0} active`} to="/admin/agents" />
        <StatCard label="Total Jobs" value={stats.jobs.total} sub={`${fmt(stats.jobs.last7d)} in last 7d`} to="/admin/jobs" />
        <StatCard
          label="Payment Volume"
          value={`$${stats.jobs.paymentVolume.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          sub={`${fmt(stats.jobs.paidJobCount ?? stats.jobs.byStatus['PAID'] ?? 0)} paid jobs`}
          to="/admin/jobs"
        />
      </div>

      {/* ── Usage & Activity ──────────────────────────────── */}
      {stats.usage && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="flex items-center justify-between">
            <div>
              <CardTitle>DAU</CardTitle>
              <p className="text-2xl font-bold text-gray-900">{fmt(stats.usage.dau)}</p>
              <p className="text-xs text-gray-400">Active today</p>
            </div>
            <Sparkline data={stats.usage.activeByDay.map(d => d.count)} color="#3b82f6" />
          </Card>
          <Card className="flex items-center justify-between">
            <div>
              <CardTitle>WAU</CardTitle>
              <p className="text-2xl font-bold text-gray-900">{fmt(stats.usage.wau)}</p>
              <p className="text-xs text-gray-400">DAU/WAU: {stats.usage.dauWauRatio}%</p>
            </div>
            <Sparkline data={stats.usage.signupsByDay.map(d => d.count)} color="#8b5cf6" />
          </Card>
          <Card>
            <CardTitle>MAU</CardTitle>
            <p className="text-2xl font-bold text-gray-900">{fmt(stats.usage.mau)}</p>
            <p className="text-xs text-gray-400">{pct(stats.usage.mau, total)}% of all users</p>
          </Card>
          <Card>
            <CardTitle>Retention</CardTitle>
            <p className="text-2xl font-bold text-orange-600">{stats.usage.retentionRate}%</p>
            <p className="text-xs text-gray-400">{fmt(stats.usage.returningUsers)} returning this week</p>
          </Card>
        </div>
      )}

      {/* ── Signup Analytics Chart ────────────────────────────── */}
      {stats.usage && (
        <SignupAnalyticsChart usage={stats.usage} />
      )}

      {/* ── User Behavior & Funnel ────────────────────────────── */}
      <SignupFunnelChart />

      {/* ── Growth & Reports ────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardTitle>Users (last 30d)</CardTitle>
          <p className="text-xl font-semibold text-gray-900">{fmt(stats.users.last30d)}</p>
          <p className="text-sm text-gray-400">{fmt(stats.users.last7d)} in last 7d</p>
        </Card>
        <Card>
          <CardTitle>Agent Reports</CardTitle>
          <p className="text-xl font-semibold text-gray-900">{fmt(stats.reports.total)}</p>
          <p className="text-sm text-gray-400">{stats.reports.pending} pending</p>
        </Card>
        <Card>
          <CardTitle>Human Reports</CardTitle>
          <p className="text-xl font-semibold text-gray-900">{fmt(stats.humanReports.total)}</p>
          <p className="text-sm text-gray-400">{stats.humanReports.pending} pending</p>
        </Card>
      </div>

      {/* ── Status Bars ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardTitle>Agent Status</CardTitle>
          <StatusBar data={stats.agents.byStatus} colorMap={agentColors} linkPrefix="/admin/agents" />
        </Card>
        <Card>
          <CardTitle>Job Status</CardTitle>
          <StatusBar data={stats.jobs.byStatus} colorMap={jobColors} linkPrefix="/admin/jobs" />
        </Card>
      </div>

      {/* ── Listings ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <StatCard label="Listings" value={stats.listings.total} sub={`${fmt(stats.listings.open)} open · ${fmt(stats.listings.applications)} applications`} to="/admin/listings" />
        <Card>
          <CardTitle>Listing Status</CardTitle>
          <StatusBar data={stats.listings.byStatus} colorMap={listingColors} linkPrefix="/admin/listings" />
        </Card>
      </div>

      {/* ── Affiliates & Feedback ───────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardTitle>Affiliates</CardTitle>
          <p className="text-lg font-semibold text-gray-900">
            {fmt(stats.affiliates.approved)} approved <span className="text-sm font-normal text-gray-400">/ {fmt(stats.affiliates.total)} total</span>
          </p>
        </Card>
        <Link to="/admin/feedback" className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md hover:border-blue-200 transition-all block">
          <CardTitle>Feedback</CardTitle>
          <p className="text-xl font-semibold text-gray-900">{fmt(stats.feedback.total)}</p>
          <p className="text-sm text-gray-400">{stats.feedback.new} new</p>
        </Link>
      </div>

      {/* ═══════════════════════════════════════════════════════
          PLATFORM INSIGHTS
          ═══════════════════════════════════════════════════════ */}
      {ins && (
        <>
          <div className="border-t border-gray-200 pt-2" />
          <SectionHeader title="Platform Insights" description="User engagement, profile quality, and acquisition metrics" />

          {/* ── Engagement KPIs with ring charts ─────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'CV Uploaded', value: ins.cvUploaded, color: '#3b82f6', desc: 'Uploaded a CV' },
              { label: 'Telegram Connected', value: ins.telegramConnected, color: '#8b5cf6', desc: 'Linked TG account' },
              { label: 'TG Bot Signups', value: ins.telegramBotSignups, color: '#06b6d4', desc: 'via telegram_bot UTM' },
              { label: 'Available Now', value: ins.profileCompleteness.available, color: '#22c55e', desc: 'Open for work' },
            ].map(({ label, value, color, desc }) => (
              <Card key={label} className="flex items-center gap-4">
                <div className="relative flex-shrink-0">
                  <RingChart value={value} max={total} color={color} />
                  <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-gray-800">
                    {pct(value, total)}%
                  </span>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-500">{label}</p>
                  <p className="text-xl font-semibold text-gray-900">{fmt(value)}</p>
                  <p className="text-xs text-gray-400 truncate">{desc}</p>
                </div>
              </Card>
            ))}
          </div>

          {/* ── Onboarding Funnel ────────────────────────────── */}
          <Card>
            <CardTitle>Onboarding Funnel</CardTitle>
            <p className="text-xs text-gray-400 -mt-2 mb-4">How many users completed each profile section (out of {fmt(total)} total)</p>
            <div className="space-y-2">
              {[
                { label: 'Email Verified', value: stats.users.verified, color: 'bg-green-500' },
                { label: 'Added Skills', value: ins.profileCompleteness.withSkills, color: 'bg-blue-500' },
                { label: 'Uploaded CV', value: ins.cvUploaded, color: 'bg-blue-400' },
                { label: 'Wrote Bio', value: ins.profileCompleteness.withBio, color: 'bg-indigo-500' },
                { label: 'Set Location', value: ins.profileCompleteness.withLocation, color: 'bg-cyan-500' },
                { label: 'Added Education', value: ins.profileCompleteness.withEducation, color: 'bg-violet-500' },
                { label: 'Listed a Service', value: ins.profileCompleteness.withService, color: 'bg-purple-500' },
                { label: 'Profile Photo', value: ins.profileCompleteness.withPhoto, color: 'bg-orange-500' },
                { label: 'Connected Telegram', value: ins.telegramConnected, color: 'bg-pink-500' },
              ].map(item => (
                <MiniStat key={item.label} label={item.label} value={item.value} total={total} color={item.color} />
              ))}
            </div>
          </Card>

          {/* ── Profile Completeness + Education ─────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card>
              <div className="flex items-center justify-between mb-3">
                <CardTitle>Profile Completeness</CardTitle>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">
                  Avg {ins.profileCompleteness.avgScore}%
                </span>
              </div>
              <div className="flex h-5 rounded-full overflow-hidden bg-gray-100 mb-3">
                {Object.entries(ins.profileCompleteness.distribution).map(([bucket, count]) => {
                  const w = pct(count, total);
                  return w > 0 ? (
                    <div
                      key={bucket}
                      className={`${completenessColors[bucket] || 'bg-gray-300'} transition-all duration-700 relative group`}
                      style={{ width: `${w}%` }}
                    >
                      <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-white opacity-0 group-hover:opacity-100 transition-opacity">
                        {w}%
                      </span>
                    </div>
                  ) : null;
                })}
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                {Object.entries(ins.profileCompleteness.distribution).map(([bucket, count]) => (
                  <span key={bucket} className="text-xs text-gray-500">
                    <span className={`inline-block w-2 h-2 rounded-full mr-1 ${completenessColors[bucket] || 'bg-gray-300'}`} />
                    {bucket}%: {fmt(count)}
                  </span>
                ))}
              </div>
            </Card>

            <Card>
              <CardTitle>Education Level</CardTitle>
              <p className="text-xs text-gray-400 -mt-2 mb-3">Unique users by highest degree</p>
              {(() => {
                const edu = ins.education;
                const eduTotal = edu.doctorate + edu.masters + edu.bachelors + edu.other;
                const eduData = [
                  { label: 'Doctorate', value: edu.doctorate, color: 'bg-purple-500', hex: '#a855f7' },
                  { label: "Master's", value: edu.masters, color: 'bg-blue-500', hex: '#3b82f6' },
                  { label: "Bachelor's", value: edu.bachelors, color: 'bg-cyan-500', hex: '#06b6d4' },
                  { label: 'Other', value: edu.other, color: 'bg-gray-400', hex: '#9ca3af' },
                ];
                return (
                  <>
                    <div className="flex h-5 rounded-full overflow-hidden bg-gray-100 mb-3">
                      {eduData.map(d => {
                        const w = pct(d.value, eduTotal);
                        return w > 0 ? (
                          <div key={d.label} className={`${d.color} transition-all duration-700`} style={{ width: `${w}%` }} title={`${d.label}: ${d.value}`} />
                        ) : null;
                      })}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {eduData.map(d => (
                        <div key={d.label} className="flex items-center gap-2">
                          <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${d.color}`} />
                          <span className="text-xs text-gray-600">{d.label}</span>
                          <span className="text-xs font-semibold text-gray-900 ml-auto">{fmt(d.value)}</span>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-gray-400 mt-2">{fmt(eduTotal)} users with education data</p>
                  </>
                );
              })()}
            </Card>
          </div>

          {/* ── Verification + Work Mode ──────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card>
              <CardTitle>Verification Methods</CardTitle>
              {(() => {
                const v = ins.verification;
                const methods = [
                  { label: 'Google', value: v.google, color: 'bg-red-400' },
                  { label: 'LinkedIn', value: v.linkedin, color: 'bg-blue-600' },
                  { label: 'GitHub', value: v.github, color: 'bg-gray-700' },
                ];
                return (
                  <div className="space-y-2">
                    {methods.map(m => (
                      <MiniStat key={m.label} label={m.label} value={m.value} total={total} color={m.color} />
                    ))}
                  </div>
                );
              })()}
            </Card>

            <Card>
              <CardTitle>Work Mode</CardTitle>
              {(() => {
                const wm = ins.workMode;
                const wmTotal = Object.values(wm).reduce((s, v) => s + v, 0);
                const modes = [
                  { label: 'Remote', key: 'REMOTE', color: 'bg-blue-500', emoji: '🌐' },
                  { label: 'Onsite', key: 'ONSITE', color: 'bg-orange-500', emoji: '🏢' },
                  { label: 'Hybrid', key: 'HYBRID', color: 'bg-purple-500', emoji: '🔄' },
                ];
                return (
                  <>
                    <div className="flex h-5 rounded-full overflow-hidden bg-gray-100 mb-3">
                      {modes.map(m => {
                        const w = pct(wm[m.key] || 0, wmTotal);
                        return w > 0 ? (
                          <div key={m.key} className={`${m.color} transition-all duration-700`} style={{ width: `${w}%` }} title={`${m.label}: ${wm[m.key]}`} />
                        ) : null;
                      })}
                    </div>
                    <div className="flex gap-4">
                      {modes.map(m => (
                        <div key={m.key} className="text-center flex-1">
                          <p className="text-lg font-semibold text-gray-900">{fmt(wm[m.key] || 0)}</p>
                          <p className="text-xs text-gray-500">{m.emoji} {m.label}</p>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-gray-400 mt-2">{fmt(wmTotal)} users set a work mode ({pct(wmTotal, total)}%)</p>
                  </>
                );
              })()}
            </Card>
          </div>

          {/* ── Acquisition + Discovery ───────────────────────── */}
          <SectionHeader title="Acquisition & Discovery" description="Where users come from, what they do, and where they are" />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card>
              <CardTitle>Signup Sources (UTM)</CardTitle>
              <RankedList
                items={Object.entries(ins.utmSources).map(([source, count]) => ({ source, count }))}
                labelKey="source"
                valueKey="count"
                barColor="bg-blue-400"
              />
            </Card>

            <Card>
              <CardTitle>Top Skills</CardTitle>
              <RankedList items={ins.topSkills} labelKey="skill" valueKey="count" barColor="bg-orange-400" />
            </Card>

            <Card>
              <CardTitle>Top Countries</CardTitle>
              <RankedList items={ins.topCountries} labelKey="country" valueKey="count" barColor="bg-green-400" />
            </Card>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card>
              <CardTitle>Continent Breakdown</CardTitle>
              {ins.continentBreakdown && (
                <RankedList items={ins.continentBreakdown} labelKey="continent" valueKey="count" barColor="bg-teal-400" />
              )}
            </Card>
          </div>

          {ins.crypto && (
            <>
              <div className="border-t border-gray-200 pt-2" />
              <SectionHeader title="Crypto Wallets" description="Wallet connection and Privy adoption metrics" />

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: 'Users with Wallet', value: ins.crypto.usersWithWallet, color: '#f97316', desc: 'Connected any wallet' },
                  { label: 'Privy Embedded', value: ins.crypto.privyWallets, color: '#8b5cf6', desc: 'Created via Privy' },
                  { label: 'External Wallets', value: ins.crypto.externalWallets, color: '#3b82f6', desc: 'Connected externally' },
                  { label: 'Verified Wallets', value: ins.crypto.walletsVerified, color: '#22c55e', desc: 'Ownership proven' },
                ].map(({ label, value, color, desc }) => (
                  <Card key={label} className="flex items-center gap-4">
                    <div className="relative flex-shrink-0">
                      <RingChart value={value} max={total} color={color} />
                      <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-gray-800">
                        {pct(value, total)}%
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-500">{label}</p>
                      <p className="text-xl font-semibold text-gray-900">{fmt(value)}</p>
                      <p className="text-xs text-gray-400 truncate">{desc}</p>
                    </div>
                  </Card>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Card>
                  <CardTitle>Wallets by Network</CardTitle>
                  <RankedList
                    items={Object.entries(ins.crypto.walletsByNetwork).map(([network, count]) => ({ network, count }))}
                    labelKey="network"
                    valueKey="count"
                    barColor="bg-purple-400"
                  />
                </Card>
                <Card>
                  <CardTitle>Adoption Summary</CardTitle>
                  <div className="space-y-4">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Wallet Adoption Rate</p>
                      <p className="text-2xl font-bold text-orange-600">{ins.crypto.adoptionRate}%</p>
                      <p className="text-xs text-gray-400">{fmt(ins.crypto.usersWithWallet)} of {fmt(total)} users</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Privy Connected</p>
                      <p className="text-2xl font-bold text-purple-600">{ins.crypto.privyRate}%</p>
                      <p className="text-xs text-gray-400">{fmt(ins.crypto.usersWithPrivyDid)} users with Privy DID</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Total Wallets</p>
                      <p className="text-2xl font-bold text-gray-800">{fmt(ins.crypto.walletsTotal)}</p>
                    </div>
                  </div>
                </Card>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
