from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.db.models import Count, Q
from django.db import transaction
from django.utils import timezone
from django.contrib.auth import get_user_model

from organization.models import Department, Team, Employee
from organization.serializers import DepartmentSerializer, TeamSerializer
from core.permissions import IsAdminOrSuperAdmin
from core.utils import record_audit_log, generate_next_employee_code, get_client_ip
from attendance.models import Attendance, WorkSession
from projects.models import Project
from tasks.models import Assignment, Task

User = get_user_model()


# 1. Departments
@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def departments_view(request):
    if request.method == 'GET':
        depts = Department.objects.annotate(
            employee_count=Count('employees', distinct=True),
            team_count=Count('teams', distinct=True)
        ).order_by('name')

        data = []
        for d in depts:
            data.append({
                'id': d.id,
                'name': d.name,
                'code': d.code,
                'description': d.description,
                'head_employee_id': d.head_employee_id,
                'created_at': d.created_at.isoformat() if d.created_at else '',
                'employee_count': d.employee_count,
                'team_count': d.team_count
            })
        return Response(data)

    elif request.method == 'POST':
        if request.user.role not in ['SUPER_ADMIN', 'ADMIN']:
            return Response({'error': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)

        name = request.data.get('name', '').strip()
        code = request.data.get('code', '').strip().upper()
        description = request.data.get('description', '').strip()

        if not name or not code:
            return Response({'error': 'Department name and code are required.'}, status=status.HTTP_400_BAD_REQUEST)

        dept = Department.objects.create(name=name, code=code, description=description)
        record_audit_log(
            request,
            action='DEPARTMENT_CREATED',
            resource='DEPARTMENT',
            resource_id=dept.id,
            after_value=f"Created department {code}: {name}"
        )
        return Response({'success': True, 'departmentId': dept.id}, status=status.HTTP_201_CREATED)


# 2. Teams
@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def teams_view(request):
    if request.method == 'GET':
        teams = Team.objects.select_related('department', 'team_lead').annotate(
            member_count=Count('members', distinct=True)
        ).order_by('department__name', 'name')

        data = []
        for t in teams:
            data.append({
                'id': t.id,
                'department_id': t.department_id,
                'name': t.name,
                'description': t.description,
                'department_name': t.department.name if t.department else '',
                'department_code': t.department.code if t.department else '',
                'team_lead_first': t.team_lead.first_name if t.team_lead else None,
                'team_lead_last': t.team_lead.last_name if t.team_lead else None,
                'team_lead_id': t.team_lead_id,
                'member_count': t.member_count,
                'created_at': t.created_at.isoformat() if t.created_at else ''
            })
        return Response(data)

    elif request.method == 'POST':
        if request.user.role not in ['SUPER_ADMIN', 'ADMIN']:
            return Response({'error': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)

        dept_id = request.data.get('departmentId')
        name = request.data.get('name', '').strip()
        description = request.data.get('description', '').strip()
        team_lead_id = request.data.get('teamLeadId')

        if not dept_id or not name:
            return Response({'error': 'Department ID and team name are required.'}, status=status.HTTP_400_BAD_REQUEST)

        team = Team.objects.create(
            department_id=dept_id,
            name=name,
            description=description,
            team_lead_id=team_lead_id if team_lead_id else None
        )
        record_audit_log(
            request,
            action='TEAM_CREATED',
            resource='TEAM',
            resource_id=team.id,
            after_value=f"Created team {name}"
        )
        return Response({'success': True, 'teamId': team.id}, status=status.HTTP_201_CREATED)


# 3. Employees list & create
@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def employees_view(request):
    if request.method == 'GET':
        today_str = timezone.now().strftime('%Y-%m-%d')
        employees = Employee.objects.select_related('user', 'department', 'team').order_by('first_name', 'last_name')

        # Load today's attendance for quick lookup
        attendances = {a.employee_id: a for a in Attendance.objects.filter(date=today_str)}

        data = []
        for e in employees:
            att = attendances.get(e.id)
            today_clock_in = att.clock_in_time if att else None
            today_clock_out = att.clock_out_time if att else None
            today_status = att.status if att else None

            data.append({
                'id': e.id,
                'user_id': e.user_id,
                'employee_code': e.employee_code,
                'first_name': e.first_name,
                'last_name': e.last_name,
                'fullName': e.full_name,
                'email': e.user.email if e.user else '',
                'role': e.user.role if e.user else 'EMPLOYEE',
                'status': e.user.status if e.user else 'ACTIVE',
                'job_title': e.job_title,
                'phone': e.phone,
                'avatar_url': e.avatar_url,
                'avatarUrl': e.avatar_url,
                'department_id': e.department_id,
                'team_id': e.team_id,
                'department_name': e.department.name if e.department else None,
                'team_name': e.team.name if e.team else None,
                'employment_status': e.employment_status,
                'joined_date': str(e.joined_date),
                'today_clock_in': today_clock_in,
                'today_clock_out': today_clock_out,
                'today_att_status': today_status,
                'isClockedInToday': bool(today_clock_in),
                'isCurrentlyActive': bool(today_clock_in and not today_clock_out),
            })
        return Response(data)

    elif request.method == 'POST':
        if request.user.role not in ['SUPER_ADMIN', 'ADMIN']:
            return Response({'error': 'Permission denied: Administrator privileges required.'}, status=status.HTTP_403_FORBIDDEN)

        data = request.data
        email = data.get('email', '').strip().lower()
        first_name = data.get('firstName', '').strip()
        last_name = data.get('lastName', '').strip()
        role = data.get('role', 'EMPLOYEE').upper()
        job_title = data.get('jobTitle', '').strip() or 'Team Member'
        department_id = data.get('departmentId')
        team_id = data.get('teamId')
        phone = data.get('phone', '').strip()
        employment_status = data.get('employmentStatus', 'FULL_TIME')
        avatar_url = data.get('avatarUrl')
        requested_code = data.get('employeeCode', '').strip().upper()
        raw_password = data.get('password', '').strip() or 'password123'

        if not email or not first_name or not last_name:
            return Response({'error': 'Email, First Name, and Last Name are required.'}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            # Check existing user / clean up orphaned user if any
            existing_user = User.objects.filter(email__iexact=email).first()
            if existing_user:
                if hasattr(existing_user, 'employee_profile') and existing_user.employee_profile:
                    return Response({'error': 'A user with this corporate email address already exists.'}, status=status.HTTP_400_BAD_REQUEST)
                existing_user.delete()

            # Generate or assign employee code
            if requested_code and not Employee.objects.filter(employee_code=requested_code).exists():
                final_code = requested_code
            else:
                final_code = generate_next_employee_code()

            # Create User
            user = User.objects.create_user(
                email=email,
                password=raw_password,
                role=role if role in ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'EMPLOYEE'] else 'EMPLOYEE',
                status='ACTIVE'
            )

            # Create Employee
            emp = Employee.objects.create(
                user=user,
                employee_code=final_code,
                first_name=first_name,
                last_name=last_name,
                avatar_url=avatar_url,
                phone=phone,
                job_title=job_title,
                department_id=department_id if department_id else None,
                team_id=team_id if team_id else None,
                employment_status=employment_status,
                joined_date=timezone.now().date()
            )

        record_audit_log(
            request,
            action='USER_CREATED',
            resource='EMPLOYEE',
            resource_id=emp.id,
            after_value=f"Created employee {final_code} ({first_name} {last_name}, {role})"
        )

        return Response({
            'success': True,
            'message': 'Employee registered successfully',
            'employeeId': emp.id,
            'employeeCode': final_code,
            'userId': user.id
        }, status=status.HTTP_201_CREATED)


# 4. Next auto-assigned employee code
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def next_employee_code_view(request):
    code = generate_next_employee_code()
    return Response({'code': code})


# 5. Single employee detail / update / delete
@api_view(['GET', 'PUT', 'DELETE'])
@permission_classes([IsAuthenticated])
def employee_detail_view(request, pk):
    try:
        emp = Employee.objects.select_related('user', 'department', 'team').get(pk=pk)
    except Employee.DoesNotExist:
        return Response({'error': 'Employee not found.'}, status=status.HTTP_404_NOT_FOUND)

    req_emp = getattr(request.user, 'employee_profile', None)
    is_self = (req_emp and req_emp.id == emp.id) or (request.user.id == emp.user_id)
    is_admin = request.user.role in ['SUPER_ADMIN', 'ADMIN']

    if request.method == 'GET':
        return Response({
            'id': emp.id,
            'user_id': emp.user_id,
            'employee_code': emp.employee_code,
            'first_name': emp.first_name,
            'last_name': emp.last_name,
            'fullName': emp.full_name,
            'email': emp.user.email if emp.user else '',
            'role': emp.user.role if emp.user else '',
            'status': emp.user.status if emp.user else '',
            'job_title': emp.job_title,
            'phone': emp.phone,
            'avatarUrl': emp.avatar_url,
            'department_id': emp.department_id,
            'team_id': emp.team_id,
            'department_name': emp.department.name if emp.department else None,
            'team_name': emp.team.name if emp.team else None,
            'employment_status': emp.employment_status,
            'joined_date': str(emp.joined_date)
        })

    elif request.method == 'PUT':
        if not is_self and not is_admin:
            return Response({'error': 'Forbidden.'}, status=status.HTTP_403_FORBIDDEN)

        data = request.data
        if 'firstName' in data and data['firstName']:
            emp.first_name = data['firstName'].strip()
        if 'lastName' in data and data['lastName']:
            emp.last_name = data['lastName'].strip()
        if 'phone' in data:
            emp.phone = data['phone'].strip()
        if 'jobTitle' in data and data['jobTitle']:
            emp.job_title = data['jobTitle'].strip()
        if 'departmentId' in data:
            emp.department_id = data['departmentId'] if data['departmentId'] else None
        if 'teamId' in data:
            emp.team_id = data['teamId'] if data['teamId'] else None
        if 'avatarUrl' in data:
            emp.avatar_url = data['avatarUrl']
        emp.save()

        record_audit_log(
            request,
            action='EMPLOYEE_UPDATED',
            resource='EMPLOYEE',
            resource_id=emp.id,
            after_value=f"Updated details for {emp.full_name}"
        )

        return Response({'success': True, 'message': 'Employee updated successfully'})

    elif request.method == 'DELETE':
        if not is_admin:
            return Response({'error': 'Only administrators can delete employee accounts.'}, status=status.HTTP_403_FORBIDDEN)

        if is_self:
            return Response({'error': 'You cannot delete your own active account.'}, status=status.HTTP_400_BAD_REQUEST)

        if emp.user and emp.user.role == 'SUPER_ADMIN' and request.user.role != 'SUPER_ADMIN':
            return Response({'error': 'Only a Super Administrator can delete another Super Administrator.'}, status=status.HTTP_403_FORBIDDEN)

        with transaction.atomic():
            # Safely unhook references
            Department.objects.filter(head_employee=emp).update(head_employee=None)
            Team.objects.filter(team_lead=emp).update(team_lead=None)
            Project.objects.filter(manager=emp).update(manager=None)
            Assignment.objects.filter(lead_employee=emp).update(lead_employee=None)
            Task.objects.filter(assigned_employee=emp).update(assigned_employee=None)
            Employee.objects.filter(manager=emp).update(manager=None)

            # Cascade delete attendance and sessions
            WorkSession.objects.filter(employee=emp).delete()
            Attendance.objects.filter(employee=emp).delete()

            user_to_delete = emp.user
            emp_name = emp.full_name
            emp_code = emp.employee_code
            emp_email = user_to_delete.email if user_to_delete else ''

            emp.delete()
            if user_to_delete:
                user_to_delete.delete()

        record_audit_log(
            request,
            action='USER_DELETED',
            resource='EMPLOYEE',
            resource_id=pk,
            after_value=f"Deleted employee {emp_code} ({emp_name}, {emp_email})"
        )

        return Response({
            'success': True,
            'message': f"Colleague {emp_name} ({emp_code}) deleted successfully."
        })


# 6. Update employee avatar
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def employee_avatar_view(request, pk):
    try:
        emp = Employee.objects.get(pk=pk)
    except Employee.DoesNotExist:
        return Response({'error': 'Employee not found.'}, status=status.HTTP_404_NOT_FOUND)

    req_emp = getattr(request.user, 'employee_profile', None)
    is_self = (req_emp and req_emp.id == emp.id) or (request.user.id == emp.user_id)
    is_privileged = request.user.role in ['SUPER_ADMIN', 'ADMIN', 'MANAGER']

    if not is_self and not is_privileged:
        return Response({'error': 'Forbidden: You can only update your own profile picture.'}, status=status.HTTP_403_FORBIDDEN)

    avatar_url = request.data.get('avatarUrl')
    if not avatar_url:
        return Response({'error': 'avatarUrl is required.'}, status=status.HTTP_400_BAD_REQUEST)

    emp.avatar_url = avatar_url
    emp.save()

    record_audit_log(
        request,
        action='TEAMMATE_AVATAR_UPDATE',
        resource='EMPLOYEE',
        resource_id=emp.id,
        after_value=f"Updated profile photo for {emp.full_name}"
    )

    return Response({
        'success': True,
        'avatarUrl': avatar_url,
        'message': 'Teammate profile picture updated successfully'
    })


# 7. Reset employee password
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def employee_reset_password_view(request, pk):
    if request.user.role not in ['SUPER_ADMIN', 'ADMIN']:
        return Response({'error': 'Forbidden: Administrator privileges required.'}, status=status.HTTP_403_FORBIDDEN)

    try:
        emp = Employee.objects.select_related('user').get(pk=pk)
    except Employee.DoesNotExist:
        return Response({'error': 'Employee not found.'}, status=status.HTTP_404_NOT_FOUND)

    if not emp.user:
        return Response({'error': 'No user account linked to this employee.'}, status=status.HTTP_400_BAD_REQUEST)

    new_password = request.data.get('newPassword', '').strip() or 'password123'
    emp.user.set_password(new_password)
    emp.user.save()

    record_audit_log(
        request,
        action='USER_PASSWORD_RESET',
        resource='EMPLOYEE',
        resource_id=emp.id,
        after_value=f"Reset password for {emp.full_name}"
    )

    return Response({
        'success': True,
        'message': f"Password for {emp.full_name} has been reset to: {new_password}"
    })
