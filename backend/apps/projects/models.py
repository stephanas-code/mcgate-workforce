from django.db import models
from django.conf import settings
from django.utils import timezone


class ProjectStatus(models.TextChoices):
    PLANNING = 'PLANNING', 'Planning'
    ACTIVE = 'ACTIVE', 'Active'
    ON_HOLD = 'ON_HOLD', 'On Hold'
    COMPLETED = 'COMPLETED', 'Completed'
    ARCHIVED = 'ARCHIVED', 'Archived'


class Project(models.Model):
    code = models.CharField(max_length=50, unique=True, db_index=True)
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True, default='')
    manager = models.ForeignKey(
        'organization.Employee',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='managed_projects'
    )
    department = models.ForeignKey(
        'organization.Department',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='projects'
    )
    status = models.CharField(max_length=20, choices=ProjectStatus.choices, default=ProjectStatus.ACTIVE)
    start_date = models.CharField(max_length=30)
    expected_completion_date = models.CharField(max_length=30, null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'projects'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.code} - {self.name}"


class ProjectDocument(models.Model):
    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name='documents'
    )
    filename = models.CharField(max_length=255)
    original_name = models.CharField(max_length=255)
    file_size = models.IntegerField(default=0)
    file_extension = models.CharField(max_length=20)
    mime_type = models.CharField(max_length=100)
    file_data = models.TextField(blank=True, null=True)
    uploaded_by_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='uploaded_project_documents'
    )
    uploaded_by_name = models.CharField(max_length=150, null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = 'project_documents'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.project.code} - {self.original_name}"
