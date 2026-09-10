import React, { useState, useEffect } from 'react';
import {
  X,
  Clock,
  User,
  Paperclip,
  MessageSquare,
  History,
  Send,
  AlertCircle,
  FileText,
  Calendar,
  Layers,
  CheckCircle2,
  AlertTriangle,
  Edit,
  Trash2,
  UserCheck,
  Flag,
  ArrowRight
} from 'lucide-react';
import { api } from '../api.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { TaskStatus, TaskPriority } from '../types.ts';
import { TaskModal } from './TaskModal.tsx';

interface TaskDetailModalProps {
  taskId: number | null;
  isOpen: boolean;
  onClose: () => void;
  onTaskUpdated?: () => void;
}

export const TaskDetailModal: React.FC<TaskDetailModalProps> = ({
  taskId,
  isOpen,
  onClose,
  onTaskUpdated
}) => {
  const { user } = useAuth();
  const [task, setTask] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'comments' | 'activity' | 'attachments'>('comments');
  const [commentText, setCommentText] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [actualHoursInput, setActualHoursInput] = useState<number>(0);

  // Reassignment and editing state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [employees, setEmployees] = useState<any[]>([]);
  const [projectMilestones, setProjectMilestones] = useState<any[]>([]);
  const [isReassigning, setIsReassigning] = useState(false);
  const [selectedAssigneeId, setSelectedAssigneeId] = useState<number | ''>('');
  const [isDeleting, setIsDeleting] = useState(false);

  // Attachment upload simulation
  const [newFileName, setNewFileName] = useState('');
  const [isAddingFile, setIsAddingFile] = useState(false);

  const loadTask = async () => {
    if (!taskId) return;
    setIsLoading(true);
    try {
      const [taskData, empList] = await Promise.all([
        api.getTaskById(taskId),
        api.getEmployees()
      ]);
      setTask(taskData);
      setActualHoursInput(taskData.actual_hours || 0);
      setSelectedAssigneeId(taskData.assigned_employee_id || '');
      setEmployees(empList);

      if (taskData.project_id) {
        const milestones = await api.getAssignments({ projectId: taskData.project_id });
        setProjectMilestones(milestones);
      }
    } catch (err) {
      console.error('Failed to load task:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && taskId) {
      loadTask();
    } else {
      setTask(null);
      setIsReassigning(false);
    }
  }, [isOpen, taskId]);

  if (!isOpen || !taskId) return null;

  const canManageTask =
    user?.role === 'SUPER_ADMIN' ||
    user?.role === 'ADMIN' ||
    user?.role === 'MANAGER' ||
    (user?.employeeId && task?.project_manager_id === user.employeeId);

  const handleStatusChange = async (newStatus: TaskStatus) => {
    try {
      await api.updateTask(taskId, { status: newStatus });
      await loadTask();
      onTaskUpdated?.();
    } catch (err: any) {
      alert(err.message || 'Status change failed');
    }
  };

  const handlePriorityChange = async (newPriority: TaskPriority) => {
    try {
      await api.updateTask(taskId, { priority: newPriority });
      await loadTask();
      onTaskUpdated?.();
    } catch (err: any) {
      alert(err.message || 'Priority update failed');
    }
  };

  const handleMilestoneChange = async (newMilestoneId: number | null) => {
    try {
      await api.updateTask(taskId, { assignmentId: newMilestoneId });
      await loadTask();
      onTaskUpdated?.();
    } catch (err: any) {
      alert(err.message || 'Milestone change failed');
    }
  };

  const handleReassign = async () => {
    try {
      await api.updateTask(taskId, {
        assignedEmployeeId: selectedAssigneeId ? Number(selectedAssigneeId) : null
      });
      setIsReassigning(false);
      await loadTask();
      onTaskUpdated?.();
    } catch (err: any) {
      alert(err.message || 'Reassignment failed');
    }
  };

  const handleDeleteTask = async () => {
    if (!window.confirm(`Are you sure you want to delete task "${task?.title}"? This will automatically recalculate the milestone progress.`)) {
      return;
    }

    setIsDeleting(true);
    try {
      await api.deleteTask(taskId);
      onTaskUpdated?.();
      onClose();
    } catch (err: any) {
      alert(err.message || 'Failed to delete task');
      setIsDeleting(false);
    }
  };

  const handleUpdateActualHours = async () => {
    try {
      await api.updateTask(taskId, { actualHours: Number(actualHoursInput) });
      await loadTask();
      onTaskUpdated?.();
    } catch (err: any) {
      alert(err.message || 'Failed to update hours');
    }
  };

  const handleSendComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;

    setIsSubmittingComment(true);
    try {
      await api.addTaskComment(taskId, { message: commentText.trim() });
      setCommentText('');
      await loadTask();
    } catch (err: any) {
      alert(err.message || 'Failed to post comment');
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleAddAttachment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFileName.trim()) return;

    try {
      await api.addTaskAttachment(taskId, {
        filename: newFileName.trim(),
        fileSize: Math.floor(Math.random() * 5000) + 500,
        fileType: 'application/pdf'
      });
      setNewFileName('');
      setIsAddingFile(false);
      await loadTask();
    } catch (err: any) {
      alert(err.message || 'Failed to add attachment');
    }
  };

  const statusColors: Record<string, string> = {
    TODO: 'bg-slate-100 text-slate-700 border-slate-300',
    IN_PROGRESS: 'bg-blue-50 text-blue-700 border-blue-200',
    BLOCKED: 'bg-rose-50 text-rose-700 border-rose-200',
    IN_REVIEW: 'bg-amber-50 text-amber-700 border-amber-200',
    COMPLETED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    CANCELLED: 'bg-slate-100 text-slate-400 border-slate-200'
  };

  const priorityColors: Record<string, string> = {
    LOW: 'text-slate-600 bg-slate-100 border border-slate-200',
    MEDIUM: 'text-blue-700 bg-blue-50 border border-blue-200',
    HIGH: 'text-amber-700 bg-amber-50 border border-amber-200',
    URGENT: 'text-rose-700 bg-rose-50 border border-rose-200'
  };

  const priorityWeights: Record<string, number> = {
    URGENT: 4,
    HIGH: 3,
    MEDIUM: 2,
    LOW: 1
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4">
        <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
          {/* Header */}
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                {task?.task_code || 'TSK'}
              </span>
              <span className={`text-xs font-bold px-2 py-0.5 rounded border ${statusColors[task?.status || 'TODO']}`}>
                {task?.status?.replace('_', ' ')}
              </span>
              {task?.isOverdue && (
                <span className="text-xs font-bold px-2 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-300 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> OVERDUE
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {canManageTask && (
                <>
                  <button
                    onClick={() => setIsEditModalOpen(true)}
                    className="px-2.5 py-1 text-xs font-bold text-slate-700 hover:text-blue-600 bg-white border border-slate-200 rounded-md hover:bg-slate-50 transition flex items-center gap-1"
                    title="Edit Task Details"
                  >
                    <Edit className="w-3.5 h-3.5" />
                    <span>Edit</span>
                  </button>
                  <button
                    onClick={handleDeleteTask}
                    disabled={isDeleting}
                    className="px-2.5 py-1 text-xs font-bold text-rose-600 hover:text-rose-700 bg-rose-50 border border-rose-200 rounded-md hover:bg-rose-100 transition flex items-center gap-1"
                    title="Delete Task"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete</span>
                  </button>
                </>
              )}
              <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {isLoading ? (
            <div className="p-12 text-center text-sm text-slate-500">Loading task details...</div>
          ) : !task ? (
            <div className="p-12 text-center text-sm text-rose-500">Task could not be found.</div>
          ) : (
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Title & Description */}
              <div>
                <h2 className="text-xl font-bold text-slate-900 tracking-tight">{task.title}</h2>
                <p className="text-sm text-slate-600 mt-2 whitespace-pre-wrap">
                  {task.description || 'No detailed description provided.'}
                </p>
              </div>

              {/* Milestone & Priority Progress Calibration Card */}
              <div className="p-4 bg-amber-50/60 border border-amber-200/90 rounded-xl space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Flag className="w-4 h-4 text-amber-600 shrink-0" />
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 block">
                        Linked Project Milestone
                      </span>
                      <p className="text-xs font-bold text-slate-900">
                        {task.assignment_title || 'Standalone Task (No milestone linked)'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-500">Priority Weight:</span>
                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${priorityColors[task.priority]}`}>
                      {task.priority} ({priorityWeights[task.priority]}x Weight)
                    </span>
                  </div>
                </div>

                <div className="text-[11px] text-slate-600 leading-relaxed bg-white/70 p-2.5 rounded-lg border border-amber-100 flex items-start gap-2">
                  <span className="font-bold text-amber-700 shrink-0">Progress Formula:</span>
                  <span>
                    When this task transitions through workflow stages or updates priority, the milestone's weighted percentage and completion status are instantly synchronized.
                    {task.status === 'COMPLETED' ? ' (100% of this task’s weighted credit is awarded!)' : ' (Currently driving milestone progress)'}
                  </span>
                </div>

                {/* Milestone Relinking / Changing */}
                {canManageTask && (
                  <div className="pt-2 border-t border-amber-200/60 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[11px] font-medium text-slate-600">
                      Change Milestone Container:
                    </span>
                    <select
                      value={task.assignment_id || ''}
                      onChange={(e) => handleMilestoneChange(e.target.value ? Number(e.target.value) : null)}
                      className="px-2.5 py-1 bg-white border border-slate-300 rounded text-xs font-medium text-slate-800 outline-none"
                    >
                      <option value="">None (Standalone)</option>
                      {projectMilestones.map((m) => (
                        <option key={m.id} value={m.id}>
                          🚩 {m.title}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Quick Status Bar for Assignee / Manager */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-3">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Update Workflow Status:
                </span>
                <div className="flex flex-wrap items-center gap-1.5">
                  {(['TODO', 'IN_PROGRESS', 'BLOCKED', 'IN_REVIEW', 'COMPLETED'] as TaskStatus[]).map((st) => (
                    <button
                      key={st}
                      onClick={() => handleStatusChange(st)}
                      disabled={task.status === st}
                      className={`px-2.5 py-1 rounded text-xs font-semibold transition ${
                        task.status === st
                          ? 'bg-slate-900 text-white cursor-default'
                          : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-300'
                      }`}
                    >
                      {st.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>

              {/* Meta Attributes Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-xl border border-slate-200 text-xs">
                <div>
                  <span className="text-slate-400 block mb-1">Project</span>
                  <span className="font-semibold text-slate-800 flex items-center gap-1 truncate">
                    <Layers className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                    {task.project_name}
                  </span>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-slate-400 block">Assignee</span>
                    {canManageTask && !isReassigning && (
                      <button
                        onClick={() => setIsReassigning(true)}
                        className="text-[10px] text-blue-600 hover:underline font-bold"
                      >
                        Reassign
                      </button>
                    )}
                  </div>
                  {!isReassigning ? (
                    <span className="font-semibold text-slate-800 flex items-center gap-1">
                      <User className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      {task.assigneeName || 'Unassigned'}
                    </span>
                  ) : (
                    <div className="space-y-1">
                      <select
                        value={selectedAssigneeId}
                        onChange={(e) => setSelectedAssigneeId(e.target.value ? Number(e.target.value) : '')}
                        className="w-full px-1.5 py-1 bg-white border border-blue-400 rounded text-xs text-slate-800 outline-none"
                      >
                        <option value="">Unassigned</option>
                        {employees.map((emp) => (
                          <option key={emp.id} value={emp.id}>
                            {emp.first_name} {emp.last_name} ({emp.job_title || 'Staff'})
                          </option>
                        ))}
                      </select>
                      <div className="flex items-center gap-1 pt-1">
                        <button
                          onClick={handleReassign}
                          className="px-2 py-0.5 bg-blue-600 text-white rounded text-[10px] font-bold hover:bg-blue-700"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => {
                            setIsReassigning(false);
                            setSelectedAssigneeId(task.assigned_employee_id || '');
                          }}
                          className="px-1.5 py-0.5 text-[10px] text-slate-500 hover:underline"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <span className="text-slate-400 block mb-1">Due Date</span>
                  <span className="font-semibold text-slate-800 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    {task.due_date}
                  </span>
                </div>

                <div>
                  <span className="text-slate-400 block mb-1">Priority Level</span>
                  {canManageTask ? (
                    <select
                      value={task.priority}
                      onChange={(e) => handlePriorityChange(e.target.value as TaskPriority)}
                      className="px-2 py-0.5 rounded border border-slate-300 text-xs font-bold text-slate-800 bg-white"
                    >
                      <option value="URGENT">🔴 Urgent (4x)</option>
                      <option value="HIGH">🟠 High (3x)</option>
                      <option value="MEDIUM">🔵 Medium (2x)</option>
                      <option value="LOW">⚪ Low (1x)</option>
                    </select>
                  ) : (
                    <span className={`inline-block font-bold px-1.5 py-0.5 rounded ${priorityColors[task.priority]}`}>
                      {task.priority}
                    </span>
                  )}
                </div>
              </div>

              {/* Hours Tracker */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-blue-50/50 border border-blue-100 text-xs">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-blue-600" />
                  <span className="text-slate-700">
                    Estimated: <strong className="text-slate-900">{task.estimated_hours}h</strong> | Actual Logged: <strong className="text-slate-900">{task.actual_hours}h</strong>
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    value={actualHoursInput}
                    onChange={(e) => setActualHoursInput(Number(e.target.value))}
                    className="w-16 px-2 py-1 bg-white border border-slate-300 rounded text-xs text-center"
                  />
                  <button
                    onClick={handleUpdateActualHours}
                    className="px-2 py-1 bg-blue-600 text-white rounded font-medium hover:bg-blue-700"
                  >
                    Save Hours
                  </button>
                </div>
              </div>

              {/* Tabbed Activity / Comments / Attachments */}
              <div>
                <div className="flex items-center gap-4 border-b border-slate-200 text-xs font-bold">
                  <button
                    onClick={() => setActiveTab('comments')}
                    className={`pb-2 flex items-center gap-1.5 border-b-2 transition ${
                      activeTab === 'comments'
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Discussion ({task.comments?.length || 0})</span>
                  </button>
                  <button
                    onClick={() => setActiveTab('activity')}
                    className={`pb-2 flex items-center gap-1.5 border-b-2 transition ${
                      activeTab === 'activity'
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <History className="w-3.5 h-3.5" />
                    <span>Audit History ({task.activities?.length || 0})</span>
                  </button>
                  <button
                    onClick={() => setActiveTab('attachments')}
                    className={`pb-2 flex items-center gap-1.5 border-b-2 transition ${
                      activeTab === 'attachments'
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <Paperclip className="w-3.5 h-3.5" />
                    <span>Attachments ({task.attachments?.length || 0})</span>
                  </button>
                </div>

                {/* Comments Tab */}
                {activeTab === 'comments' && (
                  <div className="pt-4 space-y-4">
                    <div className="space-y-3 max-h-60 overflow-y-auto">
                      {task.comments?.length === 0 ? (
                        <p className="text-xs text-slate-400 italic">No comments yet. Mention teammates using @name.</p>
                      ) : (
                        task.comments.map((c: any) => (
                          <div key={c.id} className="p-3 bg-slate-50 rounded-lg border border-slate-100 text-xs">
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-bold text-slate-800">{c.author_name}</span>
                              <span className="text-[10px] text-slate-400">
                                {new Date(c.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                              </span>
                            </div>
                            <p className="text-slate-700">{c.message}</p>
                          </div>
                        ))
                      )}
                    </div>

                    <form onSubmit={handleSendComment} className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Add a comment or mention @teammate..."
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <button
                        type="submit"
                        disabled={isSubmittingComment || !commentText.trim()}
                        className="px-3 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Post</span>
                      </button>
                    </form>
                  </div>
                )}

                {/* Activity Tab */}
                {activeTab === 'activity' && (
                  <div className="pt-4 space-y-2 max-h-60 overflow-y-auto">
                    {task.activities?.map((a: any) => (
                      <div key={a.id} className="flex items-start gap-2.5 text-xs text-slate-600 border-l-2 border-slate-200 pl-3 py-1">
                        <div>
                          <span className="font-semibold text-slate-800">{a.user_name}</span>{' '}
                          <span>{a.action === 'STATUS_CHANGE' ? `changed status from ${a.from_value} to ${a.to_value}` : a.action}</span>
                          <div className="text-[10px] text-slate-400">
                            {new Date(a.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Attachments Tab */}
                {activeTab === 'attachments' && (
                  <div className="pt-4 space-y-3">
                    <div className="space-y-2">
                      {task.attachments?.length === 0 ? (
                        <p className="text-xs text-slate-400 italic">No files attached to this task.</p>
                      ) : (
                        task.attachments.map((att: any) => (
                          <div key={att.id} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-xs">
                            <div className="flex items-center gap-2">
                              <FileText className="w-4 h-4 text-blue-600" />
                              <span className="font-medium text-slate-800">{att.filename}</span>
                              <span className="text-[10px] text-slate-400">({att.file_size} KB)</span>
                            </div>
                            <span className="text-[10px] text-emerald-700 font-semibold">Attached</span>
                          </div>
                        ))
                      )}
                    </div>

                    {!isAddingFile ? (
                      <button
                        onClick={() => setIsAddingFile(true)}
                        className="text-xs font-semibold text-blue-600 hover:underline flex items-center gap-1"
                      >
                        <Paperclip className="w-3.5 h-3.5" />
                        <span>Attach Document / File</span>
                      </button>
                    ) : (
                      <form onSubmit={handleAddAttachment} className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Document name (e.g. auth-architecture-v1.pdf)"
                          value={newFileName}
                          onChange={(e) => setNewFileName(e.target.value)}
                          className="flex-1 px-3 py-1.5 border border-slate-300 rounded text-xs outline-none"
                        />
                        <button
                          type="submit"
                          className="px-3 py-1.5 bg-slate-800 text-white rounded text-xs font-medium"
                        >
                          Upload
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsAddingFile(false)}
                          className="px-2 text-xs text-slate-500"
                        >
                          Cancel
                        </button>
                      </form>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Task Edit Modal */}
      {isEditModalOpen && (
        <TaskModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          task={task}
          onSuccess={() => {
            setIsEditModalOpen(false);
            loadTask();
            onTaskUpdated?.();
          }}
        />
      )}
    </>
  );
};
