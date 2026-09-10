import { Router } from 'express';
import { queryOne, queryAll, execute } from '../db.ts';
import { authenticateToken, requireRoles, type AuthRequest } from '../auth.ts';
import { createNotification } from '../notifications.ts';
import { logAudit } from '../audit.ts';
import { syncMilestoneStageAndProgress } from '../milestones.ts';

const router = Router();

// Helper to check if task is overdue
function isTaskOverdue(dueDate: string, status: string): boolean {
  if (status === 'COMPLETED' || status === 'CANCELLED') return false;
  const today = new Date().toISOString().split('T')[0];
  return dueDate < today;
}

// 1. Get tasks (Enforces RBAC)
router.get('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userRole = req.user?.role;
    const userEmpId = req.user?.employeeId;
    const userDeptId = req.user?.departmentId;
    const userTeamId = req.user?.teamId;

    const { status, priority, projectId, assignmentId, employeeId, search } = req.query;

    const conditions: string[] = [];
    const params: any[] = [];

    // RBAC scoping:
    // EMPLOYEE: Can see tasks assigned to them, or tasks in their team
    if (userRole === 'EMPLOYEE') {
      if (employeeId && Number(employeeId) === userEmpId) {
        conditions.push('t.assigned_employee_id = ?');
        params.push(userEmpId);
      } else {
        conditions.push('(t.assigned_employee_id = ? OR t.team_id = ?)');
        params.push(userEmpId || 0, userTeamId || 0);
      }
    } else if (userRole === 'MANAGER') {
      // Team lead: Can view their team's tasks or their department's tasks
      if (userTeamId) {
        conditions.push('(t.team_id = ? OR t.department_id = ? OR t.assigned_by_user_id = ?)');
        params.push(userTeamId, userDeptId || 0, req.user!.id);
      }
    }

    if (status) {
      conditions.push('t.status = ?');
      params.push(status);
    }
    if (priority) {
      conditions.push('t.priority = ?');
      params.push(priority);
    }
    if (projectId) {
      conditions.push('t.project_id = ?');
      params.push(projectId);
    }
    if (assignmentId) {
      conditions.push('t.assignment_id = ?');
      params.push(assignmentId);
    }
    if (employeeId && userRole !== 'EMPLOYEE') {
      conditions.push('t.assigned_employee_id = ?');
      params.push(employeeId);
    }
    if (search) {
      conditions.push('(t.title LIKE ? OR t.description LIKE ? OR t.task_code LIKE ?)');
      const term = `%${search}%`;
      params.push(term, term, term);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const tasks = await queryAll<{
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
      priority: string;
      status: string;
      start_date: string | null;
      due_date: string;
      estimated_hours: number;
      actual_hours: number;
      completed_at: string | null;
      created_at: string;
      updated_at: string;
      assignee_first: string | null;
      assignee_last: string | null;
      assignee_code: string | null;
      assigner_email: string;
      project_name: string;
      project_code: string;
      assignment_title: string | null;
      department_name: string | null;
      team_name: string | null;
    }>(`
      SELECT 
        t.*,
        e.first_name as assignee_first,
        e.last_name as assignee_last,
        e.employee_code as assignee_code,
        u.email as assigner_email,
        p.name as project_name,
        p.code as project_code,
        a.title as assignment_title,
        d.name as department_name,
        tm.name as team_name
      FROM tasks t
      LEFT JOIN employees e ON e.id = t.assigned_employee_id
      LEFT JOIN users u ON u.id = t.assigned_by_user_id
      LEFT JOIN projects p ON p.id = t.project_id
      LEFT JOIN assignments a ON a.id = t.assignment_id
      LEFT JOIN departments d ON d.id = t.department_id
      LEFT JOIN teams tm ON tm.id = t.team_id
      ${whereClause}
      ORDER BY 
        CASE t.priority 
          WHEN 'URGENT' THEN 1 
          WHEN 'HIGH' THEN 2 
          WHEN 'MEDIUM' THEN 3 
          ELSE 4 
        END, t.due_date ASC
    `, params);

    const formattedTasks = tasks.map(t => ({
      ...t,
      isOverdue: isTaskOverdue(t.due_date, t.status),
      assigneeName: t.assignee_first ? `${t.assignee_first} ${t.assignee_last}` : 'Unassigned'
    }));

    res.json(formattedTasks);
  } catch (err: any) {
    console.error('Fetch tasks error:', err);
    res.status(500).json({ error: 'Failed to retrieve tasks.' });
  }
});

// 2. Get single task by ID with comments, attachments, activity
router.get('/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const taskId = Number(req.params.id);
    const task = await queryOne<any>(`
      SELECT 
        t.*,
        e.first_name as assignee_first,
        e.last_name as assignee_last,
        e.employee_code as assignee_code,
        u.email as assigner_email,
        p.name as project_name,
        p.code as project_code,
        a.title as assignment_title,
        d.name as department_name,
        tm.name as team_name
      FROM tasks t
      LEFT JOIN employees e ON e.id = t.assigned_employee_id
      LEFT JOIN users u ON u.id = t.assigned_by_user_id
      LEFT JOIN projects p ON p.id = t.project_id
      LEFT JOIN assignments a ON a.id = t.assignment_id
      LEFT JOIN departments d ON d.id = t.department_id
      LEFT JOIN teams tm ON tm.id = t.team_id
      WHERE t.id = ?
    `, [taskId]);

    if (!task) {
      return res.status(404).json({ error: 'Task not found.' });
    }

    const comments = await queryAll('SELECT * FROM task_comments WHERE task_id = ? ORDER BY created_at ASC', [taskId]);
    const attachments = await queryAll('SELECT * FROM task_attachments WHERE task_id = ? ORDER BY created_at DESC', [taskId]);
    const activities = await queryAll('SELECT * FROM task_activity_log WHERE task_id = ? ORDER BY created_at DESC', [taskId]);

    res.json({
      ...task,
      isOverdue: isTaskOverdue(task.due_date, task.status),
      assigneeName: task.assignee_first ? `${task.assignee_first} ${task.assignee_last}` : 'Unassigned',
      comments,
      attachments,
      activities
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch task details.' });
  }
});

// 3. Create task (Team leads in a project, Managers, Admins, Super Admins)
router.post('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const {
      title,
      description,
      projectId,
      assignmentId,
      assignedEmployeeId,
      priority = 'MEDIUM',
      dueDate,
      startDate,
      estimatedHours = 0,
      departmentId,
      teamId
    } = req.body;

    if (!title || !projectId || !dueDate) {
      return res.status(400).json({ error: 'Title, project ID, and due date are required.' });
    }

    const userRole = req.user?.role;
    const userEmpId = req.user?.employeeId;

    // Check authorization: Admins and Managers always allowed; Team Leads of this project/milestone allowed
    let isAuthorized = userRole === 'SUPER_ADMIN' || userRole === 'ADMIN' || userRole === 'MANAGER';
    if (!isAuthorized && userEmpId) {
      const prj = await queryOne<{ manager_id: number }>('SELECT manager_id FROM projects WHERE id = ?', [projectId]);
      if (prj && prj.manager_id === userEmpId) isAuthorized = true;
      if (!isAuthorized && assignmentId) {
        const asg = await queryOne<{ lead_employee_id: number }>('SELECT lead_employee_id FROM assignments WHERE id = ?', [assignmentId]);
        if (asg && asg.lead_employee_id === userEmpId) isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      return res.status(403).json({ error: 'Permission denied. Only team leads, project managers, or administrators can create and assign tasks.' });
    }

    const taskCount = await queryOne<{ count: number }>('SELECT COUNT(*) as count FROM tasks');
    const taskCode = `TSK-${(taskCount?.count || 0) + 101}`;
    const now = new Date().toISOString();

    const { lastInsertRowid: taskId } = await execute(`
      INSERT INTO tasks (
        task_code, assignment_id, project_id, title, description, assigned_employee_id,
        assigned_by_user_id, department_id, team_id, priority, status, start_date, due_date,
        estimated_hours, actual_hours, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'TODO', ?, ?, ?, 0, ?, ?)
    `, [
      taskCode,
      assignmentId || null,
      projectId,
      title.trim(),
      description || '',
      assignedEmployeeId || null,
      req.user!.id,
      departmentId || null,
      teamId || null,
      priority,
      startDate || now.split('T')[0],
      dueDate,
      estimatedHours,
      now,
      now
    ]);

    // Record activity
    await execute(`
      INSERT INTO task_activity_log (task_id, user_id, user_name, action, from_value, to_value, created_at)
      VALUES (?, ?, ?, 'TASK_CREATED', NULL, 'Created task', ?)
    `, [taskId, req.user!.id, req.user!.fullName || req.user!.email, now]);

    // Automatically synchronize milestone stage and priority-weighted progress
    if (assignmentId) {
      await syncMilestoneStageAndProgress(Number(assignmentId));
    }

    // If assigned, send notification to employee's user account
    if (assignedEmployeeId) {
      const emp = await queryOne<{ user_id: number; first_name: string; last_name: string }>(
        'SELECT user_id, first_name, last_name FROM employees WHERE id = ?',
        [assignedEmployeeId]
      );
      if (emp) {
        await createNotification({
          userId: emp.user_id,
          title: 'New Task Assignment',
          message: `You have been assigned a new task: "${title}" (Priority: ${priority}) by ${req.user!.fullName || req.user!.email}.`,
          type: 'TASK_ASSIGNED',
          link: '/tasks'
        });
      }
    }

    await logAudit({
      userId: req.user!.id,
      userName: req.user!.fullName || req.user!.email,
      userRole: req.user!.role,
      action: 'TASK_CREATED',
      resource: 'TASK',
      resourceId: taskId,
      ipAddress: req.ip,
      afterValue: `Created task ${taskCode}: ${title} (Priority: ${priority}${assignmentId ? `, Milestone: ${assignmentId}` : ''})`
    });

    res.status(201).json({
      success: true,
      message: 'Task created successfully',
      taskId,
      taskCode
    });
  } catch (err: any) {
    console.error('Task creation error:', err);
    res.status(500).json({ error: 'Failed to create task.' });
  }
});

// 4. Update task / change status / reassign (Admins have right to reassign tasks to other teammates)
router.patch('/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const taskId = Number(req.params.id);
    const existing = await queryOne<any>('SELECT * FROM tasks WHERE id = ?', [taskId]);
    if (!existing) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const userRole = req.user?.role;
    const userEmpId = req.user?.employeeId;
    const isAdmin = userRole === 'SUPER_ADMIN' || userRole === 'ADMIN';

    // RBAC validation:
    // If EMPLOYEE: can only update their own assigned task's status, actual_hours, or submit for review
    if (userRole === 'EMPLOYEE' && existing.assigned_employee_id !== userEmpId) {
      return res.status(403).json({ error: 'You are only authorized to update tasks assigned to you.' });
    }

    const {
      title,
      description,
      status,
      priority,
      assignmentId,
      assignedEmployeeId,
      dueDate,
      estimatedHours,
      actualHours
    } = req.body;

    const updates: string[] = [];
    const params: any[] = [];
    const now = new Date().toISOString();
    let statusOrPriorityChanged = false;

    // Check status change
    if (status && status !== existing.status) {
      updates.push('status = ?');
      params.push(status);
      statusOrPriorityChanged = true;

      if (status === 'COMPLETED') {
        updates.push('completed_at = ?');
        params.push(now);
      }

      // Record in task_activity_log
      await execute(`
        INSERT INTO task_activity_log (task_id, user_id, user_name, action, from_value, to_value, created_at)
        VALUES (?, ?, ?, 'STATUS_CHANGE', ?, ?, ?)
      `, [taskId, req.user!.id, req.user!.fullName || req.user!.email, existing.status, status, now]);

      // Notify manager/assigner if submitted or completed
      if (status === 'COMPLETED' || status === 'IN_REVIEW') {
        await createNotification({
          userId: existing.assigned_by_user_id,
          title: status === 'COMPLETED' ? 'Task Completed' : 'Task Submitted for Review',
          message: `${req.user!.fullName || 'An employee'} has marked task "${existing.title}" as ${status}.`,
          type: status === 'COMPLETED' ? 'TASK_COMPLETED' : 'REVIEW_REQUESTED',
          link: '/tasks'
        });
      }
    }

    // Managers, Team Leads, and Admins can reassign, change title, priority, milestone, due date
    if (userRole !== 'EMPLOYEE' || isAdmin) {
      if (title) { updates.push('title = ?'); params.push(title.trim()); }
      if (description !== undefined) { updates.push('description = ?'); params.push(description); }
      if (priority && priority !== existing.priority) {
        updates.push('priority = ?');
        params.push(priority);
        statusOrPriorityChanged = true;
      }
      if (dueDate) { updates.push('due_date = ?'); params.push(dueDate); }
      if (estimatedHours !== undefined) { updates.push('estimated_hours = ?'); params.push(estimatedHours); }

      // Milestone reassignment
      if (assignmentId !== undefined && assignmentId !== existing.assignment_id) {
        updates.push('assignment_id = ?');
        params.push(assignmentId ? Number(assignmentId) : null);
        statusOrPriorityChanged = true;
      }

      // Reassigning task to other teammates (Admins and Team Leads)
      if (assignedEmployeeId !== undefined && assignedEmployeeId !== existing.assigned_employee_id) {
        updates.push('assigned_employee_id = ?');
        params.push(assignedEmployeeId || null);

        await execute(`
          INSERT INTO task_activity_log (task_id, user_id, user_name, action, from_value, to_value, created_at)
          VALUES (?, ?, ?, 'REASSIGNED', ?, ?, ?)
        `, [taskId, req.user!.id, req.user!.fullName || req.user!.email, String(existing.assigned_employee_id), String(assignedEmployeeId), now]);

        if (assignedEmployeeId) {
          const emp = await queryOne<{ user_id: number }>('SELECT user_id FROM employees WHERE id = ?', [assignedEmployeeId]);
          if (emp) {
            await createNotification({
              userId: emp.user_id,
              title: 'Task Reassigned to You',
              message: `Task "${existing.title}" has been reassigned to you by ${req.user!.fullName || req.user!.email}.`,
              type: 'TASK_ASSIGNED',
              link: '/tasks'
            });
          }
        }
      }
    }

    if (actualHours !== undefined) {
      updates.push('actual_hours = ?');
      params.push(actualHours);
    }

    if (updates.length > 0) {
      updates.push('updated_at = ?');
      params.push(now);
      params.push(taskId);

      await execute(`UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`, params);
    }

    // Automatically recalculate milestone progress and stage if priority, status, or milestone changed
    if (statusOrPriorityChanged) {
      const newAssignmentId = assignmentId !== undefined ? (assignmentId ? Number(assignmentId) : null) : existing.assignment_id;
      if (existing.assignment_id && existing.assignment_id !== newAssignmentId) {
        await syncMilestoneStageAndProgress(existing.assignment_id);
      }
      if (newAssignmentId) {
        await syncMilestoneStageAndProgress(newAssignmentId);
      }
    }

    await logAudit({
      userId: req.user!.id,
      userName: req.user!.fullName || req.user!.email,
      userRole: req.user!.role,
      action: 'TASK_UPDATED',
      resource: 'TASK',
      resourceId: taskId,
      ipAddress: req.ip,
      beforeValue: `Status: ${existing.status}, Priority: ${existing.priority}`,
      afterValue: `Updated fields: ${updates.join(', ')}`
    });

    res.json({ success: true, message: 'Task updated successfully' });
  } catch (err: any) {
    console.error('Task update error:', err);
    res.status(500).json({ error: 'Failed to update task.' });
  }
});

// 5. Delete task (Admins/Managers/Team Leads)
router.delete('/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const taskId = Number(req.params.id);
    const existing = await queryOne<{ title: string; task_code: string; assignment_id: number | null; project_id: number; assigned_employee_id: number }>('SELECT title, task_code, assignment_id, project_id, assigned_employee_id FROM tasks WHERE id = ?', [taskId]);
    if (!existing) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const userRole = req.user?.role;
    const userEmpId = req.user?.employeeId;
    let canDelete = userRole === 'SUPER_ADMIN' || userRole === 'ADMIN' || userRole === 'MANAGER';
    if (!canDelete && userEmpId) {
      const prj = await queryOne<{ manager_id: number }>('SELECT manager_id FROM projects WHERE id = ?', [existing.project_id]);
      if (prj && prj.manager_id === userEmpId) canDelete = true;
    }

    if (!canDelete) {
      return res.status(403).json({ error: 'Permission denied. Only team leads or administrators can delete tasks.' });
    }

    await execute('DELETE FROM tasks WHERE id = ?', [taskId]);

    // Automatically recalculate milestone progress and stage after task removal
    if (existing.assignment_id) {
      await syncMilestoneStageAndProgress(existing.assignment_id);
    }

    await logAudit({
      userId: req.user!.id,
      userName: req.user!.fullName || req.user!.email,
      userRole: req.user!.role,
      action: 'TASK_DELETED',
      resource: 'TASK',
      resourceId: taskId,
      ipAddress: req.ip,
      beforeValue: `Deleted task ${existing.task_code}: ${existing.title}`
    });

    res.json({ success: true, message: 'Task deleted successfully' });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to delete task.' });
  }
});

// 6. Add comment with @mentions
router.post('/:id/comments', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const taskId = Number(req.params.id);
    const { message, mentions } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Comment message cannot be empty.' });
    }

    const task = await queryOne<{ title: string; assigned_employee_id: number; assigned_by_user_id: number }>(
      'SELECT title, assigned_employee_id, assigned_by_user_id FROM tasks WHERE id = ?',
      [taskId]
    );
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const now = new Date().toISOString();
    const { lastInsertRowid: commentId } = await execute(`
      INSERT INTO task_comments (task_id, author_id, author_name, author_role, message, mentions, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      taskId,
      req.user!.id,
      req.user!.fullName || req.user!.email,
      req.user!.role,
      message.trim(),
      mentions ? JSON.stringify(mentions) : null,
      now
    ]);

    // Record in activity log
    await execute(`
      INSERT INTO task_activity_log (task_id, user_id, user_name, action, from_value, to_value, created_at)
      VALUES (?, ?, ?, 'COMMENT_ADDED', NULL, ?, ?)
    `, [taskId, req.user!.id, req.user!.fullName || req.user!.email, message.trim().substring(0, 80), now]);

    // Check for @mentions in message text (e.g. @John or @Jane)
    const mentionMatches = message.match(/@(\w+)/g);
    if (mentionMatches) {
      for (const m of mentionMatches) {
        const namePart = m.replace('@', '').toLowerCase();
        const mentionedUser = await queryOne<{ user_id: number; first_name: string }>(
          'SELECT user_id, first_name FROM employees WHERE LOWER(first_name) LIKE ? OR LOWER(last_name) LIKE ?',
          [`%${namePart}%`, `%${namePart}%`]
        );
        if (mentionedUser && mentionedUser.user_id !== req.user!.id) {
          await createNotification({
            userId: mentionedUser.user_id,
            title: 'You were mentioned in a task',
            message: `${req.user!.fullName || req.user!.email} mentioned you on "${task.title}": "${message.trim().substring(0, 100)}"`,
            type: 'COMMENT_ADDED',
            link: `/tasks?id=${taskId}`
          });
        }
      }
    }

    res.json({
      success: true,
      comment: {
        id: commentId,
        taskId,
        authorName: req.user!.fullName || req.user!.email,
        authorRole: req.user!.role,
        message: message.trim(),
        createdAt: now
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to post comment.' });
  }
});

// 7. Add task attachment
router.post('/:id/attachments', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const taskId = Number(req.params.id);
    const { filename, fileSize, fileType, fileUrl } = req.body;
    if (!filename) {
      return res.status(400).json({ error: 'Filename is required' });
    }

    const now = new Date().toISOString();
    const { lastInsertRowid: attId } = await execute(`
      INSERT INTO task_attachments (task_id, filename, file_size, file_type, file_url, uploaded_by_user_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      taskId,
      filename,
      fileSize || 1024,
      fileType || 'application/octet-stream',
      fileUrl || `/attachments/${filename}`,
      req.user!.id,
      now
    ]);

    await execute(`
      INSERT INTO task_activity_log (task_id, user_id, user_name, action, from_value, to_value, created_at)
      VALUES (?, ?, ?, 'ATTACHMENT_ADDED', NULL, ?, ?)
    `, [taskId, req.user!.id, req.user!.fullName || req.user!.email, filename, now]);

    res.json({
      success: true,
      attachment: {
        id: attId,
        filename,
        fileSize,
        fileType,
        createdAt: now
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to add attachment.' });
  }
});

export default router;
