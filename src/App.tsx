import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { TimezoneProvider } from './context/TimezoneContext.tsx';
import { Navbar } from './components/Navbar.tsx';
import { Sidebar } from './components/Sidebar.tsx';
import { GlobalSearchModal } from './components/GlobalSearchModal.tsx';
import { DashboardView } from './views/DashboardView.tsx';
import { AttendanceView } from './views/AttendanceView.tsx';
import { TasksView } from './views/TasksView.tsx';
import { AssignmentsView } from './views/AssignmentsView.tsx';
import { ProjectsView } from './views/ProjectsView.tsx';
import { TeamsView } from './views/TeamsView.tsx';
import { ReportsView } from './views/ReportsView.tsx';
import { AuditLogsView } from './views/AuditLogsView.tsx';
import { SettingsView } from './views/SettingsView.tsx';
import { LoginView } from './views/LoginView.tsx';

const MainLayout: React.FC = () => {
  const { user, isLoading } = useAuth();
  const [currentView, setCurrentView] = useState<string>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);

  // Global Ctrl+K / Cmd+K search hotkey
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-300">
        <div className="w-10 h-10 border-3 border-blue-500 border-t-transparent rounded-full animate-spin mb-3" />
        <span className="text-xs font-mono">Initializing McGate Enterprise Core...</span>
      </div>
    );
  }

  if (!user) {
    return <LoginView />;
  }

  const handleNavigate = (view: string) => {
    setCurrentView(view);
    setIsSidebarOpen(false);
  };

  return (
    <div className="min-h-screen w-full max-w-[100vw] bg-slate-100 flex flex-col font-sans antialiased text-slate-800 overflow-x-hidden">
      {/* Top Navigation Bar */}
      <Navbar
        onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
        isSidebarOpen={isSidebarOpen}
        onOpenSearch={() => setIsSearchOpen(true)}
        onNavigate={handleNavigate}
        currentView={currentView}
      />

      {/* Main Workspace Frame */}
      <div className="flex-1 flex overflow-hidden w-full max-w-[100vw] relative">
        {/* Sidebar */}
        <Sidebar
          currentView={currentView}
          onNavigate={handleNavigate}
          isOpen={isSidebarOpen}
          onCloseMobile={() => setIsSidebarOpen(false)}
        />

        {/* Content View Container */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-6 lg:p-8 w-full max-w-full min-w-0">
          <div className="max-w-7xl mx-auto w-full min-w-0">
            {currentView === 'dashboard' && (
              <DashboardView onNavigate={handleNavigate} />
            )}
            {currentView === 'attendance' && <AttendanceView />}
            {currentView === 'tasks' && <TasksView />}
            {currentView === 'assignments' && <AssignmentsView />}
            {currentView === 'projects' && <ProjectsView />}
            {currentView === 'teams' && <TeamsView />}
            {currentView === 'reports' && <ReportsView />}
            {currentView === 'audit-logs' && <AuditLogsView />}
            {currentView === 'settings' && <SettingsView />}
          </div>
        </main>
      </div>

      {/* Global Enterprise Search Modal */}
      <GlobalSearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onNavigate={handleNavigate}
        onSelect={(type, id) => {
          if (type === 'task') handleNavigate('tasks');
          else if (type === 'project') handleNavigate('projects');
          else if (type === 'assignment') handleNavigate('assignments');
          else if (type === 'employee' || type === 'team') handleNavigate('teams');
        }}
      />
    </div>
  );
};

export default function App() {
  return (
    <TimezoneProvider>
      <AuthProvider>
        <MainLayout />
      </AuthProvider>
    </TimezoneProvider>
  );
}
