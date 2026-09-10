import { executeBatch, queryOne, getDb } from './db.ts';
import bcrypt from 'bcryptjs';

export const SCHEMA_SQL = `
-- 1. Users table
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('SUPER_ADMIN', 'ADMIN', 'MANAGER', 'EMPLOYEE')),
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE', 'INACTIVE', 'SUSPENDED')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 2. Departments table
CREATE TABLE IF NOT EXISTS departments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  code TEXT NOT NULL UNIQUE,
  description TEXT,
  head_employee_id INTEGER,
  created_at TEXT NOT NULL
);

-- 3. Teams table
CREATE TABLE IF NOT EXISTS teams (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  department_id INTEGER NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  team_lead_id INTEGER,
  description TEXT,
  created_at TEXT NOT NULL
);

-- 4. Employees table
CREATE TABLE IF NOT EXISTS employees (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  employee_code TEXT NOT NULL UNIQUE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  avatar_url TEXT,
  phone TEXT,
  job_title TEXT NOT NULL,
  department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,
  team_id INTEGER REFERENCES teams(id) ON DELETE SET NULL,
  manager_id INTEGER REFERENCES employees(id) ON DELETE SET NULL,
  employment_status TEXT NOT NULL DEFAULT 'FULL_TIME' CHECK(employment_status IN ('FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN')),
  joined_date TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- 5. Attendance table
CREATE TABLE IF NOT EXISTS attendance (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  clock_in_time TEXT NOT NULL,
  clock_out_time TEXT,
  duration_minutes INTEGER,
  duration_formatted TEXT,
  ip_address TEXT,
  device_info TEXT,
  location_info TEXT,
  status TEXT NOT NULL CHECK(status IN ('PRESENT', 'COMPLETED', 'NO_CLOCK_OUT', 'LATE', 'HALF_DAY')),
  work_session_id TEXT NOT NULL UNIQUE,
  is_manually_corrected INTEGER NOT NULL DEFAULT 0,
  corrected_by_user_id INTEGER REFERENCES users(id),
  correction_reason TEXT,
  corrected_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CONSTRAINT unq_employee_daily_attendance UNIQUE(employee_id, date)
);

-- 6. Work sessions table
CREATE TABLE IF NOT EXISTS work_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL UNIQUE,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  attendance_id INTEGER NOT NULL REFERENCES attendance(id) ON DELETE CASCADE,
  start_time TEXT NOT NULL,
  end_time TEXT,
  status TEXT NOT NULL CHECK(status IN ('ACTIVE', 'CLOSED', 'CORRECTED')),
  created_at TEXT NOT NULL
);

-- 7. Projects table
CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  manager_id INTEGER REFERENCES employees(id) ON DELETE SET NULL,
  department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'ARCHIVED')),
  start_date TEXT NOT NULL,
  expected_completion_date TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 8. Assignments table
CREATE TABLE IF NOT EXISTS assignments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  assigned_team_id INTEGER REFERENCES teams(id) ON DELETE SET NULL,
  lead_employee_id INTEGER REFERENCES employees(id) ON DELETE SET NULL,
  priority TEXT NOT NULL DEFAULT 'MEDIUM' CHECK(priority IN ('LOW', 'MEDIUM', 'HIGH', 'URGENT')),
  status TEXT NOT NULL DEFAULT 'IN_PROGRESS' CHECK(status IN ('NOT_STARTED', 'IN_PROGRESS', 'IN_REVIEW', 'COMPLETED')),
  start_date TEXT NOT NULL,
  due_date TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 9. Tasks table
CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_code TEXT NOT NULL UNIQUE,
  assignment_id INTEGER REFERENCES assignments(id) ON DELETE SET NULL,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  assigned_employee_id INTEGER REFERENCES employees(id) ON DELETE SET NULL,
  assigned_by_user_id INTEGER NOT NULL REFERENCES users(id),
  department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,
  team_id INTEGER REFERENCES teams(id) ON DELETE SET NULL,
  priority TEXT NOT NULL DEFAULT 'MEDIUM' CHECK(priority IN ('LOW', 'MEDIUM', 'HIGH', 'URGENT')),
  status TEXT NOT NULL DEFAULT 'TODO' CHECK(status IN ('TODO', 'IN_PROGRESS', 'BLOCKED', 'IN_REVIEW', 'COMPLETED', 'CANCELLED')),
  start_date TEXT,
  due_date TEXT NOT NULL,
  estimated_hours REAL DEFAULT 0,
  actual_hours REAL DEFAULT 0,
  completed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 10. Task comments
CREATE TABLE IF NOT EXISTS task_comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  author_id INTEGER NOT NULL REFERENCES users(id),
  author_name TEXT NOT NULL,
  author_role TEXT NOT NULL,
  message TEXT NOT NULL,
  mentions TEXT,
  created_at TEXT NOT NULL
);

-- 11. Task attachments
CREATE TABLE IF NOT EXISTS task_attachments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  file_type TEXT NOT NULL,
  file_url TEXT NOT NULL,
  uploaded_by_user_id INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL
);

-- 12. Task activity log
CREATE TABLE IF NOT EXISTS task_activity_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id),
  user_name TEXT NOT NULL,
  action TEXT NOT NULL,
  from_value TEXT,
  to_value TEXT,
  created_at TEXT NOT NULL
);

-- 13. Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL,
  link TEXT,
  is_read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

-- 14. Audit logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  user_name TEXT NOT NULL,
  user_role TEXT NOT NULL,
  action TEXT NOT NULL,
  resource TEXT NOT NULL,
  resource_id TEXT,
  ip_address TEXT,
  before_value TEXT,
  after_value TEXT,
  created_at TEXT NOT NULL
);

-- 15. Company settings
CREATE TABLE IF NOT EXISTS company_settings (
  id INTEGER PRIMARY KEY CHECK(id = 1),
  company_name TEXT NOT NULL DEFAULT 'McGate Technologies',
  timezone TEXT NOT NULL DEFAULT 'Europe/Berlin',
  work_start_time TEXT NOT NULL DEFAULT '08:30',
  work_end_time TEXT NOT NULL DEFAULT '17:00',
  grace_period_minutes INTEGER NOT NULL DEFAULT 15,
  working_days TEXT NOT NULL DEFAULT '["Monday","Tuesday","Wednesday","Thursday","Friday"]',
  mandatory_clock_in INTEGER NOT NULL DEFAULT 1,
  optional_clock_out INTEGER NOT NULL DEFAULT 1,
  overdue_notification_hours INTEGER NOT NULL DEFAULT 24,
  allow_manual_attendance_correction INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL
);

-- 16. Project documents
CREATE TABLE IF NOT EXISTS project_documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  original_name TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  file_extension TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_data TEXT,
  uploaded_by_user_id INTEGER NOT NULL REFERENCES users(id),
  uploaded_by_name TEXT,
  created_at TEXT NOT NULL
);

-- Indexes for high-performance querying
CREATE INDEX IF NOT EXISTS idx_attendance_employee_date ON attendance(employee_id, date);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_emp ON tasks(assigned_employee_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assignment ON tasks(assignment_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_project_documents_project ON project_documents(project_id);
`;

export async function initDatabase(): Promise<void> {
  await getDb();
  // Split statements and execute
  const statements = SCHEMA_SQL.split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0);

  await executeBatch(statements);

  // Check if we need to seed initial organization accounts
  const userCount = await queryOne<{ count: number }>('SELECT COUNT(*) as count FROM users');
  if (!userCount || userCount.count === 0) {
    console.log('Seeding initial McGate Technologies enterprise foundation...');
    await seedInitialData();
  }

  // Remove all demo accounts, leaving ONLY the Super Admin
  try {
    await executeBatch([
      "DELETE FROM users WHERE role != 'SUPER_ADMIN';",
      "DELETE FROM employees WHERE user_id NOT IN (SELECT id FROM users);"
    ]);
  } catch (e) {
    console.error('Failed to clean demo accounts:', e);
  }

  // Clear all mockup operational records so the system is clean, realtime, and deployment ready
  await clearAllMockData();
}

export async function clearAllMockData(): Promise<void> {
  const tables = [
    'task_attachments',
    'task_comments',
    'tasks',
    'assignments',
    'project_documents',
    'projects',
    'work_sessions',
    'attendance',
    'notifications',
    'audit_logs'
  ];
  for (const t of tables) {
    try {
      await executeBatch([`DELETE FROM ${t};`]);
    } catch (e) {
      console.error(`Failed to clear table ${t}:`, e);
    }
  }
  console.log('Cleared all mockup records. Database is clean, realtime, and deployment ready.');
}

export async function seedInitialData(): Promise<void> {
  const now = new Date().toISOString();
  const defaultPassword = 'password123';
  const salt = bcrypt.genSaltSync(10);
  const passwordHash = bcrypt.hashSync(defaultPassword, salt);

  // 1. Company settings
  await executeBatch([
    `INSERT OR REPLACE INTO company_settings (
      id, company_name, timezone, work_start_time, work_end_time, grace_period_minutes,
      working_days, mandatory_clock_in, optional_clock_out, overdue_notification_hours,
      allow_manual_attendance_correction, updated_at
    ) VALUES (
      1, 'McGate Technologies', 'Europe/Berlin', '08:30', '17:00', 15,
      '["Monday","Tuesday","Wednesday","Thursday","Friday"]', 1, 1, 24, 1, '${now}'
    );`
  ]);

  // 2. Departments
  const departments = [
    { name: 'Software Engineering', code: 'SWE', desc: 'Core product architecture, frontend, backend, cloud infra' },
    { name: 'Cybersecurity', code: 'SEC', desc: 'Enterprise security, identity governance, zero-trust ops' },
    { name: 'IT Infrastructure', code: 'IT', desc: 'Internal systems, networks, servers, DevOps orchestration' },
    { name: 'Sales & BD', code: 'SALES', desc: 'Client relations, enterprise contracts, partner growth' },
    { name: 'Marketing', code: 'MKT', desc: 'Brand strategy, technical communications, community outreach' },
    { name: 'Human Resources', code: 'HR', desc: 'Workforce operations, talent acquisition, people advocacy' },
    { name: 'Finance', code: 'FIN', desc: 'Corporate finance, compliance, asset allocation, payroll' },
    { name: 'Operations', code: 'OPS', desc: 'Service delivery, customer success, program management' },
  ];

  for (const dept of departments) {
    await executeBatch([
      `INSERT INTO departments (name, code, description, created_at) VALUES ('${dept.name}', '${dept.code}', '${dept.desc}', '${now}');`
    ]);
  }

  // 3. Teams
  const teams = [
    { deptId: 1, name: 'Cloud Platform Team', desc: 'Scalable services and microservices architecture' },
    { deptId: 1, name: 'Frontend Engineering', desc: 'Design system and client interfaces' },
    { deptId: 2, name: 'Threat Intelligence & SecOps', desc: 'Monitoring, zero-trust auditing, penetration analysis' },
    { deptId: 3, name: 'Infrastructure & DevOps', desc: 'CI/CD, Kubernetes, cloud governance' },
    { deptId: 6, name: 'People Ops & Attendance', desc: 'Workforce compliance and HR operations' },
  ];

  for (const team of teams) {
    await executeBatch([
      `INSERT INTO teams (department_id, name, description, created_at) VALUES (${team.deptId}, '${team.name}', '${team.desc}', '${now}');`
    ]);
  }

  // 4. Initial Users & Employees: ONLY Super Admin accounts
  const usersToCreate = [
    {
      email: 'admin@mcgate.tech',
      role: 'SUPER_ADMIN',
      firstName: 'Marcus',
      lastName: 'Vance',
      jobTitle: 'Super Administrator & Director',
      code: 'MGT-001',
      deptId: 1,
      teamId: 1,
      phone: '+49 30 555-0100',
    },
    {
      email: 'stephenosanebi@gmail.com', // Primary platform owner
      role: 'SUPER_ADMIN',
      firstName: 'Stephen',
      lastName: 'Osanebi',
      jobTitle: 'Principal Super Admin',
      code: 'MGT-000',
      deptId: 1,
      teamId: 1,
      phone: '+49 30 555-0199',
    }
  ];

  for (const u of usersToCreate) {
    const userInsert = `INSERT INTO users (email, password_hash, role, status, created_at, updated_at) 
      VALUES ('${u.email}', '${passwordHash}', '${u.role}', 'ACTIVE', '${now}', '${now}');`;
    await executeBatch([userInsert]);

    const createdUser = await queryOne<{ id: number }>(`SELECT id FROM users WHERE email = '${u.email}'`);
    if (createdUser) {
      const empInsert = `INSERT INTO employees (
        user_id, employee_code, first_name, last_name, phone, job_title, 
        department_id, team_id, manager_id, employment_status, joined_date, created_at
      ) VALUES (
        ${createdUser.id}, '${u.code}', '${u.firstName}', '${u.lastName}', '${u.phone}', '${u.jobTitle}',
        ${u.deptId}, ${u.teamId}, 1, 'FULL_TIME', '2025-01-15', '${now}'
      );`;
      await executeBatch([empInsert]);
    }
  }

  console.log('Database foundation initialized with enterprise directory.');
}

export async function seedProjectDocuments(): Promise<void> {
  const project = await queryOne<{ id: number }>('SELECT id FROM projects WHERE code = ?', ['PRJ-STOREPRO']);
  if (!project) return;

  const now = new Date().toISOString();
  const sampleDocs = [
    {
      projectId: project.id,
      filename: 'architecture_specification.md',
      originalName: 'StorePro_Architecture_Spec_v2.md',
      fileSize: 4280,
      fileExtension: 'md',
      mimeType: 'text/markdown',
      fileData: `# StorePro Enterprise Cloud Architecture Specification

## 1. Executive Summary
StorePro represents McGate Technologies' tier-1 high-throughput transaction platform.
This document outlines core infrastructural parameters, container boundaries, and API rate gates.

## 2. Infrastructure Topology
- **Edge Proxy**: Nginx 1.25 with SSL termination and mutual TLS validation.
- **Compute Cluster**: Managed Kubernetes v1.30 with multi-region cluster failover.
- **Persistence Engine**: Distributed Relational Core with strict read-replicas.

## 3. SLA & Performance Benchmarks
- Maximum API Latency P99: **< 45ms**
- Daily Peak Concurrency: **125,000 req/sec**
- Uptime Commitment: **99.995%**`,
      uploadedByUserId: 1,
      uploadedByName: 'Marcus Vance'
    },
    {
      projectId: project.id,
      filename: 'deployment_runbook.txt',
      originalName: 'StorePro_Deployment_Runbook.txt',
      fileSize: 1850,
      fileExtension: 'txt',
      mimeType: 'text/plain',
      fileData: `McGate Technologies - StorePro Deployment Runbook v3.4
======================================================
1. Pre-Deployment Verification:
   - Verify all pull requests are tagged and reviewed by engineering lead.
   - Confirm database migration scripts pass idempotency checks.
   - Notify SecOps on #sec-alerts channel.

2. Release Sequence:
   - Drain canary nodes via Kubernetes rollout command.
   - Execute db migration scripts.
   - Warm cache redis instances.
   - Switch DNS weighted routing 10% -> 50% -> 100%.

3. Rollback Procedures:
   - Revert image tag in Helm values file.
   - Issue fast-rollback command to cluster.
   - Review audit logs for discrepancies.`,
      uploadedByUserId: 3,
      uploadedByName: 'David Chen'
    },
    {
      projectId: project.id,
      filename: 'security_compliance_audit.pdf',
      originalName: 'StorePro_Security_Compliance_2026.pdf',
      fileSize: 15420,
      fileExtension: 'pdf',
      mimeType: 'application/pdf',
      fileData: 'data:application/pdf;base64,JVBERi0xLjQKJeLjz9MKMSAwIG9iajw8L1R5cGUvQ2F0YWxvZy9QYWdlcyAyIDAgUj4+ZW5kb2JqCjIgMCBvYmo8PC9UeXBlL1BhZ2VzL0NvdW50IDEvS2lkc1szIDAgUl0+PmVuZG9iagozIDAgb2JqPDwvVHlwZS9QYWdlL1BhcmVudCAyIDAgUi9NZWRpYUJveFswIDAgNjEyIDc5Ml0vQ29udGVudHMgNCAwIFI+PmVuZG9iago0IDAgb2JqPDwvTGVuZ3RoIDY4Pj5zdHJlYW0KQlQKL0YxIDI0IFRmCjEwMCA3MDAgVGRKCihtY0dhdGUgVGVjaG5vbG9naWVzIC0gU2VjdXJpdHkgQ29tcGxpYW5jZSBBdWRpdCkgVGoKRVQKZW5kc3RyZWFtCmVuZG9iagp4cmVmCjAgNQowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwMDAwMTggMDAwMDAgbiAKMDAwMDAwMDA2NiAwMDAwMCBuIAowMDAwMDAwMTIyIDAwMDAwIG4gCjAwMDAwMDAyMTMgMDAwMDAgbiAKdHJhaWxlcjw8L1NpemUgNT4+CnN0YXJ0eHJlZgoyODIKJCVFT0YK',
      uploadedByUserId: 4,
      uploadedByName: 'Sarah Al-Mansoor'
    }
  ];

  for (const doc of sampleDocs) {
    await executeBatch([
      `INSERT INTO project_documents (project_id, filename, original_name, file_size, file_extension, mime_type, file_data, uploaded_by_user_id, uploaded_by_name, created_at)
       VALUES (${doc.projectId}, '${doc.filename}', '${doc.originalName}', ${doc.fileSize}, '${doc.fileExtension}', '${doc.mimeType}', '${doc.fileData.replace(/'/g, "''")}', ${doc.uploadedByUserId}, '${doc.uploadedByName}', '${now}');`
    ]);
  }
}

