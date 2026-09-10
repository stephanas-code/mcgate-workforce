import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  FolderKanban,
  FileText,
  FileCode,
  AlignLeft,
  Download,
  Trash2,
  Eye,
  UploadCloud,
  CheckCircle2,
  Clock,
  User,
  Building,
  Calendar,
  Layers,
  AlertTriangle,
  Copy,
  Check,
  ExternalLink,
  Plus,
  Flag,
  ChevronDown,
  ChevronUp,
  Edit3,
  UserCheck,
  RefreshCw
} from 'lucide-react';
import { api } from '../api.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { ProjectItem, ProjectDocument } from '../types.ts';
import { formatFileSize } from '../utils/projectCode.ts';
import { AssignmentModal } from './AssignmentModal.tsx';
import { TaskModal } from './TaskModal.tsx';
import { TaskDetailModal } from './TaskDetailModal.tsx';
import { Modal } from './Modal.tsx';

interface ProjectDetailsModalProps {
  project: ProjectItem | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: () => void;
}

const ALLOWED_EXTENSIONS = ['txt', 'docx', 'pdf', 'md'];

export const ProjectDetailsModal: React.FC<ProjectDetailsModalProps> = ({
  project,
  isOpen,
  onClose,
  onUpdate
}) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'overview' | 'documents'>('overview');
  const [projectDetails, setProjectDetails] = useState<any>(null);
  const [documents, setDocuments] = useState<ProjectDocument[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);

  // Reassignment and modals state
  const [employees, setEmployees] = useState<any[]>([]);
  const [isReassignModalOpen, setIsReassignModalOpen] = useState(false);
  const [selectedLeadId, setSelectedLeadId] = useState<number | ''>('');
  const [reassignNotes, setReassignNotes] = useState('');
  const [isSavingReassign, setIsSavingReassign] = useState(false);

  // Milestone and Task management
  const [isCreateMilestoneOpen, setIsCreateMilestoneOpen] = useState(false);
  const [isCreateTaskOpen, setIsCreateTaskOpen] = useState(false);
  const [taskInitialAssignmentId, setTaskInitialAssignmentId] = useState<number | undefined>(undefined);
  const [selectedTaskIdForDetail, setSelectedTaskIdForDetail] = useState<number | null>(null);
  const [expandedMilestones, setExpandedMilestones] = useState<Record<number, boolean>>({});

  // Document preview state
  const [previewDoc, setPreviewDoc] = useState<ProjectDocument | null>(null);
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [copiedText, setCopiedText] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Load project details, documents, and employees
  const loadProjectData = async (projectId: number) => {
    setIsLoading(true);
    try {
      const [data, empList] = await Promise.all([
        api.getProjectById(projectId),
        api.getEmployees()
      ]);
      setProjectDetails(data);
      setEmployees(empList);
      setSelectedLeadId(data.manager_id || '');
      if (data.documents) {
        setDocuments(data.documents);
      }
    } catch (err) {
      console.error('Failed to load project details:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && project) {
      loadProjectData(project.id);
      setUploadError(null);
      setUploadSuccess(null);
      setPreviewDoc(null);
      setIsReassignModalOpen(false);
      setReassignNotes('');
    }
  }, [isOpen, project]);

  if (!isOpen || !project) return null;

  const canReassignProject =
    user?.role === 'SUPER_ADMIN' ||
    user?.role === 'ADMIN' ||
    user?.role === 'MANAGER';

  const handleReassignProjectLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLeadId) return;
    setIsSavingReassign(true);
    try {
      await api.reassignProject(project.id, {
        managerId: Number(selectedLeadId),
        notes: reassignNotes
      });
      setIsReassignModalOpen(false);
      setReassignNotes('');
      await loadProjectData(project.id);
      onUpdate();
    } catch (err: any) {
      alert(err.message || 'Failed to reassign project');
    } finally {
      setIsSavingReassign(false);
    }
  };

  const handleDeleteMilestone = async (milestoneId: number, title: string) => {
    if (!window.confirm(`Are you sure you want to delete milestone "${title}"? Any linked tasks will be detached and kept as standalone tasks.`)) {
      return;
    }
    try {
      await api.deleteAssignment(milestoneId);
      await loadProjectData(project.id);
      onUpdate();
    } catch (err: any) {
      alert(err.message || 'Failed to delete milestone');
    }
  };

  const toggleMilestoneExpand = (id: number) => {
    setExpandedMilestones((prev) => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  // Handle uploading documents into this project
  const handleUploadFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploadError(null);
    setUploadSuccess(null);
    setIsUploading(true);

    try {
      const docsToUpload: any[] = [];
      const invalidFiles: string[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const ext = (file.name.split('.').pop() || '').toLowerCase();

        if (!ALLOWED_EXTENSIONS.includes(ext)) {
          invalidFiles.push(file.name);
          continue;
        }

        if (file.size > 15 * 1024 * 1024) {
          invalidFiles.push(`${file.name} (exceeds 15MB limit)`);
          continue;
        }

        const dataUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.readAsDataURL(file);
        });

        docsToUpload.push({
          filename: file.name,
          originalName: file.name,
          fileSize: file.size,
          fileExtension: ext,
          mimeType: file.type || (ext === 'pdf' ? 'application/pdf' : 'text/plain'),
          fileData: dataUrl
        });
      }

      if (invalidFiles.length > 0) {
        setUploadError(
          `Skipped unsupported files: ${invalidFiles.join(', ')}. Only .txt, .docx, .pdf, and .md are supported.`
        );
      }

      if (docsToUpload.length > 0) {
        const res = await api.uploadProjectDocuments(project.id, docsToUpload);
        setDocuments(res.documents);
        setUploadSuccess(`Successfully uploaded ${docsToUpload.length} document(s).`);
        onUpdate();
      }
    } catch (err: any) {
      setUploadError(err.message || 'Failed to upload document');
    } finally {
      setIsUploading(false);
    }
  };

  // Close document preview modal and clean up Blob URL
  const handleClosePreview = () => {
    if (pdfBlobUrl) {
      URL.revokeObjectURL(pdfBlobUrl);
      setPdfBlobUrl(null);
    }
    setPreviewDoc(null);
    setPreviewContent(null);
  };

  // Open Preview for document
  const handleOpenPreview = async (doc: ProjectDocument) => {
    if (pdfBlobUrl) {
      URL.revokeObjectURL(pdfBlobUrl);
      setPdfBlobUrl(null);
    }
    setPreviewDoc(doc);
    setPreviewContent(null);
    setPreviewLoading(true);
    setCopiedText(false);

    try {
      // Fetch full document with file_data and server-extracted text
      const fullDoc = await api.getProjectDocumentById(project.id, doc.id);
      setPreviewDoc(fullDoc);

      const ext = (fullDoc.file_extension || '').toLowerCase().replace(/^\./, '');

      // 1. If it's a PDF, create a native Blob URL for embedding without Chromium data-URI blocks
      if (ext === 'pdf' && fullDoc.file_data) {
        try {
          let base64Part = fullDoc.file_data;
          if (base64Part.startsWith('data:')) {
            base64Part = base64Part.split(',')[1] || '';
          }
          const binaryString = window.atob(base64Part.replace(/\s/g, ''));
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          const blob = new Blob([bytes], { type: 'application/pdf' });
          const url = URL.createObjectURL(blob);
          setPdfBlobUrl(url);
        } catch (pdfErr) {
          console.error('Failed to create PDF blob preview:', pdfErr);
        }
      }

      // 2. If server provided extracted_text (e.g. from DOCX, TXT, MD)
      if (fullDoc.extracted_text) {
        setPreviewContent(fullDoc.extracted_text);
      } else if (ext === 'txt' || ext === 'md') {
        let rawContent = fullDoc.file_data || '';
        if (rawContent.startsWith('data:')) {
          const base64Part = (rawContent.split(',')[1] || '').replace(/\s/g, '');
          try {
            const binaryString = window.atob(base64Part);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }
            rawContent = new TextDecoder('utf-8').decode(bytes);
          } catch {
            rawContent = window.atob(base64Part);
          }
        }
        setPreviewContent(rawContent);
      } else {
        setPreviewContent(null);
      }
    } catch (err) {
      console.error('Failed to preview document:', err);
    } finally {
      setPreviewLoading(false);
    }
  };

  // Download document
  const handleDownload = async (doc: ProjectDocument) => {
    try {
      const fullDoc = await api.getProjectDocumentById(project.id, doc.id);
      if (!fullDoc.file_data) return;

      const a = document.createElement('a');
      a.href = fullDoc.file_data;
      a.download = fullDoc.original_name || fullDoc.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      console.error('Download error:', err);
    }
  };

  // Delete document
  const handleDeleteDoc = async (docId: number) => {
    if (!window.confirm('Are you sure you want to delete this document from the project?')) {
      return;
    }

    try {
      await api.deleteProjectDocument(project.id, docId);
      setDocuments((prev) => prev.filter((d) => d.id !== docId));
      if (previewDoc?.id === docId) {
        setPreviewDoc(null);
      }
      onUpdate();
    } catch (err: any) {
      alert(err.message || 'Failed to delete document');
    }
  };

  // Copy text preview to clipboard
  const handleCopyText = () => {
    if (!previewContent) return;
    navigator.clipboard.writeText(previewContent);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
  };

  const getDocIcon = (ext: string) => {
    switch (ext.toLowerCase()) {
      case 'pdf':
        return <FileText className="w-5 h-5 text-rose-600" />;
      case 'docx':
        return <FileText className="w-5 h-5 text-blue-600" />;
      case 'md':
        return <FileCode className="w-5 h-5 text-purple-600" />;
      case 'txt':
      default:
        return <AlignLeft className="w-5 h-5 text-emerald-600" />;
    }
  };

  const getDocBadge = (ext: string) => {
    switch (ext.toLowerCase()) {
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

  return (
    <>
      <Modal isOpen={isOpen && Boolean(project)} onClose={onClose} maxWidth="max-w-4xl">
        <div
          id="project-details-container"
          className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full overflow-hidden flex flex-col max-h-[90vh]"
        >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <span className="font-mono text-xs font-bold text-emerald-800 bg-emerald-100/80 px-2.5 py-1 rounded-md border border-emerald-300">
              {project.code}
            </span>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-slate-900 truncate">
                {project.name}
              </h2>
              <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                <span>{project.department_name || 'Enterprise'}</span>
                <span>•</span>
                <span className="font-medium text-slate-700">Lead: {project.managerName}</span>
                <span>•</span>
                <span className="px-1.5 py-0.2 rounded bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-bold">
                  {project.status}
                </span>
              </div>
            </div>
          </div>

          <button
            id="close-project-details-btn"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-200/60 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 px-6 border-b border-slate-200 bg-white shrink-0">
          <button
            onClick={() => setActiveTab('documents')}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 flex items-center gap-2 transition ${
              activeTab === 'documents'
                ? 'border-emerald-600 text-emerald-700 bg-emerald-50/40'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Project Documents</span>
            <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-100 text-emerald-800 font-mono">
              {documents.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 flex items-center gap-2 transition ${
              activeTab === 'overview'
                ? 'border-emerald-600 text-emerald-700 bg-emerald-50/40'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Overview & Milestones</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          {/* DOCUMENTS TAB */}
          {activeTab === 'documents' && (
            <div className="space-y-5">
              {uploadError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-lg flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{uploadError}</span>
                </div>
              )}

              {uploadSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-lg flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                  <span>{uploadSuccess}</span>
                </div>
              )}

              {/* Upload Dropzone */}
              <div className="bg-slate-50/80 border border-slate-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                      <UploadCloud className="w-4 h-4 text-emerald-600" />
                      <span>Upload Teammate Documents</span>
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Upload project briefs, design specs, architecture documents, or runbooks (.txt, .docx, .pdf, .md)
                    </p>
                  </div>
                  <div className="flex items-center gap-1 text-[10px] font-mono">
                    <span className="px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-700 font-semibold">.TXT</span>
                    <span className="px-1.5 py-0.5 rounded bg-blue-50 border border-blue-200 text-blue-700 font-semibold">.DOCX</span>
                    <span className="px-1.5 py-0.5 rounded bg-rose-50 border border-rose-200 text-rose-700 font-semibold">.PDF</span>
                    <span className="px-1.5 py-0.5 rounded bg-purple-50 border border-purple-200 text-purple-700 font-semibold">.MD</span>
                  </div>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".txt,.docx,.pdf,.md,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/markdown"
                  className="hidden"
                  onChange={(e) => handleUploadFiles(e.target.files)}
                />

                <div
                  id="project-details-dropzone"
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    handleUploadFiles(e.dataTransfer.files);
                  }}
                  className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition flex flex-col items-center justify-center gap-2 ${
                    isDragging
                      ? 'border-emerald-500 bg-emerald-50/50'
                      : 'border-slate-300 hover:border-emerald-400 bg-white hover:bg-emerald-50/20'
                  }`}
                >
                  <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
                    {isUploading ? (
                      <div className="w-5 h-5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <UploadCloud className="w-5 h-5" />
                    )}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-800">
                      <span className="text-emerald-600 hover:underline">Click to upload document</span> or drag & drop here
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Supports .txt, .docx, .pdf, and .md files up to 15MB
                    </p>
                  </div>
                </div>
              </div>

              {/* Document List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-slate-700 uppercase tracking-wider px-1">
                  <span>Attached Documents ({documents.length})</span>
                  <span className="text-[11px] font-normal text-slate-400">
                    Accessible to all authorized team members
                  </span>
                </div>

                {documents.length === 0 ? (
                  <div className="p-8 border border-slate-200 rounded-xl text-center text-slate-400 bg-slate-50 text-xs">
                    No documents uploaded yet. Use the upload area above to attach project briefs or specifications.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {documents.map((doc) => (
                      <div
                        key={doc.id}
                        className="bg-white border border-slate-200 hover:border-slate-300 rounded-xl p-3.5 shadow-2xs hover:shadow-xs transition flex flex-col justify-between space-y-3"
                      >
                        <div className="flex items-start gap-3 min-w-0">
                          <div className="p-2 rounded-lg bg-slate-50 border border-slate-100 shrink-0">
                            {getDocIcon(doc.file_extension)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <h5 className="text-xs font-bold text-slate-900 truncate" title={doc.original_name}>
                              {doc.original_name}
                            </h5>
                            <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-1">
                              <span className={`px-1.5 py-0.2 rounded uppercase font-bold text-[9px] border ${getDocBadge(doc.file_extension)}`}>
                                {doc.file_extension}
                              </span>
                              <span>{formatFileSize(doc.file_size)}</span>
                              <span>•</span>
                              <span>{new Date(doc.created_at).toLocaleDateString()}</span>
                            </div>
                            {doc.uploaded_by_name && (
                              <p className="text-[10px] text-slate-400 mt-1">
                                Uploaded by: <span className="text-slate-600 font-medium">{doc.uploaded_by_name}</span>
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center justify-end gap-1.5 pt-2 border-t border-slate-100 text-xs">
                          {/* Preview Button for txt, md, pdf */}
                          <button
                            type="button"
                            onClick={() => handleOpenPreview(doc)}
                            className="px-2.5 py-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md font-semibold text-xs flex items-center gap-1 transition"
                            title="Preview file"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Preview</span>
                          </button>

                          {/* Download Button */}
                          <button
                            type="button"
                            onClick={() => handleDownload(doc)}
                            className="px-2.5 py-1 text-emerald-700 bg-emerald-50 hover:bg-emerald-100/80 border border-emerald-200 rounded-md font-semibold text-xs flex items-center gap-1 transition"
                            title="Download document"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Download</span>
                          </button>

                          {/* Delete Button */}
                          <button
                            type="button"
                            onClick={() => handleDeleteDoc(doc.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition"
                            title="Delete document"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* OVERVIEW TAB */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Strategic Scope & Description */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Description & Strategic Scope
                </h4>
                <p className="text-xs text-slate-700 leading-relaxed">
                  {project.description || 'No detailed strategic description provided for this project.'}
                </p>
              </div>

              {/* Progress Velocity */}
              <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-700 font-bold">Overall Project Velocity</span>
                    <span className="text-[11px] text-slate-400">
                      (Weighted by task priorities)
                    </span>
                  </div>
                  <span className="font-mono text-emerald-700 font-bold text-base">
                    {projectDetails?.weightedProgressPercent ?? project.progressPercent}%
                  </span>
                </div>
                <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-600 rounded-full transition-all duration-300"
                    style={{ width: `${projectDetails?.weightedProgressPercent ?? project.progressPercent}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500">
                  <span>
                    <strong>{projectDetails?.completedTasks ?? project.completedTasks}</strong> completed out of <strong>{projectDetails?.totalTasks ?? project.totalTasks}</strong> total tasks
                  </span>
                  <span>
                    <strong>{projectDetails?.completedMilestones ?? 0}</strong> of <strong>{projectDetails?.assignments?.length ?? project.assignmentCount}</strong> milestones achieved
                  </span>
                </div>
              </div>

              {/* Project Meta Information */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Department</span>
                  <span className="text-xs font-semibold text-slate-800">{project.department_name || 'Enterprise'}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Lead Manager</span>
                    {canReassignProject && (
                      <button
                        onClick={() => setIsReassignModalOpen(true)}
                        className="text-[10px] text-blue-600 font-bold hover:underline"
                        title="Reassign Project to another team lead"
                      >
                        Reassign
                      </button>
                    )}
                  </div>
                  <span className="text-xs font-semibold text-slate-800 truncate block">
                    {projectDetails?.managerName || project.managerName}
                  </span>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Start Date</span>
                  <span className="text-xs font-semibold text-slate-800">{project.start_date || 'N/A'}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Target Completion</span>
                  <span className="text-xs font-semibold text-slate-800">{project.target_date || project.expected_completion_date || 'N/A'}</span>
                </div>
              </div>

              {/* Milestones & Automated Priority Progress Section */}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1 border-b border-slate-200">
                  <div>
                    <div className="flex items-center gap-2">
                      <Flag className="w-4 h-4 text-emerald-600" />
                      <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                        Project Milestones ({projectDetails?.assignments?.length || 0})
                      </h4>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Task priorities directly calibrate stage & progress: Urgent (4x), High (3x), Medium (2x), Low (1x).
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => setIsCreateMilestoneOpen(true)}
                      className="px-2.5 py-1 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-md transition flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Milestone</span>
                    </button>
                    <button
                      onClick={() => {
                        setTaskInitialAssignmentId(undefined);
                        setIsCreateTaskOpen(true);
                      }}
                      className="px-2.5 py-1 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-300 rounded-md transition flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Task</span>
                    </button>
                  </div>
                </div>

                {/* Milestones Cards List */}
                {(!projectDetails?.assignments || projectDetails.assignments.length === 0) ? (
                  <div className="p-6 text-center bg-slate-50 rounded-xl border border-dashed border-slate-300 space-y-2">
                    <Flag className="w-8 h-8 text-slate-400 mx-auto" />
                    <p className="text-xs font-medium text-slate-600">
                      No milestones have been defined for this project yet.
                    </p>
                    <button
                      onClick={() => setIsCreateMilestoneOpen(true)}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition inline-flex items-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Create First Milestone</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {projectDetails.assignments.map((a: any) => {
                      const linkedTasks = (projectDetails.tasks || []).filter((t: any) => t.assignment_id === a.id);
                      const isExpanded = expandedMilestones[a.id] ?? true;

                      const statusBadgeStyles: Record<string, string> = {
                        NOT_STARTED: 'bg-slate-100 text-slate-700 border-slate-200',
                        IN_PROGRESS: 'bg-blue-50 text-blue-700 border-blue-200',
                        IN_REVIEW: 'bg-amber-50 text-amber-700 border-amber-200',
                        COMPLETED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
                        BLOCKED: 'bg-rose-50 text-rose-700 border-rose-200'
                      };

                      return (
                        <div
                          key={a.id}
                          className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-3 hover:border-slate-300 transition"
                        >
                          {/* Milestone Header */}
                          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                            <div className="space-y-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="px-2 py-0.5 rounded bg-emerald-100/80 text-emerald-800 border border-emerald-300 font-mono text-[10px] font-bold">
                                  {a.assignment_code || `MS-${a.id}`}
                                </span>
                                <h5 className="text-sm font-bold text-slate-900 truncate">
                                  {a.title}
                                </h5>
                                <span className={`px-2 py-0.5 rounded border text-[10px] font-bold ${statusBadgeStyles[a.status] || 'bg-slate-100 text-slate-700'}`}>
                                  {a.status?.replace('_', ' ')}
                                </span>
                              </div>
                              {a.description && (
                                <p className="text-xs text-slate-500 line-clamp-2">
                                  {a.description}
                                </p>
                              )}
                            </div>

                            {/* Milestone Actions */}
                            <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-start">
                              <button
                                onClick={() => {
                                  setTaskInitialAssignmentId(a.id);
                                  setIsCreateTaskOpen(true);
                                }}
                                className="px-2 py-1 text-[11px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-md transition flex items-center gap-1"
                                title="Add Task directly to this Milestone"
                              >
                                <Plus className="w-3 h-3" />
                                <span>Task</span>
                              </button>
                              {canReassignProject && (
                                <button
                                  onClick={() => handleDeleteMilestone(a.id, a.title)}
                                  className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition"
                                  title="Delete Milestone"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <button
                                onClick={() => toggleMilestoneExpand(a.id)}
                                className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition"
                              >
                                {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                              </button>
                            </div>
                          </div>

                          {/* Progress Velocity Bar */}
                          <div className="space-y-1.5 bg-slate-50/80 p-2.5 rounded-lg border border-slate-100">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-semibold text-slate-700">
                                Milestone Weighted Progress: <strong className="text-emerald-700">{a.progressPercent ?? 0}%</strong>
                              </span>
                              <span className="text-[11px] text-slate-500">
                                {a.completedTasks || 0} of {a.totalTasks || 0} tasks completed
                              </span>
                            </div>
                            <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-emerald-600 rounded-full transition-all duration-300"
                                style={{ width: `${a.progressPercent ?? 0}%` }}
                              />
                            </div>
                          </div>

                          {/* Linked Tasks List */}
                          {isExpanded && (
                            <div className="pt-2 border-t border-slate-100 space-y-2">
                              <div className="flex items-center justify-between text-[11px] font-bold text-slate-500">
                                <span>Linked Tasks ({linkedTasks.length})</span>
                                <span className="text-[10px] text-slate-400">Click any task to view, edit, or reassign</span>
                              </div>

                              {linkedTasks.length === 0 ? (
                                <p className="text-xs text-slate-400 italic py-1">
                                  No tasks linked to this milestone. Click "+ Task" above to add one.
                                </p>
                              ) : (
                                <div className="space-y-1.5">
                                  {linkedTasks.map((t: any) => {
                                    const priorityBadges: Record<string, string> = {
                                      URGENT: 'bg-rose-50 text-rose-700 border-rose-200',
                                      HIGH: 'bg-amber-50 text-amber-700 border-amber-200',
                                      MEDIUM: 'bg-blue-50 text-blue-700 border-blue-200',
                                      LOW: 'bg-slate-100 text-slate-700 border-slate-200'
                                    };

                                    const priorityWeights: Record<string, number> = {
                                      URGENT: 4,
                                      HIGH: 3,
                                      MEDIUM: 2,
                                      LOW: 1
                                    };

                                    return (
                                      <div
                                        key={t.id}
                                        onClick={() => setSelectedTaskIdForDetail(t.id)}
                                        className="p-2.5 rounded-lg border border-slate-200 bg-white hover:border-blue-400 hover:bg-blue-50/20 cursor-pointer transition flex items-center justify-between text-xs group"
                                      >
                                        <div className="flex items-center gap-2.5 min-w-0">
                                          <span className="font-mono text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                                            {t.task_code}
                                          </span>
                                          <span className="font-semibold text-slate-800 group-hover:text-blue-600 truncate">
                                            {t.title}
                                          </span>
                                          <span className="text-[11px] text-slate-500 hidden sm:inline">
                                            • Assignee: <strong className="text-slate-700">{t.assigneeName || 'Unassigned'}</strong>
                                          </span>
                                        </div>

                                        <div className="flex items-center gap-2 shrink-0">
                                          <span className={`px-1.5 py-0.5 rounded border text-[10px] font-bold ${priorityBadges[t.priority] || ''}`}>
                                            {t.priority} ({priorityWeights[t.priority] || 1}x)
                                          </span>
                                          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-medium capitalize">
                                            {t.status.toLowerCase().replace('_', ' ')}
                                          </span>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Standalone Tasks (Tasks without Milestone) */}
                {projectDetails?.tasks && (
                  (() => {
                    const standaloneTasks = projectDetails.tasks.filter((t: any) => !t.assignment_id);
                    if (standaloneTasks.length === 0) return null;

                    return (
                      <div className="mt-4 pt-4 border-t border-slate-200 space-y-2">
                        <div className="flex items-center justify-between">
                          <h5 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                            Standalone Project Tasks ({standaloneTasks.length})
                          </h5>
                          <span className="text-[11px] text-slate-400">
                            Tasks not linked to a specific milestone
                          </span>
                        </div>
                        <div className="space-y-1.5">
                          {standaloneTasks.map((t: any) => (
                            <div
                              key={t.id}
                              onClick={() => setSelectedTaskIdForDetail(t.id)}
                              className="p-2.5 rounded-lg border border-dashed border-slate-300 bg-slate-50/60 hover:border-blue-400 hover:bg-white cursor-pointer transition flex items-center justify-between text-xs group"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="font-mono text-[10px] font-bold text-slate-500 bg-slate-200/80 px-1.5 py-0.5 rounded">
                                  {t.task_code}
                                </span>
                                <span className="font-semibold text-slate-800 group-hover:text-blue-600 truncate">
                                  {t.title}
                                </span>
                                <span className="text-[11px] text-slate-500 hidden sm:inline">
                                  • {t.assigneeName || 'Unassigned'}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="text-[10px] text-blue-600 hover:underline font-bold">
                                  Attach to Milestone →
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold rounded-lg transition"
          >
            Close
          </button>
        </div>
      </div>
    </Modal>

    {/* REASSIGN PROJECT LEAD MODAL */}
    <Modal
      isOpen={isReassignModalOpen}
      onClose={() => setIsReassignModalOpen(false)}
      maxWidth="max-w-md"
      zIndex="z-60"
    >
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-blue-600" />
                <h3 className="text-sm font-bold text-slate-900">Reassign Project Lead</h3>
              </div>
              <button
                onClick={() => setIsReassignModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleReassignProjectLead} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Designate New Project Lead:
                </label>
                <select
                  value={selectedLeadId}
                  onChange={(e) => setSelectedLeadId(e.target.value ? Number(e.target.value) : '')}
                  required
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Team Member</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.first_name} {emp.last_name} — {emp.job_title || 'Staff'} ({emp.department_name || 'General'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Handover Notes / Reason (Optional):
                </label>
                <textarea
                  value={reassignNotes}
                  onChange={(e) => setReassignNotes(e.target.value)}
                  placeholder="E.g. Reassigned leadership for phase 2 sprint handover..."
                  rows={3}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsReassignModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingReassign || !selectedLeadId}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold disabled:opacity-50 transition"
                >
                  {isSavingReassign ? 'Reassigning...' : 'Confirm Reassignment'}
                </button>
              </div>
            </form>
          </div>
        </Modal>

      {/* CREATE MILESTONE MODAL */}
      {isCreateMilestoneOpen && (
        <AssignmentModal
          isOpen={isCreateMilestoneOpen}
          onClose={() => setIsCreateMilestoneOpen(false)}
          initialProjectId={project.id}
          onSuccess={async () => {
            setIsCreateMilestoneOpen(false);
            await loadProjectData(project.id);
            onUpdate();
          }}
        />
      )}

      {/* CREATE TASK MODAL */}
      {isCreateTaskOpen && (
        <TaskModal
          isOpen={isCreateTaskOpen}
          onClose={() => setIsCreateTaskOpen(false)}
          initialProjectId={project.id}
          initialAssignmentId={taskInitialAssignmentId}
          onSuccess={async () => {
            setIsCreateTaskOpen(false);
            await loadProjectData(project.id);
            onUpdate();
          }}
        />
      )}

      {/* TASK DETAIL MODAL */}
      {selectedTaskIdForDetail && (
        <TaskDetailModal
          taskId={selectedTaskIdForDetail}
          isOpen={Boolean(selectedTaskIdForDetail)}
          onClose={() => setSelectedTaskIdForDetail(null)}
          onTaskUpdated={async () => {
            await loadProjectData(project.id);
            onUpdate();
          }}
        />
      )}

      {/* DOCUMENT PREVIEW MODAL */}
      <Modal
        isOpen={Boolean(previewDoc)}
        onClose={handleClosePreview}
        maxWidth="max-w-4xl"
        zIndex="z-60"
      >
        {previewDoc && (
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full overflow-hidden flex flex-col max-h-[88vh]">
            <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="p-2 rounded-lg bg-white border border-slate-200 shadow-2xs text-slate-700">
                  {getDocIcon(previewDoc.file_extension)}
                </div>
                <div className="min-w-0">
                  <h4 className="text-sm font-bold text-slate-900 truncate">
                    {previewDoc.original_name}
                  </h4>
                  <p className="text-[10px] text-slate-500 font-medium">
                    {previewDoc.file_extension.toUpperCase().replace(/^\./, '')} Document • {formatFileSize(previewDoc.file_size)}
                    {previewDoc.uploaded_by_name && ` • Uploaded by ${previewDoc.uploaded_by_name}`}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {previewContent && (
                  <button
                    onClick={handleCopyText}
                    className="px-2.5 py-1 text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1 transition shadow-2xs cursor-pointer"
                  >
                    {copiedText ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedText ? 'Copied' : 'Copy Text'}</span>
                  </button>
                )}
                {pdfBlobUrl && (
                  <a
                    href={pdfBlobUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2.5 py-1 text-blue-700 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg text-xs font-semibold flex items-center gap-1 transition shadow-2xs"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Fullscreen</span>
                  </a>
                )}
                <button
                  onClick={() => handleDownload(previewDoc)}
                  className="px-2.5 py-1 text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1 transition shadow-2xs cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </button>
                <button
                  onClick={handleClosePreview}
                  className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200/60 transition cursor-pointer"
                  title="Close preview"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-5 overflow-y-auto flex-1 bg-slate-900/5 min-h-[350px]">
              {previewLoading ? (
                <div className="h-72 flex flex-col items-center justify-center text-slate-400 space-y-3">
                  <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs font-medium">Extracting and loading document context...</span>
                </div>
              ) : previewDoc.file_extension.toLowerCase().replace(/^\./, '') === 'pdf' ? (
                <div className="w-full flex flex-col items-center space-y-3">
                  {pdfBlobUrl ? (
                    <div className="w-full h-[580px] rounded-xl overflow-hidden border border-slate-300 bg-white shadow-md">
                      <object
                        data={pdfBlobUrl}
                        type="application/pdf"
                        className="w-full h-full"
                      >
                        <iframe
                          src={pdfBlobUrl}
                          title={previewDoc.original_name}
                          className="w-full h-full border-0"
                        >
                          <div className="p-8 text-center bg-white h-full flex flex-col items-center justify-center space-y-3">
                            <FileText className="w-12 h-12 text-blue-600" />
                            <p className="text-sm font-bold text-slate-800">Inline PDF viewer</p>
                            <a
                              href={pdfBlobUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold"
                            >
                              Open PDF in New Window
                            </a>
                          </div>
                        </iframe>
                      </object>
                    </div>
                  ) : (
                    <div className="p-12 text-center bg-white rounded-xl border border-slate-200 w-full shadow-xs">
                      <FileText className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                      <h5 className="text-sm font-bold text-slate-800">PDF Document Ready</h5>
                      <p className="text-xs text-slate-500 mt-1 mb-4">Click below to open or download the PDF file.</p>
                      <button
                        onClick={() => handleDownload(previewDoc)}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-sm transition"
                      >
                        Download PDF File
                      </button>
                    </div>
                  )}
                </div>
              ) : previewDoc.file_extension.toLowerCase().replace(/^\./, '') === 'docx' ? (
                <div className="space-y-4">
                  {/* DOCX Context Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-blue-50/80 border border-blue-200/80 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div>
                        <h5 className="text-sm font-bold text-slate-900">{previewDoc.original_name}</h5>
                        <p className="text-[11px] text-blue-900">
                          Microsoft Word Document • {formatFileSize(previewDoc.file_size)}
                          {previewContent ? ` • ${previewContent.split('\n\n').length} paragraphs extracted` : ''}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDownload(previewDoc)}
                      className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-xs transition flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download Original DOCX</span>
                    </button>
                  </div>

                  {/* DOCX Text Content Preview */}
                  {previewContent ? (
                    <div className="bg-white p-6 sm:p-8 rounded-xl border border-slate-200 shadow-xs max-h-[520px] overflow-y-auto space-y-3.5 font-sans leading-relaxed">
                      {previewContent.split('\n\n').map((paragraph, idx) => (
                        <p key={idx} className="text-slate-800 text-xs sm:text-sm leading-relaxed">
                          {paragraph}
                        </p>
                      ))}
                    </div>
                  ) : (
                    <div className="p-10 text-center bg-white rounded-xl border border-slate-200 shadow-xs space-y-3">
                      <FileText className="w-12 h-12 text-slate-400 mx-auto" />
                      <h5 className="text-sm font-bold text-slate-800">Word Document Attached</h5>
                      <p className="text-xs text-slate-500 max-w-sm mx-auto">
                        This DOCX file does not contain raw text or is protected. You can download and inspect it in Microsoft Word.
                      </p>
                      <button
                        onClick={() => handleDownload(previewDoc)}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition"
                      >
                        Download DOCX File
                      </button>
                    </div>
                  )}
                </div>
              ) : previewDoc.file_extension.toLowerCase().replace(/^\./, '') === 'md' ? (
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs font-sans text-slate-800 text-xs leading-relaxed space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <div className="text-[11px] font-mono text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded font-semibold border border-indigo-200">
                      Markdown Document Context
                    </div>
                    <span className="text-[11px] text-slate-400 font-mono">
                      {previewContent ? `${previewContent.length} characters` : ''}
                    </span>
                  </div>
                  <pre className="whitespace-pre-wrap font-mono text-slate-800 bg-slate-50 p-4 rounded-lg border border-slate-200 text-xs overflow-x-auto leading-relaxed max-h-[520px]">
                    {previewContent || 'Empty markdown document.'}
                  </pre>
                </div>
              ) : (
                /* Plain text file */
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
                  <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-100">
                    <div className="text-[11px] font-mono text-slate-700 bg-slate-100 px-2 py-0.5 rounded font-semibold border border-slate-200">
                      Text Document Content
                    </div>
                    <span className="text-[11px] text-slate-400 font-mono">
                      {previewContent ? `${previewContent.length} characters` : ''}
                    </span>
                  </div>
                  <pre className="whitespace-pre-wrap font-mono text-slate-800 text-xs leading-relaxed max-h-[520px] overflow-y-auto">
                    {previewContent || 'Empty text document.'}
                  </pre>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </>
  );
};
