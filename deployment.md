# McGate Workforce — Vercel Deployment & Cloud Storage Guide (`deployment.md`)

> **Platform**: McGate Workforce Attendance, Task Operations & Resource Platform  
> **Target Environment**: Vercel Serverless Functions + Vercel Blob Storage  
> **Database Compatibility**: Persistent Cloud SQLite (Turso / LibSQL) or Managed Postgres  

---

## 1. Architectural Overview & Why Vercel Requires Cloud Storage

### The Serverless Reality
Vercel is a **stateless, serverless** hosting platform. Unlike a continuous VPS (like cPanel, DigitalOcean, or EC2):
1. **Ephemeral Filesystem**: Any files written to `./data/mcgate.sqlite` or local disk directories are saved in temporary memory (`/tmp`). When the serverless function goes cold (after a few minutes of inactivity) or scales across regions, **all locally saved files are wiped**.
2. **Document Uploads**: Storing uploaded documents (.pdf, .docx, .txt, .md) on the local filesystem or inside SQLite base64 fields will either be erased on cold starts or cause database bloat.
3. **The Solution**:
   - **Persistent File Storage**: Use **Vercel Blob Storage** (`@vercel/blob`) — an S3-compatible, globally cached edge object store tailored specifically for Vercel.
   - **Persistent Database**: Use **Turso** (Serverless SQLite / LibSQL) which keeps 100% of your current SQLite schema and queries without rewriting SQL, or **Vercel Postgres / Neon**.

```
┌─────────────────────────────────────────────────────────────┐
│                    Vercel Global Edge                       │
├──────────────────────────────┬──────────────────────────────┤
│  Client (Vite React SPA)     │  Serverless API (Express)    │
│  - Static Assets on CDN      │  - api/index.ts (Node.js)    │
│  - Instant Global Delivery   │  - Auth & RBAC Middleware    │
└──────────────┬───────────────┴──────────────┬───────────────┘
               │                              │
               ▼                              ▼
     ┌──────────────────┐           ┌──────────────────┐
     │   Vercel Blob    │           │ Cloud Relational │
     │  Storage Engine  │           │   (Turso / Neon) │
     │  - Documents     │           │  - Users         │
     │  - Avatars       │           │  - Tasks         │
     │  - Secure URLs   │           │  - Audit Logs    │
     └──────────────────┘           └──────────────────┘
```

---

## 2. Vercel Configuration File (`vercel.json`)

Create a `vercel.json` file in your project root:

```json
{
  "version": 2,
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite",
  "rewrites": [
    {
      "source": "/api/(.*)",
      "destination": "/api/index.ts"
    },
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

---

## 3. Serverless API Entrypoint (`api/index.ts`)

Create an `api/index.ts` file in your repository. This wraps your Express server into a Vercel Serverless Function:

```typescript
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

// Security headers
app.disable('x-powered-by');
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
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
  res.json({ status: 'ok', platform: 'McGate Workforce on Vercel', timestamp: new Date().toISOString() });
});

// Lazy DB initialization on cold start
let dbReady: Promise<void> | null = null;
app.use(async (_req, _res, next) => {
  if (!dbReady) {
    dbReady = initDatabase().catch((err) => {
      console.error('Failed to initialize database on cold start:', err);
      dbReady = null;
    });
  }
  await dbReady;
  next();
});

export default app;
```

---

## 4. File Uploads with Vercel Blob Storage

### Step 4.1: Install the Vercel Blob Client
Run this in your terminal:
```bash
npm install @vercel/blob
```

### Step 4.2: Enable Vercel Blob in Vercel Dashboard
1. Go to your Vercel Project Dashboard.
2. Click on the **Storage** tab.
3. Click **Create Database / Storage** and select **Blob**.
4. Give it a name (e.g., `mcgate-workforce-documents`) and select your region.
5. Click **Create**. Vercel will automatically inject the `BLOB_READ_WRITE_TOKEN` environment variable into your deployment!

### Step 4.3: Implement the Cloud Storage Helper (`server/storage.ts`)

Create `server/storage.ts`:

```typescript
import { put, del, head } from '@vercel/blob';

/**
 * Upload a document buffer or base64 string to Vercel Blob Storage
 * @param filename File name (e.g. 'StorePro_Spec.pdf')
 * @param data Binary Buffer or base64 string
 * @param mimeType MIME content type
 * @returns Public or private access CDN URL
 */
export async function uploadToStorage(
  filename: string,
  data: Buffer | string,
  mimeType: string
): Promise<{ url: string; size: number }> {
  // If running locally without Vercel Blob token, fall back to local buffer
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.warn('[Storage] BLOB_READ_WRITE_TOKEN missing. Operating in memory fallback.');
    const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data, 'base64');
    return {
      url: `data:${mimeType};base64,${buffer.toString('base64')}`,
      size: buffer.length
    };
  }

  const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data, 'base64');
  const uniqueName = `documents/${Date.now()}-${filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

  const blob = await put(uniqueName, buffer, {
    access: 'public', // Fast CDN access for PDFs and Docs
    contentType: mimeType,
    token: process.env.BLOB_READ_WRITE_TOKEN
  });

  return {
    url: blob.url,
    size: buffer.length
  };
}

/**
 * Delete a document from Vercel Blob Storage
 */
export async function deleteFromStorage(blobUrl: string): Promise<void> {
  if (!process.env.BLOB_READ_WRITE_TOKEN || !blobUrl.startsWith('http')) return;
  try {
    await del(blobUrl, { token: process.env.BLOB_READ_WRITE_TOKEN });
  } catch (err) {
    console.error('[Storage] Error deleting blob:', err);
  }
}
```

### Step 4.4: Update Project Document Upload in `projectRoutes.ts`
Inside `POST /api/projects/:id/documents`:

```typescript
import { uploadToStorage, deleteFromStorage } from '../storage.ts';

// Inside your upload loop:
const { url: storageUrl, size: finalSize } = await uploadToStorage(
  safeOriginalName,
  rawBytes || fileData,
  mimeType
);

// Save storageUrl in project_documents instead of large base64 strings!
await execute(`
  INSERT INTO project_documents (
    project_id, filename, original_name, file_size, file_extension,
    mime_type, file_data, uploaded_by_user_id, uploaded_by_name, created_at
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`, [
  projectId,
  safeStorageName,
  safeOriginalName,
  finalSize,
  rawExt,
  mimeType,
  storageUrl, // <-- Persistent Vercel Blob URL
  req.user!.id,
  req.user!.fullName || req.user!.email,
  now
]);
```

### Step 4.5: Previewing Documents from Vercel Blob
Because Vercel Blob returns a secure, high-speed CDN URL (e.g. `https://xxx.public.blob.vercel-storage.com/documents/StorePro.pdf`):
- **PDFs**: The `<object data={doc.file_data} type="application/pdf">` in [src/components/ProjectDetailsModal.tsx](file:///c:/Users/Defendatafrika/Desktop/workspace/mcgate-workforce/src/components/ProjectDetailsModal.tsx) opens the PDF instantly with full zoom and print controls.
- **Word & Markdown Docs**: For text extraction, the server can stream the file directly from the Blob URL using `fetch(doc.file_data)`.

---

## 5. Database Persistence on Vercel: Turso (Zero SQL Rewrites)

Since SQLite cannot write to read-only disks, the recommended database for Vercel is **Turso**:
- **Why Turso?** Turso is serverless SQLite. You don't have to rewrite any SQL schemas, queries, or functions.
- **Cost**: Free tier includes 9GB storage and 500 databases.

### Setting up Turso:
1. Install Turso CLI:
   ```bash
   curl -sSfL https://get.tur.so/install.sh | bash
   # On Windows (PowerShell):
   # irm https://get.tur.so/install.ps1 | iex
   ```
2. Login and create database:
   ```bash
   turso auth signup
   turso db create mcgate-db
   turso db tokens create mcgate-db
   ```
3. Copy your database URL (`libsql://mcgate-db-xxx.turso.io`) and Auth Token.
4. Install `@libsql/client`:
   ```bash
   npm install @libsql/client
   ```

In `server/db.ts`, swap out `sql.js` for `@libsql/client` when `process.env.TURSO_DATABASE_URL` is set:
```typescript
import { createClient } from '@libsql/client';

export const dbClient = process.env.TURSO_DATABASE_URL
  ? createClient({
      url: process.env.TURSO_DATABASE_URL,
      authToken: process.env.TURSO_AUTH_TOKEN
    })
  : null;
```

---

## 6. Vercel Environment Variables Checklist

Navigate to **Project Settings ➔ Environment Variables** in Vercel and add:

| Variable Name | Description | Example Value |
|---|---|---|
| `NODE_ENV` | Production mode | `production` |
| `JWT_SECRET` | 32+ character crypto string | `mgt_secret_7f8a92b3c4d5e6f7...` |
| `BLOB_READ_WRITE_TOKEN` | Injected automatically by Vercel Blob | `vercel_blob_rw_...` |
| `TURSO_DATABASE_URL` | Cloud SQLite URL (Optional if using Turso) | `libsql://mcgate-db-user.turso.io` |
| `TURSO_AUTH_TOKEN` | Auth token for Turso | `eyJhbGciOi...` |

---

## 7. Step-by-Step Deployment Commands

### Option A: Direct CLI Deployment
1. Install Vercel CLI globally:
   ```bash
   npm install -g vercel
   ```
2. Link your workspace to Vercel:
   ```bash
   vercel login
   vercel link
   ```
3. Pull environment variables:
   ```bash
   vercel env pull .env.production
   ```
4. Deploy to Production:
   ```bash
   vercel --prod
   ```

### Option B: GitHub Automated Git-Push Deployments (Recommended)
1. Initialize git and commit:
   ```bash
   git add .
   git commit -m "feat: enterprise deployment ready with vercel storage"
   git push origin main
   ```
2. Go to **vercel.com/new** and import your GitHub repository.
3. Keep default settings:
   - **Framework Preset**: Vite
   - **Root Directory**: `./`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. Attach your **Vercel Blob** database from the Storage tab.
5. Click **Deploy**.

---

## 8. Post-Deployment Verification

1. **Verify Health Endpoint**:
   ```bash
   curl https://your-project.vercel.app/api/health
   ```
   *Expected Response*: `{"status":"ok","platform":"McGate Workforce on Vercel",...}`
2. **Verify Document Upload**:
   - Log in using your Super User credentials (`superuser@mcgate.tech` / `password123`).
   - Create a project or open an existing project.
   - Attach a `.pdf` or `.docx` document.
   - Confirm the document uploads and previews with zero blank white screens.
3. **Verify Security Headers**:
   ```bash
   curl -I https://your-project.vercel.app/api/health
   ```
   *Expected Headers*: `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Content-Security-Policy`.
