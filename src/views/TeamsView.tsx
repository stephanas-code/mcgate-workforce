import React, { useState, useEffect } from 'react';
import {
  Users2,
  Building,
  UserCheck,
  Mail,
  Shield,
  Briefcase,
  Plus,
  CheckCircle2,
  X,
  AlertTriangle
} from 'lucide-react';
import { api } from '../api.ts';
import { useAuth } from '../context/AuthContext.tsx';

export const TeamsView: React.FC = () => {
  const { user } = useAuth();
  const [employees, setEmployees] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'employees' | 'org_structure'>('employees');
  const [isAddEmployeeModalOpen, setIsAddEmployeeModalOpen] = useState(false);

  // New employee form
  const [newEmployee, setNewEmployee] = useState({
    employeeCode: '',
    firstName: '',
    lastName: '',
    email: '',
    password: 'password123',
    departmentId: '',
    teamId: '',
    jobTitle: '',
    role: 'EMPLOYEE'
  });
  const [modalError, setModalError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const role = user?.role || 'EMPLOYEE';
  const isAdmin = role === 'SUPER_ADMIN' || role === 'ADMIN';

  const loadData = async () => {
    try {
      const [eList, dList, tList] = await Promise.all([
        api.getEmployees(),
        api.getDepartments(),
        api.getTeams()
      ]);
      setEmployees(eList);
      setDepartments(dList);
      setTeams(tList);
      if (dList[0]) {
        setNewEmployee((prev) => ({ ...prev, departmentId: String(dList[0].id) }));
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmployee.employeeCode || !newEmployee.firstName || !newEmployee.lastName || !newEmployee.email) {
      setModalError('Please fill in all mandatory fields.');
      return;
    }

    setIsSubmitting(true);
    setModalError(null);
    try {
      await api.createEmployee({
        ...newEmployee,
        departmentId: newEmployee.departmentId ? Number(newEmployee.departmentId) : undefined,
        teamId: newEmployee.teamId ? Number(newEmployee.teamId) : undefined
      });
      setIsAddEmployeeModalOpen(false);
      setNewEmployee({
        employeeCode: '',
        firstName: '',
        lastName: '',
        email: '',
        password: 'password123',
        departmentId: departments[0]?.id ? String(departments[0].id) : '',
        teamId: '',
        jobTitle: '',
        role: 'EMPLOYEE'
      });
      await loadData();
    } catch (err: any) {
      setModalError(err.message || 'Failed to create employee');
    } finally {
      setIsSubmitting(false);
    }
  };

  const roleBadges: Record<string, string> = {
    SUPER_ADMIN: 'bg-purple-100 text-purple-800 border-purple-300',
    ADMIN: 'bg-blue-100 text-blue-800 border-blue-300',
    MANAGER: 'bg-amber-100 text-amber-800 border-amber-300',
    EMPLOYEE: 'bg-slate-100 text-slate-700 border-slate-200'
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Workforce Directory & Structure
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Departments, specialized engineering squads, and enterprise role permissions.
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={() => setIsAddEmployeeModalOpen(true)}
            className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-sm transition flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Onboard Employee</span>
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200 flex items-center gap-6 text-xs font-bold">
        <button
          onClick={() => setActiveTab('employees')}
          className={`pb-3 flex items-center gap-2 border-b-2 transition ${
            activeTab === 'employees'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <UserCheck className="w-4 h-4" />
          <span>Workforce Directory ({employees.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('org_structure')}
          className={`pb-3 flex items-center gap-2 border-b-2 transition ${
            activeTab === 'org_structure'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Building className="w-4 h-4" />
          <span>Departments & Squads</span>
        </button>
      </div>

      {/* Tab 1: Workforce Directory Table */}
      {activeTab === 'employees' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Code</th>
                  <th className="px-4 py-3">Employee Name</th>
                  <th className="px-4 py-3">Job Title</th>
                  <th className="px-4 py-3">Department</th>
                  <th className="px-4 py-3">Assigned Squad</th>
                  <th className="px-4 py-3">Enterprise Role</th>
                  <th className="px-4 py-3">Today Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {employees.map((e) => (
                  <tr key={e.id} className="hover:bg-slate-50/80 transition">
                    <td className="px-4 py-3 font-mono font-bold text-blue-700">
                      {e.employee_code}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-bold text-slate-900">{e.first_name} {e.last_name}</div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-1">
                        <Mail className="w-3 h-3" />
                        {e.email}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-800">{e.job_title}</td>
                    <td className="px-4 py-3 text-slate-600">{e.department_name || 'Enterprise'}</td>
                    <td className="px-4 py-3 text-slate-600">{e.team_name || 'Core Operations'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${roleBadges[e.role]}`}>
                        {e.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {e.todayClockIn ? (
                        <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 font-bold">
                          <span className="w-2 h-2 rounded-full bg-emerald-500" />
                          Clocked In
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] text-slate-400 font-medium">
                          <span className="w-2 h-2 rounded-full bg-slate-300" />
                          Not Present
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Departments & Squads Structure */}
      {activeTab === 'org_structure' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {departments.map((dept) => {
            const deptTeams = teams.filter((t) => t.department_id === dept.id);

            return (
              <div key={dept.id} className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                      <Building className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-900">{dept.name}</h3>
                      <p className="text-xs text-slate-500">{dept.description}</p>
                    </div>
                  </div>
                  <span className="text-xs font-mono font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                    {deptTeams.length} Teams
                  </span>
                </div>

                <div className="space-y-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Squads / Units:
                  </span>
                  {deptTeams.length === 0 ? (
                    <div className="text-xs text-slate-400 italic">No squads created in this department.</div>
                  ) : (
                    deptTeams.map((t) => (
                      <div key={t.id} className="p-3 bg-slate-50 rounded-lg border border-slate-200/80 flex items-center justify-between">
                        <div>
                          <div className="text-xs font-bold text-slate-800">{t.name}</div>
                          <div className="text-[11px] text-slate-500">{t.description}</div>
                        </div>
                        <span className="text-[11px] text-blue-700 font-semibold bg-blue-50 px-2 py-0.5 rounded">
                          {t.memberCount} Members
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Onboard Employee Modal */}
      {isAddEmployeeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="text-sm font-bold text-slate-900">Onboard New McGate Employee</h3>
              <button onClick={() => setIsAddEmployeeModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateEmployee} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
              {modalError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-lg flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{modalError}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Employee Code</label>
                  <input
                    type="text"
                    required
                    placeholder="EMP-010"
                    value={newEmployee.employeeCode}
                    onChange={(e) => setNewEmployee({ ...newEmployee, employeeCode: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Corporate Role</label>
                  <select
                    value={newEmployee.role}
                    onChange={(e) => setNewEmployee({ ...newEmployee, role: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white"
                  >
                    <option value="EMPLOYEE">Employee</option>
                    <option value="MANAGER">Manager</option>
                    <option value="ADMIN">Administrator</option>
                    {user?.role === 'SUPER_ADMIN' && <option value="SUPER_ADMIN">Super Administrator</option>}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">First Name</label>
                  <input
                    type="text"
                    required
                    placeholder="Alex"
                    value={newEmployee.firstName}
                    onChange={(e) => setNewEmployee({ ...newEmployee, firstName: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Last Name</label>
                  <input
                    type="text"
                    required
                    placeholder="Vance"
                    value={newEmployee.lastName}
                    onChange={(e) => setNewEmployee({ ...newEmployee, lastName: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Enterprise Email</label>
                <input
                  type="email"
                  required
                  placeholder="alex.vance@mcgate.tech"
                  value={newEmployee.email}
                  onChange={(e) => setNewEmployee({ ...newEmployee, email: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Job Title</label>
                <input
                  type="text"
                  required
                  placeholder="Senior Software Engineer"
                  value={newEmployee.jobTitle}
                  onChange={(e) => setNewEmployee({ ...newEmployee, jobTitle: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Department</label>
                  <select
                    value={newEmployee.departmentId}
                    onChange={(e) => setNewEmployee({ ...newEmployee, departmentId: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white"
                  >
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Squad / Team</label>
                  <select
                    value={newEmployee.teamId}
                    onChange={(e) => setNewEmployee({ ...newEmployee, teamId: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white"
                  >
                    <option value="">None / Core</option>
                    {teams.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddEmployeeModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-sm"
                >
                  Onboard Colleague
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
