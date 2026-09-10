import React, { useState, useEffect } from 'react';
import {
  FolderKanban,
  Plus,
  Layers,
  Calendar,
  User,
  CheckCircle2,
  Clock,
  Briefcase,
  FileText,
  Search,
  X,
  ArrowRight,
  UploadCloud,
  Sparkles
} from 'lucide-react';
import { api } from '../api.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { ProjectItem } from '../types.ts';
import { ProjectModal } from '../components/ProjectModal.tsx';
import { ProjectDetailsModal } from '../components/ProjectDetailsModal.tsx';

export const ProjectsView: React.FC = () => {
  const { user } = useAuth();
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [filteredProjects, setFilteredProjects] = useState<ProjectItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<ProjectItem | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const loadProjects = async () => {
    setIsLoading(true);
    try {
      const list = await api.getProjects();
      setProjects(list);
      setFilteredProjects(list);
      // If a project is currently open in details, refresh its reference
      if (selectedProject) {
        const updated = list.find((p: ProjectItem) => p.id === selectedProject.id);
        if (updated) setSelectedProject(updated);
      }
    } catch (err) {
      console.error('Failed to load projects:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadProjects();
  }, []);

  // Filter projects by query and status
  useEffect(() => {
    let result = [...projects];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.code.toLowerCase().includes(q) ||
          (p.department_name && p.department_name.toLowerCase().includes(q)) ||
          (p.managerName && p.managerName.toLowerCase().includes(q))
      );
    }
    if (statusFilter !== 'ALL') {
      result = result.filter((p) => p.status === statusFilter);
    }
    setFilteredProjects(result);
  }, [searchQuery, statusFilter, projects]);

  const handleOpenDetails = (p: ProjectItem) => {
    setSelectedProject(p);
    setIsDetailsModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Projects Portfolio
            </h1>
            <span className="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-emerald-100 text-emerald-800">
              {projects.length} Initiatives
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Enterprise initiatives, milestone deliverables, project codes, and teammate document uploads (.txt, .docx, .pdf, .md).
          </p>
        </div>

        {/* All teammates can initiate projects and upload documents */}
        <button
          id="open-initiate-project-btn"
          onClick={() => setIsCreateModalOpen(true)}
          className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-sm transition flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Initiate Project</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            id="search-projects-input"
            type="text"
            placeholder="Search projects by code, title, department, or lead manager..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-8 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
          />
          {searchQuery && (
            <button
              id="clear-projects-search-btn"
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1.5 p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition"
              title="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-xs font-medium text-slate-500 whitespace-nowrap">Status:</span>
          <select
            id="filter-status-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-700 focus:ring-2 focus:ring-emerald-500 outline-none bg-white font-medium w-full sm:w-auto"
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="PLANNING">PLANNING</option>
            <option value="ON_HOLD">ON HOLD</option>
            <option value="COMPLETED">COMPLETED</option>
          </select>
        </div>
      </div>

      {/* Grid of Projects */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {isLoading ? (
          <div className="col-span-full p-12 bg-white rounded-xl border border-slate-200 text-center text-slate-400">
            <div className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <span className="text-xs">Loading projects portfolio...</span>
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="col-span-full p-12 bg-white rounded-xl border border-slate-200 text-center text-slate-400">
            {searchQuery || statusFilter !== 'ALL'
              ? 'No projects match your filter criteria.'
              : 'No projects registered. Click "Initiate Project" to add one.'}
          </div>
        ) : (
          filteredProjects.map((p) => (
            <div
              key={p.id}
              id={`project-card-${p.id}`}
              className="bg-white rounded-xl border border-slate-200 shadow-2xs hover:border-emerald-300 hover:shadow-md transition p-5 flex flex-col justify-between space-y-4 cursor-pointer group"
              onClick={() => handleOpenDetails(p)}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-xs font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 group-hover:bg-emerald-100/70 transition">
                    {p.code}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {/* Document count badge */}
                    <span
                      className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md border ${
                        (p.documentsCount || 0) > 0
                          ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                          : 'bg-slate-50 text-slate-400 border-slate-200'
                      }`}
                      title={`${p.documentsCount || 0} document(s) uploaded`}
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>{p.documentsCount || 0} doc{(p.documentsCount || 0) === 1 ? '' : 's'}</span>
                    </span>

                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                      {p.status}
                    </span>
                  </div>
                </div>

                <h3 className="text-base font-bold text-slate-900 group-hover:text-emerald-700 transition">
                  {p.name}
                </h3>
                <p className="text-xs text-slate-500 mt-1 line-clamp-2">{p.description}</p>
              </div>

              {/* Progress */}
              <div className="space-y-1.5 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-slate-600">Completion Velocity</span>
                  <span className="font-mono text-emerald-700 font-bold">{p.progressPercent}%</span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-600 rounded-full transition-all duration-300"
                    style={{ width: `${p.progressPercent}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span>{p.completedTasks} of {p.totalTasks} tasks done</span>
                  <span>{p.totalAssignments || p.assignmentCount || 0} milestones</span>
                </div>
              </div>

              {/* Metadata */}
              <div className="p-3 bg-slate-50 rounded-lg text-xs space-y-1 text-slate-600">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Sponsor:</span>
                  <span className="font-medium text-slate-800">{p.department_name || 'Enterprise'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Lead Manager:</span>
                  <span className="font-medium text-slate-800">{p.managerName}</span>
                </div>
                {p.target_date && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Target Date:</span>
                    <span className="font-medium text-slate-800">{p.target_date}</span>
                  </div>
                )}
              </div>

              {/* Action Bar */}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-[11px] text-slate-400 flex items-center gap-1 font-medium">
                  <UploadCloud className="w-3.5 h-3.5 text-slate-400" />
                  <span>Upload & View Docs</span>
                </span>
                <span className="text-emerald-700 font-bold flex items-center gap-1 text-xs group-hover:translate-x-0.5 transition-transform">
                  <span>Open Details</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* New Project Creation Modal with Auto-Code & Documents Upload */}
      <ProjectModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={loadProjects}
      />

      {/* Project Details & Documents Modal */}
      <ProjectDetailsModal
        project={selectedProject}
        isOpen={isDetailsModalOpen}
        onClose={() => {
          setIsDetailsModalOpen(false);
          setSelectedProject(null);
        }}
        onUpdate={loadProjects}
      />
    </div>
  );
};
