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

  // Check if we need to seed initial data
  const userCount = await queryOne<{ count: number }>('SELECT COUNT(*) as count FROM users');
  if (!userCount || userCount.count === 0) {
    console.log('Seeding initial McGate Technologies database...');
    await seedInitialData();
  } else {
    // Seed initial project documents if table is empty
    const docCount = await queryOne<{ count: number }>('SELECT COUNT(*) as count FROM project_documents');
    if (!docCount || docCount.count === 0) {
      await seedProjectDocuments();
    }
  }
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

  // 4. Initial Users & Employees
  // Roles: SUPER_ADMIN, ADMIN, MANAGER, EMPLOYEE
  const usersToCreate = [
    {
      email: 'admin@mcgate.tech',
      role: 'SUPER_ADMIN',
      firstName: 'Marcus',
      lastName: 'Vance',
      jobTitle: 'Chief Technology Officer & Director',
      code: 'MGT-001',
      deptId: 1,
      teamId: 1,
      phone: '+49 30 555-0100',
    },
    {
      email: 'hr@mcgate.tech',
      role: 'ADMIN',
      firstName: 'Elena',
      lastName: 'Rostova',
      jobTitle: 'Head of Human Resources',
      code: 'MGT-002',
      deptId: 6,
      teamId: 5,
      phone: '+49 30 555-0102',
    },
    {
      email: 'lead.eng@mcgate.tech',
      role: 'MANAGER',
      firstName: 'David',
      lastName: 'Chen',
      jobTitle: 'Engineering Lead & Solutions Architect',
      code: 'MGT-003',
      deptId: 1,
      teamId: 1,
      phone: '+49 30 555-0103',
    },
    {
      email: 'lead.sec@mcgate.tech',
      role: 'MANAGER',
      firstName: 'Sarah',
      lastName: 'Al-Mansoor',
      jobTitle: 'Security Operations Lead',
      code: 'MGT-004',
      deptId: 2,
      teamId: 3,
      phone: '+49 30 555-0104',
    },
    {
      email: 'john.doe@mcgate.tech',
      role: 'EMPLOYEE',
      firstName: 'John',
      lastName: 'Doe',
      jobTitle: 'Senior Systems Engineer',
      code: 'MGT-005',
      deptId: 1,
      teamId: 1,
      phone: '+49 30 555-0105',
    },
    {
      email: 'jane.smith@mcgate.tech',
      role: 'EMPLOYEE',
      firstName: 'Jane',
      lastName: 'Smith',
      jobTitle: 'Cloud Security Analyst',
      code: 'MGT-006',
      deptId: 2,
      teamId: 3,
      phone: '+49 30 555-0106',
    },
    {
      email: 'alex.rivera@mcgate.tech',
      role: 'EMPLOYEE',
      firstName: 'Alex',
      lastName: 'Rivera',
      jobTitle: 'DevOps & Site Reliability Engineer',
      code: 'MGT-007',
      deptId: 3,
      teamId: 4,
      phone: '+49 30 555-0107',
    },
    {
      email: 'stephenosanebi@gmail.com', // Matching current user email from metadata!
      role: 'SUPER_ADMIN',
      firstName: 'Stephen',
      lastName: 'Osanebi',
      jobTitle: 'Principal Platform Architect',
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

  // 5. Projects
  const projects = [
    {
      code: 'PRJ-STOREPRO',
      name: 'StorePro Enterprise Platform Deployment',
      desc: 'Next-generation cloud architecture, high-availability e-commerce gateway, and microservice infrastructure.',
      managerId: 3,
      deptId: 1,
      status: 'ACTIVE',
      startDate: '2026-08-01',
      targetDate: '2026-11-30'
    },
    {
      code: 'PRJ-ZERO-TRUST',
      name: 'Corporate Zero-Trust Network & IAM Architecture',
      desc: 'Enforcing hardware token 2FA, dynamic policy access, endpoint encryption, and automated compliance logging.',
      managerId: 4,
      deptId: 2,
      status: 'ACTIVE',
      startDate: '2026-07-15',
      targetDate: '2026-10-15'
    },
    {
      code: 'PRJ-INFRA-MIGRATE',
      name: 'Kubernetes Cluster 2.0 Modernization',
      desc: 'Upgrading core clusters to managed multi-region control planes with automated failover and telemetry metrics.',
      managerId: 3,
      deptId: 3,
      status: 'PLANNING',
      startDate: '2026-09-01',
      targetDate: '2026-12-15'
    }
  ];

  for (const p of projects) {
    await executeBatch([
      `INSERT INTO projects (code, name, description, manager_id, department_id, status, start_date, expected_completion_date, created_at, updated_at)
       VALUES ('${p.code}', '${p.name}', '${p.desc}', ${p.managerId}, ${p.deptId}, '${p.status}', '${p.startDate}', '${p.targetDate}', '${now}', '${now}');`
    ]);
  }

  // 6. Assignments
  const assignments = [
    {
      projectId: 1,
      title: 'StorePro Production Deployment',
      desc: 'Complete production readiness checklist and rollout for the StorePro enterprise client cluster.',
      teamId: 4,
      leadId: 3,
      priority: 'URGENT',
      status: 'IN_PROGRESS',
      startDate: '2026-09-01',
      dueDate: '2026-09-20'
    },
    {
      projectId: 2,
      title: 'Perimeter Firewall & Ingress Hardening',
      desc: 'Audit edge firewall rules, inspect ingress proxies, and seal internal staging tunnels.',
      teamId: 3,
      leadId: 4,
      priority: 'HIGH',
      status: 'IN_PROGRESS',
      startDate: '2026-09-05',
      dueDate: '2026-09-25'
    }
  ];

  for (const a of assignments) {
    await executeBatch([
      `INSERT INTO assignments (project_id, title, description, assigned_team_id, lead_employee_id, priority, status, start_date, due_date, created_at, updated_at)
       VALUES (${a.projectId}, '${a.title}', '${a.desc}', ${a.teamId}, ${a.leadId}, '${a.priority}', '${a.status}', '${a.startDate}', '${a.dueDate}', '${now}', '${now}');`
    ]);
  }

  // 7. Tasks
  const tasks = [
    {
      code: 'TSK-101',
      assignmentId: 1,
      projectId: 1,
      title: 'Configure production server & container clusters',
      desc: 'Provision redundant nodes with autoscaling groups and node pools across availability zones.',
      assignedEmpId: 5, // John Doe
      assignedByUserId: 3, // David Chen
      deptId: 1,
      teamId: 1,
      priority: 'HIGH',
      status: 'COMPLETED',
      dueDate: '2026-09-08',
      estHours: 12,
      actHours: 11.5,
      completedAt: '2026-09-08T16:20:00Z'
    },
    {
      code: 'TSK-102',
      assignmentId: 1,
      projectId: 1,
      title: 'Configure firewall rules for StorePro',
      desc: 'Audit and restrict incoming ingress ports, verify HTTPS termination certificates, and enable DDoS shield.',
      assignedEmpId: 6, // Jane Smith
      assignedByUserId: 4, // Sarah Al-Mansoor
      deptId: 2,
      teamId: 3,
      priority: 'URGENT',
      status: 'IN_PROGRESS',
      dueDate: '2026-09-12',
      estHours: 8,
      actHours: 4.5,
      completedAt: null
    },
    {
      code: 'TSK-103',
      assignmentId: 1,
      projectId: 1,
      title: 'Deploy backend microservices and API gateways',
      desc: 'Deploy v2.4.1 container images, verify secrets decryption, and test health check endpoints.',
      assignedEmpId: 5, // John Doe
      assignedByUserId: 3, // David Chen
      deptId: 1,
      teamId: 1,
      priority: 'HIGH',
      status: 'IN_PROGRESS',
      dueDate: '2026-09-14',
      estHours: 16,
      actHours: 6.0,
      completedAt: null
    },
    {
      code: 'TSK-104',
      assignmentId: 1,
      projectId: 1,
      title: 'Configure and warm production database read replicas',
      desc: 'Provision PostgreSQL read replica pool, configure connection pool limits, and run migration checks.',
      assignedEmpId: 7, // Alex Rivera
      assignedByUserId: 3, // David Chen
      deptId: 3,
      teamId: 4,
      priority: 'MEDIUM',
      status: 'IN_REVIEW',
      dueDate: '2026-09-15',
      estHours: 10,
      actHours: 9.5,
      completedAt: null
    },
    {
      code: 'TSK-105',
      assignmentId: 1,
      projectId: 1,
      title: 'Test application end-to-end resilience and latency',
      desc: 'Run synthetic load tests with 5,000 simulated concurrent requests; measure p99 response times.',
      assignedEmpId: 5, // John Doe
      assignedByUserId: 3,
      deptId: 1,
      teamId: 1,
      priority: 'MEDIUM',
      status: 'TODO',
      dueDate: '2026-09-18',
      estHours: 14,
      actHours: 0,
      completedAt: null
    },
    {
      code: 'TSK-106',
      assignmentId: 1,
      projectId: 1,
      title: 'Configure APM monitoring, dashboards, and PagerDuty routing',
      desc: 'Set up Grafana alerts, log ingestion filters, and critical incident escalation rules.',
      assignedEmpId: 7, // Alex Rivera
      assignedByUserId: 3,
      deptId: 3,
      teamId: 4,
      priority: 'MEDIUM',
      status: 'TODO',
      dueDate: '2026-09-19',
      estHours: 8,
      actHours: 0,
      completedAt: null
    },
    // An overdue task for demonstration:
    {
      code: 'TSK-100',
      assignmentId: 2,
      projectId: 2,
      title: 'Rotate legacy API credentials and renew root certificates',
      desc: 'Expiring SSL/TLS certificates on bastion host must be replaced with ACME automated renewals.',
      assignedEmpId: 6, // Jane Smith
      assignedByUserId: 4,
      deptId: 2,
      teamId: 3,
      priority: 'URGENT',
      status: 'IN_PROGRESS',
      dueDate: '2026-09-08', // Passed date! Shows 🔴 OVERDUE
      estHours: 6,
      actHours: 3,
      completedAt: null
    }
  ];

  for (const t of tasks) {
    await executeBatch([
      `INSERT INTO tasks (
        task_code, assignment_id, project_id, title, description, assigned_employee_id,
        assigned_by_user_id, department_id, team_id, priority, status, start_date, due_date,
        estimated_hours, actual_hours, completed_at, created_at, updated_at
      ) VALUES (
        '${t.code}', ${t.assignmentId}, ${t.projectId}, '${t.title}', '${t.desc}', ${t.assignedEmpId},
        ${t.assignedByUserId}, ${t.deptId}, ${t.teamId}, '${t.priority}', '${t.status}', '2026-09-02',
        '${t.dueDate}', ${t.estHours}, ${t.actHours}, ${t.completedAt ? `'${t.completedAt}'` : 'NULL'},
        '${now}', '${now}'
      );`
    ]);
  }

  // 8. Historical Attendance Records
  // We'll create attendance for past few days:
  // Sep 7, Sep 8, Sep 9
  // And today (Sep 10) - let's make some clocked in, some not clocked in, some with open sessions!
  const attendances = [
    // Sep 7
    { empId: 5, date: '2026-09-07', inTime: '2026-09-07T08:51:00Z', outTime: '2026-09-07T17:02:00Z', mins: 491, fmt: '8h 11m', status: 'COMPLETED' },
    { empId: 6, date: '2026-09-07', inTime: '2026-09-07T08:30:00Z', outTime: '2026-09-07T17:15:00Z', mins: 525, fmt: '8h 45m', status: 'COMPLETED' },
    { empId: 7, date: '2026-09-07', inTime: '2026-09-07T09:12:00Z', outTime: '2026-09-07T17:30:00Z', mins: 498, fmt: '8h 18m', status: 'LATE' },

    // Sep 8 - Employee 5 forgot to clock out! Exactly the prompt example: "Sep 8 | 08:37 | — | — | No Clock-out"
    { empId: 5, date: '2026-09-08', inTime: '2026-09-08T08:37:00Z', outTime: null, mins: null, fmt: null, status: 'NO_CLOCK_OUT' },
    { empId: 6, date: '2026-09-08', inTime: '2026-09-08T08:25:00Z', outTime: '2026-09-08T17:00:00Z', mins: 515, fmt: '8h 35m', status: 'COMPLETED' },
    { empId: 7, date: '2026-09-08', inTime: '2026-09-08T08:44:00Z', outTime: '2026-09-08T17:10:00Z', mins: 506, fmt: '8h 26m', status: 'COMPLETED' },

    // Sep 9 - Prompt example: "Sep 9 | 08:42 | 17:15 | 8h 33m | Complete"
    { empId: 5, date: '2026-09-09', inTime: '2026-09-09T08:42:00Z', outTime: '2026-09-09T17:15:00Z', mins: 513, fmt: '8h 33m', status: 'COMPLETED' },
    { empId: 6, date: '2026-09-09', inTime: '2026-09-09T08:15:00Z', outTime: '2026-09-09T16:50:00Z', mins: 515, fmt: '8h 35m', status: 'COMPLETED' },
    { empId: 7, date: '2026-09-09', inTime: '2026-09-09T08:35:00Z', outTime: null, mins: null, fmt: null, status: 'NO_CLOCK_OUT' },

    // Today (2026-09-10)
    // Jane Smith is clocked in (PRESENT)
    { empId: 6, date: '2026-09-10', inTime: '2026-09-10T08:01:00Z', outTime: null, mins: null, fmt: null, status: 'PRESENT' },
    // David Chen is clocked in
    { empId: 3, date: '2026-09-10', inTime: '2026-09-10T08:20:00Z', outTime: null, mins: null, fmt: null, status: 'PRESENT' },
    // Elena Rostova clocked in and clocked out already
    { empId: 2, date: '2026-09-10', inTime: '2026-09-10T07:45:00Z', outTime: '2026-09-10T12:30:00Z', mins: 285, fmt: '4h 45m', status: 'COMPLETED' },
    // Notice John Doe (Employee 5) and Alex Rivera (Employee 7) haven't clocked in today yet!
    // This allows testing the live CLOCK IN button immediately when logged in as John Doe or Stephen!
  ];

  for (let i = 0; i < attendances.length; i++) {
    const att = attendances[i];
    const sessId = `sess-seed-${att.empId}-${att.date}`;
    await executeBatch([
      `INSERT INTO attendance (
        employee_id, date, clock_in_time, clock_out_time, duration_minutes, duration_formatted,
        ip_address, device_info, location_info, status, work_session_id, is_manually_corrected,
        created_at, updated_at
      ) VALUES (
        ${att.empId}, '${att.date}', '${att.inTime}', ${att.outTime ? `'${att.outTime}'` : 'NULL'},
        ${att.mins !== null ? att.mins : 'NULL'}, ${att.fmt ? `'${att.fmt}'` : 'NULL'},
        '192.168.10.42', 'Chrome 128 / macOS 15.0', 'HQ Campus - Frankfurt',
        '${att.status}', '${sessId}', 0, '${att.inTime}', '${now}'
      );`
    ]);

    const attRow = await queryOne<{ id: number }>(`SELECT id FROM attendance WHERE work_session_id = '${sessId}'`);
    if (attRow) {
      await executeBatch([
        `INSERT INTO work_sessions (session_id, employee_id, attendance_id, start_time, end_time, status, created_at)
         VALUES ('${sessId}', ${att.empId}, ${attRow.id}, '${att.inTime}', ${att.outTime ? `'${att.outTime}'` : 'NULL'},
         '${att.outTime ? 'CLOSED' : 'ACTIVE'}', '${att.inTime}');`
      ]);
    }
  }

  // 9. Notifications
  const notifications = [
    {
      userId: 5, // John Doe
      title: 'New Task Assignment',
      message: 'You have been assigned a new task: Configure production server & container clusters for StorePro.',
      type: 'TASK_ASSIGNED',
      link: '/tasks'
    },
    {
      userId: 5,
      title: 'Daily Attendance Reminder',
      message: 'Good morning, John! Please remember to clock in for your workday session.',
      type: 'ATTENDANCE_REMINDER',
      link: '/attendance'
    },
    {
      userId: 6, // Jane Smith
      title: 'Task Overdue Notice',
      message: 'Task "Rotate legacy API credentials" is now overdue. Please update its status or reach out to your lead.',
      type: 'TASK_OVERDUE',
      link: '/tasks'
    },
    {
      userId: 3, // David Chen (Lead)
      title: 'Task Ready for Review',
      message: 'Alex Rivera submitted "Configure and warm production database read replicas" for team review.',
      type: 'REVIEW_REQUESTED',
      link: '/tasks'
    }
  ];

  for (const n of notifications) {
    await executeBatch([
      `INSERT INTO notifications (user_id, title, message, type, link, is_read, created_at)
       VALUES (${n.userId}, '${n.title}', '${n.message}', '${n.type}', '${n.link}', 0, '${now}');`
    ]);
  }

  // 10. Audit logs
  const auditLogs = [
    {
      userId: 1,
      userName: 'Marcus Vance',
      userRole: 'SUPER_ADMIN',
      action: 'SYSTEM_INITIALIZED',
      resource: 'SYSTEM',
      resourceId: 'SYS-INIT',
      ip: '127.0.0.1',
      before: null,
      after: 'Initialized McGate Technologies Platform with core departments and RBAC rules'
    },
    {
      userId: 1,
      userName: 'Marcus Vance',
      userRole: 'SUPER_ADMIN',
      action: 'PROJECT_CREATED',
      resource: 'PROJECT',
      resourceId: 'PRJ-STOREPRO',
      ip: '192.168.1.10',
      before: null,
      after: 'Created project StorePro Enterprise Platform Deployment'
    },
    {
      userId: 3,
      userName: 'David Chen',
      userRole: 'MANAGER',
      action: 'TASK_ASSIGNED',
      resource: 'TASK',
      resourceId: 'TSK-101',
      ip: '192.168.1.25',
      before: 'UNASSIGNED',
      after: 'Assigned to John Doe (MGT-005)'
    }
  ];

  for (const al of auditLogs) {
    await executeBatch([
      `INSERT INTO audit_logs (user_id, user_name, user_role, action, resource, resource_id, ip_address, before_value, after_value, created_at)
       VALUES (${al.userId}, '${al.userName}', '${al.userRole}', '${al.action}', '${al.resource}', '${al.resourceId}', '${al.ip}', ${al.before ? `'${al.before}'` : 'NULL'}, '${al.after}', '${now}');`
    ]);
  }

  await seedProjectDocuments();

  console.log('Database initialized and seeded successfully.');
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

