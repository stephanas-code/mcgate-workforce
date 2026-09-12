import os
from pathlib import Path
from django.conf import settings
from django.http import HttpResponse, FileResponse, JsonResponse
from django.db import connection

TEMPLATES_DIST = settings.BASE_DIR / 'templates' / 'dist'
ROOT_DIST = settings.BASE_DIR.parent / 'dist'


def health_check(request):
    """
    Liveness probe endpoint for Kubernetes.
    Returns 200 OK to confirm the web process is running.
    """
    return JsonResponse({"status": "healthy", "service": "mcgate-workforce"})


def readiness_check(request):
    """
    Readiness probe endpoint for Kubernetes.
    Verifies database connectivity before accepting incoming user traffic.
    """
    try:
        connection.ensure_connection()
        return JsonResponse({"status": "ready", "database": "connected"})
    except Exception as e:
        return JsonResponse({"status": "unready", "database": str(e)}, status=503)


def get_dist_root():
    if TEMPLATES_DIST.exists():
        return TEMPLATES_DIST
    return ROOT_DIST


def serve_spa(request, *args, **kwargs):
    """
    Serves the Single Page Application index.html directly from templates/dist/ or dist/.
    """
    dist_dir = get_dist_root()
    index_path = dist_dir / 'index.html'

    if index_path.exists():
        return FileResponse(open(index_path, 'rb'), content_type='text/html')

    return HttpResponse(
        """
        <!DOCTYPE html>
        <html>
        <head><title>McGate Workforce - Build Required</title></head>
        <body style="font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 90vh; background: #0b0f19; color: #f3f4f6;">
            <div style="text-align: center; max-width: 500px; padding: 30px; background: #111827; border-radius: 12px; border: 1px solid #374151;">
                <h2 style="color: #60a5fa;">Frontend Assets Not Found</h2>
                <p style="color: #9ca3af; font-size: 14px;">The compiled web application was not found in <code>templates/dist/</code> or <code>dist/</code>.</p>
                <p style="color: #d1d5db; font-size: 13px;">Please run <code>npm run build</code> to compile the client-side bundle.</p>
            </div>
        </body>
        </html>
        """,
        status=503
    )

