import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../../lib/api';
import type { AdminJobDetail as AdminJobDetailType } from '../../types/admin';

const statusColors: Record<string, string> = {
  COMPLETED: 'bg-green-100 text-green-800',
  PAID: 'bg-blue-100 text-blue-800',
  ACCEPTED: 'bg-blue-100 text-blue-800',
  PENDING: 'bg-yellow-100 text-yellow-800',
  PAYMENT_CLAIMED: 'bg-orange-100 text-orange-800',
  REJECTED: 'bg-gray-100 text-gray-800',
  CANCELLED: 'bg-gray-100 text-gray-600',
  DISPUTED: 'bg-red-100 text-red-800',
  STREAMING: 'bg-purple-100 text-purple-800',
  PAUSED: 'bg-amber-100 text-amber-800',
};

const tickStatusColors: Record<string, string> = {
  VERIFIED: 'bg-green-100 text-green-800',
  PENDING: 'bg-yellow-100 text-yellow-800',
  MISSED: 'bg-red-100 text-red-800',
  SKIPPED: 'bg-gray-100 text-gray-600',
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

export default function AdminJobDetail() {
  const { id } = useParams<{ id: string }>();
  const [job, setJob] = useState<AdminJobDetailType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    api.getAdminJob(id)
      .then(setJob)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <p className="text-gray-500">Loading job...</p>;
  if (error) return <p className="text-red-600">{error}</p>;
  if (!job) return <p className="text-gray-500">Job not found</p>;

  const isStream = job.paymentMode === 'STREAM';

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/admin/jobs" className="text-blue-600 hover:text-blue-800 text-sm">&larr; Back to Jobs</Link>
      </div>

      <div className="bg-white rounded-lg shadow p-5">
        <div className="flex items-start gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-semibold text-gray-900">{job.title}</h2>
              <span className={`inline-block px-2.5 py-0.5 text-xs font-medium rounded-full ${statusColors[job.status] || 'bg-gray-100 text-gray-800'}`}>
                {job.status}
              </span>
            </div>
            {job.category && <span className="text-xs text-gray-400">{job.category}</span>}
            <p className="text-sm text-gray-600 mt-2">{job.description}</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-semibold text-gray-900">${job.priceUsdc}</p>
            <p className="text-xs text-gray-400">{job.paymentMode}{job.paymentTiming && ` / ${job.paymentTiming}`}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Section title="Human">
          <Field label="Name" value={
            <Link to={`/admin/users/${job.human.id}`} className="text-blue-600 hover:underline">{job.human.name}</Link>
          } />
          <Field label="Email" value={job.human.email} />
          {job.human.username && <Field label="Username" value={`@${job.human.username}`} />}
        </Section>

        <Section title="Agent">
          {job.registeredAgent ? (
            <>
              <Field label="Name" value={
                <Link to={`/admin/agents/${job.registeredAgent.id}`} className="text-blue-600 hover:underline">{job.registeredAgent.name}</Link>
              } />
              <Field label="Status" value={job.registeredAgent.status} />
              <Field label="Domain verified" value={job.registeredAgent.domainVerified ? 'Yes' : 'No'} />
            </>
          ) : (
            <>
              <Field label="Name" value={job.agentName || 'Unknown'} />
              <Field label="Agent ID" value={<span className="font-mono text-xs">{job.agentId}</span>} />
            </>
          )}
        </Section>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Section title="Timestamps">
          <Field label="Created" value={new Date(job.createdAt).toLocaleString()} />
          <Field label="Accepted" value={job.acceptedAt && new Date(job.acceptedAt).toLocaleString()} />
          <Field label="Paid" value={job.paidAt && new Date(job.paidAt).toLocaleString()} />
          <Field label="Completed" value={job.completedAt && new Date(job.completedAt).toLocaleString()} />
          <Field label="Updated" value={new Date(job.updatedAt).toLocaleString()} />
          <Field label="Update count" value={job.updateCount} />
        </Section>

        <Section title="Payment">
          <Field label="Tx hash" value={job.paymentTxHash && <span className="font-mono text-xs break-all">{job.paymentTxHash}</span>} />
          <Field label="Network" value={job.paymentNetwork} />
          <Field label="Amount" value={job.paymentAmount && `$${job.paymentAmount}`} />
          <Field label="Callback URL" value={job.callbackUrl && <span className="font-mono text-xs break-all">{job.callbackUrl}</span>} />
        </Section>
      </div>

      {isStream && (
        <Section title="Stream Info">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
            <div>
              <Field label="Method" value={job.streamMethod} />
              <Field label="Interval" value={job.streamInterval} />
              <Field label="Rate" value={job.streamRateUsdc && `$${job.streamRateUsdc}/interval`} />
              <Field label="Flow rate" value={job.streamFlowRate && <span className="font-mono text-xs">{job.streamFlowRate} wei/sec</span>} />
              <Field label="Max ticks" value={job.streamMaxTicks} />
              <Field label="Network" value={job.streamNetwork} />
              <Field label="Token" value={job.streamToken} />
              <Field label="Super token" value={job.streamSuperToken} />
            </div>
            <div>
              <Field label="Sender" value={job.streamSenderAddress && <span className="font-mono text-xs">{job.streamSenderAddress}</span>} />
              <Field label="Contract" value={job.streamContractId && <span className="font-mono text-xs">{job.streamContractId}</span>} />
              <Field label="Started" value={job.streamStartedAt && new Date(job.streamStartedAt).toLocaleString()} />
              <Field label="Paused" value={job.streamPausedAt && new Date(job.streamPausedAt).toLocaleString()} />
              <Field label="Ended" value={job.streamEndedAt && new Date(job.streamEndedAt).toLocaleString()} />
              <Field label="Tick count" value={job.streamTickCount} />
              <Field label="Missed ticks" value={job.streamMissedTicks} />
              <Field label="Total paid" value={job.streamTotalPaid && `$${job.streamTotalPaid}`} />
            </div>
          </div>

          {job.streamTicks.length > 0 && (
            <div className="mt-4">
              <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">Stream Ticks</h4>
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead>
                  <tr>
                    <th className="text-left text-xs text-gray-500 font-medium pb-2">#</th>
                    <th className="text-left text-xs text-gray-500 font-medium pb-2">Status</th>
                    <th className="text-left text-xs text-gray-500 font-medium pb-2">Expected</th>
                    <th className="text-left text-xs text-gray-500 font-medium pb-2">Amount</th>
                    <th className="text-left text-xs text-gray-500 font-medium pb-2">Tx Hash</th>
                    <th className="text-left text-xs text-gray-500 font-medium pb-2">Verified</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {job.streamTicks.map((t) => (
                    <tr key={t.id}>
                      <td className="py-1.5">{t.tickNumber}</td>
                      <td className="py-1.5">
                        <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${tickStatusColors[t.status] || 'bg-gray-100 text-gray-800'}`}>
                          {t.status}
                        </span>
                      </td>
                      <td className="py-1.5 text-gray-500">{new Date(t.expectedAt).toLocaleString()}</td>
                      <td className="py-1.5 text-gray-600">{t.amount ? `$${t.amount}` : '-'}</td>
                      <td className="py-1.5 font-mono text-xs text-gray-400">{t.txHash ? `${t.txHash.slice(0, 10)}...` : '-'}</td>
                      <td className="py-1.5 text-gray-500">{t.verifiedAt ? new Date(t.verifiedAt).toLocaleString() : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>
      )}

      <Section title={`Messages (${job.messages.length})`}>
        {job.messages.length === 0 ? (
          <p className="text-sm text-gray-400">No messages</p>
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {job.messages.map((m) => (
              <div key={m.id} className={`rounded p-3 ${m.senderType === 'human' ? 'bg-blue-50' : 'bg-gray-50'}`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium text-gray-700">{m.senderName}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${m.senderType === 'human' ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-600'}`}>
                    {m.senderType}
                  </span>
                  <span className="text-xs text-gray-400">{new Date(m.createdAt).toLocaleString()}</span>
                </div>
                <p className="text-sm text-gray-800 whitespace-pre-wrap">{m.content}</p>
              </div>
            ))}
          </div>
        )}
      </Section>

      {job.review && (
        <Section title="Review">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium">{'★'.repeat(job.review.rating)}{'☆'.repeat(5 - job.review.rating)}</span>
            <span className="text-xs text-gray-400">{new Date(job.review.createdAt).toLocaleDateString()}</span>
          </div>
          {job.review.comment && <p className="text-sm text-gray-600">{job.review.comment}</p>}
        </Section>
      )}
    </div>
  );
}
