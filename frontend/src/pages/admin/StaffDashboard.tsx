import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../../lib/api';
import { useAdminRole } from '../../hooks/useAdminRole';
import type { ClockStatus, HoursSummary, TimeEntry, Pagination, StaffClockOverview, StaffPayment, HoursAdjustment, StaffBalance } from '../../types/admin';

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
  return new Date(iso).toLocaleDateString('en-GB', { month: 'short', day: 'numeric' });
}

function formatMoney(amount: number | string): string {
  return `$${Number(amount).toFixed(2)}`;
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

function BalanceCard({ balance }: { balance: StaffBalance | null }) {
  if (!balance || !balance.staffDailyRate) return null;

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">Balance — This Month</h3>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div>
          <div className="text-xs text-gray-500 uppercase tracking-wide">Earned</div>
          <div className="text-xl font-bold text-gray-900">{formatMoney(balance.earned)}</div>
          <div className="text-xs text-gray-400">{balance.workedHours}h @ {formatMoney(balance.hourlyRate)}/h</div>
        </div>
        <div>
          <div className="text-xs text-gray-500 uppercase tracking-wide">Paid</div>
          <div className="text-xl font-bold text-gray-900">{formatMoney(balance.paid)}</div>
        </div>
        <div>
          <div className="text-xs text-gray-500 uppercase tracking-wide">Owed</div>
          <div className={`text-xl font-bold ${balance.owed > 0 ? 'text-red-600' : 'text-green-600'}`}>
            {formatMoney(balance.owed)}
          </div>
        </div>
        <div>
          <div className="text-xs text-gray-500 uppercase tracking-wide">Rate</div>
          <div className="text-xl font-bold text-gray-900">{formatMoney(balance.staffDailyRate)}/day</div>
          <div className="text-xs text-gray-400">{balance.staffDailyHours}h/day quota</div>
        </div>
      </div>
    </div>
  );
}

function PaymentLog({ payments, pagination, onPageChange, isAdmin, onAdd, onDelete }: {
  payments: StaffPayment[];
  pagination: Pagination | null;
  onPageChange: (page: number) => void;
  isAdmin: boolean;
  onAdd: () => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-6">
      <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">Payment Log</h3>
        {isAdmin && (
          <button onClick={onAdd} className="text-xs font-medium text-blue-600 hover:text-blue-800">
            + Add Payment
          </button>
        )}
      </div>
      {payments.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-gray-400">No payments recorded</div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-500 uppercase tracking-wide border-b border-gray-100">
              <th className="px-4 py-2">Date</th>
              <th className="px-4 py-2">Amount</th>
              <th className="px-4 py-2">Notes</th>
              <th className="px-4 py-2">Logged By</th>
              {isAdmin && <th className="px-4 py-2"></th>}
            </tr>
          </thead>
          <tbody>
            {payments.map((p) => (
              <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="px-4 py-2 text-gray-700">{formatDate(p.paymentDate)}</td>
                <td className="px-4 py-2 font-medium text-gray-900">{formatMoney(p.amountUsd)}</td>
                <td className="px-4 py-2 text-gray-400 truncate max-w-[200px]">{p.notes || '—'}</td>
                <td className="px-4 py-2 text-gray-500">{p.createdBy?.name || '—'}</td>
                {isAdmin && (
                  <td className="px-4 py-2">
                    <button
                      onClick={() => onDelete(p.id)}
                      className="text-red-500 hover:text-red-700 text-xs"
                    >
                      Delete
                    </button>
                  </td>
                )}
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
            >Prev</button>
            <button
              onClick={() => onPageChange(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages}
              className="px-3 py-1 rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-30"
            >Next</button>
          </div>
        </div>
      )}
    </div>
  );
}

function AddPaymentModal({ humanId, onClose, onSaved }: {
  humanId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !date) return;
    setSaving(true);
    try {
      await api.createPayment({ humanId, amountUsd: parseFloat(amount), paymentDate: date, notes: notes || undefined });
      onSaved();
      onClose();
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-xl p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Log Payment</h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-500">Amount (USD)</label>
            <input type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)}
              className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm" required />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500">Payment Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
              className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm" required />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500">Notes (optional)</label>
            <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)}
              className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm" />
          </div>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function HoursAdjustments({ adjustments, pagination, onPageChange, isAdmin, onSubmit, onReview }: {
  adjustments: HoursAdjustment[];
  pagination: Pagination | null;
  onPageChange: (page: number) => void;
  isAdmin: boolean;
  onSubmit: (data: { date: string; minutes: number; reason: string }) => void;
  onReview: (id: string, status: 'APPROVED' | 'REJECTED') => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [minutes, setMinutes] = useState('');
  const [reason, setReason] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!date || !minutes || !reason) return;
    onSubmit({ date, minutes: parseInt(minutes), reason });
    setShowForm(false);
    setMinutes('');
    setReason('');
  };

  const statusColors: Record<string, string> = {
    PENDING: 'bg-yellow-100 text-yellow-800',
    APPROVED: 'bg-green-100 text-green-800',
    REJECTED: 'bg-red-100 text-red-800',
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-6">
      <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">Hours Adjustments</h3>
        {!isAdmin && (
          <button onClick={() => setShowForm(!showForm)} className="text-xs font-medium text-blue-600 hover:text-blue-800">
            {showForm ? 'Cancel' : '+ Request Adjustment'}
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="px-4 py-3 border-b border-gray-100 bg-gray-50">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-500">Date</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm" required />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500">Minutes</label>
              <input type="number" min="1" value={minutes} onChange={(e) => setMinutes(e.target.value)}
                className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm" required />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500">Reason</label>
              <input type="text" value={reason} onChange={(e) => setReason(e.target.value)}
                className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm" placeholder="e.g. Forgot to clock in" required />
            </div>
          </div>
          <button type="submit" className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
            Submit Request
          </button>
        </form>
      )}

      {adjustments.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-gray-400">No adjustment requests</div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-500 uppercase tracking-wide border-b border-gray-100">
              {isAdmin && <th className="px-4 py-2">Staff</th>}
              <th className="px-4 py-2">Date</th>
              <th className="px-4 py-2">Minutes</th>
              <th className="px-4 py-2">Reason</th>
              <th className="px-4 py-2">Status</th>
              {isAdmin && <th className="px-4 py-2">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {adjustments.map((a) => (
              <tr key={a.id} className="border-b border-gray-50 hover:bg-gray-50">
                {isAdmin && (
                  <td className="px-4 py-2 text-gray-700">{a.human?.name || '—'}</td>
                )}
                <td className="px-4 py-2 text-gray-700">{formatDate(a.date)}</td>
                <td className="px-4 py-2 text-gray-700">{formatDuration(a.minutes)}</td>
                <td className="px-4 py-2 text-gray-400 truncate max-w-[200px]">{a.reason}</td>
                <td className="px-4 py-2">
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[a.status] || ''}`}>
                    {a.status}
                  </span>
                </td>
                {isAdmin && (
                  <td className="px-4 py-2">
                    {a.status === 'PENDING' && (
                      <div className="flex gap-2">
                        <button onClick={() => onReview(a.id, 'APPROVED')}
                          className="text-green-600 hover:text-green-800 text-xs font-medium">
                          Approve
                        </button>
                        <button onClick={() => onReview(a.id, 'REJECTED')}
                          className="text-red-500 hover:text-red-700 text-xs font-medium">
                          Reject
                        </button>
                      </div>
                    )}
                    {a.status !== 'PENDING' && a.reviewedBy && (
                      <span className="text-xs text-gray-400">by {a.reviewedBy.name}</span>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {pagination && pagination.totalPages > 1 && (
        <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
          <span>Page {pagination.page} of {pagination.totalPages}</span>
          <div className="flex gap-2">
            <button onClick={() => onPageChange(pagination.page - 1)} disabled={pagination.page <= 1}
              className="px-3 py-1 rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-30">Prev</button>
            <button onClick={() => onPageChange(pagination.page + 1)} disabled={pagination.page >= pagination.totalPages}
              className="px-3 py-1 rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-30">Next</button>
          </div>
        </div>
      )}
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

function RateConfigModal({ staff, onClose, onSaved }: {
  staff: StaffClockOverview;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [dailyRate, setDailyRate] = useState(staff.staffDailyRate?.toString() || '');
  const [dailyHours, setDailyHours] = useState(staff.staffDailyHours?.toString() || '8');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.setStaffRate({
        humanId: staff.id,
        staffDailyRate: dailyRate ? parseFloat(dailyRate) : undefined,
        staffDailyHours: dailyHours ? parseFloat(dailyHours) : undefined,
      });
      onSaved();
      onClose();
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-xl p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-gray-900 mb-1">Set Rate — {staff.name}</h3>
        <p className="text-xs text-gray-400 mb-4">Hourly rate = daily rate / daily hours</p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-500">Daily Rate (USD)</label>
            <input type="number" step="0.01" min="0" value={dailyRate} onChange={(e) => setDailyRate(e.target.value)}
              className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm" placeholder="e.g. 25" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500">Daily Hours Quota</label>
            <input type="number" step="0.5" min="1" max="24" value={dailyHours} onChange={(e) => setDailyHours(e.target.value)}
              className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm" placeholder="e.g. 8" />
          </div>
          {dailyRate && dailyHours && parseFloat(dailyHours) > 0 && (
            <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded">
              Hourly rate: {formatMoney(parseFloat(dailyRate) / parseFloat(dailyHours))}
            </div>
          )}
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function StaffOverview({ staff, onViewShifts, onEditRate }: {
  staff: StaffClockOverview[];
  onViewShifts: (id: string, name: string) => void;
  onEditRate: (s: StaffClockOverview) => void;
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
            <th className="px-4 py-2">Daily Rate</th>
            <th className="px-4 py-2">Hours/Day</th>
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
              <td className="px-4 py-2 text-gray-700">
                {s.staffDailyRate != null ? formatMoney(s.staffDailyRate) : '—'}
              </td>
              <td className="px-4 py-2 text-gray-700">
                {s.staffDailyHours != null ? `${s.staffDailyHours}h` : '—'}
              </td>
              <td className="px-4 py-2">
                <div className="flex gap-3">
                  <button
                    onClick={() => onViewShifts(s.id, s.name)}
                    className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                  >
                    View Shifts
                  </button>
                  <button
                    onClick={() => onEditRate(s)}
                    className="text-gray-500 hover:text-gray-700 text-xs font-medium"
                  >
                    Set Rate
                  </button>
                </div>
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

  // Payment state
  const [payments, setPayments] = useState<StaffPayment[]>([]);
  const [paymentPagination, setPaymentPagination] = useState<Pagination | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  // Balance state
  const [balance, setBalance] = useState<StaffBalance | null>(null);

  // Adjustments state
  const [adjustments, setAdjustments] = useState<HoursAdjustment[]>([]);
  const [adjPagination, setAdjPagination] = useState<Pagination | null>(null);

  // Rate config modal
  const [rateConfigStaff, setRateConfigStaff] = useState<StaffClockOverview | null>(null);

  const effectiveHumanId = viewingStaffId || undefined;

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

  const loadPayments = useCallback(async (page = 1, humanId?: string) => {
    try {
      const res = await api.getPayments({ page, limit: 10, humanId });
      setPayments(res.payments);
      setPaymentPagination(res.pagination);
    } catch {
      // ignore
    }
  }, []);

  const loadBalance = useCallback(async (humanId?: string) => {
    try {
      const res = await api.getBalance({ humanId });
      setBalance(res);
    } catch {
      setBalance(null);
    }
  }, []);

  const loadAdjustments = useCallback(async (page = 1, humanId?: string) => {
    try {
      const res = await api.getAdjustments({ page, limit: 10, humanId });
      setAdjustments(res.adjustments);
      setAdjPagination(res.pagination);
    } catch {
      // ignore
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

  const loadAll = useCallback((humanId?: string) => {
    loadData(1, humanId);
    loadPayments(1, humanId);
    loadBalance(humanId);
    loadAdjustments(1, humanId);
  }, [loadData, loadPayments, loadBalance, loadAdjustments]);

  useEffect(() => {
    loadAll();
    loadStaffOverview();
  }, [loadAll, loadStaffOverview]);

  const handleToggle = async () => {
    setToggleLoading(true);
    try {
      if (status?.clockedIn) {
        await api.clockOut();
      } else {
        await api.clockIn();
      }
      loadAll(effectiveHumanId);
      loadStaffOverview();
    } catch {
      // ignore
    } finally {
      setToggleLoading(false);
    }
  };

  const handlePageChange = (page: number) => {
    loadData(page, effectiveHumanId);
  };

  const handleViewShifts = (staffId: string, name: string) => {
    setViewingStaffId(staffId);
    setViewingStaffName(name);
    loadAll(staffId);
  };

  const handleBackToOwnShifts = () => {
    setViewingStaffId(null);
    setViewingStaffName(null);
    loadAll();
  };

  const handleDeletePayment = async (id: string) => {
    try {
      await api.deletePayment(id);
      loadPayments(1, effectiveHumanId);
      loadBalance(effectiveHumanId);
    } catch {
      // ignore
    }
  };

  const handleSubmitAdjustment = async (data: { date: string; minutes: number; reason: string }) => {
    try {
      await api.createAdjustment(data);
      loadAdjustments(1, effectiveHumanId);
      loadBalance(effectiveHumanId);
    } catch {
      // ignore
    }
  };

  const handleReviewAdjustment = async (id: string, status: 'APPROVED' | 'REJECTED') => {
    try {
      await api.reviewAdjustment(id, status);
      loadAdjustments(1, effectiveHumanId);
      loadBalance(effectiveHumanId);
    } catch {
      // ignore
    }
  };

  const targetHumanId = viewingStaffId || '';

  return (
    <div>
      <ClockWidget status={status} onToggle={handleToggle} loading={toggleLoading} />
      <SummaryCards summary={summary} />
      <BalanceCard balance={balance} />

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

      <PaymentLog
        payments={payments}
        pagination={paymentPagination}
        onPageChange={(p) => loadPayments(p, effectiveHumanId)}
        isAdmin={isAdmin}
        onAdd={() => setShowPaymentModal(true)}
        onDelete={handleDeletePayment}
      />

      <HoursAdjustments
        adjustments={adjustments}
        pagination={adjPagination}
        onPageChange={(p) => loadAdjustments(p, effectiveHumanId)}
        isAdmin={isAdmin}
        onSubmit={handleSubmitAdjustment}
        onReview={handleReviewAdjustment}
      />

      <RecentShifts
        entries={entries}
        pagination={pagination}
        onPageChange={handlePageChange}
        viewingStaff={viewingStaffName || undefined}
      />

      {isAdmin && !viewingStaffId && (
        <StaffOverview
          staff={allStaff}
          onViewShifts={handleViewShifts}
          onEditRate={(s) => setRateConfigStaff(s)}
        />
      )}

      {showPaymentModal && targetHumanId && (
        <AddPaymentModal
          humanId={targetHumanId}
          onClose={() => setShowPaymentModal(false)}
          onSaved={() => {
            loadPayments(1, effectiveHumanId);
            loadBalance(effectiveHumanId);
          }}
        />
      )}

      {rateConfigStaff && (
        <RateConfigModal
          staff={rateConfigStaff}
          onClose={() => setRateConfigStaff(null)}
          onSaved={() => {
            loadStaffOverview();
            loadBalance(effectiveHumanId);
          }}
        />
      )}
    </div>
  );
}
