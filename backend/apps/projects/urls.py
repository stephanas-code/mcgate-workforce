from django.urls import path
from projects import views

urlpatterns = [
    path('projects/generate-code', views.generate_code_view, name='projects_generate_code'),
    path('projects', views.projects_view, name='projects_list_create'),
    path('projects/<int:pk>', views.project_detail_view, name='project_detail'),
    path('projects/<int:pk>/documents', views.project_documents_view, name='project_documents'),
    path('projects/<int:pk>/documents/<int:doc_id>', views.project_document_detail_view, name='project_document_detail'),
]
