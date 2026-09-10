import { Router } from 'express';
import { queryAll, queryOne, execute } from '../db.ts';
import { authenticateToken, AuthRequest } from '../auth.ts';

const router = Router();

// Get current user's notifications + unread count
router.get('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;

    const unread = await queryOne<{ count: number }>(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0',
      [userId]
    );

    const notifications = await queryAll(
      'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50',
      [userId]
    );

    res.json({
      unreadCount: unread?.count || 0,
      notifications
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch notifications.' });
  }
});

// Mark single notification as read
router.patch('/:id/read', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    await execute('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?', [id, req.user!.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to mark notification as read.' });
  }
});

// Mark all as read
router.post('/read-all', authenticateToken, async (req: AuthRequest, res) => {
  try {
    await execute('UPDATE notifications SET is_read = 1 WHERE user_id = ?', [req.user!.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to mark all as read.' });
  }
});

export default router;
