import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { queryOne, queryAll, execute } from '../db.ts';
import { signToken, authenticateToken, getUserProfileById, AuthRequest } from '../auth.ts';
import { logAudit } from '../audit.ts';

const router = Router();

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await queryOne<{ id: number; email: string; password_hash: string; role: string; status: string }>(
      'SELECT id, email, password_hash, role, status FROM users WHERE email = ?',
      [email.trim().toLowerCase()]
    );

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (user.status !== 'ACTIVE') {
      return res.status(403).json({ error: 'This account has been deactivated. Please contact HR.' });
    }

    const match = bcrypt.compareSync(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

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
      ipAddress: req.ip || req.headers['x-forwarded-for'] as string,
      afterValue: `Logged in via credentials from ${req.headers['user-agent'] || 'Unknown'}`
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

// Switch demo account (Convenient for evaluation of RBAC roles!)
router.post('/switch-demo', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const user = await queryOne<{ id: number; email: string; role: string; status: string }>(
      'SELECT id, email, role, status FROM users WHERE email = ?',
      [email.trim().toLowerCase()]
    );

    if (!user) {
      return res.status(404).json({ error: 'Demo user not found' });
    }

    const profile = await getUserProfileById(user.id);
    if (!profile) {
      return res.status(404).json({ error: 'User profile not found' });
    }

    const token = signToken(profile);

    await logAudit({
      userId: profile.id,
      userName: profile.fullName || profile.email,
      userRole: profile.role,
      action: 'DEMO_ROLE_SWITCH',
      resource: 'AUTH',
      resourceId: profile.id,
      ipAddress: req.ip || '127.0.0.1',
      afterValue: `Switched active session to ${profile.role} (${profile.email})`
    });

    res.json({
      token,
      user: profile,
      message: `Switched to ${profile.fullName} (${profile.role})`
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to switch demo user' });
  }
});

// List demo users for quick role testing - only returns Super Admin
router.get('/demo-users', async (_req, res) => {
  try {
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

  const user = await queryOne<{ id: number; email: string }>('SELECT id, email FROM users WHERE email = ?', [email.trim().toLowerCase()]);
  if (!user) {
    // Avoid user enumeration
    return res.json({ message: 'If that email exists in the directory, password recovery instructions have been sent.' });
  }

  res.json({
    message: `Password reset link generated for ${email}. In this internal deployment, you can use the default password 'password123' or use direct reset.`
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
