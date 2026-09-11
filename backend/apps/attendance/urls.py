from django.urls import path
from attendance import views

urlpatterns = [
    path('attendance/clock-in', views.clock_in_view, name='attendance_clock_in'),
    path('attendance/clock-out', views.clock_out_view, name='attendance_clock_out'),
    path('attendance/me', views.my_attendance_view, name='attendance_me'),
    path('attendance/live', views.live_attendance_view, name='attendance_live'),
    path('attendance/correct', views.correct_attendance_view, name='attendance_correct'),
]
