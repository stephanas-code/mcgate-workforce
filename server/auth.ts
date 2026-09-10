import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { queryOne } from './db.ts';

const JWT_SECRET = process.env.JWT_SECRET || 'mcgate_enterprise_jwt_secret_token_2026';

export interface AuthenticatedUser {
  id: number;
  email: string;
  role: 'SUPER_ADMIN' | 'ADMIN' | 'MANAGER' | 'EMPLOYEE';
  status: string;
  employeeId?: number;
  employeeCode?: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  jobTitle?: string;
  avatarUrl?: string;
  departmentId?: number;
  teamId?: number;
  departmentName?: string;
  teamName?: string;
}

export interface AuthRequest extends Request {
  user?: AuthenticatedUser;
}

export function signToken(user: AuthenticatedUser): string {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      employeeId: user.employeeId,
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

export async function getUserProfileById(userId: number): Promise<AuthenticatedUser | null> {
  const row = await queryOne<{
    id: number;
    email: string;
    role: string;
    status: string;
    emp_id?: number;
    employee_code?: string;
    first_name?: string;
    last_name?: string;
    job_title?: string;
    avatar_url?: string;
    department_id?: number;
    team_id?: number;
    dept_name?: string;
    team_name?: string;
  }>(`
    SELECT 
      u.id, u.email, u.role, u.status,
      e.id as emp_id, e.employee_code, e.first_name, e.last_name, e.job_title, e.avatar_url,
      e.department_id, e.team_id,
      d.name as dept_name,
      t.name as team_name
    FROM users u
    LEFT JOIN employees e ON e.user_id = u.id
    LEFT JOIN departments d ON d.id = e.department_id
    LEFT JOIN teams t ON t.id = e.team_id
    WHERE u.id = ?
  `, [userId]);

  if (!row) return null;

  return {
    id: row.id,
    email: row.email,
    role: row.role as any,
    status: row.status,
    employeeId: row.emp_id,
    employeeCode: row.employee_code,
    firstName: row.first_name,
    lastName: row.last_name,
    fullName: row.first_name ? `${row.first_name} ${row.last_name}` : row.email,
    jobTitle: row.job_title,
    avatarUrl: row.avatar_url,
    departmentId: row.department_id,
    teamId: row.team_id,
    departmentName: row.dept_name,
    teamName: row.team_name,
  };
}

export async function authenticateToken(req: AuthRequest, res: Response, next: NextFunction) {
  let token: string | undefined;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (typeof req.query.token === 'string') {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: Missing or invalid token' });
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { id: number };
    const user = await getUserProfileById(decoded.id);

    if (!user) {
      return res.status(401).json({ error: 'User account not found' });
    }
    if (user.status !== 'ACTIVE') {
      return res.status(403).json({ error: 'Account has been deactivated. Please contact HR.' });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized: Session expired or invalid' });
  }
}

export function requireRoles(...allowedRoles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (allowedRoles.includes(req.user.role) || req.user.role === 'SUPER_ADMIN') {
      return next();
    }
    return res.status(403).json({
      error: `Forbidden: This action requires [${allowedRoles.join(', ')}] permissions. Current role: ${req.user.role}`
    });
  };
}
