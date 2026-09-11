from django.urls import path
from system import views

urlpatterns = [
    # Settings
    path('settings', views.settings_view, name='settings'),
    path('settings/reset-mock-data', views.reset_mock_data_view, name='settings_reset_mock_data'),

    # Audit Logs
    path('audit-logs', views.audit_logs_view, name='audit_logs'),

    # Notifications
    path('notifications', views.notifications_view, name='notifications'),
    path('notifications/read-all', views.mark_all_notifications_read_view, name='notifications_read_all'),
    path('notifications/<int:pk>/read', views.mark_notification_read_view, name='notification_mark_read'),

    # DB diagnostics
    path('system/db-logs', views.db_logs_view, name='system_db_logs'),

    # Global search
    path('search', views.search_global_view, name='search_global'),
]
