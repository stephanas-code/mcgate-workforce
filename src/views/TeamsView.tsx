import React, { useState, useEffect, useRef } from 'react';
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
  AlertTriangle,
  Camera,
  Upload,
  Search,
  Phone,
  RefreshCw
} from 'lucide-react';
import { api } from '../api.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { Pagination } from '../components/Pagination.tsx';
import { Modal } from '../components/Modal.tsx';

export const TeamsView: React.FC = () => {
  const { user } = useAuth();
  const [employees, setEmployees] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [departments, setDepartments] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'employees' | 'org_structure'>('employees');
  const [isAddEmployeeModalOpen, setIsAddEmployeeModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Selected teammate for photo upload modal
  const [photoModalEmployee, setPhotoModalEmployee] = useState<any | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isSavingPhoto, setIsSavingPhoto] = useState(false);
  const [photoModalError, setPhotoModalError] = useState<string | null>(null);
  const [photoModalSuccess, setPhotoModalSuccess] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

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
    role: 'EMPLOYEE',
    avatarUrl: ''
  });
  const [modalError, setModalError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const newEmpPhotoRef = useRef<HTMLInputElement>(null);

  const role = user?.role || 'SUPER_ADMIN';
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
      if (dList[0] && !newEmployee.departmentId) {
        setNewEmployee((prev) => ({ ...prev, departmentId: String(dList[0].id) }));
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Process photo to base64 with canvas compression
  const processImage = (file: File, callback: (dataUrl: string) => void, onError: (err: string) => void) => {
    if (!file.type.startsWith('image/')) {
      onError('Please select a valid image file (JPG, PNG, WebP).');
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const maxDim = 400;
        let w = img.width;
        let h = img.height;
        if (w > maxDim || h > maxDim) {
          if (w > h) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          } else {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, w, h);
          callback(canvas.toDataURL('image/jpeg', 0.88));
        } else {
          callback(event.target?.result as string);
        }
      };
      img.onerror = () => onError('Failed to load image.');
      img.src = event.target?.result as string;
    };
    reader.onerror = () => onError('Failed to read file.');
    reader.readAsDataURL(file);
  };

  const handleOpenPhotoModal = (emp: any) => {
    setPhotoModalEmployee(emp);
    setPhotoPreview(emp.avatarUrl || null);
    setPhotoModalError(null);
    setPhotoModalSuccess(null);
  };

  const handleSaveTeammatePhoto = async () => {
    if (!photoModalEmployee || !photoPreview) return;
    setIsSavingPhoto(true);
    setPhotoModalError(null);
    try {
      await api.updateEmployeeAvatar(photoModalEmployee.id, photoPreview);
      setPhotoModalSuccess('Teammate profile picture updated successfully!');
      await loadData();
      setTimeout(() => {
        setPhotoModalEmployee(null);
        setPhotoModalSuccess(null);
      }, 1500);
    } catch (err: any) {
      setPhotoModalError(err.message || 'Failed to update teammate photo');
    } finally {
      setIsSavingPhoto(false);
    }
  };

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
        role: 'EMPLOYEE',
        avatarUrl: ''
      });
      await loadData();
    } catch (err: any) {
      setModalError(err.message || 'Failed to create employee');
    } finally {
      setIsSubmitting(false);
    }
  };

  const roleBadges: Record<string, string> = {
    SUPER_ADMIN: 'bg-purple-100 text-purple-900 border-purple-300 font-bold',
    ADMIN: 'bg-indigo-100 text-indigo-900 border-indigo-300 font-bold',
    MANAGER: 'bg-amber-100 text-amber-900 border-amber-300 font-bold',
    EMPLOYEE: 'bg-emerald-100 text-emerald-900 border-emerald-300 font-bold'
  };

  const filteredEmployees = employees.filter((e) => {
    const q = searchTerm.toLowerCase();
    return (
      e.fullName?.toLowerCase().includes(q) ||
      e.email?.toLowerCase().includes(q) ||
      e.employee_code?.toLowerCase().includes(q) ||
      e.job_title?.toLowerCase().includes(q) ||
      e.department_name?.toLowerCase().includes(q) ||
      e.team_name?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header with professional corporate styling */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2 text-blue-600 font-bold text-xs uppercase tracking-wider mb-1">
            <Users2 className="w-4 h-4 text-blue-600" />
            <span>Colleagues & Corporate Hierarchy</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight font-display">
            Workforce Directory & Teams
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Browse teammate profiles, manage profile pictures, and assign organizational units.
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={() => setIsAddEmployeeModalOpen(true)}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md shadow-blue-500/20 transition flex items-center gap-2 cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Onboard Colleague</span>
          </button>
        )}
      </div>

      {/* Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-indigo-100 pb-3">
        <div className="flex items-center gap-6 text-xs font-bold font-display">
          <button
            onClick={() => setActiveTab('employees')}
            className={`pb-2.5 flex items-center gap-2 border-b-2 transition cursor-pointer ${
              activeTab === 'employees'
                ? 'border-indigo-600 text-indigo-600 font-extrabold'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <UserCheck className="w-4 h-4" />
            <span>Workforce Directory ({filteredEmployees.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('org_structure')}
            className={`pb-2.5 flex items-center gap-2 border-b-2 transition cursor-pointer ${
              activeTab === 'org_structure'
                ? 'border-indigo-600 text-indigo-600 font-extrabold'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <Building className="w-4 h-4" />
            <span>Departments & Squads</span>
          </button>
        </div>

        {activeTab === 'employees' && (
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-indigo-500 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Filter by name, code, dept..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              className="w-full pl-9 pr-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs"
            />
          </div>
        )}
      </div>

      {/* Tab 1: Workforce Directory Table */}
      {activeTab === 'employees' && (
        <div className="bg-white rounded-2xl border border-indigo-100/90 shadow-md shadow-slate-100/50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gradient-to-r from-slate-50 to-indigo-50/40 text-slate-500 font-bold uppercase tracking-wider border-b border-indigo-100 font-display">
                <tr>
                  <th className="px-4 py-3.5">Colleague & Picture</th>
                  <th className="px-4 py-3.5">Code</th>
                  <th className="px-4 py-3.5">Role / Title</th>
                  <th className="px-4 py-3.5">Department</th>
                  <th className="px-4 py-3.5">Squad</th>
                  <th className="px-4 py-3.5">Security Level</th>
                  <th className="px-4 py-3.5">Attendance</th>
                  <th className="px-4 py-3.5 text-right">Photo Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-indigo-50/80 text-slate-700 font-medium">
                {filteredEmployees.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-12 text-slate-400">
                      No colleagues found matching "{searchTerm}".
                    </td>
                  </tr>
                ) : (
                  filteredEmployees
                    .slice((page - 1) * 10, page * 10)
                    .map((e) => (
                      <tr key={e.id} className="hover:bg-indigo-50/30 transition">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            {/* Avatar with live photo */}
                            <div
                              onClick={() => handleOpenPhotoModal(e)}
                              className="relative group cursor-pointer shrink-0"
                              title="Click to update teammate picture"
                            >
                              {e.avatarUrl ? (
                                <img
                                  src={e.avatarUrl}
                                  alt={e.fullName}
                                  className="w-10 h-10 rounded-xl object-cover ring-2 ring-indigo-500/20 shadow-xs"
                                />
                              ) : (
                                <div className="w-10 h-10 rounded-xl bg-slate-900 text-blue-300 font-bold text-xs flex items-center justify-center shadow-xs border border-slate-700">
                                  {e.first_name?.[0]}
                                  {e.last_name?.[0]}
                                </div>
                              )}
                              <div className="absolute inset-0 bg-slate-900/60 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                                <Camera className="w-4 h-4" />
                              </div>
                            </div>
                            <div className="min-w-0">
                              <div className="font-bold text-slate-900 text-xs truncate">
                                {e.first_name} {e.last_name}
                              </div>
                              <div className="text-[11px] text-slate-400 flex items-center gap-1 truncate">
                                <Mail className="w-3 h-3 text-indigo-400" />
                                {e.email}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 font-mono font-bold text-indigo-700">
                          {e.employee_code}
                        </td>
                        <td className="px-4 py-3 text-slate-800 font-semibold">{e.job_title}</td>
                        <td className="px-4 py-3 text-slate-600">
                          <span className="px-2 py-0.5 rounded-lg bg-slate-100 border border-slate-200/80 text-[11px]">
                            {e.department_name || 'Enterprise'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          <span className="px-2 py-0.5 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-700 text-[11px] font-semibold">
                            {e.team_name || 'Core Operations'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] uppercase tracking-wider font-extrabold border ${roleBadges[e.role] || roleBadges.EMPLOYEE}`}>
                            {e.role}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {e.todayClockIn ? (
                            <span className="inline-flex items-center gap-1.5 text-[11px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                              Clocked In
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-400 font-medium bg-slate-50 px-2 py-0.5 rounded-full border border-slate-200">
                              <span className="w-2 h-2 rounded-full bg-slate-300" />
                              Not Present
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => handleOpenPhotoModal(e)}
                            className="px-2.5 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold transition flex items-center gap-1 ml-auto cursor-pointer"
                            title="Upload or change teammate profile picture"
                          >
                            <Camera className="w-3.5 h-3.5" />
                            <span>{e.avatarUrl ? 'Change' : 'Upload Pic'}</span>
                          </button>
                        </td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>
          </div>

          <Pagination
            currentPage={page}
            totalItems={filteredEmployees.length}
            pageSize={10}
            onPageChange={setPage}
            itemLabel="teammates"
          />
        </div>
      )}

      {/* Tab 2: Departments & Squads Structure */}
      {activeTab === 'org_structure' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {departments.map((dept) => {
            const deptTeams = teams.filter((t) => t.department_id === dept.id);
            return (
              <div
                key={dept.id}
                className="bg-white rounded-2xl border border-indigo-100 p-5 shadow-xs space-y-4 hover:shadow-md transition"
              >
                <div className="flex items-center justify-between pb-3 border-b border-indigo-50">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white shadow-xs">
                      <Building className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-900">{dept.name}</h3>
                      <p className="text-xs text-slate-500">{dept.code} • {dept.description}</p>
                    </div>
                  </div>
                  <span className="text-xs font-extrabold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
                    {dept.memberCount || 0} Staff
                  </span>
                </div>

                <div className="space-y-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 font-display">
                    Specialized Squads:
                  </span>
                  {deptTeams.length === 0 ? (
                    <div className="text-xs text-slate-400 italic">No squads created in this department.</div>
                  ) : (
                    deptTeams.map((t) => (
                      <div
                        key={t.id}
                        className="p-3 bg-gradient-to-r from-indigo-50/40 to-purple-50/20 rounded-xl border border-indigo-100/70 flex items-center justify-between"
                      >
                        <div>
                          <div className="text-xs font-bold text-slate-800">{t.name}</div>
                          <div className="text-[11px] text-slate-500">{t.description}</div>
                        </div>
                        <span className="text-[11px] text-indigo-700 font-bold bg-white px-2 py-0.5 rounded-lg border border-indigo-100 shadow-2xs">
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

      {/* TEAMMATE PHOTO UPLOAD MODAL */}
      <Modal
        isOpen={Boolean(photoModalEmployee)}
        onClose={() => setPhotoModalEmployee(null)}
        maxWidth="max-w-md"
      >
        {photoModalEmployee && (
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full overflow-hidden">
            <div className="relative bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-900 p-5 text-white">
              <button
                onClick={() => setPhotoModalEmployee(null)}
                className="absolute top-4 right-4 p-1.5 rounded-full bg-white/20 hover:bg-white/30 text-white transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-2">
                <Camera className="w-5 h-5 text-blue-300" />
                <h3 className="text-base font-bold">Teammate Profile Picture</h3>
              </div>
              <p className="text-xs text-blue-200/80 mt-1">
                Upload or update photo for {photoModalEmployee.first_name} {photoModalEmployee.last_name}
              </p>
            </div>

            <div className="p-6 space-y-5">
              {photoModalSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-xl flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <span>{photoModalSuccess}</span>
                </div>
              )}
              {photoModalError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold rounded-xl flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
                  <span>{photoModalError}</span>
                </div>
              )}

              {/* Photo preview container */}
              <div className="flex flex-col items-center justify-center text-center">
                <div
                  onClick={() => photoInputRef.current?.click()}
                  className="w-32 h-32 rounded-2xl overflow-hidden ring-4 ring-indigo-500/20 shadow-xl border border-indigo-100 flex items-center justify-center bg-gradient-to-tr from-indigo-600 to-purple-600 text-white font-bold text-3xl cursor-pointer group relative"
                >
                  {photoPreview ? (
                    <img
                      src={photoPreview}
                      alt="Teammate photo"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span>
                      {photoModalEmployee.first_name?.[0]}
                      {photoModalEmployee.last_name?.[0]}
                    </span>
                  )}
                  <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white">
                    <Camera className="w-6 h-6 mb-1" />
                    <span className="text-[10px] font-bold">Change Image</span>
                  </div>
                </div>

                <div className="mt-4">
                  <input
                    type="file"
                    ref={photoInputRef}
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        processImage(
                          e.target.files[0],
                          (dataUrl) => setPhotoPreview(dataUrl),
                          (err) => setPhotoModalError(err)
                        );
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => photoInputRef.current?.click()}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm transition flex items-center gap-2 cursor-pointer mx-auto"
                  >
                    <Upload className="w-4 h-4" />
                    <span>Choose File from Device</span>
                  </button>
                  <p className="text-[11px] text-slate-400 mt-2">
                    Supports JPG, PNG, WebP up to 8MB. Resized automatically.
                  </p>
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setPhotoModalEmployee(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveTeammatePhoto}
                  disabled={isSavingPhoto || !photoPreview}
                  className="px-5 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white text-xs font-bold rounded-xl shadow-md shadow-indigo-500/20 transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSavingPhoto ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Saving Photo...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Save Profile Picture</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Onboard Employee Modal */}
      <Modal
        isOpen={isAddEmployeeModalOpen}
        onClose={() => setIsAddEmployeeModalOpen(false)}
        maxWidth="max-w-lg"
      >
        <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full overflow-hidden">
            <div className="px-6 py-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-900 text-white flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold">Onboard New Colleague</h3>
                <p className="text-xs text-blue-200/80">Create workspace identity and assign squads</p>
              </div>
              <button
                onClick={() => setIsAddEmployeeModalOpen(false)}
                className="p-1 rounded-full bg-white/20 hover:bg-white/30 text-white transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateEmployee} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              {modalError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold rounded-xl flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{modalError}</span>
                </div>
              )}

              {/* Photo selection preview */}
              <div className="flex items-center gap-4 p-3 bg-indigo-50/50 rounded-xl border border-indigo-100">
                <div
                  onClick={() => newEmpPhotoRef.current?.click()}
                  className="w-16 h-16 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-xl cursor-pointer overflow-hidden relative group shrink-0"
                >
                  {newEmployee.avatarUrl ? (
                    <img src={newEmployee.avatarUrl} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <Camera className="w-6 h-6" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="text-xs font-bold text-slate-800">Teammate Profile Picture</div>
                  <div className="text-[11px] text-slate-500">Optional: select a photo to personalize this colleague.</div>
                  <input
                    type="file"
                    ref={newEmpPhotoRef}
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        processImage(
                          e.target.files[0],
                          (dataUrl) => setNewEmployee((prev) => ({ ...prev, avatarUrl: dataUrl })),
                          (err) => setModalError(err)
                        );
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => newEmpPhotoRef.current?.click()}
                    className="mt-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer flex items-center gap-1"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Select Profile Picture</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Employee Code</label>
                  <input
                    type="text"
                    required
                    placeholder="EMP-010"
                    value={newEmployee.employeeCode}
                    onChange={(e) => setNewEmployee({ ...newEmployee, employeeCode: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Corporate Role</label>
                  <select
                    value={newEmployee.role}
                    onChange={(e) => setNewEmployee({ ...newEmployee, role: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="EMPLOYEE">Employee</option>
                    <option value="MANAGER">Team Lead / Manager</option>
                    <option value="ADMIN">Administrator</option>
                    {user?.role === 'SUPER_ADMIN' && <option value="SUPER_ADMIN">Super Administrator</option>}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">First Name</label>
                  <input
                    type="text"
                    required
                    placeholder="Alex"
                    value={newEmployee.firstName}
                    onChange={(e) => setNewEmployee({ ...newEmployee, firstName: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Last Name</label>
                  <input
                    type="text"
                    required
                    placeholder="Vance"
                    value={newEmployee.lastName}
                    onChange={(e) => setNewEmployee({ ...newEmployee, lastName: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Enterprise Email</label>
                <input
                  type="email"
                  required
                  placeholder="alex.vance@mcgate.tech"
                  value={newEmployee.email}
                  onChange={(e) => setNewEmployee({ ...newEmployee, email: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Initial Password</label>
                <input
                  type="password"
                  required
                  value={newEmployee.password}
                  onChange={(e) => setNewEmployee({ ...newEmployee, password: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Designated Job Title</label>
                <input
                  type="text"
                  required
                  placeholder="Senior Cloud Systems Architect"
                  value={newEmployee.jobTitle}
                  onChange={(e) => setNewEmployee({ ...newEmployee, jobTitle: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Department</label>
                  <select
                    value={newEmployee.departmentId}
                    onChange={(e) => setNewEmployee({ ...newEmployee, departmentId: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Squad / Team</label>
                  <select
                    value={newEmployee.teamId}
                    onChange={(e) => setNewEmployee({ ...newEmployee, teamId: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md shadow-blue-500/20 cursor-pointer"
                >
                  Onboard Colleague
                </button>
              </div>
            </form>
          </div>
        </Modal>
    </div>
  );
};
