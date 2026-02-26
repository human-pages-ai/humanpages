import { useState, useEffect, useCallback } from 'react';
import { api } from '../../lib/api';
import type { LogEntry, LogQueryResult, LogStats } from '../../types/admin';

const LEVEL_LABELS: Record<number, string> = {
  10: 'TRACE', 20: 'DEBUG', 30: 'INFO', 40: 'WARN', 50: 'ERROR', 60: 'FATAL',
};

const LEVEL_COLORS: Record<number, string> = {
  10: 'text-gray-400',
  20: 'text-gray-500',
  30: 'text-blue-600',
  40: 'text-yellow-600',
  50: 'text-red-600',
  60: 'text-red-800 font-bold',
};

const LEVEL_BG: Record<number, string> = {
  10: 'bg-gray-100',
  20: 'bg-gray-100',
  30: 'bg-blue-50',
  40: 'bg-yellow-50',
  50: 'bg-red-50',
  60: 'bg-red-100',
};

const TIME_RANGES = [
  { value: '15m', label: '15 min' },
  { value: '30m', label: '30 min' },
  { value: '1h', label: '1 hour' },
  { value: '6h', label: '6 hours' },
  { value: '24h', label: '24 hours' },
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
];

const LEVEL_OPTIONS = [
  { value: '', label: 'All levels' },
  { value: 'trace', label: 'Trace+' },
  { value: 'debug', label: 'Debug+' },
  { value: 'info', label: 'Info+' },
  { value: 'warn', label: 'Warn+' },
  { value: 'error', label: 'Error+' },
  { value: 'fatal', label: 'Fatal' },
];

function formatTime(timestamp: string): string {
  const d = new Date(timestamp);
  return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
    + '.' + String(d.getMilliseconds()).padStart(3, '0');
}

function formatDate(timestamp: string): string {
  const d = new Date(timestamp);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return 'Today';
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function LogRow({ entry, isExpanded, onToggle }: { entry: LogEntry; isExpanded: boolean; onToggle: () => void }) {
  const levelLabel = LEVEL_LABELS[entry.level] || String(entry.level);
  const levelColor = LEVEL_COLORS[entry.level] || 'text-gray-600';
  const levelBg = LEVEL_BG[entry.level] || '';

  const message = entry.msg || (entry.req ? `${entry.req.method} ${entry.req.url}` : '(no message)');

  return (
    <>
      <tr
        className={`border-b border-gray-100 cursor-pointer hover:bg-gray-50 ${levelBg}`}
        onClick={onToggle}
      >
        <td className="px-3 py-2 text-xs text-gray-400 whitespace-nowrap font-mono">
          <span className="text-gray-300">{formatDate(entry.timestamp)}</span>{' '}
          {formatTime(entry.timestamp)}
        </td>
        <td className="px-3 py-2 text-xs whitespace-nowrap">
          <span className={`font-mono font-medium ${levelColor}`}>{levelLabel}</span>
        </td>
        <td className="px-3 py-2 text-xs font-mono text-gray-800 max-w-[600px] truncate">
          {message}
          {entry.req && entry.req.statusCode && (
            <span className={`ml-2 ${entry.req.statusCode >= 400 ? 'text-red-500' : 'text-green-600'}`}>
              [{entry.req.statusCode}]
            </span>
          )}
          {entry.req?.responseTime && (
            <span className="ml-1 text-gray-400">{Math.round(entry.req.responseTime)}ms</span>
          )}
        </td>
      </tr>
      {isExpanded && (
        <tr className="border-b border-gray-200">
          <td colSpan={3} className="px-3 py-3 bg-gray-50">
            {entry.err && (
              <div className="mb-3">
                <p className="text-xs font-semibold text-red-700 mb-1">
                  {entry.err.name}: {entry.err.message}
                </p>
                {entry.err.stack && (
                  <pre className="text-xs text-red-600 bg-red-50 p-2 rounded overflow-x-auto whitespace-pre-wrap max-h-40">
                    {entry.err.stack}
                  </pre>
                )}
              </div>
            )}
            <pre className="text-xs text-gray-600 bg-white p-2 rounded border overflow-x-auto whitespace-pre-wrap max-h-60">
              {JSON.stringify(entry.raw, null, 2)}
            </pre>
          </td>
        </tr>
      )}
    </>
  );
}

export default function AdminLogs() {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [stats, setStats] = useState<LogStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  // Filters
  const [timeRange, setTimeRange] = useState('1h');
  const [level, setLevel] = useState('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');

  // Pagination
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const LIMIT = 100;

  // Query metadata
  const [queryInfo, setQueryInfo] = useState<LogQueryResult['status'] | null>(null);

  const loadLogs = useCallback(async (newOffset = 0) => {
    setLoading(true);
    setError('');
    try {
      const result = await api.getLogs({
        timeRange,
        level: level || undefined,
        search: search || undefined,
        limit: LIMIT,
        offset: newOffset,
      });
      if (newOffset === 0) {
        setEntries(result.entries);
      } else {
        setEntries(prev => [...prev, ...result.entries]);
      }
      setHasMore(result.count === LIMIT);
      setQueryInfo(result.status);
      setOffset(newOffset);
      setExpandedRows(new Set());
    } catch (err: any) {
      setError(err.message || 'Failed to load logs');
    } finally {
      setLoading(false);
    }
  }, [timeRange, level, search]);

  const loadStats = useCallback(async () => {
    try {
      const s = await api.getLogStats(timeRange);
      setStats(s);
    } catch {
      // Stats are optional — don't block if they fail
    }
  }, [timeRange]);

  useEffect(() => {
    loadLogs(0);
    loadStats();
  }, [loadLogs, loadStats]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
  };

  const toggleRow = (idx: number) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-900">Server Logs</h2>
        <button
          onClick={() => loadLogs(0)}
          disabled={loading}
          className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {/* Stats bar */}
      {stats && (
        <div className="flex gap-4 mb-4">
          <div className="bg-white rounded-lg border px-4 py-2">
            <p className="text-xs text-gray-500">Total logs</p>
            <p className="text-lg font-semibold">{stats.totalCount.toLocaleString()}</p>
          </div>
          <div className={`rounded-lg border px-4 py-2 ${stats.errorCount > 0 ? 'bg-red-50 border-red-200' : 'bg-white'}`}>
            <p className="text-xs text-gray-500">Errors</p>
            <p className={`text-lg font-semibold ${stats.errorCount > 0 ? 'text-red-600' : ''}`}>
              {stats.errorCount.toLocaleString()}
            </p>
          </div>
          {queryInfo && (
            <div className="bg-white rounded-lg border px-4 py-2">
              <p className="text-xs text-gray-500">Query time</p>
              <p className="text-lg font-semibold">{queryInfo.elapsedTime}ms</p>
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4 bg-white rounded-lg border p-3">
        <select
          value={timeRange}
          onChange={e => setTimeRange(e.target.value)}
          className="text-sm border rounded px-2 py-1.5 bg-white"
        >
          {TIME_RANGES.map(r => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>

        <select
          value={level}
          onChange={e => setLevel(e.target.value)}
          className="text-sm border rounded px-2 py-1.5 bg-white"
        >
          {LEVEL_OPTIONS.map(l => (
            <option key={l.value} value={l.value}>{l.label}</option>
          ))}
        </select>

        <form onSubmit={handleSearch} className="flex gap-2 flex-1 min-w-[200px]">
          <input
            type="text"
            placeholder="Search logs..."
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            className="text-sm border rounded px-3 py-1.5 flex-1"
          />
          <button
            type="submit"
            className="text-sm px-3 py-1.5 bg-gray-100 border rounded hover:bg-gray-200"
          >
            Search
          </button>
          {search && (
            <button
              type="button"
              onClick={() => { setSearch(''); setSearchInput(''); }}
              className="text-sm px-2 py-1.5 text-gray-500 hover:text-gray-700"
            >
              Clear
            </button>
          )}
        </form>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Log table */}
      <div className="bg-white rounded-lg border overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b">
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 w-[160px]">Time</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 w-[70px]">Level</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Message</th>
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 && !loading && (
              <tr>
                <td colSpan={3} className="px-3 py-8 text-center text-sm text-gray-400">
                  {error ? 'Failed to load logs' : 'No logs found for the selected filters'}
                </td>
              </tr>
            )}
            {entries.map((entry, idx) => (
              <LogRow
                key={`${entry.timestamp}-${idx}`}
                entry={entry}
                isExpanded={expandedRows.has(idx)}
                onToggle={() => toggleRow(idx)}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Load more */}
      {hasMore && (
        <div className="mt-4 text-center">
          <button
            onClick={() => loadLogs(offset + LIMIT)}
            disabled={loading}
            className="px-4 py-2 text-sm bg-white border rounded hover:bg-gray-50 disabled:opacity-50"
          >
            Load more
          </button>
        </div>
      )}

      {/* Footer info */}
      {queryInfo && entries.length > 0 && (
        <p className="mt-2 text-xs text-gray-400 text-center">
          Showing {entries.length} log{entries.length !== 1 ? 's' : ''} · {queryInfo.rowsExamined.toLocaleString()} rows scanned
          {' '}· Click a row to expand
        </p>
      )}
    </div>
  );
}
