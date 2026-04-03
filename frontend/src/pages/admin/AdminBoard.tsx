import { useState, useEffect, useCallback } from 'react';
import { api } from '../../lib/api';
import type { BoardTask, BoardStatus, BoardPriority } from '../../types/admin';

const STATUSES: { key: BoardStatus; label: string; color: string }[] = [
  { key: 'TODO', label: 'To Do', color: 'bg-gray-100 text-gray-800' },
  { key: 'IN_PROGRESS', label: 'In Progress', color: 'bg-blue-100 text-blue-800' },
  { key: 'DONE', label: 'Done', color: 'bg-green-100 text-green-800' },
  { key: 'CANCELLED', label: 'Cancelled', color: 'bg-red-100 text-red-800' },
];

const PRIORITIES: { key: BoardPriority; label: string; color: string }[] = [
  { key: 'P0', label: 'P0', color: 'bg-red-600 text-white' },
  { key: 'P0.5', label: 'P0.5', color: 'bg-red-400 text-white' },
  { key: 'P1', label: 'P1', color: 'bg-orange-500 text-white' },
  { key: 'P1.5', label: 'P1.5', color: 'bg-orange-300 text-orange-900' },
  { key: 'P2', label: 'P2', color: 'bg-yellow-300 text-yellow-900' },
  { key: 'P2.5', label: 'P2.5', color: 'bg-yellow-100 text-yellow-800' },
  { key: 'P3', label: 'P3', color: 'bg-gray-200 text-gray-700' },
];

const LABELS = ['Marketing', 'Engineering', 'Design', 'Ops', 'Growth'];
const ASSIGNEES = ['Evyatar', 'Itai', 'Harel', 'Tal', 'Mikee', 'Assistant', 'Unassigned'];

function priorityColor(p: string) {
  return PRIORITIES.find(pr => pr.key === p)?.color ?? 'bg-gray-200 text-gray-700';
}

function statusMeta(s: string) {
  return STATUSES.find(st => st.key === s) ?? STATUSES[0];
}

// ─── Task Card (used in both views) ───
function TaskCard({ task, onEdit }: {
  task: BoardTask;
  onEdit: (t: BoardTask) => void;
}) {
  return (
    <div
      className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
      onClick={() => onEdit(task)}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <h4 className="text-sm font-medium text-gray-900 leading-snug flex-1">{task.title}</h4>
        <span className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold ${priorityColor(task.priority)}`}>
          {task.priority}
        </span>
      </div>
      {task.description && (
        <p className="text-xs text-gray-500 mb-2 line-clamp-2">{task.description}</p>
      )}
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1">
          {task.labels.map(l => (
            <span key={l} className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-indigo-50 text-indigo-700">{l}</span>
          ))}
        </div>
        {task.assignee && (
          <span className="text-[10px] font-medium text-gray-500 bg-gray-100 rounded-full px-2 py-0.5">
            {task.assignee}
          </span>
        )}
      </div>
      {task.linearId && (
        <div className="mt-1.5 text-[10px] text-gray-400">{task.linearId}</div>
      )}
    </div>
  );
}

// ─── Kanban Column ───
function KanbanColumn({ status, tasks, onEdit, onDrop }: {
  status: typeof STATUSES[number];
  tasks: BoardTask[];
  onEdit: (t: BoardTask) => void;
  onDrop: (taskId: string, newStatus: BoardStatus) => void;
}) {
  return (
    <div
      className="flex-1 min-w-[280px] max-w-[350px]"
      onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('bg-blue-50'); }}
      onDragLeave={(e) => { e.currentTarget.classList.remove('bg-blue-50'); }}
      onDrop={(e) => {
        e.preventDefault();
        e.currentTarget.classList.remove('bg-blue-50');
        const taskId = e.dataTransfer.getData('text/plain');
        if (taskId) onDrop(taskId, status.key);
      }}
    >
      <div className="flex items-center gap-2 mb-3">
        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${status.color}`}>{status.label}</span>
        <span className="text-xs text-gray-400">{tasks.length}</span>
      </div>
      <div className="space-y-2">
        {tasks.map(task => (
          <div
            key={task.id}
            draggable
            onDragStart={(e) => { e.dataTransfer.setData('text/plain', task.id); }}
          >
            <TaskCard task={task} onEdit={onEdit} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Create / Edit Modal ───
function TaskModal({ task, onClose, onSave, onDelete }: {
  task: Partial<BoardTask> | null;
  onClose: () => void;
  onSave: (data: any) => void;
  onDelete?: (id: string) => void;
}) {
  const isNew = !task?.id;
  const [title, setTitle] = useState(task?.title ?? '');
  const [description, setDescription] = useState(task?.description ?? '');
  const [status, setStatus] = useState<BoardStatus>(task?.status ?? 'TODO');
  const [priority, setPriority] = useState<BoardPriority>(task?.priority ?? 'P2');
  const [labels, setLabels] = useState<string[]>(task?.labels ?? []);
  const [assignee, setAssignee] = useState(task?.assignee ?? '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!title.trim()) return;
    setSaving(true);
    await onSave({
      title: title.trim(),
      description: description.trim() || undefined,
      status,
      priority,
      labels,
      assignee: assignee || undefined,
    });
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-5">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">{isNew ? 'New Task' : 'Edit Task'}</h3>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Task title..."
                autoFocus
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={4}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Details..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select value={status} onChange={e => setStatus(e.target.value as BoardStatus)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                  {STATUSES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                <select value={priority} onChange={e => setPriority(e.target.value as BoardPriority)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                  {PRIORITIES.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Assignee</label>
              <select value={assignee} onChange={e => setAssignee(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                <option value="">Unassigned</option>
                {ASSIGNEES.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Labels</label>
              <div className="flex flex-wrap gap-2">
                {LABELS.map(l => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => setLabels(prev => prev.includes(l) ? prev.filter(x => x !== l) : [...prev, l])}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                      labels.includes(l) ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-200">
            <div>
              {!isNew && onDelete && (
                <button
                  onClick={() => { if (confirm('Delete this task?')) onDelete(task.id!); }}
                  className="text-sm text-red-600 hover:text-red-700 font-medium"
                >
                  Delete
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Cancel</button>
              <button
                onClick={handleSave}
                disabled={!title.trim() || saving}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Saving...' : isNew ? 'Create' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── List View Row ───
function ListRow({ task, onEdit, onStatusChange }: {
  task: BoardTask;
  onEdit: (t: BoardTask) => void;
  onStatusChange: (id: string, status: BoardStatus) => void;
}) {
  const sm = statusMeta(task.status);
  return (
    <tr className="hover:bg-gray-50 cursor-pointer" onClick={() => onEdit(task)}>
      <td className="px-3 py-2">
        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${priorityColor(task.priority)}`}>{task.priority}</span>
      </td>
      <td className="px-3 py-2">
        <div className="text-sm font-medium text-gray-900">{task.title}</div>
        {task.linearId && <div className="text-[10px] text-gray-400">{task.linearId}</div>}
      </td>
      <td className="px-3 py-2">
        <select
          value={task.status}
          onChange={(e) => { e.stopPropagation(); onStatusChange(task.id, e.target.value as BoardStatus); }}
          onClick={e => e.stopPropagation()}
          className={`text-xs font-medium rounded-full px-2 py-0.5 border-0 ${sm.color}`}
        >
          {STATUSES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
      </td>
      <td className="px-3 py-2">
        <div className="flex flex-wrap gap-1">
          {task.labels.map(l => (
            <span key={l} className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-indigo-50 text-indigo-700">{l}</span>
          ))}
        </div>
      </td>
      <td className="px-3 py-2 text-xs text-gray-500">{task.assignee || '-'}</td>
      <td className="px-3 py-2 text-xs text-gray-400">{new Date(task.createdAt).toLocaleDateString()}</td>
    </tr>
  );
}

// ─── Main Component ───
export default function AdminBoard() {
  const [tasks, setTasks] = useState<BoardTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'kanban' | 'list'>('kanban');
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [filterAssignee, setFilterAssignee] = useState('');
  const [filterLabel, setFilterLabel] = useState('');
  const [modalTask, setModalTask] = useState<Partial<BoardTask> | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [hideDone, setHideDone] = useState(false);

  const load = useCallback(async () => {
    try {
      const params: any = { limit: 200 };
      if (search) params.search = search;
      if (filterStatus) params.status = filterStatus;
      if (filterPriority) params.priority = filterPriority;
      if (filterAssignee) params.assignee = filterAssignee;
      if (filterLabel) params.label = filterLabel;
      const res = await api.getBoardTasks(params);
      setTasks(res.tasks);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [search, filterStatus, filterPriority, filterAssignee, filterLabel]);

  useEffect(() => { load(); }, [load]);

  const handleStatusChange = async (id: string, status: BoardStatus) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, status } : t));
    await api.updateBoardTask(id, { status });
  };

  const handleSave = async (data: any) => {
    if (modalTask?.id) {
      const updated = await api.updateBoardTask(modalTask.id, data);
      setTasks(prev => prev.map(t => t.id === updated.id ? updated : t));
    } else {
      const created = await api.createBoardTask(data);
      setTasks(prev => [created, ...prev]);
    }
    setShowModal(false);
    setModalTask(null);
  };

  const handleDelete = async (id: string) => {
    await api.deleteBoardTask(id);
    setTasks(prev => prev.filter(t => t.id !== id));
    setShowModal(false);
    setModalTask(null);
  };

  const handleDrop = async (taskId: string, newStatus: BoardStatus) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
    await api.updateBoardTask(taskId, { status: newStatus });
  };

  const priorityOrder: Record<string, number> = { P0: 0, 'P0.5': 1, P1: 2, 'P1.5': 3, P2: 4, 'P2.5': 5, P3: 6 };
  const sortedTasks = [...tasks].sort((a, b) => (priorityOrder[a.priority] ?? 9) - (priorityOrder[b.priority] ?? 9));

  const visibleStatuses = hideDone ? STATUSES.filter(s => s.key !== 'DONE' && s.key !== 'CANCELLED') : STATUSES;
  const displayTasks = hideDone ? sortedTasks.filter(t => t.status !== 'DONE' && t.status !== 'CANCELLED') : sortedTasks;

  if (loading) {
    return <div className="text-center py-12 text-gray-500">Loading board...</div>;
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Board</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setModalTask({}); setShowModal(true); }}
            className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
          >
            + New Task
          </button>
          <div className="flex bg-gray-100 rounded-lg p-0.5">
            <button
              onClick={() => setView('kanban')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${view === 'kanban' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
            >
              Kanban
            </button>
            <button
              onClick={() => setView('list')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${view === 'list' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
            >
              List
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search tasks..."
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-48 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
        {view === 'list' && (
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm">
            <option value="">All statuses</option>
            {STATUSES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        )}
        <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)}
          className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm">
          <option value="">All priorities</option>
          {PRIORITIES.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
        </select>
        <select value={filterAssignee} onChange={e => setFilterAssignee(e.target.value)}
          className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm">
          <option value="">All assignees</option>
          {ASSIGNEES.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <select value={filterLabel} onChange={e => setFilterLabel(e.target.value)}
          className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm">
          <option value="">All labels</option>
          {LABELS.map(l => <option key={l} value={l}>{l}</option>)}
        </select>
        {view === 'kanban' && (
          <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
            <input type="checkbox" checked={hideDone} onChange={e => setHideDone(e.target.checked)} className="rounded" />
            Hide done/cancelled
          </label>
        )}
        <span className="text-xs text-gray-400 ml-auto">{displayTasks.length} tasks</span>
      </div>

      {/* Kanban View */}
      {view === 'kanban' && (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {visibleStatuses.map(status => (
            <KanbanColumn
              key={status.key}
              status={status}
              tasks={displayTasks.filter(t => t.status === status.key)}
              onEdit={(t) => { setModalTask(t); setShowModal(true); }}
              onDrop={handleDrop}
            />
          ))}
        </div>
      )}

      {/* List View */}
      {view === 'list' && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 w-16">Pri</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Title</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 w-32">Status</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 w-40">Labels</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 w-24">Assignee</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 w-24">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {displayTasks.map(task => (
                <ListRow
                  key={task.id}
                  task={task}
                  onEdit={(t) => { setModalTask(t); setShowModal(true); }}
                  onStatusChange={handleStatusChange}
                />
              ))}
            </tbody>
          </table>
          {displayTasks.length === 0 && (
            <div className="text-center py-8 text-gray-400 text-sm">No tasks found</div>
          )}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <TaskModal
          task={modalTask}
          onClose={() => { setShowModal(false); setModalTask(null); }}
          onSave={handleSave}
          onDelete={modalTask?.id ? handleDelete : undefined}
        />
      )}
    </div>
  );
}
