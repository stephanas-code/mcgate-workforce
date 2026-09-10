import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { queryOne, queryAll, execute } from '../db.ts';
import { signToken, authenticateToken, getUserProfileById, type AuthRequest } from '../auth.ts';
import { logAudit } from '../audit.ts';

const router = Router();

// In-Memory Rate Limiter for Login Attempts (Brute-Force & Password Spraying Protection)
interface RateLimitEntry {
  attempts: number;
  lockedUntil?: number;
}
const loginAttempts = new Map<string, RateLimitEntry>();
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes lockout

function checkRateLimit(key: string): { isLocked: boolean; remainingSec: number } {
  const entry = loginAttempts.get(key);
  if (!entry) return { isLocked: false, remainingSec: 0 };
  if (entry.lockedUntil && entry.lockedUntil > Date.now()) {
    return { isLocked: true, remainingSec: Math.ceil((entry.lockedUntil - Date.now()) / 1000) };
  }
  if (entry.lockedUntil && entry.lockedUntil <= Date.now()) {
    loginAttempts.delete(key);
  }
  return { isLocked: false, remainingSec: 0 };
}

function recordFailedLogin(key: string): void {
  const now = Date.now();
  const entry = loginAttempts.get(key) || { attempts: 0 };
  entry.attempts += 1;
  if (entry.attempts >= MAX_LOGIN_ATTEMPTS) {
    entry.lockedUntil = now + LOCKOUT_DURATION_MS;
  }
  loginAttempts.set(key, entry);
}

function clearLoginAttempts(key: string): void {
  loginAttempts.delete(key);
}

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const clientIp = (req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown') as string;
    const rateLimitKey = `${clientIp}_${(email || '').trim().toLowerCase()}`;

    const { isLocked, remainingSec } = checkRateLimit(rateLimitKey);
    if (isLocked) {
      return res.status(429).json({
        error: `Too many failed login attempts. Access temporarily restricted. Please try again in ${Math.ceil(remainingSec / 60)} minute(s).`
      });
    }

    if (!email || !password) {
      return res.status(400).json({ error: 'Corporate email and password are required.' });
    }

    const normalizedInput = email.trim().toLowerCase();
    let queryEmail = normalizedInput;
    if (normalizedInput === 'superuser' || normalizedInput === 'admin' || normalizedInput === 'superadmin' || normalizedInput === 'admin@mcgate.tech') {
      queryEmail = 'superuser@mcgate.tech';
    }

    let user = await queryOne<{ id: number; email: string; password_hash: string; role: string; status: string }>(
      'SELECT id, email, password_hash, role, status FROM users WHERE email = ?',
      [queryEmail]
    );

    // Fallback: if user entered superuser or admin and was not found, check any active SUPER_ADMIN
    if (!user && (queryEmail === 'superuser@mcgate.tech' || queryEmail === 'admin@mcgate.tech')) {
      user = await queryOne<{ id: number; email: string; password_hash: string; role: string; status: string }>(
        "SELECT id, email, password_hash, role, status FROM users WHERE role = 'SUPER_ADMIN' AND status = 'ACTIVE' LIMIT 1"
      );
    }

    if (!user) {
      recordFailedLogin(rateLimitKey);
      await logAudit({
        userId: 0,
        userName: email.trim(),
        userRole: 'UNKNOWN',
        action: 'LOGIN_FAILURE',
        resource: 'AUTH',
        resourceId: 0,
        ipAddress: clientIp,
        afterValue: 'Authentication failed: Account not found'
      });
      return res.status(401).json({ error: 'Invalid corporate email or password.' });
    }

    if (user.status !== 'ACTIVE') {
      return res.status(403).json({ error: 'This account has been deactivated. Please contact HR.' });
    }

    const match = bcrypt.compareSync(password, user.password_hash);
    if (!match) {
      recordFailedLogin(rateLimitKey);
      await logAudit({
        userId: user.id,
        userName: user.email,
        userRole: user.role,
        action: 'LOGIN_FAILURE',
        resource: 'AUTH',
        resourceId: user.id,
        ipAddress: clientIp,
        afterValue: 'Authentication failed: Invalid password'
      });
      return res.status(401).json({ error: 'Invalid corporate email or password.' });
    }

    // Reset rate limit on success
    clearLoginAttempts(rateLimitKey);

    const profile = await getUserProfileById(user.id);
    if (!profile) {
      return res.status(404).json({ error: 'User profile not found' });
    }

    const token = signToken(profile);

    await logAudit({
      userId: profile.id,
      userName: profile.fullName || profile.email,
      userRole: profile.role,
      action: 'USER_LOGIN',
      resource: 'AUTH',
      resourceId: profile.id,
      ipAddress: clientIp,
      afterValue: `Logged in via verified credentials from ${req.headers['user-agent'] || 'Unknown'}`
    });

    res.json({
      token,
      user: profile,
      message: 'Login successful'
    });
  } catch (err: any) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error during authentication' });
  }
});

// Switch demo account (Restricted to authenticated SUPER_ADMINs only!)
router.post('/switch-demo', authenticateToken, async (req: AuthRequest, res) => {
  try {
    if (req.user?.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Unauthorized. Account switching is restricted to Super Administrators.' });
    }

    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const normalizedInput = email.trim().toLowerCase();
    let queryEmail = normalizedInput;
    if (normalizedInput === 'superuser' || normalizedInput === 'admin' || normalizedInput === 'superadmin' || normalizedInput === 'super_admin' || normalizedInput === 'admin@mcgate.tech') {
      queryEmail = 'superuser@mcgate.tech';
    }

    let user = await queryOne<{ id: number; email: string; role: string; status: string }>(
      'SELECT id, email, role, status FROM users WHERE email = ?',
      [queryEmail]
    );

    if (!user) {
      user = await queryOne<{ id: number; email: string; role: string; status: string }>(
        "SELECT id, email, role, status FROM users WHERE role = 'SUPER_ADMIN' AND status = 'ACTIVE' LIMIT 1"
      );
    }

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const profile = await getUserProfileById(user.id);
    if (!profile) {
      return res.status(404).json({ error: 'User profile not found' });
    }

    const token = signToken(profile);

    await logAudit({
      userId: req.user!.id,
      userName: req.user!.fullName || req.user!.email,
      userRole: req.user!.role,
      action: 'ADMIN_SESSION_SWITCH',
      resource: 'AUTH',
      resourceId: profile.id,
      ipAddress: req.ip || '127.0.0.1',
      afterValue: `Super Admin switched active session to ${profile.role} (${profile.email})`
    });

    res.json({
      token,
      user: profile,
      message: `Switched to ${profile.fullName} (${profile.role})`
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to switch user' });
  }
});

// List users for administrative testing - strictly restricted to authenticated Super Admin
router.get('/demo-users', authenticateToken, async (req: AuthRequest, res) => {
  try {
    if (req.user?.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Unauthorized.' });
    }

    const list = await queryAll<{
      id: number;
      email: string;
      role: string;
      first_name: string;
      last_name: string;
      job_title: string;
      dept_name: string;
    }>(`
      SELECT 
        u.id, u.email, u.role,
        e.first_name, e.last_name, e.job_title,
        d.name as dept_name
      FROM users u
      LEFT JOIN employees e ON e.user_id = u.id
      LEFT JOIN departments d ON d.id = e.department_id
      WHERE u.role = 'SUPER_ADMIN'
      ORDER BY u.id ASC
    `);

    res.json(list);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch demo users' });
  }
});

// Get current logged-in user profile
router.get('/me', authenticateToken, async (req: AuthRequest, res) => {
  const profile = await getUserProfileById(req.user!.id);
  res.json({ user: profile || req.user });
});

// Update Profile Picture / Avatar
router.post('/avatar', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { avatarUrl } = req.body;
    if (!avatarUrl || typeof avatarUrl !== 'string') {
      return res.status(400).json({ error: 'A valid image URL or base64 data string is required' });
    }

    // Check if employee record exists for this user
    let emp = await queryOne<{ id: number }>('SELECT id FROM employees WHERE user_id = ?', [req.user!.id]);
    const now = new Date().toISOString();

    if (!emp) {
      // Create employee record if missing
      const empCode = `MGT-${String(req.user!.id).padStart(3, '0')}`;
      const { lastInsertRowid } = await execute(`
        INSERT INTO employees (user_id, employee_code, first_name, last_name, avatar_url, job_title, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [req.user!.id, empCode, req.user!.firstName || 'Super', req.user!.lastName || 'Admin', avatarUrl, 'Super Administrator', now]);
      emp = { id: lastInsertRowid };
    } else {
      await execute('UPDATE employees SET avatar_url = ? WHERE id = ?', [avatarUrl, emp.id]);
    }

    await logAudit({
      userId: req.user!.id,
      userName: req.user!.fullName || req.user!.email,
      userRole: req.user!.role,
      action: 'AVATAR_UPDATE',
      resource: 'EMPLOYEE',
      resourceId: emp.id,
      ipAddress: req.ip,
      afterValue: 'Updated profile picture photo'
    });

    const updatedProfile = await getUserProfileById(req.user!.id);

    res.json({
      success: true,
      avatarUrl,
      user: updatedProfile,
      message: 'Profile picture updated successfully'
    });
  } catch (err: any) {
    console.error('Avatar update failed:', err);
    res.status(500).json({ error: 'Failed to update profile picture' });
  }
});

// Update Profile Details (First Name, Last Name, Phone, Job Title)
router.put('/profile', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { firstName, lastName, phone, jobTitle, avatarUrl } = req.body;
    const now = new Date().toISOString();

    const emp = await queryOne<{ id: number }>('SELECT id FROM employees WHERE user_id = ?', [req.user!.id]);
    if (emp) {
      await execute(`
        UPDATE employees 
        SET first_name = COALESCE(?, first_name),
            last_name = COALESCE(?, last_name),
            phone = COALESCE(?, phone),
            job_title = COALESCE(?, job_title),
            avatar_url = COALESCE(?, avatar_url)
        WHERE id = ?
      `, [firstName, lastName, phone, jobTitle, avatarUrl, emp.id]);
    } else {
      const empCode = `MGT-${String(req.user!.id).padStart(3, '0')}`;
      await execute(`
        INSERT INTO employees (user_id, employee_code, first_name, last_name, phone, job_title, avatar_url, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [req.user!.id, empCode, firstName || 'Admin', lastName || 'User', phone || '', jobTitle || 'Administrator', avatarUrl || null, now]);
    }

    await logAudit({
      userId: req.user!.id,
      userName: req.user!.fullName || req.user!.email,
      userRole: req.user!.role,
      action: 'PROFILE_UPDATE',
      resource: 'USER',
      resourceId: req.user!.id,
      ipAddress: req.ip,
      afterValue: `Updated user profile details for ${req.user!.email}`
    });

    const updatedProfile = await getUserProfileById(req.user!.id);
    res.json({ success: true, user: updatedProfile, message: 'Profile updated successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update profile information' });
  }
});

// Change Password (Dedicated endpoint)
router.post('/change-password', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password are both required.' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters in length.' });
    }

    const user = await queryOne<{ password_hash: string }>('SELECT password_hash FROM users WHERE id = ?', [req.user!.id]);
    if (!user || !bcrypt.compareSync(currentPassword, user.password_hash)) {
      return res.status(400).json({ error: 'Current password is incorrect. Please verify and try again.' });
    }

    const newHash = bcrypt.hashSync(newPassword, 10);
    const now = new Date().toISOString();
    await execute('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?', [newHash, now, req.user!.id]);

    await logAudit({
      userId: req.user!.id,
      userName: req.user!.fullName || req.user!.email,
      userRole: req.user!.role,
      action: 'PASSWORD_CHANGE',
      resource: 'USER',
      resourceId: req.user!.id,
      ipAddress: req.ip,
      afterValue: 'Password changed successfully by user'
    });

    res.json({ success: true, message: 'Password has been updated successfully.' });
  } catch (err) {
    console.error('Change password failed:', err);
    res.status(500).json({ error: 'Failed to change password. Please try again.' });
  }
});

// Forgot password request (Generates a secure recovery simulation)
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  // Generic response to avoid user enumeration and prevent leaking credentials
  res.json({
    message: 'If that email exists in the directory, password recovery instructions have been dispatched.'
  });
});

// Reset password
router.post('/reset-password', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }

    const user = await queryOne<{ password_hash: string }>('SELECT password_hash FROM users WHERE id = ?', [req.user!.id]);
    if (!user || !bcrypt.compareSync(currentPassword, user.password_hash)) {
      return res.status(400).json({ error: 'Incorrect current password' });
    }

    const newHash = bcrypt.hashSync(newPassword, 10);
    const now = new Date().toISOString();
    await execute('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?', [newHash, now, req.user!.id]);

    await logAudit({
      userId: req.user!.id,
      userName: req.user!.fullName || req.user!.email,
      userRole: req.user!.role,
      action: 'PASSWORD_RESET',
      resource: 'USER',
      resourceId: req.user!.id,
      ipAddress: req.ip,
      afterValue: 'Password updated securely'
    });

    res.json({ message: 'Password has been updated successfully.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

// Logout
router.post('/logout', authenticateToken, async (req: AuthRequest, res) => {
  await logAudit({
    userId: req.user!.id,
    userName: req.user!.fullName || req.user!.email,
    userRole: req.user!.role,
    action: 'USER_LOGOUT',
    resource: 'AUTH',
    resourceId: req.user!.id,
    ipAddress: req.ip,
    afterValue: 'User logged out'
  });
  res.json({ message: 'Logged out successfully' });
});

export default router;
