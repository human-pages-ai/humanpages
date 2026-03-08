import { useState } from 'react';
import { FiatPaymentMethod } from './types';

const PLATFORM_NAMES: Record<string, string> = {
  WISE: 'Wise',
  VENMO: 'Venmo',
  PAYPAL: 'PayPal',
  CASHAPP: 'Cash App',
  REVOLUT: 'Revolut',
  ZELLE: 'Zelle',
  MONZO: 'Monzo',
  N26: 'N26',
  MERCADOPAGO: 'Mercado Pago',
};

const PLATFORMS = Object.keys(PLATFORM_NAMES) as FiatPaymentMethod['platform'][];

const HANDLE_PLACEHOLDERS: Record<string, string> = {
  VENMO: '@username',
  PAYPAL: 'email@example.com',
  CASHAPP: '$cashtag',
  REVOLUT: '@username',
  ZELLE: 'email or phone',
  WISE: 'email@example.com',
  MONZO: '@username',
  N26: 'email@example.com',
  MERCADOPAGO: 'email or phone',
};

interface Props {
  methods: FiatPaymentMethod[];
  saving: boolean;
  onAdd: (data: { platform: string; handle: string; label?: string }) => Promise<void>;
  onUpdate: (id: string, data: { handle?: string; label?: string }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onSetPrimary: (id: string) => Promise<void>;
}

export default function FiatPaymentMethodsSection({
  methods,
  saving,
  onAdd,
  onUpdate,
  onDelete,
  onSetPrimary,
}: Props) {
  const [showForm, setShowForm] = useState(false);
  const [platform, setPlatform] = useState<string>(PLATFORMS[0]);
  const [handle, setHandle] = useState('');
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editHandle, setEditHandle] = useState('');
  const [editLabel, setEditLabel] = useState('');

  const resetForm = () => {
    setPlatform(PLATFORMS[0]);
    setHandle('');
    setLabel('');
    setError('');
    setShowForm(false);
  };

  const submitAdd = async () => {
    if (!handle.trim()) {
      setError('Handle is required');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await onAdd({ platform, handle: handle.trim(), ...(label.trim() && { label: label.trim() }) });
      resetForm();
    } catch (err: any) {
      setError(err?.message || 'Failed to add payment method');
    } finally {
      setBusy(false);
    }
  };

  const startEdit = (method: FiatPaymentMethod) => {
    setEditingId(method.id);
    setEditHandle(method.handle);
    setEditLabel(method.label || '');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditHandle('');
    setEditLabel('');
  };

  const submitEdit = async (id: string) => {
    setBusy(true);
    try {
      await onUpdate(id, {
        handle: editHandle.trim() || undefined,
        label: editLabel.trim() || undefined,
      });
      cancelEdit();
    } catch (err: any) {
      setError(err?.message || 'Failed to update payment method');
    } finally {
      setBusy(false);
    }
  };

  const handleSetPrimary = async (id: string) => {
    setBusy(true);
    try {
      await onSetPrimary(id);
    } catch {
      // toast handled by parent
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-4 sm:p-6">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-lg font-semibold">Fiat Payment Methods</h2>
      </div>
      <p className="text-sm text-gray-500 mb-4">
        Add your payment handles so agents can pay you via fiat on/off-ramps (ZKP2P).
      </p>

      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg">
          {error}
        </div>
      )}

      {methods.length === 0 && !showForm ? (
        <div className="py-4">
          <div className="flex flex-col items-center gap-4 mb-6">
            <svg className="w-12 h-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <div className="text-center">
              <p className="text-lg font-medium text-gray-900 mb-1">No fiat payment methods yet</p>
              <p className="text-sm text-gray-500 mb-2">
                Add your Venmo, PayPal, Revolut, or other payment handles to receive fiat payments from agents.
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowForm(true)}
            disabled={saving || busy}
            className="w-full flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors disabled:opacity-50 text-left"
          >
            <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-blue-100">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-gray-900">Add Payment Method</p>
              <p className="text-xs text-gray-500">Venmo, PayPal, Revolut, Cash App, and more</p>
            </div>
            <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      ) : (
        <>
          <div className="space-y-3 mb-4">
            {methods.map((method) => (
              <div key={method.id} className="p-3 bg-gray-50 rounded-lg">
                {editingId === method.id ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-gray-500 bg-gray-200 px-2 py-0.5 rounded-full">
                        {PLATFORM_NAMES[method.platform] || method.platform}
                      </span>
                    </div>
                    <input
                      type="text"
                      value={editHandle}
                      onChange={(e) => setEditHandle(e.target.value)}
                      placeholder={HANDLE_PLACEHOLDERS[method.platform] || 'Handle'}
                      className="w-full text-sm px-3 py-2 border border-gray-300 rounded-md"
                      autoFocus
                    />
                    <input
                      type="text"
                      value={editLabel}
                      onChange={(e) => setEditLabel(e.target.value)}
                      placeholder="Label (optional)"
                      maxLength={50}
                      className="w-full text-sm px-3 py-2 border border-gray-300 rounded-md"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => submitEdit(method.id)}
                        disabled={busy}
                        className="text-sm text-blue-600 hover:text-blue-500 disabled:opacity-50"
                      >
                        Save
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="text-sm text-gray-400 hover:text-gray-600"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">
                          {PLATFORM_NAMES[method.platform] || method.platform}
                        </span>
                        {method.isPrimary && (
                          <span className="text-xs font-medium text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                            Primary
                          </span>
                        )}
                        {method.label && (
                          <span className="text-xs text-gray-500">{method.label}</span>
                        )}
                      </div>
                      <p className="text-sm text-gray-800 font-mono truncate">{method.handle}</p>
                    </div>
                    <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                      {!method.isPrimary && (
                        <button
                          onClick={() => handleSetPrimary(method.id)}
                          disabled={saving || busy}
                          className="text-xs text-gray-400 hover:text-amber-600 disabled:opacity-50"
                          title="Set as primary"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                          </svg>
                        </button>
                      )}
                      <button
                        onClick={() => startEdit(method)}
                        disabled={saving || busy}
                        className="text-xs text-gray-400 hover:text-blue-600 disabled:opacity-50"
                        title="Edit"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => onDelete(method.id)}
                        disabled={saving || busy}
                        className="text-xs text-gray-400 hover:text-red-500 disabled:opacity-50"
                        title="Delete"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {showForm ? (
            <div className="border border-gray-200 rounded-lg p-4 space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Platform</label>
                <select
                  value={platform}
                  onChange={(e) => setPlatform(e.target.value)}
                  className="w-full text-sm px-3 py-2 border border-gray-300 rounded-md bg-white"
                  disabled={busy}
                >
                  {PLATFORMS.map((p) => (
                    <option key={p} value={p}>{PLATFORM_NAMES[p]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Handle / Username</label>
                <input
                  type="text"
                  value={handle}
                  onChange={(e) => { setHandle(e.target.value); setError(''); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') submitAdd(); }}
                  placeholder={HANDLE_PLACEHOLDERS[platform] || 'Your username, email, or tag'}
                  className="w-full text-sm px-3 py-2 border border-gray-300 rounded-md"
                  disabled={busy}
                  maxLength={200}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Label (optional)</label>
                <input
                  type="text"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="e.g. Personal, Business"
                  className="w-full text-sm px-3 py-2 border border-gray-300 rounded-md"
                  disabled={busy}
                  maxLength={50}
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={submitAdd}
                  disabled={busy || !handle.trim()}
                  className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {busy ? 'Adding...' : 'Add'}
                </button>
                <button
                  onClick={resetForm}
                  disabled={busy}
                  className="px-4 py-2 text-gray-600 text-sm rounded-md hover:bg-gray-100"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowForm(true)}
              disabled={saving || busy}
              className="text-sm text-blue-600 hover:text-blue-500 disabled:opacity-50"
            >
              + Add another payment method
            </button>
          )}
        </>
      )}
    </div>
  );
}
