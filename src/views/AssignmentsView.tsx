import React, { useState, useEffect } from 'react';
import {
  Briefcase,
  Plus,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  User,
  Users,
  Calendar,
  Layers,
  ArrowRight,
  Clock
} from 'lucide-react';
import { api } from '../api.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { AssignmentItem } from '../types.ts';
import { AssignmentModal } from '../components/AssignmentModal.tsx';
import { TaskModal } from '../components/TaskModal.tsx';
import { TaskDetailModal } from '../components/TaskDetailModal.tsx';

export const AssignmentsView: React.FC = () => {
  const { user } = useAuth();
  const [assignments, setAssignments] = useState<AssignmentItem[]>([]);
  const [expandedIds, setExpandedIds] = useState<number[]>([]);
  const [assignmentTasks, setAssignmentTasks] = useState<Record<number, any[]>>({});
  const [isLoading, setIsLoading] = useState(false);

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [addTaskAssignmentId, setAddTaskAssignmentId] = useState<number | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);

  const role = user?.role || 'EMPLOYEE';
  const isAdminOrManager = role !== 'EMPLOYEE';

  const loadAssignments = async () => {
    setIsLoading(true);
    try {
      const list = await api.getAssignments();
      setAssignments(list);
      // Automatically expand the first one
      if (list.length > 0 && expandedIds.length === 0) {
        setExpandedIds([list[0].id]);
        loadTasksForAssignment(list[0].id);
      }
    } catch (err) {
      console.error('Failed to load assignments:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadTasksForAssignment = async (id: number) => {
    try {
      const details = await api.getAssignmentById(id);
      setAssignmentTasks((prev) => ({ ...prev, [id]: details.tasks || [] }));
    } catch (err) {
      console.error('Failed to load assignment tasks:', err);
    }
  };

  useEffect(() => {
    loadAssignments();
  }, []);

  const toggleExpand = (id: number) => {
    if (expandedIds.includes(id)) {
      setExpandedIds(expandedIds.filter((item) => item !== id));
    } else {
      setExpandedIds([...expandedIds, id]);
      if (!assignmentTasks[id]) {
        loadTasksForAssignment(id);
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Work Assignments Hub
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            High-level mission milestones with automatically computed sub-task completion metrics.
          </p>
        </div>

        {isAdminOrManager && (
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-sm transition flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Create Assignment</span>
          </button>
        )}
      </div>

      {/* Overview Banner */}
      <div className="p-4 bg-indigo-50/70 rounded-xl border border-indigo-200 text-xs text-indigo-900 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Briefcase className="w-5 h-5 text-indigo-600 shrink-0" />
          <span>
            Assignments group complex enterprise initiatives into milestone tasks. Completion progress updates automatically as linked tasks are finished.
          </span>
        </div>
      </div>

      {/* Assignments List */}
      <div className="space-y-4">
        {assignments.length === 0 ? (
          <div className="bg-white p-12 rounded-xl border border-slate-200 text-center text-slate-400">
            No assignments recorded. Click "Create Assignment" to initiate one.
          </div>
        ) : (
          assignments.map((a) => {
            const isExpanded = expandedIds.includes(a.id);
            const tasks = assignmentTasks[a.id] || [];

            return (
              <div
                key={a.id}
                className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden transition"
              >
                {/* Assignment Top Header */}
                <div
                  onClick={() => toggleExpand(a.id)}
                  className="p-5 cursor-pointer hover:bg-slate-50/60 transition flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                        {a.project_code}
                      </span>
                      <h3 className="text-base font-bold text-slate-900">{a.title}</h3>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                        {a.priority}
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 line-clamp-1">{a.description}</p>

                    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 pt-1">
                      <span className="flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-slate-400" />
                        Team: <strong className="text-slate-700">{a.team_name || 'Cross-Team'}</strong>
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        Lead: <strong className="text-slate-700">{a.leadName}</strong>
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        Target: <strong className="text-slate-700">{a.due_date}</strong>
                      </span>
                    </div>
                  </div>

                  {/* Progress Stats & Toggle */}
                  <div className="flex items-center gap-6 shrink-0">
                    <div className="w-48 space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-800">{a.progressPercent}% Completed</span>
                        <span className="text-slate-500">{a.completedTasks}/{a.totalTasks}</span>
                      </div>
                      <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-indigo-600 rounded-full transition-all duration-300"
                          style={{ width: `${a.progressPercent}%` }}
                        />
                      </div>
                    </div>

                    <div className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100">
                      {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </div>
                  </div>
                </div>

                {/* Sub-Tasks Expansion Panel */}
                {isExpanded && (
                  <div className="p-5 bg-slate-50/70 border-t border-slate-200 space-y-3 animate-in fade-in">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                        Milestone Tasks ({tasks.length})
                      </h4>
                      {isAdminOrManager && (
                        <button
                          onClick={() => setAddTaskAssignmentId(a.id)}
                          className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add Task to Assignment</span>
                        </button>
                      )}
                    </div>

                    {tasks.length === 0 ? (
                      <div className="p-4 bg-white rounded-lg border border-slate-200 text-center text-xs text-slate-400">
                        No individual tasks attached to this assignment yet.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                        {tasks.map((t: any) => (
                          <div
                            key={t.id}
                            onClick={() => setSelectedTaskId(t.id)}
                            className="p-3 bg-white rounded-lg border border-slate-200 hover:border-indigo-400 transition cursor-pointer flex items-center justify-between group"
                          >
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-[10px] font-bold text-indigo-700 bg-indigo-50 px-1 py-0.2 rounded">
                                  {t.task_code}
                                </span>
                                <span className="text-xs font-bold text-slate-900 group-hover:text-indigo-600">
                                  {t.title}
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-500">
                                Assigned: {t.first_name ? `${t.first_name} ${t.last_name}` : 'Unassigned'} • Due: {t.due_date}
                              </div>
                            </div>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded border capitalize ${
                                t.status === 'COMPLETED'
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                  : 'bg-slate-100 text-slate-700 border-slate-200'
                              }`}
                            >
                              {t.status.toLowerCase().replace('_', ' ')}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Modals */}
      <AssignmentModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={loadAssignments}
      />
      <TaskDetailModal
        taskId={selectedTaskId}
        isOpen={Boolean(selectedTaskId)}
        onClose={() => setSelectedTaskId(null)}
        onTaskUpdated={loadAssignments}
      />
    </div>
  );
};
