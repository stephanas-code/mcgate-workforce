# McGate Workforce

**McGate Workforce** is a full-stack enterprise workforce management platform built with **Python Django 5.x + Django REST Framework** (backend) and **React 19 + Vite** (frontend). The Django backend serves the compiled React SPA directly — no separate frontend server required.

---

## 🖥️ Running Locally

### Prerequisites

| Requirement | Version |
| :--- | :--- |
| Python | 3.11+ |
| Node.js | 18+ |
| npm | 9+ |
| Git | any |

---

### Step 1 — Clone the Repository

```bash
git clone https://github.com/stephanas-code/mcgate-workforce.git
cd mcgate-workforce
```

---

### Step 2 — Create & Activate Python Virtual Environment

**Windows:**
```bash
python -m venv venv
.\venv\Scripts\activate
```

**macOS / Linux:**
```bash
python3 -m venv venv
source venv/bin/activate
```

---

### Step 3 — Install Python Dependencies

```bash
pip install -r requirements.txt
```

---

### Step 4 — Install Node.js Dependencies & Build the Frontend

```bash
npm install
npm run build
```

This compiles the React 19 frontend and places the bundle into `dist/` and syncs it into `backend/templates/dist/` so Django can serve it.

---

### Step 5 — Set Up the Database

Run Django migrations and seed the enterprise baseline (departments, teams, and default user accounts):

```bash
python backend/manage.py migrate
python backend/manage.py seed_enterprise
```

---

### Step 6 — Start the Application

```bash
python backend/manage.py runserver
```

Or using the npm alias:

```bash
npm run dev
```

The full application — frontend + backend API — is now running at:

> **http://127.0.0.1:8000**

No separate `npm run dev` frontend server is needed. Django serves everything.

---

## 🔑 Default Login Credentials

Log in using either the **Corporate Email** or the **Employee Code**:

| Role | Corporate Email | Employee Code | Password |
| :--- | :--- | :--- | :--- |
| Super Admin | `superuser@mcgate.tech` | `SU-001` | `password123` |
| Super Admin | `stephenosanebi@gmail.com` | `MGT-000` | `password123` |
| Employee | `stephanas.odogu@miva.edu.ng` | `MGT-004` | `password123` |
| Employee | `meshack.ossai@mcgatetechnologies.com` | `MGT-002` | `password123` |

> **Tip:** Users can authenticate using either their email or their employee code (e.g. `SU-001`).

---

## 🌐 API Proxy (Frontend Development Mode)

If you want to run the **Vite dev server** for hot-module reloading during frontend development, start the Django backend first (port 8000), then in a second terminal:

```bash
npm run dev   # starts Vite on port 3000 with /api proxy → 127.0.0.1:8000
```

All `/api/...` requests are automatically proxied to the Django backend via [`vite.config.ts`](vite.config.ts).

---

## 🗄️ Django Admin Panel

Access the built-in Django admin panel at:

> **http://127.0.0.1:8000/django-admin/**

Log in with `superuser@mcgate.tech` / `password123`.

---

## 📁 Project Structure

```
mcgate-workforce/
├── backend/                   # Django 5.x backend
│   ├── manage.py
│   ├── passenger_wsgi.py      # cPanel Passenger entrypoint
│   ├── requirements.txt
│   ├── mcgate_backend/        # Project settings, urls, wsgi
│   ├── apps/
│   │   ├── accounts/          # Auth, JWT, DualAuthBackend
│   │   ├── organization/      # Departments, Teams, Employees
│   │   ├── attendance/        # Clock-in/out, live dashboard
│   │   ├── projects/          # Project CRUD, code generation
│   │   ├── tasks/             # Milestones, Task assignments
│   │   ├── reports/           # Attendance & task analytics
│   │   ├── system/            # Audit logs, diagnostics, search
│   │   └── core/              # Seed command, utils, permissions
│   ├── data/                  # SQLite database (auto-created)
│   └── templates/dist/        # Compiled React SPA (auto-populated by npm run build)
├── src/                       # React 19 + TypeScript frontend source
├── dist/                      # Vite build output
├── passenger_wsgi.py          # Root cPanel Passenger entrypoint
├── build_cpanel_zip.ps1       # cPanel deployment packaging script
├── CPANEL_DEPLOYMENT.md       # Full cPanel deployment guide
├── deployment.md              # Deployment quick reference
├── vite.config.ts
└── package.json
```

---

## 🚀 Deployment

| Platform | Method | Guide |
| :--- | :--- | :--- |
| **cPanel / CloudLinux** | Phusion Passenger WSGI | [CPANEL_DEPLOYMENT.md](CPANEL_DEPLOYMENT.md) |
| **Vercel** | Serverless Django + Vite | [deployment.md](deployment.md) |

### Quick cPanel Package

```bash
npm run cpanel:zip
```

Generates **`cpanel-mcgate-workforce.zip`** — upload it directly to cPanel File Manager and follow [CPANEL_DEPLOYMENT.md](CPANEL_DEPLOYMENT.md).
