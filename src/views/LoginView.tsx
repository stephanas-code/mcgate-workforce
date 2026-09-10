import React, { useState } from 'react';
import { Shield, Lock, Mail, ArrowRight, Eye, EyeOff, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';

export const LoginView: React.FC = () => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError('Please provide both your corporate email and password.');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      await login(email.trim(), password);
    } catch (err: any) {
      setError(err.message || 'Invalid credentials or session expired. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4 sm:p-6 text-slate-100 selection:bg-blue-600 selection:text-white">
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
            <p className="text-xs text-slate-500 mt-0.5">Enter your corporate credentials to access your session</p>
          </div>

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-lg flex items-center gap-2 animate-in fade-in duration-200">
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
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@mcgate.tech"
                  className="w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-lg text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition placeholder:text-slate-400"
                />
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-10 py-2.5 border border-slate-300 rounded-lg text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition placeholder:text-slate-400"
                />
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer p-0.5 rounded transition"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-sm transition disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer mt-2"
            >
              {isLoading ? (
                <span>Authenticating...</span>
              ) : (
                <>
                  <span>Authenticate Session</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Security Notice */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-center gap-1.5 text-[11px] text-slate-500">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>Encrypted zero-trust gateway with rate-limiting protection</span>
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
