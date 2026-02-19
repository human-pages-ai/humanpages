import { useState, useEffect, useCallback, Fragment } from 'react';
import { api } from '../../lib/api';
import type { StaffMember } from '../../types/admin';

export default function StaffManagement() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Key generation modal state
  const [keyModal, setKeyModal] = useState<{ userId: string; apiKey: string } | null>(null);
  const [copied, setCopied] = useState(false);

  // Confirm revoke state
  const [revokeConfirm, setRevokeConfirm] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.getStaffMembers();
      setStaff(res.staff);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleGenerateKey(userId: string) {
    setActionLoading(userId);
    try {
      const res = await api.generateStaffApiKey(userId);
      setKeyModal({ userId, apiKey: res.apiKey });
      setCopied(false);
      await load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleRevokeKey(userId: string) {
    setActionLoading(userId);
    try {
      await api.revokeStaffApiKey(userId);
      setRevokeConfirm(null);
      await load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(null);
    }
  }

  function copyKey() {
    if (keyModal) {
      navigator.clipboard.writeText(keyModal.apiKey);
      setCopied(true);
    }
  }

  const HOURS = Array.from({ length: 24 }, (_, i) => i);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Staff Management</h2>
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">API Key</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Posts</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Joined</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loading ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">Loading...</td></tr>
            ) : staff.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">No staff members found</td></tr>
            ) : (
              staff.map((s) => (
                <Fragment key={s.id}>
                  <tr
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => setExpandedId(expandedId === s.id ? null : s.id)}
                  >
                    <td className="px-4 py-3 text-sm text-gray-900 font-medium">{s.name}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{s.email}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        s.role === 'ADMIN' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
                      }`}>
                        {s.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {s.apiKeyStatus === 'active' ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-500">
                          None
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{s.totalCompleted}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{new Date(s.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-sm" onClick={(e) => e.stopPropagation()}>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleGenerateKey(s.id)}
                          disabled={actionLoading === s.id}
                          className="px-2 py-1 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50"
                        >
                          {actionLoading === s.id ? '...' : s.apiKeyStatus === 'active' ? 'Rotate Key' : 'Generate Key'}
                        </button>
                        {s.apiKeyStatus === 'active' && (
                          revokeConfirm === s.id ? (
                            <div className="flex gap-1">
                              <button
                                onClick={() => handleRevokeKey(s.id)}
                                disabled={actionLoading === s.id}
                                className="px-2 py-1 text-xs font-medium text-white bg-red-600 rounded hover:bg-red-700 disabled:opacity-50"
                              >
                                Confirm
                              </button>
                              <button
                                onClick={() => setRevokeConfirm(null)}
                                className="px-2 py-1 text-xs font-medium text-gray-600 bg-gray-100 rounded hover:bg-gray-200"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setRevokeConfirm(s.id)}
                              className="px-2 py-1 text-xs font-medium text-red-600 bg-red-50 rounded hover:bg-red-100"
                            >
                              Revoke
                            </button>
                          )
                        )}
                      </div>
                    </td>
                  </tr>
                  {expandedId === s.id && (
                    <tr>
                      <td colSpan={7} className="px-4 py-4 bg-gray-50">
                        <div className="space-y-4">
                          {/* Stats Summary */}
                          <div className="flex gap-6 text-sm">
                            <div>
                              <span className="text-gray-500">Total completed:</span>{' '}
                              <span className="font-medium">{s.totalCompleted}</span>
                            </div>
                            {s.apiKeyCreatedAt && (
                              <div>
                                <span className="text-gray-500">Key created:</span>{' '}
                                <span className="font-medium">{new Date(s.apiKeyCreatedAt).toLocaleDateString()}</span>
                              </div>
                            )}
                          </div>

                          {/* Daily Breakdown */}
                          {s.daily.length > 0 && (
                            <div>
                              <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">Daily (Last 30 Days)</h4>
                              <div className="flex flex-wrap gap-1">
                                {s.daily.slice(0, 30).map((d) => (
                                  <div key={d.day} className="text-center" title={`${d.day}: ${d.count}`}>
                                    <div
                                      className="w-6 h-6 rounded text-[10px] flex items-center justify-center font-medium"
                                      style={{
                                        backgroundColor: d.count === 0 ? '#f3f4f6' : `rgba(59, 130, 246, ${Math.min(0.2 + d.count * 0.1, 1)})`,
                                        color: d.count > 3 ? 'white' : '#374151',
                                      }}
                                    >
                                      {d.count}
                                    </div>
                                    <div className="text-[9px] text-gray-400 mt-0.5">
                                      {new Date(d.day + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Hourly Activity Heatmap */}
                          {s.hourly.length > 0 && (
                            <div>
                              <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">Active Hours (All Time)</h4>
                              <div className="flex gap-0.5">
                                {HOURS.map((h) => {
                                  const entry = s.hourly.find((e) => e.hour === h);
                                  const count = entry?.count || 0;
                                  const maxCount = Math.max(...s.hourly.map((e) => e.count), 1);
                                  return (
                                    <div key={h} className="text-center" title={`${h}:00 - ${count} posts`}>
                                      <div
                                        className="w-5 h-8 rounded-sm"
                                        style={{
                                          backgroundColor: count === 0 ? '#f3f4f6' : `rgba(34, 197, 94, ${Math.max(0.15, count / maxCount)})`,
                                        }}
                                      />
                                      <div className="text-[9px] text-gray-400 mt-0.5">{h}</div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {s.daily.length === 0 && s.hourly.length === 0 && (
                            <p className="text-sm text-gray-400">No posting activity yet</p>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* API Key Modal */}
      {keyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setKeyModal(null)}>
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-lg w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">API Key Generated</h3>
            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 mb-4">
              <p className="text-sm text-yellow-800 font-medium">This key will only be shown once. Copy it now.</p>
            </div>
            <div className="bg-gray-100 rounded-md p-3 mb-4 font-mono text-sm break-all select-all">
              {keyModal.apiKey}
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={copyKey}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
              >
                {copied ? 'Copied!' : 'Copy Key'}
              </button>
              <button
                onClick={() => setKeyModal(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
