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
  AlertTriangle
} from 'lucide-react';
import { api } from '../api.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { TaskStatus } from '../types.ts';

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

  // Attachment upload simulation
  const [newFileName, setNewFileName] = useState('');
  const [isAddingFile, setIsAddingFile] = useState(false);

  const loadTask = async () => {
    if (!taskId) return;
    setIsLoading(true);
    try {
      const data = await api.getTaskById(taskId);
      setTask(data);
      setActualHoursInput(data.actual_hours || 0);
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
    }
  }, [isOpen, taskId]);

  if (!isOpen || !taskId) return null;

  const handleStatusChange = async (newStatus: TaskStatus) => {
    try {
      await api.updateTask(taskId, { status: newStatus });
      await loadTask();
      onTaskUpdated?.();
    } catch (err: any) {
      alert(err.message || 'Status change failed');
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
    LOW: 'text-slate-600 bg-slate-100',
    MEDIUM: 'text-blue-700 bg-blue-50',
    HIGH: 'text-amber-700 bg-amber-50',
    URGENT: 'text-rose-700 bg-rose-50'
  };

  return (
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
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
            <X className="w-5 h-5" />
          </button>
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
                <span className="font-semibold text-slate-800 flex items-center gap-1">
                  <Layers className="w-3.5 h-3.5 text-blue-500" />
                  {task.project_name}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block mb-1">Assignee</span>
                <span className="font-semibold text-slate-800 flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-slate-500" />
                  {task.assigneeName || 'Unassigned'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block mb-1">Due Date</span>
                <span className="font-semibold text-slate-800 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-500" />
                  {task.due_date}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block mb-1">Priority</span>
                <span className={`inline-block font-bold px-1.5 py-0.5 rounded ${priorityColors[task.priority]}`}>
                  {task.priority}
                </span>
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
  );
};
