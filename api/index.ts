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

// Cold-start database initialization - MUST run before route handlers
let dbInitPromise: Promise<void> | null = null;
app.use(async (_req, _res, next) => {
  try {
    if (!dbInitPromise) {
      dbInitPromise = initDatabase().catch((err) => {
        console.error('[Vercel DB Init Error]:', err);
        dbInitPromise = null;
        throw err;
      });
    }
    await dbInitPromise;
    next();
  } catch (err) {
    console.error('[Vercel DB Init Middleware Failed]:', err);
    next(err);
  }
});

// Health check endpoints
const healthHandler = (_req: express.Request, res: express.Response) => {
  res.json({
    status: 'ok',
    platform: 'McGate Workforce on Vercel Serverless',
    database: 'initialized',
    timestamp: new Date().toISOString()
  });
};

app.get('/health', healthHandler);
app.get('/api/health', healthHandler);

// API Router configuration
const apiRouter = express.Router();

apiRouter.get('/health', healthHandler);
apiRouter.use('/auth', authRoutes);
apiRouter.use('/attendance', attendanceRoutes);
apiRouter.use('/tasks', taskRoutes);
apiRouter.use('/assignments', assignmentRoutes);
apiRouter.use('/projects', projectRoutes);
apiRouter.use('/', teamRoutes);
apiRouter.use('/reports', reportRoutes);
apiRouter.use('/audit-logs', auditRoutes);
apiRouter.use('/notifications', notificationRoutes);
apiRouter.use('/settings', settingRoutes);
apiRouter.use('/search', searchRoutes);

// Mount router at both /api and root to handle any Vercel URL rewrite behavior
app.use('/api', apiRouter);
app.use('/', apiRouter);

// Global Error Handler for Vercel functions
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[Vercel Serverless Function Error]:', err);
  const status = typeof err.status === 'number' ? err.status : 500;
  res.status(status).json({
    error: err.message || 'Internal Server Error',
    code: err.code || 'INTERNAL_SERVER_ERROR',
    stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined
  });
});

export default app;
