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
  updateUserAvatar: (avatarUrl: string) => Promise<void>;
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

  // Initialize profile from secure stored token on mount
  useEffect(() => {
    const init = async () => {
      if (getStoredToken()) {
        await refreshProfile();
      } else {
        setIsLoading(false);
      }
    };

    init();
  }, [refreshProfile]);

  const login = async (email: string, password: string) => {
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
    const matched = demoUsers.find((d) => d.role === roleOrEmail || d.email === roleOrEmail);
    if (matched) {
      return switchRole(matched.email);
    }
    return switchRole('superuser@mcgate.tech');
  };

  const updateUserAvatar = async (avatarUrl: string) => {
    const res = await api.updateProfileAvatar(avatarUrl);
    if (res.user) {
      setUser(res.user);
    } else if (user) {
      setUser({ ...user, avatarUrl });
    }
    await refreshProfile();
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
        refreshAttendance,
        updateUserAvatar
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
