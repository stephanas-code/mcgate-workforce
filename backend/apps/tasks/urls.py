from django.urls import path
from tasks import views

urlpatterns = [
    # Tasks
    path('tasks', views.tasks_view, name='tasks_list_create'),
    path('tasks/<int:pk>', views.task_detail_view, name='task_detail'),
    path('tasks/<int:pk>/comments', views.task_comments_view, name='task_comments'),
    path('tasks/<int:pk>/attachments', views.task_attachments_view, name='task_attachments'),

    # Assignments
    path('assignments', views.assignments_view, name='assignments_list_create'),
    path('assignments/<int:pk>', views.assignment_detail_view, name='assignment_detail'),
]
