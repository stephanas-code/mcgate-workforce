import React, { useState } from 'react';
import { Shield, Lock, Mail, ArrowRight, UserCheck, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';

export const LoginView: React.FC = () => {
  const { login, switchDemoRole } = useAuth();
  const [email, setEmail] = useState('admin@mcgate.tech');
  const [password, setPassword] = useState('password123');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      await login(email, password);
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickLogin = async (roleOrEmail: string) => {
    setIsLoading(true);
    setError(null);
    try {
      await switchDemoRole(roleOrEmail);
    } catch (err: any) {
      setError(err.message || 'Demo login failed');
    } finally {
      setIsLoading(false);
    }
  };

  const demoAccounts = [
    { role: 'SUPER_ADMIN', name: 'Marcus Vance', title: 'Chief Technology Officer', email: 'admin@mcgate.tech', color: 'border-purple-200 bg-purple-50/50 hover:border-purple-400 text-purple-900' },
    { role: 'ADMIN', name: 'Elena Rostova', title: 'Head of Human Resources', email: 'hr@mcgate.tech', color: 'border-blue-200 bg-blue-50/50 hover:border-blue-400 text-blue-900' },
    { role: 'MANAGER', name: 'David Chen', title: 'Engineering Lead & Architect', email: 'lead.eng@mcgate.tech', color: 'border-amber-200 bg-amber-50/50 hover:border-amber-400 text-amber-900' },
    { role: 'EMPLOYEE', name: 'John Doe', title: 'Senior Systems Engineer', email: 'john.doe@mcgate.tech', color: 'border-slate-200 bg-slate-50 hover:border-slate-400 text-slate-800' }
  ];

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4 sm:p-6 text-slate-100">
      <div className="w-full max-w-md space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-600 text-white shadow-xl shadow-blue-500/20 mb-2">
            <Shield className="w-8 h-8" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            McGate Technologies
          </h1>
          <p className="text-xs sm:text-sm text-slate-400">
            Workforce Attendance, Task Operations & Resource Platform
          </p>
        </div>

        {/* Login Box */}
        <div className="bg-white text-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl border border-slate-200 space-y-5">
          <div>
            <h2 className="text-base font-bold text-slate-900">Sign in with Enterprise ID</h2>
            <p className="text-xs text-slate-500 mt-0.5">Enter your corporate credentials to continue</p>
          </div>

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-lg flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Corporate Email
              </label>
              <div className="relative">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@mcgate.tech"
                  className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Password
              </label>
              <div className="relative">
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-sm transition disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Authenticate Session</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Quick Demo Access Switcher */}
          <div className="pt-4 border-t border-slate-100 space-y-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block text-center">
              Quick Test Personas (One-Click Sign In)
            </span>

            <div className="grid grid-cols-2 gap-2">
              {demoAccounts.map((d) => (
                <button
                  key={d.role}
                  type="button"
                  disabled={isLoading}
                  onClick={() => handleQuickLogin(d.role)}
                  className={`p-2.5 rounded-lg border text-left transition cursor-pointer disabled:opacity-50 ${d.color}`}
                >
                  <div className="font-bold text-xs">{d.name}</div>
                  <div className="text-[10px] opacity-80">{d.role.replace('_', ' ')}</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Security Footer */}
        <div className="text-center text-[11px] text-slate-500 space-y-1">
          <p>Protected by Enterprise RBAC & SHA-256 HMAC Sessions</p>
          <p>© 2026 McGate Technologies AG. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
};
