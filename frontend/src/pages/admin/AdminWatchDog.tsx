import { useState, useEffect, useCallback } from 'react';
import { api } from '../../lib/api';
import type { MonitoredError, WatchDogStats, WatchDogHealth, WatchDogTrend } from '../../types/admin';

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-blue-100 text-blue-800',
  alerted: 'bg-red-100 text-red-800',
  acknowledged: 'bg-yellow-100 text-yellow-800',
  resolved: 'bg-green-100 text-green-800',
  ignored: 'bg-gray-100 text-gray-600',
};

const AUTOFIX_COLORS: Record<string, string> = {
  diagnosing: 'bg-purple-100 text-purple-800',
  proposed: 'bg-indigo-100 text-indigo-800',
  applying: 'bg-purple-100 text-purple-800',
  testing: 'bg-yellow-100 text-yellow-800',
  staged: 'bg-blue-100 text-blue-800',
  approved: 'bg-cyan-100 text-cyan-800',
  merged: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
  rejected: 'bg-gray-100 text-gray-600',
};

const LEVEL_LABELS: Record<number, string> = {
  50: 'ERROR',
  60: 'FATAL',
};

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatUptime(ms: number): string {
  if (ms < 60_000) return `${Math.floor(ms / 1000)}s`;
  if (ms < 3600_000) return `${Math.floor(ms / 60_000)}m`;
  return `${Math.floor(ms / 3600_000)}h ${Math.floor((ms % 3600_000) / 60_000)}m`;
}

function MiniTrendChart({ trends }: { trends: WatchDogTrend[] }) {
  if (trends.length === 0) return null;
  const maxCount = Math.max(...trends.map((t) => t.count), 1);
  return (
    <div className="flex items-end gap-px h-8">
      {trends.map((t, i) => {
        const height = Math.max(1, (t.count / maxCount) * 100);
        const hasFatal = t.fatal > 0;
        return (
          <div
            key={i}
            title={`${t.hour}:00 — ${t.count} errors${hasFatal ? ` (${t.fatal} fatal)` : ''}`}
            className={`w-1.5 rounded-t ${hasFatal ? 'bg-red-400' : t.count > 0 ? 'bg-orange-300' : 'bg-gray-200'}`}
            style={{ height: `${height}%` }}
          />
        );
      })}
    </div>
  );
}

export default function AdminWatchDog() {
  const [errors, setErrors] = useState<MonitoredError[]>([]);
  const [stats, setStats] = useState<WatchDogStats | null>(null);
  const [health, setHealth] = useState<WatchDogHealth | null>(null);
  const [trends, setTrends] = useState<WatchDogTrend[]>([]);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [reanalyzing, setReanalyzing] = useState<string | null>(null);
  const [autoFixing, setAutoFixing] = useState<string | null>(null);
  const [approvingFix, setApprovingFix] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showDiff, setShowDiff] = useState<string | null>(null);
  const [error, setError] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [errResult, statsResult, healthResult, trendsResult] = await Promise.all([
        api.getWatchDogErrors({ status: statusFilter || undefined, limit: 50 }),
        api.getWatchDogStats(),
        api.getWatchDogHealth().catch(() => null),
        api.getWatchDogTrends().catch(() => []),
      ]);
      setErrors(errResult.errors);
      setStats(statsResult);
      setHealth(healthResult);
      setTrends(trendsResult);
    } catch (err: any) {
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Auto-refresh every 30s
  useEffect(() => {
    const interval = setInterval(loadData, 30_000);
    return () => clearInterval(interval);
  }, [loadData]);

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      await api.updateWatchDogError(id, newStatus);
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to update status');
    }
  };

  const handleScan = async () => {
    setScanning(true);
    try {
      await api.triggerWatchDogScan();
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Scan failed');
    } finally {
      setScanning(false);
    }
  };

  const handleReanalyze = async (id: string) => {
    setReanalyzing(id);
    try {
      await api.reanalyzeWatchDogError(id);
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Re-analysis failed');
    } finally {
      setReanalyzing(null);
    }
  };

  const handleAutoFix = async (id: string) => {
    setAutoFixing(id);
    setError('');
    try {
      await api.triggerAutoFix(id);
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Auto-fix failed');
    } finally {
      setAutoFixing(null);
    }
  };

  const handleApproveFix = async (id: string) => {
    setApprovingFix(id);
    setError('');
    try {
      await api.approveAutoFix(id);
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Approve failed');
    } finally {
      setApprovingFix(null);
    }
  };

  const handleRejectFix = async (id: string) => {
    try {
      await api.rejectAutoFix(id);
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Reject failed');
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Watch Dog v2</h2>
          <p className="text-sm text-gray-500">Near-realtime AI error monitoring + self-healing</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleScan}
            disabled={scanning}
            className="px-3 py-1.5 text-sm bg-orange-600 text-white rounded hover:bg-orange-700 disabled:opacity-50"
          >
            {scanning ? 'Scanning...' : 'Run Scan Now'}
          </button>
          <button
            onClick={() => loadData()}
            disabled={loading}
            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Health Status Bar */}
      {health && (
        <div className="flex items-center gap-4 mb-4 bg-white rounded-lg border px-4 py-2 text-xs text-gray-500">
          <div className="flex items-center gap-1.5">
            <span className={`inline-block w-2 h-2 rounded-full ${health.active ? 'bg-green-500' : 'bg-red-500'}`} />
            <span>{health.active ? 'Active' : 'Inactive'}</span>
          </div>
          <span>{health.filesWatched} file{health.filesWatched !== 1 ? 's' : ''} watched</span>
          {health.lastErrorAt && <span>Last error: {timeAgo(health.lastErrorAt)}</span>}
          <span>Uptime: {formatUptime(health.uptimeMs)}</span>
          <span className={health.claudeBudget.used >= health.claudeBudget.limit ? 'text-red-500 font-medium' : ''}>
            Claude: {health.claudeBudget.used}/{health.claudeBudget.limit}
          </span>
          <span className={health.telegramBudget.used >= health.telegramBudget.limit ? 'text-red-500 font-medium' : ''}>
            Telegram: {health.telegramBudget.used}/{health.telegramBudget.limit}
          </span>
        </div>
      )}

      {/* Stats + Trend */}
      <div className="flex gap-4 mb-4">
        {stats && (
          <>
            <div className="bg-white rounded-lg border px-4 py-2">
              <p className="text-xs text-gray-500">Total tracked</p>
              <p className="text-lg font-semibold">{stats.total}</p>
            </div>
            <div className={`rounded-lg border px-4 py-2 ${(stats.new + stats.alerted) > 0 ? 'bg-red-50 border-red-200' : 'bg-white'}`}>
              <p className="text-xs text-gray-500">Active alerts</p>
              <p className={`text-lg font-semibold ${(stats.new + stats.alerted) > 0 ? 'text-red-600' : ''}`}>
                {stats.new + stats.alerted}
              </p>
            </div>
            <div className="bg-white rounded-lg border px-4 py-2">
              <p className="text-xs text-gray-500">Acknowledged</p>
              <p className="text-lg font-semibold">{stats.acknowledged}</p>
            </div>
          </>
        )}
        {trends.length > 0 && (
          <div className="bg-white rounded-lg border px-4 py-2 flex-1">
            <p className="text-xs text-gray-500 mb-1">24h trend</p>
            <MiniTrendChart trends={trends} />
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4 bg-white rounded-lg border p-3">
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="text-sm border rounded px-2 py-1.5 bg-white"
        >
          <option value="">All statuses</option>
          <option value="new">New</option>
          <option value="alerted">Alerted</option>
          <option value="acknowledged">Acknowledged</option>
          <option value="resolved">Resolved</option>
          <option value="ignored">Ignored</option>
        </select>
        <span className="text-xs text-gray-400">Auto-refreshes every 30s</span>
      </div>

      {/* Error message */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Error list */}
      <div className="space-y-3">
        {errors.length === 0 && !loading && (
          <div className="bg-white rounded-lg border p-8 text-center text-gray-400 text-sm">
            No monitored errors found. Watch Dog monitors your PM2 logs in near-realtime.
          </div>
        )}

        {errors.map((err) => (
          <div key={err.id} className="bg-white rounded-lg border overflow-hidden">
            <div
              className="px-4 py-3 cursor-pointer hover:bg-gray-50"
              onClick={() => setExpandedId(expandedId === err.id ? null : err.id)}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[err.status] || ''}`}>
                      {err.status.toUpperCase()}
                    </span>
                    <span className={`text-xs font-mono ${err.level >= 60 ? 'text-red-600 font-bold' : 'text-gray-400'}`}>
                      {LEVEL_LABELS[err.level] || `L${err.level}`}
                    </span>
                    <span className="text-xs text-gray-400">
                      {err.occurrences}x
                    </span>
                    {err.aiAnalysis && (
                      <span className="text-xs text-purple-500" title="AI analyzed">
                        AI
                      </span>
                    )}
                    {/* Auto-fix status badge */}
                    {err.autoFixStatus && err.autoFixStatus !== 'none' && (
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${AUTOFIX_COLORS[err.autoFixStatus] || 'bg-gray-100 text-gray-600'}`}>
                        Fix: {err.autoFixStatus}
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-mono text-gray-800 truncate">
                    {err.errorType ? `${err.errorType}: ` : ''}{err.message}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    First seen {timeAgo(err.firstSeenAt)} · Last seen {timeAgo(err.lastSeenAt)}
                  </p>
                </div>
                <div className="flex gap-1 shrink-0">
                  {err.status !== 'acknowledged' && err.status !== 'resolved' && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleStatusChange(err.id, 'acknowledged'); }}
                      className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded hover:bg-yellow-200"
                    >
                      Ack
                    </button>
                  )}
                  {err.status !== 'resolved' && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleStatusChange(err.id, 'resolved'); }}
                      className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded hover:bg-green-200"
                    >
                      Resolve
                    </button>
                  )}
                  {err.status !== 'ignored' && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleStatusChange(err.id, 'ignored'); }}
                      className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded hover:bg-gray-200"
                    >
                      Ignore
                    </button>
                  )}
                </div>
              </div>
            </div>

            {expandedId === err.id && (
              <div className="border-t px-4 py-3 bg-gray-50">
                {/* AI Analysis section */}
                {err.aiAnalysis ? (
                  <div className="mb-3">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs font-semibold text-purple-700">AI Analysis</p>
                      <button
                        onClick={() => handleReanalyze(err.id)}
                        disabled={reanalyzing === err.id}
                        className="text-xs text-purple-600 hover:text-purple-800 disabled:opacity-50"
                      >
                        {reanalyzing === err.id ? 'Analyzing...' : 'Re-analyze'}
                      </button>
                    </div>
                    <pre className="text-xs text-gray-700 bg-purple-50 p-3 rounded whitespace-pre-wrap">
                      {err.aiAnalysis}
                    </pre>
                    {err.aiAnalyzedAt && (
                      <p className="text-xs text-gray-400 mt-1">Analyzed {timeAgo(err.aiAnalyzedAt)}</p>
                    )}
                  </div>
                ) : (
                  <div className="mb-3">
                    <button
                      onClick={() => handleReanalyze(err.id)}
                      disabled={reanalyzing === err.id}
                      className="px-3 py-1.5 text-xs bg-purple-100 text-purple-700 rounded hover:bg-purple-200 disabled:opacity-50"
                    >
                      {reanalyzing === err.id ? 'Analyzing...' : 'Run AI Analysis'}
                    </button>
                  </div>
                )}

                {/* Auto-Fix section */}
                <div className="mb-3">
                  <p className="text-xs font-semibold text-gray-500 mb-2">Auto-Fix</p>

                  {/* Auto-fix actions */}
                  {(!err.autoFixStatus || err.autoFixStatus === 'failed' || err.autoFixStatus === 'rejected') && (
                    <button
                      onClick={() => handleAutoFix(err.id)}
                      disabled={autoFixing === err.id}
                      className="px-3 py-1.5 text-xs bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200 disabled:opacity-50"
                    >
                      {autoFixing === err.id ? 'Diagnosing...' : 'Auto-Fix with Claude'}
                    </button>
                  )}

                  {err.autoFixStatus === 'diagnosing' && (
                    <div className="flex items-center gap-2 text-xs text-purple-600">
                      <span className="animate-pulse">Claude is diagnosing the error...</span>
                    </div>
                  )}

                  {err.autoFixStatus === 'testing' && (
                    <div className="flex items-center gap-2 text-xs text-yellow-600">
                      <span className="animate-pulse">Running TypeScript + unit tests...</span>
                    </div>
                  )}

                  {/* Staged: show approve/reject */}
                  {err.autoFixStatus === 'staged' && (
                    <div className="bg-blue-50 border border-blue-200 rounded p-3">
                      <p className="text-xs text-blue-900 font-medium mb-2">
                        Fix staged on branch: <code className="bg-blue-100 px-1 rounded">{err.autoFixBranch}</code>
                      </p>
                      <p className="text-xs text-blue-700 mb-2">{err.autoFixTestOutput}</p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleApproveFix(err.id)}
                          disabled={approvingFix === err.id}
                          className="px-3 py-1.5 text-xs bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                        >
                          {approvingFix === err.id ? 'Merging...' : 'Approve & Merge'}
                        </button>
                        <button
                          onClick={() => handleRejectFix(err.id)}
                          className="px-3 py-1.5 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200"
                        >
                          Reject
                        </button>
                        {err.autoFixProposal && (
                          <button
                            onClick={() => setShowDiff(showDiff === err.id ? null : err.id)}
                            className="px-3 py-1.5 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                          >
                            {showDiff === err.id ? 'Hide Diff' : 'View Diff'}
                          </button>
                        )}
                      </div>
                      {showDiff === err.id && err.autoFixProposal && (
                        <pre className="mt-2 text-xs text-gray-700 bg-white p-3 rounded border overflow-x-auto whitespace-pre-wrap max-h-80">
                          {err.autoFixProposal}
                        </pre>
                      )}
                    </div>
                  )}

                  {/* Proposed (critical severity) */}
                  {err.autoFixStatus === 'proposed' && (
                    <div className="bg-indigo-50 border border-indigo-200 rounded p-3">
                      <p className="text-xs text-indigo-900 font-medium mb-1">Fix proposed — manual review required (critical severity)</p>
                      {err.autoFixTestOutput && (
                        <pre className="text-xs text-gray-600 bg-white p-2 rounded border mt-1 whitespace-pre-wrap">{err.autoFixTestOutput}</pre>
                      )}
                    </div>
                  )}

                  {/* Merged */}
                  {err.autoFixStatus === 'merged' && (
                    <div className="bg-green-50 border border-green-200 rounded p-3">
                      <p className="text-xs text-green-800 font-medium">
                        Fix merged & deployed
                        {err.autoFixMergedAt && ` · ${timeAgo(err.autoFixMergedAt)}`}
                      </p>
                    </div>
                  )}

                  {/* Failed */}
                  {err.autoFixStatus === 'failed' && err.autoFixTestOutput && (
                    <div className="mt-2 bg-red-50 border border-red-200 rounded p-3">
                      <p className="text-xs text-red-800 font-medium mb-1">Auto-fix failed</p>
                      <pre className="text-xs text-red-700 bg-white p-2 rounded border whitespace-pre-wrap max-h-40 overflow-y-auto">
                        {err.autoFixTestOutput}
                      </pre>
                    </div>
                  )}
                </div>

                {/* Sample payload */}
                {err.samplePayload && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 mb-1">Sample Log Entry</p>
                    <pre className="text-xs text-gray-600 bg-white p-2 rounded border overflow-x-auto whitespace-pre-wrap max-h-60">
                      {JSON.stringify(err.samplePayload, null, 2)}
                    </pre>
                  </div>
                )}
                <p className="text-xs text-gray-400 mt-2 font-mono">
                  Fingerprint: {err.fingerprint}
                </p>
              </div>
            )}
          </div>
        ))}
      </div>

      {loading && (
        <div className="mt-4 text-center text-sm text-gray-400">Loading...</div>
      )}
    </div>
  );
}
