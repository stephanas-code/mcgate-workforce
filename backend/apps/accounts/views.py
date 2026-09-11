from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import AccessToken
from django.contrib.auth import authenticate, get_user_model
from django.db import transaction

from accounts.serializers import (
    format_user_profile,
    LoginSerializer,
    ChangePasswordSerializer,
    UpdateProfileSerializer
)
from core.utils import record_audit_log, get_client_ip
from organization.models import Employee

User = get_user_model()


@api_view(['POST'])
@permission_classes([AllowAny])
def login_view(request):
    serializer = LoginSerializer(data=request.data)
    if not serializer.is_valid():
        return Response({'error': 'Corporate email/code and password are required.'}, status=status.HTTP_400_BAD_REQUEST)

    raw_identifier = serializer.validated_data['email'].strip()
    password = serializer.validated_data['password']
    client_ip = get_client_ip(request)

    normalized = raw_identifier.lower()
    query_identifier = normalized
    if normalized in ['superuser', 'admin', 'superadmin', 'admin@mcgate.tech']:
        query_identifier = 'superuser@mcgate.tech'

    # Try dual auth backend
    user = authenticate(request, username=query_identifier, password=password)

    # Fallback to direct raw identifier if normalized was mapped
    if not user and query_identifier != raw_identifier:
        user = authenticate(request, username=raw_identifier, password=password)

    # Fallback for demo superuser alias
    if not user and normalized in ['superuser', 'admin', 'admin@mcgate.tech']:
        first_super = User.objects.filter(role='SUPER_ADMIN', status='ACTIVE').first()
        if first_super and first_super.check_password(password):
            user = first_super

    if not user:
        record_audit_log(
            None,
            action='LOGIN_FAILURE',
            resource='AUTH',
            resource_id=0,
            ip_address=client_ip,
            after_value=f"Authentication failed for {raw_identifier}"
        )
        return Response({'error': 'Invalid corporate email or password.'}, status=status.HTTP_401_UNAUTHORIZED)

    if user.status != 'ACTIVE':
        return Response({'error': 'This account has been deactivated. Please contact HR.'}, status=status.HTTP_403_FORBIDDEN)

    token = str(AccessToken.for_user(user))
    user_data = format_user_profile(user)

    record_audit_log(
        user,
        action='USER_LOGIN',
        resource='AUTH',
        resource_id=user.id,
        ip_address=client_ip,
        after_value=f"Logged in via verified credentials from {request.META.get('HTTP_USER_AGENT', 'Unknown')}"
    )

    return Response({
        'token': token,
        'user': user_data,
        'message': 'Authentication successful'
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def me_view(request):
    return Response({'user': format_user_profile(request.user)})


@api_view(['GET'])
@permission_classes([AllowAny])
def demo_users_view(request):
    users = User.objects.filter(status='ACTIVE').select_related('employee_profile')
    data = [format_user_profile(u) for u in users]
    return Response(data)


@api_view(['POST'])
@permission_classes([AllowAny])
def switch_demo_view(request):
    email = request.data.get('email', '').strip().lower()
    if not email:
        return Response({'error': 'Email is required.'}, status=status.HTTP_400_BAD_REQUEST)

    user = User.objects.filter(email__iexact=email).first()
    if not user:
        emp = Employee.objects.filter(employee_code__iexact=email).select_related('user').first()
        if emp and emp.user:
            user = emp.user

    if not user:
        return Response({'error': 'Demo user not found.'}, status=status.HTTP_404_NOT_FOUND)

    token = str(AccessToken.for_user(user))
    return Response({
        'token': token,
        'user': format_user_profile(user),
        'message': f"Switched session to {user.email}"
    })


@api_view(['POST'])
@permission_classes([AllowAny])
def forgot_password_view(request):
    return Response({
        'message': 'If an active account exists, password recovery instructions have been dispatched.'
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def change_password_view(request):
    serializer = ChangePasswordSerializer(data=request.data)
    if not serializer.is_valid():
        return Response({'error': 'Invalid password parameters.'}, status=status.HTTP_400_BAD_REQUEST)

    current_pass = serializer.validated_data['currentPassword']
    new_pass = serializer.validated_data['newPassword']

    if not request.user.check_password(current_pass):
        return Response({'error': 'Current password does not match records.'}, status=status.HTTP_400_BAD_REQUEST)

    request.user.set_password(new_pass)
    request.user.save()

    record_audit_log(
        request.user,
        action='USER_PASSWORD_CHANGE',
        resource='AUTH',
        resource_id=request.user.id,
        after_value=f"Password updated by user {request.user.email}"
    )

    return Response({
        'success': True,
        'message': 'Password changed successfully'
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def reset_password_view(request):
    return change_password_view(request)


@api_view(['PUT'])
@permission_classes([IsAuthenticated])
def update_profile_view(request):
    serializer = UpdateProfileSerializer(data=request.data)
    if not serializer.is_valid():
        return Response({'error': 'Invalid profile update data.'}, status=status.HTTP_400_BAD_REQUEST)

    data = serializer.validated_data
    emp = getattr(request.user, 'employee_profile', None)
    if not emp:
        return Response({'error': 'Employee profile not associated with this account.'}, status=status.HTTP_404_NOT_FOUND)

    if 'firstName' in data and data['firstName']:
        emp.first_name = data['firstName'].strip()
    if 'lastName' in data and data['lastName']:
        emp.last_name = data['lastName'].strip()
    if 'phone' in data:
        emp.phone = data['phone'].strip()
    if 'jobTitle' in data and data['jobTitle']:
        emp.job_title = data['jobTitle'].strip()
    if 'avatarUrl' in data:
        emp.avatar_url = data['avatarUrl']
    emp.save()

    record_audit_log(
        request.user,
        action='PROFILE_UPDATED',
        resource='EMPLOYEE',
        resource_id=emp.id,
        after_value=f"Updated profile for {emp.full_name}"
    )

    return Response({
        'success': True,
        'user': format_user_profile(request.user),
        'message': 'Profile updated successfully'
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def update_avatar_view(request):
    avatar_url = request.data.get('avatarUrl')
    if not avatar_url:
        return Response({'error': 'avatarUrl is required.'}, status=status.HTTP_400_BAD_REQUEST)

    emp = getattr(request.user, 'employee_profile', None)
    if not emp:
        return Response({'error': 'Employee profile not found.'}, status=status.HTTP_404_NOT_FOUND)

    emp.avatar_url = avatar_url
    emp.save()

    record_audit_log(
        request.user,
        action='PROFILE_AVATAR_UPDATE',
        resource='EMPLOYEE',
        resource_id=emp.id,
        after_value=f"Updated personal avatar picture for {emp.full_name}"
    )

    return Response({
        'success': True,
        'avatarUrl': avatar_url,
        'user': format_user_profile(request.user),
        'message': 'Profile picture updated successfully'
    })
