import React from 'react';
import {
  LayoutDashboard,
  Clock,
  CheckSquare,
  Briefcase,
  FolderKanban,
  Users2,
  BarChart3,
  ShieldAlert,
  Settings,
  ShieldCheck,
  Server,
  Sparkles,
  X
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';

interface SidebarProps {
  currentView: string;
  onNavigate: (view: string) => void;
  isOpen: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentView, onNavigate, isOpen, onCloseMobile }) => {
  const { user } = useAuth();
  const role = user?.role || 'SUPER_ADMIN';

  const isSuperAdmin = role === 'SUPER_ADMIN';
  const isAdmin = role === 'SUPER_ADMIN' || role === 'ADMIN';
  const isManager = isAdmin || role === 'MANAGER';

  const menuItems = [
    {
      id: 'dashboard',
      label: 'Executive Dashboard',
      icon: LayoutDashboard,
      color: 'text-indigo-600',
      activeGradient: 'from-indigo-600 to-purple-600',
      allowed: true
    },
    {
      id: 'attendance',
      label: 'Attendance & Clock-In',
      icon: Clock,
      color: 'text-emerald-600',
      activeGradient: 'from-emerald-600 to-teal-600',
      badge: user?.todayAttendance ? undefined : 'Live',
      badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      allowed: true
    },
    {
      id: 'tasks',
      label: 'Tasks & Kanban',
      icon: CheckSquare,
      color: 'text-violet-600',
      activeGradient: 'from-violet-600 to-indigo-600',
      allowed: true
    },
    {
      id: 'assignments',
      label: 'Assignments Hub',
      icon: Briefcase,
      color: 'text-blue-600',
      activeGradient: 'from-blue-600 to-indigo-600',
      allowed: true
    },
    {
      id: 'projects',
      label: 'Projects Portfolio',
      icon: FolderKanban,
      color: 'text-amber-600',
      activeGradient: 'from-amber-500 to-rose-500',
      allowed: true
    },
    {
      id: 'teams',
      label: 'Departments & Teams',
      icon: Users2,
      color: 'text-pink-600',
      activeGradient: 'from-pink-600 to-rose-600',
      allowed: true
    },
    {
      id: 'reports',
      label: 'Productivity Reports',
      icon: BarChart3,
      color: 'text-teal-600',
      activeGradient: 'from-teal-600 to-emerald-600',
      allowed: isManager
    },
    {
      id: 'audit-logs',
      label: 'Immutable Audit Trail',
      icon: ShieldAlert,
      color: 'text-rose-600',
      activeGradient: 'from-rose-600 to-pink-600',
      allowed: isAdmin
    },
    {
      id: 'settings',
      label: 'Enterprise Settings',
      icon: Settings,
      color: 'text-purple-600',
      activeGradient: 'from-purple-600 to-indigo-600',
      allowed: isSuperAdmin
    }
  ];

  const handleItemClick = (id: string) => {
    onNavigate(id);
    onCloseMobile();
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 bg-slate-900/50 z-35 lg:hidden backdrop-blur-sm transition-opacity"
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed lg:static top-16 bottom-0 left-0 w-64 bg-white/95 text-slate-700 z-40 flex flex-col justify-between border-r border-indigo-100/90 transition-transform duration-200 ease-in-out shadow-xl lg:shadow-none ${
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Navigation list */}
        <div className="p-4 space-y-5 overflow-y-auto">
          {/* Mobile Close Bar */}
          <div className="lg:hidden flex items-center justify-between pb-3 border-b border-indigo-100">
            <div className="flex items-center gap-2 text-indigo-700 font-bold text-xs">
              <Sparkles className="w-4 h-4 text-indigo-600" />
              <span>NAVIGATION MENU</span>
            </div>
            <button
              onClick={onCloseMobile}
              className="p-1.5 text-slate-500 hover:text-indigo-700 rounded-lg hover:bg-indigo-50 transition cursor-pointer"
              aria-label="Close navigation"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-3 mb-2 font-display">
              Workforce Operations
            </div>
            <nav className="space-y-1">
              {menuItems
                .filter((item) => item.allowed)
                .map((item) => {
                  const Icon = item.icon;
                  const isActive = currentView === item.id;

                  return (
                    <button
                      key={item.id}
                      onClick={() => handleItemClick(item.id)}
                      className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        isActive
                          ? `bg-gradient-to-r ${item.activeGradient} text-white shadow-md shadow-indigo-500/20 translate-x-0.5`
                          : 'text-slate-600 hover:text-indigo-700 hover:bg-indigo-50/70 hover:translate-x-0.5'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`p-1 rounded-lg ${
                            isActive ? 'bg-white/20 text-white' : item.color
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                        </div>
                        <span>{item.label}</span>
                      </div>
                      {item.badge && (
                        <span
                          className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${
                            isActive
                              ? 'bg-white/25 text-white border-white/30'
                              : item.badgeColor || 'bg-indigo-100 text-indigo-700 border-indigo-200'
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
            </nav>
          </div>

          {/* Security & Access Scope Banner */}
          <div className="p-3.5 rounded-2xl bg-gradient-to-br from-indigo-50/80 via-purple-50/50 to-pink-50/40 border border-indigo-100 text-xs shadow-2xs">
            <div className="flex items-center gap-2 text-indigo-900 font-bold mb-1">
              <ShieldCheck className="w-4 h-4 text-indigo-600" />
              <span>Full Access Scope</span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Operating with <span className="font-bold text-indigo-700">{role}</span> credentials. All operational activities are recorded to the tamper-proof ledger.
            </p>
          </div>
        </div>

        {/* Server Status Footer */}
        <div className="p-3.5 border-t border-indigo-100/80 bg-slate-50/80">
          <div className="flex items-center justify-between text-xs text-slate-600 mb-1">
            <span className="flex items-center gap-1.5 font-semibold text-slate-700">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-xs shadow-emerald-500" />
              Central Cloud Node
            </span>
            <span className="font-mono text-[10px] text-indigo-600 font-bold px-1.5 py-0.5 bg-indigo-50 border border-indigo-100 rounded">
              v2.5.0-ent
            </span>
          </div>
          <div className="text-[11px] text-slate-400 flex items-center gap-1.5 font-medium">
            <Server className="w-3 h-3 text-indigo-500" />
            <span>SQLite WAL • Fast Relational DB</span>
          </div>
        </div>
      </aside>
    </>
  );
};
