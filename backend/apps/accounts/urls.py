from django.urls import path
from accounts import views

urlpatterns = [
    path('login', views.login_view, name='auth_login'),
    path('me', views.me_view, name='auth_me'),
    path('demo-users', views.demo_users_view, name='auth_demo_users'),
    path('switch-demo', views.switch_demo_view, name='auth_switch_demo'),
    path('forgot-password', views.forgot_password_view, name='auth_forgot_password'),
    path('reset-password', views.reset_password_view, name='auth_reset_password'),
    path('change-password', views.change_password_view, name='auth_change_password'),
    path('profile', views.update_profile_view, name='auth_update_profile'),
    path('avatar', views.update_avatar_view, name='auth_update_avatar'),
]
