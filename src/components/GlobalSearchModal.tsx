import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Search, X, CheckSquare, Briefcase, FolderKanban, Users, User, ArrowRight } from 'lucide-react';
import { api } from '../api.ts';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate?: (view: string, id?: number) => void;
  onSelect?: (type: string, id?: number) => void;
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({
  isOpen,
  onClose,
  onNavigate,
  onSelect
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<{
    employees: any[];
    tasks: any[];
    assignments: any[];
    projects: any[];
    teams: any[];
  }>({
    employees: [],
    tasks: [],
    assignments: [],
    projects: [],
    teams: []
  });
  const [isSearching, setIsSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input and reset results when modal opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
      setResults({ employees: [], tasks: [], assignments: [], projects: [], teams: [] });
    }
  }, [isOpen]);

  // Global Escape key handler and body scroll lock
  useEffect(() => {
    if (!isOpen) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  // Debounced search query
  useEffect(() => {
    if (!query.trim() || query.length < 2) {
      setResults({ employees: [], tasks: [], assignments: [], projects: [], teams: [] });
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const data = await api.searchGlobal(query);
        setResults(data);
      } catch (err) {
        console.error('Search failed:', err);
      } finally {
        setIsSearching(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [query]);

  if (!isOpen) return null;

  const handleSelectResult = (view: string, id?: number, type?: string) => {
    onClose();
    if (onNavigate) {
      onNavigate(view, id);
    }
    if (onSelect) {
      onSelect(type || view, id);
    }
  };

  const totalHits =
    results.employees.length +
    results.tasks.length +
    results.assignments.length +
    results.projects.length +
    results.teams.length;

  if (!isOpen || typeof document === 'undefined') return null;

  return createPortal(
    <div
      id="global-search-modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-20 bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto"
    >
      <div
        id="global-search-modal-dialog"
        className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 relative"
      >
        {/* Search Input & Action Bar */}
        <div className="flex items-center px-3.5 py-3 border-b border-slate-100 gap-2 sm:gap-3 bg-white">
          <Search className="w-5 h-5 text-slate-400 shrink-0 ml-1" />
          <input
            ref={inputRef}
            id="global-search-modal-input"
            type="text"
            placeholder="Search tasks, projects, employees, teams, or assignments..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault();
                onClose();
              }
            }}
            className="flex-1 text-slate-800 placeholder-slate-400 bg-transparent outline-none text-sm sm:text-base min-w-0"
          />

          {/* Clear query button if text entered */}
          {query && (
            <button
              id="clear-search-input-btn"
              type="button"
              onClick={() => {
                setQuery('');
                inputRef.current?.focus();
              }}
              className="p-1 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-100 transition shrink-0"
              title="Clear input"
            >
              <X className="w-4 h-4" />
            </button>
          )}

          {/* Explicit Cancel / Close Button - ALWAYS visible on mobile and desktop */}
          <button
            id="close-search-modal-btn"
            type="button"
            onClick={onClose}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/80 border border-slate-200 rounded-lg transition shrink-0 cursor-pointer"
            title="Close search (Esc)"
          >
            <X className="w-3.5 h-3.5 text-slate-500" />
            <span>Cancel</span>
            <kbd className="hidden sm:inline-block ml-0.5 px-1.5 py-0.2 text-[10px] text-slate-400 bg-white rounded border border-slate-200 font-mono">
              ESC
            </kbd>
          </button>
        </div>

        {/* Search Results Container */}
        <div className="max-h-[60vh] overflow-y-auto p-4 space-y-4">
          {isSearching && (
            <div className="py-8 text-center text-sm text-slate-500">
              <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <span>Searching McGate enterprise directory...</span>
            </div>
          )}

          {!isSearching && query.length >= 2 && totalHits === 0 && (
            <div className="py-8 text-center text-slate-500">
              <p className="font-medium text-slate-700">No matching records found</p>
              <p className="text-xs text-slate-400 mt-1">Try searching by name, task code (e.g. TSK-101), or project name.</p>
            </div>
          )}

          {!isSearching && !query && (
            <div className="py-6 px-3 text-center text-slate-400 text-xs">
              <p className="font-medium text-slate-600 mb-1">Quick Enterprise Lookup</p>
              <p>Type to search across tasks, milestone assignments, projects, employees, and departments.</p>
            </div>
          )}

          {/* Tasks */}
          {results.tasks.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                <CheckSquare className="w-3.5 h-3.5 text-blue-600" />
                <span>Tasks ({results.tasks.length})</span>
              </div>
              <div className="space-y-1">
                {results.tasks.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => handleSelectResult('tasks', t.id, 'task')}
                    className="w-full flex items-center justify-between p-2.5 rounded-lg hover:bg-slate-50 transition text-left group cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                        {t.task_code}
                      </span>
                      <div>
                        <div className="text-sm font-medium text-slate-800 group-hover:text-blue-600">
                          {t.title}
                        </div>
                        <div className="text-xs text-slate-500">
                          {t.project_name} • <span className="capitalize">{t.status.toLowerCase().replace('_', ' ')}</span>
                        </div>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-blue-500" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Assignments */}
          {results.assignments.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                <Briefcase className="w-3.5 h-3.5 text-indigo-600" />
                <span>Assignments ({results.assignments.length})</span>
              </div>
              <div className="space-y-1">
                {results.assignments.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => handleSelectResult('assignments', a.id, 'assignment')}
                    className="w-full flex items-center justify-between p-2.5 rounded-lg hover:bg-slate-50 transition text-left group cursor-pointer"
                  >
                    <div>
                      <div className="text-sm font-medium text-slate-800 group-hover:text-indigo-600">
                        {a.title}
                      </div>
                      <div className="text-xs text-slate-500">{a.project_name}</div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-500" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Projects */}
          {results.projects.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                <FolderKanban className="w-3.5 h-3.5 text-emerald-600" />
                <span>Projects ({results.projects.length})</span>
              </div>
              <div className="space-y-1">
                {results.projects.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleSelectResult('projects', p.id, 'project')}
                    className="w-full flex items-center justify-between p-2.5 rounded-lg hover:bg-slate-50 transition text-left group cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        {p.code}
                      </span>
                      <div>
                        <div className="text-sm font-medium text-slate-800 group-hover:text-emerald-600">
                          {p.name}
                        </div>
                        <div className="text-xs text-slate-500">Status: {p.status}</div>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-emerald-500" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Employees */}
          {results.employees.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                <User className="w-3.5 h-3.5 text-amber-600" />
                <span>Employees ({results.employees.length})</span>
              </div>
              <div className="space-y-1">
                {results.employees.map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => handleSelectResult('teams', undefined, 'employee')}
                    className="w-full flex items-center justify-between p-2.5 rounded-lg hover:bg-slate-50 transition text-left group cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center font-bold text-xs text-slate-700">
                        {e.first_name[0]}{e.last_name[0]}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-slate-800 group-hover:text-amber-600">
                          {e.first_name} {e.last_name}
                        </div>
                        <div className="text-xs text-slate-500">
                          {e.job_title} • {e.department_name || 'General'}
                        </div>
                      </div>
                    </div>
                    <span className="text-xs font-mono text-slate-400">{e.employee_code}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Teams */}
          {results.teams.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                <Users className="w-3.5 h-3.5 text-purple-600" />
                <span>Teams ({results.teams.length})</span>
              </div>
              <div className="space-y-1">
                {results.teams.map((tm) => (
                  <button
                    key={tm.id}
                    type="button"
                    onClick={() => handleSelectResult('teams', undefined, 'team')}
                    className="w-full flex items-center justify-between p-2.5 rounded-lg hover:bg-slate-50 transition text-left group cursor-pointer"
                  >
                    <div>
                      <div className="text-sm font-medium text-slate-800 group-hover:text-purple-600">
                        {tm.name}
                      </div>
                      <div className="text-xs text-slate-500">Department: {tm.department_name}</div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-purple-500" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer with Clear & Cancel Actions */}
        <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-100 text-xs text-slate-400 flex items-center justify-between">
          <span className="text-[11px] text-slate-500">Enterprise Search with RBAC authorization</span>
          <button
            id="footer-close-search-btn"
            type="button"
            onClick={onClose}
            className="text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 px-2 py-1 rounded transition flex items-center gap-1 cursor-pointer"
          >
            <X className="w-3 h-3 text-slate-500" />
            <span>Close (Esc)</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
