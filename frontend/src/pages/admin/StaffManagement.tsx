import { useState, useEffect, useCallback, useRef, Fragment } from 'react';
import { api } from '../../lib/api';
import type { StaffMember, AdminUser, StaffCapability } from '../../types/admin';
import { STAFF_CAPABILITIES } from '../../types/admin';

const CAP_LABELS: Record<StaffCapability, string> = {
  CONTENT_REVIEWER: 'Content Reviewer',
  POSTER: 'Poster',
  ANALYST: 'Analyst',
  CREATIVE: 'Creative',
  GROUP_MANAGER: 'Group Manager',
  LEAD_GEN: 'Lead Gen',
  VIDEO_MANAGER: 'Video Manager',
};

function CapabilitiesEditor({ member, onSaved }: { member: StaffMember; onSaved: (caps: StaffCapability[]) => void }) {
  const [selected, setSelected] = useState<StaffCapability[]>(member.capabilities);
  const [saving, setSaving] = useState(false);
  const changed = JSON.stringify([...selected].sort()) !== JSON.stringify([...member.capabilities].sort());

  if (member.role === 'ADMIN') {
    return (
      <div className="text-sm text-gray-500 italic">Admin has all capabilities</div>
    );
  }

  const toggle = (cap: StaffCapability) => {
    setSelected((prev) =>
      prev.includes(cap) ? prev.filter((c) => c !== cap) : [...prev, cap]
    );
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await api.updateStaffCapabilities(member.id, selected);
      onSaved(res.capabilities);
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">Capabilities</h4>
      <div className="flex flex-wrap gap-2">
        {STAFF_CAPABILITIES.map((cap) => (
          <button
            key={cap}
            onClick={() => toggle(cap)}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
              selected.includes(cap)
                ? 'bg-blue-100 text-blue-700 border-blue-300'
                : 'bg-gray-50 text-gray-500 border-gray-200 hover:border-gray-300'
            }`}
          >
            {CAP_LABELS[cap]}
          </button>
        ))}
      </div>
      {changed && (
        <button
          onClick={save}
          disabled={saving}
          className="mt-2 px-3 py-1 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Capabilities'}
        </button>
      )}
    </div>
  );
}

export default function StaffManagement() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Key generation modal state
  const [keyModal, setKeyModal] = useState<{ userId: string; apiKey: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [emailSending, setEmailSending] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  // Confirm revoke state
  const [revokeConfirm, setRevokeConfirm] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Remove staff confirm
  const [removeConfirm, setRemoveConfirm] = useState<string | null>(null);

  // Add staff modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<AdminUser[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [promoteLoading, setPromoteLoading] = useState<string | null>(null);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout>>();

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
      setEmailSending(false);
      setEmailSent(false);
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

  async function handleRemoveStaff(userId: string) {
    setActionLoading(userId);
    try {
      await api.updateStaffRole(userId, 'USER');
      setRemoveConfirm(null);
      await load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleEmailKey() {
    if (!keyModal) return;
    setEmailSending(true);
    try {
      await api.sendStaffApiKey(keyModal.userId, keyModal.apiKey);
      setEmailSent(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setEmailSending(false);
    }
  }

  function copyKey() {
    if (keyModal) {
      navigator.clipboard.writeText(keyModal.apiKey);
      setCopied(true);
    }
  }

  // Add staff modal search
  useEffect(() => {
    if (!showAddModal) return;
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await api.getAdminUsers({ search: searchQuery, limit: 20 });
        // Filter to only show USER role (not already STAFF/ADMIN)
        setSearchResults(res.users.filter((u: AdminUser) => u.role === 'USER'));
      } catch {
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 300);

    return () => clearTimeout(searchDebounceRef.current);
  }, [searchQuery, showAddModal]);

  async function handlePromote(userId: string) {
    setPromoteLoading(userId);
    try {
      await api.updateStaffRole(userId, 'STAFF');
      // Remove from search results
      setSearchResults((prev) => prev.filter((u) => u.id !== userId));
      await load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setPromoteLoading(null);
    }
  }

  function openAddModal() {
    setShowAddModal(true);
    setSearchQuery('');
    setSearchResults([]);
  }

  const HOURS = Array.from({ length: 24 }, (_, i) => i);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Staff Management</h2>
        <button
          onClick={openAddModal}
          className="px-3 py-1.5 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
        >
          + Add Staff Member
        </button>
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
                    <td className="px-4 py-3 text-sm text-gray-500">{new Date(s.createdAt).toLocaleDateString('en-GB')}</td>
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
                        {s.role === 'STAFF' && (
                          removeConfirm === s.id ? (
                            <div className="flex gap-1">
                              <button
                                onClick={() => handleRemoveStaff(s.id)}
                                disabled={actionLoading === s.id}
                                className="px-2 py-1 text-xs font-medium text-white bg-red-600 rounded hover:bg-red-700 disabled:opacity-50"
                              >
                                Confirm
                              </button>
                              <button
                                onClick={() => setRemoveConfirm(null)}
                                className="px-2 py-1 text-xs font-medium text-gray-600 bg-gray-100 rounded hover:bg-gray-200"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setRemoveConfirm(s.id)}
                              className="px-2 py-1 text-xs font-medium text-orange-600 bg-orange-50 rounded hover:bg-orange-100"
                            >
                              Remove
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
                          {/* Capabilities */}
                          <CapabilitiesEditor
                            member={s}
                            onSaved={(caps) => {
                              setStaff((prev) => prev.map((m) => m.id === s.id ? { ...m, capabilities: caps } : m));
                            }}
                          />

                          {/* Stats Summary */}
                          <div className="flex gap-6 text-sm">
                            <div>
                              <span className="text-gray-500">Total completed:</span>{' '}
                              <span className="font-medium">{s.totalCompleted}</span>
                            </div>
                            {s.apiKeyCreatedAt && (
                              <div>
                                <span className="text-gray-500">Key created:</span>{' '}
                                <span className="font-medium">{new Date(s.apiKeyCreatedAt).toLocaleDateString('en-GB')}</span>
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
                                      {new Date(d.day + 'T00:00:00').toLocaleDateString('en-GB', { month: 'short', day: 'numeric' })}
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
                onClick={handleEmailKey}
                disabled={emailSending || emailSent}
                className="px-4 py-2 text-sm font-medium text-indigo-700 bg-indigo-50 rounded-md hover:bg-indigo-100 disabled:opacity-50"
              >
                {emailSent ? 'Email Sent!' : emailSending ? 'Sending...' : 'Email to Staff'}
              </button>
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

      {/* Add Staff Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowAddModal(false)}>
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-lg w-full mx-4 max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Add Staff Member</h3>
            <input
              type="text"
              placeholder="Search users by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 mb-3"
            />
            <div className="overflow-y-auto flex-1 min-h-0">
              {searchLoading ? (
                <p className="text-sm text-gray-500 text-center py-4">Searching...</p>
              ) : searchQuery.trim() && searchResults.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">No users found (or all matches are already staff)</p>
              ) : (
                <div className="space-y-1">
                  {searchResults.map((u) => (
                    <div key={u.id} className="flex items-center justify-between px-3 py-2 rounded-md hover:bg-gray-50">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{u.name}</p>
                        <p className="text-xs text-gray-500 truncate">{u.email}</p>
                      </div>
                      <button
                        onClick={() => handlePromote(u.id)}
                        disabled={promoteLoading === u.id}
                        className="ml-3 px-3 py-1 text-xs font-medium text-white bg-indigo-600 rounded hover:bg-indigo-700 disabled:opacity-50 whitespace-nowrap"
                      >
                        {promoteLoading === u.id ? '...' : 'Promote to Staff'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="flex justify-end mt-4 pt-3 border-t border-gray-200">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
