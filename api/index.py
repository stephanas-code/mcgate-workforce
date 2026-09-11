import os
import sys
from pathlib import Path

# Add backend and backend/apps to sys.path
BASE_DIR = Path(__file__).resolve().parent.parent
BACKEND_DIR = BASE_DIR / 'backend'
APPS_DIR = BACKEND_DIR / 'apps'

sys.path.insert(0, str(APPS_DIR))
sys.path.insert(0, str(BACKEND_DIR))

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'mcgate_backend.settings')

import django
django.setup()

from django.core.wsgi import get_wsgi_application
from django.core.management import call_command

# Auto-migrate and seed enterprise data if running on serverless
try:
    from django.db import connection
    tables = connection.introspection.table_names()
    if 'users' not in tables:
        print("[Vercel Boot] Initializing database tables...")
        call_command('migrate', interactive=False)
        print("[Vercel Boot] Seeding enterprise directory...")
        call_command('seed_enterprise', interactive=False)
except Exception as e:
    print(f"[Vercel Boot Init Notice] {e}")


# Vercel WSGI entry point
app = get_wsgi_application()
