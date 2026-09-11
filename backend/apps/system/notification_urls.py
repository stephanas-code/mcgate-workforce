from django.urls import path
from system import views

urlpatterns = [
    path('', views.notifications_view, name='notifications_list'),
    path('read-all', views.mark_all_notifications_read_view, name='notifications_read_all'),
    path('<int:pk>/read', views.mark_notification_read_view, name='notification_mark_read'),
]
