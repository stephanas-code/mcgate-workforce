from django.urls import path
from reports import views

urlpatterns = [
    path('reports/attendance', views.attendance_report_view, name='reports_attendance'),
    path('reports/tasks', views.tasks_report_view, name='reports_tasks'),
    path('reports/export', views.export_report_csv_view, name='reports_export'),
]
