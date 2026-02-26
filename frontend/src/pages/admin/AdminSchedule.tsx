import { useState, useEffect, useCallback } from 'react';
import { api } from '../../lib/api';
import toast from 'react-hot-toast';
import type {
  ScheduleEntry,
  ScheduleStats,
  PublishPlatform,
  PublicationStatusType,
} from '../../types/admin';

const PLATFORM_LABELS: Record<PublishPlatform, string> = {
  TIKTOK: 'TikTok', YOUTUBE: 'YouTube', INSTAGRAM: 'Instagram',
  LINKEDIN: 'LinkedIn', TWITTER: 'Twitter/X', FACEBOOK: 'Facebook', BLOG: 'Blog',
};

const PLATFORM_ICONS: Record<PublishPlatform, string> = {
  TIKTOK: 'T', YOUTUBE: 'Y', INSTAGRAM: 'I',
  LINKEDIN: 'in', TWITTER: 'X', FACEBOOK: 'f', BLOG: 'B',
};

const STATUS_COLORS: Record<PublicationStatusType, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  SCHEDULED: 'bg-blue-100 text-blue-700',
  PUBLISHING: 'bg-yellow-100 text-yellow-700',
  PUBLISHED: 'bg-green-100 text-green-700',
  FAILED: 'bg-red-100 text-red-700',
  CANCELLED: 'bg-gray-200 text-gray-500',
};

const STATUS_DOT_COLORS: Record<PublicationStatusType, string> = {
  DRAFT: 'bg-gray-400',
  SCHEDULED: 'bg-blue-500',
  PUBLISHING: 'bg-yellow-500',
  PUBLISHED: 'bg-green-500',
  FAILED: 'bg-red-500',
  CANCELLED: 'bg-gray-300',
};

function Badge({ label, className }: { label: string; className: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${className}`}>
      {label}
    </span>
  );
}

function PlatformBadge({ platform }: { platform: PublishPlatform }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-purple-50 text-purple-700">
      <span className="font-bold">{PLATFORM_ICONS[platform]}</span>
      {PLATFORM_LABELS[platform]}
    </span>
  );
}

function MarkPublishedModal({ entry, onClose, onDone }: { entry: ScheduleEntry; onClose: () => void; onDone: () => void }) {
  const [url, setUrl] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    setSaving(true);
    try {
      await api.markPublished(entry.id, { publishedUrl: url || undefined });
      onDone();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold mb-4">Mark as Published</h3>
        <p className="text-sm text-gray-600 mb-4">
          {entry.title || entry.video?.title || entry.contentItem?.sourceTitle || 'Untitled'}
        </p>
        <label className="block text-sm font-medium text-gray-700 mb-1">Published URL (optional)</label>
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://..."
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm mb-4"
        />
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-md border">Cancel</button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="px-4 py-2 text-sm rounded-md bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Confirm Published'}
          </button>
        </div>
      </div>
    </div>
  );
}

function getEntryTitle(entry: ScheduleEntry): string {
  if (entry.title) return entry.title;
  if (entry.video) return entry.video.title;
  if (entry.contentItem) return entry.contentItem.blogTitle || entry.contentItem.sourceTitle;
  return 'Untitled';
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

function groupByDate(entries: ScheduleEntry[], dateField: 'scheduledAt' | 'publishedAt'): Map<string, ScheduleEntry[]> {
  const groups = new Map<string, ScheduleEntry[]>();
  for (const entry of entries) {
    const dateVal = entry[dateField] || entry.scheduledAt || entry.createdAt;
    const key = new Date(dateVal).toDateString();
    const existing = groups.get(key) || [];
    existing.push(entry);
    groups.set(key, existing);
  }
  return groups;
}

// Inline reschedule component
function InlineReschedule({ entry, onDone }: { entry: ScheduleEntry; onDone: () => void }) {
  const [editing, setEditing] = useState(false);
  const [datetime, setDatetime] = useState(
    entry.scheduledAt ? new Date(entry.scheduledAt).toISOString().slice(0, 16) : ''
  );
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!datetime) return;
    setSaving(true);
    try {
      await api.updateScheduleEntry(entry.id, {
        scheduledAt: new Date(datetime).toISOString(),
        status: 'SCHEDULED',
      });
      toast.success('Rescheduled');
      setEditing(false);
      onDone();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="text-xs text-gray-500 hover:text-blue-600 hover:underline cursor-pointer"
        title="Click to reschedule"
      >
        {entry.scheduledAt ? formatTime(entry.scheduledAt) : '--:--'}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <input
        type="datetime-local"
        value={datetime}
        onChange={(e) => setDatetime(e.target.value)}
        min={new Date().toISOString().slice(0, 16)}
        className="border border-gray-300 rounded px-2 py-1 text-xs w-44"
        autoFocus
      />
      <button
        onClick={handleSave}
        disabled={saving || !datetime}
        className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
      >
        Save
      </button>
      <button
        onClick={() => setEditing(false)}
        className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700"
      >
        Cancel
      </button>
    </div>
  );
}

export default function AdminSchedule() {
  const [entries, setEntries] = useState<ScheduleEntry[]>([]);
  const [stats, setStats] = useState<ScheduleStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [platformFilter, setPlatformFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [publishEntry, setPublishEntry] = useState<ScheduleEntry | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      api.getSchedule({
        page,
        limit: 100,
        platform: platformFilter || undefined,
        status: statusFilter || undefined,
      }),
      api.getScheduleStats(),
    ])
      .then(([schedRes, statsRes]) => {
        setEntries(schedRes.entries);
        setTotalPages(schedRes.pagination.totalPages);
        setStats(statsRes);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [page, platformFilter, statusFilter]);

  useEffect(() => { load(); }, [load]);

  const now = new Date();
  const upcoming = entries
    .filter((e) => e.status === 'SCHEDULED' || (e.status === 'PUBLISHING' && e.scheduledAt && new Date(e.scheduledAt) > now))
    .sort((a, b) => new Date(a.scheduledAt!).getTime() - new Date(b.scheduledAt!).getTime());

  const past = entries
    .filter((e) => e.status === 'PUBLISHED' || e.status === 'FAILED' || e.status === 'CANCELLED' ||
      (e.scheduledAt && new Date(e.scheduledAt) <= now && e.status !== 'SCHEDULED'))
    .sort((a, b) => {
      const aDate = a.publishedAt || a.scheduledAt || a.createdAt;
      const bDate = b.publishedAt || b.scheduledAt || b.createdAt;
      return new Date(bDate).getTime() - new Date(aDate).getTime();
    });

  const upcomingGroups = groupByDate(upcoming, 'scheduledAt');
  const pastGroups = groupByDate(past, 'publishedAt');

  const handleCancel = async (id: string) => {
    try {
      await api.updateScheduleEntry(id, { status: 'CANCELLED' });
      toast.success('Cancelled');
      load();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const failedCount = stats?.byStatus.FAILED || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <h2 className="text-lg font-semibold text-gray-900">Publication Timeline</h2>

      {/* Stats bar */}
      {stats && (
        <div className={`grid gap-3 ${failedCount > 0 ? 'grid-cols-3' : 'grid-cols-2'}`}>
          <div className="bg-white rounded-lg border p-3">
            <p className="text-2xl font-bold text-blue-600">{stats.upcoming}</p>
            <p className="text-xs text-gray-500">Upcoming</p>
          </div>
          <div className="bg-white rounded-lg border p-3">
            <p className="text-2xl font-bold text-green-600">{stats.byStatus.PUBLISHED || 0}</p>
            <p className="text-xs text-gray-500">Published</p>
          </div>
          {failedCount > 0 && (
            <div className="bg-white rounded-lg border p-3">
              <p className="text-2xl font-bold text-red-600">{failedCount}</p>
              <p className="text-xs text-gray-500">Failed</p>
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <select
          value={platformFilter}
          onChange={(e) => { setPlatformFilter(e.target.value); setPage(1); }}
          className="border border-gray-300 rounded-md px-3 py-1.5 text-sm"
        >
          <option value="">All Platforms</option>
          {Object.entries(PLATFORM_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="border border-gray-300 rounded-md px-3 py-1.5 text-sm"
        >
          <option value="">All Statuses</option>
          {(['SCHEDULED', 'PUBLISHING', 'PUBLISHED', 'FAILED', 'CANCELLED'] as const).map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="text-gray-500 text-sm">Loading...</p>
      ) : entries.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-400 text-sm">No scheduled publications yet.</p>
          <p className="text-gray-400 text-xs mt-1">Schedule content from the Content Manager.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Upcoming section */}
          {upcoming.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Upcoming</h3>
              <div className="space-y-6">
                {Array.from(upcomingGroups.entries()).map(([dateKey, groupEntries]) => (
                  <div key={dateKey}>
                    <div className="text-xs font-medium text-gray-400 mb-2 pl-6">
                      {formatDateLabel(groupEntries[0].scheduledAt!)}
                    </div>
                    <div className="space-y-0">
                      {groupEntries.map((entry) => (
                        <TimelineEntry
                          key={entry.id}
                          entry={entry}
                          isUpcoming
                          onMarkPublished={setPublishEntry}
                          onCancel={handleCancel}
                          onReschedule={load}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Past section */}
          {past.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Past</h3>
              <div className="space-y-6">
                {Array.from(pastGroups.entries()).map(([dateKey, groupEntries]) => {
                  const refDate = groupEntries[0].publishedAt || groupEntries[0].scheduledAt || groupEntries[0].createdAt;
                  return (
                    <div key={dateKey}>
                      <div className="text-xs font-medium text-gray-400 mb-2 pl-6">
                        {formatDateLabel(refDate)}
                      </div>
                      <div className="space-y-0">
                        {groupEntries.map((entry) => (
                          <TimelineEntry
                            key={entry.id}
                            entry={entry}
                            isUpcoming={false}
                            onMarkPublished={setPublishEntry}
                            onCancel={handleCancel}
                            onReschedule={load}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1 text-sm rounded border disabled:opacity-50">Prev</button>
          <span className="px-3 py-1 text-sm text-gray-600">Page {page} of {totalPages}</span>
          <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-3 py-1 text-sm rounded border disabled:opacity-50">Next</button>
        </div>
      )}

      {publishEntry && (
        <MarkPublishedModal
          entry={publishEntry}
          onClose={() => setPublishEntry(null)}
          onDone={() => { setPublishEntry(null); load(); }}
        />
      )}
    </div>
  );
}

function TimelineEntry({
  entry,
  isUpcoming,
  onMarkPublished,
  onCancel,
  onReschedule,
}: {
  entry: ScheduleEntry;
  isUpcoming: boolean;
  onMarkPublished: (e: ScheduleEntry) => void;
  onCancel: (id: string) => void;
  onReschedule: () => void;
}) {
  return (
    <div className="flex items-start gap-3 py-2.5 px-1 group">
      {/* Timeline dot and line */}
      <div className="flex flex-col items-center pt-1">
        <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${STATUS_DOT_COLORS[entry.status]}`} />
        <div className="w-px h-full bg-gray-200 mt-1" />
      </div>

      {/* Time */}
      <div className="w-16 flex-shrink-0 pt-0.5">
        {isUpcoming && entry.status === 'SCHEDULED' ? (
          <InlineReschedule entry={entry} onDone={onReschedule} />
        ) : (
          <span className="text-xs text-gray-500">
            {entry.publishedAt ? formatTime(entry.publishedAt) : entry.scheduledAt ? formatTime(entry.scheduledAt) : '--:--'}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-gray-900 truncate">{getEntryTitle(entry)}</span>
          <PlatformBadge platform={entry.platform} />
          <Badge label={entry.status} className={STATUS_COLORS[entry.status]} />
        </div>
        {entry.contentItem && (
          <p className="text-xs text-gray-400 mt-0.5 truncate">
            {entry.contentItem.sourceTitle}
          </p>
        )}
        {entry.publishedUrl && (
          <a href={entry.publishedUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline mt-0.5 inline-block">
            View published
          </a>
        )}
        {entry.errorMessage && (
          <p className="text-xs text-red-600 mt-0.5">{entry.errorMessage}</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-1.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        {entry.status !== 'PUBLISHED' && entry.status !== 'CANCELLED' && (
          <>
            <button
              onClick={() => onMarkPublished(entry)}
              className="px-2.5 py-1 text-xs rounded bg-green-50 text-green-700 hover:bg-green-100 font-medium"
            >
              Mark Published
            </button>
            <button
              onClick={() => onCancel(entry.id)}
              className="px-2.5 py-1 text-xs rounded bg-gray-50 text-gray-600 hover:bg-gray-100"
            >
              Cancel
            </button>
          </>
        )}
      </div>
    </div>
  );
}
