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

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Basic security headers and JSON parsing
  app.use(express.json({ limit: '35mb' }));
  app.use(express.urlencoded({ extended: true, limit: '35mb' }));

  // Prevent caching of API responses
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
