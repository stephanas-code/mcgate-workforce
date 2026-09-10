import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Search,
  X,
  Filter,
  Clock,
  User,
  Globe,
  FileCode,
  ShieldCheck
} from 'lucide-react';
import { api } from '../api.ts';
import { AuditLogEntry } from '../types.ts';
import { Pagination } from '../components/Pagination.tsx';

export const AuditLogsView: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const loadLogs = async () => {
    setIsLoading(true);
    try {
      const data = await api.getAuditLogs({
        action: actionFilter || undefined,
        limit: 100
      });
      setLogs(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setPage(1);
    loadLogs();
  }, [actionFilter]);

  const filteredLogs = logs.filter((log) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      log.user_name?.toLowerCase().includes(q) ||
      log.action.toLowerCase().includes(q) ||
      log.resource?.toLowerCase().includes(q) ||
      log.ip_address?.toLowerCase().includes(q)
    );
  });

  const paginatedLogs = filteredLogs.slice((page - 1) * 10, page * 10);

  const actionColors: Record<string, string> = {
    CLOCK_IN: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    CLOCK_OUT: 'bg-blue-50 text-blue-800 border-blue-200',
    ATTENDANCE_CORRECTION: 'bg-purple-50 text-purple-800 border-purple-200 font-bold',
    TASK_CREATE: 'bg-indigo-50 text-indigo-800 border-indigo-200',
    TASK_STATUS_CHANGE: 'bg-amber-50 text-amber-800 border-amber-200',
    PROJECT_CREATE: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    ASSIGNMENT_CREATE: 'bg-blue-50 text-blue-800 border-blue-200',
    SETTING_UPDATE: 'bg-rose-50 text-rose-800 border-rose-200 font-bold'
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Immutable Security Audit Trail
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Append-only verification log tracking attendance alterations, administrative overrides, and system changes.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-600 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200 font-medium flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Cryptographic Log Integrity Active</span>
          </span>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="relative min-w-[240px] max-w-sm flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
          <input
            type="text"
            placeholder="Search actor, action, IP..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-8 py-1.5 text-xs border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
          />
          {searchQuery && (
            <button
              id="clear-audit-search-btn"
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1.5 p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition"
              title="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 outline-none"
          >
            <option value="">All Security Events</option>
            <option value="CLOCK_IN">Clock-In</option>
            <option value="CLOCK_OUT">Clock-Out</option>
            <option value="ATTENDANCE_CORRECTION">Administrative Correction</option>
            <option value="TASK_CREATE">Task Created</option>
            <option value="TASK_STATUS_CHANGE">Task Status Modified</option>
            <option value="SETTING_UPDATE">Settings Changed</option>
          </select>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Timestamp (UTC/CET)</th>
                <th className="px-4 py-3">Actor / Employee</th>
                <th className="px-4 py-3">Action Event</th>
                <th className="px-4 py-3">Target Entity</th>
                <th className="px-4 py-3">Network IP</th>
                <th className="px-4 py-3">Recorded Payload / Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                    No matching audit records found.
                  </td>
                </tr>
              ) : (
                paginatedLogs.map((entry) => (
                  <tr key={entry.id} className="hover:bg-slate-50/80 transition">
                    <td className="px-4 py-3 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                      {new Date(entry.created_at).toLocaleString([], {
                        year: 'numeric',
                        month: 'short',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit'
                      })}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-bold text-slate-900">{entry.user_name || 'System Operator'}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{entry.user_role}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                          actionColors[entry.action] || 'bg-slate-100 text-slate-700 border-slate-200'
                        }`}
                      >
                        {entry.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-800 font-mono text-[11px]">
                      {entry.resource} {entry.resource_id ? `#${entry.resource_id}` : ''}
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-slate-500">
                      {entry.ip_address || '127.0.0.1'}
                    </td>
                    <td className="px-4 py-3 max-w-xs">
                      {entry.after_value || entry.before_value ? (
                        <div
                          className="font-mono text-[11px] text-slate-600 truncate bg-slate-50 px-2 py-1 rounded border border-slate-100 cursor-help"
                          title={entry.after_value || entry.before_value || ''}
                        >
                          {entry.after_value || entry.before_value}
                        </div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <Pagination
          currentPage={page}
          totalItems={filteredLogs.length}
          pageSize={10}
          onPageChange={setPage}
          itemLabel="audit logs"
        />
      </div>
    </div>
  );
};
