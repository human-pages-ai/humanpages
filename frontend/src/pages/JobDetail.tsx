import { useState, useEffect, useRef } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { useAuth } from '../hooks/useAuth';
import { api } from '../lib/api';
import { posthog } from '../lib/posthog';
import { Job, JobMessage } from '../components/dashboard/types';
import { getExplorerTxUrl } from '../lib/blockchain';
import ConfirmDialog from '../components/ConfirmDialog';
import SEO from '../components/SEO';
import Footer from '../components/Footer';
import ReportAgentModal from '../components/ReportAgentModal';

interface AgentReputation {
  totalJobs: number;
  completedJobs: number;
  paidJobs: number;
  avgPaymentSpeedHours: number | null;
}

interface AgentInfo {
  id: string;
  name: string;
  description?: string;
  websiteUrl?: string;
  domainVerified: boolean;
  createdAt: string;
  reputation: AgentReputation;
}

export default function JobDetail() {
  const { t, i18n } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [job, setJob] = useState<Job | null>(null);
  const [agentInfo, setAgentInfo] = useState<AgentInfo | null>(null);
  const [messages, setMessages] = useState<JobMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({ open: false, title: '', message: '', onConfirm: () => {} });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [showReportModal, setShowReportModal] = useState(false);

  useEffect(() => {
    if (id) {
      loadJob();
      loadMessages();
    }
  }, [id]);

  // Fetch agent reputation once we have the job
  useEffect(() => {
    if (job?.registeredAgent?.id) {
      api.getAgent(job.registeredAgent.id)
        .then(setAgentInfo)
        .catch(() => {}); // Silent — reputation is supplementary
    }
  }, [job?.registeredAgent?.id]);

  // Poll for new messages every 5s
  useEffect(() => {
    if (!id || !job) return;
    const allowedStatuses = ['PENDING', 'ACCEPTED', 'PAID'];
    if (!allowedStatuses.includes(job.status)) return;

    const interval = setInterval(loadMessages, 5000);
    return () => clearInterval(interval);
  }, [id, job?.status]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const loadJob = async () => {
    try {
      const data = await api.getJob(id!);
      setJob(data);
    } catch (error: any) {
      toast.error(error.message || t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async () => {
    try {
      const data = await api.getJobMessages(id!);
      setMessages(data);
    } catch {
      // Silent — may fail if user doesn't own job (public view)
    }
  };

  const sendMessage = async () => {
    if (!messageText.trim() || sending) return;
    setSending(true);
    try {
      await api.sendJobMessage(id!, messageText.trim());
      setMessageText('');
      await loadMessages();
      posthog.capture('job_message_sent', { jobId: id });
    } catch (error: any) {
      toast.error(error.message || t('common.error'));
    } finally {
      setSending(false);
    }
  };

  const handleAccept = async () => {
    try {
      await api.acceptJob(id!);
      posthog.capture('job_accepted', { jobId: id });
      toast.success(t('toast.jobAccepted'));
      await loadJob();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleReject = () => {
    setConfirmDialog({
      open: true,
      title: t('jobDetail.confirmReject'),
      message: t('jobDetail.confirmRejectMessage'),
      onConfirm: async () => {
        setConfirmDialog(d => ({ ...d, open: false }));
        try {
          await api.rejectJob(id!);
          posthog.capture('job_rejected', { jobId: id });
          toast.success(t('toast.jobRejected'));
          await loadJob();
        } catch (error: any) {
          toast.error(error.message);
        }
      },
    });
  };

  const handleComplete = async () => {
    try {
      await api.completeJob(id!);
      posthog.capture('job_completed', { jobId: id });
      toast.success(t('toast.jobCompleted'));
      await loadJob();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const getStatusBadge = (status: Job['status']) => {
    const styles: Record<Job['status'], string> = {
      PENDING: 'bg-yellow-100 text-yellow-700',
      ACCEPTED: 'bg-blue-100 text-blue-700',
      REJECTED: 'bg-gray-100 text-gray-700',
      PAID: 'bg-green-100 text-green-700',
      COMPLETED: 'bg-purple-100 text-purple-700',
      CANCELLED: 'bg-gray-100 text-gray-700',
      DISPUTED: 'bg-red-100 text-red-700',
    };
    return styles[status] || 'bg-gray-100 text-gray-700';
  };

  const isOwner = user && job && (job as any).humanId === user.id;
  const canMessage = job && ['PENDING', 'ACCEPTED', 'PAID'].includes(job.status);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">{t('common.loading')}</div>;
  }

  if (!job) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-gray-600">{t('errors.notFound')}</p>
        <Link to="/dashboard" className="text-blue-600 hover:text-blue-800">{t('jobDetail.backToDashboard')}</Link>
      </div>
    );
  }

  const rep = agentInfo?.reputation;

  return (
    <div className="min-h-screen bg-gray-50">
      <SEO title={job.title} noindex />

      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Back link */}
        <Link to="/dashboard" className="text-sm text-blue-600 hover:text-blue-800 mb-6 inline-flex items-center gap-1">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          {t('jobDetail.backToDashboard')}
        </Link>

        {/* Wallet nudge banner */}
        {isOwner && user && !user.hasWallet && (
          <div className="bg-amber-50 border border-amber-300 rounded-lg p-4 mt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-amber-800">{t('jobDetail.walletNudge.title')}</p>
                <p className="text-xs text-amber-700 mt-1">{t('jobDetail.walletNudge.description')}</p>
              </div>
              <button
                onClick={() => navigate('/dashboard?tab=payments')}
                className="ml-4 text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 px-3 py-1.5 rounded whitespace-nowrap"
              >
                {t('jobDetail.walletNudge.action')}
              </button>
            </div>
          </div>
        )}

        {/* Job header card */}
        <div className="bg-white rounded-lg shadow p-6 mt-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-xl font-semibold">{job.title}</h1>
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${getStatusBadge(job.status)}`}>
                  {t(`dashboard.jobs.status.${job.status}`)}
                </span>
                {(job.updateCount ?? 0) > 0 && (
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-amber-100 text-amber-700">
                    {t('jobDetail.updated')}
                  </span>
                )}
              </div>

              {/* Agent info */}
              <div className="flex items-center gap-2 mt-3 text-sm text-gray-600">
                <span>{t('dashboard.jobs.from')}:</span>
                {job.registeredAgent ? (
                  <span className="flex items-center gap-1.5">
                    <span className="font-medium">{job.registeredAgent.name}</span>
                    {job.registeredAgent.domainVerified && (
                      <span className="inline-flex items-center gap-0.5 bg-blue-100 text-blue-700 text-xs px-1.5 py-0.5 rounded-full">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        {t('jobDetail.verified')}
                      </span>
                    )}
                    {job.registeredAgent.websiteUrl && (
                      <a
                        href={job.registeredAgent.websiteUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800"
                      >
                        {new URL(job.registeredAgent.websiteUrl).hostname}
                      </a>
                    )}
                  </span>
                ) : job.agentName ? (
                  <span className="font-medium">{job.agentName}</span>
                ) : null}
              </div>
            </div>

            <div className="text-right">
              <p className="text-2xl font-bold text-green-600">${job.priceUsdc}</p>
              <p className="text-xs text-gray-500">USDC</p>
            </div>
          </div>

          {/* Agent reputation card */}
          {rep && (
            <div className="mt-4 bg-gray-50 rounded-lg p-4 border border-gray-200">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">{t('jobDetail.agentReputation')}</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="text-center">
                  <p className="text-lg font-bold text-gray-900">{rep.totalJobs}</p>
                  <p className="text-xs text-gray-500">{t('jobDetail.totalJobs')}</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-gray-900">
                    {rep.totalJobs > 0 ? Math.round((rep.completedJobs / rep.totalJobs) * 100) : 0}%
                  </p>
                  <p className="text-xs text-gray-500">{t('jobDetail.completionRate')}</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-gray-900">
                    {rep.totalJobs > 0 ? Math.round((rep.paidJobs / rep.totalJobs) * 100) : 0}%
                  </p>
                  <p className="text-xs text-gray-500">{t('jobDetail.paymentRate')}</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-gray-900">
                    {rep.avgPaymentSpeedHours != null ? `${rep.avgPaymentSpeedHours}h` : '--'}
                  </p>
                  <p className="text-xs text-gray-500">{t('jobDetail.avgPaySpeed')}</p>
                </div>
              </div>
              {agentInfo?.createdAt && (
                <p className="text-xs text-gray-400 mt-3 text-center">
                  {t('jobDetail.memberSince', { date: new Date(agentInfo.createdAt).toLocaleDateString(i18n.language, { year: 'numeric', month: 'short' }) })}
                </p>
              )}
              {user && (
                <div className="mt-3 text-center">
                  <button
                    onClick={() => setShowReportModal(true)}
                    className="text-xs text-gray-400 hover:text-red-500 transition-colors"
                  >
                    {t('reportAgent.reportThis', 'Report this listing')}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Category */}
          {job.category && (
            <div className="mt-3">
              <span className="bg-gray-100 text-gray-700 text-xs px-2.5 py-1 rounded">{job.category}</span>
            </div>
          )}

          {/* Description */}
          <div className="mt-4">
            <h2 className="text-sm font-medium text-gray-700 mb-1">{t('jobDetail.description')}</h2>
            <p className="text-gray-800 whitespace-pre-wrap">{job.description}</p>
          </div>

          {/* Timestamps */}
          <div className="mt-4 flex flex-wrap gap-4 text-xs text-gray-500">
            <span>{t('jobDetail.created')}: {new Date(job.createdAt).toLocaleDateString(i18n.language, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
            {job.lastUpdatedByAgent && <span>{t('jobDetail.lastUpdated')}: {new Date(job.lastUpdatedByAgent).toLocaleDateString(i18n.language, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>}
            {job.acceptedAt && <span>{t('jobDetail.accepted')}: {new Date(job.acceptedAt).toLocaleDateString(i18n.language, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>}
            {job.paidAt && <span>{t('jobDetail.paid')}: {new Date(job.paidAt).toLocaleDateString(i18n.language, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>}
            {job.paymentTxHash && job.paymentNetwork && (() => {
              const explorerUrl = getExplorerTxUrl(job.paymentNetwork, job.paymentTxHash);
              return explorerUrl ? (
                <a
                  href={explorerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800"
                >
                  {t('jobDetail.viewTransaction', 'View transaction')}
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              ) : null;
            })()}
            {job.completedAt && <span>{t('jobDetail.completed')}: {new Date(job.completedAt).toLocaleDateString(i18n.language, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>}
          </div>

          {/* Review display */}
          {job.review && (
            <div className="mt-4 p-3 bg-purple-50 rounded-lg">
              <div className="flex items-center gap-2">
                <span className="text-yellow-500">{'★'.repeat(job.review.rating)}{'☆'.repeat(5 - job.review.rating)}</span>
                <span className="text-sm text-gray-600">{t('dashboard.jobs.reviewReceived')}</span>
              </div>
              {job.review.comment && (
                <p className="text-sm text-gray-700 mt-1">"{job.review.comment}"</p>
              )}
            </div>
          )}

          {/* Action buttons */}
          {isOwner && (
            <div className="mt-6 flex gap-3">
              {job.status === 'PENDING' && (
                <>
                  <button
                    onClick={handleAccept}
                    className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700"
                  >
                    {t('dashboard.jobs.accept')}
                  </button>
                  <button
                    onClick={handleReject}
                    className="px-4 py-2 bg-gray-200 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-300"
                  >
                    {t('dashboard.jobs.reject')}
                  </button>
                </>
              )}
              {job.status === 'ACCEPTED' && (
                <div className="flex flex-col gap-2">
                  <span className="text-sm text-blue-600 font-medium">{t('dashboard.jobs.awaitingPayment')}</span>
                  {job.human?.paymentPreferences?.includes('UPON_COMPLETION') && (
                    <>
                      <span className="text-xs text-gray-500">{t('dashboard.jobs.completeBeforePayment')}</span>
                      <button
                        onClick={handleComplete}
                        className="px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-md hover:bg-purple-700"
                      >
                        {t('dashboard.jobs.markComplete')}
                      </button>
                    </>
                  )}
                </div>
              )}
              {job.status === 'PAID' && (
                <button
                  onClick={handleComplete}
                  className="px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-md hover:bg-purple-700"
                >
                  {t('dashboard.jobs.markComplete')}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Message thread */}
        {isOwner && (
          <div className="bg-white rounded-lg shadow mt-6 p-6">
            <h2 className="text-lg font-semibold mb-4">{t('jobDetail.messages')}</h2>

            {messages.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-8">{t('jobDetail.noMessages')}</p>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto mb-4">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.senderType === 'human' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[75%] rounded-lg px-4 py-2 ${
                        msg.senderType === 'human'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      <p className={`text-xs font-medium mb-1 ${msg.senderType === 'human' ? 'text-blue-200' : 'text-gray-500'}`}>
                        {msg.senderType === 'human' ? t('jobDetail.you') : msg.senderName}
                      </p>
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                      <p className={`text-xs mt-1 ${msg.senderType === 'human' ? 'text-blue-200' : 'text-gray-400'}`}>
                        {new Date(msg.createdAt).toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}

            {/* Message input */}
            {canMessage && (
              <div className="flex gap-2">
                <textarea
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                  placeholder={t('jobDetail.messagePlaceholder')}
                  className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={2}
                  maxLength={2000}
                />
                <button
                  onClick={sendMessage}
                  disabled={!messageText.trim() || sending}
                  className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed self-end"
                >
                  {t('jobDetail.send')}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmDialog.open}
        title={confirmDialog.title}
        message={confirmDialog.message}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog(d => ({ ...d, open: false }))}
      />

      <Footer className="mt-12" />

      {job?.registeredAgent && (
        <ReportAgentModal
          isOpen={showReportModal}
          onClose={() => setShowReportModal(false)}
          agentId={job.registeredAgent.id}
          agentName={job.registeredAgent.name}
          jobId={job.id}
        />
      )}
    </div>
  );
}
