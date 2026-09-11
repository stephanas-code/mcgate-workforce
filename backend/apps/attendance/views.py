import uuid
from datetime import datetime, timezone as dt_timezone
import zoneinfo
from django.utils import timezone
from django.db.models import Q
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from attendance.models import Attendance, WorkSession, AttendanceStatus, WorkSessionStatus
from organization.models import Employee
from system.models import CompanySetting
from core.utils import record_audit_log, get_client_ip


def format_duration(start_iso, end_iso):
    try:
        s = datetime.fromisoformat(start_iso.replace('Z', '+00:00'))
        e = datetime.fromisoformat(end_iso.replace('Z', '+00:00'))
        diff_sec = max(0, (e - s).total_seconds())
        total_mins = round(diff_sec / 60)
        hours = total_mins // 60
        mins = total_mins % 60
        return total_mins, f"{hours}h {str(mins).zfill(2)}m"
    except Exception:
        return 0, "0h 00m"


def get_server_date(tz_name=None):
    now = timezone.now()
    if tz_name:
        try:
            tz = zoneinfo.ZoneInfo(tz_name)
            return now.astimezone(tz).strftime('%Y-%m-%d')
        except Exception:
            pass
    return now.strftime('%Y-%m-%d')


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def clock_in_view(request):
    emp = getattr(request.user, 'employee_profile', None)
    if not emp:
        return Response({'error': 'Authenticated user is not registered as an employee.'}, status=status.HTTP_400_BAD_REQUEST)

    client_tz = request.data.get('timezone') or request.data.get('location_tz')
    today_str = get_server_date(client_tz)
    now_iso = timezone.now().isoformat()

    # Check duplicate clock-in for today
    existing = Attendance.objects.filter(employee=emp, date=today_str).first()
    if existing:
        return Response({
            'error': f"Duplicate clock-in rejected. You have already clocked in for today at {existing.clock_in_time}.",
            'alreadyClockedIn': True,
            'clockInTime': existing.clock_in_time
        }, status=status.HTTP_400_BAD_REQUEST)

    # Check late arrival against settings
    setting = CompanySetting.objects.first()
    effective_tz = client_tz or (setting.timezone if setting else 'Europe/Berlin')
    att_status = AttendanceStatus.PRESENT

    if setting and setting.work_start_time:
        try:
            parts = setting.work_start_time.split(':')
            start_h, start_m = int(parts[0]), int(parts[1])
            grace = setting.grace_period_minutes or 15
            grace_limit = (start_h * 60) + start_m + grace

            tz = zoneinfo.ZoneInfo(effective_tz)
            local_now = timezone.now().astimezone(tz)
            current_mins = (local_now.hour * 60) + local_now.minute
            if current_mins > grace_limit:
                att_status = AttendanceStatus.LATE
        except Exception:
            pass

    client_ip = get_client_ip(request)
    device_info = request.META.get('HTTP_USER_AGENT', 'Standard Enterprise Browser')
    loc_payload = request.data.get('location')
    location_info = loc_payload if loc_payload else (f"Remote ({effective_tz})" if client_tz else "HQ Campus - Frankfurt")
    session_id = f"sess-{emp.id}-{int(timezone.now().timestamp())}-{uuid.uuid4().hex[:8]}"

    att = Attendance.objects.create(
        employee=emp,
        date=today_str,
        clock_in_time=now_iso,
        status=att_status,
        work_session_id=session_id,
        ip_address=client_ip,
        device_info=device_info,
        location_info=location_info,
        is_manually_corrected=0
    )

    WorkSession.objects.create(
        session_id=session_id,
        employee=emp,
        attendance=att,
        start_time=now_iso,
        status=WorkSessionStatus.ACTIVE
    )

    record_audit_log(
        request,
        action='CLOCK_IN',
        resource='ATTENDANCE',
        resource_id=att.id,
        ip_address=client_ip,
        after_value=f"Clocked in at {now_iso} ({att_status}) from {location_info}"
    )

    return Response({
        'success': True,
        'message': f"Clock-in timestamp recorded successfully.",
        'record': {
            'id': att.id,
            'date': today_str,
            'clockInTime': now_iso,
            'status': att_status,
            'workSessionId': session_id
        }
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def clock_out_view(request):
    emp = getattr(request.user, 'employee_profile', None)
    if not emp:
        return Response({'error': 'Authenticated user is not registered as an employee.'}, status=status.HTTP_400_BAD_REQUEST)

    client_tz = request.data.get('timezone')
    today_str = get_server_date(client_tz)
    now_iso = timezone.now().isoformat()

    record = Attendance.objects.filter(employee=emp, date=today_str).first()
    if not record:
        record = Attendance.objects.filter(employee=emp, clock_out_time__isnull=True).order_by('-id').first()

    if not record:
        return Response({
            'error': 'Cannot clock out: You have not clocked in for today yet. Clock-in is mandatory before clock-out.'
        }, status=status.HTTP_400_BAD_REQUEST)

    if record.clock_out_time:
        return Response({'error': 'You have already clocked out for today.'}, status=status.HTTP_400_BAD_REQUEST)

    total_mins, duration_formatted = format_duration(record.clock_in_time, now_iso)
    record.clock_out_time = now_iso
    record.duration_minutes = total_mins
    record.duration_formatted = duration_formatted
    record.status = AttendanceStatus.COMPLETED
    record.save()

    # Close active work session
    WorkSession.objects.filter(attendance=record, status=WorkSessionStatus.ACTIVE).update(
        end_time=now_iso,
        status=WorkSessionStatus.CLOSED
    )

    record_audit_log(
        request,
        action='CLOCK_OUT',
        resource='ATTENDANCE',
        resource_id=record.id,
        after_value=f"Clocked out at {now_iso}. Duration: {duration_formatted}"
    )

    return Response({
        'success': True,
        'message': f"Clock-out recorded. Total shift duration: {duration_formatted}.",
        'record': {
            'id': record.id,
            'clockInTime': record.clock_in_time,
            'clockOutTime': now_iso,
            'durationFormatted': duration_formatted,
            'durationMinutes': total_mins,
            'status': record.status
        }
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def my_attendance_view(request):
    emp = getattr(request.user, 'employee_profile', None)
    if not emp:
        return Response({'today': None, 'history': []})

    client_tz = request.query_params.get('timezone')
    today_str = get_server_date(client_tz)

    today_record = Attendance.objects.filter(employee=emp, date=today_str).first()
    if not today_record:
        today_record = Attendance.objects.filter(employee=emp, clock_out_time__isnull=True).order_by('-id').first()

    history_qs = Attendance.objects.filter(employee=emp).order_by('-date', '-clock_in_time')

    filter_mode = request.query_params.get('filter', 'all')
    if filter_mode == 'today':
        history_qs = history_qs.filter(date=today_str)
    elif filter_mode == 'this_week':
        d = timezone.now().date()
        week_ago = (d - timezone.timedelta(days=7)).strftime('%Y-%m-%d')
        history_qs = history_qs.filter(date__gte=week_ago)
    elif filter_mode == 'this_month':
        d = timezone.now().date()
        month_start = f"{d.year}-{str(d.month).zfill(2)}-01"
        history_qs = history_qs.filter(date__gte=month_start)
    elif request.query_params.get('startDate') and request.query_params.get('endDate'):
        history_qs = history_qs.filter(date__range=[request.query_params.get('startDate'), request.query_params.get('endDate')])

    def att_to_dict(a):
        return {
            'id': a.id,
            'date': a.date,
            'clock_in_time': a.clock_in_time,
            'clock_out_time': a.clock_out_time,
            'duration_formatted': a.duration_formatted,
            'duration_minutes': a.duration_minutes,
            'status': a.status,
            'ip_address': a.ip_address,
            'device_info': a.device_info,
            'location_info': a.location_info,
            'is_manually_corrected': a.is_manually_corrected,
            'correction_reason': a.correction_reason,
            'corrected_at': a.corrected_at
        }

    return Response({
        'today': att_to_dict(today_record) if today_record else None,
        'history': [att_to_dict(a) for a in history_qs[:100]]
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def live_attendance_view(request):
    today_str = get_server_date()
    user_role = request.user.role
    emp = getattr(request.user, 'employee_profile', None)

    employees_qs = Employee.objects.select_related('department', 'team')
    if user_role == 'MANAGER' and emp:
        if emp.team_id:
            employees_qs = employees_qs.filter(team_id=emp.team_id)
        elif emp.department_id:
            employees_qs = employees_qs.filter(department_id=emp.department_id)
    elif user_role == 'EMPLOYEE' and emp:
        employees_qs = employees_qs.filter(id=emp.id)

    employees = list(employees_qs.order_by('first_name', 'last_name'))
    attendances = {a.employee_id: a for a in Attendance.objects.filter(date=today_str)}

    total_employees = len(employees)
    clocked_in = 0
    clocked_out = 0
    not_clocked_in = 0
    currently_active = 0
    late_arrivals = 0

    records = []
    for e in employees:
        att = attendances.get(e.id)
        display_status = 'Not Present'
        if att:
            clocked_in += 1
            if att.clock_out_time:
                clocked_out += 1
                display_status = 'Completed'
            else:
                currently_active += 1
                display_status = 'Active'
            if att.status == AttendanceStatus.LATE:
                late_arrivals += 1
        else:
            not_clocked_in += 1

        records.append({
            'employeeId': e.id,
            'employeeCode': e.employee_code,
            'name': e.full_name,
            'jobTitle': e.job_title,
            'department': e.department.name if e.department else 'General',
            'team': e.team.name if e.team else 'Unassigned',
            'attendanceId': att.id if att else None,
            'clockInTime': att.clock_in_time if att else None,
            'clockOutTime': att.clock_out_time if att else None,
            'duration': att.duration_formatted or '—' if att else '—',
            'status': display_status,
            'isLate': att.status == AttendanceStatus.LATE if att else False,
            'isManuallyCorrected': bool(att.is_manually_corrected) if att else False,
            'correctionReason': att.correction_reason if att else None,
            'ipAddress': att.ip_address if att else None
        })

    # Open past sessions
    open_past = Attendance.objects.filter(
        date__lt=today_str,
        clock_out_time__isnull=True
    ).select_related('employee', 'employee__department').order_by('-date')[:20]

    open_past_list = [{
        'id': a.id,
        'date': a.date,
        'first_name': a.employee.first_name,
        'last_name': a.employee.last_name,
        'clock_in_time': a.clock_in_time,
        'department_name': a.employee.department.name if a.employee.department else 'General'
    } for a in open_past]

    return Response({
        'today': today_str,
        'metrics': {
            'totalEmployees': total_employees,
            'clockedIn': clocked_in,
            'notClockedIn': not_clocked_in,
            'clockedOut': clocked_out,
            'currentlyActive': currently_active,
            'lateArrivals': late_arrivals,
            'unclosedSessionsCount': len(open_past_list)
        },
        'records': records,
        'openPastSessions': open_past_list
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def correct_attendance_view(request):
    att_id = request.data.get('attendanceId')
    clock_out_time = request.data.get('clockOutTime')
    reason = request.data.get('reason', '').strip()

    if not att_id or not reason:
        return Response({'error': 'Attendance ID and correction reason are required.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        att = Attendance.objects.get(pk=att_id)
    except Attendance.DoesNotExist:
        return Response({'error': 'Attendance record not found.'}, status=status.HTTP_404_NOT_FOUND)

    final_clock_out = clock_out_time if clock_out_time else timezone.now().isoformat()
    total_mins, duration_formatted = format_duration(att.clock_in_time, final_clock_out)

    att.clock_out_time = final_clock_out
    att.duration_minutes = total_mins
    att.duration_formatted = duration_formatted
    att.status = AttendanceStatus.COMPLETED
    att.is_manually_corrected = 1
    att.corrected_by_user = request.user
    att.correction_reason = reason
    att.corrected_at = timezone.now().isoformat()
    att.save()

    record_audit_log(
        request,
        action='ATTENDANCE_CORRECTION',
        resource='ATTENDANCE',
        resource_id=att.id,
        after_value=f"Corrected attendance for employee {att.employee.employee_code}. Reason: {reason}"
    )

    return Response({
        'success': True,
        'message': 'Attendance corrected successfully',
        'record': {
            'id': att.id,
            'clockInTime': att.clock_in_time,
            'clockOutTime': att.clock_out_time,
            'durationFormatted': att.duration_formatted,
            'status': att.status
        }
    })
