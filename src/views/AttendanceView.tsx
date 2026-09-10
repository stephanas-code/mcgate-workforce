import React, { useState, useEffect } from 'react';
import {
  Clock,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  Filter,
  ShieldAlert,
  UserCheck,
  RefreshCw,
  Edit3,
  Globe,
  Info
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { useTimezone } from '../context/TimezoneContext.tsx';
import { api } from '../api.ts';
import { AttendanceCard } from '../components/AttendanceCard.tsx';
import { AttendanceCorrectionModal } from '../components/AttendanceCorrectionModal.tsx';
import { Pagination } from '../components/Pagination.tsx';
import { AttendanceRecord, LiveAttendanceEmployee } from '../types.ts';

export const AttendanceView: React.FC = () => {
  const { user } = useAuth();
  const { timezone, formatTime } = useTimezone();
  const [activeTab, setActiveTab] = useState<'my_history' | 'live_board' | 'open_sessions'>('my_history');
  const [historyFilter, setHistoryFilter] = useState<'all' | 'today' | 'this_week' | 'this_month'>('this_month');
  const [history, setHistory] = useState<AttendanceRecord[]>([]);
  const [historyPage, setHistoryPage] = useState(1);
  const [livePage, setLivePage] = useState(1);
  const [openSessionsPage, setOpenSessionsPage] = useState(1);
  const [liveData, setLiveData] = useState<{
    today: string;
    metrics: any;
    records: LiveAttendanceEmployee[];
    openPastSessions: any[];
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Correction Modal State
  const [correctionRecord, setCorrectionRecord] = useState<{
    id: number;
    employeeName: string;
    date: string;
    clockInTime: string;
  } | null>(null);

  const role = user?.role || 'EMPLOYEE';
  const isAdminOrManager = role !== 'EMPLOYEE';

  const loadData = async () => {
    setIsLoading(true);
    try {
      const myAtt = await api.getMyAttendance(historyFilter, timezone);
      setHistory(myAtt.history || []);

      if (isAdminOrManager) {
        const live = await api.getLiveAttendance();
        setLiveData(live);
      }
    } catch (err) {
      console.error('Failed to load attendance data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [historyFilter, user, timezone]);

  return (
    <div className="space-y-6">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Workforce Attendance & Time Hub
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Mandatory daily clock-in verification with optional clock-out and administrative session auditing.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            disabled={isLoading}
            className="px-3 py-1.5 text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg flex items-center gap-1.5 shadow-xs transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Main Clock-In / Clock-Out Widget */}
      <AttendanceCard onStatusUpdated={loadData} />

      {/* Policy Reminder Banner */}
      <div className="p-3.5 bg-blue-50/80 rounded-xl border border-blue-200 flex items-start gap-3 text-xs text-blue-900">
        <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <span className="font-bold">Core Business Rule Reminder:</span> Clock-in is a mandatory arrival timestamp recorded upon arrival. Clock-out is optional. If you do not record a clock-out timestamp at the end of the day, your attendance timestamp remains valid and preserved.
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200 flex items-center gap-6 text-xs font-bold">
        <button
          onClick={() => setActiveTab('my_history')}
          className={`pb-3 flex items-center gap-2 border-b-2 transition ${
            activeTab === 'my_history'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <UserCheck className="w-4 h-4" />
          <span>My Attendance Log</span>
        </button>

        {isAdminOrManager && (
          <button
            onClick={() => setActiveTab('live_board')}
            className={`pb-3 flex items-center gap-2 border-b-2 transition ${
              activeTab === 'live_board'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Today's Live Attendance ({liveData?.metrics?.clockedIn || 0}/{liveData?.metrics?.totalEmployees || 0})</span>
          </button>
        )}

        {isAdminOrManager && (
          <button
            onClick={() => setActiveTab('open_sessions')}
            className={`pb-3 flex items-center gap-2 border-b-2 transition ${
              activeTab === 'open_sessions'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
            <span>Open Past Sessions ({liveData?.openPastSessions?.length || 0})</span>
          </button>
        )}
      </div>

      {/* Tab 1: My Personal Attendance History */}
      {activeTab === 'my_history' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          {/* Filter Bar */}
          <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-slate-50/50">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <span>Timeframe Filter:</span>
            </div>

            <div className="flex items-center gap-1.5">
              {(['today', 'this_week', 'this_month', 'all'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => {
                    setHistoryFilter(f);
                    setHistoryPage(1);
                  }}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition capitalize ${
                    historyFilter === f
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  {f.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Clock In</th>
                  <th className="px-4 py-3">Clock Out</th>
                  <th className="px-4 py-3">Duration</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Network IP / Device</th>
                  <th className="px-4 py-3">Audit Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {history.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                      No attendance records found for this period.
                    </td>
                  </tr>
                ) : (
                  history
                    .slice((historyPage - 1) * 10, historyPage * 10)
                    .map((h) => {
                    const inStr = formatTime(h.clock_in_time, { hour: '2-digit', minute: '2-digit', second: undefined });
                    const outStr = h.clock_out_time
                      ? formatTime(h.clock_out_time, { hour: '2-digit', minute: '2-digit', second: undefined })
                      : 'No clock-out (Open)';

                    return (
                      <tr key={h.id} className="hover:bg-slate-50/80 transition">
                        <td className="px-4 py-3 font-semibold text-slate-900">{h.date}</td>
                        <td className="px-4 py-3 font-mono text-emerald-700 font-medium">{inStr}</td>
                        <td className="px-4 py-3 font-mono">
                          {h.clock_out_time ? (
                            <span className="text-slate-800">{outStr}</span>
                          ) : (
                            <span className="text-amber-600 italic">Open Session</span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-900">
                          {h.duration_formatted || '—'}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                              h.status === 'COMPLETED'
                                ? 'bg-blue-50 text-blue-800 border-blue-200'
                                : h.status === 'LATE'
                                ? 'bg-amber-50 text-amber-800 border-amber-200'
                                : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            }`}
                          >
                            {h.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-500 font-mono text-[11px]">
                          {h.ip_address || '127.0.0.1'}
                        </td>
                        <td className="px-4 py-3">
                          {h.is_manually_corrected ? (
                            <span
                              className="text-[11px] text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200 cursor-help"
                              title={`Corrected by HR. Reason: ${h.correction_reason}`}
                            >
                              HR Corrected
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <Pagination
            currentPage={historyPage}
            totalItems={history.length}
            pageSize={10}
            onPageChange={setHistoryPage}
            itemLabel="attendance records"
          />
        </div>
      )}

      {/* Tab 2: Live Today Overview for Admins */}
      {activeTab === 'live_board' && isAdminOrManager && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Live Team Presence Board</h3>
              <p className="text-xs text-slate-500">Real-time attendance check for today</p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5 text-emerald-700 font-semibold">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                Active: {liveData?.metrics?.currentlyActive || 0}
              </span>
              <span className="flex items-center gap-1.5 text-blue-700 font-semibold">
                <span className="w-2 h-2 rounded-full bg-blue-500" />
                Completed: {liveData?.metrics?.clockedOut || 0}
              </span>
              <span className="flex items-center gap-1.5 text-slate-500 font-semibold">
                <span className="w-2 h-2 rounded-full bg-slate-300" />
                Not Clocked In: {liveData?.metrics?.notClockedIn || 0}
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Employee</th>
                  <th className="px-4 py-3">Department</th>
                  <th className="px-4 py-3">Today Status</th>
                  <th className="px-4 py-3">Clock In</th>
                  <th className="px-4 py-3">Clock Out</th>
                  <th className="px-4 py-3">Total Time</th>
                  <th className="px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {(liveData?.records || [])
                  .slice((livePage - 1) * 10, livePage * 10)
                  .map((r) => {
                  const inStr = r.clockInTime
                    ? formatTime(r.clockInTime, { hour: '2-digit', minute: '2-digit', second: undefined })
                    : '—';
                  const outStr = r.clockOutTime
                    ? formatTime(r.clockOutTime, { hour: '2-digit', minute: '2-digit', second: undefined })
                    : r.clockInTime ? 'Active (Open)' : '—';

                  return (
                    <tr key={r.employeeId} className="hover:bg-slate-50/80 transition">
                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-900">{r.name}</div>
                        <div className="text-[11px] text-slate-400 font-mono">{r.employeeCode} • {r.jobTitle}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{r.department}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                            r.status === 'Active'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                              : r.status === 'Completed'
                              ? 'bg-blue-50 text-blue-800 border-blue-200'
                              : 'bg-slate-100 text-slate-500 border-slate-200'
                          }`}
                        >
                          {r.status}
                          {r.isLate && ' (Late)'}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-emerald-700">{inStr}</td>
                      <td className="px-4 py-3 font-mono">{outStr}</td>
                      <td className="px-4 py-3 font-medium text-slate-900">{r.duration}</td>
                      <td className="px-4 py-3">
                        {r.attendanceId && !r.clockOutTime ? (
                          <button
                            onClick={() =>
                              setCorrectionRecord({
                                id: r.attendanceId!,
                                employeeName: r.name,
                                date: liveData.today,
                                clockInTime: r.clockInTime!
                              })
                            }
                            className="px-2.5 py-1 text-[11px] font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded transition flex items-center gap-1"
                          >
                            <Edit3 className="w-3 h-3" />
                            <span>Correct / Close</span>
                          </button>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <Pagination
            currentPage={livePage}
            totalItems={liveData?.records?.length || 0}
            pageSize={10}
            onPageChange={setLivePage}
            itemLabel="team records"
          />
        </div>
      )}

      {/* Tab 3: Open Past Sessions for HR Review */}
      {activeTab === 'open_sessions' && isAdminOrManager && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-amber-50/50">
            <h3 className="text-sm font-bold text-amber-900">Historical Sessions With No Clock-Out</h3>
            <p className="text-xs text-amber-700 mt-0.5">
              These sessions were left open by employees from past dates. As per McGate policy, this is not considered misconduct. Admins can manually close the record with a reason and appropriate clock-out time.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Workday Date</th>
                  <th className="px-4 py-3">Employee</th>
                  <th className="px-4 py-3">Department</th>
                  <th className="px-4 py-3">Clock-In Time</th>
                  <th className="px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {liveData?.openPastSessions?.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                      All past attendance sessions have been reconciled. No open past sessions.
                    </td>
                  </tr>
                ) : (
                  (liveData?.openPastSessions || [])
                    .slice((openSessionsPage - 1) * 10, openSessionsPage * 10)
                    .map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50 transition">
                      <td className="px-4 py-3 font-semibold text-slate-900">{s.date}</td>
                      <td className="px-4 py-3 font-bold text-slate-800">{s.employeeName}</td>
                      <td className="px-4 py-3 text-slate-600">{s.department}</td>
                      <td className="px-4 py-3 font-mono text-emerald-700">
                        {formatTime(s.clockInTime, { hour: '2-digit', minute: '2-digit', second: undefined })}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() =>
                            setCorrectionRecord({
                              id: s.id,
                              employeeName: s.employeeName,
                              date: s.date,
                              clockInTime: s.clockInTime
                            })
                          }
                          className="px-2.5 py-1 text-[11px] font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded transition flex items-center gap-1"
                        >
                          <Edit3 className="w-3 h-3" />
                          <span>Close Session & Record Reason</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <Pagination
            currentPage={openSessionsPage}
            totalItems={liveData?.openPastSessions?.length || 0}
            pageSize={10}
            onPageChange={setOpenSessionsPage}
            itemLabel="open sessions"
          />
        </div>
      )}

      {/* Administrative Correction Modal */}
      <AttendanceCorrectionModal
        isOpen={Boolean(correctionRecord)}
        onClose={() => setCorrectionRecord(null)}
        record={correctionRecord}
        onSuccess={loadData}
      />
    </div>
  );
};
