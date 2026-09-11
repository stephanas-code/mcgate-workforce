import re
from django.utils import timezone


def get_client_ip(request):
    if not request:
        return '127.0.0.1'
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        ip = x_forwarded_for.split(',')[0].strip()
    else:
        ip = request.META.get('REMOTE_ADDR', '127.0.0.1')
    return ip


def record_audit_log(request_or_user, action, resource, resource_id=None, ip_address=None, before_value=None, after_value=None):
    from system.models import AuditLog

    user = None
    user_name = 'System'
    user_role = 'SYSTEM'

    if hasattr(request_or_user, 'user'):
        req_user = request_or_user.user
        if req_user and req_user.is_authenticated:
            user = req_user
            emp = getattr(req_user, 'employee_profile', None)
            user_name = emp.full_name if emp else req_user.email
            user_role = req_user.role
        if not ip_address:
            ip_address = get_client_ip(request_or_user)
    elif request_or_user is not None:
        user = request_or_user
        emp = getattr(user, 'employee_profile', None)
        user_name = emp.full_name if emp else getattr(user, 'email', 'System')
        user_role = getattr(user, 'role', 'SYSTEM')

    AuditLog.objects.create(
        user=user,
        user_name=user_name,
        user_role=user_role,
        action=action,
        resource=resource,
        resource_id=str(resource_id) if resource_id is not None else None,
        ip_address=ip_address or '127.0.0.1',
        before_value=str(before_value) if before_value is not None else None,
        after_value=str(after_value) if after_value is not None else None,
        created_at=timezone.now()
    )


def generate_next_employee_code():
    from organization.models import Employee

    codes = Employee.objects.values_list('employee_code', flat=True)
    max_num = 0
    for code in codes:
        if not code:
            continue
        matches = re.findall(r'\d+', code)
        if matches:
            num = int(matches[-1])
            if num > max_num:
                max_num = num

    candidate_num = max_num + 1
    while True:
        candidate_code = f"MGT-{str(candidate_num).zfill(3)}"
        if not Employee.objects.filter(employee_code=candidate_code).exists():
            return candidate_code
        candidate_num += 1


def generate_project_code(name):
    from projects.models import Project

    clean_name = re.sub(r'[^A-Za-z0-9]', '', (name or 'PRJ').upper())
    prefix = clean_name[:6] if clean_name else 'PRJ'
    if len(prefix) < 3:
        prefix = (prefix + 'PRJ')[:3]

    candidate = f"PRJ-{prefix}"
    if not Project.objects.filter(code=candidate).exists():
        return candidate

    counter = 1
    while True:
        candidate_with_num = f"PRJ-{prefix}-{str(counter).zfill(2)}"
        if not Project.objects.filter(code=candidate_with_num).exists():
            return candidate_with_num
        counter += 1
