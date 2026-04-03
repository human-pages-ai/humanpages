import { useState, useEffect } from 'react';
import { api } from '../../lib/api';

interface McpTurn {
  id: number;
  sessionId: string;
  agentId: string;
  platform: string | null;
  callerIp: string | null;
  callerUa: string | null;
  apiKeyPrefix: string | null;
  method: string;
  toolName: string | null;
  sequenceNum: number;
  requestArgs: any;
  responseBody: any;
  responseSize: number | null;
  isError: boolean;
  errorMessage: string | null;
  latencyMs: number | null;
  createdAt: string;
}

interface McpSessionSummary {
  sessionId: string;
  agentId: string;
  platform: string | null;
  callerIp: string | null;
  callerUa: string | null;
  apiKeyPrefix: string | null;
  startedAt: string;
  turns: McpTurn[];
  toolCalls: number;
  errorCount: number;
}

function Badge({ text, color = 'gray' }: { text: string; color?: string }) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-100 text-blue-800',
    green: 'bg-green-100 text-green-800',
    red: 'bg-red-100 text-red-800',
    yellow: 'bg-yellow-100 text-yellow-800',
    purple: 'bg-purple-100 text-purple-800',
    gray: 'bg-gray-100 text-gray-800',
  };
  return <span className={`px-2 py-0.5 rounded text-xs font-medium ${colors[color] || colors.gray}`}>{text}</span>;
}

function platformColor(p: string | null): string {
  if (!p) return 'gray';
  if (p === 'chatgpt') return 'green';
  if (p === 'claude') return 'purple';
  if (p === 'gemini') return 'blue';
  return 'gray';
}

function TurnView({ turn }: { turn: McpTurn }) {
  const [expanded, setExpanded] = useState(false);

  const isToolCall = turn.method === 'tools/call';
  const isError = turn.isError;

  return (
    <div className={`border-l-4 ${isError ? 'border-red-400' : isToolCall ? 'border-blue-400' : 'border-gray-300'} pl-4 py-2`}>
      <div className="flex items-center gap-2 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <span className="text-xs text-gray-400 font-mono w-6">#{turn.sequenceNum}</span>
        <Badge text={turn.method} color={isToolCall ? 'blue' : 'gray'} />
        {turn.toolName && <Badge text={turn.toolName} color={isError ? 'red' : 'green'} />}
        {turn.latencyMs != null && <span className="text-xs text-gray-500">{turn.latencyMs}ms</span>}
        {turn.responseSize != null && <span className="text-xs text-gray-400">{(turn.responseSize / 1024).toFixed(1)}KB</span>}
        {isError && <Badge text="ERROR" color="red" />}
        <span className="text-xs text-gray-400 ml-auto">{new Date(turn.createdAt).toLocaleTimeString()}</span>
        <span className="text-xs text-gray-400">{expanded ? '▼' : '▶'}</span>
      </div>

      {expanded && (
        <div className="mt-2 space-y-2">
          {turn.requestArgs && (
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-1">→ Request Args:</p>
              <pre className="bg-gray-900 text-green-400 text-xs p-3 rounded overflow-x-auto max-h-60 overflow-y-auto">
                {JSON.stringify(turn.requestArgs, null, 2)}
              </pre>
            </div>
          )}
          {turn.responseBody && (
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-1">← Response:</p>
              <pre className="bg-gray-900 text-blue-400 text-xs p-3 rounded overflow-x-auto max-h-80 overflow-y-auto">
                {JSON.stringify(turn.responseBody, null, 2)}
              </pre>
            </div>
          )}
          {turn.errorMessage && (
            <div>
              <p className="text-xs font-semibold text-red-500 mb-1">Error:</p>
              <pre className="bg-red-50 text-red-700 text-xs p-3 rounded">{turn.errorMessage}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SessionCard({ session, onSelect }: { session: McpSessionSummary; onSelect: () => void }) {
  return (
    <div className="bg-white rounded-lg shadow p-4 cursor-pointer hover:ring-2 hover:ring-blue-400 transition" onClick={onSelect}>
      <div className="flex items-center gap-2 mb-2">
        <Badge text={session.platform || 'unknown'} color={platformColor(session.platform)} />
        <span className="text-sm font-mono text-gray-600">{session.sessionId.slice(0, 20)}...</span>
        <span className="text-xs text-gray-400 ml-auto">{new Date(session.startedAt).toLocaleString()}</span>
      </div>
      <div className="flex items-center gap-4 text-xs text-gray-500">
        <span>Agent: <span className="font-mono">{session.agentId.slice(0, 12)}...</span></span>
        {session.callerIp && <span>IP: <span className="font-mono">{session.callerIp}</span></span>}
        {session.apiKeyPrefix && <span>Key: <span className="font-mono">{session.apiKeyPrefix}</span></span>}
      </div>
      <div className="flex items-center gap-3 mt-2 text-xs">
        <span className="text-blue-600 font-medium">{session.turns.length} turns</span>
        <span className="text-green-600">{session.toolCalls} tool calls</span>
        {session.errorCount > 0 && <span className="text-red-600">{session.errorCount} errors</span>}
        {session.callerUa && <span className="text-gray-400 truncate max-w-xs" title={session.callerUa}>{session.callerUa.slice(0, 60)}</span>}
      </div>
    </div>
  );
}

export default function AdminMcpSessions() {
  const [sessions, setSessions] = useState<McpSessionSummary[]>([]);
  const [selected, setSelected] = useState<McpSessionSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({ platform: '', agentId: '', sessionId: '' });

  useEffect(() => {
    setLoading(true);
    const params: any = { limit: 50 };
    if (filters.platform) params.platform = filters.platform;
    if (filters.agentId) params.agentId = filters.agentId;
    if (filters.sessionId) params.sessionId = filters.sessionId;
    api.getAdminMcpSessions(params)
      .then((data) => setSessions(data.sessions || []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [filters]);

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-4">MCP Session Replay</h1>
      <p className="text-gray-600 mb-6">Full conversation logs for every MCP operator session — args, responses, caller metadata</p>

      {/* Filters */}
      <div className="flex gap-3 mb-6">
        <select
          className="border rounded px-3 py-1.5 text-sm"
          value={filters.platform}
          onChange={(e) => setFilters(f => ({ ...f, platform: e.target.value }))}
        >
          <option value="">All Platforms</option>
          <option value="chatgpt">ChatGPT</option>
          <option value="claude">Claude</option>
          <option value="gemini">Gemini</option>
          <option value="cursor">Cursor</option>
          <option value="copilot">Copilot</option>
          <option value="custom">Custom</option>
        </select>
        <input
          type="text"
          placeholder="Agent ID..."
          className="border rounded px-3 py-1.5 text-sm w-48"
          value={filters.agentId}
          onChange={(e) => setFilters(f => ({ ...f, agentId: e.target.value }))}
        />
        <input
          type="text"
          placeholder="Session ID..."
          className="border rounded px-3 py-1.5 text-sm w-64"
          value={filters.sessionId}
          onChange={(e) => setFilters(f => ({ ...f, sessionId: e.target.value }))}
        />
      </div>

      {loading && <div className="text-gray-500">Loading sessions...</div>}
      {error && <div className="text-red-600">Error: {error}</div>}

      {selected ? (
        <div>
          <button onClick={() => setSelected(null)} className="text-blue-600 text-sm mb-4 hover:underline">
            ← Back to session list
          </button>

          {/* Session header */}
          <div className="bg-white rounded-lg shadow p-6 mb-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-gray-500">Session ID</p>
                <p className="font-mono text-xs break-all">{selected.sessionId}</p>
              </div>
              <div>
                <p className="text-gray-500">Agent ID</p>
                <p className="font-mono text-xs break-all">{selected.agentId}</p>
              </div>
              <div>
                <p className="text-gray-500">Platform</p>
                <Badge text={selected.platform || 'unknown'} color={platformColor(selected.platform)} />
              </div>
              <div>
                <p className="text-gray-500">Started</p>
                <p className="text-xs">{new Date(selected.startedAt).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-gray-500">Caller IP</p>
                <p className="font-mono text-xs">{selected.callerIp || '—'}</p>
              </div>
              <div>
                <p className="text-gray-500">API Key</p>
                <p className="font-mono text-xs">{selected.apiKeyPrefix || '—'}</p>
              </div>
              <div>
                <p className="text-gray-500">User-Agent</p>
                <p className="text-xs truncate" title={selected.callerUa || ''}>{selected.callerUa || '—'}</p>
              </div>
              <div>
                <p className="text-gray-500">Turns</p>
                <p className="text-xs">{selected.turns.length} total, {selected.toolCalls} tool calls, {selected.errorCount} errors</p>
              </div>
            </div>
          </div>

          {/* Conversation turns */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Conversation</h2>
            <div className="space-y-1">
              {selected.turns.map((turn) => (
                <TurnView key={turn.id} turn={turn} />
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.length === 0 && !loading && (
            <div className="text-gray-500">No sessions found. Sessions will appear here once MCP operators start connecting.</div>
          )}
          {sessions.map((s) => (
            <SessionCard key={s.sessionId} session={s} onSelect={() => setSelected(s)} />
          ))}
        </div>
      )}
    </div>
  );
}
