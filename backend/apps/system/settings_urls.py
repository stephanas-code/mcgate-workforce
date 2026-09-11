from django.urls import path
from system import views

urlpatterns = [
    path('', views.settings_view, name='company_settings'),
    path('reset-mock-data', views.reset_mock_data_view, name='reset_mock_data'),
]
