import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';

interface AgentReputationData {
  id: string;
  name: string;
  createdAt: string;
  reputation: {
    totalJobs: number;
    completedJobs: number;
    paidJobs: number;
    avgPaymentSpeedHours: number | null;
  };
}

interface AgentReputationProps {
  agentId: string;
  compact?: boolean;
}

export default function AgentReputation({ agentId, compact = false }: AgentReputationProps) {
  const { t, i18n } = useTranslation();
  const [data, setData] = useState<AgentReputationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const loadReputation = async () => {
      try {
        setLoading(true);
        const agentData = await api.getAgent(agentId);
        setData(agentData);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    loadReputation();
  }, [agentId]);

  if (loading) {
    return <div className={compact ? 'text-xs text-gray-500' : 'text-sm text-gray-500'}>Loading...</div>;
  }

  if (error || !data) {
    return (
      <div className={compact ? 'text-xs text-gray-600' : 'text-sm text-gray-600'}>
        New Agent
      </div>
    );
  }

  const { reputation, createdAt } = data;
  const isNewAgent = reputation.totalJobs === 0;
  const completionRate = reputation.totalJobs > 0
    ? Math.round((reputation.completedJobs / reputation.totalJobs) * 100)
    : 0;
  const paymentRate = reputation.totalJobs > 0
    ? Math.round((reputation.paidJobs / reputation.totalJobs) * 100)
    : 0;

  // Compact mode: inline single line
  if (compact) {
    return (
      <div className="text-xs text-gray-600">
        {isNewAgent ? (
          <span>New Agent</span>
        ) : (
          <span>
            {reputation.completedJobs} job{reputation.completedJobs !== 1 ? 's' : ''} completed
          </span>
        )}
      </div>
    );
  }

  // Expanded mode: full breakdown
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">
        {t('jobDetail.agentReputation', 'Agent Reputation')}
      </h3>

      {isNewAgent ? (
        <div className="text-center py-4">
          <p className="text-sm text-gray-600">New Agent</p>
          <p className="text-xs text-gray-500 mt-1">No jobs completed yet</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Total Jobs */}
          <div>
            <p className="text-2xl font-bold text-gray-900">{reputation.totalJobs}</p>
            <p className="text-xs text-gray-500">{t('jobDetail.totalJobs', 'Total Jobs')}</p>
          </div>

          {/* Completion Rate */}
          <div>
            <p className="text-lg font-bold text-gray-900">{completionRate}%</p>
            <p className="text-xs text-gray-500">{t('jobDetail.completionRate', 'Completion Rate')}</p>
          </div>

          {/* Payment Rate */}
          <div>
            <p className="text-lg font-bold text-gray-900">{paymentRate}%</p>
            <p className="text-xs text-gray-500">{t('jobDetail.paymentRate', 'Payment Rate')}</p>
          </div>

          {/* Average Payment Speed */}
          {reputation.avgPaymentSpeedHours !== null && (
            <div>
              <p className="text-lg font-bold text-gray-900">
                {reputation.avgPaymentSpeedHours}h
              </p>
              <p className="text-xs text-gray-500">{t('jobDetail.avgPaySpeed', 'Avg Payment Speed')}</p>
            </div>
          )}

          {/* Member Since */}
          <div className="pt-2 border-t border-gray-200">
            <p className="text-xs text-gray-500">
              {t('jobDetail.memberSince', 'Member since')}:{' '}
              <span className="text-gray-700 font-medium">
                {new Date(createdAt).toLocaleDateString(i18n.language, {
                  year: 'numeric',
                  month: 'short',
                })}
              </span>
            </p>
          </div>

          {/* Verified Badge */}
          {reputation.completedJobs >= 5 && (
            <div className="pt-2">
              <span className="inline-flex items-center gap-1 bg-green-100 text-green-800 text-xs font-medium px-2.5 py-1 rounded-full">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                Trusted Agent
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
