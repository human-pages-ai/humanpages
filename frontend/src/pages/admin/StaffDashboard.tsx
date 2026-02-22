import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../../lib/api';
import { useAdminRole } from '../../hooks/useAdminRole';
import type { ClockStatus, HoursSummary, TimeEntry, Pagination, StaffClockOverview } from '../../types/admin';

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function ClockWidget({ status, onToggle, loading }: {
  status: ClockStatus | null;
  onToggle: () => void;
  loading: boolean;
}) {
  const [elapsed, setElapsed] = useState('');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);

    if (status?.clockedIn && status.since) {
      const update = () => {
        const diff = Math.floor((Date.now() - new Date(status.since!).getTime()) / 1000);
        const h = Math.floor(diff / 3600);
        const m = Math.floor((diff % 3600) / 60);
        const s = diff % 60;
        setElapsed(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
      };
      update();
      intervalRef.current = setInterval(update, 1000);
    } else {
      setElapsed('');
    }

    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [status?.clockedIn, status?.since]);

  const clockedIn = status?.clockedIn ?? false;

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${clockedIn ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`} />
          <div>
            <div className="text-sm font-medium text-gray-900">
              {clockedIn ? 'Clocked In' : 'Clocked Out'}
            </div>
            {clockedIn && status?.since && (
              <div className="text-xs text-gray-500">Since {formatTime(status.since)}</div>
            )}
          </div>
          {clockedIn && elapsed && (
            <div className="text-2xl font-mono font-bold text-gray-900 ml-4">{elapsed}</div>
          )}
        </div>
        <button
          onClick={onToggle}
          disabled={loading}
          className={`px-6 py-3 rounded-lg font-semibold text-white transition-colors ${
            clockedIn
              ? 'bg-red-500 hover:bg-red-600'
              : 'bg-green-500 hover:bg-green-600'
          } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {loading ? '...' : clockedIn ? 'Clock Out' : 'Clock In'}
        </button>
      </div>
    </div>
  );
}

function SummaryCards({ summary }: { summary: HoursSummary | null }) {
  if (!summary) return null;

  const cards = [
    { label: 'Today', hours: summary.today.hours, minutes: summary.today.minutes },
    { label: 'This Week', hours: summary.week.hours, minutes: summary.week.minutes },
    { label: 'This Month', hours: summary.month.hours, minutes: summary.month.minutes },
  ];

  return (
    <div className="grid grid-cols-3 gap-4 mb-6">
      {cards.map((card) => (
        <div key={card.label} className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">{card.label}</div>
          <div className="text-2xl font-bold text-gray-900 mt-1">{card.hours}h</div>
          <div className="text-xs text-gray-400">{formatDuration(card.minutes)}</div>
        </div>
      ))}
    </div>
  );
}

function RecentShifts({ entries, pagination, onPageChange, viewingStaff }: {
  entries: TimeEntry[];
  pagination: Pagination | null;
  onPageChange: (page: number) => void;
  viewingStaff?: string;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-6">
      <div className="px-4 py-3 border-b border-gray-200">
        <h3 className="text-sm font-semibold text-gray-900">
          {viewingStaff ? `Shifts — ${viewingStaff}` : 'Recent Shifts'}
        </h3>
      </div>
      {entries.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-gray-400">No shifts recorded yet</div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-500 uppercase tracking-wide border-b border-gray-100">
              <th className="px-4 py-2">Date</th>
              <th className="px-4 py-2">Clock In</th>
              <th className="px-4 py-2">Clock Out</th>
              <th className="px-4 py-2">Duration</th>
              <th className="px-4 py-2">Notes</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="px-4 py-2 text-gray-700">{formatDate(entry.clockIn)}</td>
                <td className="px-4 py-2 text-gray-700">{formatTime(entry.clockIn)}</td>
                <td className="px-4 py-2 text-gray-700">
                  {entry.clockOut ? formatTime(entry.clockOut) : (
                    <span className="text-green-600 font-medium">Active</span>
                  )}
                </td>
                <td className="px-4 py-2 text-gray-700">
                  {entry.duration != null ? formatDuration(entry.duration) : '—'}
                </td>
                <td className="px-4 py-2 text-gray-400 truncate max-w-[200px]">
                  {entry.notes || '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {pagination && pagination.totalPages > 1 && (
        <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
          <span>Page {pagination.page} of {pagination.totalPages}</span>
          <div className="flex gap-2">
            <button
              onClick={() => onPageChange(pagination.page - 1)}
              disabled={pagination.page <= 1}
              className="px-3 py-1 rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-30"
            >
              Prev
            </button>
            <button
              onClick={() => onPageChange(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages}
              className="px-3 py-1 rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-30"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function StaffOverview({ staff, onViewShifts }: {
  staff: StaffClockOverview[];
  onViewShifts: (id: string, name: string) => void;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-200">
        <h3 className="text-sm font-semibold text-gray-900">All Staff</h3>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-gray-500 uppercase tracking-wide border-b border-gray-100">
            <th className="px-4 py-2">Name</th>
            <th className="px-4 py-2">Status</th>
            <th className="px-4 py-2">Today</th>
            <th className="px-4 py-2">This Week</th>
            <th className="px-4 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {staff.map((s) => (
            <tr key={s.id} className="border-b border-gray-50 hover:bg-gray-50">
              <td className="px-4 py-2">
                <div className="font-medium text-gray-900">{s.name}</div>
                <div className="text-xs text-gray-400">{s.email}</div>
              </td>
              <td className="px-4 py-2">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${s.clockedIn ? 'bg-green-500' : 'bg-gray-300'}`} />
                  <span className="text-gray-700">
                    {s.clockedIn ? 'Clocked In' : 'Off'}
                  </span>
                </div>
                {s.clockedIn && s.clockedInSince && (
                  <div className="text-xs text-gray-400">Since {formatTime(s.clockedInSince)}</div>
                )}
              </td>
              <td className="px-4 py-2 text-gray-700">{s.todayHours}h</td>
              <td className="px-4 py-2 text-gray-700">{s.weekHours}h</td>
              <td className="px-4 py-2">
                <button
                  onClick={() => onViewShifts(s.id, s.name)}
                  className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                >
                  View Shifts
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function StaffDashboard() {
  const { isAdmin } = useAdminRole();
  const [status, setStatus] = useState<ClockStatus | null>(null);
  const [summary, setSummary] = useState<HoursSummary | null>(null);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [allStaff, setAllStaff] = useState<StaffClockOverview[]>([]);
  const [toggleLoading, setToggleLoading] = useState(false);
  const [viewingStaffId, setViewingStaffId] = useState<string | null>(null);
  const [viewingStaffName, setViewingStaffName] = useState<string | null>(null);

  const loadData = useCallback(async (page = 1, humanId?: string) => {
    try {
      const [statusRes, summaryRes, entriesRes] = await Promise.all([
        api.getClockStatus(),
        api.getHoursSummary(humanId),
        api.getTimeEntries({ page, limit: 10, humanId }),
      ]);
      setStatus(statusRes);
      setSummary(summaryRes);
      setEntries(entriesRes.entries);
      setPagination(entriesRes.pagination);
    } catch {
      // Silently handle errors
    }
  }, []);

  const loadStaffOverview = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const res = await api.getAllStaffClock();
      setAllStaff(res.staff);
    } catch {
      // ignore
    }
  }, [isAdmin]);

  useEffect(() => {
    loadData();
    loadStaffOverview();
  }, [loadData, loadStaffOverview]);

  const handleToggle = async () => {
    setToggleLoading(true);
    try {
      if (status?.clockedIn) {
        await api.clockOut();
      } else {
        await api.clockIn();
      }
      await loadData(1, viewingStaffId || undefined);
      loadStaffOverview();
    } catch {
      // ignore
    } finally {
      setToggleLoading(false);
    }
  };

  const handlePageChange = (page: number) => {
    loadData(page, viewingStaffId || undefined);
  };

  const handleViewShifts = (staffId: string, name: string) => {
    setViewingStaffId(staffId);
    setViewingStaffName(name);
    loadData(1, staffId);
  };

  const handleBackToOwnShifts = () => {
    setViewingStaffId(null);
    setViewingStaffName(null);
    loadData(1);
  };

  return (
    <div>
      <ClockWidget status={status} onToggle={handleToggle} loading={toggleLoading} />
      <SummaryCards summary={summary} />

      {viewingStaffId && (
        <div className="mb-4">
          <button
            onClick={handleBackToOwnShifts}
            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            &larr; Back to my shifts
          </button>
        </div>
      )}

      <RecentShifts
        entries={entries}
        pagination={pagination}
        onPageChange={handlePageChange}
        viewingStaff={viewingStaffName || undefined}
      />

      {isAdmin && !viewingStaffId && (
        <StaffOverview staff={allStaff} onViewShifts={handleViewShifts} />
      )}
    </div>
  );
}
