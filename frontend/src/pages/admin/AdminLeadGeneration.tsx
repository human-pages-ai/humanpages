import { useState, useEffect, useCallback } from 'react';
import { api } from '../../lib/api';
import type { InfluencerLead, LeadStats, LeadStatus, Pagination } from '../../types/admin';

const STATUS_COLORS: Record<string, string> = {
  NEW: 'bg-gray-100 text-gray-800',
  VERIFIED: 'bg-blue-100 text-blue-800',
  OUTREACH_READY: 'bg-indigo-100 text-indigo-800',
  CONTACTED: 'bg-yellow-100 text-yellow-800',
  REPLIED: 'bg-green-100 text-green-800',
  ENGAGED: 'bg-emerald-100 text-emerald-800',
  CONVERTED: 'bg-teal-100 text-teal-800',
  REJECTED: 'bg-red-100 text-red-800',
  STALE: 'bg-orange-100 text-orange-800',
  BLOCKED: 'bg-red-200 text-red-900',
};

const ALL_STATUSES: LeadStatus[] = ['NEW', 'VERIFIED', 'OUTREACH_READY', 'CONTACTED', 'REPLIED', 'ENGAGED', 'CONVERTED', 'REJECTED', 'STALE', 'BLOCKED'];

const STATUS_TRANSITIONS: Record<string, string[]> = {
  NEW: ['VERIFIED', 'REJECTED', 'BLOCKED'],
  VERIFIED: ['OUTREACH_READY', 'REJECTED', 'BLOCKED'],
  OUTREACH_READY: ['CONTACTED', 'REJECTED', 'BLOCKED'],
  CONTACTED: ['REPLIED', 'STALE', 'REJECTED', 'BLOCKED'],
  REPLIED: ['ENGAGED', 'STALE', 'REJECTED', 'BLOCKED'],
  ENGAGED: ['CONVERTED', 'STALE', 'REJECTED', 'BLOCKED'],
  CONVERTED: [],
  REJECTED: ['NEW'],
  STALE: ['NEW', 'CONTACTED'],
  BLOCKED: [],
};

export default function AdminLeadGeneration() {
  const [stats, setStats] = useState<LeadStats | null>(null);
  const [leads, setLeads] = useState<InfluencerLead[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [listFilter, setListFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedLead, setSelectedLead] = useState<InfluencerLead | null>(null);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const loadStats = useCallback(async () => {
    try {
      const s = await api.getLeadStats();
      setStats(s);
    } catch {}
  }, []);

  const loadLeads = useCallback(async (page: number) => {
    setLoading(true);
    setError('');
    try {
      const res = await api.getLeads({ page, limit: 20, search, status: statusFilter, list: listFilter, source: sourceFilter });
      setLeads(res.leads);
      setPagination(res.pagination);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, listFilter, sourceFilter]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  useEffect(() => {
    const timer = setTimeout(() => loadLeads(1), 300);
    return () => clearTimeout(timer);
  }, [loadLeads]);

  const handleStatusChange = async (leadId: string, newStatus: string) => {
    try {
      const updated = await api.updateLeadStatus(leadId, newStatus);
      setLeads(prev => prev.map(l => l.id === leadId ? updated : l));
      if (selectedLead?.id === leadId) setSelectedLead(updated);
      loadStats();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleFieldSave = async (leadId: string, field: string, value: string) => {
    try {
      const updated = await api.updateLead(leadId, { [field]: value || null });
      setLeads(prev => prev.map(l => l.id === leadId ? updated : l));
      if (selectedLead?.id === leadId) setSelectedLead(updated);
      setEditingField(null);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDelete = async (leadId: string) => {
    if (!confirm('Delete this lead permanently?')) return;
    try {
      await api.deleteLead(leadId);
      setLeads(prev => prev.filter(l => l.id !== leadId));
      if (selectedLead?.id === leadId) setSelectedLead(null);
      loadStats();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleExport = async () => {
    try {
      const blob = await api.exportLeads({ list: listFilter, status: statusFilter });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `leads-export-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert('Export failed: ' + err.message);
    }
  };

  const listNames = stats ? Object.keys(stats.byList).sort() : [];

  return (
    <div className="space-y-4">
      {/* Stats bar */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          <div className="bg-white rounded-lg shadow p-3">
            <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
            <div className="text-xs text-gray-500">Total Leads</div>
          </div>
          <div className="bg-white rounded-lg shadow p-3">
            <div className="text-2xl font-bold text-blue-600">{stats.byStatus['NEW'] || 0}</div>
            <div className="text-xs text-gray-500">New</div>
          </div>
          <div className="bg-white rounded-lg shadow p-3">
            <div className="text-2xl font-bold text-indigo-600">{stats.byStatus['OUTREACH_READY'] || 0}</div>
            <div className="text-xs text-gray-500">Outreach Ready</div>
          </div>
          <div className="bg-white rounded-lg shadow p-3">
            <div className="text-2xl font-bold text-yellow-600">{stats.byStatus['CONTACTED'] || 0}</div>
            <div className="text-xs text-gray-500">Contacted</div>
          </div>
          <div className="bg-white rounded-lg shadow p-3">
            <div className="text-2xl font-bold text-green-600">{(stats.byStatus['REPLIED'] || 0) + (stats.byStatus['ENGAGED'] || 0)}</div>
            <div className="text-xs text-gray-500">Replied/Engaged</div>
          </div>
          <div className="bg-white rounded-lg shadow p-3">
            <div className="text-2xl font-bold text-teal-600">{stats.byStatus['CONVERTED'] || 0}</div>
            <div className="text-xs text-gray-500">Converted</div>
          </div>
        </div>
      )}

      {/* By list breakdown */}
      {stats && listNames.length > 0 && (
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm font-medium text-gray-700 mb-2">By List</div>
          <div className="flex flex-wrap gap-2">
            {listNames.map(name => (
              <button
                key={name}
                onClick={() => setListFilter(listFilter === name ? '' : name)}
                className={`px-2 py-1 text-xs rounded-full border ${listFilter === name ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'}`}
              >
                {name} ({stats.byList[name]})
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          placeholder="Search leads..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All statuses</option>
          {ALL_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All sources</option>
          <option value="CSV_IMPORT">CSV Import</option>
          <option value="MANUAL">Manual</option>
          <option value="PODCAST_MINE">Podcast</option>
          <option value="CONFERENCE">Conference</option>
          <option value="PUBLICATION">Publication</option>
          <option value="CATEGORY_SCAN">Category Scan</option>
          <option value="REFERRAL">Referral</option>
        </select>
        <button
          onClick={handleExport}
          className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-md text-gray-700"
        >
          Export CSV
        </button>
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Platforms</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">List</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Followers</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Source</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Updated</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loading ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-500">Loading...</td></tr>
            ) : leads.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-500">No leads found</td></tr>
            ) : (
              leads.map((l) => (
                <tr
                  key={l.id}
                  className={`hover:bg-gray-50 cursor-pointer ${selectedLead?.id === l.id ? 'bg-blue-50' : ''}`}
                  onClick={() => setSelectedLead(selectedLead?.id === l.id ? null : l)}
                >
                  <td className="px-4 py-3 text-sm text-gray-900 max-w-[200px] truncate font-medium">{l.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-600 max-w-[150px] truncate">{l.platforms.join(', ')}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{l.list}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${STATUS_COLORS[l.status] || 'bg-gray-100 text-gray-800'}`}>
                      {l.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 max-w-[180px] truncate">{l.email || '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-600 max-w-[120px] truncate">{l.followers || '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{l.source.replace('_', ' ')}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{new Date(l.updatedAt).toLocaleDateString('en-GB')}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">
            {pagination.total} leads total — page {pagination.page} of {pagination.totalPages}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => loadLeads(pagination.page - 1)}
              disabled={pagination.page <= 1}
              className="px-3 py-1 text-sm border rounded-md disabled:opacity-50 hover:bg-gray-50"
            >
              Previous
            </button>
            <button
              onClick={() => loadLeads(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages}
              className="px-3 py-1 text-sm border rounded-md disabled:opacity-50 hover:bg-gray-50"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Detail panel */}
      {selectedLead && (
        <div className="bg-white rounded-lg shadow p-6 space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{selectedLead.name}</h3>
              <p className="text-sm text-gray-500">{selectedLead.list} — {selectedLead.source.replace('_', ' ')}</p>
            </div>
            <div className="flex gap-2">
              <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${STATUS_COLORS[selectedLead.status]}`}>
                {selectedLead.status}
              </span>
              <button
                onClick={() => handleDelete(selectedLead.id)}
                className="px-2 py-1 text-xs text-red-600 hover:text-red-800"
              >
                Delete
              </button>
            </div>
          </div>

          {/* Status transitions */}
          {STATUS_TRANSITIONS[selectedLead.status]?.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <span className="text-xs text-gray-500 self-center">Move to:</span>
              {STATUS_TRANSITIONS[selectedLead.status].map(s => (
                <button
                  key={s}
                  onClick={() => handleStatusChange(selectedLead.id, s)}
                  className={`px-2 py-1 text-xs rounded-md border hover:shadow-sm ${STATUS_COLORS[s]}`}
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Details grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            {[
              { label: 'Platforms', value: selectedLead.platforms.join(', ') },
              { label: 'Handle', value: selectedLead.handle, field: 'handle' },
              { label: 'Followers', value: selectedLead.followers },
              { label: 'Email', value: selectedLead.email, field: 'email' },
              { label: 'Phone', value: selectedLead.phone, field: 'phone' },
              { label: 'Contact URL', value: selectedLead.contactUrl, field: 'contactUrl' },
              { label: 'Country', value: selectedLead.country },
              { label: 'Language', value: selectedLead.language },
              { label: 'Source URL', value: selectedLead.sourceUrl },
            ].map(({ label, value, field }) => (
              <div key={label}>
                <span className="text-gray-500">{label}:</span>{' '}
                {field && editingField === `${selectedLead.id}-${field}` ? (
                  <span className="inline-flex gap-1">
                    <input
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      className="px-1 py-0.5 border rounded text-sm w-48"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleFieldSave(selectedLead.id, field, editValue);
                        if (e.key === 'Escape') setEditingField(null);
                      }}
                    />
                    <button onClick={() => handleFieldSave(selectedLead.id, field, editValue)} className="text-blue-600 text-xs">Save</button>
                  </span>
                ) : (
                  <span
                    className={`text-gray-900 ${field ? 'cursor-pointer hover:text-blue-600' : ''}`}
                    onClick={(e) => {
                      if (field) {
                        e.stopPropagation();
                        setEditingField(`${selectedLead.id}-${field}`);
                        setEditValue(value || '');
                      }
                    }}
                  >
                    {value || '—'}
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Focus areas / Why relevant */}
          {selectedLead.focusAreas && (
            <div className="text-sm">
              <span className="text-gray-500">Focus Areas:</span>
              <p className="text-gray-900 mt-1">{selectedLead.focusAreas}</p>
            </div>
          )}
          {selectedLead.whyRelevant && (
            <div className="text-sm">
              <span className="text-gray-500">Why Relevant:</span>
              <p className="text-gray-900 mt-1">{selectedLead.whyRelevant}</p>
            </div>
          )}
          {selectedLead.notes && (
            <div className="text-sm">
              <span className="text-gray-500">Notes:</span>
              <p className="text-gray-900 mt-1">{selectedLead.notes}</p>
            </div>
          )}

          {/* Outreach message */}
          <div className="text-sm">
            <span className="text-gray-500">Outreach Message:</span>
            {editingField === `${selectedLead.id}-outreachMessage` ? (
              <div className="mt-1">
                <textarea
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className="w-full px-2 py-1 border rounded text-sm h-24"
                  autoFocus
                />
                <div className="flex gap-2 mt-1">
                  <button onClick={() => handleFieldSave(selectedLead.id, 'outreachMessage', editValue)} className="text-blue-600 text-xs">Save</button>
                  <button onClick={() => setEditingField(null)} className="text-gray-500 text-xs">Cancel</button>
                </div>
              </div>
            ) : (
              <p
                className="text-gray-900 mt-1 cursor-pointer hover:text-blue-600 whitespace-pre-wrap"
                onClick={(e) => {
                  e.stopPropagation();
                  setEditingField(`${selectedLead.id}-outreachMessage`);
                  setEditValue(selectedLead.outreachMessage || '');
                }}
              >
                {selectedLead.outreachMessage || 'Click to add...'}
              </p>
            )}
          </div>

          {/* Admin notes */}
          <div className="text-sm">
            <span className="text-gray-500">Admin Notes:</span>
            {editingField === `${selectedLead.id}-adminNotes` ? (
              <div className="mt-1">
                <textarea
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className="w-full px-2 py-1 border rounded text-sm h-20"
                  autoFocus
                />
                <div className="flex gap-2 mt-1">
                  <button onClick={() => handleFieldSave(selectedLead.id, 'adminNotes', editValue)} className="text-blue-600 text-xs">Save</button>
                  <button onClick={() => setEditingField(null)} className="text-gray-500 text-xs">Cancel</button>
                </div>
              </div>
            ) : (
              <p
                className="text-gray-900 mt-1 cursor-pointer hover:text-blue-600 whitespace-pre-wrap"
                onClick={(e) => {
                  e.stopPropagation();
                  setEditingField(`${selectedLead.id}-adminNotes`);
                  setEditValue(selectedLead.adminNotes || '');
                }}
              >
                {selectedLead.adminNotes || 'Click to add...'}
              </p>
            )}
          </div>

          {/* Timeline */}
          <div className="text-xs text-gray-400 space-y-1 pt-2 border-t">
            <div>Created: {new Date(selectedLead.createdAt).toLocaleString()}</div>
            {selectedLead.outreachSentAt && <div>Outreach sent: {new Date(selectedLead.outreachSentAt).toLocaleString()}</div>}
            {selectedLead.lastContactAt && <div>Last contact: {new Date(selectedLead.lastContactAt).toLocaleString()}</div>}
            <div>DedupeKey: {selectedLead.dedupeKey}</div>
          </div>
        </div>
      )}
    </div>
  );
}
