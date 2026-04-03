import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import type { McpFunnelAnalyticsResponse } from '../../types/admin';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, FunnelChart, Funnel, LabelList,
} from 'recharts';

const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

function StatCard({ label, value, unit = '', color = 'text-gray-900' }: { label: string; value: number | string; unit?: string; color?: string }) {
  return (
    <div className="bg-white rounded-lg shadow p-4 border-l-4 border-blue-500">
      <p className="text-sm text-gray-600">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>
        {typeof value === 'number' ? value.toLocaleString() : value}
        {unit && <span className="text-sm ml-1">{unit}</span>}
      </p>
    </div>
  );
}

function pct(num: number, denom: number): string {
  if (!denom) return '0%';
  return `${((num / denom) * 100).toFixed(1)}%`;
}

function msToHuman(ms: number): string {
  if (!ms || ms <= 0) return '—';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3600000) return `${(ms / 60000).toFixed(1)}min`;
  return `${(ms / 3600000).toFixed(1)}h`;
}

export default function AdminMcpFunnel() {
  const [data, setData] = useState<McpFunnelAnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [range, setRange] = useState(30);

  useEffect(() => {
    setLoading(true);
    api.getAdminMcpFunnel(range)
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [range]);

  if (loading) return <div className="p-8 text-gray-500">Loading MCP funnel analytics...</div>;
  if (error) return <div className="p-8 text-red-600">Error: {error}</div>;
  if (!data) return <div className="p-8 text-gray-500">No data</div>;

  const f = data.overallFunnel;
  const u = data.uniqueAgentFunnel;
  const s2h = data.searchToHire;

  // Chart 1: Overall funnel data
  const funnelData = [
    { name: 'Registered', value: f.registered },
    { name: 'Auth Completed', value: f.auth_completed },
    { name: 'Sessions', value: f.sessions_started },
    { name: 'Searched', value: f.searches },
    { name: 'Viewed Profiles', value: f.profile_views },
    { name: 'Created Jobs', value: f.jobs_created },
  ].filter(d => d.value > 0);

  // Chart 2: Unique agent funnel
  const agentFunnelData = [
    { name: 'Sessions', value: u.unique_sessions, fill: '#2563eb' },
    { name: 'Searched', value: u.unique_searchers, fill: '#10b981' },
    { name: 'Viewed Profiles', value: u.unique_viewers, fill: '#f59e0b' },
    { name: 'Hired', value: u.unique_hirers, fill: '#ef4444' },
    { name: 'Accepted by Human', value: u.unique_accepted, fill: '#8b5cf6' },
    { name: 'Completed', value: u.unique_completed, fill: '#ec4899' },
  ];

  // Chart 7: Session dropoff
  const stageOrder = ['idle', 'used_tools', 'searched', 'viewed_profiles', 'hired'];
  const sortedDropoff = [...data.sessionDropoff].sort(
    (a, b) => stageOrder.indexOf(a.stage) - stageOrder.indexOf(b.stage)
  );

  return (
    <div className="space-y-8 p-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">MCP Operator Funnel Analytics</h1>
        <div className="flex gap-2">
          {[7, 30, 60, 90].map(r => (
            <button key={r} onClick={() => setRange(r)}
              className={`px-3 py-1 text-sm rounded ${range === r ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-800 hover:bg-gray-300'}`}>
              {r}d
            </button>
          ))}
        </div>
      </div>

      {/* Top-line KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <StatCard label="Registrations" value={f.registered} />
        <StatCard label="Sessions" value={f.sessions_started} />
        <StatCard label="Searches" value={f.searches} />
        <StatCard label="Profile Views" value={f.profile_views} />
        <StatCard label="Jobs Created" value={f.jobs_created} color="text-green-600" />
        <StatCard label="Search→Hire" value={pct(f.jobs_created, f.searches)} color="text-blue-600" />
      </div>

      {/* Search-to-Hire Insights */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard label="Avg Searches Before Hire" value={s2h.avg_searches_before_hire?.toFixed(1) || '—'} />
        <StatCard label="Avg Profiles Before Hire" value={s2h.avg_profiles_before_hire?.toFixed(1) || '—'} />
        <StatCard label="Avg Time to Hire" value={msToHuman(s2h.avg_time_to_hire_ms)} />
        <StatCard label="Hired After Viewing" value={s2h.hired_after_viewing} />
        <StatCard label="First-Time Hirers" value={s2h.first_time_hirers} />
      </div>

      {/* Chart 1: Overall Funnel */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-2">Operator Journey Funnel</h2>
        <p className="text-sm text-gray-600 mb-4">Total events at each stage of the MCP operator lifecycle</p>
        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={funnelData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="value" fill="#2563eb">
              {funnelData.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 2: Unique Agent Funnel */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-2">Unique Agent Conversion Funnel</h2>
        <p className="text-sm text-gray-600 mb-4">Distinct agents reaching each stage — the true conversion funnel</p>
        <div className="flex items-center gap-8">
          <ResponsiveContainer width="60%" height={300}>
            <FunnelChart>
              <Tooltip />
              <Funnel dataKey="value" data={agentFunnelData} isAnimationActive>
                <LabelList position="right" fill="#374151" stroke="none" dataKey="name" />
                <LabelList position="center" fill="#fff" stroke="none" dataKey="value" />
              </Funnel>
            </FunnelChart>
          </ResponsiveContainer>
          <div className="space-y-2 text-sm">
            <p>Session → Search: <strong>{pct(u.unique_searchers, u.unique_sessions)}</strong></p>
            <p>Search → View: <strong>{pct(u.unique_viewers, u.unique_searchers)}</strong></p>
            <p>View → Hire: <strong>{pct(u.unique_hirers, u.unique_viewers)}</strong></p>
            <p>Hire → Accepted: <strong>{pct(u.unique_accepted, u.unique_hirers)}</strong></p>
            <p>Accepted → Completed: <strong>{pct(u.unique_completed, u.unique_accepted)}</strong></p>
            <p className="pt-2 font-bold">End-to-End: <span className="text-blue-600">{pct(u.unique_completed, u.unique_sessions)}</span></p>
          </div>
        </div>
      </div>

      {/* Chart 3: Platform Distribution */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-2">Agent Platform Distribution</h2>
        <p className="text-sm text-gray-600 mb-4">Which AI platforms are connecting via MCP</p>
        <div className="flex items-center gap-8">
          <ResponsiveContainer width="50%" height={300}>
            <PieChart>
              <Pie data={data.platformDistribution} dataKey="count" nameKey="platform" cx="50%" cy="50%" outerRadius={100} label={({ name, value }: any) => `${name} (${value})`}>
                {data.platformDistribution.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-1 text-sm">
            {data.platformDistribution.map((p, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                <span className="font-medium">{p.platform}</span>: {p.count} ({pct(p.count, data.platformDistribution.reduce((s, x) => s + x.count, 0))})
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Chart 4: Tool Usage */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-2">Tool Usage Breakdown</h2>
        <p className="text-sm text-gray-600 mb-4">Which MCP tools operators use most, with avg latency</p>
        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={data.toolUsage} layout="vertical" margin={{ left: 140 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" />
            <YAxis dataKey="tool" type="category" width={130} />
            <Tooltip formatter={(val: any, name: any) => name === 'avg_latency_ms' ? `${Number(val).toFixed(0)}ms` : val} />
            <Legend />
            <Bar dataKey="calls" fill="#2563eb" name="Total Calls" />
            <Bar dataKey="unique_agents" fill="#10b981" name="Unique Agents" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 5: Tool Error Rates */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-2">Tool Error Rates</h2>
        <p className="text-sm text-gray-600 mb-4">Error frequency by tool — indicates playbook clarity issues</p>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data.toolErrors.filter(t => t.errors > 0)}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="tool" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="calls" fill="#2563eb" name="Calls" />
            <Bar dataKey="errors" fill="#ef4444" name="Errors" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 6: Daily Activity */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-2">Daily MCP Activity</h2>
        <p className="text-sm text-gray-600 mb-4">Trends across sessions, searches, profile views, and hires</p>
        <ResponsiveContainer width="100%" height={350}>
          <LineChart data={data.dailyActivity}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="day" tickFormatter={(d) => new Date(d).toLocaleDateString('en', { month: 'short', day: 'numeric' })} />
            <YAxis />
            <Tooltip labelFormatter={(d) => new Date(d).toLocaleDateString()} />
            <Legend />
            <Line type="monotone" dataKey="sessions" stroke="#2563eb" strokeWidth={2} name="Sessions" />
            <Line type="monotone" dataKey="searches" stroke="#10b981" strokeWidth={2} name="Searches" />
            <Line type="monotone" dataKey="views" stroke="#f59e0b" strokeWidth={2} name="Profile Views" />
            <Line type="monotone" dataKey="hires" stroke="#ef4444" strokeWidth={2} name="Hires" />
            <Line type="monotone" dataKey="tool_calls" stroke="#8b5cf6" strokeWidth={1} strokeDasharray="5 5" name="Tool Calls" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 7: Session Dropoff */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-2">Session Exit Stages</h2>
        <p className="text-sm text-gray-600 mb-4">Where agents drop off — classified by furthest funnel stage reached</p>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={sortedDropoff}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="stage" />
            <YAxis />
            <Tooltip formatter={(val: any, name: any) => {
              if (name === 'avg_duration_ms') return msToHuman(Number(val));
              return typeof val === 'number' ? val.toFixed(1) : val;
            }} />
            <Legend />
            <Bar dataKey="count" fill="#ef4444" name="Sessions Ended" />
          </BarChart>
        </ResponsiveContainer>
        <div className="mt-4 overflow-x-auto">
          <table className="text-sm w-full">
            <thead>
              <tr className="text-left text-gray-600 border-b">
                <th className="p-2">Stage</th><th className="p-2">Count</th><th className="p-2">Avg Duration</th>
                <th className="p-2">Avg Tool Calls</th><th className="p-2">Avg Searches</th><th className="p-2">Avg Profiles</th>
              </tr>
            </thead>
            <tbody>
              {sortedDropoff.map((s, i) => (
                <tr key={i} className="border-b">
                  <td className="p-2 font-medium">{s.stage}</td>
                  <td className="p-2">{s.count}</td>
                  <td className="p-2">{msToHuman(s.avg_duration_ms)}</td>
                  <td className="p-2">{s.avg_tool_calls?.toFixed(1)}</td>
                  <td className="p-2">{s.avg_searches?.toFixed(1)}</td>
                  <td className="p-2">{s.avg_profiles_viewed?.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Chart 8: Auth Health */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-2">Authentication Health</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <StatCard label="Auth Success" value={data.authStats.auth_success} color="text-green-600" />
          <StatCard label="Auth Failed" value={data.authStats.auth_failed} color={data.authStats.auth_failed > 0 ? 'text-red-600' : 'text-gray-900'} />
          <StatCard label="Tokens Issued" value={data.authStats.tokens_issued} />
          <StatCard label="Tokens Refreshed" value={data.authStats.tokens_refreshed} />
          <StatCard label="Token Failures" value={data.authStats.tokens_failed} color={data.authStats.tokens_failed > 0 ? 'text-red-600' : 'text-gray-900'} />
          <StatCard label="Tokens Revoked" value={data.authStats.tokens_revoked} />
        </div>
      </div>

      {/* Chart 9: Job Acceptance / Human Response */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-2">Human Response to Agent Jobs</h2>
        <p className="text-sm text-gray-600 mb-4">How humans respond to MCP-initiated job offers</p>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
          <StatCard label="Offers Sent" value={data.jobAcceptance.offers_sent} />
          <StatCard label="Accepted" value={data.jobAcceptance.accepted} color="text-green-600" />
          <StatCard label="Rejected" value={data.jobAcceptance.rejected} color="text-red-600" />
          <StatCard label="Acceptance Rate" value={pct(data.jobAcceptance.accepted, data.jobAcceptance.offers_sent)} color="text-blue-600" />
          <StatCard label="Avg Response Time" value={msToHuman(data.jobAcceptance.avg_response_time_ms)} />
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={[
            { name: 'Offers', value: data.jobAcceptance.offers_sent, fill: '#2563eb' },
            { name: 'Accepted', value: data.jobAcceptance.accepted, fill: '#10b981' },
            { name: 'Rejected', value: data.jobAcceptance.rejected, fill: '#ef4444' },
            { name: 'Completed', value: data.jobAcceptance.completed, fill: '#8b5cf6' },
          ]}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="value">
              {[0,1,2,3].map(i => <Cell key={i} fill={['#2563eb','#10b981','#ef4444','#8b5cf6'][i]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 10: Payment Flow */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-2">Payment Flow Health</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <StatCard label="Initiated" value={data.paymentFlow.initiated} />
          <StatCard label="Received" value={data.paymentFlow.received} color="text-green-600" />
          <StatCard label="Failed" value={data.paymentFlow.failed} color={data.paymentFlow.failed > 0 ? 'text-red-600' : 'text-gray-900'} />
          <StatCard label="Confirmed Offchain" value={data.paymentFlow.confirmed_offchain} />
          <StatCard label="x402 Payments" value={data.paymentFlow.x402_payments} color="text-blue-600" />
        </div>
      </div>

      {/* Chart 11: Search Patterns */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-2">Top Search Patterns</h2>
        <p className="text-sm text-gray-600 mb-4">Most common skill + location combinations agents search for</p>
        <div className="overflow-x-auto">
          <table className="text-sm w-full">
            <thead>
              <tr className="text-left text-gray-600 border-b">
                <th className="p-2">#</th><th className="p-2">Skill</th><th className="p-2">Location</th>
                <th className="p-2">Searches</th><th className="p-2">Avg Results</th>
              </tr>
            </thead>
            <tbody>
              {data.searchPatterns.slice(0, 15).map((s, i) => (
                <tr key={i} className="border-b hover:bg-gray-50">
                  <td className="p-2 text-gray-400">{i + 1}</td>
                  <td className="p-2 font-medium">{s.skill || '(any)'}</td>
                  <td className="p-2">{s.location || '(any)'}</td>
                  <td className="p-2">{s.count}</td>
                  <td className="p-2">{s.avg_results?.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Chart 12: Agent Retention */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-2">Top Returning Agents</h2>
        <p className="text-sm text-gray-600 mb-4">Agents with repeat sessions — product stickiness indicator</p>
        <div className="grid grid-cols-3 gap-4 mb-4">
          <StatCard label="Total Agents" value={data.agentRetention.length} />
          <StatCard label="Repeat Users (2+)" value={data.agentRetention.filter(a => a.session_count >= 2).length} color="text-green-600" />
          <StatCard label="Power Users (5+)" value={data.agentRetention.filter(a => a.session_count >= 5).length} color="text-blue-600" />
        </div>
        <div className="overflow-x-auto">
          <table className="text-sm w-full">
            <thead>
              <tr className="text-left text-gray-600 border-b">
                <th className="p-2">Agent ID</th><th className="p-2">Sessions</th>
                <th className="p-2">First Seen</th><th className="p-2">Last Seen</th><th className="p-2">Active Days</th>
              </tr>
            </thead>
            <tbody>
              {data.agentRetention.slice(0, 20).map((a, i) => (
                <tr key={i} className="border-b hover:bg-gray-50">
                  <td className="p-2 font-mono text-xs">{a.agent_id.slice(0, 16)}...</td>
                  <td className="p-2 font-bold">{a.session_count}</td>
                  <td className="p-2">{new Date(a.first_seen).toLocaleDateString()}</td>
                  <td className="p-2">{new Date(a.last_seen).toLocaleDateString()}</td>
                  <td className="p-2">{a.active_days}d</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Chart 13: Per-Platform Conversion Funnel */}
      {data.platformFunnel && data.platformFunnel.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-2">Conversion by Platform</h2>
          <p className="text-sm text-gray-600 mb-4">Which AI platform converts best — session to hire</p>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.platformFunnel}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="platform" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="sessions" fill="#2563eb" name="Sessions" />
              <Bar dataKey="searches" fill="#10b981" name="Searches" />
              <Bar dataKey="profile_views" fill="#f59e0b" name="Profile Views" />
              <Bar dataKey="jobs_created" fill="#ef4444" name="Jobs Created" />
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-3 overflow-x-auto">
            <table className="text-sm w-full">
              <thead>
                <tr className="text-left text-gray-600 border-b">
                  <th className="p-2">Platform</th><th className="p-2">Sessions</th><th className="p-2">Searches</th>
                  <th className="p-2">Views</th><th className="p-2">Hires</th><th className="p-2">Search→Hire</th>
                </tr>
              </thead>
              <tbody>
                {data.platformFunnel.map((p, i) => (
                  <tr key={i} className="border-b">
                    <td className="p-2 font-medium">{p.platform}</td>
                    <td className="p-2">{p.sessions}</td>
                    <td className="p-2">{p.searches}</td>
                    <td className="p-2">{p.profile_views}</td>
                    <td className="p-2 font-bold">{p.jobs_created}</td>
                    <td className="p-2 text-blue-600 font-bold">{pct(p.jobs_created, p.searches)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Chart 14: Tool Call Transitions */}
      {data.toolTransitions && data.toolTransitions.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-2">Tool Call Flow</h2>
          <p className="text-sm text-gray-600 mb-4">Most common tool→tool transitions — reveals the &quot;happy path&quot;</p>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={data.toolTransitions.slice(0, 15)} layout="vertical" margin={{ left: 200 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis dataKey={(d: any) => `${d.from_tool} → ${d.to_tool}`} type="category" width={190} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="transitions" fill="#8b5cf6" name="Transitions" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Chart 15: Skill-to-Hire Conversion */}
      {data.skillConversion && data.skillConversion.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-2">Skill Search → Hire Conversion</h2>
          <p className="text-sm text-gray-600 mb-4">Which searched skills actually lead to job creation</p>
          <div className="overflow-x-auto">
            <table className="text-sm w-full">
              <thead>
                <tr className="text-left text-gray-600 border-b">
                  <th className="p-2">#</th><th className="p-2">Skill</th><th className="p-2">Searches</th>
                  <th className="p-2">Hires</th><th className="p-2">Conversion</th><th className="p-2">Avg Results</th>
                </tr>
              </thead>
              <tbody>
                {data.skillConversion.map((s, i) => (
                  <tr key={i} className="border-b hover:bg-gray-50">
                    <td className="p-2 text-gray-400">{i + 1}</td>
                    <td className="p-2 font-medium">{s.skill}</td>
                    <td className="p-2">{s.searches}</td>
                    <td className="p-2 font-bold">{s.hires}</td>
                    <td className={`p-2 font-bold ${s.hires > 0 ? 'text-green-600' : 'text-gray-400'}`}>{pct(s.hires, s.searches)}</td>
                    <td className="p-2">{s.avg_results?.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Chart 16: Tool Latency Percentiles */}
      {data.toolLatency && data.toolLatency.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-2">Tool Latency Distribution</h2>
          <p className="text-sm text-gray-600 mb-4">p50, p95, p99 latency per tool — spot slow tools and outliers</p>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.toolLatency} layout="vertical" margin={{ left: 140 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" label={{ value: 'ms', position: 'insideBottomRight' }} />
              <YAxis dataKey="tool" type="category" width={130} />
              <Tooltip formatter={(val: any) => `${Number(val).toFixed(0)}ms`} />
              <Legend />
              <Bar dataKey="p50_ms" fill="#10b981" name="p50" />
              <Bar dataKey="p95_ms" fill="#f59e0b" name="p95" />
              <Bar dataKey="p99_ms" fill="#ef4444" name="p99" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Chart 17: Full Job Lifecycle */}
      {data.jobLifecycle && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-2">Full Job Lifecycle</h2>
          <p className="text-sm text-gray-600 mb-4">Every status transition from offer to completion</p>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={[
              { name: 'Offers', value: data.jobLifecycle.offers, fill: '#2563eb' },
              { name: 'Accepted', value: data.jobLifecycle.accepted, fill: '#10b981' },
              { name: 'Rejected', value: data.jobLifecycle.rejected, fill: '#f59e0b' },
              { name: 'Submissions', value: data.jobLifecycle.submissions, fill: '#06b6d4' },
              { name: 'Revisions', value: data.jobLifecycle.revisions, fill: '#8b5cf6' },
              { name: 'Completed', value: data.jobLifecycle.completed, fill: '#10b981' },
              { name: 'Cancelled', value: data.jobLifecycle.cancelled, fill: '#ef4444' },
              { name: 'Disputed', value: data.jobLifecycle.disputed, fill: '#dc2626' },
              { name: 'Reviews', value: data.jobLifecycle.reviews, fill: '#84cc16' },
              { name: 'Messages', value: data.jobLifecycle.messages, fill: '#64748b' },
            ]}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis />
              <Tooltip />
              <Bar dataKey="value">
                {[0,1,2,3,4,5,6,7,8,9].map(i => (
                  <Cell key={i} fill={['#2563eb','#10b981','#f59e0b','#06b6d4','#8b5cf6','#10b981','#ef4444','#dc2626','#84cc16','#64748b'][i]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Chart 18: Stream & Payment Stats */}
      {data.streamStats && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-2">Stream Payments & Off-Chain</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <StatCard label="Streams Started" value={data.streamStats.started} />
            <StatCard label="Streams Stopped" value={data.streamStats.stopped} />
            <StatCard label="Payments Initiated" value={data.streamStats.payments_initiated} />
            <StatCard label="Payments Received" value={data.streamStats.payments_received} color="text-green-600" />
            <StatCard label="Off-Chain Claims" value={data.streamStats.offchain_claims} color="text-blue-600" />
          </div>
        </div>
      )}

      {/* Chart 19: Infrastructure Health */}
      {data.infraHealth && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-2">MCP Infrastructure Health</h2>
          <p className="text-sm text-gray-600 mb-4">Errors, rate limits, and edge cases in the MCP layer</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Rate Limit Hits" value={data.infraHealth.rate_limits} color={data.infraHealth.rate_limits > 0 ? 'text-orange-600' : 'text-gray-900'} />
            <StatCard label="Auth Rejections" value={data.infraHealth.auth_rejections} color={data.infraHealth.auth_rejections > 0 ? 'text-red-600' : 'text-gray-900'} />
            <StatCard label="Unknown Methods" value={data.infraHealth.unknown_methods} color={data.infraHealth.unknown_methods > 0 ? 'text-orange-600' : 'text-gray-900'} />
            <StatCard label="Tool Errors" value={data.infraHealth.tool_errors} color={data.infraHealth.tool_errors > 0 ? 'text-red-600' : 'text-gray-900'} />
            <StatCard label="SSE Timeouts" value={data.infraHealth.sse_timeouts} />
            <StatCard label="SSE Disconnects" value={data.infraHealth.sse_disconnects} />
            <StatCard label="Discovery Hits" value={data.infraHealth.discovery_hits} color="text-blue-600" />
          </div>
        </div>
      )}

      {/* Data Info */}
      <div className="bg-gray-50 rounded-lg p-4 text-xs text-gray-600">
        <p>Last updated: {new Date(data.timestamp).toLocaleString()}</p>
        <p>Data range: {data.range} days</p>
      </div>
    </div>
  );
}
