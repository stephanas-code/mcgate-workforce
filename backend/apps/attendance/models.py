from django.db import models
from django.conf import settings
from django.utils import timezone


class AttendanceStatus(models.TextChoices):
    PRESENT = 'PRESENT', 'Present'
    COMPLETED = 'COMPLETED', 'Completed'
    NO_CLOCK_OUT = 'NO_CLOCK_OUT', 'No Clock Out'
    LATE = 'LATE', 'Late'
    HALF_DAY = 'HALF_DAY', 'Half Day'


class WorkSessionStatus(models.TextChoices):
    ACTIVE = 'ACTIVE', 'Active'
    CLOSED = 'CLOSED', 'Closed'
    CORRECTED = 'CORRECTED', 'Corrected'


class Attendance(models.Model):
    employee = models.ForeignKey(
        'organization.Employee',
        on_delete=models.CASCADE,
        related_name='attendances'
    )
    date = models.CharField(max_length=20, db_index=True)  # YYYY-MM-DD
    clock_in_time = models.CharField(max_length=50)        # ISO-8601 string
    clock_out_time = models.CharField(max_length=50, null=True, blank=True)
    duration_minutes = models.IntegerField(null=True, blank=True)
    duration_formatted = models.CharField(max_length=50, null=True, blank=True)
    ip_address = models.CharField(max_length=100, null=True, blank=True)
    device_info = models.TextField(null=True, blank=True)
    location_info = models.TextField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=AttendanceStatus.choices, default=AttendanceStatus.PRESENT)
    work_session_id = models.CharField(max_length=100, unique=True)
    is_manually_corrected = models.IntegerField(default=0)
    corrected_by_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='attendance_corrections'
    )
    correction_reason = models.TextField(null=True, blank=True)
    corrected_at = models.CharField(max_length=50, null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'attendance'
        ordering = ['-date', '-created_at']
        constraints = [
            models.UniqueConstraint(fields=['employee', 'date'], name='unq_employee_daily_attendance')
        ]

    def __str__(self):
        return f"{self.employee.employee_code} - {self.date} ({self.status})"


class WorkSession(models.Model):
    session_id = models.CharField(max_length=100, unique=True)
    employee = models.ForeignKey(
        'organization.Employee',
        on_delete=models.CASCADE,
        related_name='work_sessions'
    )
    attendance = models.ForeignKey(
        Attendance,
        on_delete=models.CASCADE,
        related_name='work_sessions'
    )
    start_time = models.CharField(max_length=50)
    end_time = models.CharField(max_length=50, null=True, blank=True)
    status = models.CharField(max_length=20, choices=WorkSessionStatus.choices, default=WorkSessionStatus.ACTIVE)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = 'work_sessions'
        ordering = ['-start_time']

    def __str__(self):
        return f"Session {self.session_id} - {self.employee.employee_code} ({self.status})"
