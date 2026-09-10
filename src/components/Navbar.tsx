import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  Bell,
  CheckCircle2,
  Clock,
  LogOut,
  ChevronDown,
  ShieldCheck,
  UserCheck,
  Building2,
  Menu,
  X,
  Globe,
  KeyRound,
  Camera,
  User
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { useTimezone } from '../context/TimezoneContext.tsx';
import { api } from '../api.ts';
import { NotificationItem } from '../types.ts';
import { TimezoneSelectorModal } from './TimezoneSelectorModal.tsx';
import { UserProfileModal } from './UserProfileModal.tsx';

interface NavbarProps {
  onOpenSearch: () => void;
  onNavigate: (view: string) => void;
  currentView?: string;
  onToggleSidebar?: () => void;
  isSidebarOpen?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenSearch,
  onNavigate,
  onToggleSidebar,
  isSidebarOpen = false
}) => {
  const { user, todayAttendance, logout } = useAuth();
  const { timezone, locationName, formatTime, details } = useTimezone();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isTimezoneModalOpen, setIsTimezoneModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [profileModalTab, setProfileModalTab] = useState<'profile' | 'password'>('profile');

  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  // Poll or load notifications
  const loadNotifications = async () => {
    try {
      const data = await api.getNotifications();
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
  }, [user]);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setIsNotifOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setIsProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMarkAsRead = async (id: number) => {
    try {
      await api.markNotificationRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: 1 } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error(err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.markAllNotificationsRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
      setUnreadCount(0);
    } catch (err) {
      console.error(err);
    }
  };

  const isClockedIn = Boolean(todayAttendance?.clock_in_time);
  const clockInFormatted = todayAttendance?.clock_in_time
    ? formatTime(todayAttendance.clock_in_time, { hour: '2-digit', minute: '2-digit', second: undefined })
    : null;

  return (
    <>
      <header className="h-16 bg-white/95 backdrop-blur-md border-b border-indigo-100/90 px-3 sm:px-6 flex items-center justify-between sticky top-0 z-30 shadow-xs w-full max-w-full">
      {/* Brand & Platform Identity */}
      <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
        {/* Mobile Hamburger Toggle Button */}
        {onToggleSidebar && (
          <button
            id="mobile-sidebar-hamburger"
            type="button"
            onClick={onToggleSidebar}
            className="lg:hidden p-2 -ml-1 text-slate-700 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition shrink-0 cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            aria-label={isSidebarOpen ? "Close navigation menu" : "Open navigation menu"}
            title="Toggle Navigation Menu"
          >
            {isSidebarOpen ? (
              <X className="w-5 h-5 text-slate-800" />
            ) : (
              <Menu className="w-5 h-5 text-slate-800" />
            )}
          </button>
        )}

        <div className="w-9 h-9 sm:w-10 sm:h-10 bg-slate-900 rounded-xl flex items-center justify-center shadow-md shadow-slate-900/20 shrink-0 border border-slate-700/50 p-2">
          <svg viewBox="0 0 48 48" fill="none" className="w-full h-full">
            <defs>
              <linearGradient id="nav-m-grad" x1="0" x2="1" y1="0" y2="1">
                <stop offset="0" stopColor="#38BDF8" />
                <stop offset="1" stopColor="#2563EB" />
              </linearGradient>
            </defs>
            <path d="M4 0 L16 0 L24 24 L32 0 L44 0 L44 48 L32 48 L32 16 L24 40 L16 16 L16 48 L4 48 Z" fill="url(#nav-m-grad)" />
          </svg>
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <span className="font-bold text-slate-900 text-sm sm:text-base tracking-tight truncate">
              <span className="hidden sm:inline">McGate Technologies</span>
              <span className="sm:hidden">McGate</span>
            </span>
            <span className="inline-flex items-center text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200/80 shrink-0">
              Enterprise
            </span>
          </div>
          <div className="text-[11px] text-slate-500 hidden sm:block truncate font-medium">
            Workforce, Projects & Attendance Hub
          </div>
        </div>
      </div>

      {/* Center Search Bar */}
      <div className="hidden lg:flex items-center flex-1 max-w-md mx-6">
        <button
          onClick={onOpenSearch}
          className="w-full flex items-center justify-between px-3.5 py-2 text-xs font-medium text-slate-400 bg-slate-50/80 hover:bg-white hover:text-slate-600 border border-slate-200/80 hover:border-indigo-200 rounded-xl transition cursor-pointer shadow-xs focus:ring-2 focus:ring-indigo-500"
        >
          <div className="flex items-center gap-2.5">
            <Search className="w-4 h-4 text-indigo-500" />
            <span>Search directory, tasks, projects, milestones...</span>
          </div>
          <kbd className="text-[10px] font-mono px-1.5 py-0.5 bg-white border border-slate-200 rounded-md text-slate-500 font-semibold shadow-2xs">
            ⌘K
          </kbd>
        </button>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
        {/* Mobile Search Icon */}
        <button
          id="mobile-search-trigger"
          onClick={onOpenSearch}
          className="lg:hidden p-2 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition shrink-0 cursor-pointer"
          title="Search"
          aria-label="Search"
        >
          <Search className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>

        {/* Real-Time Attendance Status Indicator */}
        <button
          id="navbar-attendance-btn"
          onClick={() => onNavigate('attendance')}
          className={`flex items-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 rounded-full text-[11px] sm:text-xs font-bold border transition shrink-0 cursor-pointer shadow-xs ${
            isClockedIn
              ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100 hover:border-emerald-400'
              : 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100 hover:border-amber-400'
          }`}
          title="Click to view Attendance Hub"
        >
          <span className="relative flex h-2 w-2 shrink-0">
            <span
              className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                isClockedIn ? 'bg-emerald-400' : 'bg-amber-400'
              }`}
            />
            <span
              className={`relative inline-flex rounded-full h-2 w-2 ${
                isClockedIn ? 'bg-emerald-600' : 'bg-amber-600'
              }`}
            />
          </span>
          <span className="hidden md:inline">
            {isClockedIn ? `Clocked In • ${clockInFormatted}` : 'Clock-In Required'}
          </span>
          <span className="md:hidden hidden xs:inline">
            {isClockedIn ? 'Clocked In' : 'Clock In'}
          </span>
          <span className="xs:hidden">
            {isClockedIn ? 'In' : 'Clock'}
          </span>
        </button>

        {/* Global Local Time & Timezone Switcher Pill */}
        <button
          id="navbar-timezone-btn"
          type="button"
          onClick={() => setIsTimezoneModalOpen(true)}
          className="flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-xl border border-indigo-100 bg-indigo-50/50 hover:bg-indigo-50 text-xs font-semibold text-slate-700 transition cursor-pointer shrink-0"
          title={`Active Timezone: ${locationName} (${timezone}) • Click to change timezone`}
        >
          <Globe className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-600 shrink-0" />
          <span className="font-mono text-slate-900 hidden sm:inline font-bold">{details.currentTime}</span>
          <span className="text-[11px] text-slate-500 hidden md:inline">({details.abbreviation || details.city})</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-indigo-100 text-indigo-800 font-bold hidden lg:inline">
            {details.offset}
          </span>
        </button>

        {/* Super Admin Verified Status Badge */}
        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-indigo-50 border border-indigo-200/80 text-[11px] font-bold text-indigo-900 shadow-2xs">
          <ShieldCheck className="w-4 h-4 text-indigo-600 shrink-0" />
          <span>Super Admin</span>
        </div>

        {/* Notifications Popover */}
        <div className="relative shrink-0" ref={notifRef}>
          <button
            id="navbar-notif-btn"
            onClick={() => setIsNotifOpen(!isNotifOpen)}
            className="p-2 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl relative transition cursor-pointer"
            title="Notifications"
            aria-label="Notifications"
          >
            <Bell className="w-4 h-4 sm:w-5 sm:h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-rose-500 text-white rounded-full text-[10px] font-bold flex items-center justify-center border-2 border-white shadow-xs">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {isNotifOpen && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 max-w-[calc(100vw-1.5rem)] bg-white rounded-2xl shadow-2xl border border-indigo-100 z-50 overflow-hidden animate-in fade-in zoom-in-95">
              <div className="p-3.5 bg-gradient-to-r from-indigo-50 to-purple-50 border-b border-indigo-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-indigo-900">Notifications</span>
                  {unreadCount > 0 && (
                    <span className="text-[10px] font-bold bg-indigo-600 text-white px-2 py-0.5 rounded-full">
                      {unreadCount} new
                    </span>
                  )}
                </div>
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition cursor-pointer"
                  >
                    Mark all read
                  </button>
                )}
              </div>

              <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                {notifications.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400 font-medium">
                    No new notifications
                  </div>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      onClick={() => {
                        handleMarkAsRead(n.id);
                        if (n.link) onNavigate(n.link.replace('/', ''));
                        setIsNotifOpen(false);
                      }}
                      className={`p-3.5 text-left transition cursor-pointer hover:bg-indigo-50/40 ${
                        !n.is_read ? 'bg-indigo-50/20' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="font-bold text-xs text-slate-900">
                          {n.title}
                        </div>
                        {!n.is_read && (
                          <span className="w-2 h-2 rounded-full bg-indigo-600 shrink-0 mt-1" />
                        )}
                      </div>
                      <p className="text-xs text-slate-600 mt-0.5 line-clamp-2">{n.message}</p>
                      <div className="text-[10px] text-slate-400 mt-1.5 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-indigo-400" />
                        {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} •{' '}
                        {new Date(n.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* User Profile Dropdown with Avatar */}
        <div className="relative" ref={profileRef}>
          <button
            onClick={() => setIsProfileOpen(!isProfileOpen)}
            className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-indigo-50/60 border border-transparent hover:border-indigo-100 transition cursor-pointer"
            aria-label="User profile menu"
          >
            {user?.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user.fullName || 'User'}
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl object-cover ring-2 ring-indigo-500/30 shadow-xs"
              />
            ) : (
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white font-bold text-xs flex items-center justify-center shadow-xs ring-2 ring-indigo-500/20">
                {user?.firstName ? `${user.firstName[0]}${user.lastName?.[0] || ''}` : 'SA'}
              </div>
            )}
            <div className="text-left hidden xl:block">
              <div className="text-xs font-bold text-slate-900 leading-tight">
                {user?.fullName || user?.email}
              </div>
              <div className="text-[11px] text-indigo-600 font-semibold leading-tight">
                {user?.jobTitle || 'Super Admin'}
              </div>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden xl:block" />
          </button>

          {isProfileOpen && (
            <div className="absolute right-0 mt-2 w-72 max-w-[calc(100vw-1.5rem)] bg-white rounded-2xl shadow-2xl border border-indigo-100 p-2 z-50 animate-in fade-in zoom-in-95">
              {/* Profile Card Header */}
              <div className="p-3 bg-gradient-to-br from-indigo-50/70 to-purple-50/50 rounded-xl border border-indigo-100/80 mb-2">
                <div className="flex items-center gap-3">
                  {user?.avatarUrl ? (
                    <img
                      src={user.avatarUrl}
                      alt={user.fullName || 'User'}
                      className="w-11 h-11 rounded-xl object-cover ring-2 ring-indigo-500/40 shadow-sm shrink-0"
                    />
                  ) : (
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white font-bold text-sm flex items-center justify-center shadow-sm shrink-0">
                      {user?.firstName ? `${user.firstName[0]}${user.lastName?.[0] || ''}` : 'SA'}
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-900 truncate">
                      {user?.fullName || 'Super Admin'}
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono truncate">
                      {user?.employeeCode || 'EMP-001'}
                    </div>
                    <div className="text-[11px] text-slate-500 truncate">
                      {user?.email}
                    </div>
                  </div>
                </div>
              </div>

              {/* Navigation and Action Items */}
              <div className="space-y-1">
                <button
                  onClick={() => {
                    setIsProfileOpen(false);
                    setProfileModalTab('profile');
                    setIsProfileModalOpen(true);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-slate-700 hover:text-indigo-700 hover:bg-indigo-50 rounded-xl transition cursor-pointer"
                >
                  <Camera className="w-4 h-4 text-indigo-600" />
                  <div className="text-left flex-1">
                    <div>Upload Photo & Edit Profile</div>
                    <div className="text-[10px] text-slate-400 font-normal">Change teammate photo & details</div>
                  </div>
                </button>

                <button
                  onClick={() => {
                    setIsProfileOpen(false);
                    setProfileModalTab('password');
                    setIsProfileModalOpen(true);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-slate-700 hover:text-indigo-700 hover:bg-indigo-50 rounded-xl transition cursor-pointer"
                >
                  <KeyRound className="w-4 h-4 text-purple-600" />
                  <div className="text-left flex-1">
                    <div>Change Password</div>
                    <div className="text-[10px] text-slate-400 font-normal">Update login security credentials</div>
                  </div>
                </button>

                <div className="my-1 border-t border-slate-100" />

                <button
                  onClick={() => {
                    setIsProfileOpen(false);
                    onNavigate('attendance');
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 rounded-xl transition cursor-pointer"
                >
                  <UserCheck className="w-4 h-4 text-emerald-600" />
                  <span>My Attendance Records</span>
                </button>

                <button
                  onClick={() => {
                    setIsProfileOpen(false);
                    onNavigate('tasks');
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 rounded-xl transition cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4 text-blue-600" />
                  <span>My Tasks & Assignments</span>
                </button>

                <div className="my-1 border-t border-slate-100" />

                <button
                  onClick={() => {
                    setIsProfileOpen(false);
                    logout();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-xl transition cursor-pointer"
                >
                  <LogOut className="w-4 h-4 text-rose-600" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>

    {/* Timezone Selector Modal */}
    <TimezoneSelectorModal
      isOpen={isTimezoneModalOpen}
      onClose={() => setIsTimezoneModalOpen(false)}
    />

    {/* Profile & Password Management Modal */}
    <UserProfileModal
      isOpen={isProfileModalOpen}
      onClose={() => setIsProfileModalOpen(false)}
      initialTab={profileModalTab}
    />
  </>
);
};

export default Navbar;
