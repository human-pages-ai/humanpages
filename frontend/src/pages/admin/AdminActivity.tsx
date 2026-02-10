import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import type { AdminActivity } from '../../types/admin';

const typeStyles: Record<string, { bg: string; label: string }> = {
  user: { bg: 'bg-blue-100 text-blue-700', label: 'User' },
  agent: { bg: 'bg-purple-100 text-purple-700', label: 'Agent' },
  job: { bg: 'bg-green-100 text-green-700', label: 'Job' },
};

function relativeTime(date: string): string {
  const now = Date.now();
  const then = new Date(date).getTime();
  const seconds = Math.floor((now - then) / 1000);

  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(date).toLocaleDateString();
}

export default function AdminActivity() {
  const [activity, setActivity] = useState<AdminActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getAdminActivity(50)
      .then((res) => setActivity(res.activity))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-gray-500">Loading activity...</p>;
  if (error) return <p className="text-red-600">{error}</p>;

  return (
    <div className="bg-white rounded-lg shadow divide-y divide-gray-200">
      {activity.length === 0 ? (
        <p className="px-4 py-8 text-center text-gray-500">No recent activity</p>
      ) : (
        activity.map((item, i) => {
          const style = typeStyles[item.type] || typeStyles.job;
          return (
            <div key={`${item.type}-${item.id}-${i}`} className="px-4 py-3 flex items-start gap-3">
              <span className={`mt-0.5 inline-block px-2 py-0.5 text-xs font-medium rounded-full whitespace-nowrap ${style.bg}`}>
                {style.label}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-900">{item.description}</p>
                <p className="text-xs text-gray-400 mt-0.5">{relativeTime(item.timestamp)}</p>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
