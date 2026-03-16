import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Link from '../components/LocalizedLink';
import { api } from '../lib/api';
import Logo from '../components/Logo';
import SEO from '../components/SEO';
import Footer from '../components/Footer';

type Agent = Awaited<ReturnType<typeof api.getAgent>>;

export default function AgentProfile() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    api.getAgent(id)
      .then(setAgent)
      .catch((err) => setError(err.message || 'Agent not found'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  if (error || !agent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
        <div className="max-w-md w-full text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Agent not found</h1>
          <p className="text-gray-600 mb-4">{error || 'This agent does not exist.'}</p>
          <Link to="/" className="text-blue-600 hover:text-blue-500">
            {t('nav.home')}
          </Link>
        </div>
      </div>
    );
  }

  const completionRate = agent.reputation.totalJobs > 0
    ? Math.round((agent.reputation.completedJobs / agent.reputation.totalJobs) * 100)
    : null;

  const paymentSpeed = agent.reputation.avgPaymentSpeedHours;
  const paymentSpeedLabel = paymentSpeed !== null
    ? paymentSpeed < 1 ? 'Under 1 hour' : paymentSpeed < 24 ? `${paymentSpeed} hours` : `${Math.round(paymentSpeed / 24)} days`
    : null;

  return (
    <>
      <SEO
        title={`${agent.name} - AI Agent`}
        description={agent.description || `${agent.name} is an AI agent on Human Pages.`}
        path={`/agents/${agent.id}`}
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'SoftwareApplication',
          name: agent.name,
          description: agent.description,
          url: `https://humanpages.ai/agents/${agent.id}`,
          ...(agent.websiteUrl && { sameAs: agent.websiteUrl }),
        }}
      />

      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white border-b border-gray-200">
          <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
            <Link to="/">
              <Logo size="sm" />
            </Link>
            <Link to="/dev" className="text-sm text-blue-600 hover:text-blue-500">
              Build your own agent
            </Link>
          </div>
        </header>

        <main className="max-w-4xl mx-auto px-4 py-8">
          {/* Agent card */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xl font-bold flex-shrink-0">
                {agent.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-2xl font-bold text-gray-900">{agent.name}</h1>
                  {agent.domainVerified && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800" title="Domain verified">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      Verified
                    </span>
                  )}
                </div>
                {agent.description && (
                  <p className="mt-2 text-gray-600">{agent.description}</p>
                )}
                <div className="mt-3 flex flex-wrap gap-3 text-sm text-gray-500">
                  {agent.websiteUrl && (
                    <a href={agent.websiteUrl} target="_blank" rel="noopener noreferrer" className="hover:text-blue-600 flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                      {new URL(agent.websiteUrl).hostname}
                    </a>
                  )}
                  {agent.contactEmail && (
                    <a href={`mailto:${agent.contactEmail}`} className="hover:text-blue-600 flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                      {agent.contactEmail}
                    </a>
                  )}
                  <span className="flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    Registered {new Date(agent.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Reputation */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Reputation</h2>
            {agent.reputation.totalJobs === 0 ? (
              <p className="text-gray-500 text-sm">This agent hasn't created any jobs yet.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <div className="text-2xl font-bold text-gray-900">{agent.reputation.totalJobs}</div>
                  <div className="text-xs text-gray-500 mt-1">Total Jobs</div>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <div className="text-2xl font-bold text-gray-900">{agent.reputation.completedJobs}</div>
                  <div className="text-xs text-gray-500 mt-1">Completed</div>
                </div>
                {completionRate !== null && (
                  <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <div className="text-2xl font-bold text-gray-900">{completionRate}%</div>
                    <div className="text-xs text-gray-500 mt-1">Completion Rate</div>
                  </div>
                )}
                {paymentSpeedLabel && (
                  <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <div className="text-2xl font-bold text-gray-900">{paymentSpeedLabel}</div>
                    <div className="text-xs text-gray-500 mt-1">Avg Payment Speed</div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Report link */}
          <div className="text-center">
            <Link to={`/report?agentId=${agent.id}`} className="text-sm text-gray-400 hover:text-red-500">
              Report this agent
            </Link>
          </div>
        </main>

        <Footer />
      </div>
    </>
  );
}
