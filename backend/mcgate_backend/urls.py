from pathlib import Path
from django.conf import settings
from django.contrib import admin
from django.urls import path, re_path, include
from django.views.static import serve
from core.views import serve_spa, get_dist_root, health_check, readiness_check

dist_dir = get_dist_root()

urlpatterns = [
    # Kubernetes Health & Readiness Probes
    path('health/', health_check, name='k8s_liveness'),
    path('ready/', readiness_check, name='k8s_readiness'),

    path('django-admin/', admin.site.urls),

    # All API endpoints routed under api/
    path('api/auth/', include('accounts.urls')),
    path('api/', include('organization.urls')),
    path('api/', include('attendance.urls')),
    path('api/', include('projects.urls')),
    path('api/', include('tasks.urls')),
    path('api/', include('reports.urls')),
    path('api/', include('system.urls')),

    # Direct static asset serving from compiled frontend (templates/dist/assets/ or dist/assets/)
    re_path(r'^assets/(?P<path>.*)$', serve, {'document_root': str(dist_dir / 'assets')}),
    re_path(r'^(?P<path>favicon\.svg|logo\.svg|favicon\.ico)$', serve, {'document_root': str(dist_dir)}),

    # Direct staticfiles and media serving (guarantees Django admin styles and uploads work on cPanel)
    re_path(r'^static/(?P<path>.*)$', serve, {'document_root': str(settings.STATIC_ROOT)}),
    re_path(r'^media/(?P<path>.*)$', serve, {'document_root': str(settings.MEDIA_ROOT)}),

    # Single Page Application catch-all: serves index.html for all non-API client routes
    re_path(r'^(?!api/|django-admin/|health/|ready/|assets/|static/|media/).*$', serve_spa, name='spa_root'),
]
