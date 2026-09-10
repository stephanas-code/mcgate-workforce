const TOKEN_KEY = 'mcgate_auth_token';

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearStoredToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {})
  };

  const response = await fetch(url, {
    ...options,
    headers
  });

  const contentType = response.headers.get('content-type');
  let data: any = null;
  if (contentType && contentType.includes('application/json')) {
    data = await response.json();
  } else if (contentType && contentType.includes('text/csv')) {
    data = await response.text();
  }

  if (!response.ok) {
    const errorMsg = data?.error || data?.message || `Request failed with status ${response.status}`;
    throw new Error(errorMsg);
  }

  return data as T;
}

export const api = {
  // Auth
  login: (credentials: { email: string; password?: string }) =>
    request<{ token: string; user: any; message: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials)
    }),

  switchDemo: (email: string) =>
    request<{ token: string; user: any; message: string }>('/api/auth/switch-demo', {
      method: 'POST',
      body: JSON.stringify({ email })
    }),

  getDemoUsers: () => request<any[]>('/api/auth/demo-users'),

  getMe: () => request<{ user: any }>('/api/auth/me'),

  forgotPassword: (email: string) =>
    request<{ message: string }>('/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email })
    }),

  resetPassword: (payload: { currentPassword: string; newPassword: string }) =>
    request<{ message: string }>('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),

  // Attendance
  clockIn: (location?: string) =>
    request<{ success: boolean; message: string; record: any }>('/api/attendance/clock-in', {
      method: 'POST',
      body: JSON.stringify({ location })
    }),

  clockOut: () =>
    request<{ success: boolean; message: string; record: any }>('/api/attendance/clock-out', {
      method: 'POST'
    }),

  getMyAttendance: (filter = 'all', startDate?: string, endDate?: string) => {
    let url = `/api/attendance/me?filter=${filter}`;
    if (startDate && endDate) url += `&startDate=${startDate}&endDate=${endDate}`;
    return request<{ today: any; history: any[] }>(url);
  },

  getLiveAttendance: () =>
    request<{
      today: string;
      metrics: {
        totalEmployees: number;
        clockedIn: number;
        notClockedIn: number;
        clockedOut: number;
        currentlyActive: number;
        lateArrivals: number;
        unclosedSessionsCount: number;
      };
      records: any[];
      openPastSessions: any[];
    }>('/api/attendance/live'),

  correctAttendance: (payload: { attendanceId: number; clockOutTime?: string; reason: string }) =>
    request<{ success: boolean; message: string; record: any }>('/api/attendance/correct', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),

  // Tasks
  getTasks: (filters?: {
    status?: string;
    priority?: string;
    projectId?: string | number;
    assignmentId?: string | number;
    employeeId?: string | number;
    search?: string;
    limit?: number;
  }) => {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, val]) => {
        if (val !== undefined && val !== '') params.append(key, String(val));
      });
    }
    return request<any[]>(`/api/tasks?${params.toString()}`);
  },

  getTaskById: (id: number) => request<any>(`/api/tasks/${id}`),

  createTask: (data: any) =>
    request<{ success: boolean; message: string; taskId: number; taskCode: string }>('/api/tasks', {
      method: 'POST',
      body: JSON.stringify(data)
    }),

  updateTask: (id: number, data: any) =>
    request<{ success: boolean; message: string }>(`/api/tasks/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    }),

  deleteTask: (id: number) =>
    request<{ success: boolean; message: string }>(`/api/tasks/${id}`, {
      method: 'DELETE'
    }),

  addTaskComment: (taskId: number, payload: { message: string; mentions?: string[] }) =>
    request<{ success: boolean; comment: any }>(`/api/tasks/${taskId}/comments`, {
      method: 'POST',
      body: JSON.stringify(payload)
    }),

  addTaskAttachment: (taskId: number, payload: { filename: string; fileSize?: number; fileType?: string; fileUrl?: string }) =>
    request<{ success: boolean; attachment: any }>(`/api/tasks/${taskId}/attachments`, {
      method: 'POST',
      body: JSON.stringify(payload)
    }),

  // Assignments
  getAssignments: (filters?: { projectId?: string | number; teamId?: string | number }) => {
    const params = new URLSearchParams();
    if (filters?.projectId) params.append('projectId', String(filters.projectId));
    if (filters?.teamId) params.append('teamId', String(filters.teamId));
    return request<any[]>(`/api/assignments?${params.toString()}`);
  },

  getAssignmentById: (id: number) => request<any>(`/api/assignments/${id}`),

  createAssignment: (data: any) =>
    request<{ success: boolean; message: string; assignmentId: number }>('/api/assignments', {
      method: 'POST',
      body: JSON.stringify(data)
    }),

  updateAssignment: (id: number, data: any) =>
    request<{ success: boolean; message: string }>(`/api/assignments/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    }),

  // Projects
  getProjects: () => request<any[]>('/api/projects'),

  getProjectById: (id: number) => request<any>(`/api/projects/${id}`),

  generateProjectCode: (name: string) =>
    request<{ code: string }>(`/api/projects/generate-code?name=${encodeURIComponent(name)}`),

  createProject: (data: any) =>
    request<{ success: boolean; message: string; projectId: number; code?: string; documentsCount?: number }>('/api/projects', {
      method: 'POST',
      body: JSON.stringify(data)
    }),

  getProjectDocuments: (projectId: number) =>
    request<any[]>(`/api/projects/${projectId}/documents`),

  getProjectDocumentById: (projectId: number, docId: number) =>
    request<any>(`/api/projects/${projectId}/documents/${docId}`),

  uploadProjectDocuments: (projectId: number, documents: any[]) =>
    request<{ success: boolean; message: string; documents: any[] }>(`/api/projects/${projectId}/documents`, {
      method: 'POST',
      body: JSON.stringify({ documents })
    }),

  deleteProjectDocument: (projectId: number, docId: number) =>
    request<{ success: boolean; message: string }>(`/api/projects/${projectId}/documents/${docId}`, {
      method: 'DELETE'
    }),

  // Teams & Employees
  getDepartments: () => request<any[]>('/api/departments'),
  createDepartment: (data: any) => request<any>('/api/departments', { method: 'POST', body: JSON.stringify(data) }),
  getTeams: () => request<any[]>('/api/teams'),
  createTeam: (data: any) => request<any>('/api/teams', { method: 'POST', body: JSON.stringify(data) }),
  getEmployees: () => request<any[]>('/api/employees'),
  createEmployee: (data: any) => request<any>('/api/employees', { method: 'POST', body: JSON.stringify(data) }),

  // Reports
  getAttendanceReport: (from?: string, to?: string) => {
    const params = new URLSearchParams();
    if (from) params.append('from', from);
    if (to) params.append('to', to);
    return request<any>(`/api/reports/attendance?${params.toString()}`);
  },
  getTasksReport: () => request<any>('/api/reports/tasks'),
  exportCsv: async (type: 'attendance' | 'tasks', from?: string, to?: string) => {
    const token = getStoredToken();
    const params = new URLSearchParams({ type });
    if (from) params.append('from', from);
    if (to) params.append('to', to);
    const res = await fetch(`/api/reports/export?${params.toString()}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    });
    if (!res.ok) throw new Error('Export failed');
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mcgate_${type}_export.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  },
  exportAttendanceCsv: (from?: string, to?: string) => {
    return api.exportCsv('attendance', from, to);
  },
  exportTasksCsv: () => {
    return api.exportCsv('tasks');
  },

  // Audit Logs
  getAuditLogs: (filters?: { resource?: string; action?: string; limit?: number }) => {
    const params = new URLSearchParams();
    if (filters?.resource) params.append('resource', filters.resource);
    if (filters?.action) params.append('action', filters.action);
    if (filters?.limit) params.append('limit', String(filters.limit));
    return request<any[]>(`/api/audit-logs?${params.toString()}`);
  },

  // Notifications
  getNotifications: () => request<{ unreadCount: number; notifications: any[] }>('/api/notifications'),
  markNotificationRead: (id: number) => request<any>(`/api/notifications/${id}/read`, { method: 'PATCH' }),
  markAllNotificationsRead: () => request<any>('/api/notifications/read-all', { method: 'POST' }),

  // Company Settings
  getSettings: () => request<any>('/api/settings'),
  updateSettings: (data: any) => request<any>('/api/settings', { method: 'PUT', body: JSON.stringify(data) }),

  // Global Search
  searchGlobal: (query: string) => request<any>(`/api/search?q=${encodeURIComponent(query)}`)
};
