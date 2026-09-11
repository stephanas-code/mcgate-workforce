# McGate Workforce — Production Deployment Guide

This repository supports turnkey deployment on **cPanel / CloudLinux Hosting (via Phusion Passenger WSGI)** as well as **Vercel Serverless**.

For the dedicated cPanel step-by-step walkthrough, see **[CPANEL_DEPLOYMENT.md](CPANEL_DEPLOYMENT.md)**.

---

## 🚀 Option 1: cPanel / CloudLinux Deployment (Recommended)

### ⚡ 1-Command Automated Packaging
Generate the deployment bundle directly from your workspace:

```bash
npm run cpanel:zip
```
*(Or run `powershell -ExecutionPolicy Bypass -File .\build_cpanel_zip.ps1`)*

> **Generated Artifact**: `cpanel-mcgate-workforce.zip` (~0.22 MB) containing the complete standalone Django backend, pre-seeded SQLite database, compiled React 19 SPA, and Passenger WSGI entrypoints.

---

### Step-by-Step cPanel Setup

1. **Upload & Extract**:
   - Open cPanel **File Manager**.
   - Navigate to your domain directory (e.g. `public_html` or `workforce.mcgate.tech`).
   - Upload **`cpanel-mcgate-workforce.zip`** and click **Extract**.

2. **Setup Python App**:
   - In cPanel, click **Setup Python App** (under *Software*).
   - Click **Create Application**:
     - **Python Version**: `3.11.x` or `3.12.x`
     - **Application Root**: Domain folder (e.g. `public_html` or `workforce.mcgate.tech`)
     - **Application URL**: Select your domain / subdomain
     - **Application Startup File**: `passenger_wsgi.py`
     - **Application Entry Point**: `application`
   - Click **Create**.

3. **Install Dependencies**:
   - Under *Configuration files*, enter `requirements.txt` and click **Add**.
   - Click **Run Pip Install**.

4. **Restart & Launch**:
   - Click **Restart Application**.
   - Open your domain URL in your browser.

---

## 🔑 Pre-Seeded Login Credentials

| Role | Corporate Email | Employee Code | Default Password |
| :--- | :--- | :--- | :--- |
| **Super Admin** | `superuser@mcgate.tech` | `SU-001` | `password123` |
| **Super Admin** | `stephenosanebi@gmail.com` | `MGT-000` | `password123` |
| **Lead Colleague** | `stephanas.odogu@miva.edu.ng` | `MGT-004` | `password123` |
| **Lead Colleague** | `meshack.ossai@mcgatetechnologies.com` | `MGT-002` | `password123` |

> *Tip: You can authenticate using either your **Corporate Email** or your **Employee Code**.*

---

## ☁️ Option 2: Vercel Serverless Deployment

1. **Push to GitHub**:
   ```bash
   git add .
   git commit -m "deploy: ready for production"
   git push origin main
   ```
2. **Import on Vercel**:
   - Select your `mcgate-workforce` repo on Vercel.
   - Framework preset: `Vite`.
   - Build command: `npx vite build`.
   - Output directory: `dist`.
3. **Database on Vercel**:
   - Supply `DATABASE_URL` (e.g. Neon PostgreSQL, Supabase, or Railway) in Vercel environment variables for permanent data persistence.
