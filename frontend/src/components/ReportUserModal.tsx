import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { XMarkIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { api } from '../lib/api';

interface ReportUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetUserId: string;
  targetUserName: string;
}

const REASONS = ['SPAM', 'FRAUD', 'HARASSMENT', 'IRRELEVANT', 'OTHER'] as const;

export default function ReportUserModal({ isOpen, onClose, targetUserId, targetUserName }: ReportUserModalProps) {
  const { t } = useTranslation();
  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Reset form when opening
  useEffect(() => {
    if (isOpen) {
      setReason('');
      setDescription('');
      setSubmitted(false);
    }
  }, [isOpen]);

  // Escape key to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!reason) return;

    setSubmitting(true);
    try {
      await api.reportUser(targetUserId, {
        reason,
        description: description.trim() || undefined,
      });
      setSubmitted(true);
      toast.success(t('reportUser.submitted', 'Report submitted'));
      setTimeout(() => onClose(), 2000);
    } catch (err: any) {
      toast.error(err.message || t('reportUser.error', 'Failed to submit report'));
    } finally {
      setSubmitting(false);
    }
  }

  if (!isOpen) return null;

  // Success state
  if (submitted) {
    return createPortal(
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
        <div className="fixed inset-0 bg-black/40" onClick={onClose} />
        <div className="relative bg-white rounded-xl shadow-2xl max-w-md w-full p-8 text-center">
          <div className="text-4xl mb-4 text-green-600">&#10003;</div>
          <h3 className="text-lg font-semibold text-gray-900">
            {t('reportUser.submitted', 'Report Submitted')}
          </h3>
          <p className="text-sm text-gray-500 mt-2">
            {t('reportUser.submittedDesc', 'Thank you. We will review your report and take action if necessary.')}
          </p>
        </div>
      </div>,
      document.body
    );
  }

  // Form modal
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true" aria-label={t('reportUser.title', 'Report User')}>
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-t-2xl sm:rounded-xl shadow-2xl w-full sm:max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 flex items-center justify-between rounded-t-2xl sm:rounded-t-xl z-10">
          <h2 className="text-base font-semibold text-gray-900">
            {t('reportUser.title', 'Report User')}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100 transition-colors"
            aria-label={t('common.cancel')}
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
          <p className="text-sm text-gray-600">
            {t('reportUser.description', 'If you believe this person is engaging in spam, fraud, or other abusive behavior, please submit a report.')}
          </p>

          {/* Reporting user name */}
          <div className="text-sm text-gray-500">
            {t('reportUser.reporting', 'Reporting')}: <span className="font-medium text-gray-900">{targetUserName}</span>
          </div>

          {/* Reason */}
          <div>
            <label htmlFor="report-reason" className="text-xs font-medium text-gray-600 mb-1 block">
              {t('reportUser.reasonLabel', 'Reason')}
              <span className="text-red-400 ml-0.5">*</span>
            </label>
            <select
              id="report-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 outline-none"
            >
              <option value="">{t('reportUser.selectReason', 'Select a reason')}</option>
              {REASONS.map((r) => (
                <option key={r} value={r}>
                  {t(`reportUser.reasons.${r.toLowerCase()}`, r)}
                </option>
              ))}
            </select>
          </div>

          {/* Description */}
          <div>
            <label htmlFor="report-description" className="text-xs font-medium text-gray-600 mb-1 block">
              {t('reportUser.descriptionLabel', 'Additional details (optional)')}
            </label>
            <textarea
              id="report-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={1000}
              rows={4}
              placeholder={t('reportUser.descriptionPlaceholder', 'Describe what happened...')}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 outline-none resize-none"
            />
            <p className="text-xs text-gray-400 mt-1 text-right">{description.length}/1000</p>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting || !reason}
            className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-300 text-white font-medium py-2.5 rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                {t('reportUser.submitting', 'Submitting...')}
              </>
            ) : (
              t('reportUser.submit', 'Submit Report')
            )}
          </button>
        </form>
      </div>
    </div>,
    document.body
  );
}
