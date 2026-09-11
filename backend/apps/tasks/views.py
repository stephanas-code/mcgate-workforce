import re
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from tasks.models import Assignment, Task, TaskComment, TaskAttachment, TaskActivityLog, Priority, AssignmentStatus, TaskStatus
from projects.models import Project
from organization.models import Employee, Department, Team
from core.utils import record_audit_log


def is_task_overdue(due_date_str, status_val):
    if status_val in ['COMPLETED', 'CANCELLED'] or not due_date_str:
        return False
    today = timezone.now().strftime('%Y-%m-%d')
    return due_date_str < today


# ----------------- ASSIGNMENTS ----------------- #

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def assignments_view(request):
    if request.method == 'GET':
        qs = Assignment.objects.select_related('project', 'assigned_team', 'lead_employee').order_by('-created_at')

        project_id = request.query_params.get('projectId')
        if project_id:
            qs = qs.filter(project_id=project_id)
        team_id = request.query_params.get('teamId')
        if team_id:
            qs = qs.filter(assigned_team_id=team_id)

        data = []
        for a in qs:
            tot = a.tasks.count()
            comp = a.tasks.filter(status='COMPLETED').count()
            prog = round((comp / tot) * 100) if tot > 0 else 0
            data.append({
                'id': a.id,
                'project_id': a.project_id,
                'title': a.title,
                'description': a.description,
                'assigned_team_id': a.assigned_team_id,
                'lead_employee_id': a.lead_employee_id,
                'priority': a.priority,
                'status': a.status,
                'start_date': a.start_date,
                'due_date': a.due_date,
                'created_at': a.created_at.isoformat() if a.created_at else '',
                'project_name': a.project.name if a.project else '',
                'project_code': a.project.code if a.project else '',
                'team_name': a.assigned_team.name if a.assigned_team else None,
                'leadName': a.lead_employee.full_name if a.lead_employee else 'Unassigned',
                'totalTasks': tot,
                'completedTasks': comp,
                'progressPercent': prog,
                'progressText': f"{comp}/{tot} tasks ({prog}% progress)"
            })
        return Response(data)

    elif request.method == 'POST':
        data = request.data
        project_id = data.get('projectId')
        title = data.get('title', '').strip()
        description = data.get('description', '').strip()
        assigned_team_id = data.get('assignedTeamId')
        lead_employee_id = data.get('leadEmployeeId')
        priority = data.get('priority', 'MEDIUM')
        start_date = data.get('startDate') or timezone.now().strftime('%Y-%m-%d')
        due_date = data.get('dueDate') or timezone.now().strftime('%Y-%m-%d')

        if not project_id or not title:
            return Response({'error': 'Project ID and title are required.'}, status=status.HTTP_400_BAD_REQUEST)

        assignment = Assignment.objects.create(
            project_id=project_id,
            title=title,
            description=description,
            assigned_team_id=assigned_team_id if assigned_team_id else None,
            lead_employee_id=lead_employee_id if lead_employee_id else None,
            priority=priority,
            status=AssignmentStatus.IN_PROGRESS,
            start_date=start_date,
            due_date=due_date
        )

        record_audit_log(
            request,
            action='ASSIGNMENT_CREATED',
            resource='ASSIGNMENT',
            resource_id=assignment.id,
            after_value=f"Created assignment {title}"
        )

        return Response({
            'success': True,
            'message': 'Assignment milestone created successfully',
            'assignmentId': assignment.id
        }, status=status.HTTP_201_CREATED)


@api_view(['GET', 'PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
def assignment_detail_view(request, pk):
    try:
        assignment = Assignment.objects.select_related('project', 'assigned_team', 'lead_employee').get(pk=pk)
    except Assignment.DoesNotExist:
        return Response({'error': 'Assignment not found.'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'GET':
        tasks = assignment.tasks.select_related('assigned_employee').all()
        tasks_data = [{
            'id': t.id,
            'task_code': t.task_code,
            'title': t.title,
            'status': t.status,
            'priority': t.priority,
            'due_date': t.due_date,
            'assigneeName': t.assigned_employee.full_name if t.assigned_employee else 'Unassigned',
            'isOverdue': is_task_overdue(t.due_date, t.status)
        } for t in tasks]

        tot = len(tasks_data)
        comp = sum(1 for t in tasks_data if t['status'] == 'COMPLETED')
        prog = round((comp / tot) * 100) if tot > 0 else 0

        return Response({
            'id': assignment.id,
            'project_id': assignment.project_id,
            'title': assignment.title,
            'description': assignment.description,
            'assigned_team_id': assignment.assigned_team_id,
            'lead_employee_id': assignment.lead_employee_id,
            'priority': assignment.priority,
            'status': assignment.status,
            'start_date': assignment.start_date,
            'due_date': assignment.due_date,
            'created_at': assignment.created_at.isoformat() if assignment.created_at else '',
            'project_name': assignment.project.name if assignment.project else '',
            'project_code': assignment.project.code if assignment.project else '',
            'team_name': assignment.assigned_team.name if assignment.assigned_team else None,
            'leadName': assignment.lead_employee.full_name if assignment.lead_employee else 'Unassigned',
            'totalTasks': tot,
            'completedTasks': comp,
            'progressPercent': prog,
            'tasks': tasks_data
        })

    elif request.method == 'PATCH':
        data = request.data
        if 'title' in data and data['title']:
            assignment.title = data['title'].strip()
        if 'description' in data:
            assignment.description = data['description'].strip()
        if 'assignedTeamId' in data:
            assignment.assigned_team_id = data['assignedTeamId'] if data['assignedTeamId'] else None
        if 'leadEmployeeId' in data:
            assignment.lead_employee_id = data['leadEmployeeId'] if data['leadEmployeeId'] else None
        if 'priority' in data:
            assignment.priority = data['priority']
        if 'status' in data:
            assignment.status = data['status']
        if 'dueDate' in data:
            assignment.due_date = data['dueDate']
        if 'startDate' in data:
            assignment.start_date = data['startDate']
        assignment.save()

        return Response({'success': True, 'message': 'Assignment updated successfully'})

    elif request.method == 'DELETE':
        assignment.delete()
        return Response({'success': True, 'message': 'Assignment deleted successfully'})


# ----------------- TASKS ----------------- #

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def tasks_view(request):
    if request.method == 'GET':
        qs = Task.objects.select_related(
            'assigned_employee', 'assigned_by_user', 'project', 'assignment', 'department', 'team'
        ).order_by('-created_at')

        user = request.user
        emp = getattr(user, 'employee_profile', None)

        # Scoping based on role
        if user.role == 'EMPLOYEE' and emp:
            requested_emp = request.query_params.get('employeeId')
            if requested_emp and int(requested_emp) == emp.id:
                qs = qs.filter(assigned_employee=emp)
            else:
                qs = qs.filter(Q(assigned_employee=emp) | Q(team_id=emp.team_id))
        elif user.role == 'MANAGER' and emp:
            if emp.team_id:
                qs = qs.filter(Q(team_id=emp.team_id) | Q(department_id=emp.department_id) | Q(assigned_by_user=user))

        # Query filters
        status_val = request.query_params.get('status')
        if status_val:
            qs = qs.filter(status=status_val)
        priority_val = request.query_params.get('priority')
        if priority_val:
            qs = qs.filter(priority=priority_val)
        project_id = request.query_params.get('projectId')
        if project_id:
            qs = qs.filter(project_id=project_id)
        assignment_id = request.query_params.get('assignmentId')
        if assignment_id:
            qs = qs.filter(assignment_id=assignment_id)
        employee_id = request.query_params.get('employeeId')
        if employee_id and user.role != 'EMPLOYEE':
            qs = qs.filter(assigned_employee_id=employee_id)
        search_term = request.query_params.get('search')
        if search_term:
            qs = qs.filter(Q(title__icontains=search_term) | Q(description__icontains=search_term) | Q(task_code__icontains=search_term))

        limit = request.query_params.get('limit')
        if limit and limit.isdigit():
            qs = qs[:int(limit)]

        data = []
        for t in qs:
            data.append({
                'id': t.id,
                'task_code': t.task_code,
                'assignment_id': t.assignment_id,
                'project_id': t.project_id,
                'title': t.title,
                'description': t.description,
                'assigned_employee_id': t.assigned_employee_id,
                'assigned_by_user_id': t.assigned_by_user_id,
                'department_id': t.department_id,
                'team_id': t.team_id,
                'priority': t.priority,
                'status': t.status,
                'start_date': t.start_date,
                'due_date': t.due_date,
                'estimated_hours': t.estimated_hours,
                'actual_hours': t.actual_hours,
                'completed_at': t.completed_at,
                'created_at': t.created_at.isoformat() if t.created_at else '',
                'updated_at': t.updated_at.isoformat() if t.updated_at else '',
                'assignee_first': t.assigned_employee.first_name if t.assigned_employee else None,
                'assignee_last': t.assigned_employee.last_name if t.assigned_employee else None,
                'assignee_code': t.assigned_employee.employee_code if t.assigned_employee else None,
                'assigneeName': t.assigned_employee.full_name if t.assigned_employee else 'Unassigned',
                'assigner_email': t.assigned_by_user.email if t.assigned_by_user else '',
                'project_name': t.project.name if t.project else '',
                'project_code': t.project.code if t.project else '',
                'assignment_title': t.assignment.title if t.assignment else None,
                'department_name': t.department.name if t.department else None,
                'team_name': t.team.name if t.team else None,
                'isOverdue': is_task_overdue(t.due_date, t.status)
            })
        return Response(data)

    elif request.method == 'POST':
        data = request.data
        title = data.get('title', '').strip()
        description = data.get('description', '').strip()
        project_id = data.get('projectId')
        assignment_id = data.get('assignmentId')
        assigned_employee_id = data.get('assignedEmployeeId')
        priority = data.get('priority', 'MEDIUM')
        start_date = data.get('startDate') or timezone.now().strftime('%Y-%m-%d')
        due_date = data.get('dueDate') or timezone.now().strftime('%Y-%m-%d')
        estimated_hours = float(data.get('estimatedHours') or 0.0)
        department_id = data.get('departmentId')
        team_id = data.get('teamId')

        if not title or not project_id or not due_date:
            return Response({'error': 'Title, project ID, and due date are required.'}, status=status.HTTP_400_BAD_REQUEST)

        # Generate unique task code
        total_tasks = Task.objects.count()
        task_code = f"TSK-{total_tasks + 101}"
        while Task.objects.filter(task_code=task_code).exists():
            total_tasks += 1
            task_code = f"TSK-{total_tasks + 101}"

        task = Task.objects.create(
            task_code=task_code,
            assignment_id=assignment_id if assignment_id else None,
            project_id=project_id,
            title=title,
            description=description,
            assigned_employee_id=assigned_employee_id if assigned_employee_id else None,
            assigned_by_user=request.user,
            department_id=department_id if department_id else None,
            team_id=team_id if team_id else None,
            priority=priority,
            status=TaskStatus.TODO,
            start_date=start_date,
            due_date=due_date,
            estimated_hours=estimated_hours
        )

        record_audit_log(
            request,
            action='TASK_CREATED',
            resource='TASK',
            resource_id=task.id,
            after_value=f"Created task {task_code}: {title}"
        )

        return Response({
            'success': True,
            'message': 'Task created successfully',
            'taskId': task.id,
            'taskCode': task_code
        }, status=status.HTTP_201_CREATED)


@api_view(['GET', 'PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
def task_detail_view(request, pk):
    try:
        task = Task.objects.select_related(
            'assigned_employee', 'assigned_by_user', 'project', 'assignment', 'department', 'team'
        ).get(pk=pk)
    except Task.DoesNotExist:
        return Response({'error': 'Task not found.'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'GET':
        comments = [{
            'id': c.id,
            'task_id': c.task_id,
            'author_id': c.author_id,
            'author_name': c.author_name,
            'author_role': c.author_role,
            'message': c.message,
            'mentions': c.mentions,
            'created_at': c.created_at.isoformat() if c.created_at else ''
        } for c in task.comments.all()]

        attachments = [{
            'id': a.id,
            'task_id': a.task_id,
            'filename': a.filename,
            'file_size': a.file_size,
            'file_type': a.file_type,
            'file_url': a.file_url,
            'uploaded_by_user_id': a.uploaded_by_user_id,
            'created_at': a.created_at.isoformat() if a.created_at else ''
        } for a in task.attachments.all()]

        activities = [{
            'id': act.id,
            'task_id': act.task_id,
            'user_id': act.user_id,
            'user_name': act.user_name,
            'action': act.action,
            'from_value': act.from_value,
            'to_value': act.to_value,
            'created_at': act.created_at.isoformat() if act.created_at else ''
        } for act in task.activity_logs.all()]

        return Response({
            'id': task.id,
            'task_code': task.task_code,
            'assignment_id': task.assignment_id,
            'project_id': task.project_id,
            'title': task.title,
            'description': task.description,
            'assigned_employee_id': task.assigned_employee_id,
            'assigned_by_user_id': task.assigned_by_user_id,
            'department_id': task.department_id,
            'team_id': task.team_id,
            'priority': task.priority,
            'status': task.status,
            'start_date': task.start_date,
            'due_date': task.due_date,
            'estimated_hours': task.estimated_hours,
            'actual_hours': task.actual_hours,
            'completed_at': task.completed_at,
            'created_at': task.created_at.isoformat() if task.created_at else '',
            'updated_at': task.updated_at.isoformat() if task.updated_at else '',
            'assignee_first': task.assigned_employee.first_name if task.assigned_employee else None,
            'assignee_last': task.assigned_employee.last_name if task.assigned_employee else None,
            'assignee_code': task.assigned_employee.employee_code if task.assigned_employee else None,
            'assigneeName': task.assigned_employee.full_name if task.assigned_employee else 'Unassigned',
            'assigner_email': task.assigned_by_user.email if task.assigned_by_user else '',
            'project_name': task.project.name if task.project else '',
            'project_code': task.project.code if task.project else '',
            'assignment_title': task.assignment.title if task.assignment else None,
            'department_name': task.department.name if task.department else None,
            'team_name': task.team.name if task.team else None,
            'isOverdue': is_task_overdue(task.due_date, task.status),
            'comments': comments,
            'attachments': attachments,
            'activities': activities
        })

    elif request.method == 'PATCH':
        data = request.data
        user_name = getattr(request.user, 'employee_profile', None)
        user_name_str = user_name.full_name if user_name else request.user.email

        if 'status' in data and data['status'] != task.status:
            old_s = task.status
            task.status = data['status']
            if task.status == TaskStatus.COMPLETED:
                task.completed_at = timezone.now().isoformat()
            TaskActivityLog.objects.create(
                task=task,
                user=request.user,
                user_name=user_name_str,
                action='STATUS_CHANGE',
                from_value=old_s,
                to_value=task.status
            )

        if 'priority' in data and data['priority'] != task.priority:
            old_p = task.priority
            task.priority = data['priority']
            TaskActivityLog.objects.create(
                task=task,
                user=request.user,
                user_name=user_name_str,
                action='PRIORITY_CHANGE',
                from_value=old_p,
                to_value=task.priority
            )

        if 'assignedEmployeeId' in data or 'assigned_employee_id' in data:
            emp_id = data.get('assignedEmployeeId') or data.get('assigned_employee_id')
            task.assigned_employee_id = emp_id if emp_id else None

        if 'title' in data and data['title']:
            task.title = data['title'].strip()
        if 'description' in data:
            task.description = data['description'].strip()
        if 'dueDate' in data or 'due_date' in data:
            task.due_date = data.get('dueDate') or data.get('due_date')
        if 'estimatedHours' in data or 'estimated_hours' in data:
            task.estimated_hours = float(data.get('estimatedHours') or data.get('estimated_hours') or 0.0)
        if 'actualHours' in data or 'actual_hours' in data:
            task.actual_hours = float(data.get('actualHours') or data.get('actual_hours') or 0.0)

        task.save()
        return Response({'success': True, 'message': 'Task updated successfully'})

    elif request.method == 'DELETE':
        task.delete()
        return Response({'success': True, 'message': 'Task deleted successfully'})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def task_comments_view(request, pk):
    try:
        task = Task.objects.get(pk=pk)
    except Task.DoesNotExist:
        return Response({'error': 'Task not found.'}, status=status.HTTP_404_NOT_FOUND)

    message = request.data.get('message', '').strip()
    if not message:
        return Response({'error': 'Comment message is required.'}, status=status.HTTP_400_BAD_REQUEST)

    user_name = getattr(request.user, 'employee_profile', None)
    author_name = user_name.full_name if user_name else request.user.email
    author_role = request.user.role

    mentions = request.data.get('mentions')
    mentions_str = ','.join(mentions) if isinstance(mentions, list) else (str(mentions) if mentions else None)

    comment = TaskComment.objects.create(
        task=task,
        author=request.user,
        author_name=author_name,
        author_role=author_role,
        message=message,
        mentions=mentions_str
    )

    return Response({
        'success': True,
        'comment': {
            'id': comment.id,
            'task_id': task.id,
            'author_id': request.user.id,
            'author_name': author_name,
            'author_role': author_role,
            'message': message,
            'mentions': mentions_str,
            'created_at': comment.created_at.isoformat()
        }
    }, status=status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def task_attachments_view(request, pk):
    try:
        task = Task.objects.get(pk=pk)
    except Task.DoesNotExist:
        return Response({'error': 'Task not found.'}, status=status.HTTP_404_NOT_FOUND)

    filename = request.data.get('filename', 'file')
    file_size = request.data.get('fileSize', 0)
    file_type = request.data.get('fileType', 'application/octet-stream')
    file_url = request.data.get('fileUrl', '')

    att = TaskAttachment.objects.create(
        task=task,
        filename=filename,
        file_size=file_size,
        file_type=file_type,
        file_url=file_url,
        uploaded_by_user=request.user
    )

    return Response({
        'success': True,
        'attachment': {
            'id': att.id,
            'task_id': task.id,
            'filename': filename,
            'file_size': file_size,
            'file_type': file_type,
            'file_url': file_url,
            'uploaded_by_user_id': request.user.id,
            'created_at': att.created_at.isoformat()
        }
    }, status=status.HTTP_201_CREATED)
