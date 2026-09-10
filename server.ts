import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { initDatabase } from './server/schema.ts';

import authRoutes from './server/routes/authRoutes.ts';
import attendanceRoutes from './server/routes/attendanceRoutes.ts';
import taskRoutes from './server/routes/taskRoutes.ts';
import assignmentRoutes from './server/routes/assignmentRoutes.ts';
import projectRoutes from './server/routes/projectRoutes.ts';
import teamRoutes from './server/routes/teamRoutes.ts';
import reportRoutes from './server/routes/reportRoutes.ts';
import auditRoutes from './server/routes/auditRoutes.ts';
import notificationRoutes from './server/routes/notificationRoutes.ts';
import settingRoutes from './server/routes/settingRoutes.ts';
import searchRoutes from './server/routes/searchRoutes.ts';
import systemRoutes from './server/routes/systemRoutes.ts';

// Global error containment to guarantee high availability
process.on('uncaughtException', (err) => {
  console.error('[Process UncaughtException]', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('[Process UnhandledRejection]', reason);
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Disable fingerprinting header
  app.disable('x-powered-by');

  // Strict payload limits to prevent buffer exhaustion / DoS
  app.use(express.json({ limit: '15mb' }));
  app.use(express.urlencoded({ extended: true, limit: '15mb' }));

  // Comprehensive Enterprise HTTP Security Headers
  app.use((_req, res, next) => {
    // MIME-type sniffing defense
    res.setHeader('X-Content-Type-Options', 'nosniff');
    // Clickjacking defense
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    // Legacy XSS filter
    res.setHeader('X-XSS-Protection', '1; mode=block');
    // Enforce HTTPS in production
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    // Referrer confidentiality
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    // Hardware API isolation
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    // Content Security Policy
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob:; object-src 'self' blob:; connect-src 'self' ws: http: https:; frame-src 'self' blob:; frame-ancestors 'self';"
    );
    next();
  });

  // Prevent caching of confidential API responses
  app.use('/api', (_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    next();
  });

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      platform: 'McGate Technologies Enterprise Platform',
      timestamp: new Date().toISOString()
    });
  });

  // Mount API modules
  app.use('/api/auth', authRoutes);
  app.use('/api/attendance', attendanceRoutes);
  app.use('/api/tasks', taskRoutes);
  app.use('/api/assignments', assignmentRoutes);
  app.use('/api/projects', projectRoutes);
  app.use('/api', teamRoutes); // Mounts /api/departments, /api/teams, /api/employees
  app.use('/api/reports', reportRoutes);
  app.use('/api/audit-logs', auditRoutes);
  app.use('/api/notifications', notificationRoutes);
  app.use('/api/settings', settingRoutes);
  app.use('/api/search', searchRoutes);
  app.use('/api/system', systemRoutes);

  // Global safe error handling middleware (Never leak stack traces in production)
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('[API Server Error]', err);
    if (err.type === 'entity.too.large') {
      return res.status(413).json({ error: 'Payload exceeds the 15MB file size boundary.' });
    }
    res.status(err.status || 500).json({ error: 'An internal server error occurred.' });
  });

  // Initialize relational schema and seed initial enterprise data
  try {
    await initDatabase();
    console.log('[Database] McGate Technologies relational database is ready.');
  } catch (err) {
    console.error('[Database] Failed to initialize relational database:', err);
  }

  // Vite development middleware or static production serving
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[McGate Server] Running on port ${PORT}`);
  });
}

startServer();
