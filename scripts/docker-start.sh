#!/usr/bin/env bash
set -eo pipefail

echo "=========================================="
echo "Starting McGate Workforce Container"
echo "=========================================="

# Ensure media and data directories exist and are writable
mkdir -p /app/media /app/backend/staticfiles /app/backend/data
chown -R mcgate:mcgate /app/media /app/backend/staticfiles /app/backend/data || true

# Wait for DB if DB_HOST is set (e.g. Postgres)
if [ -n "${DB_HOST:-}" ]; then
  echo "Waiting for database at ${DB_HOST}:${DB_PORT:-5432}..."
  for i in {1..30}; do
    if python -c "import socket; s = socket.socket(); s.settimeout(2); s.connect(('${DB_HOST}', int('${DB_PORT:-5432}'))); s.close()" 2>/dev/null; then
      echo "Database is reachable."
      break
    fi
    echo "Database not ready yet, retrying ($i/30)..."
    sleep 2
  done
fi

# Run database migrations
echo "Applying database migrations..."
python backend/manage.py migrate --noinput || {
  echo "Migration failed, continuing startup..."
}

# Collect static files if not already collected
echo "Collecting static files..."
python backend/manage.py collectstatic --noinput || true

# Pre-seed default data if DB is empty
echo "Ensuring seed data..."
python -c "
import os, sys
sys.path.insert(0, '/app/backend')
sys.path.insert(0, '/app/backend/apps')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'mcgate_backend.settings')
import django
django.setup()
from accounts.models import User
if not User.objects.filter(is_superuser=True).exists():
    print('Creating initial superuser: admin@mcgate.com')
    User.objects.create_superuser('admin@mcgate.com', 'Admin User', 'Admin@123456', role='superadmin')
" 2>/dev/null || true

echo "Starting application with command: $@"
exec gosu mcgate "$@"
