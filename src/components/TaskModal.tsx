import React, { useState, useEffect } from 'react';
import { X, CheckSquare, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Modal } from './Modal.tsx';
import { api } from '../api.ts';
import { TaskItem, TaskPriority } from '../types.ts';

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  task?: TaskItem | any | null;
  onSuccess: () => void;
  initialProjectId?: number;
  initialAssignmentId?: number;
}

export const TaskModal: React.FC<TaskModalProps> = ({
  isOpen,
  onClose,
  task,
  onSuccess,
  initialProjectId,
  initialAssignmentId
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [projectId, setProjectId] = useState<number | ''>('');
  const [assignmentId, setAssignmentId] = useState<number | ''>('');
  const [assignedEmployeeId, setAssignedEmployeeId] = useState<number | ''>('');
  const [priority, setPriority] = useState<TaskPriority>('MEDIUM');
  const [dueDate, setDueDate] = useState('');
  const [estimatedHours, setEstimatedHours] = useState<number>(4);

  const [projects, setProjects] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    // Load reference data
    const loadData = async () => {
      try {
        const [pList, aList, eList] = await Promise.all([
          api.getProjects(),
          api.getAssignments(),
          api.getEmployees()
        ]);
        setProjects(pList);
        setAssignments(aList);
        setEmployees(eList);

        if (task) {
          setTitle(task.title || '');
          setDescription(task.description || '');
          setProjectId(task.project_id || pList[0]?.id || '');
          setAssignmentId(task.assignment_id || '');
          setAssignedEmployeeId(task.assigned_employee_id || '');
          setPriority(task.priority || 'MEDIUM');
          setDueDate(task.due_date || '');
          setEstimatedHours(task.estimated_hours || 4);
        } else {
          setTitle('');
          setDescription('');
          setProjectId(initialProjectId || pList[0]?.id || '');
          setAssignmentId(initialAssignmentId || '');
          setAssignedEmployeeId(eList[0]?.id || '');
          setPriority('MEDIUM');
          const nextWeek = new Date();
          nextWeek.setDate(nextWeek.getDate() + 7);
          setDueDate(nextWeek.toISOString().split('T')[0]);
          setEstimatedHours(4);
        }
      } catch (err) {
        console.error('Failed to load form options:', err);
      }
    };

    loadData();
  }, [isOpen, task, initialProjectId, initialAssignmentId]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !projectId || !dueDate) {
      setError('Title, Project, and Due Date are required.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      if (task) {
        await api.updateTask(task.id, {
          title: title.trim(),
          description,
          projectId: Number(projectId),
          assignmentId: assignmentId ? Number(assignmentId) : null,
          assignedEmployeeId: assignedEmployeeId ? Number(assignedEmployeeId) : null,
          priority,
          dueDate,
          estimatedHours: Number(estimatedHours)
        });
      } else {
        await api.createTask({
          title: title.trim(),
          description,
          projectId: Number(projectId),
          assignmentId: assignmentId ? Number(assignmentId) : null,
          assignedEmployeeId: assignedEmployeeId ? Number(assignedEmployeeId) : null,
          priority,
          dueDate,
          estimatedHours: Number(estimatedHours)
        });
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Operation failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter assignments by selected project
  const filteredAssignments = assignments.filter(
    (a) => !projectId || a.project_id === Number(projectId)
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth="max-w-xl">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <CheckSquare className="w-5 h-5 text-blue-600" />
            <h3 className="text-sm font-bold text-slate-900">
              {task ? `Edit Task: ${task.task_code}` : 'Create New Work Task'}
            </h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-lg flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Task Title <span className="text-rose-600">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Implement multi-factor token authentication endpoint"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Description & Specifications
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detailed technical specifications, acceptance criteria, or deliverables..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Parent Project <span className="text-rose-600">*</span>
              </label>
              <select
                required
                value={projectId}
                onChange={(e) => {
                  setProjectId(Number(e.target.value));
                  setAssignmentId('');
                }}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none bg-white"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    [{p.code}] {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Project Milestone (Assignment)
              </label>
              <select
                value={assignmentId}
                onChange={(e) => setAssignmentId(e.target.value ? Number(e.target.value) : '')}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none bg-white"
              >
                <option value="">None (Standalone Task)</option>
                {filteredAssignments.map((a) => (
                  <option key={a.id} value={a.id}>
                    🚩 {a.title} {a.leadName ? `(${a.leadName})` : ''}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[11px] text-slate-500">
                Tasks assigned here drive the milestone's weighted stage and completion %
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Assignee
              </label>
              <select
                value={assignedEmployeeId}
                onChange={(e) => setAssignedEmployeeId(e.target.value ? Number(e.target.value) : '')}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none bg-white"
              >
                <option value="">Unassigned</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.first_name} {emp.last_name} {emp.job_title ? `— ${emp.job_title}` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Priority & Milestone Weight
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none bg-white font-medium"
              >
                <option value="URGENT">🔴 Urgent (Weight 4x — Critical Milestone Driver)</option>
                <option value="HIGH">🟠 High (Weight 3x — Major Deliverable)</option>
                <option value="MEDIUM">🔵 Medium (Weight 2x — Standard Deliverable)</option>
                <option value="LOW">⚪ Low (Weight 1x — Minor Support Item)</option>
              </select>
            </div>
          </div>

          {/* Priority Weight Explanation Box */}
          <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-lg text-[11px] text-amber-900 flex items-start gap-2">
            <span className="font-bold text-amber-700 shrink-0">⚡ Automated Progress:</span>
            <span>
              Assigning priority determines this task's statistical weight in milestone progress.
              {priority === 'URGENT' && ' Urgent priority has 4x impact on milestone completion!'}
              {priority === 'HIGH' && ' High priority has 3x impact on milestone completion.'}
              {priority === 'MEDIUM' && ' Medium priority has 2x impact on milestone completion.'}
              {priority === 'LOW' && ' Low priority has 1x impact on milestone completion.'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Due Date <span className="text-rose-600">*</span>
              </label>
              <input
                type="date"
                required
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Estimated Hours
              </label>
              <input
                type="number"
                min="0.5"
                step="0.5"
                value={estimatedHours}
                onChange={(e) => setEstimatedHours(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>

          <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-sm transition disabled:opacity-50 flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{task ? 'Update Task' : 'Create Task'}</span>
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
};
