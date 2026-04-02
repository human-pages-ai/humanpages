import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import type { McpAnalyticsResponse } from '../../types/admin';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';

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

export default function AdminMcpAnalytics() {
  const [data, setData] = useState<McpAnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [range, setRange] = useState(30);

  useEffect(() => {
    setLoading(true);
    api.getAdminMcpAnalytics(range)
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [range]);

  if (loading) return <div className="p-8 text-gray-500">Loading MCP analytics...</div>;
  if (error) return <div className="p-8 text-red-600">Error: {error}</div>;
  if (!data) return <div className="p-8 text-gray-500">No data</div>;

  // Chart 10: Notification Delivery by Channel
  const notificationByChannel = data.notificationDelivery.reduce((acc, row) => {
    const key = row.channel;
    const existing = acc.find(x => x.channel === key);
    if (existing) {
      existing.sent += row.sent;
      existing.failed += row.failed;
    } else {
      acc.push({ channel: key, sent: row.sent, failed: row.failed });
    }
    return acc;
  }, [] as { channel: string; sent: number; failed: number }[]);

  // Chart 11: Webhook Health
  const webhookDeliveryRate = data.webhookStats.delivered > 0
    ? ((data.webhookStats.delivered / data.webhookStats.fired) * 100).toFixed(1)
    : '0';
  const webhookFailureRate = data.webhookStats.failed > 0
    ? ((data.webhookStats.failed / data.webhookStats.fired) * 100).toFixed(1)
    : '0';

  // Chart 13: Rate Limits by type
  const rateLimitsByType = data.rateLimits.reduce((acc, row) => {
    const key = `${row.limit_type} (${row.tier})`;
    acc.push({ name: key, value: row.count });
    return acc;
  }, [] as { name: string; value: number }[]);

  // Chart 14: Outbox Health
  const outboxChartData = data.outboxStats.map(row => ({
    channel: row.channel,
    delivered: row.delivered,
    failed: row.failed,
    expired: row.expired,
  }));

  const failureRateColor = parseFloat(webhookFailureRate) > 5 ? 'text-red-600' : 'text-green-600';

  return (
    <div className="space-y-8 p-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">MCP Communication & Notification Analytics</h1>
        <div className="flex gap-2">
          {[7, 30, 60, 90].map(r => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-3 py-1 text-sm rounded ${
                range === r
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
              }`}
            >
              {r}d
            </button>
          ))}
        </div>
      </div>

      {/* Chart 10: Notification Delivery */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Notification Delivery</h2>
        <p className="text-sm text-gray-600 mb-4">Success and failure rates across notification channels</p>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={notificationByChannel}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="channel" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="sent" fill="#10b981" name="Sent" />
            <Bar dataKey="failed" fill="#ef4444" name="Failed" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 11: Webhook Health */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Webhook Health</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Fired" value={data.webhookStats.fired} />
          <StatCard label="Delivered" value={data.webhookStats.delivered} />
          <StatCard label="Failed" value={data.webhookStats.failed} color={data.webhookStats.failed > 0 ? 'text-red-600' : 'text-gray-900'} />
          <StatCard label="Retries" value={data.webhookStats.retries} />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
          <div className="bg-blue-50 p-3 rounded">
            <p className="text-gray-600">Delivery Rate</p>
            <p className="text-2xl font-bold text-blue-600">{webhookDeliveryRate}%</p>
          </div>
          <div className="bg-red-50 p-3 rounded">
            <p className="text-gray-600">Failure Rate</p>
            <p className={`text-2xl font-bold ${failureRateColor}`}>{webhookFailureRate}%</p>
          </div>
        </div>
      </div>

      {/* Chart 12: WhatsApp Engagement */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">WhatsApp Engagement</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <StatCard label="Inbound Messages" value={data.whatsappEngagement.inbound_messages} color="text-green-600" />
          <StatCard label="Verifications" value={data.whatsappEngagement.verifications} color="text-green-600" />
          <StatCard label="Window Expired" value={data.whatsappEngagement.window_expired} color={data.whatsappEngagement.window_expired > 0 ? 'text-red-600' : 'text-gray-900'} />
          <StatCard label="Pending Flushed" value={data.whatsappEngagement.pending_flushed} color="text-blue-600" />
          <StatCard label="Disambiguation Needed" value={data.whatsappEngagement.disambiguation_needed} color={data.whatsappEngagement.disambiguation_needed > 0 ? 'text-orange-600' : 'text-gray-900'} />
        </div>
      </div>

      {/* Chart 13: Rate Limits */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Rate Limit Hits</h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart
            data={rateLimitsByType}
            layout="vertical"
            margin={{ top: 5, right: 30, left: 200 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" />
            <YAxis dataKey="name" type="category" width={190} />
            <Tooltip />
            <Bar dataKey="value" fill="#ef4444" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 14: Outbox Health */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Outbox Delivery Status</h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={outboxChartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="channel" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="delivered" stackId="a" fill="#10b981" name="Delivered" />
            <Bar dataKey="failed" stackId="a" fill="#ef4444" name="Failed" />
            <Bar dataKey="expired" stackId="a" fill="#f59e0b" name="Expired" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Data Info */}
      <div className="bg-gray-50 rounded-lg p-4 text-xs text-gray-600">
        <p>Last updated: {new Date(data.timestamp).toLocaleString()}</p>
        <p>Data range: {data.range} days</p>
      </div>
    </div>
  );
}
