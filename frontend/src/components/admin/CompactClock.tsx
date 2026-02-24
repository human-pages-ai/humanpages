import { useState, useEffect, useRef } from 'react';
import { api } from '../../lib/api';
import type { ClockStatus } from '../../types/admin';

export default function CompactClock() {
  const [status, setStatus] = useState<ClockStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [elapsed, setElapsed] = useState('');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    api.getClockStatus().then(setStatus).catch(() => {});
  }, []);

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

  const toggle = async () => {
    setLoading(true);
    try {
      if (status?.clockedIn) {
        const res = await api.clockOut();
        setStatus({ clockedIn: res.clockedIn, since: null, entryId: null });
      } else {
        const res = await api.clockIn();
        setStatus(res);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const clockedIn = status?.clockedIn ?? false;

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className={`w-2.5 h-2.5 rounded-full ${clockedIn ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`} />
        <span className="text-sm font-medium text-gray-900">
          {clockedIn ? 'Clocked In' : 'Clocked Out'}
        </span>
        {clockedIn && elapsed && (
          <span className="text-lg font-mono font-bold text-gray-900">{elapsed}</span>
        )}
      </div>
      <button
        onClick={toggle}
        disabled={loading}
        className={`px-4 py-2 rounded-lg text-sm font-semibold text-white transition-colors ${
          clockedIn ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'
        } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        {clockedIn ? 'Clock Out' : 'Clock In'}
      </button>
    </div>
  );
}
