import { Router } from 'express';
import { queryOne, execute } from '../db.ts';
import { authenticateToken, requireRoles, type AuthRequest } from '../auth.ts';
import { logAudit } from '../audit.ts';
import { clearAllMockData } from '../schema.ts';

const router = Router();

// Get settings
router.get('/', authenticateToken, async (_req, res) => {
  try {
    const settings = await queryOne('SELECT * FROM company_settings WHERE id = 1');
    res.json(settings || {
      company_name: 'McGate Technologies',
      timezone: 'Europe/Berlin',
      work_start_time: '08:30',
      work_end_time: '17:00',
      grace_period_minutes: 15,
      mandatory_clock_in: 1,
      optional_clock_out: 1
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch settings.' });
  }
});

// Update settings (Super Admin only)
router.put('/', authenticateToken, requireRoles('SUPER_ADMIN'), async (req: AuthRequest, res) => {
  try {
    const {
      company_name,
      timezone,
      work_start_time,
      work_end_time,
      grace_period_minutes,
      working_days,
      mandatory_clock_in,
      optional_clock_out,
      overdue_notification_hours,
      allow_manual_attendance_correction
    } = req.body;

    const now = new Date().toISOString();

    await execute(`
      UPDATE company_settings SET
        company_name = ?,
        timezone = ?,
        work_start_time = ?,
        work_end_time = ?,
        grace_period_minutes = ?,
        working_days = ?,
        mandatory_clock_in = ?,
        optional_clock_out = ?,
        overdue_notification_hours = ?,
        allow_manual_attendance_correction = ?,
        updated_at = ?
      WHERE id = 1
    `, [
      company_name || 'McGate Technologies',
      timezone || 'Europe/Berlin',
      work_start_time || '08:30',
      work_end_time || '17:00',
      grace_period_minutes || 15,
      typeof working_days === 'string' ? working_days : JSON.stringify(working_days || ["Monday","Tuesday","Wednesday","Thursday","Friday"]),
      mandatory_clock_in !== undefined ? Number(mandatory_clock_in) : 1,
      optional_clock_out !== undefined ? Number(optional_clock_out) : 1,
      overdue_notification_hours || 24,
      allow_manual_attendance_correction !== undefined ? Number(allow_manual_attendance_correction) : 1,
      now
    ]);

    await logAudit({
      userId: req.user!.id,
      userName: req.user!.fullName || req.user!.email,
      userRole: req.user!.role,
      action: 'SETTINGS_CHANGED',
      resource: 'SETTINGS',
      resourceId: '1',
      ipAddress: req.ip,
      afterValue: `Updated company policy: Start ${work_start_time}, Grace ${grace_period_minutes}m`
    });

    res.json({ success: true, message: 'Settings saved successfully.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update settings.' });
  }
});

// Reset / Clear all mockup data so system is completely clean and realtime
router.post('/reset-mock-data', authenticateToken, requireRoles('SUPER_ADMIN', 'ADMIN'), async (req: AuthRequest, res) => {
  try {
    await clearAllMockData();
    await logAudit({
      userId: req.user!.id,
      userName: req.user!.fullName || req.user!.email,
      userRole: req.user!.role,
      action: 'SYSTEM_PURGE',
      resource: 'SYSTEM',
      resourceId: 'ALL_MOCK_DATA',
      ipAddress: req.ip,
      afterValue: 'Purged all mockup data: tasks, assignments, projects, attendance, documents, logs'
    });
    res.json({ success: true, message: 'All mockup data cleared successfully. System is realtime and clean.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to clear mockup data.' });
  }
});

export default router;
