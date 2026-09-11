from django.urls import path
from tasks import views

urlpatterns = [
    path('', views.assignments_view, name='assignments_list_create'),
    path('<int:pk>', views.assignment_detail_view, name='assignment_detail'),
]
