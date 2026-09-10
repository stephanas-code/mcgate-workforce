import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  FolderKanban,
  CheckCircle2,
  AlertTriangle,
  UploadCloud,
  FileText,
  FileCode,
  AlignLeft,
  Trash2,
  RefreshCw,
  Lock,
  Unlock,
  Check
} from 'lucide-react';
import { api } from '../api.ts';
import { generateProjectCodeFromName, formatFileSize } from '../utils/projectCode.ts';
import { Modal } from './Modal.tsx';

interface ProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface UploadedDocumentItem {
  id: string;
  name: string;
  size: number;
  ext: string;
  mimeType: string;
  dataUrl: string;
}

const ALLOWED_EXTENSIONS = ['txt', 'docx', 'pdf', 'md'];

export const ProjectModal: React.FC<ProjectModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [code, setCode] = useState('');
  const [isManualCode, setIsManualCode] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [departmentId, setDepartmentId] = useState<number | ''>('');
  const [managerId, setManagerId] = useState<number | ''>('');
  const [targetDate, setTargetDate] = useState('');

  const [departments, setDepartments] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Document upload state
  const [documents, setDocuments] = useState<UploadedDocumentItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadNotice, setUploadNotice] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load departments and employees on modal open
  useEffect(() => {
    if (!isOpen) return;
    const load = async () => {
      try {
        const [dList, eList] = await Promise.all([
          api.getDepartments(),
          api.getEmployees()
        ]);
        setDepartments(dList);
        setEmployees(eList);
        if (dList.length > 0) setDepartmentId(dList[0].id);
        if (eList.length > 0) setManagerId(eList[0].id);
      } catch (err) {
        console.error(err);
      }
    };
    load();
  }, [isOpen]);

  // Reset form when modal closes or opens
  useEffect(() => {
    if (isOpen) {
      setCode('');
      setIsManualCode(false);
      setName('');
      setDescription('');
      setTargetDate('');
      setDocuments([]);
      setError(null);
      setUploadNotice(null);
    }
  }, [isOpen]);

  // Real-time unique code generation from project name
  const handleNameChange = (val: string) => {
    setName(val);
    if (!isManualCode) {
      const generated = generateProjectCodeFromName(val);
      setCode(generated);
    }
  };

  // Debounced server-side uniqueness verification
  useEffect(() => {
    if (isManualCode || !name.trim()) return;

    const timer = setTimeout(async () => {
      try {
        const res = await api.generateProjectCode(name.trim());
        if (res?.code && !isManualCode) {
          setCode(res.code);
        }
      } catch (e) {
        // Fallback to client-generated code
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [name, isManualCode]);

  // Regenerate project code manually
  const handleRegenerateCode = async () => {
    if (!name.trim()) return;
    try {
      const res = await api.generateProjectCode(name.trim());
      setCode(res.code);
      setIsManualCode(false);
    } catch {
      setCode(generateProjectCodeFromName(name));
    }
  };

  // Process selected files (txt, docx, pdf, md)
  const processFiles = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setUploadNotice(null);
    setError(null);

    const newDocs: UploadedDocumentItem[] = [];
    const invalidFiles: string[] = [];

    Array.from(fileList).forEach((file) => {
      const ext = (file.name.split('.').pop() || '').toLowerCase();
      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        invalidFiles.push(file.name);
        return;
      }

      if (file.size > 15 * 1024 * 1024) {
        invalidFiles.push(`${file.name} (exceeds 15MB limit)`);
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        const item: UploadedDocumentItem = {
          id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          name: file.name,
          size: file.size,
          ext,
          mimeType: file.type || (ext === 'pdf' ? 'application/pdf' : 'text/plain'),
          dataUrl: result
        };
        setDocuments((prev) => [...prev, item]);
      };
      reader.readAsDataURL(file);
    });

    if (invalidFiles.length > 0) {
      setUploadNotice(
        `Some files were skipped: ${invalidFiles.join(', ')}. Only .txt, .docx, .pdf, and .md files up to 15MB are allowed.`
      );
    }
  };

  const handleRemoveDoc = (id: string) => {
    setDocuments((prev) => prev.filter((d) => d.id !== id));
  };

  const getDocIcon = (ext: string) => {
    switch (ext) {
      case 'pdf':
        return <FileText className="w-4 h-4 text-rose-600" />;
      case 'docx':
        return <FileText className="w-4 h-4 text-blue-600" />;
      case 'md':
        return <FileCode className="w-4 h-4 text-purple-600" />;
      case 'txt':
      default:
        return <AlignLeft className="w-4 h-4 text-emerald-600" />;
    }
  };

  const getDocBadge = (ext: string) => {
    switch (ext) {
      case 'pdf':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'docx':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'md':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'txt':
      default:
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Project Name is required.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const payload = {
        code: code.trim().toUpperCase() || generateProjectCodeFromName(name),
        name: name.trim(),
        description: description.trim(),
        departmentId: departmentId ? Number(departmentId) : null,
        managerId: managerId ? Number(managerId) : null,
        targetDate: targetDate || null,
        documents: documents.map((d) => ({
          filename: d.name,
          originalName: d.name,
          fileSize: d.size,
          fileExtension: d.ext,
          mimeType: d.mimeType,
          fileData: d.dataUrl
        }))
      };

      await api.createProject(payload);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create project');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth="max-w-xl">
      <div
        id="project-modal-container"
        className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full overflow-hidden"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
              <FolderKanban className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Initiate New Project</h3>
              <p className="text-[11px] text-slate-500">
                Register project milestone, set ownership, and upload specification documents.
              </p>
            </div>
          </div>
          <button
            id="close-project-modal-btn"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-200/60 transition"
          >
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

          {uploadNotice && (
            <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-lg flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
              <span>{uploadNotice}</span>
            </div>
          )}

          {/* Project Name & Auto-Generated Code */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Project Name <span className="text-rose-600">*</span>
            </label>
            <input
              id="project-name-input"
              type="text"
              required
              placeholder="e.g. NextGen ERP Platform or Zero-Trust Network"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
            />
          </div>

          {/* Code display with auto-generation info */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Project Code
                </label>
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                  <Check className="w-3 h-3 text-emerald-600" />
                  Auto-Generated Unique
                </span>
              </div>
              <div className="flex items-center gap-2">
                {name.trim() && (
                  <button
                    type="button"
                    onClick={handleRegenerateCode}
                    className="text-[11px] text-emerald-600 hover:text-emerald-800 flex items-center gap-1 font-medium transition"
                    title="Regenerate unique code from project name"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Sync</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsManualCode(!isManualCode)}
                  className="text-[11px] text-slate-500 hover:text-slate-800 flex items-center gap-1 font-medium transition"
                >
                  {isManualCode ? (
                    <>
                      <Unlock className="w-3 h-3" />
                      <span>Custom Code</span>
                    </>
                  ) : (
                    <>
                      <Lock className="w-3 h-3 text-slate-400" />
                      <span>Edit Manually</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <input
              id="project-code-input"
              type="text"
              required
              readOnly={!isManualCode}
              placeholder="PRJ-..."
              value={code}
              onChange={(e) => {
                setIsManualCode(true);
                setCode(e.target.value.toUpperCase());
              }}
              className={`w-full px-3 py-1.5 border rounded-lg text-sm font-mono font-bold tracking-wide outline-none transition ${
                isManualCode
                  ? 'bg-white border-blue-400 text-blue-900 focus:ring-2 focus:ring-blue-500'
                  : 'bg-slate-100 border-slate-300 text-emerald-800 select-all cursor-default'
              }`}
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Code is automatically formatted using the enterprise acronym format based on the project name.
            </p>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Description & Objectives
            </label>
            <textarea
              id="project-description-input"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Strategic deliverables, technical scope, and operational milestones..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
            />
          </div>

          {/* Department & Lead Manager */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Sponsoring Department
              </label>
              <select
                id="project-department-select"
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value ? Number(e.target.value) : '')}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-800 focus:ring-2 focus:ring-emerald-500 outline-none bg-white"
              >
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Project Lead / Manager
              </label>
              <select
                id="project-manager-select"
                value={managerId}
                onChange={(e) => setManagerId(e.target.value ? Number(e.target.value) : '')}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-800 focus:ring-2 focus:ring-emerald-500 outline-none bg-white"
              >
                <option value="">Unassigned</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.first_name} {e.last_name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Target Completion Date */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Target Completion Date
            </label>
            <input
              id="project-target-date-input"
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-800 focus:ring-2 focus:ring-emerald-500 outline-none"
            />
          </div>

          {/* PROJECT DOCUMENTS UPLOAD (txt, docx, pdf, md) */}
          <div className="pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between mb-1.5">
              <div>
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <UploadCloud className="w-4 h-4 text-indigo-600" />
                  <span>Project Documents</span>
                </label>
                <p className="text-[11px] text-slate-500">
                  Upload project briefs, technical specs, runbooks, or architecture files.
                </p>
              </div>
              <div className="flex items-center gap-1 text-[10px] font-mono text-slate-400">
                <span className="px-1.5 py-0.5 rounded bg-slate-100 font-semibold text-slate-600">.txt</span>
                <span className="px-1.5 py-0.5 rounded bg-blue-50 font-semibold text-blue-700">.docx</span>
                <span className="px-1.5 py-0.5 rounded bg-rose-50 font-semibold text-rose-700">.pdf</span>
                <span className="px-1.5 py-0.5 rounded bg-purple-50 font-semibold text-purple-700">.md</span>
              </div>
            </div>

            {/* Hidden native input */}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".txt,.docx,.pdf,.md,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/markdown"
              className="hidden"
              onChange={(e) => processFiles(e.target.files)}
            />

            {/* Drag and Drop Zone */}
            <div
              id="project-document-dropzone"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                processFiles(e.dataTransfer.files);
              }}
              className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition flex flex-col items-center justify-center gap-2 ${
                isDragging
                  ? 'border-indigo-500 bg-indigo-50/50'
                  : 'border-slate-300 hover:border-indigo-400 bg-slate-50/60 hover:bg-indigo-50/30'
              }`}
            >
              <div className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center">
                <UploadCloud className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-700">
                  <span className="text-indigo-600 hover:underline">Click to browse</span> or drag and drop documents
                </p>
                <p className="text-[11px] text-slate-400">
                  Allowed formats: .txt, .docx, .pdf, .md (Max 15MB each)
                </p>
              </div>
            </div>

            {/* List of Attached Documents */}
            {documents.length > 0 && (
              <div className="mt-3 space-y-1.5">
                <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium px-1">
                  <span>{documents.length} document(s) ready to attach:</span>
                  <button
                    type="button"
                    onClick={() => setDocuments([])}
                    className="text-rose-600 hover:underline text-[11px]"
                  >
                    Clear all
                  </button>
                </div>

                <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                  {documents.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200 text-xs hover:bg-slate-100/70 transition"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <div className="p-1 rounded bg-white shadow-2xs border border-slate-200 shrink-0">
                          {getDocIcon(doc.ext)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-slate-800 truncate" title={doc.name}>
                            {doc.name}
                          </p>
                          <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                            <span className={`px-1 py-0.2 rounded uppercase font-bold text-[9px] border ${getDocBadge(doc.ext)}`}>
                              {doc.ext}
                            </span>
                            <span>{formatFileSize(doc.size)}</span>
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveDoc(doc.id)}
                        className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition ml-2"
                        title="Remove file"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Footer Action Buttons */}
          <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
            <button
              id="cancel-create-project-btn"
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              id="submit-create-project-btn"
              type="submit"
              disabled={isSubmitting || !name.trim()}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-sm transition disabled:opacity-50 flex items-center gap-1.5"
            >
              {isSubmitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Creating Project...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Initiate Project {documents.length > 0 ? `(${documents.length} Docs)` : ''}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
};
