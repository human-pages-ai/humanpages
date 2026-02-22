import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { useAdminRole } from '../../hooks/useAdminRole';
import type { StaffCapability, TaskSummary, ContentItem, PostingGroup, ClockStatus } from '../../types/admin';

const CAP_META: Record<StaffCapability, { label: string; description: string; link: string; color: string }> = {
  CONTENT_REVIEWER: { label: 'Content Review', description: 'Review and approve draft content', link: '/admin/content', color: 'blue' },
  POSTER: { label: 'Posting Queue', description: 'Post to groups and communities', link: '/admin/posting', color: 'green' },
  ANALYST: { label: 'Analytics', description: 'Review performance metrics', link: '#', color: 'purple' },
  CREATIVE: { label: 'Creative', description: 'Create ad copy and visuals', link: '/admin/ad-copy', color: 'pink' },
  GROUP_MANAGER: { label: 'Group Management', description: 'Manage posting groups', link: '/admin/posting', color: 'orange' },
};

const COLOR_MAP: Record<string, { bg: string; badge: string; text: string; border: string }> = {
  blue: { bg: 'bg-blue-50', badge: 'bg-blue-100 text-blue-700', text: 'text-blue-700', border: 'border-blue-200' },
  green: { bg: 'bg-green-50', badge: 'bg-green-100 text-green-700', text: 'text-green-700', border: 'border-green-200' },
  purple: { bg: 'bg-purple-50', badge: 'bg-purple-100 text-purple-700', text: 'text-purple-700', border: 'border-purple-200' },
  pink: { bg: 'bg-pink-50', badge: 'bg-pink-100 text-pink-700', text: 'text-pink-700', border: 'border-pink-200' },
  orange: { bg: 'bg-orange-50', badge: 'bg-orange-100 text-orange-700', text: 'text-orange-700', border: 'border-orange-200' },
};

function CompactClock() {
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

function TaskCard({ cap, count, preview }: {
  cap: StaffCapability;
  count: number;
  preview?: React.ReactNode;
}) {
  const meta = CAP_META[cap];
  const colors = COLOR_MAP[meta.color];

  return (
    <div className={`bg-white border ${colors.border} rounded-xl p-5`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-base font-semibold text-gray-900">{meta.label}</h3>
          <p className="text-sm text-gray-500 mt-0.5">{meta.description}</p>
        </div>
        {count > 0 && (
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium ${colors.badge}`}>
            {count}
          </span>
        )}
      </div>
      {preview && <div className="mb-3">{preview}</div>}
      <Link
        to={meta.link}
        className={`text-sm font-medium ${colors.text} hover:underline`}
      >
        {count > 0 ? `View ${count} pending` : 'Go to section'} &rarr;
      </Link>
    </div>
  );
}

export default function TaskCentral() {
  const { capabilities } = useAdminRole();
  const [summary, setSummary] = useState<TaskSummary | null>(null);
  const [contentPreview, setContentPreview] = useState<ContentItem[]>([]);
  const [postingPreview, setPostingPreview] = useState<PostingGroup[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const taskRes = await api.getTaskSummary();
        setSummary(taskRes);

        if (capabilities.includes('CONTENT_REVIEWER')) {
          api.getContentItems({ limit: 3, status: 'DRAFT' })
            .then((res) => setContentPreview(res.items))
            .catch(() => {});
        }
        if (capabilities.includes('POSTER')) {
          api.getPostingGroups({ limit: 3, status: 'PENDING' })
            .then((res) => setPostingPreview(res.groups))
            .catch(() => {});
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [capabilities]);

  if (loading) {
    return <div className="text-center py-12 text-gray-500">Loading tasks...</div>;
  }

  if (capabilities.length === 0) {
    return (
      <div>
        <CompactClock />
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 text-center">
          <h2 className="text-lg font-semibold text-yellow-800 mb-2">No capabilities assigned</h2>
          <p className="text-sm text-yellow-700">
            Ask an admin to assign capabilities to your account so you can see your tasks here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <CompactClock />

      <h2 className="text-lg font-semibold text-gray-900 mb-4">Task Central</h2>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {capabilities.includes('CONTENT_REVIEWER') && (
          <TaskCard
            cap="CONTENT_REVIEWER"
            count={summary?.summary.CONTENT_REVIEWER ?? 0}
            preview={contentPreview.length > 0 ? (
              <ul className="space-y-1">
                {contentPreview.map((c) => (
                  <li key={c.id} className="text-xs text-gray-600 truncate">
                    <span className={`inline-block w-14 text-center px-1 py-0.5 rounded text-[10px] font-medium mr-1.5 ${
                      c.status === 'DRAFT' ? 'bg-gray-100 text-gray-600' : 'bg-blue-100 text-blue-700'
                    }`}>{c.status}</span>
                    {c.sourceTitle}
                  </li>
                ))}
              </ul>
            ) : undefined}
          />
        )}

        {capabilities.includes('POSTER') && (
          <TaskCard
            cap="POSTER"
            count={summary?.summary.POSTER ?? 0}
            preview={postingPreview.length > 0 ? (
              <ul className="space-y-1">
                {postingPreview.map((g) => (
                  <li key={g.id} className="text-xs text-gray-600 truncate">
                    <span className="inline-block w-14 text-center px-1 py-0.5 rounded text-[10px] font-medium mr-1.5 bg-yellow-100 text-yellow-700">
                      {g.taskType}
                    </span>
                    {g.name}
                  </li>
                ))}
              </ul>
            ) : undefined}
          />
        )}

        {capabilities.includes('ANALYST') && (
          <TaskCard cap="ANALYST" count={summary?.summary.ANALYST ?? 0} />
        )}

        {capabilities.includes('CREATIVE') && (
          <TaskCard cap="CREATIVE" count={summary?.summary.CREATIVE ?? 0} />
        )}

        {capabilities.includes('GROUP_MANAGER') && (
          <TaskCard cap="GROUP_MANAGER" count={summary?.summary.GROUP_MANAGER ?? 0} />
        )}
      </div>
    </div>
  );
}
