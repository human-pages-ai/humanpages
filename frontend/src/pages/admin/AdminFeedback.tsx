import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import type { AdminFeedback, Pagination } from '../../types/admin';

const STATUS_COLORS: Record<string, string> = {
  NEW: 'bg-blue-100 text-blue-700',
  IN_PROGRESS: 'bg-yellow-100 text-yellow-700',
  RESOLVED: 'bg-green-100 text-green-700',
  CLOSED: 'bg-gray-100 text-gray-600',
};

const TYPE_LABELS: Record<string, { label: string; icon: string }> = {
  BUG: { label: 'Bug', icon: '🐛' },
  FEATURE: { label: 'Feature', icon: '💡' },
  FEEDBACK: { label: 'Feedback', icon: '💬' },
};

const SEVERITY_COLORS: Record<string, string> = {
  low: 'bg-gray-100 text-gray-600',
  medium: 'bg-yellow-100 text-yellow-700',
  high: 'bg-orange-100 text-orange-700',
  critical: 'bg-red-100 text-red-700',
};

export default function AdminFeedback() {
  const [items, setItems] = useState<AdminFeedback[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterType, setFilterType] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  async function loadFeedback(page = 1) {
    setLoading(true);
    try {
      const res = await api.getAdminFeedback({ page, status: filterStatus || undefined, type: filterType || undefined });
      setItems(res.feedback);
      setPagination(res.pagination);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadFeedback(1);
  }, [filterStatus, filterType]);

  async function updateStatus(id: string, status: string) {
    setUpdatingId(id);
    try {
      const updated = await api.updateAdminFeedback(id, { status });
      setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...updated } : item)));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUpdatingId(null);
    }
  }

  async function updateNotes(id: string, adminNotes: string) {
    try {
      const updated = await api.updateAdminFeedback(id, { adminNotes });
      setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...updated } : item)));
    } catch {
      // Silently fail for notes
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Feedback & Bug Reports</h2>
        <span className="text-sm text-gray-500">{pagination.total} total</span>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm"
        >
          <option value="">All statuses</option>
          <option value="NEW">New</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="RESOLVED">Resolved</option>
          <option value="CLOSED">Closed</option>
        </select>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm"
        >
          <option value="">All types</option>
          <option value="BUG">Bug Reports</option>
          <option value="FEATURE">Feature Requests</option>
          <option value="FEEDBACK">General Feedback</option>
        </select>
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      {loading ? (
        <p className="text-gray-500">Loading feedback...</p>
      ) : items.length === 0 ? (
        <p className="text-gray-400 text-sm">No feedback found.</p>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const isExpanded = expanded === item.id;
            const typeInfo = TYPE_LABELS[item.type] || TYPE_LABELS.FEEDBACK;
            return (
              <div key={item.id} className="bg-white rounded-lg shadow border border-gray-100">
                {/* Summary row */}
                <button
                  className="w-full text-left px-4 py-3 flex items-start gap-3"
                  onClick={() => setExpanded(isExpanded ? null : item.id)}
                >
                  <span className="text-lg shrink-0" title={typeInfo.label}>{typeInfo.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm text-gray-900 truncate">
                        {item.title || item.description.slice(0, 80)}
                      </span>
                      <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full uppercase ${STATUS_COLORS[item.status]}`}>
                        {item.status.replace('_', ' ')}
                      </span>
                      {item.severity && (
                        <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full uppercase ${SEVERITY_COLORS[item.severity]}`}>
                          {item.severity}
                        </span>
                      )}
                      {item.sentiment && (
                        <span className="text-sm" title={`Sentiment: ${item.sentiment}/5`}>
                          {['', '😡', '😕', '😐', '🙂', '🤩'][item.sentiment]}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                      <span>{item.human ? `${item.human.name} (${item.human.email})` : 'Anonymous'}</span>
                      <span>{new Date(item.createdAt).toLocaleString()}</span>
                      {item.category && <span className="bg-gray-50 px-1.5 py-0.5 rounded">{item.category}</span>}
                    </div>
                  </div>
                  <svg className={`w-4 h-4 text-gray-400 transition-transform shrink-0 mt-1 ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="border-t border-gray-100 px-4 py-4 space-y-4">
                    {/* Description */}
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-1">Description</p>
                      <p className="text-sm text-gray-800 whitespace-pre-wrap bg-gray-50 rounded-lg p-3">{item.description}</p>
                    </div>

                    {/* Bug-specific fields */}
                    {item.stepsToReproduce && (
                      <div>
                        <p className="text-xs font-medium text-gray-500 mb-1">Steps to Reproduce</p>
                        <p className="text-sm text-gray-800 whitespace-pre-wrap bg-gray-50 rounded-lg p-3">{item.stepsToReproduce}</p>
                      </div>
                    )}
                    {(item.expectedBehavior || item.actualBehavior) && (
                      <div className="grid grid-cols-2 gap-3">
                        {item.expectedBehavior && (
                          <div>
                            <p className="text-xs font-medium text-gray-500 mb-1">Expected</p>
                            <p className="text-sm text-gray-800 bg-green-50 rounded-lg p-3">{item.expectedBehavior}</p>
                          </div>
                        )}
                        {item.actualBehavior && (
                          <div>
                            <p className="text-xs font-medium text-gray-500 mb-1">Actual</p>
                            <p className="text-sm text-gray-800 bg-red-50 rounded-lg p-3">{item.actualBehavior}</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Screenshot */}
                    {item.screenshotData && (
                      <div>
                        <p className="text-xs font-medium text-gray-500 mb-1">Screenshot</p>
                        <img src={item.screenshotData} alt="User screenshot" className="max-w-full max-h-64 rounded-lg border border-gray-200" />
                      </div>
                    )}

                    {/* Technical context */}
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs font-medium text-gray-500 mb-2">Technical Context</p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs text-gray-600">
                        <div><span className="text-gray-400">Page:</span> {item.pageUrl || 'N/A'}</div>
                        <div><span className="text-gray-400">Browser:</span> {item.browser || 'N/A'}</div>
                        <div><span className="text-gray-400">OS:</span> {item.os || 'N/A'}</div>
                        <div><span className="text-gray-400">Viewport:</span> {item.viewport || 'N/A'}</div>
                        <div><span className="text-gray-400">ID:</span> <code className="text-[10px]">{item.id}</code></div>
                      </div>
                    </div>

                    {/* Environment diagnostics */}
                    {item.diagnostics && Object.keys(item.diagnostics as Record<string, unknown>).length > 0 && (
                      <div className="bg-blue-50 rounded-lg p-3">
                        <p className="text-xs font-medium text-gray-500 mb-2">Environment Diagnostics</p>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs text-gray-600">
                          {Object.entries(item.diagnostics as Record<string, unknown>).map(([key, value]) => (
                            <div key={key}>
                              <span className="text-gray-400">{key}:</span>{' '}
                              {typeof value === 'object' ? (
                                <code className="text-[10px] break-all">{JSON.stringify(value)}</code>
                              ) : (
                                String(value)
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Status controls */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-gray-500">Set status:</span>
                      {['NEW', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'].map((s) => (
                        <button
                          key={s}
                          onClick={() => updateStatus(item.id, s)}
                          disabled={item.status === s || updatingId === item.id}
                          className={`px-2.5 py-1 text-xs font-medium rounded-md border transition-colors ${
                            item.status === s
                              ? STATUS_COLORS[s] + ' border-transparent cursor-default'
                              : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-50'
                          }`}
                        >
                          {s.replace('_', ' ')}
                        </button>
                      ))}
                    </div>

                    {/* Admin notes */}
                    <div>
                      <label className="text-xs font-medium text-gray-500 mb-1 block">Admin Notes</label>
                      <textarea
                        defaultValue={item.adminNotes || ''}
                        onBlur={(e) => {
                          if (e.target.value !== (item.adminNotes || '')) {
                            updateNotes(item.id, e.target.value);
                          }
                        }}
                        placeholder="Internal notes (auto-saves on blur)..."
                        rows={2}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-200 focus:border-blue-400 outline-none resize-none"
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                onClick={() => loadFeedback(pagination.page - 1)}
                disabled={pagination.page <= 1}
                className="px-3 py-1.5 text-sm border border-gray-200 rounded-md disabled:opacity-50 hover:bg-gray-50"
              >
                Previous
              </button>
              <span className="text-sm text-gray-500">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <button
                onClick={() => loadFeedback(pagination.page + 1)}
                disabled={pagination.page >= pagination.totalPages}
                className="px-3 py-1.5 text-sm border border-gray-200 rounded-md disabled:opacity-50 hover:bg-gray-50"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
