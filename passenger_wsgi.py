import os
import sys
from pathlib import Path

# ==============================================================================
# McGate Workforce - Phusion Passenger WSGI Entrypoint (cPanel / CloudLinux)
# ==============================================================================

CURRENT_DIR = Path(__file__).resolve().parent

# Support running when Application Root is set to repository root or backend/
if (CURRENT_DIR / 'backend').exists():
    BACKEND_DIR = CURRENT_DIR / 'backend'
else:
    BACKEND_DIR = CURRENT_DIR

APPS_DIR = BACKEND_DIR / 'apps'

# Inject into Python sys.path
for path_to_add in (str(BACKEND_DIR), str(APPS_DIR), str(CURRENT_DIR)):
    if path_to_add not in sys.path:
        sys.path.insert(0, path_to_add)

# Set Django settings module
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'mcgate_backend.settings')

# Initialize Django
import django
django.setup()

# Safety Check: Auto-migrate & seed if running fresh on cPanel without pre-populated DB
try:
    from django.db import connection
    from django.core.management import call_command

    table_names = connection.introspection.table_names()
    if 'users' not in table_names:
        print("[cPanel Passenger Boot] Initializing database tables...")
        call_command('migrate', interactive=False)
        print("[cPanel Passenger Boot] Seeding enterprise baseline...")
        call_command('seed_enterprise', interactive=False)
except Exception as boot_err:
    print(f"[cPanel Passenger Boot Notice] {boot_err}")

# Expose WSGI application callable for Phusion Passenger
from django.core.wsgi import get_wsgi_application
application = get_wsgi_application()
