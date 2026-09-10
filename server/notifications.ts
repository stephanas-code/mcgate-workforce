import { execute } from './db.ts';

export interface NotificationPayload {
  userId: number;
  title: string;
  message: string;
  type: 'TASK_ASSIGNED' | 'DEADLINE_APPROACHING' | 'TASK_OVERDUE' | 'TASK_COMPLETED' | 'ASSIGNMENT_CREATED' | 'ASSIGNMENT_UPDATED' | 'COMMENT_ADDED' | 'REVIEW_REQUESTED' | 'ATTENDANCE_CORRECTION' | 'ATTENDANCE_REMINDER';
  link?: string;
}

export async function createNotification(payload: NotificationPayload): Promise<void> {
  try {
    const now = new Date().toISOString();
    await execute(`
      INSERT INTO notifications (user_id, title, message, type, link, is_read, created_at)
      VALUES (?, ?, ?, ?, ?, 0, ?)
    `, [
      payload.userId,
      payload.title,
      payload.message,
      payload.type,
      payload.link || '/tasks',
      now
    ]);
  } catch (err) {
    console.error('Failed to create notification:', err);
  }
}
