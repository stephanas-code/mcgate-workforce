import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { queryOne, queryAll, execute } from '../db.ts';
import { authenticateToken, requireRoles, AuthRequest } from '../auth.ts';
import { logAudit } from '../audit.ts';

const router = Router();

// 1. Departments
router.get('/departments', authenticateToken, async (_req, res) => {
  try {
    const departments = await queryAll<{
      id: number;
      name: string;
      code: string;
      description: string;
      created_at: string;
      employee_count: number;
      team_count: number;
    }>(`
      SELECT 
        d.*,
        (SELECT COUNT(*) FROM employees e WHERE e.department_id = d.id) as employee_count,
        (SELECT COUNT(*) FROM teams t WHERE t.department_id = d.id) as team_count
      FROM departments d
      ORDER BY d.name ASC
    `);
    res.json(departments);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch departments.' });
  }
});

router.post('/departments', authenticateToken, requireRoles('SUPER_ADMIN', 'ADMIN'), async (req: AuthRequest, res) => {
  try {
    const { name, code, description } = req.body;
    if (!name || !code) {
      return res.status(400).json({ error: 'Department name and code are required.' });
    }

    const now = new Date().toISOString();
    const { lastInsertRowid } = await execute(`
      INSERT INTO departments (name, code, description, created_at) VALUES (?, ?, ?, ?)
    `, [name.trim(), code.toUpperCase().trim(), description || '', now]);

    await logAudit({
      userId: req.user!.id,
      userName: req.user!.fullName || req.user!.email,
      userRole: req.user!.role,
      action: 'DEPARTMENT_CREATED',
      resource: 'DEPARTMENT',
      resourceId: lastInsertRowid,
      ipAddress: req.ip,
      afterValue: `Created department ${code}: ${name}`
    });

    res.status(201).json({ success: true, departmentId: lastInsertRowid });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create department.' });
  }
});

// 2. Teams
router.get('/teams', authenticateToken, async (_req, res) => {
  try {
    const teams = await queryAll<{
      id: number;
      department_id: number;
      name: string;
      description: string;
      department_name: string;
      department_code: string;
      member_count: number;
      team_lead_first: string | null;
      team_lead_last: string | null;
    }>(`
      SELECT 
        t.*,
        d.name as department_name,
        d.code as department_code,
        e.first_name as team_lead_first,
        e.last_name as team_lead_last,
        (SELECT COUNT(*) FROM employees emp WHERE emp.team_id = t.id) as member_count
      FROM teams t
      JOIN departments d ON d.id = t.department_id
      LEFT JOIN employees e ON e.id = t.team_lead_id
      ORDER BY d.name ASC, t.name ASC
    `);
    res.json(teams);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch teams.' });
  }
});

router.post('/teams', authenticateToken, requireRoles('SUPER_ADMIN', 'ADMIN'), async (req: AuthRequest, res) => {
  try {
    const { departmentId, name, description, teamLeadId } = req.body;
    if (!departmentId || !name) {
      return res.status(400).json({ error: 'Department ID and team name are required.' });
    }

    const now = new Date().toISOString();
    const { lastInsertRowid } = await execute(`
      INSERT INTO teams (department_id, name, description, team_lead_id, created_at) VALUES (?, ?, ?, ?, ?)
    `, [departmentId, name.trim(), description || '', teamLeadId || null, now]);

    await logAudit({
      userId: req.user!.id,
      userName: req.user!.fullName || req.user!.email,
      userRole: req.user!.role,
      action: 'TEAM_CREATED',
      resource: 'TEAM',
      resourceId: lastInsertRowid,
      ipAddress: req.ip,
      afterValue: `Created team ${name} in department ${departmentId}`
    });

    res.status(201).json({ success: true, teamId: lastInsertRowid });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create team.' });
  }
});

// 3. Employees
router.get('/employees', authenticateToken, async (_req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const employees = await queryAll<{
      id: number;
      user_id: number;
      employee_code: string;
      first_name: string;
      last_name: string;
      email: string;
      role: string;
      status: string;
      job_title: string;
      phone: string | null;
      department_id: number | null;
      team_id: number | null;
      department_name: string | null;
      team_name: string | null;
      employment_status: string;
      joined_date: string;
      today_clock_in: string | null;
      today_clock_out: string | null;
      today_att_status: string | null;
    }>(`
      SELECT 
        e.*,
        u.email, u.role, u.status,
        d.name as department_name,
        t.name as team_name,
        a.clock_in_time as today_clock_in,
        a.clock_out_time as today_clock_out,
        a.status as today_att_status
      FROM employees e
      JOIN users u ON u.id = e.user_id
      LEFT JOIN departments d ON d.id = e.department_id
      LEFT JOIN teams t ON t.id = e.team_id
      LEFT JOIN attendance a ON a.employee_id = e.id AND a.date = ?
      ORDER BY e.first_name ASC
    `, [today]);

    res.json(employees.map(e => ({
      ...e,
      fullName: `${e.first_name} ${e.last_name}`,
      avatarUrl: (e as any).avatar_url,
      isClockedInToday: Boolean(e.today_clock_in),
      isCurrentlyActive: Boolean(e.today_clock_in && !e.today_clock_out)
    })));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch employees.' });
  }
});

// 4. Update Teammate / Employee Avatar (Allow teammates or admins to upload profile picture)
router.post('/employees/:id/avatar', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const employeeId = Number(req.params.id);
    const { avatarUrl } = req.body;
    if (!avatarUrl) {
      return res.status(400).json({ error: 'avatarUrl is required.' });
    }

    const emp = await queryOne<{ id: number; user_id: number; first_name: string; last_name: string }>(
      'SELECT id, user_id, first_name, last_name FROM employees WHERE id = ?',
      [employeeId]
    );

    if (!emp) {
      return res.status(404).json({ error: 'Employee not found.' });
    }

    // Permission check: user can edit their own profile, or admins/managers can update teammates
    const isSelf = req.user?.employeeId === employeeId || req.user?.id === emp.user_id;
    const isPrivileged = req.user?.role === 'SUPER_ADMIN' || req.user?.role === 'ADMIN' || req.user?.role === 'MANAGER';
    if (!isSelf && !isPrivileged) {
      return res.status(403).json({ error: 'Forbidden: You can only update your own profile picture.' });
    }

    await execute('UPDATE employees SET avatar_url = ? WHERE id = ?', [avatarUrl, employeeId]);

    await logAudit({
      userId: req.user!.id,
      userName: req.user!.fullName || req.user!.email,
      userRole: req.user!.role,
      action: 'TEAMMATE_AVATAR_UPDATE',
      resource: 'EMPLOYEE',
      resourceId: employeeId,
      ipAddress: req.ip,
      afterValue: `Updated profile picture photo for ${emp.first_name} ${emp.last_name}`
    });

    res.json({
      success: true,
      avatarUrl,
      message: 'Teammate profile picture updated successfully'
    });
  } catch (err: any) {
    console.error('Teammate avatar update failed:', err);
    res.status(500).json({ error: 'Failed to update teammate profile picture' });
  }
});

// 5. Update Employee Details
router.put('/employees/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const employeeId = Number(req.params.id);
    const { firstName, lastName, phone, jobTitle, departmentId, teamId, avatarUrl } = req.body;

    const emp = await queryOne<{ id: number; user_id: number; first_name: string; last_name: string }>(
      'SELECT id, user_id, first_name, last_name FROM employees WHERE id = ?',
      [employeeId]
    );

    if (!emp) {
      return res.status(404).json({ error: 'Employee not found.' });
    }

    const isSelf = req.user?.employeeId === employeeId || req.user?.id === emp.user_id;
    const isPrivileged = req.user?.role === 'SUPER_ADMIN' || req.user?.role === 'ADMIN';
    if (!isSelf && !isPrivileged) {
      return res.status(403).json({ error: 'Forbidden.' });
    }

    await execute(`
      UPDATE employees
      SET first_name = COALESCE(?, first_name),
          last_name = COALESCE(?, last_name),
          phone = COALESCE(?, phone),
          job_title = COALESCE(?, job_title),
          department_id = COALESCE(?, department_id),
          team_id = COALESCE(?, team_id),
          avatar_url = COALESCE(?, avatar_url)
      WHERE id = ?
    `, [firstName, lastName, phone, jobTitle, departmentId, teamId, avatarUrl, employeeId]);

    await logAudit({
      userId: req.user!.id,
      userName: req.user!.fullName || req.user!.email,
      userRole: req.user!.role,
      action: 'EMPLOYEE_UPDATED',
      resource: 'EMPLOYEE',
      resourceId: employeeId,
      ipAddress: req.ip,
      afterValue: `Updated details for ${firstName || emp.first_name} ${lastName || emp.last_name}`
    });

    res.json({ success: true, message: 'Employee updated successfully' });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update employee.' });
  }
});

// 6. Create new Employee + User (Admins / HR only)
router.post('/employees', authenticateToken, requireRoles('SUPER_ADMIN', 'ADMIN'), async (req: AuthRequest, res) => {
  try {
    const {
      email,
      password = 'password123',
      role = 'EMPLOYEE',
      firstName,
      lastName,
      jobTitle,
      departmentId,
      teamId,
      phone,
      employmentStatus = 'FULL_TIME'
    } = req.body;

    if (!email || !firstName || !lastName || !jobTitle) {
      return res.status(400).json({ error: 'Email, First Name, Last Name, and Job Title are required.' });
    }

    const existingUser = await queryOne('SELECT id FROM users WHERE email = ?', [email.trim().toLowerCase()]);
    if (existingUser) {
      return res.status(400).json({ error: 'A user with this email address already exists.' });
    }

    const passwordHash = bcrypt.hashSync(password, 10);
    const now = new Date().toISOString();

    const { lastInsertRowid: userId } = await execute(`
      INSERT INTO users (email, password_hash, role, status, created_at, updated_at)
      VALUES (?, ?, ?, 'ACTIVE', ?, ?)
    `, [email.trim().toLowerCase(), passwordHash, role, now, now]);

    const count = await queryOne<{ count: number }>('SELECT COUNT(*) as count FROM employees');
    const empCode = `MGT-${String((count?.count || 0) + 1).padStart(3, '0')}`;

    const { lastInsertRowid: empId } = await execute(`
      INSERT INTO employees (
        user_id, employee_code, first_name, last_name, phone, job_title,
        department_id, team_id, employment_status, joined_date, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      userId, empCode, firstName.trim(), lastName.trim(), phone || '', jobTitle.trim(),
      departmentId || null, teamId || null, employmentStatus, now.split('T')[0], now
    ]);

    await logAudit({
      userId: req.user!.id,
      userName: req.user!.fullName || req.user!.email,
      userRole: req.user!.role,
      action: 'USER_CREATED',
      resource: 'EMPLOYEE',
      resourceId: empId,
      ipAddress: req.ip,
      afterValue: `Created employee ${empCode} (${firstName} ${lastName}, ${role})`
    });

    res.status(201).json({
      success: true,
      message: 'Employee registered successfully',
      employeeId: empId,
      employeeCode: empCode,
      userId
    });
  } catch (err: any) {
    console.error('Create employee error:', err);
    res.status(500).json({ error: 'Failed to create employee.' });
  }
});

export default router;
