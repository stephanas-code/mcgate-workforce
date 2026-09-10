import { execute } from './db.ts';

export interface AuditLogEntry {
  userId: number;
  userName: string;
  userRole: string;
  action: string;
  resource: string;
  resourceId?: string | number | null;
  ipAddress?: string | null;
  beforeValue?: any;
  afterValue?: any;
}

export async function logAudit(entry: AuditLogEntry): Promise<void> {
  try {
    const now = new Date().toISOString();
    const beforeStr = entry.beforeValue !== undefined && entry.beforeValue !== null
      ? (typeof entry.beforeValue === 'string' ? entry.beforeValue : JSON.stringify(entry.beforeValue))
      : null;
    const afterStr = entry.afterValue !== undefined && entry.afterValue !== null
      ? (typeof entry.afterValue === 'string' ? entry.afterValue : JSON.stringify(entry.afterValue))
      : null;

    await execute(`
      INSERT INTO audit_logs (
        user_id, user_name, user_role, action, resource, resource_id, ip_address, before_value, after_value, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      entry.userId,
      entry.userName,
      entry.userRole,
      entry.action,
      entry.resource,
      entry.resourceId ? String(entry.resourceId) : null,
      entry.ipAddress || '127.0.0.1',
      beforeStr,
      afterStr,
      now
    ]);
  } catch (err) {
    console.error('Failed to write immutable audit log:', err);
  }
}
