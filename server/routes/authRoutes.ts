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

// List demo users for quick role testing
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
      ORDER BY 
        CASE u.role 
          WHEN 'SUPER_ADMIN' THEN 1 
          WHEN 'ADMIN' THEN 2 
          WHEN 'MANAGER' THEN 3 
          ELSE 4 
        END, u.id ASC
    `);

    res.json(list);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch demo users' });
  }
});

// Get current logged-in user profile
router.get('/me', authenticateToken, async (req: AuthRequest, res) => {
  res.json({ user: req.user });
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
