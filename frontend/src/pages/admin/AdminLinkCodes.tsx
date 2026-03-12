import { useState, useEffect, useCallback } from 'react';
import { api } from '../../lib/api';

const STATUS_COLORS: Record<string, string> = {
  linked: 'bg-green-100 text-green-700',
  pending: 'bg-yellow-100 text-yellow-700',
  expired: 'bg-red-100 text-red-700',
};

function relativeTime(date: string): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(date).toLocaleDateString('en-GB');
}

interface LinkCodeEntry {
  id: string;
  name: string;
  linkCode: string | null;
  expiresAt: string | null;
  status: 'pending' | 'linked' | 'expired';
  whatsapp: string | null;
  createdAt: string;
}

export default function AdminLinkCodes() {
  const [entries, setEntries] = useState<LinkCodeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [lastCreated, setLastCreated] = useState<{ code: string; message: string } | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.getAdminLinkCodes();
      setEntries(res.entries);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const res = await api.createAdminLinkCode({ name: newName.trim() });
      setLastCreated({ code: res.linkCode, message: res.message });
      setNewName('');
      fetchData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleRegenerate = async (id: string) => {
    try {
      const res = await api.regenerateAdminLinkCode(id);
      setLastCreated({ code: res.linkCode, message: `New code: ${res.linkCode}` });
      fetchData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this unlinked account?')) return;
    try {
      await api.deleteAdminLinkCode(id);
      fetchData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const copyCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Link Codes</h2>
        <button onClick={fetchData} className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded">
          Refresh
        </button>
      </div>

      {/* Create new */}
      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="text-sm font-medium text-gray-700 mb-2">Create Link Code Account</h3>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Person's name..."
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            className="px-3 py-2 text-sm border border-gray-300 rounded flex-1"
          />
          <button
            onClick={handleCreate}
            disabled={creating || !newName.trim()}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {creating ? 'Creating...' : 'Generate'}
          </button>
        </div>
        {lastCreated && (
          <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded text-sm">
            <p className="font-medium text-green-800">Code: {lastCreated.code}</p>
            <p className="text-green-700 mt-1">{lastCreated.message}</p>
          </div>
        )}
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Name</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Code</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">WhatsApp</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Created</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">Loading...</td></tr>
            ) : entries.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">No link codes yet</td></tr>
            ) : entries.map((entry) => (
              <tr key={entry.id} className="hover:bg-gray-50">
                <td className="px-4 py-2 text-gray-900 font-medium">{entry.name}</td>
                <td className="px-4 py-2">
                  {entry.linkCode ? (
                    <button
                      onClick={() => copyCode(entry.linkCode!, entry.id)}
                      className="font-mono text-xs bg-gray-100 px-2 py-1 rounded hover:bg-gray-200"
                      title="Click to copy"
                    >
                      {copiedId === entry.id ? 'Copied!' : entry.linkCode}
                    </button>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>
                <td className="px-4 py-2">
                  <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${STATUS_COLORS[entry.status]}`}>
                    {entry.status}
                  </span>
                </td>
                <td className="px-4 py-2 text-gray-600 text-xs font-mono">
                  {entry.whatsapp || '-'}
                </td>
                <td className="px-4 py-2 text-gray-400 whitespace-nowrap">
                  {relativeTime(entry.createdAt)}
                </td>
                <td className="px-4 py-2">
                  <div className="flex gap-1">
                    {entry.status !== 'linked' && (
                      <button
                        onClick={() => handleRegenerate(entry.id)}
                        className="px-2 py-1 text-xs bg-yellow-50 text-yellow-700 rounded hover:bg-yellow-100"
                      >
                        Regen
                      </button>
                    )}
                    {entry.status !== 'linked' && (
                      <button
                        onClick={() => handleDelete(entry.id)}
                        className="px-2 py-1 text-xs bg-red-50 text-red-700 rounded hover:bg-red-100"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-500">
        Link codes expire after 48 hours. Once a person texts the code to the WhatsApp number, their account is activated.
      </p>
    </div>
  );
}
