from rest_framework import serializers
from organization.models import Department, Team, Employee
from accounts.models import User


class DepartmentSerializer(serializers.ModelSerializer):
    employee_count = serializers.IntegerField(read_only=True)
    team_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Department
        fields = ['id', 'name', 'code', 'description', 'head_employee', 'created_at', 'employee_count', 'team_count']


class TeamSerializer(serializers.ModelSerializer):
    department_name = serializers.CharField(source='department.name', read_only=True)
    department_code = serializers.CharField(source='department.code', read_only=True)
    team_lead_first = serializers.CharField(source='team_lead.first_name', read_only=True, default=None)
    team_lead_last = serializers.CharField(source='team_lead.last_name', read_only=True, default=None)
    member_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Team
        fields = [
            'id', 'department_id', 'department', 'name', 'description', 'team_lead',
            'department_name', 'department_code', 'team_lead_first', 'team_lead_last',
            'member_count', 'created_at'
        ]
