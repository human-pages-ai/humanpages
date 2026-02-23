import { useState, useEffect, useCallback } from 'react';
import { api } from '../../lib/api';
import type {
  ScheduleEntry,
  ScheduleStats,
  PublishPlatform,
  PublicationStatusType,
  PublishContentType,
} from '../../types/admin';

const PLATFORM_LABELS: Record<PublishPlatform, string> = {
  TIKTOK: 'TikTok', YOUTUBE: 'YouTube', INSTAGRAM: 'Instagram',
  LINKEDIN: 'LinkedIn', TWITTER: 'Twitter/X', FACEBOOK: 'Facebook', BLOG: 'Blog',
};

const PLATFORM_ICONS: Record<PublishPlatform, string> = {
  TIKTOK: 'T', YOUTUBE: 'Y', INSTAGRAM: 'I',
  LINKEDIN: 'in', TWITTER: 'X', FACEBOOK: 'f', BLOG: 'B',
};

const CONTENT_TYPE_ICONS: Record<PublishContentType, string> = {
  VIDEO: 'V', ARTICLE: 'A', SHORT_POST: 'S', IMAGE_POST: 'I',
};

const STATUS_COLORS: Record<PublicationStatusType, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  SCHEDULED: 'bg-blue-100 text-blue-700',
  PUBLISHING: 'bg-yellow-100 text-yellow-700',
  PUBLISHED: 'bg-green-100 text-green-700',
  FAILED: 'bg-red-100 text-red-700',
  CANCELLED: 'bg-gray-200 text-gray-500',
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

function CreateEntryModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [form, setForm] = useState({
    title: '',
    body: '',
    platform: 'TIKTOK' as PublishPlatform,
    contentType: 'SHORT_POST' as PublishContentType,
    scheduledAt: '',
    isAuto: false,
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    setSaving(true);
    try {
      await api.createScheduleEntry({
        ...form,
        scheduledAt: form.scheduledAt ? new Date(form.scheduledAt).toISOString() : undefined,
        status: form.scheduledAt ? 'SCHEDULED' : 'DRAFT',
      });
      onDone();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full mx-4 p-6 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold mb-4">New Schedule Entry</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Body</label>
            <textarea
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
              rows={3}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Platform</label>
              <select
                value={form.platform}
                onChange={(e) => setForm({ ...form, platform: e.target.value as PublishPlatform })}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              >
                {Object.entries(PLATFORM_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Content Type</label>
              <select
                value={form.contentType}
                onChange={(e) => setForm({ ...form, contentType: e.target.value as PublishContentType })}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              >
                <option value="VIDEO">Video</option>
                <option value="ARTICLE">Article</option>
                <option value="SHORT_POST">Short Post</option>
                <option value="IMAGE_POST">Image Post</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Scheduled At</label>
            <input
              type="datetime-local"
              value={form.scheduledAt}
              onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.isAuto}
              onChange={(e) => setForm({ ...form, isAuto: e.target.checked })}
            />
            Auto-publish via API
          </label>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-md border">Cancel</button>
          <button
            onClick={handleSubmit}
            disabled={saving || !form.title}
            className="px-4 py-2 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Creating...' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}

function EntryTitle({ entry }: { entry: ScheduleEntry }) {
  if (entry.title) return <>{entry.title}</>;
  if (entry.video) return <>{entry.video.title}</>;
  if (entry.contentItem) return <>{entry.contentItem.blogTitle || entry.contentItem.sourceTitle}</>;
  return <span className="text-gray-400 italic">Untitled</span>;
}

export default function AdminSchedule() {
  const [entries, setEntries] = useState<ScheduleEntry[]>([]);
  const [stats, setStats] = useState<ScheduleStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [platformFilter, setPlatformFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [contentTypeFilter, setContentTypeFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [publishEntry, setPublishEntry] = useState<ScheduleEntry | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      api.getSchedule({
        page,
        platform: platformFilter || undefined,
        status: statusFilter || undefined,
        contentType: contentTypeFilter || undefined,
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
  }, [page, platformFilter, statusFilter, contentTypeFilter]);

  useEffect(() => { load(); }, [load]);

  const now = new Date();
  const upcoming = entries.filter((e) => e.scheduledAt && new Date(e.scheduledAt) > now && e.status !== 'PUBLISHED' && e.status !== 'CANCELLED');
  const past = entries.filter((e) => e.publishedAt || (e.scheduledAt && new Date(e.scheduledAt) <= now) || e.status === 'PUBLISHED');
  const other = entries.filter((e) => !upcoming.includes(e) && !past.includes(e));

  const handleCancel = async (id: string) => {
    try {
      await api.updateScheduleEntry(id, { status: 'CANCELLED' });
      load();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Publication Schedule</h2>
        <button
          onClick={() => setShowCreate(true)}
          className="px-4 py-2 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700"
        >
          + New Entry
        </button>
      </div>

      {/* Stats bar */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white rounded-lg border p-3">
            <p className="text-2xl font-bold text-blue-600">{stats.upcoming}</p>
            <p className="text-xs text-gray-500">Upcoming</p>
          </div>
          <div className="bg-white rounded-lg border p-3">
            <p className="text-2xl font-bold text-green-600">{stats.byStatus.PUBLISHED || 0}</p>
            <p className="text-xs text-gray-500">Published</p>
          </div>
          <div className="bg-white rounded-lg border p-3">
            <p className="text-2xl font-bold text-gray-600">{stats.byStatus.DRAFT || 0}</p>
            <p className="text-xs text-gray-500">Drafts</p>
          </div>
          <div className="bg-white rounded-lg border p-3">
            <p className="text-2xl font-bold text-red-600">{stats.byStatus.FAILED || 0}</p>
            <p className="text-xs text-gray-500">Failed</p>
          </div>
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
          value={contentTypeFilter}
          onChange={(e) => { setContentTypeFilter(e.target.value); setPage(1); }}
          className="border border-gray-300 rounded-md px-3 py-1.5 text-sm"
        >
          <option value="">All Types</option>
          <option value="VIDEO">Video</option>
          <option value="ARTICLE">Article</option>
          <option value="SHORT_POST">Short Post</option>
          <option value="IMAGE_POST">Image Post</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="border border-gray-300 rounded-md px-3 py-1.5 text-sm"
        >
          <option value="">All Statuses</option>
          {(['DRAFT', 'SCHEDULED', 'PUBLISHING', 'PUBLISHED', 'FAILED', 'CANCELLED'] as const).map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="text-gray-500 text-sm">Loading...</p>
      ) : entries.length === 0 ? (
        <p className="text-gray-500 text-sm">No schedule entries found.</p>
      ) : (
        <div className="space-y-6">
          {/* Upcoming section */}
          {upcoming.length > 0 && (
            <Section title="Upcoming" entries={upcoming} onPublish={setPublishEntry} onCancel={handleCancel} />
          )}
          {/* Past / Published */}
          {past.length > 0 && (
            <Section title="Published / Past" entries={past} onPublish={setPublishEntry} onCancel={handleCancel} />
          )}
          {/* Other (drafts, etc.) */}
          {other.length > 0 && (
            <Section title="Drafts & Other" entries={other} onPublish={setPublishEntry} onCancel={handleCancel} />
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
      {showCreate && (
        <CreateEntryModal
          onClose={() => setShowCreate(false)}
          onDone={() => { setShowCreate(false); load(); }}
        />
      )}
    </div>
  );
}

function Section({
  title,
  entries,
  onPublish,
  onCancel,
}: {
  title: string;
  entries: ScheduleEntry[];
  onPublish: (e: ScheduleEntry) => void;
  onCancel: (id: string) => void;
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">{title}</h3>
      <div className="space-y-2">
        {entries.map((entry) => (
          <div key={entry.id} className="bg-white rounded-lg border p-4 flex items-start gap-4">
            {/* Content type icon */}
            <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-600 flex-shrink-0">
              {CONTENT_TYPE_ICONS[entry.contentType]}
            </div>

            {/* Main content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-medium text-gray-900 truncate">
                  <EntryTitle entry={entry} />
                </p>
                <PlatformBadge platform={entry.platform} />
                <Badge label={entry.status} className={STATUS_COLORS[entry.status]} />
                {entry.isAuto ? (
                  <Badge label="Auto" className="bg-indigo-100 text-indigo-700" />
                ) : (
                  <Badge label="Manual" className="bg-amber-100 text-amber-700" />
                )}
              </div>

              <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                {entry.scheduledAt && (
                  <span>Scheduled: {new Date(entry.scheduledAt).toLocaleString()}</span>
                )}
                {entry.publishedAt && (
                  <span>Published: {new Date(entry.publishedAt).toLocaleString()}</span>
                )}
                {entry.assignedTo && (
                  <span>Assigned: {entry.assignedTo.name}</span>
                )}
              </div>

              {entry.publishedUrl && (
                <a href={entry.publishedUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline mt-1 inline-block">
                  View published
                </a>
              )}
              {entry.errorMessage && (
                <p className="text-xs text-red-600 mt-1">{entry.errorMessage}</p>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-2 flex-shrink-0">
              {entry.status !== 'PUBLISHED' && entry.status !== 'CANCELLED' && (
                <button
                  onClick={() => onPublish(entry)}
                  className="px-3 py-1.5 text-xs rounded-md bg-green-50 text-green-700 hover:bg-green-100 font-medium"
                >
                  Mark Published
                </button>
              )}
              {entry.status !== 'PUBLISHED' && entry.status !== 'CANCELLED' && (
                <button
                  onClick={() => onCancel(entry.id)}
                  className="px-3 py-1.5 text-xs rounded-md bg-gray-50 text-gray-600 hover:bg-gray-100"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
