import { useEffect, useState, useCallback } from 'react';
import { api } from '../../lib/api';
import type { PostingGroup, PostingGroupStatus, AdCopy, Pagination } from '../../types/admin';

const STATUS_OPTIONS: PostingGroupStatus[] = ['PENDING', 'JOINED', 'POSTED', 'REJECTED', 'SKIPPED'];

const STATUS_COLORS: Record<PostingGroupStatus, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  JOINED: 'bg-blue-100 text-blue-800',
  POSTED: 'bg-green-100 text-green-800',
  REJECTED: 'bg-red-100 text-red-800',
  SKIPPED: 'bg-gray-100 text-gray-800',
};

const LANG_FLAGS: Record<string, string> = {
  en: '\u{1F1FA}\u{1F1F8}',
  es: '\u{1F1EA}\u{1F1F8}',
  pt: '\u{1F1E7}\u{1F1F7}',
  fr: '\u{1F1EB}\u{1F1F7}',
  de: '\u{1F1E9}\u{1F1EA}',
  it: '\u{1F1EE}\u{1F1F9}',
  tl: '\u{1F1F5}\u{1F1ED}',
  vi: '\u{1F1FB}\u{1F1F3}',
  th: '\u{1F1F9}\u{1F1ED}',
  hi: '\u{1F1EE}\u{1F1F3}',
  zh: '\u{1F1E8}\u{1F1F3}',
  ar: '\u{1F1F8}\u{1F1E6}',
  tr: '\u{1F1F9}\u{1F1F7}',
  id: '\u{1F1EE}\u{1F1E9}',
};

export default function PostingQueue() {
  const [groups, setGroups] = useState<PostingGroup[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 50, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);

  // Filters
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterLanguage, setFilterLanguage] = useState<string>('');
  const [filterCountry, setFilterCountry] = useState<string>('');

  // Ad copy modal
  const [selectedAd, setSelectedAd] = useState<AdCopy | null>(null);
  const [adModalOpen, setAdModalOpen] = useState(false);
  const [adLoading, setAdLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Notes editing
  const [editingNotesId, setEditingNotesId] = useState<string | null>(null);
  const [editingNotesValue, setEditingNotesValue] = useState('');

  const fetchGroups = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params: any = { page, limit: 50 };
      if (filterStatus) params.status = filterStatus;
      if (filterLanguage) params.language = filterLanguage;
      if (filterCountry) params.country = filterCountry;

      const res = await api.getPostingGroups(params);
      setGroups(res.groups);
      setPagination(res.pagination);
    } catch (err) {
      console.error('Failed to fetch groups', err);
    } finally {
      setLoading(false);
    }
  }, [filterStatus, filterLanguage, filterCountry]);

  // Fetch pending count separately
  const fetchPendingCount = useCallback(async () => {
    try {
      const res = await api.getPostingGroups({ status: 'PENDING', limit: 1 });
      setPendingCount(res.pagination.total);
    } catch {}
  }, []);

  useEffect(() => {
    fetchGroups(1);
    fetchPendingCount();
  }, [fetchGroups, fetchPendingCount]);

  const handleStatusChange = async (groupId: string, newStatus: PostingGroupStatus) => {
    try {
      const updated = await api.updatePostingGroup(groupId, { status: newStatus });
      setGroups((prev) => prev.map((g) => (g.id === groupId ? { ...g, ...updated } : g)));
      fetchPendingCount();
    } catch (err) {
      console.error('Failed to update status', err);
    }
  };

  const openAdModal = async (adId: string) => {
    setAdLoading(true);
    setAdModalOpen(true);
    setCopied(false);
    try {
      const ad = await api.getAdCopy(adId);
      setSelectedAd(ad);
    } catch {
      setSelectedAd(null);
    } finally {
      setAdLoading(false);
    }
  };

  const copyAdBody = () => {
    if (selectedAd) {
      navigator.clipboard.writeText(selectedAd.body);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const startEditingNotes = (group: PostingGroup) => {
    setEditingNotesId(group.id);
    setEditingNotesValue(group.notes || '');
  };

  const saveNotes = async (groupId: string) => {
    try {
      const updated = await api.updatePostingGroup(groupId, {
        notes: editingNotesValue || null,
      });
      setGroups((prev) => prev.map((g) => (g.id === groupId ? { ...g, ...updated } : g)));
    } catch (err) {
      console.error('Failed to save notes', err);
    }
    setEditingNotesId(null);
  };

  return (
    <div>
      {/* Stats bar */}
      <div className="mb-4 flex items-center gap-4">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-2 text-sm font-medium text-yellow-800">
          {pendingCount} remaining
        </div>
        <div className="text-sm text-gray-500">
          {pagination.total} total groups matching filters
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <select
          className="border border-gray-300 rounded-md px-3 py-1.5 text-sm"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
        >
          <option value="">All Statuses</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <input
          type="text"
          placeholder="Language (e.g. en)"
          className="border border-gray-300 rounded-md px-3 py-1.5 text-sm w-36"
          value={filterLanguage}
          onChange={(e) => setFilterLanguage(e.target.value)}
        />
        <input
          type="text"
          placeholder="Country"
          className="border border-gray-300 rounded-md px-3 py-1.5 text-sm w-36"
          value={filterCountry}
          onChange={(e) => setFilterCountry(e.target.value)}
        />
        <button
          className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
          onClick={() => fetchGroups(1)}
        >
          Apply
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-sm text-gray-500 py-8 text-center">Loading...</div>
      ) : groups.length === 0 ? (
        <div className="text-sm text-gray-500 py-8 text-center">No groups found</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-gray-500">Status</th>
                <th className="px-3 py-2 text-left font-medium text-gray-500">Group Name</th>
                <th className="px-3 py-2 text-left font-medium text-gray-500">Link</th>
                <th className="px-3 py-2 text-left font-medium text-gray-500">Ad #</th>
                <th className="px-3 py-2 text-left font-medium text-gray-500">Lang</th>
                <th className="px-3 py-2 text-left font-medium text-gray-500">Country</th>
                <th className="px-3 py-2 text-left font-medium text-gray-500">Notes</th>
                <th className="px-3 py-2 text-left font-medium text-gray-500">Date Posted</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {groups.map((group) => (
                <tr key={group.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2 whitespace-nowrap">
                    <select
                      className={`text-xs font-medium rounded px-2 py-1 border-0 ${STATUS_COLORS[group.status]}`}
                      value={group.status}
                      onChange={(e) => handleStatusChange(group.id, e.target.value as PostingGroupStatus)}
                    >
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2 max-w-[200px] truncate" title={group.name}>
                    {group.name}
                  </td>
                  <td className="px-3 py-2">
                    <a
                      href={group.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 hover:underline"
                    >
                      Open
                    </a>
                  </td>
                  <td className="px-3 py-2">
                    <button
                      className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
                      onClick={() => openAdModal(group.adId)}
                    >
                      #{group.ad.adNumber}
                    </button>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {LANG_FLAGS[group.language] || ''} {group.language}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">{group.country}</td>
                  <td className="px-3 py-2 max-w-[200px]">
                    {editingNotesId === group.id ? (
                      <div className="flex gap-1">
                        <input
                          type="text"
                          className="border border-gray-300 rounded px-2 py-0.5 text-xs w-full"
                          value={editingNotesValue}
                          onChange={(e) => setEditingNotesValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveNotes(group.id);
                            if (e.key === 'Escape') setEditingNotesId(null);
                          }}
                          autoFocus
                        />
                        <button
                          className="text-xs text-blue-600 hover:text-blue-800"
                          onClick={() => saveNotes(group.id)}
                        >
                          Save
                        </button>
                      </div>
                    ) : (
                      <span
                        className="cursor-pointer text-gray-600 hover:text-gray-900 truncate block"
                        onClick={() => startEditingNotes(group)}
                        title={group.notes || 'Click to add notes'}
                      >
                        {group.notes || <span className="text-gray-400 italic">-</span>}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-gray-500 whitespace-nowrap">
                    {group.datePosted ? new Date(group.datePosted).toLocaleDateString() : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <div className="text-sm text-gray-500">
            Page {pagination.page} of {pagination.totalPages}
          </div>
          <div className="flex gap-2">
            <button
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-md disabled:opacity-50"
              disabled={pagination.page <= 1}
              onClick={() => fetchGroups(pagination.page - 1)}
            >
              Previous
            </button>
            <button
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-md disabled:opacity-50"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => fetchGroups(pagination.page + 1)}
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Ad Copy Modal */}
      {adModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setAdModalOpen(false)}>
          <div
            className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h3 className="text-lg font-semibold">
                {adLoading ? 'Loading...' : selectedAd ? `Ad #${selectedAd.adNumber} (${selectedAd.language})` : 'Ad Not Found'}
              </h3>
              <button className="text-gray-400 hover:text-gray-600 text-xl" onClick={() => setAdModalOpen(false)}>
                &times;
              </button>
            </div>
            {selectedAd && !adLoading && (
              <>
                <div className="px-6 py-4 overflow-y-auto flex-1">
                  <div className="mb-3">
                    <div className="text-xs font-medium text-gray-500 uppercase mb-1">Title</div>
                    <div className="text-sm font-medium">{selectedAd.title}</div>
                  </div>
                  <div>
                    <div className="text-xs font-medium text-gray-500 uppercase mb-1">Body</div>
                    <pre className="text-sm whitespace-pre-wrap bg-gray-50 rounded-md p-3 border">{selectedAd.body}</pre>
                  </div>
                </div>
                <div className="px-6 py-3 border-t flex justify-end">
                  <button
                    className={`px-4 py-2 text-sm rounded-md font-medium ${
                      copied
                        ? 'bg-green-600 text-white'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                    onClick={copyAdBody}
                  >
                    {copied ? 'Copied!' : 'Copy to Clipboard'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
