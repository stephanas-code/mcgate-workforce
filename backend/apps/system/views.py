import os
import sys
import json
from datetime import datetime
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.conf import settings
from django.utils import timezone
from django.db import transaction
from django.db.models import Q
from django.contrib.auth import get_user_model

from system.models import AuditLog, CompanySetting, Notification
from organization.models import Employee, Department, Team
from projects.models import Project, ProjectDocument
from tasks.models import Task, Assignment, TaskComment, TaskAttachment
from attendance.models import Attendance, WorkSession
from core.utils import record_audit_log

User = get_user_model()


# 1. Company Settings
@api_view(['GET', 'PUT'])
@permission_classes([IsAuthenticated])
def settings_view(request):
    setting = CompanySetting.objects.first()
    if not setting:
        setting = CompanySetting.objects.create(
            id=1,
            company_name='McGate Technologies',
            timezone='Europe/Berlin',
            work_start_time='08:30',
            work_end_time='17:00',
            grace_period_minutes=15,
            working_days='["Monday","Tuesday","Wednesday","Thursday","Friday"]',
            mandatory_clock_in=1,
            optional_clock_out=1,
            overdue_notification_hours=24,
            allow_manual_attendance_correction=1
        )

    if request.method == 'GET':
        return Response({
            'id': setting.id,
            'company_name': setting.company_name,
            'timezone': setting.timezone,
            'work_start_time': setting.work_start_time,
            'work_end_time': setting.work_end_time,
            'grace_period_minutes': setting.grace_period_minutes,
            'working_days': setting.working_days,
            'mandatory_clock_in': setting.mandatory_clock_in,
            'optional_clock_out': setting.optional_clock_out,
            'overdue_notification_hours': setting.overdue_notification_hours,
            'allow_manual_attendance_correction': setting.allow_manual_attendance_correction,
            'updated_at': setting.updated_at.isoformat() if setting.updated_at else ''
        })

    elif request.method == 'PUT':
        if request.user.role not in ['SUPER_ADMIN', 'ADMIN']:
            return Response({'error': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)

        data = request.data
        if 'company_name' in data:
            setting.company_name = data['company_name']
        if 'timezone' in data:
            setting.timezone = data['timezone']
        if 'work_start_time' in data:
            setting.work_start_time = data['work_start_time']
        if 'work_end_time' in data:
            setting.work_end_time = data['work_end_time']
        if 'grace_period_minutes' in data:
            setting.grace_period_minutes = int(data['grace_period_minutes'])
        if 'working_days' in data:
            wd = data['working_days']
            setting.working_days = wd if isinstance(wd, str) else json.dumps(wd)
        if 'mandatory_clock_in' in data:
            setting.mandatory_clock_in = int(data['mandatory_clock_in'])
        if 'optional_clock_out' in data:
            setting.optional_clock_out = int(data['optional_clock_out'])
        if 'overdue_notification_hours' in data:
            setting.overdue_notification_hours = int(data['overdue_notification_hours'])
        if 'allow_manual_attendance_correction' in data:
            setting.allow_manual_attendance_correction = int(data['allow_manual_attendance_correction'])

        setting.updated_at = timezone.now()
        setting.save()

        record_audit_log(
            request,
            action='SETTINGS_CHANGED',
            resource='SETTINGS',
            resource_id=1,
            after_value=f"Updated company policy: Start {setting.work_start_time}, Grace {setting.grace_period_minutes}m"
        )

        return Response({'success': True, 'message': 'Settings saved successfully.'})


# 2. Reset Mock Data
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def reset_mock_data_view(request):
    if request.user.role not in ['SUPER_ADMIN', 'ADMIN']:
        return Response({'error': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)

    with transaction.atomic():
        TaskAttachment.objects.all().delete()
        TaskComment.objects.all().delete()
        Task.objects.all().delete()
        Assignment.objects.all().delete()
        ProjectDocument.objects.all().delete()
        Project.objects.all().delete()
        WorkSession.objects.all().delete()
        Attendance.objects.all().delete()
        Notification.objects.all().delete()

    record_audit_log(
        request,
        action='SYSTEM_PURGE',
        resource='SYSTEM',
        resource_id='ALL_MOCK_DATA',
        after_value='All mockup project, attendance, and task records purged.'
    )

    return Response({'success': True, 'message': 'Mock data reset completed.'})


# 3. Audit Logs
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def audit_logs_view(request):
    qs = AuditLog.objects.all().order_by('-created_at')

    resource = request.query_params.get('resource')
    if resource:
        qs = qs.filter(resource=resource)
    action = request.query_params.get('action')
    if action:
        qs = qs.filter(action=action)
    limit = request.query_params.get('limit')
    if limit and limit.isdigit():
        qs = qs[:int(limit)]
    else:
        qs = qs[:150]

    data = [{
        'id': a.id,
        'user_id': a.user_id,
        'user_name': a.user_name,
        'user_role': a.user_role,
        'action': a.action,
        'resource': a.resource,
        'resource_id': a.resource_id,
        'ip_address': a.ip_address,
        'before_value': a.before_value,
        'after_value': a.after_value,
        'created_at': a.created_at.isoformat() if a.created_at else ''
    } for a in qs]

    return Response(data)


# 4. Notifications
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def notifications_view(request):
    notifs = Notification.objects.filter(user=request.user).order_by('-created_at')[:50]
    unread_count = Notification.objects.filter(user=request.user, is_read=0).count()

    data = [{
        'id': n.id,
        'user_id': n.user_id,
        'title': n.title,
        'message': n.message,
        'type': n.type,
        'link': n.link,
        'is_read': n.is_read,
        'created_at': n.created_at.isoformat() if n.created_at else ''
    } for n in notifs]

    return Response({
        'unreadCount': unread_count,
        'notifications': data
    })


@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def mark_notification_read_view(request, pk):
    Notification.objects.filter(id=pk, user=request.user).update(is_read=1)
    return Response({'success': True})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def mark_all_notifications_read_view(request):
    Notification.objects.filter(user=request.user, is_read=0).update(is_read=1)
    return Response({'success': True})


# 5. DB Diagnostics & System Logs
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def db_logs_view(request):
    if request.user.role not in ['SUPER_ADMIN', 'ADMIN']:
        return Response({'error': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)

    user_count = User.objects.count()
    emp_count = Employee.objects.count()
    att_count = Attendance.objects.count()
    prj_count = Project.objects.count()
    task_count = Task.objects.count()

    recent_employees = list(Employee.objects.select_related('user').order_by('-id')[:10].values(
        'id', 'employee_code', 'first_name', 'last_name', 'user__email'
    ))

    db_engine = settings.DATABASES['default']['ENGINE']
    db_name = str(settings.DATABASES['default']['NAME'])

    file_size = 0
    exists_on_disk = False
    if os.path.exists(db_name):
        exists_on_disk = True
        file_size = os.path.getsize(db_name)

    return Response({
        'success': True,
        'container': {
            'id': 'django-workforce-core',
            'isVercel': bool(os.environ.get('VERCEL')),
            'pythonVersion': sys.version
        },
        'storage': {
            'engine': db_engine,
            'dbFile': db_name,
            'existsOnDisk': exists_on_disk,
            'sizeBytes': file_size,
            'totalUsers': user_count,
            'totalEmployees': emp_count,
            'totalAttendance': att_count,
            'totalProjects': prj_count,
            'totalTasks': task_count
        },
        'recentEmployees': recent_employees
    })


# 6. Global Search
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def search_global_view(request):
    q = request.query_params.get('q', '').strip()
    if not q:
        return Response({'employees': [], 'projects': [], 'tasks': []})

    employees = Employee.objects.filter(
        Q(first_name__icontains=q) | Q(last_name__icontains=q) | Q(employee_code__icontains=q) | Q(job_title__icontains=q)
    )[:10]

    projects = Project.objects.filter(
        Q(name__icontains=q) | Q(code__icontains=q) | Q(description__icontains=q)
    )[:10]

    tasks = Task.objects.filter(
        Q(title__icontains=q) | Q(task_code__icontains=q) | Q(description__icontains=q)
    )[:10]

    return Response({
        'employees': [{
            'id': e.id,
            'name': e.full_name,
            'code': e.employee_code,
            'jobTitle': e.job_title
        } for e in employees],
        'projects': [{
            'id': p.id,
            'name': p.name,
            'code': p.code,
            'status': p.status
        } for p in projects],
        'tasks': [{
            'id': t.id,
            'title': t.title,
            'code': t.task_code,
            'status': t.status
        } for t in tasks]
    })
