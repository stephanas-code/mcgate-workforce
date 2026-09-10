import { Router } from 'express';
import { queryAll } from '../db.ts';
import { authenticateToken, AuthRequest } from '../auth.ts';

const router = Router();

router.get('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const q = (req.query.q as string || '').trim();
    if (!q || q.length < 2) {
      return res.json({ employees: [], tasks: [], assignments: [], projects: [], teams: [] });
    }

    const term = `%${q}%`;
    const userRole = req.user?.role;
    const userEmpId = req.user?.employeeId || 0;
    const userTeamId = req.user?.teamId || 0;

    // Search Employees
    const employees = await queryAll(`
      SELECT e.id, e.employee_code, e.first_name, e.last_name, e.job_title, d.name as department_name
      FROM employees e
      LEFT JOIN departments d ON d.id = e.department_id
      WHERE e.first_name LIKE ? OR e.last_name LIKE ? OR e.employee_code LIKE ? OR e.job_title LIKE ?
      LIMIT 8
    `, [term, term, term, term]);

    // Search Tasks (Scoped by RBAC if Employee)
    let taskSql = `
      SELECT t.id, t.task_code, t.title, t.priority, t.status, p.name as project_name
      FROM tasks t
      JOIN projects p ON p.id = t.project_id
      WHERE (t.title LIKE ? OR t.task_code LIKE ? OR t.description LIKE ?)
    `;
    const taskParams: any[] = [term, term, term];

    if (userRole === 'EMPLOYEE') {
      taskSql += ' AND (t.assigned_employee_id = ? OR t.team_id = ?)';
      taskParams.push(userEmpId, userTeamId);
    }
    taskSql += ' LIMIT 8';
    const tasks = await queryAll(taskSql, taskParams);

    // Search Assignments
    const assignments = await queryAll(`
      SELECT a.id, a.title, a.priority, a.status, p.name as project_name
      FROM assignments a
      JOIN projects p ON p.id = a.project_id
      WHERE a.title LIKE ? OR a.description LIKE ?
      LIMIT 8
    `, [term, term]);

    // Search Projects
    const projects = await queryAll(`
      SELECT id, code, name, status, start_date
      FROM projects
      WHERE name LIKE ? OR code LIKE ? OR description LIKE ?
      LIMIT 8
    `, [term, term, term]);

    // Search Teams
    const teams = await queryAll(`
      SELECT t.id, t.name, d.name as department_name
      FROM teams t
      JOIN departments d ON d.id = t.department_id
      WHERE t.name LIKE ?
      LIMIT 8
    `, [term]);

    res.json({
      employees,
      tasks,
      assignments,
      projects,
      teams
    });
  } catch (err) {
    res.status(500).json({ error: 'Search failed.' });
  }
});

export default router;
