import csv
from io import StringIO
from django.http import HttpResponse
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.db.models import Count, Sum, Q
from django.utils import timezone

from attendance.models import Attendance, AttendanceStatus
from organization.models import Department, Employee
from tasks.models import Task, TaskStatus
from projects.models import Project


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def attendance_report_view(request):
    today_str = timezone.now().strftime('%Y-%m-%d')

    total_records = Attendance.objects.count()
    completed_records = Attendance.objects.filter(status=AttendanceStatus.COMPLETED).count()
    missing_clockouts = Attendance.objects.filter(clock_out_time__isnull=True, date__lt=today_str).count()
    late_records = Attendance.objects.filter(status=AttendanceStatus.LATE).count()
    corrected_records = Attendance.objects.filter(is_manually_corrected=1).count()

    # Breakdown by Department
    depts = Department.objects.all()
    by_department = []
    for d in depts:
        att_qs = Attendance.objects.filter(employee__department=d)
        tot_sess = att_qs.count()
        if tot_sess > 0:
            by_department.append({
                'department_name': d.name,
                'total_sessions': tot_sess,
                'total_completed': att_qs.filter(status=AttendanceStatus.COMPLETED).count(),
                'open_sessions': att_qs.filter(clock_out_time__isnull=True).count(),
                'late_count': att_qs.filter(status=AttendanceStatus.LATE).count(),
            })

    # Top employees by attendance hours
    employees = Employee.objects.annotate(
        total_minutes=Sum('attendances__duration_minutes'),
        sessions_count=Count('attendances')
    ).filter(sessions_count__gt=0).order_by('-total_minutes')[:10]

    top_employees = []
    for e in employees:
        mins = e.total_minutes or 0
        top_employees.append({
            'employee_name': e.full_name,
            'department_name': e.department.name if e.department else 'General',
            'total_minutes': mins,
            'sessions_count': e.sessions_count,
            'totalHoursFormatted': f"{mins // 60}h {str(mins % 60).zfill(2)}m"
        })

    return Response({
        'summary': {
            'totalSessions': total_records,
            'completedSessions': completed_records,
            'missingClockOuts': missing_clockouts,
            'lateArrivals': late_records,
            'manuallyCorrected': corrected_records
        },
        'byDepartment': by_department,
        'topEmployees': top_employees
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def tasks_report_view(request):
    today_str = timezone.now().strftime('%Y-%m-%d')

    total_tasks = Task.objects.count()
    completed_tasks = Task.objects.filter(status=TaskStatus.COMPLETED).count()
    in_progress = Task.objects.filter(status=TaskStatus.IN_PROGRESS).count()
    blocked = Task.objects.filter(status=TaskStatus.BLOCKED).count()
    in_review = Task.objects.filter(status=TaskStatus.IN_REVIEW).count()
    todo = Task.objects.filter(status=TaskStatus.TODO).count()
    overdue = Task.objects.filter(due_date__lt=today_str).exclude(status__in=[TaskStatus.COMPLETED, TaskStatus.CANCELLED]).count()

    total_est = Task.objects.aggregate(s=Sum('estimated_hours'))['s'] or 0.0
    total_act = Task.objects.aggregate(s=Sum('actual_hours'))['s'] or 0.0

    completion_rate = round((completed_tasks / total_tasks) * 100) if total_tasks > 0 else 0

    # By project
    projects = Project.objects.all()
    by_project = []
    for p in projects:
        t_count = p.tasks.count()
        if t_count > 0:
            c_count = p.tasks.filter(status=TaskStatus.COMPLETED).count()
            o_count = p.tasks.filter(due_date__lt=today_str).exclude(status__in=[TaskStatus.COMPLETED, TaskStatus.CANCELLED]).count()
            by_project.append({
                'project_name': p.name,
                'project_code': p.code,
                'total': t_count,
                'completed': c_count,
                'overdue': o_count,
                'rate': round((c_count / t_count) * 100)
            })

    # By employee
    employees = Employee.objects.annotate(
        task_total=Count('assigned_tasks'),
        task_completed=Count('assigned_tasks', filter=Q(assigned_tasks__status=TaskStatus.COMPLETED))
    ).filter(task_total__gt=0).order_by('-task_total')[:10]

    by_employee = [{
        'employee_name': e.full_name,
        'department_name': e.department.name if e.department else 'General',
        'total': e.task_total,
        'completed': e.task_completed,
        'rate': round((e.task_completed / e.task_total) * 100) if e.task_total > 0 else 0
    } for e in employees]

    return Response({
        'summary': {
            'totalTasks': total_tasks,
            'completed': completed_tasks,
            'inProgress': in_progress,
            'blocked': blocked,
            'inReview': in_review,
            'todo': todo,
            'overdue': overdue,
            'completionRate': completion_rate,
            'totalEstimatedHours': total_est,
            'totalActualHours': total_act
        },
        'byProject': by_project,
        'byEmployee': by_employee
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def export_report_csv_view(request):
    export_type = request.query_params.get('type', 'attendance')

    if export_type == 'attendance':
        qs = Attendance.objects.select_related('employee', 'employee__department').order_by('-date')
        from_d = request.query_params.get('from')
        to_d = request.query_params.get('to')
        if from_d:
            qs = qs.filter(date__gte=from_d)
        if to_d:
            qs = qs.filter(date__lte=to_d)

        output = StringIO()
        writer = csv.writer(output)
        writer.writerow(['Date', 'Employee Code', 'Employee Name', 'Department', 'Clock In', 'Clock Out', 'Duration', 'Status', 'Manually Corrected'])

        for a in qs:
            writer.writerow([
                a.date,
                a.employee.employee_code,
                a.employee.full_name,
                a.employee.department.name if a.employee.department else '',
                a.clock_in_time,
                a.clock_out_time or 'No Clock-out',
                a.duration_formatted or '—',
                a.status,
                'Yes' if a.is_manually_corrected else 'No'
            ])

        response = HttpResponse(output.getvalue(), content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename="mcgate_attendance_report.csv"'
        return response

    elif export_type == 'tasks':
        tasks = Task.objects.select_related('project', 'assigned_employee').order_by('-created_at')
        output = StringIO()
        writer = csv.writer(output)
        writer.writerow(['Task Code', 'Title', 'Project', 'Assignee', 'Priority', 'Status', 'Due Date', 'Est Hours', 'Act Hours'])

        for t in tasks:
            writer.writerow([
                t.task_code,
                t.title,
                t.project.name if t.project else '',
                t.assigned_employee.full_name if t.assigned_employee else 'Unassigned',
                t.priority,
                t.status,
                t.due_date,
                t.estimated_hours,
                t.actual_hours
            ])

        response = HttpResponse(output.getvalue(), content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename="mcgate_tasks_report.csv"'
        return response

    return Response({'error': 'Valid export types are "attendance" or "tasks".'}, status=status.HTTP_400_BAD_REQUEST)
