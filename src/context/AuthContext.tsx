import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User, AttendanceRecord } from '../types.ts';
import { api, getStoredToken, setStoredToken, clearStoredToken } from '../api.ts';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  todayAttendance: AttendanceRecord | null;
  demoUsers: any[];
  login: (email: string, password?: string) => Promise<void>;
  switchRole: (email: string) => Promise<void>;
  switchDemoRole: (roleOrEmail: string) => Promise<void>;
  logout: () => void;
  refreshProfile: () => Promise<void>;
  refreshAttendance: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [todayAttendance, setTodayAttendance] = useState<AttendanceRecord | null>(null);
  const [demoUsers, setDemoUsers] = useState<any[]>([]);

  const refreshAttendance = useCallback(async () => {
    if (!getStoredToken()) {
      setTodayAttendance(null);
      return;
    }
    try {
      const res = await api.getMyAttendance('today');
      setTodayAttendance(res.today || null);
    } catch {
      // ignore
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    const token = getStoredToken();
    if (!token) {
      setUser(null);
      setIsLoading(false);
      return;
    }
    try {
      const res = await api.getMe();
      setUser(res.user);
      await refreshAttendance();
    } catch (err) {
      console.warn('Session check failed, clearing token:', err);
      clearStoredToken();
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, [refreshAttendance]);

  // Load demo users and initialize profile on mount
  useEffect(() => {
    const init = async () => {
      try {
        const demos = await api.getDemoUsers();
        setDemoUsers(demos);

        // If no token exists, default auto-login to Marcus Vance (Super Admin) for immediate seamless exploration
        if (!getStoredToken() && demos.length > 0) {
          const res = await api.switchDemo(demos[0].email);
          setStoredToken(res.token);
          setUser(res.user);
          await refreshAttendance();
          setIsLoading(false);
          return;
        }
      } catch (err) {
        console.error('Demo init failed:', err);
      }
      await refreshProfile();
    };

    init();
  }, [refreshProfile, refreshAttendance]);

  const login = async (email: string, password = 'password123') => {
    setIsLoading(true);
    try {
      const res = await api.login({ email, password });
      setStoredToken(res.token);
      setUser(res.user);
      await refreshAttendance();
    } finally {
      setIsLoading(false);
    }
  };

  const switchRole = async (email: string) => {
    setIsLoading(true);
    try {
      const res = await api.switchDemo(email);
      setStoredToken(res.token);
      setUser(res.user);
      await refreshAttendance();
    } finally {
      setIsLoading(false);
    }
  };

  const switchDemoRole = async (roleOrEmail: string) => {
    if (roleOrEmail.includes('@')) {
      return switchRole(roleOrEmail);
    }
    const matched = demoUsers.find((d) => d.role === roleOrEmail);
    if (matched) {
      return switchRole(matched.email);
    }
    const roleEmailMap: Record<string, string> = {
      SUPER_ADMIN: 'admin@mcgate.tech',
      ADMIN: 'hr@mcgate.tech',
      MANAGER: 'lead.eng@mcgate.tech',
      EMPLOYEE: 'john.doe@mcgate.tech'
    };
    const targetEmail = roleEmailMap[roleOrEmail] || 'admin@mcgate.tech';
    return switchRole(targetEmail);
  };

  const logout = () => {
    clearStoredToken();
    setUser(null);
    setTodayAttendance(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        todayAttendance,
        demoUsers,
        login,
        switchRole,
        switchDemoRole,
        logout,
        refreshProfile,
        refreshAttendance
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
