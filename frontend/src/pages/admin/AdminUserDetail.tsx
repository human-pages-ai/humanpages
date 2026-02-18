import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import type { AdminUserDetail as AdminUserDetailType } from '../../types/admin';

const statusColors: Record<string, string> = {
  COMPLETED: 'bg-green-100 text-green-800',
  PAID: 'bg-blue-100 text-blue-800',
  ACCEPTED: 'bg-blue-100 text-blue-800',
  PENDING: 'bg-yellow-100 text-yellow-800',
  PAYMENT_CLAIMED: 'bg-orange-100 text-orange-800',
  REJECTED: 'bg-gray-100 text-gray-800',
  CANCELLED: 'bg-gray-100 text-gray-600',
  DISPUTED: 'bg-red-100 text-red-800',
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

export default function AdminUserDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [user, setUser] = useState<AdminUserDetailType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    api.getAdminUser(id)
      .then(setUser)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <p className="text-gray-500">Loading user...</p>;
  if (error) return <p className="text-red-600">{error}</p>;
  if (!user) return <p className="text-gray-500">User not found</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/admin/users" className="text-blue-600 hover:text-blue-800 text-sm">&larr; Back to Users</Link>
      </div>

      <div className="bg-white rounded-lg shadow p-5">
        <div className="flex items-start gap-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">{user.name}</h2>
            {user.username && <p className="text-sm text-gray-500">@{user.username}</p>}
            <p className="text-sm text-gray-600">{user.email}</p>
            {user.location && <p className="text-sm text-gray-400">{user.location}</p>}
          </div>
          <div className="ml-auto text-right text-sm text-gray-400">
            <p>Joined {new Date(user.createdAt).toLocaleDateString()}</p>
            <p>Last active {new Date(user.lastActiveAt).toLocaleDateString()}</p>
            <p className={user.isAvailable ? 'text-green-600' : 'text-gray-400'}>
              {user.isAvailable ? 'Available' : 'Not available'}
            </p>
          </div>
        </div>
        {user.bio && <p className="mt-3 text-sm text-gray-700">{user.bio}</p>}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Section title="Verification">
          <Field label="Email" value={user.emailVerified ? 'Verified' : 'Not verified'} />
          <Field label="LinkedIn" value={user.linkedinVerified ? 'Verified' : 'Not verified'} />
          <Field label="GitHub" value={user.githubVerified ? `Verified (${user.githubUsername || 'connected'})` : 'Not verified'} />
          <Field label="Humanity" value={
            user.humanityVerified
              ? `Verified (${user.humanityProvider}, score: ${user.humanityScore})`
              : 'Not verified'
          } />
          {user.humanityVerifiedAt && <Field label="Humanity verified at" value={new Date(user.humanityVerifiedAt).toLocaleDateString()} />}
        </Section>

        <Section title="Contact">
          <Field label="Contact email" value={user.contactEmail} />
          <Field label="Telegram" value={user.telegram} />
          <Field label="WhatsApp" value={user.whatsapp} />
          <Field label="Signal" value={user.signal} />
          <Field label="Hide contact" value={user.hideContact ? 'Yes' : 'No'} />
        </Section>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Section title="Skills & Equipment">
          {user.skills.length > 0 ? (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {user.skills.map((s) => (
                <span key={s} className="px-2 py-0.5 text-xs bg-blue-50 text-blue-700 rounded-full">{s}</span>
              ))}
            </div>
          ) : <p className="text-sm text-gray-400">No skills listed</p>}
          {user.equipment.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {user.equipment.map((e) => (
                <span key={e} className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded-full">{e}</span>
              ))}
            </div>
          )}
          {user.languages.length > 0 && (
            <Field label="Languages" value={user.languages.join(', ')} />
          )}
        </Section>

        <Section title="Economics">
          <Field label="Min rate" value={user.minRateUsdc ? `$${user.minRateUsdc} ${user.rateCurrency}` : 'Not set'} />
          <Field label="Rate type" value={user.rateType} />
          <Field label="Work mode" value={user.workMode} />
          <Field label="Payment prefs" value={user.paymentPreferences.join(', ')} />
        </Section>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Section title="Social Links">
          <Field label="LinkedIn" value={user.linkedinUrl && <a href={user.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{user.linkedinUrl}</a>} />
          <Field label="Twitter" value={user.twitterUrl && <a href={user.twitterUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{user.twitterUrl}</a>} />
          <Field label="GitHub" value={user.githubUrl && <a href={user.githubUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{user.githubUrl}</a>} />
          <Field label="Instagram" value={user.instagramUrl && <a href={user.instagramUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{user.instagramUrl}</a>} />
          <Field label="YouTube" value={user.youtubeUrl && <a href={user.youtubeUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{user.youtubeUrl}</a>} />
          <Field label="Website" value={user.websiteUrl && <a href={user.websiteUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{user.websiteUrl}</a>} />
        </Section>

        <Section title="Referral & Affiliate">
          <Field label="Referral code" value={user.referralCode} />
          <Field label="Referred by" value={user.referredBy} />
          <Field label="Referral count" value={user.referralCount} />
          {user.affiliate && (
            <>
              <Field label="Affiliate status" value={user.affiliate.status} />
              <Field label="Total signups" value={user.affiliate.totalSignups} />
              <Field label="Qualified" value={user.affiliate.qualifiedSignups} />
              <Field label="Credits" value={`${user.affiliate.totalCredits} total, ${user.affiliate.creditsRedeemed} redeemed`} />
            </>
          )}
        </Section>
      </div>

      <Section title="Wallets">
        {user.wallets.length === 0 ? (
          <p className="text-sm text-gray-400">No wallets</p>
        ) : (
          <div className="space-y-2">
            {user.wallets.map((w) => (
              <div key={w.id} className="flex items-center gap-2 text-sm">
                <span className="px-2 py-0.5 text-xs bg-gray-100 rounded">{w.network}{w.chain ? ` (${w.chain})` : ''}</span>
                <span className="font-mono text-gray-600 text-xs">{w.address}</span>
                {w.label && <span className="text-gray-400">({w.label})</span>}
                {w.isPrimary && <span className="text-xs text-green-600 font-medium">Primary</span>}
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title="Services">
        {user.services.length === 0 ? (
          <p className="text-sm text-gray-400">No services</p>
        ) : (
          <div className="space-y-2">
            {user.services.map((s) => (
              <div key={s.id} className="border border-gray-100 rounded p-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900">{s.title}</span>
                  <span className="text-xs text-gray-400">{s.category}</span>
                  {s.priceMin && <span className="text-xs text-gray-500">${s.priceMin} {s.priceCurrency}</span>}
                  <span className={`text-xs ${s.isActive ? 'text-green-600' : 'text-gray-400'}`}>{s.isActive ? 'Active' : 'Inactive'}</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">{s.description}</p>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title={`Recent Jobs (${user._count.jobs} total)`}>
        {user.jobs.length === 0 ? (
          <p className="text-sm text-gray-400">No jobs</p>
        ) : (
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead>
              <tr>
                <th className="text-left text-xs text-gray-500 font-medium pb-2">Title</th>
                <th className="text-left text-xs text-gray-500 font-medium pb-2">Status</th>
                <th className="text-left text-xs text-gray-500 font-medium pb-2">Agent</th>
                <th className="text-left text-xs text-gray-500 font-medium pb-2">Price</th>
                <th className="text-left text-xs text-gray-500 font-medium pb-2">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {user.jobs.map((j) => (
                <tr key={j.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`/admin/jobs/${j.id}`)}>
                  <td className="py-1.5">
                    <Link to={`/admin/jobs/${j.id}`} className="text-blue-600 hover:underline">{j.title}</Link>
                  </td>
                  <td className="py-1.5">
                    <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${statusColors[j.status] || 'bg-gray-100 text-gray-800'}`}>
                      {j.status}
                    </span>
                  </td>
                  <td className="py-1.5 text-gray-600">
                    {j.registeredAgent ? (
                      <Link to={`/admin/agents/${j.registeredAgent.id}`} className="text-blue-600 hover:underline">{j.registeredAgent.name}</Link>
                    ) : j.agentName || 'Unknown'}
                  </td>
                  <td className="py-1.5 text-gray-600">${j.priceUsdc}</td>
                  <td className="py-1.5 text-gray-400">{new Date(j.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      <Section title={`Reviews (${user._count.reviews} total)`}>
        {user.reviews.length === 0 ? (
          <p className="text-sm text-gray-400">No reviews</p>
        ) : (
          <div className="space-y-2">
            {user.reviews.map((r) => (
              <div key={r.id} className="border border-gray-100 rounded p-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</span>
                  <Link to={`/admin/jobs/${r.jobId}`} className="text-xs text-blue-600 hover:underline">View job</Link>
                  <span className="text-xs text-gray-400">{new Date(r.createdAt).toLocaleDateString()}</span>
                </div>
                {r.comment && <p className="text-sm text-gray-600 mt-1">{r.comment}</p>}
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title="Vouches">
        <div className="flex gap-4 text-sm">
          <span className="text-gray-600">Given: <strong>{user._count.vouchesGiven}</strong></span>
          <span className="text-gray-600">Received: <strong>{user._count.vouchesReceived}</strong></span>
        </div>
      </Section>
    </div>
  );
}
