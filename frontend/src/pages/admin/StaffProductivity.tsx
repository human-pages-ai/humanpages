import { useState, useEffect, useCallback, useMemo } from 'react';
import toast from 'react-hot-toast';
import { api } from '../../lib/api';
import { useProductivitySSE } from '../../hooks/useProductivitySSE';
import type { ProductivityDashboardData, StaffProductivityEntry, StaffActivityEvent } from '../../types/admin';

const ACTION_LABELS: Record<string, string> = {
  posting_posted: 'Posted',
  posting_rejected: 'Rejected post',
  posting_skipped: 'Skipped post',
  content_approved: 'Approved content',
  content_rejected: 'Rejected content',
  content_published: 'Published content',
  clock_in: 'Clocked in',
  clock_out: 'Clocked out',
};

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatMinutes(m: number): string {
  if (m < 60) return `${m}min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r > 0 ? `${h}h ${r}m` : `${h}h`;
}

function StatusDot({ status }: { status: 'active' | 'idle' | 'offline' }) {
  const colors = {
    active: 'bg-green-500',
    idle: 'bg-yellow-500',
    offline: 'bg-gray-400',
  };
  return <span className={`inline-block w-2.5 h-2.5 rounded-full ${colors[status]}`} />;
}

export default function StaffProductivity() {
  const [data, setData] = useState<ProductivityDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = useCallback(async () => {
    try {
      const result = await api.getProductivityDashboard();
      setData(result);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
    // 30s polling fallback
    const interval = setInterval(fetchDashboard, 30_000);
    return () => clearInterval(interval);
  }, [fetchDashboard]);

  // SSE callbacks — trigger refetch on events
  const sseCallbacks = useMemo(
    () => ({
      onStaffActivity: () => {
        fetchDashboard();
      },
      onIdleAlert: (alertData: unknown) => {
        const alert = alertData as { humanName?: string; idleMinutes?: number };
        toast.error(
          `${alert.humanName || 'Staff'} idle for ${alert.idleMinutes || '?'} min`,
          { duration: 8000 }
        );
        fetchDashboard();
      },
      onIdleResolved: () => {
        fetchDashboard();
      },
    }),
    [fetchDashboard]
  );

  useProductivitySSE(sseCallbacks);

  const handleDismiss = async (alertId: string) => {
    try {
      await api.dismissIdleAlert(alertId);
      toast.success('Alert dismissed');
      fetchDashboard();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  if (loading) {
    return <div className="text-center py-12 text-gray-500">Loading productivity data...</div>;
  }

  if (error) {
    return <div className="text-center py-12 text-red-500">Error: {error}</div>;
  }

  if (!data) return null;

  const { staff, activityFeed, idleAlerts, config } = data;

  // Sort: active first, then idle, then offline
  const sortedStaff = [...staff].sort((a, b) => {
    const order = { active: 0, idle: 1, offline: 2 };
    return order[a.status] - order[b.status];
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">Staff Productivity</h2>
        <span className="text-xs text-gray-500">
          Idle threshold: {config.idleThresholdMinutes} min
        </span>
      </div>

      {/* Active idle alerts banner */}
      {idleAlerts.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-2">
          <h3 className="text-sm font-semibold text-red-800">
            Active Idle Alerts ({idleAlerts.length})
          </h3>
          {idleAlerts.map((alert) => (
            <div key={alert.id} className="flex items-center justify-between text-sm">
              <span className="text-red-700">
                <span className="font-medium">{alert.humanName}</span> idle for{' '}
                <span className="font-bold">{alert.idleMinutes} min</span>
                <span className="text-red-500 ml-2 text-xs">
                  since {formatTime(alert.idleSince)}
                </span>
              </span>
              <button
                onClick={() => handleDismiss(alert.id)}
                className="px-3 py-1 text-xs bg-red-100 hover:bg-red-200 text-red-700 rounded-md transition-colors"
              >
                Dismiss
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Staff status grid */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Staff Status</h3>
          <div className="space-y-2">
            {sortedStaff.length === 0 && (
              <p className="text-sm text-gray-500">No staff users found.</p>
            )}
            {sortedStaff.map((member) => (
              <StaffCard key={member.id} member={member} />
            ))}
          </div>
        </div>

        {/* Activity feed */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Activity Feed</h3>
          <div className="space-y-1 max-h-[400px] overflow-y-auto">
            {activityFeed.length === 0 && (
              <p className="text-sm text-gray-500">No activity today.</p>
            )}
            {activityFeed.map((event) => (
              <ActivityRow key={event.id} event={event} />
            ))}
          </div>
        </div>
      </div>

      {/* Productivity metrics table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200">
          <h3 className="text-sm font-semibold text-gray-700">Productivity Metrics (Today)</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Tasks</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Tasks/hr</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Idle</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Hours</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sortedStaff.map((member) => (
                <tr key={member.id}>
                  <td className="px-4 py-2 text-sm text-gray-900">{member.name}</td>
                  <td className="px-4 py-2 text-sm">
                    <span className="flex items-center gap-1.5">
                      <StatusDot status={member.status} />
                      <span className="capitalize text-gray-600">{member.status}</span>
                    </span>
                  </td>
                  <td className="px-4 py-2 text-sm text-right text-gray-900">{member.todayTaskCount}</td>
                  <td className="px-4 py-2 text-sm text-right text-gray-900">{member.tasksPerHour}</td>
                  <td className="px-4 py-2 text-sm text-right text-gray-900">
                    {member.status !== 'offline' ? formatMinutes(member.idleMinutes) : '-'}
                  </td>
                  <td className="px-4 py-2 text-sm text-right text-gray-900">
                    {(member.workedMinutesToday / 60).toFixed(1)}h
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

function StaffCard({ member }: { member: StaffProductivityEntry }) {
  return (
    <div className="flex items-center justify-between p-2 rounded-md bg-gray-50">
      <div className="flex items-center gap-2">
        <StatusDot status={member.status} />
        <div>
          <span className="text-sm font-medium text-gray-900">{member.name}</span>
          {member.status === 'idle' && (
            <span className="ml-2 text-xs text-yellow-600">
              idle {formatMinutes(member.idleMinutes)}
            </span>
          )}
          {member.status === 'active' && member.clockedInSince && (
            <span className="ml-2 text-xs text-green-600">
              since {formatTime(member.clockedInSince)}
            </span>
          )}
        </div>
      </div>
      <div className="text-right">
        <span className="text-sm font-medium text-gray-700">{member.todayTaskCount} tasks</span>
        {member.tasksPerHour > 0 && (
          <span className="ml-2 text-xs text-gray-500">{member.tasksPerHour}/hr</span>
        )}
      </div>
    </div>
  );
}

function ActivityRow({ event }: { event: StaffActivityEvent }) {
  const label = ACTION_LABELS[event.actionType] || event.actionType;
  return (
    <div className="flex items-center gap-2 py-1 text-sm">
      <span className="text-xs text-gray-400 w-12 flex-shrink-0">{formatTime(event.createdAt)}</span>
      <span className="text-gray-700">
        <span className="font-medium">{event.humanName}</span>{' '}
        <span className="text-gray-500">{label}</span>
      </span>
    </div>
  );
}
