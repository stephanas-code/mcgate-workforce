import { Router } from 'express';
import { getDbLogs, queryAll, queryOne } from '../db.ts';
import { authenticateToken, requireRoles } from '../auth.ts';

const router = Router();

// System Diagnostics & Database Logs (Super Admin and Admin)
router.get('/db-logs', authenticateToken, requireRoles('SUPER_ADMIN', 'ADMIN'), async (_req, res) => {
  try {
    const dbInfo = getDbLogs();

    // Query active counts in this container
    const userCount = await queryOne<{ count: number }>('SELECT COUNT(*) as count FROM users').catch(() => ({ count: 0 }));
    const employeeCount = await queryOne<{ count: number }>('SELECT COUNT(*) as count FROM employees').catch(() => ({ count: 0 }));
    const recentEmployees = await queryAll<{ id: number; employee_code: string; first_name: string; last_name: string; email: string }>(`
      SELECT e.id, e.employee_code, e.first_name, e.last_name, u.email
      FROM employees e
      JOIN users u ON u.id = e.user_id
      ORDER BY e.id DESC
      LIMIT 10
    `).catch(() => []);

    res.json({
      success: true,
      container: {
        id: dbInfo.containerId,
        bootTime: dbInfo.bootTime,
        isVercel: dbInfo.isVercel,
        blobConfigured: dbInfo.blobConfigured
      },
      storage: {
        engine: 'SQL.js (WebAssembly SQLite)',
        dataDir: dbInfo.dataDir,
        dbFile: dbInfo.dbFile,
        existsOnDisk: dbInfo.dbFileExists,
        sizeBytes: dbInfo.dbFileSize,
        totalUsers: userCount?.count || 0,
        totalEmployees: employeeCount?.count || 0
      },
      recentEmployees,
      recentOperations: dbInfo.logs
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve database logs', message: err?.message });
  }
});

export default router;
