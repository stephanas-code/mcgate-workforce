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
  ExternalLink
} from 'lucide-react';
import { api } from '../api.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { ProjectItem, ProjectDocument } from '../types.ts';
import { formatFileSize } from '../utils/projectCode.ts';

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
  const [activeTab, setActiveTab] = useState<'overview' | 'documents'>('documents');
  const [projectDetails, setProjectDetails] = useState<any>(null);
  const [documents, setDocuments] = useState<ProjectDocument[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);

  // Document preview state
  const [previewDoc, setPreviewDoc] = useState<ProjectDocument | null>(null);
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [copiedText, setCopiedText] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Load project details and documents
  const loadProjectData = async (projectId: number) => {
    setIsLoading(true);
    try {
      const data = await api.getProjectById(projectId);
      setProjectDetails(data);
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
    }
  }, [isOpen, project]);

  if (!isOpen || !project) return null;

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

  // Open Preview for document
  const handleOpenPreview = async (doc: ProjectDocument) => {
    setPreviewDoc(doc);
    setPreviewLoading(true);
    setCopiedText(false);

    try {
      // Fetch full document with file_data
      const fullDoc = await api.getProjectDocumentById(project.id, doc.id);
      setPreviewDoc(fullDoc);

      if (fullDoc.file_extension === 'txt' || fullDoc.file_extension === 'md') {
        // Decode base64 or raw text
        let rawContent = fullDoc.file_data || '';
        if (rawContent.startsWith('data:')) {
          const base64Part = rawContent.split(',')[1];
          try {
            rawContent = decodeURIComponent(escape(window.atob(base64Part)));
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
    <div
      id="project-details-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto"
    >
      <div
        id="project-details-container"
        className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-4xl my-6 overflow-hidden animate-in fade-in zoom-in-95 flex flex-col max-h-[90vh]"
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
            <div className="space-y-5">
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
                  <span className="text-slate-600">Completion Velocity</span>
                  <span className="font-mono text-emerald-700 font-bold text-sm">
                    {project.progressPercent}%
                  </span>
                </div>
                <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-600 rounded-full transition-all duration-300"
                    style={{ width: `${project.progressPercent}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span>{project.completedTasks} completed out of {project.totalTasks} total tasks</span>
                  <span>{project.assignmentCount} milestone assignments</span>
                </div>
              </div>

              {/* Project Meta Information */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Department</span>
                  <span className="text-xs font-semibold text-slate-800">{project.department_name || 'Enterprise'}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Lead Manager</span>
                  <span className="text-xs font-semibold text-slate-800">{project.managerName}</span>
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

              {/* Linked Milestone Assignments */}
              {projectDetails?.assignments && projectDetails.assignments.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Milestone Assignments ({projectDetails.assignments.length})
                  </h4>
                  <div className="space-y-2">
                    {projectDetails.assignments.map((a: any) => (
                      <div key={a.id} className="p-3 rounded-lg border border-slate-200 bg-white flex items-center justify-between text-xs">
                        <div>
                          <p className="font-bold text-slate-900">{a.title}</p>
                          <p className="text-[11px] text-slate-500 line-clamp-1">{a.description}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-[10px]">
                            {a.priority}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-semibold text-[10px]">
                            {a.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
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

      {/* DOCUMENT PREVIEW MODAL */}
      {previewDoc && (
        <div
          id="document-preview-backdrop"
          className="fixed inset-0 z-60 flex items-center justify-center bg-slate-950/75 backdrop-blur-sm p-4"
        >
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95">
            <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="p-1.5 rounded bg-white border border-slate-200 shadow-2xs">
                  {getDocIcon(previewDoc.file_extension)}
                </div>
                <div className="min-w-0">
                  <h4 className="text-sm font-bold text-slate-900 truncate">
                    {previewDoc.original_name}
                  </h4>
                  <p className="text-[10px] text-slate-500">
                    {previewDoc.file_extension.toUpperCase()} Document • {formatFileSize(previewDoc.file_size)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {previewContent && (
                  <button
                    onClick={handleCopyText}
                    className="px-2.5 py-1 text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-md text-xs font-semibold flex items-center gap-1 transition shadow-2xs"
                  >
                    {copiedText ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedText ? 'Copied' : 'Copy Text'}</span>
                  </button>
                )}
                <button
                  onClick={() => handleDownload(previewDoc)}
                  className="px-2.5 py-1 text-emerald-700 hover:text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-md text-xs font-semibold flex items-center gap-1 transition shadow-2xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </button>
                <button
                  onClick={() => setPreviewDoc(null)}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-slate-200/60 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-5 overflow-y-auto flex-1 bg-slate-900/5 min-h-[300px]">
              {previewLoading ? (
                <div className="h-64 flex flex-col items-center justify-center text-slate-400">
                  <div className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mb-2" />
                  <span className="text-xs">Loading document preview...</span>
                </div>
              ) : previewDoc.file_extension.toLowerCase() === 'pdf' ? (
                <div className="w-full h-[500px] rounded-lg overflow-hidden border border-slate-300 bg-white shadow-inner">
                  {previewDoc.file_data ? (
                    <iframe
                      src={previewDoc.file_data}
                      title={previewDoc.original_name}
                      className="w-full h-full border-0"
                    />
                  ) : (
                    <div className="p-12 text-center text-slate-500">PDF preview unavailable.</div>
                  )}
                </div>
              ) : previewDoc.file_extension.toLowerCase() === 'docx' ? (
                <div className="p-10 text-center bg-white rounded-xl border border-slate-200 shadow-xs space-y-4 max-w-md mx-auto my-6">
                  <div className="w-14 h-14 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center mx-auto shadow-inner">
                    <FileText className="w-8 h-8" />
                  </div>
                  <div>
                    <h5 className="text-base font-bold text-slate-900">{previewDoc.original_name}</h5>
                    <p className="text-xs text-slate-500 mt-1">
                      Microsoft Word Document ({formatFileSize(previewDoc.file_size)})
                    </p>
                  </div>
                  <button
                    onClick={() => handleDownload(previewDoc)}
                    className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-sm transition flex items-center justify-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download to View in Microsoft Word</span>
                  </button>
                </div>
              ) : previewDoc.file_extension.toLowerCase() === 'md' ? (
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs font-sans text-slate-800 text-xs leading-relaxed space-y-3">
                  <div className="text-[11px] font-mono text-purple-700 bg-purple-50 px-2 py-1 rounded inline-block font-semibold border border-purple-200 mb-2">
                    Markdown Rendered View
                  </div>
                  <pre className="whitespace-pre-wrap font-mono text-slate-800 bg-slate-50 p-4 rounded-lg border border-slate-200 text-xs overflow-x-auto">
                    {previewContent}
                  </pre>
                </div>
              ) : (
                /* Plain text file */
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
                  <pre className="whitespace-pre-wrap font-mono text-slate-800 text-xs leading-relaxed">
                    {previewContent}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
