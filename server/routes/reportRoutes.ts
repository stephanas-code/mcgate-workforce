import { Router } from 'express';
import { queryOne, queryAll } from '../db.ts';
import { authenticateToken, requireRoles, type AuthRequest } from '../auth.ts';

const router = Router();

// 1. Attendance analytics and summary
router.get('/attendance', authenticateToken, requireRoles('SUPER_ADMIN', 'ADMIN', 'MANAGER'), async (_req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    // Summary counters
    const totalRecords = await queryOne<{ count: number }>('SELECT COUNT(*) as count FROM attendance');
    const completedRecords = await queryOne<{ count: number }>("SELECT COUNT(*) as count FROM attendance WHERE status = 'COMPLETED'");
    const openRecords = await queryOne<{ count: number }>("SELECT COUNT(*) as count FROM attendance WHERE clock_out_time IS NULL AND date < ?", [today]);
    const lateRecords = await queryOne<{ count: number }>("SELECT COUNT(*) as count FROM attendance WHERE status = 'LATE'");
    const correctedRecords = await queryOne<{ count: number }>('SELECT COUNT(*) as count FROM attendance WHERE is_manually_corrected = 1');

    // Department breakdown
    const byDept = await queryAll<{
      department_name: string;
      total_sessions: number;
      total_completed: number;
      open_sessions: number;
      late_count: number;
    }>(`
      SELECT 
        d.name as department_name,
        COUNT(a.id) as total_sessions,
        SUM(CASE WHEN a.status = 'COMPLETED' THEN 1 ELSE 0 END) as total_completed,
        SUM(CASE WHEN a.clock_out_time IS NULL THEN 1 ELSE 0 END) as open_sessions,
        SUM(CASE WHEN a.status = 'LATE' THEN 1 ELSE 0 END) as late_count
      FROM departments d
      JOIN employees e ON e.department_id = d.id
      JOIN attendance a ON a.employee_id = e.id
      GROUP BY d.id
      ORDER BY total_sessions DESC
    `);

    // Top employees by attendance hours
    const topEmployees = await queryAll<{
      employee_name: string;
      department_name: string;
      total_minutes: number;
      sessions_count: number;
    }>(`
      SELECT 
        (e.first_name || ' ' || e.last_name) as employee_name,
        d.name as department_name,
        SUM(COALESCE(a.duration_minutes, 0)) as total_minutes,
        COUNT(a.id) as sessions_count
      FROM employees e
      LEFT JOIN departments d ON d.id = e.department_id
      JOIN attendance a ON a.employee_id = e.id
      GROUP BY e.id
      ORDER BY total_minutes DESC
      LIMIT 10
    `);

    res.json({
      summary: {
        totalSessions: totalRecords?.count || 0,
        completedSessions: completedRecords?.count || 0,
        missingClockOuts: openRecords?.count || 0,
        lateArrivals: lateRecords?.count || 0,
        manuallyCorrected: correctedRecords?.count || 0
      },
      byDepartment: byDept,
      topEmployees: topEmployees.map(e => ({
        ...e,
        totalHoursFormatted: `${Math.floor(e.total_minutes / 60)}h ${e.total_minutes % 60}m`
      }))
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate attendance report.' });
  }
});

// 2. Task productivity analytics
router.get('/tasks', authenticateToken, async (_req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    const stats = await queryOne<{
      total: number;
      completed: number;
      in_progress: number;
      blocked: number;
      in_review: number;
      todo: number;
      overdue: number;
      total_estimated: number;
      total_actual: number;
    }>(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'IN_PROGRESS' THEN 1 ELSE 0 END) as in_progress,
        SUM(CASE WHEN status = 'BLOCKED' THEN 1 ELSE 0 END) as blocked,
        SUM(CASE WHEN status = 'IN_REVIEW' THEN 1 ELSE 0 END) as in_review,
        SUM(CASE WHEN status = 'TODO' THEN 1 ELSE 0 END) as todo,
        SUM(CASE WHEN due_date < '${today}' AND status NOT IN ('COMPLETED', 'CANCELLED') THEN 1 ELSE 0 END) as overdue,
        SUM(COALESCE(estimated_hours, 0)) as total_estimated,
        SUM(COALESCE(actual_hours, 0)) as total_actual
      FROM tasks
    `);

    const total = stats?.total || 0;
    const completed = stats?.completed || 0;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    // By Project
    const byProject = await queryAll<{
      project_name: string;
      project_code: string;
      total: number;
      completed: number;
      overdue: number;
    }>(`
      SELECT 
        p.name as project_name,
        p.code as project_code,
        COUNT(t.id) as total,
        SUM(CASE WHEN t.status = 'COMPLETED' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN t.due_date < '${today}' AND t.status NOT IN ('COMPLETED', 'CANCELLED') THEN 1 ELSE 0 END) as overdue
      FROM projects p
      LEFT JOIN tasks t ON t.project_id = p.id
      GROUP BY p.id
      ORDER BY total DESC
    `);

    // Workload by Employee
    const byEmployee = await queryAll<{
      employee_name: string;
      job_title: string;
      assigned_tasks: number;
      completed_tasks: number;
      in_progress_tasks: number;
      overdue_tasks: number;
    }>(`
      SELECT 
        (e.first_name || ' ' || e.last_name) as employee_name,
        e.job_title,
        COUNT(t.id) as assigned_tasks,
        SUM(CASE WHEN t.status = 'COMPLETED' THEN 1 ELSE 0 END) as completed_tasks,
        SUM(CASE WHEN t.status = 'IN_PROGRESS' THEN 1 ELSE 0 END) as in_progress_tasks,
        SUM(CASE WHEN t.due_date < '${today}' AND t.status NOT IN ('COMPLETED', 'CANCELLED') THEN 1 ELSE 0 END) as overdue_tasks
      FROM employees e
      LEFT JOIN tasks t ON t.assigned_employee_id = e.id
      GROUP BY e.id
      ORDER BY assigned_tasks DESC
    `);

    res.json({
      summary: {
        total,
        completed,
        inProgress: stats?.in_progress || 0,
        blocked: stats?.blocked || 0,
        inReview: stats?.in_review || 0,
        todo: stats?.todo || 0,
        overdue: stats?.overdue || 0,
        completionRate,
        totalEstimatedHours: stats?.total_estimated || 0,
        totalActualHours: stats?.total_actual || 0
      },
      byProject: byProject.map(p => ({
        ...p,
        rate: p.total > 0 ? Math.round((p.completed / p.total) * 100) : 0
      })),
      byEmployee
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate task reports.' });
  }
});

// 3. Export to CSV (Attendance, Tasks, or Assignments)
router.get('/export', authenticateToken, requireRoles('SUPER_ADMIN', 'ADMIN', 'MANAGER'), async (req: AuthRequest, res) => {
  try {
    const type = req.query.type as string; // 'attendance' | 'tasks' | 'assignments'

    if (type === 'attendance') {
      const records = await queryAll<{
        date: string;
        first_name: string;
        last_name: string;
        employee_code: string;
        department: string;
        clock_in_time: string;
        clock_out_time: string | null;
        duration_formatted: string | null;
        status: string;
        is_manually_corrected: number;
      }>(`
        SELECT 
          a.date, e.first_name, e.last_name, e.employee_code,
          d.name as department,
          a.clock_in_time, a.clock_out_time, a.duration_formatted,
          a.status, a.is_manually_corrected
        FROM attendance a
        JOIN employees e ON e.id = a.employee_id
        LEFT JOIN departments d ON d.id = e.department_id
        ORDER BY a.date DESC
      `);

      let csv = 'Date,Employee Code,Employee Name,Department,Clock In,Clock Out,Duration,Status,Manually Corrected\n';
      for (const r of records) {
        const inStr = r.clock_in_time ? new Date(r.clock_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
        const outStr = r.clock_out_time ? new Date(r.clock_out_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'No Clock-out';
        csv += `"${r.date}","${r.employee_code}","${r.first_name} ${r.last_name}","${r.department || ''}","${inStr}","${outStr}","${r.duration_formatted || '—'}","${r.status}","${r.is_manually_corrected ? 'Yes' : 'No'}"\n`;
      }

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="mcgate_attendance_report.csv"');
      return res.send(csv);
    }

    if (type === 'tasks') {
      const tasks = await queryAll<{
        task_code: string;
        title: string;
        project_name: string;
        assignee_name: string | null;
        priority: string;
        status: string;
        due_date: string;
        estimated_hours: number;
        actual_hours: number;
      }>(`
        SELECT 
          t.task_code, t.title, p.name as project_name,
          (e.first_name || ' ' || e.last_name) as assignee_name,
          t.priority, t.status, t.due_date, t.estimated_hours, t.actual_hours
        FROM tasks t
        JOIN projects p ON p.id = t.project_id
        LEFT JOIN employees e ON e.id = t.assigned_employee_id
        ORDER BY t.created_at DESC
      `);

      let csv = 'Task Code,Title,Project,Assignee,Priority,Status,Due Date,Est Hours,Act Hours\n';
      for (const t of tasks) {
        csv += `"${t.task_code}","${t.title.replace(/"/g, '""')}","${t.project_name}","${t.assignee_name || 'Unassigned'}","${t.priority}","${t.status}","${t.due_date}",${t.estimated_hours},${t.actual_hours}\n`;
      }

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="mcgate_tasks_report.csv"');
      return res.send(csv);
    }

    res.status(400).json({ error: 'Valid export types are "attendance" or "tasks".' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to export report data.' });
  }
});

export default router;
