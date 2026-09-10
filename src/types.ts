export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'MANAGER' | 'EMPLOYEE';

export interface User {
  id: number;
  email: string;
  role: UserRole;
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  employeeId?: number;
  employeeCode?: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  jobTitle?: string;
  avatarUrl?: string;
  departmentId?: number;
  teamId?: number;
  departmentName?: string;
  teamName?: string;
}

export interface AttendanceRecord {
  id: number;
  date: string;
  clock_in_time: string;
  clock_out_time: string | null;
  duration_minutes: number | null;
  duration_formatted: string | null;
  status: 'PRESENT' | 'COMPLETED' | 'NO_CLOCK_OUT' | 'LATE' | 'HALF_DAY';
  work_session_id?: string;
  ip_address?: string;
  device_info?: string;
  location_info?: string;
  is_manually_corrected?: number;
  corrected_by_user_id?: number | null;
  correction_reason?: string | null;
  corrected_at?: string | null;
}

export interface LiveAttendanceEmployee {
  employeeId: number;
  employeeCode: string;
  name: string;
  jobTitle: string;
  department: string;
  team: string;
  attendanceId: number | null;
  clockInTime: string | null;
  clockOutTime: string | null;
  duration: string;
  status: string; // 'Active' | 'Completed' | 'Not Present'
  isLate: boolean;
  isManuallyCorrected: boolean;
  correctionReason: string | null;
  ipAddress: string | null;
}

export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'BLOCKED' | 'IN_REVIEW' | 'COMPLETED' | 'CANCELLED';
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export interface TaskItem {
  id: number;
  task_code: string;
  assignment_id: number | null;
  project_id: number;
  title: string;
  description: string;
  assigned_employee_id: number | null;
  assigned_by_user_id: number;
  department_id: number | null;
  team_id: number | null;
  priority: TaskPriority;
  status: TaskStatus;
  start_date: string | null;
  due_date: string;
  estimated_hours: number;
  actual_hours: number;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  assignee_first?: string | null;
  assignee_last?: string | null;
  assignee_code?: string | null;
  assigneeName?: string;
  assigner_email?: string;
  project_name?: string;
  project_code?: string;
  assignment_title?: string | null;
  department_name?: string | null;
  team_name?: string | null;
  isOverdue?: boolean;
}

export interface TaskComment {
  id: number;
  task_id: number;
  author_id: number;
  author_name: string;
  author_role: string;
  message: string;
  mentions: string | null;
  created_at: string;
}

export interface TaskAttachment {
  id: number;
  task_id: number;
  filename: string;
  file_size: number;
  file_type: string;
  file_url: string;
  uploaded_by_user_id: number;
  created_at: string;
}

export interface TaskActivity {
  id: number;
  task_id: number;
  user_id: number;
  user_name: string;
  action: string;
  from_value: string | null;
  to_value: string | null;
  created_at: string;
}

export interface AssignmentItem {
  id: number;
  project_id: number;
  title: string;
  description: string;
  assigned_team_id: number | null;
  lead_employee_id: number | null;
  priority: TaskPriority;
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'IN_REVIEW' | 'COMPLETED';
  start_date: string;
  due_date: string;
  created_at: string;
  project_name: string;
  project_code: string;
  team_name: string | null;
  leadName: string;
  totalTasks: number;
  completedTasks: number;
  progressPercent: number;
  progressText?: string;
  tasks?: TaskItem[];
}

export interface ProjectDocument {
  id: number;
  project_id: number;
  filename: string;
  original_name: string;
  file_size: number;
  file_extension: string;
  mime_type: string;
  file_data?: string;
  uploaded_by_user_id: number;
  uploaded_by_name?: string;
  created_at: string;
}

export interface ProjectItem {
  id: number;
  code: string;
  name: string;
  description: string;
  manager_id: number | null;
  department_id: number | null;
  status: 'PLANNING' | 'ACTIVE' | 'ON_HOLD' | 'COMPLETED' | 'ARCHIVED';
  start_date: string;
  expected_completion_date: string | null;
  created_at: string;
  managerName: string;
  department_name?: string;
  assignmentCount: number;
  totalTasks: number;
  completedTasks: number;
  progressPercent: number;
  documentsCount?: number;
  documents?: ProjectDocument[];
  target_date?: string | null;
  assignments?: AssignmentItem[];
  tasks?: TaskItem[];
}

export interface DepartmentItem {
  id: number;
  name: string;
  code: string;
  description: string;
  created_at: string;
  employee_count: number;
  team_count: number;
}

export interface TeamItem {
  id: number;
  department_id: number;
  name: string;
  description: string;
  department_name: string;
  department_code: string;
  member_count: number;
  team_lead_first: string | null;
  team_lead_last: string | null;
}

export interface EmployeeItem {
  id: number;
  user_id: number;
  employee_code: string;
  first_name: string;
  last_name: string;
  fullName: string;
  email: string;
  role: UserRole;
  status: string;
  job_title: string;
  phone: string | null;
  avatarUrl?: string;
  department_id: number | null;
  team_id: number | null;
  department_name: string | null;
  team_name: string | null;
  employment_status: string;
  joined_date: string;
  isClockedInToday: boolean;
  isCurrentlyActive: boolean;
  today_att_status: string | null;
}

export interface NotificationItem {
  id: number;
  user_id: number;
  title: string;
  message: string;
  type: string;
  link: string;
  is_read: number;
  created_at: string;
}

export interface AuditLogItem {
  id: number;
  user_id: number;
  user_name: string;
  user_role: string;
  action: string;
  resource: string;
  resource_id: string | null;
  ip_address: string | null;
  before_value: string | null;
  after_value: string | null;
  created_at: string;
}

export type AuditLogEntry = AuditLogItem;

export interface CompanySettings {
  id: number;
  company_name: string;
  timezone: string;
  work_start_time: string;
  work_end_time: string;
  grace_period_minutes: number;
  working_days: string;
  mandatory_clock_in: number;
  optional_clock_out: number;
  overdue_notification_hours: number;
  allow_manual_attendance_correction: number;
  updated_at: string;
}
