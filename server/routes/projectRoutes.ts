import { Router } from 'express';
import { queryOne, queryAll, execute } from '../db.ts';
import { authenticateToken, AuthRequest } from '../auth.ts';
import { logAudit } from '../audit.ts';
import { createNotification } from '../notifications.ts';
import { calculateMilestoneMetrics } from '../milestones.ts';

const router = Router();

// Helper to auto-generate a clean, unique project code from the project name
export async function generateUniqueProjectCode(name: string): Promise<string> {
  if (!name || !name.trim()) {
    name = 'PROJECT';
  }

  // Remove special characters, keep letters and digits
  const clean = name.trim().replace(/[^a-zA-Z0-9\s]/g, ' ');
  const words = clean.split(/\s+/).filter((w) => w.length > 0);

  let base = '';
  if (words.length === 0) {
    base = 'PROJ';
  } else if (words.length === 1) {
    base = words[0].toUpperCase().substring(0, 10);
  } else if (words.length === 2) {
    base = `${words[0].substring(0, 6)}-${words[1].substring(0, 6)}`.toUpperCase();
  } else {
    // 3 or more words: e.g. "StorePro Enterprise Platform"
    if (words[0].length >= 3 && words[0].length <= 8) {
      const rest = words.slice(1, 3).map((w) => w.substring(0, 4).toUpperCase()).join('-');
      base = `${words[0].toUpperCase()}-${rest}`;
      if (base.length > 15) {
        base = `${words[0].toUpperCase()}-${words.slice(1).map((w) => w[0]).join('').toUpperCase()}`;
      }
    } else {
      base = words.map((w) => w[0]).join('').toUpperCase();
    }
  }

  base = base.replace(/[^A-Z0-9-]/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '');
  if (!base) base = 'PROJ';

  let candidate = `PRJ-${base}`;

  // Check uniqueness in database
  const existing = await queryAll<{ code: string }>('SELECT code FROM projects WHERE code LIKE ?', [`${candidate}%`]);
  const existingCodes = new Set(existing.map((e) => e.code.toUpperCase()));

  if (!existingCodes.has(candidate)) {
    return candidate;
  }

  let counter = 2;
  while (existingCodes.has(`${candidate}-${counter}`)) {
    counter++;
  }
  return `${candidate}-${counter}`;
}

// 0. Auto-generate unique project code endpoint
router.get('/generate-code', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const name = String(req.query.name || '');
    const code = await generateUniqueProjectCode(name);
    res.json({ code });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to generate project code.' });
  }
});

// 1. List projects with metrics
router.get('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const projects = await queryAll<{
      id: number;
      code: string;
      name: string;
      description: string;
      manager_id: number | null;
      department_id: number | null;
      status: string;
      start_date: string;
      expected_completion_date: string | null;
      created_at: string;
      updated_at: string;
      manager_first: string | null;
      manager_last: string | null;
      department_name: string | null;
    }>(`
      SELECT 
        p.*,
        e.first_name as manager_first,
        e.last_name as manager_last,
        d.name as department_name
      FROM projects p
      LEFT JOIN employees e ON e.id = p.manager_id
      LEFT JOIN departments d ON d.id = p.department_id
      ORDER BY p.created_at DESC
    `);

    const enriched = await Promise.all(projects.map(async (p) => {
      const assignmentCount = await queryOne<{ count: number }>('SELECT COUNT(*) as count FROM assignments WHERE project_id = ?', [p.id]);
      const taskStats = await queryOne<{ total: number; completed: number }>(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) as completed
        FROM tasks
        WHERE project_id = ?
      `, [p.id]);

      const docCount = await queryOne<{ count: number }>('SELECT COUNT(*) as count FROM project_documents WHERE project_id = ?', [p.id]);

      const totalTasks = taskStats?.total || 0;
      const completedTasks = taskStats?.completed || 0;
      const progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

      return {
        ...p,
        managerName: p.manager_first ? `${p.manager_first} ${p.manager_last}` : 'Unassigned',
        assignmentCount: assignmentCount?.count || 0,
        totalAssignments: assignmentCount?.count || 0,
        totalTasks,
        completedTasks,
        progressPercent,
        documentsCount: docCount?.count || 0,
        target_date: p.expected_completion_date
      };
    }));

    res.json(enriched);
  } catch (err: any) {
    console.error('Fetch projects error:', err);
    res.status(500).json({ error: 'Failed to retrieve projects.' });
  }
});

// 2. Get single project details (including documents)
router.get('/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const project = await queryOne<any>(`
      SELECT 
        p.*,
        e.first_name as manager_first,
        e.last_name as manager_last,
        d.name as department_name
      FROM projects p
      LEFT JOIN employees e ON e.id = p.manager_id
      LEFT JOIN departments d ON d.id = p.department_id
      WHERE p.id = ?
    `, [id]);

    if (!project) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    const rawAssignments = await queryAll<any>('SELECT a.*, e.first_name as lead_first, e.last_name as lead_last FROM assignments a LEFT JOIN employees e ON e.id = a.lead_employee_id WHERE a.project_id = ? ORDER BY a.created_at ASC', [id]);
    
    // Enrich each milestone with priority-weighted progress and status metrics
    const enrichedAssignments = await Promise.all(rawAssignments.map(async (a) => {
      const metrics = await calculateMilestoneMetrics(a.id);
      return {
        ...a,
        leadName: a.lead_first ? `${a.lead_first} ${a.lead_last}` : 'Unassigned',
        ...metrics,
        status: metrics.totalTasks > 0 ? metrics.newStatus : a.status
      };
    }));

    const tasks = await queryAll<any>(`
      SELECT 
        t.*,
        e.first_name as assignee_first,
        e.last_name as assignee_last,
        e.employee_code as assignee_code,
        a.title as assignment_title
      FROM tasks t
      LEFT JOIN employees e ON e.id = t.assigned_employee_id
      LEFT JOIN assignments a ON a.id = t.assignment_id
      WHERE t.project_id = ?
      ORDER BY 
        CASE t.priority 
          WHEN 'URGENT' THEN 1 
          WHEN 'HIGH' THEN 2 
          WHEN 'MEDIUM' THEN 3 
          ELSE 4 
        END, t.due_date ASC
    `, [id]);

    const formattedTasks = tasks.map(t => ({
      ...t,
      assigneeName: t.assignee_first ? `${t.assignee_first} ${t.assignee_last}` : 'Unassigned',
      isOverdue: t.status !== 'COMPLETED' && t.status !== 'CANCELLED' && t.due_date < new Date().toISOString().split('T')[0]
    }));

    const documents = await queryAll(`
      SELECT id, project_id, filename, original_name, file_size, file_extension, mime_type, uploaded_by_user_id, uploaded_by_name, created_at
      FROM project_documents
      WHERE project_id = ?
      ORDER BY created_at DESC
    `, [id]);

    res.json({
      ...project,
      managerName: project.manager_first ? `${project.manager_first} ${project.manager_last}` : 'Unassigned',
      target_date: project.expected_completion_date,
      assignments: enrichedAssignments,
      tasks: formattedTasks,
      documents
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve project details.' });
  }
});

// Allowed document extensions
const ALLOWED_EXTENSIONS = new Set(['txt', 'docx', 'pdf', 'md']);

// 3. Create project with auto-generated unique code and optional document uploads
router.post('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    let { code, name, description, managerId, departmentId, status = 'ACTIVE', startDate, targetDate, documents } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Project name is required.' });
    }

    // Ensure unique project code
    if (!code || !code.trim()) {
      code = await generateUniqueProjectCode(name);
    } else {
      // Validate uniqueness if user supplied a code
      const existing = await queryOne('SELECT id FROM projects WHERE UPPER(code) = ?', [code.toUpperCase().trim()]);
      if (existing) {
        // Automatically make it unique so creation does not fail
        code = await generateUniqueProjectCode(name);
      } else {
        code = code.toUpperCase().trim();
      }
    }

    const now = new Date().toISOString();
    const { lastInsertRowid: projectId } = await execute(`
      INSERT INTO projects (code, name, description, manager_id, department_id, status, start_date, expected_completion_date, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      code,
      name.trim(),
      description || '',
      managerId || null,
      departmentId || null,
      status,
      startDate || now.split('T')[0],
      targetDate || null,
      now,
      now
    ]);

    // Handle document uploads if provided
    let uploadedDocsCount = 0;
    if (Array.isArray(documents) && documents.length > 0) {
      for (const doc of documents) {
        const ext = (doc.fileExtension || doc.filename.split('.').pop() || '').toLowerCase();
        if (!ALLOWED_EXTENSIONS.has(ext)) {
          continue; // Skip invalid extensions
        }

        const filename = doc.filename || `doc_${Date.now()}.${ext}`;
        const originalName = doc.originalName || filename;
        const fileSize = Number(doc.fileSize) || 1024;
        const mimeType = doc.mimeType || (ext === 'pdf' ? 'application/pdf' : ext === 'docx' ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' : 'text/plain');
        const fileData = doc.fileData || '';

        await execute(`
          INSERT INTO project_documents (project_id, filename, original_name, file_size, file_extension, mime_type, file_data, uploaded_by_user_id, uploaded_by_name, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          projectId,
          filename,
          originalName,
          fileSize,
          ext,
          mimeType,
          fileData,
          req.user!.id,
          req.user!.fullName || req.user!.email,
          now
        ]);
        uploadedDocsCount++;
      }
    }

    await logAudit({
      userId: req.user!.id,
      userName: req.user!.fullName || req.user!.email,
      userRole: req.user!.role,
      action: 'PROJECT_CREATED',
      resource: 'PROJECT',
      resourceId: projectId,
      ipAddress: req.ip,
      afterValue: `Created project ${code}: "${name}" with ${uploadedDocsCount} documents`
    });

    res.status(201).json({
      success: true,
      message: 'Project created successfully',
      projectId,
      code,
      documentsCount: uploadedDocsCount
    });
  } catch (err: any) {
    console.error('Project creation failed:', err);
    res.status(500).json({ error: 'Failed to create project.' });
  }
});

// 3b. Update / Reassign project (Admins have right to reassign projects to other teammates)
router.patch('/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const projectId = Number(req.params.id);
    const existing = await queryOne<any>('SELECT * FROM projects WHERE id = ?', [projectId]);
    if (!existing) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    const userRole = req.user?.role;
    const userEmpId = req.user?.employeeId;
    const isAdmin = userRole === 'SUPER_ADMIN' || userRole === 'ADMIN';
    const isCurrentManager = userEmpId && existing.manager_id === userEmpId;

    if (!isAdmin && !isCurrentManager) {
      return res.status(403).json({ error: 'Permission denied. Only Admins or the Project Lead may update this project.' });
    }

    const { name, description, managerId, departmentId, status, targetDate } = req.body;
    const updates: string[] = [];
    const params: any[] = [];
    const now = new Date().toISOString();

    if (name && name.trim()) {
      updates.push('name = ?');
      params.push(name.trim());
    }
    if (description !== undefined) {
      updates.push('description = ?');
      params.push(description);
    }
    if (departmentId !== undefined) {
      updates.push('department_id = ?');
      params.push(departmentId || null);
    }
    if (status) {
      updates.push('status = ?');
      params.push(status);
    }
    if (targetDate !== undefined) {
      updates.push('expected_completion_date = ?');
      params.push(targetDate || null);
    }

    // Manager / Lead Reassignment: Admins have full rights to reassign project leads
    let reassigned = false;
    if (managerId !== undefined && managerId !== existing.manager_id) {
      if (!isAdmin) {
        return res.status(403).json({ error: 'Permission denied. Only Administrators have the authority to reassign project leadership.' });
      }
      updates.push('manager_id = ?');
      params.push(managerId || null);
      reassigned = true;
    }

    if (updates.length > 0) {
      updates.push('updated_at = ?');
      params.push(now);
      params.push(projectId);

      await execute(`UPDATE projects SET ${updates.join(', ')} WHERE id = ?`, params);
    }

    // Handle reassignment notification & audit log
    if (reassigned && managerId) {
      const newManager = await queryOne<{ user_id: number; first_name: string; last_name: string }>(
        'SELECT user_id, first_name, last_name FROM employees WHERE id = ?',
        [managerId]
      );
      if (newManager) {
        await createNotification({
          userId: newManager.user_id,
          title: 'Project Leadership Designation',
          message: `You have been designated as Project Lead for "${existing.name}" (${existing.code}) by ${req.user!.fullName || req.user!.email}.`,
          type: 'PROJECT_ASSIGNED',
          link: '/projects'
        });
      }
    }

    await logAudit({
      userId: req.user!.id,
      userName: req.user!.fullName || req.user!.email,
      userRole: req.user!.role,
      action: reassigned ? 'PROJECT_REASSIGNED' : 'PROJECT_UPDATED',
      resource: 'PROJECT',
      resourceId: projectId,
      ipAddress: req.ip,
      beforeValue: `Manager: ${existing.manager_id}, Status: ${existing.status}`,
      afterValue: `Updated: ${updates.join(', ')}`
    });

    res.json({
      success: true,
      message: reassigned ? 'Project reassigned successfully.' : 'Project updated successfully.'
    });
  } catch (err: any) {
    console.error('Project update/reassign error:', err);
    res.status(500).json({ error: 'Failed to update or reassign project.' });
  }
});

// 4. Upload documents to an existing project
router.post('/:id/documents', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const projectId = Number(req.params.id);
    const project = await queryOne<{ id: number; name: string; code: string }>('SELECT id, name, code FROM projects WHERE id = ?', [projectId]);
    if (!project) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    const { documents } = req.body;
    const docList = Array.isArray(documents) ? documents : [req.body];

    if (docList.length === 0) {
      return res.status(400).json({ error: 'No documents provided for upload.' });
    }

    const now = new Date().toISOString();
    const insertedIds: number[] = [];

    for (const doc of docList) {
      const ext = (doc.fileExtension || (doc.filename ? doc.filename.split('.').pop() : '')).toLowerCase();
      if (!ALLOWED_EXTENSIONS.has(ext)) {
        return res.status(400).json({
          error: `Unsupported file format: ".${ext}". Only .txt, .docx, .pdf, and .md are supported.`
        });
      }

      const filename = doc.filename || `doc_${Date.now()}.${ext}`;
      const originalName = doc.originalName || filename;
      const fileSize = Number(doc.fileSize) || 1024;
      const mimeType = doc.mimeType || (ext === 'pdf' ? 'application/pdf' : ext === 'docx' ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' : 'text/plain');
      const fileData = doc.fileData || '';

      const { lastInsertRowid: docId } = await execute(`
        INSERT INTO project_documents (project_id, filename, original_name, file_size, file_extension, mime_type, file_data, uploaded_by_user_id, uploaded_by_name, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        projectId,
        filename,
        originalName,
        fileSize,
        ext,
        mimeType,
        fileData,
        req.user!.id,
        req.user!.fullName || req.user!.email,
        now
      ]);

      insertedIds.push(Number(docId));
    }

    await logAudit({
      userId: req.user!.id,
      userName: req.user!.fullName || req.user!.email,
      userRole: req.user!.role,
      action: 'PROJECT_DOCUMENTS_UPLOADED',
      resource: 'PROJECT',
      resourceId: projectId,
      ipAddress: req.ip,
      afterValue: `Uploaded ${insertedIds.length} document(s) to project ${project.code}`
    });

    const updatedDocuments = await queryAll(`
      SELECT id, project_id, filename, original_name, file_size, file_extension, mime_type, uploaded_by_user_id, uploaded_by_name, created_at
      FROM project_documents
      WHERE project_id = ?
      ORDER BY created_at DESC
    `, [projectId]);

    res.json({
      success: true,
      message: `${insertedIds.length} document(s) uploaded successfully`,
      documents: updatedDocuments
    });
  } catch (err: any) {
    console.error('Document upload error:', err);
    res.status(500).json({ error: 'Failed to upload document(s).' });
  }
});

// 5. Get a specific document (including file_data for preview or download)
router.get('/:id/documents/:docId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const projectId = Number(req.params.id);
    const docId = Number(req.params.docId);

    const doc = await queryOne<any>(`
      SELECT * FROM project_documents WHERE id = ? AND project_id = ?
    `, [docId, projectId]);

    if (!doc) {
      return res.status(404).json({ error: 'Document not found.' });
    }

    res.json(doc);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve document.' });
  }
});

// 6. Delete a document
router.delete('/:id/documents/:docId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const projectId = Number(req.params.id);
    const docId = Number(req.params.docId);

    const doc = await queryOne<any>(`
      SELECT * FROM project_documents WHERE id = ? AND project_id = ?
    `, [docId, projectId]);

    if (!doc) {
      return res.status(404).json({ error: 'Document not found.' });
    }

    // Allow uploader, managers, or admins to delete
    const isUploader = doc.uploaded_by_user_id === req.user!.id;
    const isPrivileged = req.user!.role === 'SUPER_ADMIN' || req.user!.role === 'ADMIN' || req.user!.role === 'MANAGER';
    if (!isUploader && !isPrivileged) {
      return res.status(403).json({ error: 'Permission denied. Only document uploader or managers may remove this document.' });
    }

    await execute('DELETE FROM project_documents WHERE id = ?', [docId]);

    await logAudit({
      userId: req.user!.id,
      userName: req.user!.fullName || req.user!.email,
      userRole: req.user!.role,
      action: 'PROJECT_DOCUMENT_DELETED',
      resource: 'PROJECT',
      resourceId: projectId,
      ipAddress: req.ip,
      afterValue: `Deleted document ${doc.original_name} from project #${projectId}`
    });

    res.json({ success: true, message: 'Document deleted successfully.' });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to delete document.' });
  }
});

export default router;

