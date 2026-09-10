import React, { useState } from 'react';
import {
  Clock,
  Play,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  MapPin,
  Monitor,
  Globe,
  RefreshCw,
  Navigation,
  Compass
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { useTimezone } from '../context/TimezoneContext.tsx';
import { api } from '../api.ts';
import { TimezoneSelectorModal } from './TimezoneSelectorModal.tsx';

interface AttendanceCardProps {
  onStatusUpdated?: () => void;
}

export const AttendanceCard: React.FC<AttendanceCardProps> = ({ onStatusUpdated }) => {
  const { todayAttendance, refreshAttendance } = useAuth();
  const {
    timezone,
    locationName,
    formatTime,
    formatDate,
    requestBrowserLocation,
    isDetecting,
    details,
    now
  } = useTimezone();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTimezoneModalOpen, setIsTimezoneModalOpen] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleDetectLocation = async () => {
    setFeedback(null);
    const result = await requestBrowserLocation();
    setFeedback({
      type: result.success ? 'success' : 'error',
      message: result.message
    });
  };

  const handleClockIn = async () => {
    setIsSubmitting(true);
    setFeedback(null);
    try {
      const res = await api.clockIn({
        location: locationName,
        timezone
      });
      setFeedback({ type: 'success', message: res.message });
      await refreshAttendance();
      onStatusUpdated?.();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Clock-in failed' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClockOut = async () => {
    setIsSubmitting(true);
    setFeedback(null);
    try {
      const res = await api.clockOut({ timezone });
      setFeedback({ type: 'success', message: res.message });
      await refreshAttendance();
      onStatusUpdated?.();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Clock-out failed' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const isClockedIn = Boolean(todayAttendance?.clock_in_time);
  const isClockedOut = Boolean(todayAttendance?.clock_out_time);

  const formattedIn = todayAttendance?.clock_in_time
    ? formatTime(todayAttendance.clock_in_time)
    : null;

  const formattedInShort = todayAttendance?.clock_in_time
    ? formatTime(todayAttendance.clock_in_time, { hour: '2-digit', minute: '2-digit', second: undefined })
    : null;

  const formattedOut = todayAttendance?.clock_out_time
    ? formatTime(todayAttendance.clock_out_time)
    : null;

  const formattedOutShort = todayAttendance?.clock_out_time
    ? formatTime(todayAttendance.clock_out_time, { hour: '2-digit', minute: '2-digit', second: undefined })
    : null;

  const todayDateStr = formatDate(now, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  return (
    <div id="workforce-attendance-card" className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
      {/* Header Banner */}
      <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-slate-50/70">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Workforce Attendance Console</h3>
            <p className="text-xs text-slate-500">{todayDateStr}</p>
          </div>
        </div>

        {/* Status Pill */}
        <div>
          {!isClockedIn && (
            <span id="attendance-status-pending" className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300">
              <span className="w-2 h-2 rounded-full bg-amber-600" />
              Clock-In Mandatory
            </span>
          )}
          {isClockedIn && !isClockedOut && (
            <span id="attendance-status-clocked-in" className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
              Clocked In • {formattedInShort}
            </span>
          )}
          {isClockedIn && isClockedOut && (
            <span id="attendance-status-completed" className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-900 border border-blue-300">
              <CheckCircle2 className="w-3.5 h-3.5 text-blue-700" />
              Clock-Out Recorded • {formattedOutShort}
            </span>
          )}
        </div>
      </div>

      {/* Global Location & Timezone Bar */}
      <div className="px-5 py-3 bg-blue-50/50 border-b border-blue-100 flex flex-wrap items-center justify-between gap-2.5 text-xs">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 rounded-md bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
            <MapPin className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0">
            <span className="font-semibold text-slate-900 truncate">
              {locationName}
            </span>
            <span className="text-slate-500 ml-1.5 font-mono text-[11px]">
              ({timezone} • {details.offset})
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="text-[11px] font-mono font-semibold text-blue-900 bg-white px-2.5 py-1 rounded-md border border-blue-200 shadow-2xs">
            Local Time: {details.currentTime}
          </div>

          <button
            id="attendance-detect-loc-btn"
            type="button"
            onClick={handleDetectLocation}
            disabled={isDetecting}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-white hover:bg-slate-100 text-slate-700 font-semibold border border-slate-200 transition cursor-pointer text-[11px]"
            title="Detect your device GPS location and timezone"
          >
            <Navigation className={`w-3 h-3 text-blue-600 ${isDetecting ? 'animate-spin' : ''}`} />
            <span>{isDetecting ? 'Detecting...' : 'Detect Location'}</span>
          </button>

          <button
            id="attendance-change-tz-btn"
            type="button"
            onClick={() => setIsTimezoneModalOpen(true)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-white hover:bg-slate-100 text-slate-700 font-semibold border border-slate-200 transition cursor-pointer text-[11px]"
            title="Choose from global timezones (Asia, Arab World, China, US, UK, Africa)"
          >
            <Compass className="w-3 h-3 text-slate-600" />
            <span>Change Zone</span>
          </button>
        </div>
      </div>

      {/* Main Interactive Body */}
      <div className="p-5 sm:p-6">
        {feedback && (
          <div
            id="attendance-feedback-alert"
            className={`mb-5 p-3 rounded-lg text-xs flex items-center gap-2 border ${
              feedback.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-rose-50 text-rose-800 border-rose-200'
            }`}
          >
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
            )}
            <span>{feedback.message}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
          {/* Left Column: Official Recorded Timestamp */}
          <div className="space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Attendance Record
            </span>
            {!isClockedIn ? (
              <div>
                <div className="text-2xl font-bold text-slate-800">Not Clocked In</div>
                <p className="text-xs text-slate-500 mt-1">
                  No arrival timestamp recorded for today. Clock-in records an immutable server timestamp calibrated to your local solar timezone.
                </p>
              </div>
            ) : !isClockedOut ? (
              <div>
                <div className="text-xs font-semibold text-slate-500 mb-1">
                  Recorded Clock-In Timestamp
                </div>
                <div id="clock-in-timestamp-display" className="text-2xl sm:text-3xl font-mono font-black text-emerald-700 tracking-tight flex items-center gap-2">
                  <Clock className="w-6 h-6 text-emerald-600 shrink-0" />
                  <span>{formattedIn}</span>
                </div>
                <div className="text-xs font-semibold text-emerald-800 flex items-center gap-1.5 mt-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Verified Arrival ({details.abbreviation || timezone})</span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Logged on {todayDateStr}. Timestamp preserved in audit history.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <div>
                  <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">
                    Arrival Timestamp ({details.abbreviation || timezone})
                  </div>
                  <div className="text-xl font-mono font-bold text-emerald-700">
                    {formattedIn}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">
                    Departure Timestamp ({details.abbreviation || timezone})
                  </div>
                  <div className="text-xl font-mono font-bold text-slate-800">
                    {formattedOut}
                  </div>
                </div>
                {todayAttendance?.duration_formatted && (
                  <div className="text-xs text-slate-500 pt-1 border-t border-slate-100">
                    Total recorded span: <span className="font-semibold text-slate-700">{todayAttendance.duration_formatted}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Center Column: Core Actions (Clock-In / Clock-Out) */}
          <div className="flex flex-col items-center justify-center p-4 bg-slate-50 rounded-xl border border-slate-100 text-center space-y-3">
            {!isClockedIn ? (
              <div className="w-full">
                <button
                  id="record-clock-in-btn"
                  onClick={handleClockIn}
                  disabled={isSubmitting}
                  className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-lg shadow-sm hover:shadow transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Play className="w-4 h-4 fill-white" />
                  )}
                  <span>RECORD CLOCK-IN TIMESTAMP</span>
                </button>
                <div className="text-[11px] text-slate-500 mt-2">
                  Captures official timestamp aligned to {details.city} ({details.offset}).
                </div>
              </div>
            ) : !isClockedOut ? (
              <div className="w-full space-y-2.5">
                <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-left">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-emerald-900 uppercase">Clock-In Timestamp</span>
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-200/70 text-emerald-800">Recorded</span>
                  </div>
                  <div className="font-mono text-sm font-bold text-emerald-800 mt-0.5">
                    {formattedIn}
                  </div>
                </div>

                <button
                  id="record-clock-out-btn"
                  onClick={handleClockOut}
                  disabled={isSubmitting}
                  className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-900 text-white text-sm font-semibold rounded-lg shadow-sm transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Clock className="w-4 h-4" />
                  )}
                  <span>RECORD CLOCK-OUT TIMESTAMP (OPTIONAL)</span>
                </button>
                <div className="text-[11px] text-slate-500">
                  Clock-out is optional. Missing clock-outs will not be penalized.
                </div>
              </div>
            ) : (
              <div className="w-full py-2 text-center text-xs text-slate-600">
                <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-1.5" />
                <span className="font-semibold text-slate-800 text-sm">Attendance Timestamps Recorded</span>
                <p className="text-[11px] text-slate-500 mt-0.5">Both arrival and departure timestamps logged.</p>
              </div>
            )}
          </div>

          {/* Right Column: Metadata & Security Verification */}
          <div className="p-3 bg-slate-50/60 rounded-xl border border-slate-100 text-xs space-y-2">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
              <span>Timestamp Telemetry</span>
            </div>
            <div className="space-y-1.5 text-slate-600">
              <div className="flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-[11px]">
                  Time Stamp: {todayAttendance?.clock_in_time ? formatTime(todayAttendance.clock_in_time) : 'Awaiting punch'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Globe className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-[11px]">IP: {todayAttendance?.ip_address || 'Current Ingress Host'}</span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="text-[11px] truncate" title={todayAttendance?.location_info || locationName}>
                  {todayAttendance?.location_info || locationName}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Monitor className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="text-[11px] truncate" title={todayAttendance?.device_info || 'Verified Enterprise Agent'}>
                  {todayAttendance?.device_info ? todayAttendance.device_info.substring(0, 30) + '...' : 'Enterprise Browser Client'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Global Timezone Selector Modal */}
      <TimezoneSelectorModal
        isOpen={isTimezoneModalOpen}
        onClose={() => setIsTimezoneModalOpen(false)}
      />
    </div>
  );
};
