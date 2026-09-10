import { Router } from 'express';
import { queryOne, queryAll, execute } from '../db.ts';
import { authenticateToken, requireRoles, AuthRequest } from '../auth.ts';
import { createNotification } from '../notifications.ts';
import { logAudit } from '../audit.ts';

const router = Router();

// 1. Get assignments with auto-calculated progress
router.get('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { projectId, teamId } = req.query;
    const conditions: string[] = [];
    const params: any[] = [];

    if (projectId) {
      conditions.push('a.project_id = ?');
      params.push(projectId);
    }
    if (teamId) {
      conditions.push('a.assigned_team_id = ?');
      params.push(teamId);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const assignments = await queryAll<{
      id: number;
      project_id: number;
      title: string;
      description: string;
      assigned_team_id: number | null;
      lead_employee_id: number | null;
      priority: string;
      status: string;
      start_date: string;
      due_date: string;
      created_at: string;
      project_name: string;
      project_code: string;
      team_name: string | null;
      lead_first: string | null;
      lead_last: string | null;
    }>(`
      SELECT 
        a.*,
        p.name as project_name,
        p.code as project_code,
        t.name as team_name,
        e.first_name as lead_first,
        e.last_name as lead_last
      FROM assignments a
      JOIN projects p ON p.id = a.project_id
      LEFT JOIN teams t ON t.id = a.assigned_team_id
      LEFT JOIN employees e ON e.id = a.lead_employee_id
      ${whereClause}
      ORDER BY a.created_at DESC
    `, params);

    // Fetch tasks counts for each assignment to calculate progress
    const enriched = await Promise.all(assignments.map(async (a) => {
      const stats = await queryOne<{ total: number; completed: number }>(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) as completed
        FROM tasks
        WHERE assignment_id = ?
      `, [a.id]);

      const totalTasks = stats?.total || 0;
      const completedTasks = stats?.completed || 0;
      const progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

      return {
        ...a,
        leadName: a.lead_first ? `${a.lead_first} ${a.lead_last}` : 'Unassigned',
        totalTasks,
        completedTasks,
        progressPercent,
        progressText: `${completedTasks}/${totalTasks} tasks completed — ${progressPercent}%`
      };
    }));

    res.json(enriched);
  } catch (err: any) {
    console.error('Fetch assignments error:', err);
    res.status(500).json({ error: 'Failed to retrieve assignments.' });
  }
});

// 2. Get single assignment with task list
router.get('/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const assignment = await queryOne<any>(`
      SELECT 
        a.*,
        p.name as project_name,
        p.code as project_code,
        t.name as team_name,
        e.first_name as lead_first,
        e.last_name as lead_last
      FROM assignments a
      JOIN projects p ON p.id = a.project_id
      LEFT JOIN teams t ON t.id = a.assigned_team_id
      LEFT JOIN employees e ON e.id = a.lead_employee_id
      WHERE a.id = ?
    `, [id]);

    if (!assignment) {
      return res.status(404).json({ error: 'Assignment not found.' });
    }

    const tasks = await queryAll(`
      SELECT t.*, e.first_name, e.last_name
      FROM tasks t
      LEFT JOIN employees e ON e.id = t.assigned_employee_id
      WHERE t.assignment_id = ?
      ORDER BY t.created_at ASC
    `, [id]);

    const totalTasks = tasks.length;
    const completedTasks = tasks.filter((t: any) => t.status === 'COMPLETED').length;
    const progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    res.json({
      ...assignment,
      leadName: assignment.lead_first ? `${assignment.lead_first} ${assignment.lead_last}` : 'Unassigned',
      totalTasks,
      completedTasks,
      progressPercent,
      tasks
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve assignment.' });
  }
});

// 3. Create assignment (Admins / Managers)
router.post('/', authenticateToken, requireRoles('SUPER_ADMIN', 'ADMIN', 'MANAGER'), async (req: AuthRequest, res) => {
  try {
    const {
      projectId,
      title,
      description,
      assignedTeamId,
      leadEmployeeId,
      priority = 'MEDIUM',
      startDate,
      dueDate
    } = req.body;

    if (!projectId || !title || !dueDate) {
      return res.status(400).json({ error: 'Project ID, title, and due date are required.' });
    }

    const now = new Date().toISOString();
    const { lastInsertRowid: assignmentId } = await execute(`
      INSERT INTO assignments (
        project_id, title, description, assigned_team_id, lead_employee_id, priority, status, start_date, due_date, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'IN_PROGRESS', ?, ?, ?, ?)
    `, [
      projectId,
      title.trim(),
      description || '',
      assignedTeamId || null,
      leadEmployeeId || null,
      priority,
      startDate || now.split('T')[0],
      dueDate,
      now,
      now
    ]);

    if (leadEmployeeId) {
      const lead = await queryOne<{ user_id: number }>('SELECT user_id FROM employees WHERE id = ?', [leadEmployeeId]);
      if (lead) {
        await createNotification({
          userId: lead.user_id,
          title: 'Assignment Lead Designation',
          message: `You have been named lead on assignment: "${title}".`,
          type: 'ASSIGNMENT_CREATED',
          link: '/assignments'
        });
      }
    }

    await logAudit({
      userId: req.user!.id,
      userName: req.user!.fullName || req.user!.email,
      userRole: req.user!.role,
      action: 'ASSIGNMENT_CREATED',
      resource: 'ASSIGNMENT',
      resourceId: assignmentId,
      ipAddress: req.ip,
      afterValue: `Created assignment: ${title}`
    });

    res.status(201).json({
      success: true,
      message: 'Assignment created successfully',
      assignmentId
    });
  } catch (err: any) {
    console.error('Create assignment error:', err);
    res.status(500).json({ error: 'Failed to create assignment.' });
  }
});

// 4. Update assignment
router.patch('/:id', authenticateToken, requireRoles('SUPER_ADMIN', 'ADMIN', 'MANAGER'), async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const { title, description, assignedTeamId, leadEmployeeId, priority, status, dueDate } = req.body;

    const updates: string[] = [];
    const params: any[] = [];
    const now = new Date().toISOString();

    if (title) { updates.push('title = ?'); params.push(title.trim()); }
    if (description !== undefined) { updates.push('description = ?'); params.push(description); }
    if (assignedTeamId !== undefined) { updates.push('assigned_team_id = ?'); params.push(assignedTeamId); }
    if (leadEmployeeId !== undefined) { updates.push('lead_employee_id = ?'); params.push(leadEmployeeId); }
    if (priority) { updates.push('priority = ?'); params.push(priority); }
    if (status) { updates.push('status = ?'); params.push(status); }
    if (dueDate) { updates.push('due_date = ?'); params.push(dueDate); }

    if (updates.length > 0) {
      updates.push('updated_at = ?');
      params.push(now);
      params.push(id);

      await execute(`UPDATE assignments SET ${updates.join(', ')} WHERE id = ?`, params);
    }

    res.json({ success: true, message: 'Assignment updated successfully.' });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update assignment.' });
  }
});

export default router;
