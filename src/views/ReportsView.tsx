import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  Download,
  Calendar,
  CheckCircle2,
  Clock,
  AlertTriangle,
  FileSpreadsheet,
  Users,
  TrendingUp
} from 'lucide-react';
import { api } from '../api.ts';
import { Pagination } from '../components/Pagination.tsx';

export const ReportsView: React.FC = () => {
  const [attReport, setAttReport] = useState<any>(null);
  const [tasksReport, setTasksReport] = useState<any>(null);
  const [deptPage, setDeptPage] = useState(1);
  const [empPage, setEmpPage] = useState(1);
  const [dateRange, setDateRange] = useState({
    from: new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0],
    to: new Date().toISOString().split('T')[0]
  });
  const [isLoading, setIsLoading] = useState(false);

  const loadReports = async () => {
    setIsLoading(true);
    try {
      const [aData, tData] = await Promise.all([
        api.getAttendanceReport(dateRange.from, dateRange.to),
        api.getTasksReport()
      ]);
      setAttReport(aData);
      setTasksReport(tData);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadReports();
  }, [dateRange]);

  const handleExportAttendanceCsv = async () => {
    try {
      await api.exportAttendanceCsv(dateRange.from, dateRange.to);
    } catch (err: any) {
      alert(err.message || 'Export failed');
    }
  };

  const handleExportTasksCsv = async () => {
    try {
      await api.exportTasksCsv();
    } catch (err: any) {
      alert(err.message || 'Export failed');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Workforce Productivity & Operational Analytics
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Exportable business reporting on attendance fidelity, task velocity, and employee workload.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleExportAttendanceCsv}
            className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold rounded-lg shadow-xs transition flex items-center gap-1.5"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Export Attendance CSV</span>
          </button>
          <button
            onClick={handleExportTasksCsv}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-xs transition flex items-center gap-1.5"
          >
            <Download className="w-4 h-4" />
            <span>Export Tasks CSV</span>
          </button>
        </div>
      </div>

      {/* Date Filter Bar */}
      <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
          <Calendar className="w-4 h-4 text-slate-400" />
          <span>Report Reporting Window:</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-500">From:</span>
            <input
              type="date"
              value={dateRange.from}
              onChange={(e) => setDateRange({ ...dateRange, from: e.target.value })}
              className="px-2.5 py-1 border border-slate-200 rounded-md outline-none"
            />
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-500">To:</span>
            <input
              type="date"
              value={dateRange.to}
              onChange={(e) => setDateRange({ ...dateRange, to: e.target.value })}
              className="px-2.5 py-1 border border-slate-200 rounded-md outline-none"
            />
          </div>
        </div>
      </div>

      {/* Analytics Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 block mb-1">Total Attendance Records</span>
          <div className="text-2xl font-black text-slate-900">{attReport?.summary?.totalRecords ?? '—'}</div>
          <span className="text-[11px] text-slate-400 mt-1 block">
            {attReport?.summary?.completedSessions ?? 0} with recorded clock-out
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 block mb-1">Open Sessions (No Clock-Out)</span>
          <div className="text-2xl font-black text-amber-600">{attReport?.summary?.unclosedSessions ?? 0}</div>
          <span className="text-[11px] text-slate-400 mt-1 block">
            {attReport?.summary?.manuallyCorrectedSessions ?? 0} corrected by HR
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 block mb-1">Task Completion Velocity</span>
          <div className="text-2xl font-black text-emerald-600">{tasksReport?.summary?.completionRate ?? 0}%</div>
          <span className="text-[11px] text-slate-400 mt-1 block">
            {tasksReport?.summary?.completed ?? 0} of {tasksReport?.summary?.total ?? 0} closed
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 block mb-1">Critical Overdue Items</span>
          <div className="text-2xl font-black text-rose-600">{tasksReport?.summary?.overdue ?? 0}</div>
          <span className="text-[11px] text-slate-400 mt-1 block">
            {tasksReport?.summary?.blocked ?? 0} tasks currently blocked
          </span>
        </div>
      </div>

      {/* Two Breakdown Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Department Attendance Summary */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">Department Attendance Breakdown</h3>
            <span className="text-xs text-slate-400">Total sessions</span>
          </div>

          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-bold border-b border-slate-200">
              <tr>
                <th className="px-4 py-2.5">Department</th>
                <th className="px-4 py-2.5">Sessions</th>
                <th className="px-4 py-2.5">Logged Hours</th>
                <th className="px-4 py-2.5">Avg Session</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {(attReport?.byDepartment || [])
                .slice((deptPage - 1) * 10, deptPage * 10)
                .map((d: any) => (
                <tr key={d.department_name} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-semibold text-slate-900">{d.department_name}</td>
                  <td className="px-4 py-3">{d.session_count}</td>
                  <td className="px-4 py-3 font-medium text-blue-700">{d.total_hours_worked} hrs</td>
                  <td className="px-4 py-3">{d.avg_hours_per_session} hrs</td>
                </tr>
              ))}
            </tbody>
          </table>

          <Pagination
            currentPage={deptPage}
            totalItems={attReport?.byDepartment?.length || 0}
            pageSize={10}
            onPageChange={setDeptPage}
            itemLabel="departments"
          />
        </div>

        {/* Employee Workload & Deliverables */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">Employee Workload & Task Performance</h3>
            <span className="text-xs text-slate-400">Completion rate</span>
          </div>

          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-bold border-b border-slate-200">
              <tr>
                <th className="px-4 py-2.5">Employee</th>
                <th className="px-4 py-2.5">Department</th>
                <th className="px-4 py-2.5">Assigned</th>
                <th className="px-4 py-2.5">Completed</th>
                <th className="px-4 py-2.5">Overdue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {(tasksReport?.byEmployee || [])
                .slice((empPage - 1) * 10, empPage * 10)
                .map((e: any) => (
                <tr key={e.employee_code} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-semibold text-slate-900">
                    {e.first_name} {e.last_name}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{e.department_name}</td>
                  <td className="px-4 py-3 font-bold">{e.assigned_tasks}</td>
                  <td className="px-4 py-3 text-emerald-700 font-bold">{e.completed_tasks}</td>
                  <td className="px-4 py-3">
                    {e.overdue_tasks > 0 ? (
                      <span className="text-rose-600 font-bold">{e.overdue_tasks}</span>
                    ) : (
                      <span className="text-slate-400">0</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <Pagination
            currentPage={empPage}
            totalItems={tasksReport?.byEmployee?.length || 0}
            pageSize={10}
            onPageChange={setEmpPage}
            itemLabel="employees"
          />
        </div>
      </div>
    </div>
  );
};
