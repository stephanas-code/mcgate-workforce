from django.urls import path
from system import views

urlpatterns = [
    path('db-logs', views.db_logs_view, name='system_db_logs'),
]
