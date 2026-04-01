import { useState, useEffect, useCallback } from 'react';
import { api } from '../../lib/api';

interface Arbitrator {
  id: string;
  name: string;
  description: string | null;
  status: string;
  isVerified: boolean;
  arbitratorFeeBps: number | null;
  arbitratorSpecialties: string[];
  arbitratorSla: string | null;
  arbitratorWebhookUrl: string | null;
  arbitratorHealthy: boolean;
  arbitratorLastHealthAt: string | null;
  arbitratorDisputeCount: number;
  arbitratorWinCount: number;
  arbitratorTotalEarned: number;
  arbitratorAvgResponseH: number | null;
  escrowReleaseCount: number;
  escrowDisputeCount: number;
  createdAt: string;
  wallets: { address: string; network: string; verified: boolean }[];
}

export default function AdminArbitrators() {
  const [arbitrators, setArbitrators] = useState<Arbitrator[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.getAdminArbitrators();
      setArbitrators(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAction = async (id: string, action: 'approve' | 'reject' | 'toggle-health', currentHealthy?: boolean) => {
    setActionLoading(id);
    try {
      if (action === 'approve') {
        await api.updateAdminArbitrator(id, { approved: true });
      } else if (action === 'reject') {
        await api.updateAdminArbitrator(id, { approved: false });
      } else {
        await api.updateAdminArbitrator(id, { healthy: !currentHealthy });
      }
      await load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const pending = arbitrators.filter(a => !a.isVerified);
  const approved = arbitrators.filter(a => a.isVerified);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900">Arbitrator Management</h2>
        <button onClick={load} className="text-sm text-blue-600 hover:text-blue-800">Refresh</button>
      </div>

      {error && <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-md p-3">{error}</p>}

      {loading ? (
        <p className="text-gray-500 text-sm">Loading arbitrators...</p>
      ) : arbitrators.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
          No arbitrators registered yet.
        </div>
      ) : (
        <>
          {/* Pending approval */}
          {pending.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-yellow-800 mb-2">Pending Approval ({pending.length})</h3>
              <div className="bg-white rounded-lg shadow overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-yellow-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fee</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Specialties</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">SLA</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Wallet</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Webhook</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {pending.map(arb => (
                      <tr key={arb.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{arb.name}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{arb.arbitratorFeeBps ? `${(arb.arbitratorFeeBps / 100).toFixed(1)}%` : '-'}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {arb.arbitratorSpecialties.length > 0
                            ? arb.arbitratorSpecialties.map(s => (
                                <span key={s} className="inline-block bg-gray-100 text-gray-700 text-xs px-2 py-0.5 rounded mr-1 mb-1">{s}</span>
                              ))
                            : '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">{arb.arbitratorSla || '-'}</td>
                        <td className="px-4 py-3 text-sm text-gray-600 font-mono">
                          {arb.wallets.length > 0 ? `${arb.wallets[0].address.slice(0, 6)}...${arb.wallets[0].address.slice(-4)}` : 'None'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {arb.arbitratorWebhookUrl ? (
                            <span className="text-green-600">Set</span>
                          ) : (
                            <span className="text-gray-400">None</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right space-x-2">
                          <button
                            onClick={() => handleAction(arb.id, 'approve')}
                            disabled={actionLoading === arb.id}
                            className="px-3 py-1 text-xs font-medium bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                          >
                            {actionLoading === arb.id ? '...' : 'Approve'}
                          </button>
                          <button
                            onClick={() => handleAction(arb.id, 'reject')}
                            disabled={actionLoading === arb.id}
                            className="px-3 py-1 text-xs font-medium bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                          >
                            Reject
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Approved arbitrators */}
          <div>
            <h3 className="text-sm font-medium text-green-800 mb-2">Approved Arbitrators ({approved.length})</h3>
            <div className="bg-white rounded-lg shadow overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fee</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Specialties</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Disputes</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Earned</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Health</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {approved.length === 0 ? (
                    <tr><td colSpan={8} className="px-4 py-6 text-center text-gray-400 text-sm">No approved arbitrators yet.</td></tr>
                  ) : approved.map(arb => (
                    <tr key={arb.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{arb.name}</td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`px-2 py-0.5 text-xs rounded-full ${arb.status === 'ACTIVE' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                          {arb.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{arb.arbitratorFeeBps ? `${(arb.arbitratorFeeBps / 100).toFixed(1)}%` : '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {arb.arbitratorSpecialties.map(s => (
                          <span key={s} className="inline-block bg-gray-100 text-gray-700 text-xs px-2 py-0.5 rounded mr-1">{s}</span>
                        ))}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {arb.arbitratorDisputeCount} ({arb.arbitratorWinCount} won)
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">${arb.arbitratorTotalEarned.toFixed(2)}</td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`inline-flex items-center gap-1 ${arb.arbitratorHealthy ? 'text-green-600' : 'text-red-600'}`}>
                          <span className={`w-2 h-2 rounded-full ${arb.arbitratorHealthy ? 'bg-green-500' : 'bg-red-500'}`} />
                          {arb.arbitratorHealthy ? 'Healthy' : 'Down'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right space-x-2">
                        <button
                          onClick={() => handleAction(arb.id, 'toggle-health', arb.arbitratorHealthy)}
                          disabled={actionLoading === arb.id}
                          className="px-3 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50"
                        >
                          {arb.arbitratorHealthy ? 'Mark Down' : 'Mark Healthy'}
                        </button>
                        <button
                          onClick={() => handleAction(arb.id, 'reject')}
                          disabled={actionLoading === arb.id}
                          className="px-3 py-1 text-xs font-medium bg-red-100 text-red-700 rounded hover:bg-red-200 disabled:opacity-50"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
