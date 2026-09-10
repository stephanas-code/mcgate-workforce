import express from 'express';
import authRoutes from '../server/routes/authRoutes.ts';
import attendanceRoutes from '../server/routes/attendanceRoutes.ts';
import taskRoutes from '../server/routes/taskRoutes.ts';
import assignmentRoutes from '../server/routes/assignmentRoutes.ts';
import projectRoutes from '../server/routes/projectRoutes.ts';
import teamRoutes from '../server/routes/teamRoutes.ts';
import reportRoutes from '../server/routes/reportRoutes.ts';
import auditRoutes from '../server/routes/auditRoutes.ts';
import notificationRoutes from '../server/routes/notificationRoutes.ts';
import settingRoutes from '../server/routes/settingRoutes.ts';
import searchRoutes from '../server/routes/searchRoutes.ts';
import { initDatabase } from '../server/schema.ts';

const app = express();

app.disable('x-powered-by');
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Enterprise Security Headers
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// Mount Routes
app.use('/api/auth', authRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/assignments', assignmentRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api', teamRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/audit-logs', auditRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/settings', settingRoutes);
app.use('/api/search', searchRoutes);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    platform: 'McGate Workforce on Vercel Serverless',
    timestamp: new Date().toISOString()
  });
});

// Cold-start database initialization
let dbInitPromise: Promise<void> | null = null;
app.use(async (_req, _res, next) => {
  if (!dbInitPromise) {
    dbInitPromise = initDatabase().catch((err) => {
      console.error('[Vercel DB Init Error]', err);
      dbInitPromise = null;
    });
  }
  await dbInitPromise;
  next();
});

export default app;
