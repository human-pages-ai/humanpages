import { useState, useEffect, useCallback } from 'react';
import { api } from '../../lib/api';
import toast from 'react-hot-toast';
import type { MktOpsLog, MktOpsDecision, MktOpsStaffProfile, MktOpsStrategy, MktOpsDailyProcedures, Pagination } from '../../types/admin';

type Tab = 'logs' | 'decisions' | 'config';

export default function MarketingOps() {
  const [tab, setTab] = useState<Tab>('logs');

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900 mb-4">Marketing Ops</h2>
      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {(['logs', 'decisions', 'config'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
              tab === t
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            {t === 'logs' ? 'Logs' : t === 'decisions' ? 'Decisions' : 'Config'}
          </button>
        ))}
      </div>

      {tab === 'logs' && <LogsTab />}
      {tab === 'decisions' && <DecisionsTab />}
      {tab === 'config' && <ConfigTab />}
    </div>
  );
}

// ─── Logs Tab ───

function LogsTab() {
  const [logs, setLogs] = useState<MktOpsLog[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 50, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filters, setFilters] = useState({ event: '', staff: '', from: '', to: '' });

  const load = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const res = await api.getMktOpsLogs({ page, limit: 50, ...filters });
      setLogs(res.logs);
      setPagination(res.pagination);
    } catch (err) {
      toast.error('Failed to load logs');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { load(); }, [load]);

  const eventTypes = ['claude-call', 'claude-error', 'slack-dm-sent', 'telegram-sent', 'follow-up-sent', 'escalated-to-founder', 'staff-message', 'blocker-escalated', 'morning-briefing-sent', 'eod-request-sent', 'eod-report-received', 'founder-decision', 'founder-message'];

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <select
          value={filters.event}
          onChange={(e) => setFilters({ ...filters, event: e.target.value })}
          className="border border-gray-300 rounded-md px-3 py-1.5 text-sm"
        >
          <option value="">All events</option>
          {eventTypes.map((e) => <option key={e} value={e}>{e}</option>)}
        </select>
        <input
          type="text"
          placeholder="Staff name"
          value={filters.staff}
          onChange={(e) => setFilters({ ...filters, staff: e.target.value })}
          className="border border-gray-300 rounded-md px-3 py-1.5 text-sm w-32"
        />
        <input
          type="date"
          value={filters.from}
          onChange={(e) => setFilters({ ...filters, from: e.target.value })}
          className="border border-gray-300 rounded-md px-3 py-1.5 text-sm"
        />
        <input
          type="date"
          value={filters.to}
          onChange={(e) => setFilters({ ...filters, to: e.target.value })}
          className="border border-gray-300 rounded-md px-3 py-1.5 text-sm"
        />
        <button onClick={() => load()} className="bg-blue-600 text-white px-3 py-1.5 rounded-md text-sm hover:bg-blue-700">Filter</button>
      </div>

      {loading ? (
        <p className="text-gray-500 text-sm">Loading...</p>
      ) : logs.length === 0 ? (
        <p className="text-gray-500 text-sm">No logs found.</p>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Event</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Staff</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Model</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Duration</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Summary</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {logs.map((log) => (
                <LogRow key={log.id} log={log} expanded={expandedId === log.id} onToggle={() => setExpandedId(expandedId === log.id ? null : log.id)} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <span className="text-sm text-gray-500">
            Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => load(pagination.page - 1)}
              disabled={pagination.page <= 1}
              className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50"
            >
              Prev
            </button>
            <button
              onClick={() => load(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages}
              className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function LogRow({ log, expanded, onToggle }: { log: MktOpsLog; expanded: boolean; onToggle: () => void }) {
  const summary = log.prompt
    ? log.prompt.slice(0, 80) + (log.prompt.length > 80 ? '...' : '')
    : JSON.stringify(log.details).slice(0, 80);

  return (
    <>
      <tr className="hover:bg-gray-50 cursor-pointer" onClick={onToggle}>
        <td className="px-4 py-2 text-sm text-gray-500 whitespace-nowrap">{new Date(log.timestamp).toLocaleString()}</td>
        <td className="px-4 py-2">
          <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${
            log.event === 'claude-call' ? 'bg-purple-100 text-purple-700' :
            log.event === 'claude-error' ? 'bg-red-100 text-red-700' :
            log.event.includes('telegram') ? 'bg-blue-100 text-blue-700' :
            log.event.includes('slack') ? 'bg-green-100 text-green-700' :
            'bg-gray-100 text-gray-700'
          }`}>
            {log.event}
          </span>
        </td>
        <td className="px-4 py-2 text-sm text-gray-700">{log.staff ?? '-'}</td>
        <td className="px-4 py-2 text-sm text-gray-500">{log.model ?? '-'}</td>
        <td className="px-4 py-2 text-sm text-gray-500">{log.durationMs ? `${log.durationMs}ms` : '-'}</td>
        <td className="px-4 py-2 text-sm text-gray-500 max-w-xs truncate">{summary}</td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={6} className="px-4 py-4 bg-gray-50">
            <div className="space-y-3">
              {log.prompt && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase mb-1">Prompt</h4>
                  <pre className="text-sm text-gray-700 whitespace-pre-wrap bg-white p-3 rounded border border-gray-200 max-h-64 overflow-y-auto">{log.prompt}</pre>
                </div>
              )}
              {log.response && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase mb-1">Response</h4>
                  <pre className="text-sm text-gray-700 whitespace-pre-wrap bg-white p-3 rounded border border-gray-200 max-h-64 overflow-y-auto">{log.response}</pre>
                </div>
              )}
              {Object.keys(log.details).length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase mb-1">Details</h4>
                  <pre className="text-sm text-gray-700 whitespace-pre-wrap bg-white p-3 rounded border border-gray-200">{JSON.stringify(log.details, null, 2)}</pre>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Decisions Tab ───

function DecisionsTab() {
  const [decisions, setDecisions] = useState<MktOpsDecision[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 50, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');

  const load = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const res = await api.getMktOpsDecisions({ page, limit: 50, status: statusFilter || undefined });
      setDecisions(res.decisions);
      setPagination(res.pagination);
    } catch {
      toast.error('Failed to load decisions');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <div className="flex gap-3 mb-4">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border border-gray-300 rounded-md px-3 py-1.5 text-sm"
        >
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="resolved">Resolved</option>
          <option value="expired">Expired</option>
        </select>
      </div>

      {loading ? (
        <p className="text-gray-500 text-sm">Loading...</p>
      ) : decisions.length === 0 ? (
        <p className="text-gray-500 text-sm">No decisions found.</p>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Staff</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Question</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Chosen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {decisions.map((d) => (
                <DecisionRow key={d.id} decision={d} expanded={expandedId === d.id} onToggle={() => setExpandedId(expandedId === d.id ? null : d.id)} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <span className="text-sm text-gray-500">
            Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
          </span>
          <div className="flex gap-2">
            <button onClick={() => load(pagination.page - 1)} disabled={pagination.page <= 1} className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50">Prev</button>
            <button onClick={() => load(pagination.page + 1)} disabled={pagination.page >= pagination.totalPages} className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50">Next</button>
          </div>
        </div>
      )}
    </div>
  );
}

function DecisionRow({ decision, expanded, onToggle }: { decision: MktOpsDecision; expanded: boolean; onToggle: () => void }) {
  return (
    <>
      <tr className="hover:bg-gray-50 cursor-pointer" onClick={onToggle}>
        <td className="px-4 py-2 text-sm text-gray-500 whitespace-nowrap">{new Date(decision.createdAt).toLocaleString()}</td>
        <td className="px-4 py-2 text-sm text-gray-700">{decision.staff ?? '-'}</td>
        <td className="px-4 py-2 text-sm text-gray-700 max-w-xs truncate">{decision.question.replace(/<[^>]+>/g, '').slice(0, 80)}</td>
        <td className="px-4 py-2">
          <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${
            decision.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
            decision.status === 'resolved' ? 'bg-green-100 text-green-700' :
            'bg-gray-100 text-gray-700'
          }`}>
            {decision.status}
          </span>
        </td>
        <td className="px-4 py-2 text-sm text-gray-700">{decision.chosen ?? '-'}</td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={5} className="px-4 py-4 bg-gray-50">
            <div className="space-y-3">
              <div>
                <h4 className="text-xs font-semibold text-gray-500 uppercase mb-1">Question</h4>
                <div className="text-sm text-gray-700 bg-white p-3 rounded border border-gray-200">{decision.question}</div>
              </div>
              <div>
                <h4 className="text-xs font-semibold text-gray-500 uppercase mb-1">Context</h4>
                <pre className="text-sm text-gray-700 whitespace-pre-wrap bg-white p-3 rounded border border-gray-200 max-h-64 overflow-y-auto">{decision.context}</pre>
              </div>
              <div>
                <h4 className="text-xs font-semibold text-gray-500 uppercase mb-1">Options</h4>
                <div className="flex gap-2 flex-wrap">
                  {decision.options.map((opt, i) => (
                    <span key={i} className={`px-3 py-1 text-sm rounded-full border ${
                      decision.chosen === opt.callbackData ? 'bg-blue-50 border-blue-300 text-blue-700 font-medium' : 'bg-white border-gray-200 text-gray-600'
                    }`}>
                      {opt.label}
                    </span>
                  ))}
                </div>
              </div>
              {decision.resolvedAt && (
                <p className="text-xs text-gray-500">Resolved at: {new Date(decision.resolvedAt).toLocaleString()}</p>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Config Tab ───

function ConfigTab() {
  const [section, setSection] = useState<'staff-profiles' | 'strategy' | 'daily-procedures'>('staff-profiles');

  return (
    <div>
      <div className="flex gap-2 mb-4">
        {([
          { key: 'staff-profiles', label: 'Staff Profiles' },
          { key: 'strategy', label: 'Strategy' },
          { key: 'daily-procedures', label: 'Daily Procedures' },
        ] as const).map((s) => (
          <button
            key={s.key}
            onClick={() => setSection(s.key)}
            className={`px-3 py-1.5 text-sm rounded-md ${
              section === s.key ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {section === 'staff-profiles' && <StaffProfilesEditor />}
      {section === 'strategy' && <StrategyEditor />}
      {section === 'daily-procedures' && <DailyProceduresEditor />}
    </div>
  );
}

function StaffProfilesEditor() {
  const [profiles, setProfiles] = useState<Record<string, MktOpsStaffProfile>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.getMktOpsConfig('staff-profiles')
      .then((config) => setProfiles(config.value as Record<string, MktOpsStaffProfile>))
      .catch(() => toast.error('Failed to load staff profiles'))
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await api.updateMktOpsConfig('staff-profiles', profiles);
      toast.success('Staff profiles saved');
    } catch {
      toast.error('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const updateProfile = (name: string, field: keyof MktOpsStaffProfile, value: unknown) => {
    setProfiles((prev) => ({
      ...prev,
      [name]: { ...prev[name], [field]: value },
    }));
  };

  if (loading) return <p className="text-gray-500 text-sm">Loading...</p>;
  if (Object.keys(profiles).length === 0) return <p className="text-gray-500 text-sm">No staff profiles found. Seed config first.</p>;

  return (
    <div className="space-y-4">
      {Object.entries(profiles).map(([name, profile]) => (
        <div key={name} className="bg-white border border-gray-200 rounded-lg p-4">
          <h3 className="font-semibold text-gray-900 mb-3">{name}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Timezone</label>
              <input
                type="text"
                value={profile.timezone}
                onChange={(e) => updateProfile(name, 'timezone', e.target.value)}
                className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Level</label>
              <select
                value={profile.level}
                onChange={(e) => updateProfile(name, 'level', e.target.value)}
                className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
              >
                <option value="basic">Basic</option>
                <option value="strategic">Strategic</option>
                <option value="technical">Technical</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Availability Start</label>
              <input
                type="time"
                value={profile.availabilityStart}
                onChange={(e) => updateProfile(name, 'availabilityStart', e.target.value)}
                className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Availability End</label>
              <input
                type="time"
                value={profile.availabilityEnd}
                onChange={(e) => updateProfile(name, 'availabilityEnd', e.target.value)}
                className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-gray-500 mb-1">Availability Days</label>
              <div className="flex gap-1 flex-wrap">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
                  <button
                    key={day}
                    onClick={() => {
                      const days = profile.availabilityDays.includes(day)
                        ? profile.availabilityDays.filter((d) => d !== day)
                        : [...profile.availabilityDays, day];
                      updateProfile(name, 'availabilityDays', days);
                    }}
                    className={`px-2 py-0.5 text-xs rounded ${
                      profile.availabilityDays.includes(day)
                        ? 'bg-blue-100 text-blue-700 border border-blue-300'
                        : 'bg-gray-100 text-gray-500 border border-gray-200'
                    }`}
                  >
                    {day}
                  </button>
                ))}
              </div>
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-gray-500 mb-1">Skills (comma-separated)</label>
              <input
                type="text"
                value={profile.skills.join(', ')}
                onChange={(e) => updateProfile(name, 'skills', e.target.value.split(',').map((s) => s.trim()).filter(Boolean))}
                className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-gray-500 mb-1">Notes</label>
              <textarea
                value={profile.notes}
                onChange={(e) => updateProfile(name, 'notes', e.target.value)}
                rows={2}
                className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
              />
            </div>
          </div>
        </div>
      ))}
      <button
        onClick={save}
        disabled={saving}
        className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm hover:bg-blue-700 disabled:opacity-50"
      >
        {saving ? 'Saving...' : 'Save Staff Profiles'}
      </button>
    </div>
  );
}

function StrategyEditor() {
  const [strategy, setStrategy] = useState<MktOpsStrategy | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.getMktOpsConfig('strategy')
      .then((config) => setStrategy(config.value as MktOpsStrategy))
      .catch(() => toast.error('Failed to load strategy'))
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    if (!strategy) return;
    setSaving(true);
    try {
      await api.updateMktOpsConfig('strategy', strategy);
      toast.success('Strategy saved');
    } catch {
      toast.error('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="text-gray-500 text-sm">Loading...</p>;
  if (!strategy) return <p className="text-gray-500 text-sm">No strategy config found. Seed config first.</p>;

  return (
    <div className="space-y-4 bg-white border border-gray-200 rounded-lg p-4">
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Focus Areas (one per line)</label>
        <textarea
          value={strategy.focusAreas.join('\n')}
          onChange={(e) => setStrategy({ ...strategy, focusAreas: e.target.value.split('\n').filter(Boolean) })}
          rows={6}
          className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Platform Priorities (one per line)</label>
        <textarea
          value={strategy.platformPriorities.join('\n')}
          onChange={(e) => setStrategy({ ...strategy, platformPriorities: e.target.value.split('\n').filter(Boolean) })}
          rows={6}
          className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
        />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Max Tasks/Person/Day</label>
          <input
            type="number"
            value={strategy.maxTasksPerPersonPerDay}
            onChange={(e) => setStrategy({ ...strategy, maxTasksPerPersonPerDay: parseInt(e.target.value) || 0 })}
            className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Max Follow-Ups Before Escalation</label>
          <input
            type="number"
            value={strategy.maxFollowUpsBeforeEscalation}
            onChange={(e) => setStrategy({ ...strategy, maxFollowUpsBeforeEscalation: parseInt(e.target.value) || 0 })}
            className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Follow-Up Interval (hours)</label>
          <input
            type="number"
            value={strategy.followUpIntervalHours}
            onChange={(e) => setStrategy({ ...strategy, followUpIntervalHours: parseInt(e.target.value) || 0 })}
            className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
          />
        </div>
      </div>
      <button
        onClick={save}
        disabled={saving}
        className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm hover:bg-blue-700 disabled:opacity-50"
      >
        {saving ? 'Saving...' : 'Save Strategy'}
      </button>
    </div>
  );
}

function DailyProceduresEditor() {
  const [procedures, setProcedures] = useState<MktOpsDailyProcedures | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.getMktOpsConfig('daily-procedures')
      .then((config) => setProcedures(config.value as MktOpsDailyProcedures))
      .catch(() => toast.error('Failed to load daily procedures'))
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    if (!procedures) return;
    setSaving(true);
    try {
      await api.updateMktOpsConfig('daily-procedures', procedures);
      toast.success('Daily procedures saved');
    } catch {
      toast.error('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="text-gray-500 text-sm">Loading...</p>;
  if (!procedures) return <p className="text-gray-500 text-sm">No daily procedures config found. Seed config first.</p>;

  return (
    <div className="space-y-4 bg-white border border-gray-200 rounded-lg p-4">
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Morning Briefing Template</label>
        <textarea
          value={procedures.morningBriefingTemplate}
          onChange={(e) => setProcedures({ ...procedures, morningBriefingTemplate: e.target.value })}
          rows={4}
          className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Follow-Up Style</label>
        <textarea
          value={procedures.followUpStyle}
          onChange={(e) => setProcedures({ ...procedures, followUpStyle: e.target.value })}
          rows={3}
          className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">EOD Questions (one per line)</label>
        <textarea
          value={procedures.eodQuestions.join('\n')}
          onChange={(e) => setProcedures({ ...procedures, eodQuestions: e.target.value.split('\n').filter(Boolean) })}
          rows={6}
          className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
        />
      </div>
      <button
        onClick={save}
        disabled={saving}
        className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm hover:bg-blue-700 disabled:opacity-50"
      >
        {saving ? 'Saving...' : 'Save Daily Procedures'}
      </button>
    </div>
  );
}
