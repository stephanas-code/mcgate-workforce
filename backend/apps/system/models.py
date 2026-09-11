from django.db import models
from django.conf import settings
from django.utils import timezone as django_timezone


class AuditLog(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='audit_logs'
    )
    user_name = models.CharField(max_length=150)
    user_role = models.CharField(max_length=50)
    action = models.CharField(max_length=100)
    resource = models.CharField(max_length=100)
    resource_id = models.CharField(max_length=100, null=True, blank=True)
    ip_address = models.CharField(max_length=100, null=True, blank=True)
    before_value = models.TextField(null=True, blank=True)
    after_value = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(default=django_timezone.now)

    class Meta:
        db_table = 'audit_logs'
        ordering = ['-created_at']

    def __str__(self):
        return f"[{self.created_at}] {self.user_name} - {self.action} on {self.resource}"


class CompanySetting(models.Model):
    company_name = models.CharField(max_length=200, default='McGate Technologies')
    timezone = models.CharField(max_length=100, default='Europe/Berlin')
    work_start_time = models.CharField(max_length=10, default='08:30')
    work_end_time = models.CharField(max_length=10, default='17:00')
    grace_period_minutes = models.IntegerField(default=15)
    working_days = models.TextField(default='["Monday","Tuesday","Wednesday","Thursday","Friday"]')
    mandatory_clock_in = models.IntegerField(default=1)
    optional_clock_out = models.IntegerField(default=1)
    overdue_notification_hours = models.IntegerField(default=24)
    allow_manual_attendance_correction = models.IntegerField(default=1)
    updated_at = models.DateTimeField(default=django_timezone.now)

    class Meta:
        db_table = 'company_settings'

    def __str__(self):
        return self.company_name


class Notification(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='notifications'
    )
    title = models.CharField(max_length=200)
    message = models.TextField()
    type = models.CharField(max_length=50, default='INFO')
    link = models.CharField(max_length=255, null=True, blank=True)
    is_read = models.IntegerField(default=0)
    created_at = models.DateTimeField(default=django_timezone.now)

    class Meta:
        db_table = 'notifications'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.user.email} - {self.title}"
