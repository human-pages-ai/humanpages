import { useState, useEffect, useCallback } from 'react';
import { api } from '../../lib/api';
import type { AdCopy } from '../../types/admin';

type ModalMode = 'create' | 'edit' | 'view' | null;

export default function AdminAdCopy() {
  const [ads, setAds] = useState<AdCopy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Modal state
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [selectedAd, setSelectedAd] = useState<AdCopy | null>(null);
  const [formData, setFormData] = useState({ adNumber: 0, language: 'en', title: '', body: '' });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  // Delete state
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Filter
  const [langFilter, setLangFilter] = useState('');

  const fetchAds = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getAdCopies();
      setAds(res.ads);
      setError('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAds(); }, [fetchAds]);

  const openCreate = () => {
    const maxNum = ads.reduce((max, a) => Math.max(max, a.adNumber), 0);
    setFormData({ adNumber: maxNum + 1, language: 'en', title: '', body: '' });
    setSaveError('');
    setModalMode('create');
  };

  const openEdit = (ad: AdCopy) => {
    setSelectedAd(ad);
    setFormData({ adNumber: ad.adNumber, language: ad.language, title: ad.title, body: ad.body });
    setSaveError('');
    setModalMode('edit');
  };

  const openView = (ad: AdCopy) => {
    setSelectedAd(ad);
    setModalMode('view');
  };

  const closeModal = () => {
    setModalMode(null);
    setSelectedAd(null);
    setSaveError('');
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError('');
    try {
      if (modalMode === 'create') {
        await api.createAdCopy(formData);
      } else if (modalMode === 'edit' && selectedAd) {
        await api.updateAdCopy(selectedAd.id, formData);
      }
      closeModal();
      await fetchAds();
    } catch (err: any) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleting(true);
    try {
      await api.deleteAdCopy(id);
      setDeleteConfirm(null);
      await fetchAds();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setDeleting(false);
    }
  };

  const copyBody = (body: string) => {
    navigator.clipboard.writeText(body);
  };

  const filtered = langFilter ? ads.filter(a => a.language === langFilter) : ads;
  const languages = [...new Set(ads.map(a => a.language))].sort();

  if (loading) {
    return <div className="text-center py-12 text-gray-500">Loading ad copies...</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Ad Copy Management</h2>
          <p className="text-sm text-gray-500 mt-1">{ads.length} ad copies total</p>
        </div>
        <button
          onClick={openCreate}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
        >
          + New Ad Copy
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
      )}

      {/* Filters */}
      <div className="mb-4 flex gap-3">
        <select
          value={langFilter}
          onChange={(e) => setLangFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
        >
          <option value="">All languages</option>
          {languages.map(l => <option key={l} value={l}>{l.toUpperCase()}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">#</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Lang</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Title</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Body</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Groups</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filtered.map((ad) => (
              <tr key={ad.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm font-mono text-gray-700">{ad.adNumber}</td>
                <td className="px-4 py-3 text-sm">
                  <span className="px-2 py-0.5 bg-gray-100 rounded text-xs font-medium">{ad.language.toUpperCase()}</span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-900 max-w-xs truncate">{ad.title}</td>
                <td className="px-4 py-3 text-sm text-gray-500 max-w-sm truncate">{ad.body.slice(0, 80)}...</td>
                <td className="px-4 py-3 text-sm text-gray-700">{ad._count?.groups ?? '—'}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button onClick={() => openView(ad)} className="text-blue-600 hover:text-blue-800 text-sm">View</button>
                    <button onClick={() => openEdit(ad)} className="text-gray-600 hover:text-gray-800 text-sm">Edit</button>
                    <button onClick={() => copyBody(ad.body)} className="text-gray-400 hover:text-gray-600 text-sm" title="Copy body">Copy</button>
                    {(ad._count?.groups ?? 0) === 0 && (
                      deleteConfirm === ad.id ? (
                        <span className="flex items-center gap-1">
                          <button
                            onClick={() => handleDelete(ad.id)}
                            disabled={deleting}
                            className="text-red-600 hover:text-red-800 text-sm font-medium"
                          >
                            {deleting ? '...' : 'Confirm'}
                          </button>
                          <button onClick={() => setDeleteConfirm(null)} className="text-gray-400 hover:text-gray-600 text-sm">Cancel</button>
                        </span>
                      ) : (
                        <button onClick={() => setDeleteConfirm(ad.id)} className="text-red-400 hover:text-red-600 text-sm">Delete</button>
                      )
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500 text-sm">No ad copies found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {modalMode && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={closeModal}>
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold text-gray-900">
                {modalMode === 'create' ? 'New Ad Copy' : modalMode === 'edit' ? 'Edit Ad Copy' : `Ad #${selectedAd?.adNumber} — ${selectedAd?.title}`}
              </h3>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
            </div>

            <div className="p-4">
              {modalMode === 'view' && selectedAd ? (
                <div>
                  <div className="flex gap-4 mb-4 text-sm text-gray-600">
                    <span>Language: <strong>{selectedAd.language.toUpperCase()}</strong></span>
                    <span>Groups: <strong>{selectedAd._count?.groups ?? '—'}</strong></span>
                  </div>
                  <pre className="whitespace-pre-wrap text-sm font-sans bg-gray-50 rounded-lg p-4 border max-h-96 overflow-y-auto">
                    {selectedAd.body}
                  </pre>
                  <div className="mt-4 flex gap-2">
                    <button
                      onClick={() => copyBody(selectedAd.body)}
                      className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200"
                    >
                      Copy Body
                    </button>
                    <button
                      onClick={() => openEdit(selectedAd)}
                      className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
                    >
                      Edit
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Ad Number</label>
                      <input
                        type="number"
                        value={formData.adNumber}
                        onChange={(e) => setFormData(d => ({ ...d, adNumber: parseInt(e.target.value) || 0 }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      />
                    </div>
                    <div className="w-32">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Language</label>
                      <input
                        type="text"
                        value={formData.language}
                        onChange={(e) => setFormData(d => ({ ...d, language: e.target.value }))}
                        placeholder="en"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                    <input
                      type="text"
                      value={formData.title}
                      onChange={(e) => setFormData(d => ({ ...d, title: e.target.value }))}
                      placeholder="e.g. Career Page Ad — Tech"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Body</label>
                    <textarea
                      value={formData.body}
                      onChange={(e) => setFormData(d => ({ ...d, body: e.target.value }))}
                      rows={14}
                      placeholder="Full ad copy text..."
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono"
                    />
                    <p className="text-xs text-gray-400 mt-1">{formData.body.length} characters</p>
                  </div>
                  {saveError && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{saveError}</div>
                  )}
                  <div className="flex justify-end gap-2">
                    <button onClick={closeModal} className="px-4 py-2 text-gray-600 text-sm hover:text-gray-800">Cancel</button>
                    <button
                      onClick={handleSave}
                      disabled={saving || !formData.title || !formData.body || !formData.adNumber}
                      className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                      {saving ? 'Saving...' : modalMode === 'create' ? 'Create' : 'Save Changes'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
