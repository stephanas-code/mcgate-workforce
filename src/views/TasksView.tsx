import React, { useState, useEffect } from 'react';
import {
  CheckSquare,
  Plus,
  LayoutGrid,
  List,
  Filter,
  Search,
  X,
  AlertTriangle,
  Clock,
  User,
  ArrowRight,
  MoreVertical,
  ChevronRight,
  ChevronLeft
} from 'lucide-react';
import { api } from '../api.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { TaskItem, TaskPriority, TaskStatus } from '../types.ts';
import { TaskModal } from '../components/TaskModal.tsx';
import { TaskDetailModal } from '../components/TaskDetailModal.tsx';

export const TasksView: React.FC = () => {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('kanban');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [selectedPriority, setSelectedPriority] = useState<string>('');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');

  const [projects, setProjects] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);

  const loadTasks = async () => {
    setIsLoading(true);
    try {
      const data = await api.getTasks({
        status: selectedStatus,
        priority: selectedPriority,
        projectId: selectedProjectId,
        search: searchQuery
      });
      setTasks(data);

      const pList = await api.getProjects();
      setProjects(pList);
    } catch (err) {
      console.error('Failed to load tasks:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTasks();
  }, [selectedStatus, selectedPriority, selectedProjectId]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadTasks();
  };

  const handleQuickStatusMove = async (taskId: number, newStatus: TaskStatus, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.updateTask(taskId, { status: newStatus });
      await loadTasks();
    } catch (err: any) {
      alert(err.message || 'Status update failed');
    }
  };

  const kanbanColumns: { id: TaskStatus; label: string; color: string }[] = [
    { id: 'TODO', label: 'To Do', color: 'border-slate-400 text-slate-700' },
    { id: 'IN_PROGRESS', label: 'In Progress', color: 'border-blue-500 text-blue-700' },
    { id: 'BLOCKED', label: 'Blocked', color: 'border-rose-500 text-rose-700' },
    { id: 'IN_REVIEW', label: 'In Review', color: 'border-amber-500 text-amber-700' },
    { id: 'COMPLETED', label: 'Completed', color: 'border-emerald-500 text-emerald-700' }
  ];

  const priorityBadges: Record<string, string> = {
    LOW: 'text-slate-600 bg-slate-100',
    MEDIUM: 'text-blue-700 bg-blue-50 border border-blue-200',
    HIGH: 'text-amber-700 bg-amber-50 border border-amber-200',
    URGENT: 'text-rose-700 bg-rose-50 border border-rose-200 font-bold'
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Work Tasks & Sprint Board
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Track, assign, and advance enterprise deliverables with live audit tracking.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* View mode toggle */}
          <div className="bg-slate-100 p-0.5 rounded-lg flex items-center border border-slate-200">
            <button
              onClick={() => setViewMode('kanban')}
              className={`p-1.5 rounded text-xs font-semibold flex items-center gap-1 transition ${
                viewMode === 'kanban' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
              }`}
              title="Kanban Board"
            >
              <LayoutGrid className="w-4 h-4" />
              <span className="hidden sm:inline">Kanban</span>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded text-xs font-semibold flex items-center gap-1 transition ${
                viewMode === 'list' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
              }`}
              title="List View"
            >
              <List className="w-4 h-4" />
              <span className="hidden sm:inline">Table</span>
            </button>
          </div>

          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-sm transition flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Create Task</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <form onSubmit={handleSearchSubmit} className="flex-1 min-w-[200px] max-w-sm flex items-center gap-2">
          <div className="relative w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
            <input
              type="text"
              placeholder="Filter tasks by code, title..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-1.5 text-xs border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
            />
            {searchQuery && (
              <button
                id="clear-tasks-search-btn"
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  api.getTasks({
                    status: selectedStatus,
                    priority: selectedPriority,
                    projectId: selectedProjectId,
                    search: ''
                  }).then(setTasks).catch(console.error);
                }}
                className="absolute right-2 top-1.5 p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </form>

        <div className="flex flex-wrap items-center gap-2">
          {/* Priority Filter */}
          <select
            value={selectedPriority}
            onChange={(e) => setSelectedPriority(e.target.value)}
            className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 outline-none"
          >
            <option value="">All Priorities</option>
            <option value="URGENT">Urgent</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>

          {/* Project Filter */}
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 outline-none"
          >
            <option value="">All Projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                [{p.code}] {p.name}
              </option>
            ))}
          </select>

          {/* Status Filter for list view */}
          {viewMode === 'list' && (
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 outline-none"
            >
              <option value="">All Statuses</option>
              <option value="TODO">To Do</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="BLOCKED">Blocked</option>
              <option value="IN_REVIEW">In Review</option>
              <option value="COMPLETED">Completed</option>
            </select>
          )}

          {(selectedPriority || selectedProjectId || selectedStatus || searchQuery) && (
            <button
              onClick={() => {
                setSelectedPriority('');
                setSelectedProjectId('');
                setSelectedStatus('');
                setSearchQuery('');
                setTimeout(loadTasks, 50);
              }}
              className="text-xs text-rose-600 hover:underline px-2 font-medium"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Kanban Board View */}
      {viewMode === 'kanban' && (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 items-start">
          {kanbanColumns.map((col) => {
            const columnTasks = tasks.filter((t) => t.status === col.id);

            return (
              <div
                key={col.id}
                className="bg-slate-50/80 rounded-xl border border-slate-200 p-3 flex flex-col min-h-[500px]"
              >
                {/* Column Header */}
                <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-slate-200">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    {col.label}
                  </span>
                  <span className="text-xs font-mono font-bold bg-white text-slate-600 px-2 py-0.5 rounded-full border border-slate-200">
                    {columnTasks.length}
                  </span>
                </div>

                {/* Column Tasks Container */}
                <div className="space-y-2.5 flex-1 overflow-y-auto">
                  {columnTasks.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-400 italic">No tasks</div>
                  ) : (
                    columnTasks.map((t) => (
                      <div
                        key={t.id}
                        onClick={() => setSelectedTaskId(t.id)}
                        className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs hover:shadow-md hover:border-blue-400 transition cursor-pointer space-y-2 group"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-[11px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded border border-blue-200">
                            {t.task_code}
                          </span>
                          <span className={`text-[10px] font-semibold px-1.5 py-0.2 rounded ${priorityBadges[t.priority]}`}>
                            {t.priority}
                          </span>
                        </div>

                        <h4 className="text-xs font-bold text-slate-900 group-hover:text-blue-600 transition leading-snug">
                          {t.title}
                        </h4>

                        <div className="text-[11px] text-slate-500 font-medium">
                          {t.project_name}
                        </div>

                        {t.isOverdue && (
                          <div className="text-[10px] font-bold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            <span>Overdue ({t.due_date})</span>
                          </div>
                        )}

                        <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                          <div className="flex items-center gap-1 truncate max-w-[120px]">
                            <User className="w-3 h-3 text-slate-400" />
                            <span className="truncate">{t.assigneeName || 'Unassigned'}</span>
                          </div>

                          {/* Quick transition arrows */}
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                            {col.id !== 'TODO' && (
                              <button
                                onClick={(e) => {
                                  const prev =
                                    col.id === 'COMPLETED' ? 'IN_REVIEW' :
                                    col.id === 'IN_REVIEW' ? 'IN_PROGRESS' :
                                    col.id === 'BLOCKED' ? 'IN_PROGRESS' : 'TODO';
                                  handleQuickStatusMove(t.id, prev as TaskStatus, e);
                                }}
                                className="p-0.5 hover:bg-slate-100 rounded text-slate-500"
                                title="Move Backward"
                              >
                                <ChevronLeft className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {col.id !== 'COMPLETED' && (
                              <button
                                onClick={(e) => {
                                  const next =
                                    col.id === 'TODO' ? 'IN_PROGRESS' :
                                    col.id === 'IN_PROGRESS' ? 'IN_REVIEW' :
                                    col.id === 'BLOCKED' ? 'IN_PROGRESS' : 'COMPLETED';
                                  handleQuickStatusMove(t.id, next as TaskStatus, e);
                                }}
                                className="p-0.5 hover:bg-slate-100 rounded text-slate-500"
                                title="Move Forward"
                              >
                                <ChevronRight className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Table / List View */}
      {viewMode === 'list' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Task Code</th>
                  <th className="px-4 py-3">Title</th>
                  <th className="px-4 py-3">Project</th>
                  <th className="px-4 py-3">Assignee</th>
                  <th className="px-4 py-3">Priority</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Due Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {tasks.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                      No tasks found matching your filters.
                    </td>
                  </tr>
                ) : (
                  tasks.map((t) => (
                    <tr
                      key={t.id}
                      onClick={() => setSelectedTaskId(t.id)}
                      className="hover:bg-slate-50/80 transition cursor-pointer group"
                    >
                      <td className="px-4 py-3 font-mono font-bold text-blue-700">
                        {t.task_code}
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-900 group-hover:text-blue-600">
                        {t.title}
                      </td>
                      <td className="px-4 py-3 text-slate-600 font-medium">{t.project_name}</td>
                      <td className="px-4 py-3 text-slate-700">{t.assigneeName}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] ${priorityBadges[t.priority]}`}>
                          {t.priority}
                        </span>
                      </td>
                      <td className="px-4 py-3 capitalize">{t.status.toLowerCase().replace('_', ' ')}</td>
                      <td className="px-4 py-3">
                        {t.isOverdue ? (
                          <span className="text-rose-600 font-bold flex items-center gap-1">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            {t.due_date}
                          </span>
                        ) : (
                          t.due_date
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modals */}
      <TaskModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={loadTasks}
      />
      <TaskDetailModal
        taskId={selectedTaskId}
        isOpen={Boolean(selectedTaskId)}
        onClose={() => setSelectedTaskId(null)}
        onTaskUpdated={loadTasks}
      />
    </div>
  );
};
