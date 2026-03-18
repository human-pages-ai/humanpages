import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import type { AdminAgentDetail as AdminAgentDetailType } from '../../types/admin';

const statusBadgeColors: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-800',
  PENDING: 'bg-yellow-100 text-yellow-800',
  SUSPENDED: 'bg-orange-100 text-orange-800',
  BANNED: 'bg-red-100 text-red-800',
};

const jobStatusColors: Record<string, string> = {
  COMPLETED: 'bg-green-100 text-green-800',
  PAID: 'bg-blue-100 text-blue-800',
  ACCEPTED: 'bg-blue-100 text-blue-800',
  PENDING: 'bg-yellow-100 text-yellow-800',
  PAYMENT_CLAIMED: 'bg-orange-100 text-orange-800',
  REJECTED: 'bg-gray-100 text-gray-800',
  CANCELLED: 'bg-gray-100 text-gray-600',
  DISPUTED: 'bg-red-100 text-red-800',
};

const reportStatusColors: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  REVIEWED: 'bg-blue-100 text-blue-800',
  DISMISSED: 'bg-gray-100 text-gray-600',
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-lg shadow p-5">
      <h3 className="text-sm font-medium text-gray-500 uppercase mb-3">{title}</h3>
      {children}
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <div className="py-1">
      <span className="text-xs text-gray-400">{label}: </span>
      <span className="text-sm text-gray-900">{value}</span>
    </div>
  );
}

export default function AdminAgentDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [agent, setAgent] = useState<AdminAgentDetailType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Admin override controls
  const [editStatus, setEditStatus] = useState('');
  const [editTier, setEditTier] = useState('');
  const [editVerified, setEditVerified] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (!id) return;
    api.getAdminAgent(id)
      .then((a) => {
        setAgent(a);
        setEditStatus(a.status);
        setEditTier(a.activationTier);
        setEditVerified(a.isVerified ?? false);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  const handleSave = async () => {
    if (!id || !agent) return;
    setSaving(true);
    setSaveMsg(null);
    try {
      const data: { status?: string; activationTier?: string; isVerified?: boolean } = {};
      if (editStatus !== agent.status) data.status = editStatus;
      if (editTier !== agent.activationTier) data.activationTier = editTier;
      if (editVerified !== (agent.isVerified ?? false)) data.isVerified = editVerified;
      if (Object.keys(data).length === 0) {
        setSaveMsg({ type: 'error', text: 'No changes to save' });
        setSaving(false);
        return;
      }
      const updated = await api.updateAdminAgent(id, data);
      setAgent(updated);
      setEditStatus(updated.status);
      setEditTier(updated.activationTier);
      setEditVerified(updated.isVerified ?? false);
      setSaveMsg({ type: 'success', text: 'Agent updated successfully' });
    } catch (err: any) {
      setSaveMsg({ type: 'error', text: err.message || 'Failed to update agent' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="text-gray-500">Loading agent...</p>;
  if (error) return <p className="text-red-600">{error}</p>;
  if (!agent) return <p className="text-gray-500">Agent not found</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/admin/agents" className="text-blue-600 hover:text-blue-800 text-sm">&larr; Back to Agents</Link>
      </div>

      <div className="bg-white rounded-lg shadow p-5">
        <div className="flex items-start gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-semibold text-gray-900">{agent.name}</h2>
              <span className={`inline-block px-2.5 py-0.5 text-xs font-medium rounded-full ${statusBadgeColors[agent.status] || 'bg-gray-100 text-gray-800'}`}>
                {agent.status}
              </span>
              <span className="text-xs text-gray-400 px-2 py-0.5 bg-gray-50 rounded">{agent.activationTier}</span>
              {agent.isVerified && (
                <span className="inline-flex items-center gap-0.5 bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full font-medium">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Verified
                </span>
              )}
            </div>
            {agent.description && <p className="text-sm text-gray-600 mt-1">{agent.description}</p>}
            {agent.websiteUrl && (
              <a href={agent.websiteUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline">{agent.websiteUrl}</a>
            )}
            {agent.contactEmail && <p className="text-sm text-gray-500 mt-1">{agent.contactEmail}</p>}
          </div>
          <div className="ml-auto text-right text-sm text-gray-400">
            <p>Registered {new Date(agent.createdAt).toLocaleDateString('en-GB')}</p>
            <p>Last active {new Date(agent.lastActiveAt).toLocaleDateString('en-GB')}</p>
          </div>
        </div>
      </div>

      <Section title="Admin Actions">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Status</label>
            <select
              value={editStatus}
              onChange={(e) => setEditStatus(e.target.value)}
              className="block w-40 rounded-md border-gray-300 shadow-sm text-sm focus:border-blue-500 focus:ring-blue-500"
            >
              {['PENDING', 'ACTIVE', 'SUSPENDED', 'BANNED'].map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Tier</label>
            <select
              value={editTier}
              onChange={(e) => setEditTier(e.target.value)}
              className="block w-40 rounded-md border-gray-300 shadow-sm text-sm focus:border-blue-500 focus:ring-blue-500"
            >
              {['BASIC', 'PRO'].map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="verified-toggle"
              checked={editVerified}
              onChange={(e) => setEditVerified(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="verified-toggle" className="text-sm text-gray-700">Verified Agent</label>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
          {saveMsg && (
            <span className={`text-sm ${saveMsg.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
              {saveMsg.text}
            </span>
          )}
        </div>
      </Section>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Section title="Activation Info">
          <Field label="Method" value={agent.activationMethod} />
          <Field label="Tier" value={agent.activationTier} />
          <Field label="Platform" value={agent.activationPlatform} />
          <Field label="Social post URL" value={agent.socialPostUrl && (
            <a href={agent.socialPostUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{agent.socialPostUrl}</a>
          )} />
          <Field label="Social audience" value={agent.socialAccountSize} />
          <Field label="Activated at" value={agent.activatedAt && new Date(agent.activatedAt).toLocaleString()} />
          <Field label="Payment tx" value={agent.paymentTxHash && (
            <span className="font-mono text-xs">{agent.paymentTxHash}</span>
          )} />
          <Field label="Payment network" value={agent.paymentNetwork} />
          <Field label="Payment amount" value={agent.paymentAmount && `$${agent.paymentAmount}`} />
        </Section>

        <Section title="Domain & Abuse">
          <Field label="Domain verified" value={agent.domainVerified ? 'Yes' : 'No'} />
          <Field label="Verified at" value={agent.verifiedAt && new Date(agent.verifiedAt).toLocaleString()} />
          <Field label="Abuse score" value={agent.abuseScore} />
          <Field label="Strikes" value={agent.abuseStrikes} />
        </Section>
      </div>

      <Section title={`Recent Jobs (${agent._count.jobs} total)`}>
        {agent.jobs.length === 0 ? (
          <p className="text-sm text-gray-400">No jobs</p>
        ) : (
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead>
              <tr>
                <th className="text-left text-xs text-gray-500 font-medium pb-2">Title</th>
                <th className="text-left text-xs text-gray-500 font-medium pb-2">Status</th>
                <th className="text-left text-xs text-gray-500 font-medium pb-2">Human</th>
                <th className="text-left text-xs text-gray-500 font-medium pb-2">Price</th>
                <th className="text-left text-xs text-gray-500 font-medium pb-2">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {agent.jobs.map((j) => (
                <tr key={j.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`/admin/jobs/${j.id}`)}>
                  <td className="py-1.5">
                    <Link to={`/admin/jobs/${j.id}`} className="text-blue-600 hover:underline">{j.title}</Link>
                  </td>
                  <td className="py-1.5">
                    <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${jobStatusColors[j.status] || 'bg-gray-100 text-gray-800'}`}>
                      {j.status}
                    </span>
                  </td>
                  <td className="py-1.5">
                    <Link to={`/admin/users/${j.human.id}`} className="text-blue-600 hover:underline">{j.human.name}</Link>
                  </td>
                  <td className="py-1.5 text-gray-600">${j.priceUsdc}</td>
                  <td className="py-1.5 text-gray-400">{new Date(j.createdAt).toLocaleDateString('en-GB')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      <Section title={`Reports (${agent._count.reports} total)`}>
        {agent.reports.length === 0 ? (
          <p className="text-sm text-gray-400">No reports</p>
        ) : (
          <div className="space-y-2">
            {agent.reports.map((r) => (
              <div key={r.id} className="border border-gray-100 rounded p-3">
                <div className="flex items-center gap-2">
                  <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${reportStatusColors[r.status] || 'bg-gray-100 text-gray-800'}`}>
                    {r.status}
                  </span>
                  <span className="text-sm font-medium text-gray-900">{r.reason}</span>
                  <span className="text-xs text-gray-400">{new Date(r.createdAt).toLocaleDateString('en-GB')}</span>
                </div>
                {r.description && <p className="text-sm text-gray-600 mt-1">{r.description}</p>}
                <p className="text-xs text-gray-400 mt-1">
                  Reported by{' '}
                  <Link to={`/admin/users/${r.reporter.id}`} className="text-blue-600 hover:underline">
                    {r.reporter.name}
                  </Link>
                  {' '}({r.reporter.email})
                </p>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}
