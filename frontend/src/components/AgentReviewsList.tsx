import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';

interface AgentReview {
  id: string;
  rating: number;
  comment?: string;
  paymentSpeed?: number;
  communication?: number;
  scopeAccuracy?: number;
  createdAt: string;
  jobTitle: string;
  humanName: string;
}

interface AgentReviewsAggregates {
  totalReviews: number;
  averageRating: number | null;
  averagePaymentSpeed: number | null;
  averageCommunication: number | null;
  averageScopeAccuracy: number | null;
}

interface AgentReviewsResponse {
  aggregates: AgentReviewsAggregates;
  reviews: AgentReview[];
}

interface AgentReviewsListProps {
  agentId: string;
}

export default function AgentReviewsList({ agentId }: AgentReviewsListProps) {
  const { t } = useTranslation();
  const [data, setData] = useState<AgentReviewsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchReviews();
  }, [agentId]);

  const fetchReviews = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.getAgentReviews(agentId);
      setData(response);
    } catch (err: any) {
      setError(err.message || t('common.error', 'An error occurred'));
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-6 bg-gray-200 rounded animate-pulse w-48"></div>
        <div className="h-20 bg-gray-200 rounded animate-pulse"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-red-600 text-sm">
        {t('agentReviews.error', 'Failed to load reviews: {{error}}', { error })}
      </div>
    );
  }

  if (!data || data.aggregates.totalReviews === 0) {
    return (
      <div className="text-center py-8 text-gray-600">
        <p>{t('agentReviews.noReviews', 'No reviews yet')}</p>
      </div>
    );
  }

  const StarRating = ({ value, label }: { value: number | null; label: string }) => {
    if (value === null) return null;
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-600 w-32">{label}</span>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <span
              key={star}
              className={`text-lg ${value >= star ? 'text-yellow-400' : 'text-gray-300'}`}
            >
              ★
            </span>
          ))}
        </div>
        <span className="text-sm font-medium text-gray-700 ml-2">{value.toFixed(1)}</span>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Aggregates */}
      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          {t('agentReviews.summary', 'Agent Reviews Summary')}
        </h3>

        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <span
                  key={star}
                  className={`text-2xl ${
                    (data.aggregates.averageRating ?? 0) >= star
                      ? 'text-yellow-400'
                      : 'text-gray-300'
                  }`}
                >
                  ★
                </span>
              ))}
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {data.aggregates.averageRating?.toFixed(1) || 'N/A'}
              </p>
              <p className="text-sm text-gray-600">
                {t('agentReviews.outOf5', '{{count}} reviews', { count: data.aggregates.totalReviews })}
              </p>
            </div>
          </div>

          {/* Dimension aggregates */}
          <div className="pt-4 border-t border-gray-200 space-y-3">
            <StarRating
              value={data.aggregates.averagePaymentSpeed}
              label={t('agentReview.paymentSpeed', 'Payment Speed')}
            />
            <StarRating
              value={data.aggregates.averageCommunication}
              label={t('agentReview.communication', 'Communication')}
            />
            <StarRating
              value={data.aggregates.averageScopeAccuracy}
              label={t('agentReview.scopeAccuracy', 'Scope Accuracy')}
            />
          </div>
        </div>
      </div>

      {/* Individual Reviews */}
      <div className="space-y-3">
        <h4 className="font-semibold text-gray-900">
          {t('agentReviews.allReviews', 'All Reviews')}
        </h4>
        {data.reviews.map((review) => (
          <div
            key={review.id}
            className="bg-white p-4 rounded-lg border border-gray-200 space-y-2"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium text-gray-900">{review.humanName}</p>
                <p className="text-sm text-gray-600">{review.jobTitle}</p>
              </div>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <span
                    key={star}
                    className={`text-lg ${
                      review.rating >= star ? 'text-yellow-400' : 'text-gray-300'
                    }`}
                  >
                    ★
                  </span>
                ))}
              </div>
            </div>

            {review.comment && (
              <p className="text-sm text-gray-700 leading-relaxed">{review.comment}</p>
            )}

            {(review.paymentSpeed || review.communication || review.scopeAccuracy) && (
              <div className="pt-2 border-t border-gray-200 space-y-1 text-xs">
                {review.paymentSpeed && (
                  <p className="text-gray-600">
                    <span className="font-medium">{t('agentReview.paymentSpeed', 'Payment Speed')}:</span> {review.paymentSpeed}/5
                  </p>
                )}
                {review.communication && (
                  <p className="text-gray-600">
                    <span className="font-medium">{t('agentReview.communication', 'Communication')}:</span> {review.communication}/5
                  </p>
                )}
                {review.scopeAccuracy && (
                  <p className="text-gray-600">
                    <span className="font-medium">{t('agentReview.scopeAccuracy', 'Scope Accuracy')}:</span> {review.scopeAccuracy}/5
                  </p>
                )}
              </div>
            )}

            <p className="text-xs text-gray-500 pt-1">
              {new Date(review.createdAt).toLocaleDateString()}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
