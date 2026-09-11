from django.contrib.auth.backends import ModelBackend
from django.contrib.auth import get_user_model
from django.db.models import Q
from organization.models import Employee

User = get_user_model()


class DualAuthBackend(ModelBackend):
    """
    Authenticates against either User.email or Employee.employee_code.
    """
    def authenticate(self, request, username=None, password=None, **kwargs):
        identifier = username or kwargs.get('email') or kwargs.get('identifier')
        if not identifier or not password:
            return None

        identifier = identifier.strip().lower()

        try:
            # 1. Check direct email match
            user = User.objects.filter(email__iexact=identifier).first()

            # 2. If not found by email, check employee_code match
            if not user:
                employee = Employee.objects.filter(employee_code__iexact=identifier).select_related('user').first()
                if employee and employee.user:
                    user = employee.user

            if user and user.check_password(password):
                if self.user_can_authenticate(user):
                    return user
        except Exception:
            return None

        return None
