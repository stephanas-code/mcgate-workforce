import React, { useState, useEffect } from 'react';
import {
  Settings,
  Clock,
  Shield,
  Save,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Building
} from 'lucide-react';
import { api } from '../api.ts';
import { useAuth } from '../context/AuthContext.tsx';

export const SettingsView: React.FC = () => {
  const { user } = useAuth();
  const [settings, setSettings] = useState<Record<string, string>>({
    company_name: 'McGate Technologies',
    workday_start_time: '08:30',
    workday_end_time: '17:00',
    grace_period_minutes: '15',
    mandatory_clock_in: 'true',
    optional_clock_out: 'true',
    timezone: 'Europe/Berlin'
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await api.getSettings();
        setSettings(data);
      } catch (err) {
        console.error(err);
      }
    };
    load();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFeedback(null);
    try {
      await api.updateSettings(settings);
      setFeedback({ type: 'success', message: 'Enterprise workforce parameters updated successfully.' });
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to update settings.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
          Enterprise Workforce Settings
        </h1>
        <p className="text-xs sm:text-sm text-slate-500">
          Configure corporate working schedules, attendance compliance thresholds, and operational rules.
        </p>
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-xl border flex items-center gap-2.5 text-xs ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Core Attendance Policy */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-5">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
            <Clock className="w-5 h-5 text-blue-600" />
            <div>
              <h3 className="text-sm font-bold text-slate-900">Attendance & Working Hours Policy</h3>
              <p className="text-xs text-slate-500">Parameters defining expected workday schedules and tardiness thresholds</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Standard Workday Start
              </label>
              <input
                type="time"
                value={settings.workday_start_time || '08:30'}
                onChange={(e) => setSettings({ ...settings, workday_start_time: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Arrivals past this time + grace period will be flagged as LATE.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Standard Workday End
              </label>
              <input
                type="time"
                value={settings.workday_end_time || '17:00'}
                onChange={(e) => setSettings({ ...settings, workday_end_time: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Used as default close time for administrative session reconciliations.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Grace Period (Minutes)
              </label>
              <input
                type="number"
                min="0"
                max="60"
                value={settings.grace_period_minutes || '15'}
                onChange={(e) => setSettings({ ...settings, grace_period_minutes: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Allowance window before clock-in is marked as late arrival.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Timezone Cluster
              </label>
              <input
                type="text"
                disabled
                value="Europe/Berlin (CET/CEST)"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-500"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Server timestamp is synchronized to primary data center timezone.
              </p>
            </div>
          </div>

          {/* Immutable Rule Badges */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-2">
            <div className="font-bold text-slate-800 flex items-center gap-1.5">
              <Lock className="w-4 h-4 text-slate-500" />
              <span>Hardcoded Core Business Rules</span>
            </div>
            <div className="text-slate-600 space-y-1">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span><strong>Clock-in is Mandatory:</strong> Enforced at database and API levels.</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                <span><strong>Clock-out is Optional:</strong> Missing clock-outs are never marked as misconduct.</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                <span><strong>Administrative Auditing:</strong> Every manual correction requires a mandatory reason and is written to the immutable audit log.</span>
              </div>
            </div>
          </div>
        </div>

        {/* Corporate Entity Info */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
            <Building className="w-5 h-5 text-indigo-600" />
            <div>
              <h3 className="text-sm font-bold text-slate-900">Organization Identity</h3>
              <p className="text-xs text-slate-500">Platform branding and tenant attributes</p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Organization Name
            </label>
            <input
              type="text"
              value={settings.company_name || 'McGate Technologies'}
              onChange={(e) => setSettings({ ...settings, company_name: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-sm transition disabled:opacity-50 flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            <span>Save Configuration Changes</span>
          </button>
        </div>
      </form>
    </div>
  );
};
