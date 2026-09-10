import React, { useState, useEffect } from 'react';
import {
  Users,
  Clock,
  CheckCircle2,
  AlertTriangle,
  FolderKanban,
  Briefcase,
  ArrowRight,
  TrendingUp,
  Plus,
  ShieldCheck,
  Calendar
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { api } from '../api.ts';
import { AttendanceCard } from '../components/AttendanceCard.tsx';
import { TaskModal } from '../components/TaskModal.tsx';
import { AssignmentModal } from '../components/AssignmentModal.tsx';
import { TaskDetailModal } from '../components/TaskDetailModal.tsx';

interface DashboardViewProps {
  onNavigate: (view: string, id?: number) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const [liveAttendance, setLiveAttendance] = useState<any>(null);
  const [tasksReport, setTasksReport] = useState<any>(null);
  const [recentTasks, setRecentTasks] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);

  // Modals
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isAssignmentModalOpen, setIsAssignmentModalOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);

  const loadDashboardData = async () => {
    try {
      const [att, tasks, proj, assign] = await Promise.all([
        api.getLiveAttendance().catch(() => null),
        api.getTasks({ limit: 6 }).catch(() => []),
        api.getProjects().catch(() => []),
        api.getAssignments().catch(() => [])
      ]);

      if (att) setLiveAttendance(att);
      setRecentTasks(tasks.slice(0, 5));
      setProjects(proj.slice(0, 4));
      setAssignments(assign.slice(0, 3));

      const tRep = await api.getTasksReport().catch(() => null);
      if (tRep) setTasksReport(tRep.summary);
    } catch (err) {
      console.error('Dashboard fetch failed:', err);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [user]);

  const role = user?.role || 'EMPLOYEE';
  const isAdminOrManager = role !== 'EMPLOYEE';

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 text-white p-6 rounded-2xl shadow-sm border border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold uppercase tracking-widest text-blue-400">
              McGate Enterprise Operations
            </span>
            <span className="text-slate-500">•</span>
            <span className="text-xs text-slate-400">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            Welcome back, {user?.firstName || 'Colleague'}
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-2xl">
            {role === 'EMPLOYEE'
              ? 'Clock in to mark your attendance, track your assignments, and manage assigned deliverables.'
              : 'Enterprise visibility across active attendance, tasks, deliverables, and departmental workflows.'}
          </p>
        </div>

        {/* Quick Actions */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            onClick={() => setIsTaskModalOpen(true)}
            className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-sm transition flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Create Task</span>
          </button>
          {isAdminOrManager && (
            <button
              onClick={() => setIsAssignmentModalOpen(true)}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-lg border border-slate-700 transition flex items-center gap-1.5"
            >
              <Briefcase className="w-4 h-4" />
              <span>New Assignment</span>
            </button>
          )}
        </div>
      </div>

      {/* CORE ATTENDANCE CARD (Front and center as mandated) */}
      <AttendanceCard onStatusUpdated={loadDashboardData} />

      {/* High-Level Enterprise Metrics Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Total Employees & Present */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold mb-2">
            <span>Workforce Active Today</span>
            <Users className="w-4 h-4 text-blue-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900">
              {liveAttendance?.metrics?.clockedIn ?? '—'}
            </span>
            <span className="text-xs text-slate-400">
              / {liveAttendance?.metrics?.totalEmployees ?? '—'} registered
            </span>
          </div>
          <div className="text-[11px] text-emerald-600 font-medium mt-1">
            {liveAttendance?.metrics?.currentlyActive ?? 0} currently active on shift
          </div>
        </div>

        {/* Metric 2: Open / Unclosed Sessions */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold mb-2">
            <span>Open Sessions</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900">
              {liveAttendance?.metrics?.unclosedSessionsCount ?? 0}
            </span>
            <span className="text-xs text-slate-400">past records</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            No clock-out recorded (Available for HR review)
          </div>
        </div>

        {/* Metric 3: Active Tasks */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold mb-2">
            <span>Tasks In Progress</span>
            <CheckCircle2 className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900">
              {tasksReport?.inProgress ?? '—'}
            </span>
            <span className="text-xs text-slate-400">
              of {tasksReport?.total ?? '—'} total
            </span>
          </div>
          <div className="text-[11px] text-blue-600 font-medium mt-1">
            {tasksReport?.completionRate ?? 0}% overall completion rate
          </div>
        </div>

        {/* Metric 4: Overdue Items */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold mb-2">
            <span>Overdue Deliverables</span>
            <AlertTriangle className="w-4 h-4 text-rose-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-rose-600">
              {tasksReport?.overdue ?? 0}
            </span>
            <span className="text-xs text-slate-400">urgent action</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Late arrival flags: {liveAttendance?.metrics?.lateArrivals ?? 0} today
          </div>
        </div>
      </div>

      {/* Two Column Layout: Tasks & Assignments / Projects */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Recent Tasks */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-blue-600" />
              <h3 className="text-sm font-bold text-slate-900">Work Tasks & Status</h3>
            </div>
            <button
              onClick={() => onNavigate('tasks')}
              className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1"
            >
              <span>View All Tasks</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="divide-y divide-slate-100">
            {recentTasks.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">No tasks created yet.</div>
            ) : (
              recentTasks.map((t) => (
                <div
                  key={t.id}
                  onClick={() => setSelectedTaskId(t.id)}
                  className="p-4 flex items-center justify-between hover:bg-slate-50/80 transition cursor-pointer group"
                >
                  <div className="space-y-1 pr-4">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                        {t.task_code}
                      </span>
                      <h4 className="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-blue-600 transition">
                        {t.title}
                      </h4>
                      {t.isOverdue && (
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-rose-100 text-rose-800 border border-rose-200">
                          OVERDUE
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 flex flex-wrap items-center gap-3">
                      <span>Project: <strong className="text-slate-700">{t.project_name}</strong></span>
                      <span>•</span>
                      <span>Assignee: <strong className="text-slate-700">{t.assigneeName}</strong></span>
                      <span>•</span>
                      <span>Due: <strong className="text-slate-700">{t.due_date}</strong></span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-semibold px-2 py-1 rounded bg-slate-100 text-slate-700 border border-slate-200 capitalize">
                      {t.status.toLowerCase().replace('_', ' ')}
                    </span>
                    <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-blue-600" />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right 1 Col: Active Assignments & Progress */}
        <div className="space-y-6">
          {/* Assignments Card */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-indigo-600" />
                <h3 className="text-sm font-bold text-slate-900">Active Assignments</h3>
              </div>
              <button
                onClick={() => onNavigate('assignments')}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
              >
                View Hub
              </button>
            </div>

            <div className="p-4 space-y-4">
              {assignments.length === 0 ? (
                <div className="text-xs text-slate-400 italic">No assignments active.</div>
              ) : (
                assignments.map((a) => (
                  <div key={a.id} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-800">{a.title}</span>
                      <span className="font-mono text-slate-500">{a.progressPercent}%</span>
                    </div>
                    {/* Progress Bar */}
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-600 rounded-full transition-all duration-300"
                        style={{ width: `${a.progressPercent}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span>{a.team_name || 'Cross-functional Team'}</span>
                      <span>{a.completedTasks}/{a.totalTasks} completed</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Strategic Projects */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FolderKanban className="w-4 h-4 text-emerald-600" />
                <h3 className="text-sm font-bold text-slate-900">Project Initiatives</h3>
              </div>
              <button
                onClick={() => onNavigate('projects')}
                className="text-xs font-semibold text-emerald-600 hover:text-emerald-800"
              >
                All Projects
              </button>
            </div>

            <div className="p-4 space-y-3">
              {projects.map((p) => (
                <div key={p.id} className="flex items-center justify-between text-xs p-2 rounded-lg bg-slate-50">
                  <div>
                    <div className="font-bold text-slate-800">{p.name}</div>
                    <div className="text-[11px] text-slate-500">
                      Lead: {p.managerName} • {p.totalTasks} tasks
                    </div>
                  </div>
                  <span className="font-bold font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    {p.progressPercent}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      <TaskModal
        isOpen={isTaskModalOpen}
        onClose={() => setIsTaskModalOpen(false)}
        onSuccess={loadDashboardData}
      />
      <AssignmentModal
        isOpen={isAssignmentModalOpen}
        onClose={() => setIsAssignmentModalOpen(false)}
        onSuccess={loadDashboardData}
      />
      <TaskDetailModal
        taskId={selectedTaskId}
        isOpen={Boolean(selectedTaskId)}
        onClose={() => setSelectedTaskId(null)}
        onTaskUpdated={loadDashboardData}
      />
    </div>
  );
};
