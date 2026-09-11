# McGate Workforce — Standalone cPanel Deployment Guide

This guide walks you through deploying **McGate Workforce** to any **cPanel / CloudLinux hosting account** using the native **Setup Python App** (Phusion Passenger WSGI) feature, matching the production architecture of **Vraskel Capital** and **MAFA Group**.

---

## ⚡ Quick 1-Command Automated Packaging

From your local machine inside `mcgate-workforce`:

```bash
npm run cpanel:zip
```
*(Or run `powershell -ExecutionPolicy Bypass -File .\build_cpanel_zip.ps1`)*

> **Output**: Compiles the frontend with Vite, verifies Django checks, seeds the baseline directory, and generates **`cpanel-mcgate-workforce.zip`** (~0.22 MB). It contains the complete standalone Python Django backend, pre-seeded SQLite database, compiled frontend SPA (`templates/dist/`), and Passenger WSGI entrypoints *(excluding local `node_modules` and `.venv` for CloudLinux compliance)*.

---

## 📦 Step-by-Step cPanel Deployment Guide

### Step 1: Upload & Extract on cPanel

1. Log into your **cPanel Dashboard**.
2. Open **File Manager** and navigate to your target domain folder (e.g., `public_html` or a subdomain directory like `workforce.mcgate.tech`).
3. Click **Upload** in the top toolbar and upload **`cpanel-mcgate-workforce.zip`**.
4. Right-click **`cpanel-mcgate-workforce.zip`** and select **Extract** directly into your domain root.
5. *(Optional)* Delete the uploaded `.zip` file after extraction to keep the directory clean.

---

### Step 2: Configure Python Application in cPanel

1. In the cPanel search bar, find and click **Setup Python App** (under the *Software* category).
2. Click **Create Application**.
3. Configure the following settings:
   - **Python version**: Select **`3.11.x`** or **`3.12.x`** (recommended).
   - **Application root**: Enter your application folder path (e.g., `public_html` or `workforce.mcgate.tech`).
   - **Application URL**: Select your domain or subdomain from the dropdown.
   - **Application startup file**: Enter **`passenger_wsgi.py`**.
   - **Application Entry point**: Enter **`application`**.
4. Click **Create** (at the top right).
5. cPanel will generate the Python virtual environment and display a command to activate it at the top of the page.

---

### Step 3: Install Dependencies

1. In the **Setup Python App** screen, scroll down to the **Configuration files** section.
2. In the text box, type **`requirements.txt`** and click **Add**.
3. Click the **Run Pip Install** button next to `requirements.txt`.
4. cPanel will automatically install all required packages (`Django`, `djangorestframework`, `djangorestframework-simplejwt`, `whitenoise`, `Pillow`, `bcrypt`, `pymysql`, etc.) into your isolated virtual environment.

> **Alternative via cPanel Terminal**:
> If you prefer using the terminal, copy the activation command displayed at the top of your Python App page (e.g., `source /home/username/virtualenv/.../bin/activate`), paste it into the cPanel Terminal, and run:
> ```bash
> pip install -r requirements.txt
> ```

---

### Step 4: Environment Variables (Optional)

By default, the application runs immediately with zero environment configuration using the pre-seeded SQLite database. If you wish to customize domain restrictions or security keys, scroll down to **Environment variables** in the Python App manager and add:

| Key | Example Value | Description |
| :--- | :--- | :--- |
| `DEBUG` | `False` | Set to `False` for production security |
| `SECRET_KEY` | `your-secure-random-secret-key-32-chars` | Production secret key |
| `ALLOWED_HOSTS` | `workforce.mcgate.tech,mcgate.tech` | Comma-separated domains allowed to access the app |
| `CSRF_TRUSTED_ORIGINS` | `https://workforce.mcgate.tech` | Full URL for CSRF origin verification |

---

### Step 5: Restart & Access Application

1. Click **Restart Application** at the top of the Python App page.
2. Visit your domain URL in your browser (e.g., `https://workforce.mcgate.tech`).
3. The McGate Workforce login screen will display immediately.

---

## 🔑 Pre-Seeded Login Credentials

The application is pre-seeded with full enterprise access:

| Role | Corporate Email | Employee Code | Default Password | Access Level |
| :--- | :--- | :--- | :--- | :--- |
| **Super Admin** | `superuser@mcgate.tech` | `SU-001` | `password123` | Full System & Diagnostic Access |
| **Super Admin** | `stephenosanebi@gmail.com` | `MGT-000` | `password123` | Full System & Diagnostic Access |
| **Lead Colleague** | `stephanas.odogu@miva.edu.ng` | `MGT-004` | `password123` | Enterprise Workflows & Attendance |
| **Lead Colleague** | `meshack.ossai@mcgatetechnologies.com` | `MGT-002` | `password123` | Enterprise Workflows & Attendance |

> *Note: Users can log in using either their Corporate Email OR their Employee Code.*

---

## 🗄️ Database Options: SQLite vs cPanel MySQL

### Option A: Self-Contained SQLite (Default — Ready Out of the Box)
- Uses `backend/data/mcgate.sqlite3`.
- Requires **zero configuration**. All user accounts, company settings, departments, teams, and sample data are pre-loaded.
- Automatic SQLite directory permissions are handled by `passenger_wsgi.py`.

### Option B: cPanel MySQL / MariaDB Database
If you prefer storing data in MySQL:
1. In cPanel, go to **MySQL Databases**.
2. Create a new database (e.g., `cpaneluser_mcgate`).
3. Create a new MySQL user with a strong password and assign it **ALL PRIVILEGES** to the database.
4. Under **Environment variables** in **Setup Python App**, add:
   - `DB_ENGINE`: `django.db.backends.mysql`
   - `DB_NAME`: `cpaneluser_mcgate`
   - `DB_USER`: `cpaneluser_dbuser`
   - `DB_PASSWORD`: `your-mysql-password`
   - `DB_HOST`: `localhost`
   - `DB_PORT`: `3306`
5. Open cPanel Terminal, activate the virtualenv, and run:
   ```bash
   python backend/manage.py migrate
   python backend/manage.py seed_enterprise
   ```
6. Click **Restart Application**.

---

## 🚨 Resolving Common cPanel Issues

### 1. "Error 500 — Internal Server Error" or "Error 503 — Service Unavailable"
- **Missing Dependencies**: Check that `pip install -r requirements.txt` was executed successfully.
- **Python Version**: Ensure Python is set to **`3.11.x`** or **`3.12.x`** (do not use legacy Python 2.7 or 3.6).
- **Startup File & Entry Point**:
  - Application startup file: `passenger_wsgi.py`
  - Application Entry point: `application`

### 2. Viewing Realtime Error Logs
In cPanel File Manager or Terminal, view the Passenger error log located in your user home directory:
```bash
tail -n 100 /home/username/logs/passenger.log
# OR
tail -n 100 stderr.log
```

### 3. File & Directory Permissions
Ensure web server read/write permissions:
```bash
chmod 755 backend/data
chmod 644 backend/data/mcgate.sqlite3
```

### 4. Admin CSS or Frontend Styling Not Loading
Django's static URL patterns in `backend/mcgate_backend/urls.py` automatically serve compiled assets from `backend/templates/dist/assets/` and static admin styles from `backend/staticfiles/`. If needed, run:
```bash
python backend/manage.py collectstatic --noinput
```
