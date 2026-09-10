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
  Server
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
  const role = user?.role || 'EMPLOYEE';

  const isSuperAdmin = role === 'SUPER_ADMIN';
  const isAdmin = role === 'SUPER_ADMIN' || role === 'ADMIN';
  const isManager = isAdmin || role === 'MANAGER';

  const menuItems = [
    {
      id: 'dashboard',
      label: 'Executive Dashboard',
      icon: LayoutDashboard,
      allowed: true
    },
    {
      id: 'attendance',
      label: 'Attendance & Clock-In',
      icon: Clock,
      badge: user?.todayAttendance ? undefined : 'Required',
      allowed: true
    },
    {
      id: 'tasks',
      label: 'Tasks & Kanban',
      icon: CheckSquare,
      allowed: true
    },
    {
      id: 'assignments',
      label: 'Assignments Hub',
      icon: Briefcase,
      allowed: true
    },
    {
      id: 'projects',
      label: 'Projects Portfolio',
      icon: FolderKanban,
      allowed: true
    },
    {
      id: 'teams',
      label: 'Departments & Teams',
      icon: Users2,
      allowed: true
    },
    {
      id: 'reports',
      label: 'Productivity Reports',
      icon: BarChart3,
      allowed: isManager
    },
    {
      id: 'audit-logs',
      label: 'Immutable Audit Trail',
      icon: ShieldAlert,
      allowed: isAdmin
    },
    {
      id: 'settings',
      label: 'Enterprise Settings',
      icon: Settings,
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
          className="fixed inset-0 bg-slate-900/60 z-30 lg:hidden backdrop-blur-xs"
        />
      )}

      <aside
        className={`fixed lg:static top-16 bottom-0 left-0 w-64 bg-slate-900 text-slate-300 z-30 flex flex-col justify-between border-r border-slate-800 transition-transform duration-200 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Navigation list */}
        <div className="p-4 space-y-6 overflow-y-auto">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 px-3 mb-2">
              Workforce Core
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
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-semibold transition ${
                        isActive
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/80'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                        <span>{item.label}</span>
                      </div>
                      {item.badge && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
            </nav>
          </div>

          {/* Role Access Scope Info */}
          <div className="px-3 py-2.5 rounded-lg bg-slate-800/60 border border-slate-800 text-xs">
            <div className="flex items-center gap-2 text-slate-300 font-semibold mb-1">
              <ShieldCheck className="w-4 h-4 text-blue-400" />
              <span>Security Scope</span>
            </div>
            <p className="text-[11px] text-slate-400">
              Operating with <span className="text-white font-medium">{role}</span> privileges. All actions are logged to immutable audit records.
            </p>
          </div>
        </div>

        {/* Server Status Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/50">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Frankfurt Cluster
            </span>
            <span className="font-mono text-[10px] text-slate-500">v2.4.0-ent</span>
          </div>
          <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
            <Server className="w-3 h-3 text-slate-400" />
            <span>SQLite WAL • Persistent Store</span>
          </div>
        </div>
      </aside>
    </>
  );
};
