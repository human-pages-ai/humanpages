import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { api } from '../lib/api';

interface AgentReviewFormProps {
  jobId: string;
  agentName: string;
  onSuccess: () => void;
}

export default function AgentReviewForm({ jobId, agentName, onSuccess }: AgentReviewFormProps) {
  const { t } = useTranslation();
  const [rating, setRating] = useState<number>(5);
  const [comment, setComment] = useState('');
  const [paymentSpeed, setPaymentSpeed] = useState<number | null>(null);
  const [communication, setCommunication] = useState<number | null>(null);
  const [scopeAccuracy, setScopeAccuracy] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    try {
      await api.submitAgentReview({
        jobId,
        rating,
        comment: comment.trim() || undefined,
        paymentSpeed: paymentSpeed || undefined,
        communication: communication || undefined,
        scopeAccuracy: scopeAccuracy || undefined,
      });
      toast.success('Review submitted successfully');
      onSuccess();
    } catch (error: any) {
      toast.error(error.message || 'Failed to submit review');
    } finally {
      setSubmitting(false);
    }
  };

  const StarRating = ({ value, onChange, label }: { value: number | null; onChange: (v: number) => void; label?: string }) => (
    <div className="flex items-center gap-2">
      {label && <label className="text-sm font-medium text-gray-700">{label}</label>}
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star)}
            className={`text-2xl transition-colors ${
              (value ?? 0) >= star ? 'text-yellow-400' : 'text-gray-300 hover:text-yellow-200'
            }`}
          >
            ★
          </button>
        ))}
      </div>
      {value && <span className="text-sm text-gray-600 ml-2">{value}/5</span>}
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-6 bg-white p-6 rounded-lg border border-gray-200">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          {t('agentReview.title', 'Review {{agentName}}', { agentName })}
        </h3>
        <p className="text-sm text-gray-600">
          {t('agentReview.description', 'Help other humans understand your experience with this agent')}
        </p>
      </div>

      {/* Overall Rating */}
      <div className="space-y-3">
        <StarRating
          value={rating}
          onChange={setRating}
          label={t('agentReview.overallRating', 'Overall Rating')}
        />
      </div>

      {/* Dimension Ratings */}
      <div className="space-y-4 pt-4 border-t border-gray-200">
        <p className="text-sm font-medium text-gray-700">
          {t('agentReview.dimensions', 'Optional: Rate specific dimensions')}
        </p>
        <StarRating
          value={paymentSpeed}
          onChange={setPaymentSpeed}
          label={t('agentReview.paymentSpeed', 'Payment Speed')}
        />
        <StarRating
          value={communication}
          onChange={setCommunication}
          label={t('agentReview.communication', 'Communication')}
        />
        <StarRating
          value={scopeAccuracy}
          onChange={setScopeAccuracy}
          label={t('agentReview.scopeAccuracy', 'Job Description Accuracy')}
        />
      </div>

      {/* Comment */}
      <div className="space-y-2 pt-4 border-t border-gray-200">
        <label htmlFor="comment" className="block text-sm font-medium text-gray-700">
          {t('agentReview.comment', 'Comments (Optional)')}
        </label>
        <textarea
          id="comment"
          value={comment}
          onChange={(e) => setComment(e.target.value.slice(0, 1000))}
          placeholder={t('agentReview.commentPlaceholder', 'Share details about your experience...')}
          maxLength={1000}
          rows={4}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <p className="text-xs text-gray-500">
          {comment.length}/1000 {t('common.characters', 'characters')}
        </p>
      </div>

      {/* Submit Button */}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium transition-colors"
        >
          {submitting ? t('common.submitting', 'Submitting...') : t('agentReview.submit', 'Submit Review')}
        </button>
      </div>
    </form>
  );
}
