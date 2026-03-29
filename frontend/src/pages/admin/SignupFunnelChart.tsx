import { useState, useEffect } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  BarChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { api } from '../../lib/api';
import type { FunnelStats } from '../../types/admin';

/* ─── Helpers ─────────────────────────────────────────────── */

function fmt(n: number) { return n.toLocaleString(); }
function pct(part: number, whole: number) { return whole > 0 ? Math.round((part / whole) * 100) : 0; }

function formatDate(day: string) {
  const d = new Date(day + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatWeek(week: string) {
  const d = new Date(week + 'T00:00:00');
  return `w/o ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
}

/* ─── Funnel Stage Colors ─────────────────────────────────── */

const FUNNEL_STAGES = [
  { key: 'total_signups',    label: 'Signed Up',        color: '#3b82f6' },
  { key: 'email_verified',   label: 'Email Verified',   color: '#22c55e' },
  { key: 'profile_started',  label: 'Profile Started',  color: '#06b6d4' },
  { key: 'has_skills',       label: 'Added Skills',     color: '#8b5cf6' },
  { key: 'has_bio',          label: 'Wrote Bio',        color: '#a855f7' },
  { key: 'cv_uploaded',      label: 'CV Uploaded',      color: '#6366f1' },
  { key: 'wallet_connected', label: 'Wallet Connected', color: '#f97316' },
  { key: 'photo_uploaded',   label: 'Photo Uploaded',   color: '#ec4899' },
  { key: 'has_service',      label: 'Listed Service',   color: '#14b8a6' },
  { key: 'profile_complete', label: 'Profile 80%+',     color: '#10b981' },
];

const ABANDONMENT_COLORS: Record<string, string> = {
  never_verified: '#ef4444',
  never_started_profile: '#f97316',
  profile_minimal: '#eab308',
  profile_partial: '#84cc16',
  no_wallet: '#06b6d4',
  good_profile_no_wallet: '#8b5cf6',
  completed: '#22c55e',
};

const ABANDONMENT_LABELS: Record<string, string> = {
  never_verified: 'Never Verified Email',
  never_started_profile: 'Never Started Profile',
  profile_minimal: 'Profile < 30%',
  profile_partial: 'Profile 30-59%',
  no_wallet: 'No Wallet (Profile < 80%)',
  good_profile_no_wallet: 'Good Profile, No Wallet',
  completed: 'Completed',
};

const METHOD_COLORS = {
  email: '#3b82f6',
  google: '#ef4444',
  linkedin: '#0077b5',
  whatsapp: '#25d366',
};

type Tab = 'funnel' | 'sources' | 'methods' | 'abandonment' | 'cohorts';

/* ─── Sub-Components ──────────────────────────────────────── */

function FunnelView({ funnel }: { funnel: Record<string, number> }) {
  const data = FUNNEL_STAGES
    .filter(s => funnel[s.key] !== undefined)
    .map(s => ({ ...s, value: funnel[s.key] || 0 }));

  const max = data[0]?.value || 1;

  return (
    <div className="space-y-2">
      {data.map((stage, i) => {
        const w = pct(stage.value, max);
        const dropoff = i > 0 ? pct(data[i - 1].value - stage.value, data[i - 1].value) : 0;
        return (
          <div key={stage.key}>
            <div className="flex items-center justify-between text-xs mb-0.5">
              <span className="text-gray-600 font-medium">{stage.label}</span>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-900">{fmt(stage.value)}</span>
                <span className="text-gray-400">({pct(stage.value, max)}%)</span>
                {dropoff > 0 && (
                  <span className="text-red-400 text-[10px]">{'\u2193'}{dropoff}% drop</span>
                )}
              </div>
            </div>
            <div className="h-6 bg-gray-100 rounded-md overflow-hidden">
              <div
                className="h-full rounded-md transition-all duration-700"
                style={{ width: `${Math.max(w, 2)}%`, backgroundColor: stage.color }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SourceQualityView({ sources }: { sources: FunnelStats['sourceQuality'] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-gray-100">
            <th className="text-left py-2 px-1 text-gray-500 font-medium">Source</th>
            <th className="text-right py-2 px-1 text-gray-500 font-medium">Signups</th>
            <th className="text-right py-2 px-1 text-gray-500 font-medium">Verified %</th>
            <th className="text-right py-2 px-1 text-gray-500 font-medium">CV %</th>
            <th className="text-right py-2 px-1 text-gray-500 font-medium">Wallet %</th>
            <th className="text-right py-2 px-1 text-gray-500 font-medium">Profile 60%+</th>
            <th className="text-right py-2 px-1 text-gray-500 font-medium">Avg Score</th>
          </tr>
        </thead>
        <tbody>
          {sources.map(s => {
            const vRate = pct(s.verified, s.signups);
            const cvRate = pct(s.with_cv, s.signups);
            const walletRate = pct(s.with_wallet, s.signups);
            const goodRate = pct(s.profile_good, s.signups);
            return (
              <tr key={s.source} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="py-1.5 px-1 font-medium text-gray-800">{s.source}</td>
                <td className="py-1.5 px-1 text-right text-gray-700">{fmt(s.signups)}</td>
                <td className="py-1.5 px-1 text-right">
                  <span className={vRate >= 70 ? 'text-green-600 font-medium' : vRate >= 40 ? 'text-yellow-600' : 'text-red-500'}>{vRate}%</span>
                </td>
                <td className="py-1.5 px-1 text-right">
                  <span className={cvRate >= 30 ? 'text-green-600 font-medium' : cvRate >= 15 ? 'text-yellow-600' : 'text-gray-400'}>{cvRate}%</span>
                </td>
                <td className="py-1.5 px-1 text-right">
                  <span className={walletRate >= 20 ? 'text-orange-600 font-medium' : 'text-gray-400'}>{walletRate}%</span>
                </td>
                <td className="py-1.5 px-1 text-right">
                  <span className={goodRate >= 30 ? 'text-green-600 font-medium' : 'text-gray-400'}>{goodRate}%</span>
                </td>
                <td className="py-1.5 px-1 text-right text-gray-700">{s.avg_completeness}%</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function MethodsView({ methodsByDay, range }: { methodsByDay: FunnelStats['signupMethodsByDay']; range: number }) {
  const data = methodsByDay.slice(-range);
  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="day" tickFormatter={formatDate} tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={{ stroke: '#e2e8f0' }}
            interval={range <= 14 ? 1 : 'preserveStartEnd'} />
          <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={35} />
          <Tooltip content={({ active, payload, label }: any) => {
            if (!active || !payload?.length) return null;
            const total = payload.reduce((s: number, p: any) => s + (p.value || 0), 0);
            return (
              <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-sm">
                <p className="font-semibold text-gray-700 mb-1.5">{formatDate(label)}</p>
                {payload.map((entry: any) => (
                  <div key={entry.dataKey} className="flex items-center gap-2 py-0.5">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: entry.color }} />
                    <span className="text-gray-600">{entry.name}:</span>
                    <span className="font-semibold text-gray-900 ml-auto pl-2">{entry.value} ({pct(entry.value, total)}%)</span>
                  </div>
                ))}
                <div className="border-t border-gray-100 mt-1 pt-1 text-xs text-gray-500">Total: {total}</div>
              </div>
            );
          }} />
          <Bar dataKey="email" name="Email" stackId="methods" fill={METHOD_COLORS.email} />
          <Bar dataKey="google" name="Google" stackId="methods" fill={METHOD_COLORS.google} />
          <Bar dataKey="linkedin" name="LinkedIn" stackId="methods" fill={METHOD_COLORS.linkedin} />
          <Bar dataKey="whatsapp" name="WhatsApp" stackId="methods" fill={METHOD_COLORS.whatsapp} radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function AbandonmentView({ abandonment }: { abandonment: FunnelStats['abandonment'] }) {
  const total = abandonment.reduce((s, a) => s + a.count, 0);
  const sorted = [...abandonment].sort((a, b) => b.count - a.count);

  return (
    <div className="space-y-3">
      {/* Bar visualization */}
      <div className="flex h-8 rounded-lg overflow-hidden bg-gray-100">
        {sorted.map(a => {
          const w = pct(a.count, total);
          return w > 0 ? (
            <div
              key={a.stage}
              className="transition-all duration-700 relative group"
              style={{ width: `${w}%`, backgroundColor: ABANDONMENT_COLORS[a.stage] || '#94a3b8' }}
              title={`${ABANDONMENT_LABELS[a.stage] || a.stage}: ${fmt(a.count)}`}
            />
          ) : null;
        })}
      </div>
      {/* Legend with details */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {sorted.filter(a => a.stage !== 'completed').map(a => (
          <div key={a.stage} className="flex items-center gap-2 p-2 rounded-lg bg-gray-50">
            <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: ABANDONMENT_COLORS[a.stage] || '#94a3b8' }} />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-gray-700 truncate">{ABANDONMENT_LABELS[a.stage] || a.stage}</p>
              <p className="text-[10px] text-gray-400">
                {fmt(a.count)} users ({pct(a.count, total)}%) · avg {a.avg_days_inactive}d inactive
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CohortView({ cohorts }: { cohorts: FunnelStats['cohortFunnel'] }) {
  return (
    <div className="space-y-4">
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={cohorts.slice().reverse()} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="week" tickFormatter={formatWeek} tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} />
            <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={35} />
            <Tooltip content={({ active, payload, label }: any) => {
              if (!active || !payload?.length) return null;
              return (
                <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-sm">
                  <p className="font-semibold text-gray-700 mb-1.5">{formatWeek(label)}</p>
                  {payload.map((entry: any) => (
                    <div key={entry.dataKey} className="flex items-center gap-2 py-0.5">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: entry.color }} />
                      <span className="text-gray-600">{entry.name}:</span>
                      <span className="font-semibold text-gray-900 ml-auto pl-2">{entry.value}</span>
                    </div>
                  ))}
                </div>
              );
            }} />
            <Bar dataKey="signups" name="Signups" fill="#3b82f6" fillOpacity={0.2} radius={[3, 3, 0, 0]} barSize={18} />
            <Line type="monotone" dataKey="verified" name="Verified" stroke="#22c55e" strokeWidth={2} dot={{ r: 3, fill: '#fff', strokeWidth: 2 }} />
            <Line type="monotone" dataKey="withCv" name="CV Uploaded" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 3, fill: '#fff', strokeWidth: 2 }} />
            <Line type="monotone" dataKey="withWallet" name="Wallet" stroke="#f97316" strokeWidth={2} dot={{ r: 3, fill: '#fff', strokeWidth: 2 }} />
            <Line type="monotone" dataKey="retained7d" name="Retained 7d" stroke="#06b6d4" strokeWidth={2} strokeDasharray="5 3" dot={{ r: 3, fill: '#fff', strokeWidth: 2 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      {/* Cohort table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left py-1.5 px-1 text-gray-500 font-medium">Week</th>
              <th className="text-right py-1.5 px-1 text-gray-500 font-medium">Size</th>
              <th className="text-right py-1.5 px-1 text-gray-500 font-medium">Verified %</th>
              <th className="text-right py-1.5 px-1 text-gray-500 font-medium">CV %</th>
              <th className="text-right py-1.5 px-1 text-gray-500 font-medium">Wallet %</th>
              <th className="text-right py-1.5 px-1 text-gray-500 font-medium">7d Retain %</th>
              <th className="text-right py-1.5 px-1 text-gray-500 font-medium">Avg Score</th>
            </tr>
          </thead>
          <tbody>
            {cohorts.map(c => (
              <tr key={c.week} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="py-1 px-1 font-medium text-gray-800">{formatWeek(c.week)}</td>
                <td className="py-1 px-1 text-right text-gray-700">{fmt(c.signups)}</td>
                <td className="py-1 px-1 text-right">{pct(c.verified, c.signups)}%</td>
                <td className="py-1 px-1 text-right">{pct(c.withCv, c.signups)}%</td>
                <td className="py-1 px-1 text-right">{pct(c.withWallet, c.signups)}%</td>
                <td className="py-1 px-1 text-right">{pct(c.retained7d, c.signups)}%</td>
                <td className="py-1 px-1 text-right text-gray-700">{c.avgCompleteness}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─── Main Component ──────────────────────────────────────── */

export default function SignupFunnelChart() {
  const [data, setData] = useState<FunnelStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<Tab>('funnel');
  const [methodRange, setMethodRange] = useState(30);

  useEffect(() => {
    api.getAdminFunnelStats()
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 animate-pulse">
      <div className="h-4 bg-gray-200 rounded w-40 mb-4" />
      <div className="space-y-3">
        {[...Array(6)].map((_, i) => <div key={i} className="h-6 bg-gray-100 rounded" />)}
      </div>
    </div>
  );
  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!data) return null;

  const TABS: { key: Tab; label: string }[] = [
    { key: 'funnel',      label: 'Onboarding Funnel' },
    { key: 'sources',     label: 'Source Quality' },
    { key: 'methods',     label: 'Signup Methods' },
    { key: 'abandonment', label: 'Abandonment' },
    { key: 'cohorts',     label: 'Weekly Cohorts' },
  ];

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-800">User Behavior & Funnel</h3>
          <p className="text-xs text-gray-400 mt-0.5">Where users come from, where they drop off, and how fast they onboard</p>
        </div>
        {/* Velocity KPIs */}
        <div className="flex items-center gap-4 text-center">
          {data.velocity.medianHoursToActive != null && (
            <div>
              <p className="text-sm font-bold text-blue-600">{data.velocity.medianHoursToActive}h</p>
              <p className="text-[9px] text-gray-400 uppercase">Med. to Active</p>
            </div>
          )}
          {data.velocity.medianHoursToCv != null && (
            <div>
              <p className="text-sm font-bold text-purple-600">{data.velocity.medianHoursToCv}h</p>
              <p className="text-[9px] text-gray-400 uppercase">Med. to CV</p>
            </div>
          )}
          <div>
            <p className="text-sm font-bold text-gray-700">{data.velocity.avgCompleteness7d}%</p>
            <p className="text-[9px] text-gray-400 uppercase">Avg Score (7d)</p>
          </div>
          <div>
            <p className="text-sm font-bold text-gray-500">{data.velocity.avgCompletenessAll}%</p>
            <p className="text-[9px] text-gray-400 uppercase">Avg Score (All)</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5 mb-5 overflow-x-auto">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all whitespace-nowrap ${
              tab === t.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === 'funnel' && <FunnelView funnel={data.funnel} />}

      {tab === 'sources' && <SourceQualityView sources={data.sourceQuality} />}

      {tab === 'methods' && (
        <div>
          <div className="flex items-center gap-4 mb-3">
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
              {[7, 14, 30, 60, 90].map(d => (
                <button
                  key={d}
                  onClick={() => setMethodRange(d)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                    methodRange === d ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {d}d
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3">
              {Object.entries(METHOD_COLORS).map(([method, color]) => (
                <div key={method} className="flex items-center gap-1 text-xs text-gray-500">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                  {method.charAt(0).toUpperCase() + method.slice(1)}
                </div>
              ))}
            </div>
          </div>
          <MethodsView methodsByDay={data.signupMethodsByDay} range={methodRange} />
        </div>
      )}

      {tab === 'abandonment' && <AbandonmentView abandonment={data.abandonment} />}

      {tab === 'cohorts' && <CohortView cohorts={data.cohortFunnel} />}
    </div>
  );
}
