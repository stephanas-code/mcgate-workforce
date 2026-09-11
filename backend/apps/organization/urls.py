from django.urls import path
from organization import views

urlpatterns = [
    path('departments', views.departments_view, name='departments'),
    path('teams', views.teams_view, name='teams'),
    path('employees', views.employees_view, name='employees'),
    path('employees/next-code', views.next_employee_code_view, name='employee_next_code'),
    path('employees/<int:pk>', views.employee_detail_view, name='employee_detail'),
    path('employees/<int:pk>/avatar', views.employee_avatar_view, name='employee_avatar'),
    path('employees/<int:pk>/reset-password', views.employee_reset_password_view, name='employee_reset_password'),
]
