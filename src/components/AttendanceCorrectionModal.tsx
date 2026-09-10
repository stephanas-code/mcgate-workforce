import React, { useState } from 'react';
import { X, ShieldAlert, CheckCircle2, AlertTriangle, Clock } from 'lucide-react';
import { api } from '../api.ts';

interface AttendanceCorrectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: {
    id: number;
    employeeName: string;
    date: string;
    clockInTime: string;
  } | null;
  onSuccess: () => void;
}

export const AttendanceCorrectionModal: React.FC<AttendanceCorrectionModalProps> = ({
  isOpen,
  onClose,
  record,
  onSuccess
}) => {
  const [clockOutTime, setClockOutTime] = useState('17:00');
  const [reason, setReason] = useState('Employee completed shift but did not record optional clock-out.');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !record) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError('A mandatory reason is required to modify attendance records.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await api.correctAttendance({
        attendanceId: record.id,
        clockOutTime,
        reason: reason.trim()
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Correction failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formattedIn = new Date(record.clockInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-purple-600" />
            <h3 className="text-sm font-bold text-slate-900">Administrative Attendance Correction</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-lg flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {/* Record Details */}
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs space-y-1.5">
            <div className="flex justify-between">
              <span className="text-slate-500 font-medium">Employee:</span>
              <span className="font-bold text-slate-800">{record.employeeName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 font-medium">Workday Date:</span>
              <span className="font-semibold text-slate-800">{record.date}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 font-medium">Recorded Clock-In:</span>
              <span className="font-semibold text-emerald-700">{formattedIn}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 font-medium">Current Status:</span>
              <span className="font-semibold text-amber-600">Open Session (No clock-out recorded)</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Corrected Clock-Out Time
            </label>
            <div className="relative">
              <input
                type="time"
                value={clockOutTime}
                onChange={(e) => setClockOutTime(e.target.value)}
                required
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
              <Clock className="w-4 h-4 text-slate-400 absolute right-3 top-3 pointer-events-none" />
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Standard office closing time is 17:00 (5:00 PM).
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Correction Reason <span className="text-rose-600">*</span>
            </label>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
              placeholder="e.g. Employee completed standard work shift but did not clock out before departing."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              This reason will be attached permanently to the attendance record and logged in the immutable audit log.
            </p>
          </div>

          <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-sm transition disabled:opacity-50 flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Apply Correction</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
