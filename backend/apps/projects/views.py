from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.db import transaction
from django.db.models import Count, Q
from django.utils import timezone

from projects.models import Project, ProjectDocument, ProjectStatus
from organization.models import Employee, Department
from tasks.models import Assignment, Task
from core.utils import record_audit_log, generate_project_code


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def generate_code_view(request):
    name = request.query_params.get('name', '')
    code = generate_project_code(name)
    return Response({'code': code})


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def projects_view(request):
    if request.method == 'GET':
        projects = Project.objects.select_related('manager', 'department').order_by('-created_at')

        data = []
        for p in projects:
            assignment_count = p.assignments.count()
            total_tasks = p.tasks.count()
            completed_tasks = p.tasks.filter(status='COMPLETED').count()
            doc_count = p.documents.count()
            progress_percent = round((completed_tasks / total_tasks) * 100) if total_tasks > 0 else 0

            data.append({
                'id': p.id,
                'code': p.code,
                'name': p.name,
                'description': p.description,
                'manager_id': p.manager_id,
                'department_id': p.department_id,
                'status': p.status,
                'start_date': p.start_date,
                'expected_completion_date': p.expected_completion_date,
                'target_date': p.expected_completion_date,
                'created_at': p.created_at.isoformat() if p.created_at else '',
                'updated_at': p.updated_at.isoformat() if p.updated_at else '',
                'manager_first': p.manager.first_name if p.manager else None,
                'manager_last': p.manager.last_name if p.manager else None,
                'managerName': p.manager.full_name if p.manager else 'Unassigned',
                'department_name': p.department.name if p.department else None,
                'assignmentCount': assignment_count,
                'totalAssignments': assignment_count,
                'totalTasks': total_tasks,
                'completedTasks': completed_tasks,
                'progressPercent': progress_percent,
                'documentsCount': doc_count,
            })
        return Response(data)

    elif request.method == 'POST':
        data = request.data
        name = data.get('name', '').strip()
        description = data.get('description', '').strip()
        manager_id = data.get('managerId') or data.get('manager_id')
        department_id = data.get('departmentId') or data.get('department_id')
        status_val = data.get('status', 'ACTIVE')
        start_date = data.get('startDate') or data.get('start_date') or timezone.now().strftime('%Y-%m-%d')
        completion_date = data.get('expectedCompletionDate') or data.get('expected_completion_date') or data.get('targetDate') or data.get('target_date')
        documents = data.get('documents', [])

        if not name:
            return Response({'error': 'Project name is required.'}, status=status.HTTP_400_BAD_REQUEST)

        code = data.get('code')
        if not code or not str(code).strip():
            code = generate_project_code(name)
        else:
            code = str(code).strip().upper()

        with transaction.atomic():
            project = Project.objects.create(
                code=code,
                name=name,
                description=description,
                manager_id=manager_id if manager_id else None,
                department_id=department_id if department_id else None,
                status=status_val if status_val in ProjectStatus.values else ProjectStatus.ACTIVE,
                start_date=start_date,
                expected_completion_date=completion_date
            )

            # Insert initial documents if provided
            user_full_name = getattr(request.user, 'employee_profile', None)
            uploaded_by_name = user_full_name.full_name if user_full_name else request.user.email

            for doc in documents:
                ProjectDocument.objects.create(
                    project=project,
                    filename=doc.get('filename', 'document'),
                    original_name=doc.get('originalName', doc.get('filename', 'document')),
                    file_size=doc.get('fileSize', 0),
                    file_extension=doc.get('fileExtension', 'txt'),
                    mime_type=doc.get('mimeType', 'text/plain'),
                    file_data=doc.get('fileData', ''),
                    uploaded_by_user=request.user,
                    uploaded_by_name=uploaded_by_name
                )

        record_audit_log(
            request,
            action='PROJECT_CREATED',
            resource='PROJECT',
            resource_id=project.id,
            after_value=f"Created project {code} - {name}"
        )

        return Response({
            'success': True,
            'message': 'Project created successfully',
            'projectId': project.id,
            'code': project.code,
            'documentsCount': len(documents)
        }, status=status.HTTP_201_CREATED)


@api_view(['GET', 'PATCH'])
@permission_classes([IsAuthenticated])
def project_detail_view(request, pk):
    try:
        project = Project.objects.select_related('manager', 'department').get(pk=pk)
    except Project.DoesNotExist:
        return Response({'error': 'Project not found.'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'GET':
        assignments = project.assignments.select_related('lead_employee', 'assigned_team').all()
        assignments_data = []
        for a in assignments:
            tot = a.tasks.count()
            comp = a.tasks.filter(status='COMPLETED').count()
            prog = round((comp / tot) * 100) if tot > 0 else 0
            assignments_data.append({
                'id': a.id,
                'project_id': project.id,
                'title': a.title,
                'description': a.description,
                'assigned_team_id': a.assigned_team_id,
                'lead_employee_id': a.lead_employee_id,
                'priority': a.priority,
                'status': a.status,
                'start_date': a.start_date,
                'due_date': a.due_date,
                'created_at': a.created_at.isoformat() if a.created_at else '',
                'project_name': project.name,
                'project_code': project.code,
                'team_name': a.assigned_team.name if a.assigned_team else None,
                'leadName': a.lead_employee.full_name if a.lead_employee else 'Unassigned',
                'totalTasks': tot,
                'completedTasks': comp,
                'progressPercent': prog
            })

        tasks = project.tasks.select_related('assigned_employee', 'assigned_by_user').all()
        tasks_data = []
        for t in tasks:
            tasks_data.append({
                'id': t.id,
                'task_code': t.task_code,
                'assignment_id': t.assignment_id,
                'project_id': project.id,
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
                'assignee_first': t.assigned_employee.first_name if t.assigned_employee else None,
                'assignee_last': t.assigned_employee.last_name if t.assigned_employee else None,
                'assigneeName': t.assigned_employee.full_name if t.assigned_employee else 'Unassigned'
            })

        documents = project.documents.all()
        docs_data = [{
            'id': d.id,
            'project_id': d.project_id,
            'filename': d.filename,
            'original_name': d.original_name,
            'file_size': d.file_size,
            'file_extension': d.file_extension,
            'mime_type': d.mime_type,
            'uploaded_by_user_id': d.uploaded_by_user_id,
            'uploaded_by_name': d.uploaded_by_name,
            'created_at': d.created_at.isoformat() if d.created_at else ''
        } for d in documents]

        tot_p_tasks = len(tasks_data)
        comp_p_tasks = sum(1 for t in tasks_data if t['status'] == 'COMPLETED')
        p_progress = round((comp_p_tasks / tot_p_tasks) * 100) if tot_p_tasks > 0 else 0

        return Response({
            'id': project.id,
            'code': project.code,
            'name': project.name,
            'description': project.description,
            'manager_id': project.manager_id,
            'department_id': project.department_id,
            'status': project.status,
            'start_date': project.start_date,
            'expected_completion_date': project.expected_completion_date,
            'target_date': project.expected_completion_date,
            'created_at': project.created_at.isoformat() if project.created_at else '',
            'manager_first': project.manager.first_name if project.manager else None,
            'manager_last': project.manager.last_name if project.manager else None,
            'managerName': project.manager.full_name if project.manager else 'Unassigned',
            'department_name': project.department.name if project.department else None,
            'assignments': assignments_data,
            'tasks': tasks_data,
            'documents': docs_data,
            'documentsCount': len(docs_data),
            'totalTasks': tot_p_tasks,
            'completedTasks': comp_p_tasks,
            'progressPercent': p_progress
        })

    elif request.method == 'PATCH':
        data = request.data
        if 'name' in data and data['name']:
            project.name = data['name'].strip()
        if 'description' in data:
            project.description = data['description'].strip()
        if 'managerId' in data or 'manager_id' in data:
            m_id = data.get('managerId') or data.get('manager_id')
            project.manager_id = m_id if m_id else None
        if 'departmentId' in data or 'department_id' in data:
            d_id = data.get('departmentId') or data.get('department_id')
            project.department_id = d_id if d_id else None
        if 'status' in data and data['status'] in ProjectStatus.values:
            project.status = data['status']
        if 'startDate' in data or 'start_date' in data:
            project.start_date = data.get('startDate') or data.get('start_date')
        if 'expectedCompletionDate' in data or 'expected_completion_date' in data or 'targetDate' in data or 'target_date' in data:
            project.expected_completion_date = data.get('expectedCompletionDate') or data.get('expected_completion_date') or data.get('targetDate') or data.get('target_date')

        project.save()

        record_audit_log(
            request,
            action='PROJECT_UPDATED',
            resource='PROJECT',
            resource_id=project.id,
            after_value=f"Updated project {project.code}"
        )

        return Response({'success': True, 'message': 'Project updated successfully'})


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def project_documents_view(request, pk):
    try:
        project = Project.objects.get(pk=pk)
    except Project.DoesNotExist:
        return Response({'error': 'Project not found.'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'GET':
        docs = project.documents.all()
        return Response([{
            'id': d.id,
            'project_id': d.project_id,
            'filename': d.filename,
            'original_name': d.original_name,
            'file_size': d.file_size,
            'file_extension': d.file_extension,
            'mime_type': d.mime_type,
            'uploaded_by_user_id': d.uploaded_by_user_id,
            'uploaded_by_name': d.uploaded_by_name,
            'created_at': d.created_at.isoformat() if d.created_at else ''
        } for d in docs])

    elif request.method == 'POST':
        documents = request.data.get('documents', [])
        user_full_name = getattr(request.user, 'employee_profile', None)
        uploaded_by_name = user_full_name.full_name if user_full_name else request.user.email

        created_docs = []
        for doc in documents:
            cd = ProjectDocument.objects.create(
                project=project,
                filename=doc.get('filename', 'document'),
                original_name=doc.get('originalName', doc.get('filename', 'document')),
                file_size=doc.get('fileSize', 0),
                file_extension=doc.get('fileExtension', 'txt'),
                mime_type=doc.get('mimeType', 'text/plain'),
                file_data=doc.get('fileData', ''),
                uploaded_by_user=request.user,
                uploaded_by_name=uploaded_by_name
            )
            created_docs.append({
                'id': cd.id,
                'filename': cd.filename,
                'original_name': cd.original_name
            })

        record_audit_log(
            request,
            action='PROJECT_DOCUMENTS_UPLOADED',
            resource='PROJECT',
            resource_id=project.id,
            after_value=f"Uploaded {len(created_docs)} documents to {project.code}"
        )

        return Response({
            'success': True,
            'message': f"Successfully uploaded {len(created_docs)} document(s).",
            'documents': created_docs
        })


@api_view(['GET', 'DELETE'])
@permission_classes([IsAuthenticated])
def project_document_detail_view(request, pk, doc_id):
    try:
        doc = ProjectDocument.objects.get(pk=doc_id, project_id=pk)
    except ProjectDocument.DoesNotExist:
        return Response({'error': 'Document not found.'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'GET':
        return Response({
            'id': doc.id,
            'project_id': doc.project_id,
            'filename': doc.filename,
            'original_name': doc.original_name,
            'file_size': doc.file_size,
            'file_extension': doc.file_extension,
            'mime_type': doc.mime_type,
            'file_data': doc.file_data,
            'uploaded_by_user_id': doc.uploaded_by_user_id,
            'uploaded_by_name': doc.uploaded_by_name,
            'created_at': doc.created_at.isoformat() if doc.created_at else ''
        })

    elif request.method == 'DELETE':
        doc_name = doc.original_name
        doc.delete()
        record_audit_log(
            request,
            action='PROJECT_DOCUMENT_DELETED',
            resource='PROJECT',
            resource_id=pk,
            after_value=f"Deleted document {doc_name}"
        )
        return Response({'success': True, 'message': 'Document deleted successfully'})
