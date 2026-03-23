import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import type { SolverStats } from '../../types/admin';

/* ─── Helpers ──────────────────────────────────────────────── */

function fmt(n: number) {
  return n.toLocaleString();
}

function ms(n: number) {
  if (n < 1000) return `${n}ms`;
  return `${(n / 1000).toFixed(1)}s`;
}

function usd(n: number) {
  return `$${n.toFixed(2)}`;
}

/* ─── Reusable Components ──────────────────────────────────── */

function StatCard({ label, value, sub, accent }: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${accent || 'text-gray-900'}`}>
        {typeof value === 'number' ? fmt(value) : value}
      </p>
      {sub && <p className="mt-1 text-sm text-gray-400">{sub}</p>}
    </div>
  );
}

function RingChart({ value, max, size = 80, stroke = 8, color = '#22c55e' }: {
  value: number; max: number; size?: number; stroke?: number; color?: string;
}) {
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

function MiniBar({ data }: { data: Record<string, number> }) {
  const entries = Object.entries(data).sort(([, a], [, b]) => b - a);
  const max = Math.max(...entries.map(([, v]) => v), 1);

  return (
    <div className="space-y-2">
      {entries.map(([date, count]) => (
        <div key={date} className="flex items-center gap-2 text-xs">
          <span className="text-gray-500 w-20 shrink-0">{date.slice(5)}</span>
          <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all duration-500"
              style={{ width: `${(count / max) * 100}%` }}
            />
          </div>
          <span className="text-gray-700 font-medium w-8 text-right">{count}</span>
        </div>
      ))}
    </div>
  );
}

/* ─── Main Page ────────────────────────────────────────────── */

export default function AdminSolver() {
  const [stats, setStats] = useState<SolverStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getSolverStats()
      .then(setStats)
      .catch((err) => setError(err.message ?? 'Failed to load solver stats'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-center py-20 text-gray-400">Loading solver stats...</div>;
  if (error) return <div className="text-center py-20 text-red-500">{error}</div>;
  if (!stats) return null;

  const { overview, config, costs, modelStats, topAgents, dailyVolume, recentRequests } = stats;

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-gray-900">Solver Dashboard</h1>

      {/* ─── Overview Cards ─── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Solves" value={overview.totalSolves} sub={`${overview.today} today`} />
        <StatCard label="Success Rate" value={`${overview.successRate}%`} accent="text-green-600" sub={`${fmt(overview.successfulSolves)} correct`} />
        <StatCard label="Avg Solve Time" value={ms(overview.avgSolveTimeMs)} sub="server-side" />
        <StatCard label="Rejected" value={overview.rejected} accent={overview.rejected > 0 ? 'text-red-500' : 'text-gray-900'} sub="invalid challenges" />
      </div>

      {/* ─── Volume Cards ─── */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Last 7 Days" value={overview.last7d} />
        <StatCard label="Last 30 Days" value={overview.last30d} />
        <StatCard label="Est. Cost (30d)" value={usd(costs.last30d)} sub={`${usd(costs.perSolve)}/solve`} accent="text-orange-600" />
      </div>

      {/* ─── Config + Accuracy Ring ─── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Configuration</h2>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Backend</span>
              <span className="font-mono text-gray-900">{config.backend}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Primary Model</span>
              <span className="font-mono text-gray-900">{config.primaryModel}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Tiebreaker Model</span>
              <span className="font-mono text-gray-900">{config.tiebreakerModel}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Daily Limit</span>
              <span className="font-mono text-gray-900">{config.dailyLimit}/agent</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Total Cost</span>
              <span className="font-mono text-orange-600 font-semibold">{usd(costs.total)}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Accuracy</h2>
          <div className="flex items-center gap-6">
            <div className="relative">
              <RingChart value={overview.successfulSolves} max={overview.totalSolves} size={100} stroke={10} />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-lg font-bold text-gray-900">{overview.successRate}%</span>
              </div>
            </div>
            <div className="space-y-2 text-sm flex-1">
              <div className="flex justify-between">
                <span className="text-green-600">Correct</span>
                <span className="font-semibold">{fmt(overview.successfulSolves)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-red-500">Failed</span>
                <span className="font-semibold">{fmt(overview.totalSolves - overview.successfulSolves)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Rejected</span>
                <span className="font-semibold">{fmt(overview.rejected)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Model Breakdown ─── */}
      {modelStats.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Model Performance (Telemetry)</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="pb-2 font-medium">Model</th>
                  <th className="pb-2 font-medium text-right">Solves</th>
                  <th className="pb-2 font-medium text-right">Correct</th>
                  <th className="pb-2 font-medium text-right">Accuracy</th>
                  <th className="pb-2 font-medium text-right">Avg Time</th>
                </tr>
              </thead>
              <tbody>
                {modelStats.map((m) => (
                  <tr key={m.model} className="border-b border-gray-50">
                    <td className="py-2 font-mono text-gray-900">{m.model}</td>
                    <td className="py-2 text-right">{fmt(m.total)}</td>
                    <td className="py-2 text-right text-green-600">{fmt(m.correct)}</td>
                    <td className="py-2 text-right font-semibold">{m.accuracy}%</td>
                    <td className="py-2 text-right text-gray-500">{ms(m.avgSolveTimeMs)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── Daily Volume + Top Agents ─── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Daily Volume (14d)</h2>
          {Object.keys(dailyVolume).length > 0 ? (
            <MiniBar data={dailyVolume} />
          ) : (
            <p className="text-sm text-gray-400">No data yet</p>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Top Agents (30d)</h2>
          {topAgents.length > 0 ? (
            <div className="space-y-2">
              {topAgents.map((a, i) => (
                <div key={a.agentId} className="flex items-center gap-3 text-sm">
                  <span className="text-gray-400 w-5 text-right">{i + 1}.</span>
                  <span className="flex-1 font-medium text-gray-900 truncate">{a.name}</span>
                  <span className="text-gray-600 font-mono">{fmt(a.solves)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400">No agents yet</p>
          )}
        </div>
      </div>

      {/* ─── Recent Requests ─── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Recent Requests</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="pb-2 font-medium">Time</th>
                <th className="pb-2 font-medium">Challenge</th>
                <th className="pb-2 font-medium text-right">Answer</th>
                <th className="pb-2 font-medium text-right">Time</th>
                <th className="pb-2 font-medium text-right">Status</th>
              </tr>
            </thead>
            <tbody>
              {recentRequests.map((r) => (
                <tr key={r.id} className="border-b border-gray-50">
                  <td className="py-2 text-gray-500 whitespace-nowrap">
                    {new Date(r.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="py-2 font-mono text-xs text-gray-600 max-w-xs truncate">{r.challenge}</td>
                  <td className="py-2 text-right font-mono font-semibold">{r.answer ?? '-'}</td>
                  <td className="py-2 text-right text-gray-500">{ms(r.solveTimeMs)}</td>
                  <td className="py-2 text-right">
                    {r.rejected ? (
                      <span className="text-xs px-2 py-0.5 bg-red-50 text-red-600 rounded-full">{r.rejectReason ?? 'rejected'}</span>
                    ) : r.answer ? (
                      <span className="text-xs px-2 py-0.5 bg-green-50 text-green-600 rounded-full">solved</span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 bg-yellow-50 text-yellow-600 rounded-full">failed</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
