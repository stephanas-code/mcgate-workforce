import { Router } from 'express';
import { queryAll } from '../db.ts';
import { authenticateToken, requireRoles } from '../auth.ts';

const router = Router();

// Immutable audit logs viewer (Super Admin and Admin only)
router.get('/', authenticateToken, requireRoles('SUPER_ADMIN', 'ADMIN'), async (req, res) => {
  try {
    const { resource, action, limit = 100 } = req.query;
    const conditions: string[] = [];
    const params: any[] = [];

    if (resource) {
      conditions.push('resource = ?');
      params.push(resource);
    }
    if (action) {
      conditions.push('action = ?');
      params.push(action);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    params.push(Number(limit));

    const logs = await queryAll(`
      SELECT * FROM audit_logs
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ?
    `, params);

    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve audit logs.' });
  }
});

export default router;
