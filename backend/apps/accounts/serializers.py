from rest_framework import serializers
from django.contrib.auth import get_user_model

User = get_user_model()


def format_user_profile(user):
    emp = getattr(user, 'employee_profile', None)
    return {
        'id': user.id,
        'email': user.email,
        'role': user.role,
        'status': user.status,
        'employeeId': emp.id if emp else None,
        'employeeCode': emp.employee_code if emp else None,
        'firstName': emp.first_name if emp else '',
        'lastName': emp.last_name if emp else '',
        'fullName': emp.full_name if emp else user.email,
        'jobTitle': emp.job_title if emp else '',
        'avatarUrl': emp.avatar_url if emp else None,
        'phone': emp.phone if emp else '',
        'departmentId': emp.department_id if emp else None,
        'teamId': emp.team_id if emp else None,
        'departmentName': emp.department.name if emp and emp.department else None,
        'teamName': emp.team.name if emp and emp.team else None,
    }


class LoginSerializer(serializers.Serializer):
    email = serializers.CharField(required=True)
    password = serializers.CharField(required=True, write_only=True)


class ChangePasswordSerializer(serializers.Serializer):
    currentPassword = serializers.CharField(required=True)
    newPassword = serializers.CharField(required=True, min_length=6)


class UpdateProfileSerializer(serializers.Serializer):
    firstName = serializers.CharField(required=False, allow_blank=True)
    lastName = serializers.CharField(required=False, allow_blank=True)
    phone = serializers.CharField(required=False, allow_blank=True)
    jobTitle = serializers.CharField(required=False, allow_blank=True)
    avatarUrl = serializers.CharField(required=False, allow_blank=True, allow_null=True)
