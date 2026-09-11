# McGate Workforce — Simple Vercel Deployment Guide

Deploying McGate Workforce on **Vercel** is 100% automated and takes less than 2 minutes. Unlike cPanel, there is **no FTP uploading, no Apache/Nginx configuration, and no manual file management**.

---

## ⚡ 1-Click / 3-Step Deployment (The Easiest Way)

### Step 1: Push Your Code to GitHub
Open your terminal in the project folder and push:
```bash
git add .
git commit -m "deploy: ready for vercel"
git push origin main
```

---

### Step 2: Import Project on Vercel
1. Go to [vercel.com](https://vercel.com) and log in.
2. Click **"Add New..." ➔ "Project"**.
3. Select your **mcgate-workforce** GitHub repository and click **Import**.
4. **Leave all build settings as default**:
   - **Framework Preset**: `Vite` (automatically detected)
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
5. Click **Deploy**.

*Vercel will automatically compile the React frontend, install Python dependencies, configure the Django serverless function, and give you a live URL like `https://mcgate-workforce.vercel.app`.*

---

### Step 3: Log In to Your Live App
Once Vercel finishes deploying, open your live URL!

The database automatically initializes and pre-seeds all corporate accounts on the first request:

| User | Role | Corporate Email | Employee Code | Password |
|---|---|---|---|---|
| **Super Administrator** | Super Admin | `superuser@mcgate.tech` | `SU-001` | `password123` |
| **Principal Admin** | Super Admin | `stephenosanebi@gmail.com` | `MGT-000` | `password123` |
| **Stephanas Odogu** | Employee | `stephanas.odogu@miva.edu.ng` | `MGT-004` | `password123` |
| **Meshack Ossai** | Employee | `meshack.ossai@mcgatetechnologies.com` | `MGT-002` | `password123` |

> 💡 **Dual Login Feature**: You can log in using either the **Corporate Email** or the **Employee Code**!

---

## 💾 Permanent Production Database (Recommended)

By default, Vercel Serverless runs in-memory SQLite (`/tmp/mcgate.sqlite3`), which is great for instant testing and demos.

For permanent long-term data persistence (so records stay saved permanently across serverless cold starts):

### Option A: 1-Click Vercel Postgres / Neon (Free)
1. In your Vercel Project Dashboard, click the **Storage** tab.
2. Click **Create Database** ➔ choose **Neon** or **Postgres** (Free tier).
3. Click **Connect to Project** and select your `mcgate-workforce` deployment.
4. Vercel automatically creates and injects the `DATABASE_URL` environment variable for you!
5. Trigger a quick redeploy (click **Redeploy** on your latest deployment).

*Done! Django automatically detects `DATABASE_URL`, runs migrations, and seeds the corporate directory.*

### Option B: External Postgres (Supabase, Railway, AWS, etc.)
If you already have a Postgres database URL:
1. In your Vercel Project, go to **Settings ➔ Environment Variables**.
2. Add a new variable:
   - **Key**: `DATABASE_URL`
   - **Value**: `postgres://user:password@host:port/dbname?sslmode=require`
3. Click **Save** and redeploy.

---

## 🛠️ How Vercel Runs McGate Workforce (Under the Hood)

Vercel uses standard pre-configured files already included in this repository:

| File | What it Does |
|---|---|
| [`vercel.json`](file:///c:/Users/Defendatafrika/Desktop/workspace/mcgate-workforce/vercel.json) | Routes `/api/*` requests to the Python Django backend and all other page routes to the React SPA. |
| [`requirements.txt`](file:///c:/Users/Defendatafrika/Desktop/workspace/mcgate-workforce/requirements.txt) | Tells Vercel which Python packages to install (`Django`, `djangorestframework`, `dj-database-url`, etc.). |
| [`api/index.py`](file:///c:/Users/Defendatafrika/Desktop/workspace/mcgate-workforce/api/index.py) | The serverless Python entrypoint. It automatically migrates and seeds the database on cold boot. |
| [`package.json`](file:///c:/Users/Defendatafrika/Desktop/workspace/mcgate-workforce/package.json) | Runs `vite build` during deployment to compile the React frontend. |

---

## 💻 Running Locally on Your Machine

If you want to test or develop locally on your computer:

```bash
# 1. Start the Python Backend
npm run dev
# (or: .\venv\Scripts\python backend/manage.py runserver 8000)

# 2. Open in your browser:
# http://127.0.0.1:8000
```

---

## ❓ Frequently Asked Questions (FAQ)

#### Why is Vercel easier than cPanel?
- **No manual server setup**: No configuring Apache, PHP/Python modules, WSGI daemons, or cron jobs.
- **Git Continuous Deployment**: Every time you push to GitHub, Vercel rebuilds and deploys automatically.
- **Global CDN**: Your frontend assets are cached across 100+ edge locations worldwide for instant loading.
- **Zero Port Management**: You don't need to configure reverse proxies or open firewall ports.

#### What if I add a new teammate/colleague?
- You can onboard colleagues directly in the web app under **Teams ➔ Add Colleague**.
- The system auto-assigns the next sequential employee code (`MGT-005`, `MGT-006`, etc.).
- They can log in immediately with either their email or employee code.

#### How do I access the Django Admin panel?
- Go to `https://your-domain.vercel.app/django-admin/` or `http://127.0.0.1:8000/django-admin/`.
- Log in with your Super Administrator credentials (`superuser@mcgate.tech` / `password123`).
