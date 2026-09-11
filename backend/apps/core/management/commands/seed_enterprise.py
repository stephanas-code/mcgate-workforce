from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.utils import timezone
from organization.models import Department, Team, Employee, EmploymentStatus
from system.models import CompanySetting
from projects.models import Project, ProjectDocument, ProjectStatus
from tasks.models import Assignment, Task, Priority, TaskStatus

User = get_user_model()


class Command(BaseCommand):
    help = 'Seeds enterprise directory foundation, corporate accounts, departments, and projects.'

    def handle(self, *args, **options):
        self.stdout.write(self.style.NOTICE('Beginning McGate Enterprise Foundation Seeding...'))

        # 1. Company Settings
        setting, _ = CompanySetting.objects.get_or_create(id=1, defaults={
            'company_name': 'McGate Technologies',
            'timezone': 'Europe/Berlin',
            'work_start_time': '08:30',
            'work_end_time': '17:00',
            'grace_period_minutes': 15,
            'working_days': '["Monday","Tuesday","Wednesday","Thursday","Friday"]',
            'mandatory_clock_in': 1,
            'optional_clock_out': 1,
            'overdue_notification_hours': 24,
            'allow_manual_attendance_correction': 1
        })
        self.stdout.write(self.style.SUCCESS(f"Verified Company Settings: {setting.company_name}"))

        # 2. Departments
        departments_data = [
            ('Software Engineering', 'SWE', 'Core product architecture, frontend, backend, cloud infra'),
            ('Cybersecurity', 'SEC', 'Enterprise security, identity governance, zero-trust ops'),
            ('IT Infrastructure', 'IT', 'Internal systems, networks, servers, DevOps orchestration'),
            ('Sales & BD', 'SALES', 'Client relations, enterprise contracts, partner growth'),
            ('Marketing', 'MKT', 'Brand strategy, technical communications, community outreach'),
            ('Human Resources', 'HR', 'Workforce operations, talent acquisition, people advocacy'),
            ('Finance', 'FIN', 'Corporate finance, compliance, asset allocation, payroll'),
            ('Operations', 'OPS', 'Service delivery, customer success, program management'),
        ]

        dept_map = {}
        for name, code, desc in departments_data:
            dept, _ = Department.objects.get_or_create(code=code, defaults={'name': name, 'description': desc})
            dept_map[code] = dept
        self.stdout.write(self.style.SUCCESS(f"Verified {len(dept_map)} Corporate Departments"))

        # 3. Teams
        teams_data = [
            ('SWE', 'Cloud Platform Team', 'Scalable services and microservices architecture'),
            ('SWE', 'Frontend Engineering', 'Design system and client interfaces'),
            ('SEC', 'Threat Intelligence & SecOps', 'Monitoring, zero-trust auditing, penetration analysis'),
            ('IT', 'Infrastructure & DevOps', 'CI/CD, Kubernetes, cloud governance'),
            ('HR', 'People Ops & Attendance', 'Workforce compliance and HR operations'),
        ]

        team_map = {}
        for d_code, t_name, t_desc in teams_data:
            dept = dept_map.get(d_code)
            if dept:
                team, _ = Team.objects.get_or_create(department=dept, name=t_name, defaults={'description': t_desc})
                team_map[t_name] = team
        self.stdout.write(self.style.SUCCESS(f"Verified {len(team_map)} Enterprise Teams"))

        # 4. Core Corporate Accounts
        default_pw = 'password123'
        swe_dept = dept_map.get('SWE')
        cloud_team = team_map.get('Cloud Platform Team')

        core_accounts = [
            {
                'email': 'superuser@mcgate.tech',
                'role': 'SUPER_ADMIN',
                'code': 'SU-001',
                'first_name': 'Super',
                'last_name': 'User',
                'job_title': 'Super Administrator',
                'phone': '+49 30 555-0100'
            },
            {
                'email': 'stephenosanebi@gmail.com',
                'role': 'SUPER_ADMIN',
                'code': 'MGT-000',
                'first_name': 'Stephen',
                'last_name': 'Osanebi',
                'job_title': 'Principal Super Admin',
                'phone': '+49 30 555-0199'
            },
            {
                'email': 'meshack.ossai@mcgatetechnologies.com',
                'role': 'EMPLOYEE',
                'code': 'MGT-002',
                'first_name': 'Meshack',
                'last_name': 'Ossai',
                'job_title': 'Team Member',
                'phone': '+234 800 000 0000'
            },
            {
                'email': 'stephanas.odogu@miva.edu.ng',
                'role': 'EMPLOYEE',
                'code': 'MGT-004',
                'first_name': 'Stephanas',
                'last_name': 'Odogu',
                'job_title': 'Team Member',
                'phone': '+234 800 000 0001'
            }
        ]

        super_user_instance = None
        for acc in core_accounts:
            user = User.objects.filter(email__iexact=acc['email']).first()
            if not user:
                user = User.objects.create_user(
                    email=acc['email'].lower(),
                    password=default_pw,
                    role=acc['role'],
                    status='ACTIVE'
                )
            else:
                user.role = acc['role']
                user.status = 'ACTIVE'
                user.set_password(default_pw)
                user.save()

            if acc['email'] == 'superuser@mcgate.tech':
                super_user_instance = user

            emp = Employee.objects.filter(user=user).first()
            if not emp:
                emp = Employee.objects.filter(employee_code=acc['code']).first()

            if not emp:
                emp = Employee.objects.create(
                    user=user,
                    employee_code=acc['code'],
                    first_name=acc['first_name'],
                    last_name=acc['last_name'],
                    phone=acc['phone'],
                    job_title=acc['job_title'],
                    department=swe_dept,
                    team=cloud_team,
                    employment_status=EmploymentStatus.FULL_TIME,
                    joined_date=timezone.now().date()
                )
            else:
                emp.user = user
                emp.first_name = acc['first_name']
                emp.last_name = acc['last_name']
                emp.job_title = acc['job_title']
                emp.employee_code = acc['code']
                emp.save()

            self.stdout.write(self.style.SUCCESS(f"Synchronized account: {acc['email']} [{acc['code']}]"))

        # 5. Seed Core Projects & Documents
        prj, _ = Project.objects.get_or_create(
            code='PRJ-STOREPRO',
            defaults={
                'name': 'StorePro Enterprise Platform',
                'description': 'Tier-1 high-throughput transaction platform for enterprise inventory and checkout operations.',
                'manager': Employee.objects.filter(employee_code='SU-001').first(),
                'department': swe_dept,
                'status': ProjectStatus.ACTIVE,
                'start_date': '2025-01-01',
                'expected_completion_date': '2026-12-31'
            }
        )

        if prj.documents.count() == 0 and super_user_instance:
            ProjectDocument.objects.create(
                project=prj,
                filename='architecture_specification.md',
                original_name='StorePro_Architecture_Spec_v2.md',
                file_size=4280,
                file_extension='md',
                mime_type='text/markdown',
                file_data="""# StorePro Enterprise Cloud Architecture Specification

## 1. Executive Summary
StorePro represents McGate Technologies' tier-1 high-throughput transaction platform.
This document outlines core infrastructural parameters, container boundaries, and API rate gates.

## 2. Infrastructure Topology
- **Edge Proxy**: Nginx 1.25 with SSL termination and mutual TLS validation.
- **Compute Cluster**: Managed Kubernetes v1.30 with multi-region cluster failover.
- **Persistence Engine**: Distributed Relational Core with strict read-replicas.

## 3. SLA & Performance Benchmarks
- Maximum API Latency P99: **< 45ms**
- Daily Peak Concurrency: **125,000 req/sec**
- Uptime Commitment: **99.995%**""",
                uploaded_by_user=super_user_instance,
                uploaded_by_name='Super User'
            )

            ProjectDocument.objects.create(
                project=prj,
                filename='deployment_runbook.txt',
                original_name='StorePro_Deployment_Runbook.txt',
                file_size=1850,
                file_extension='txt',
                mime_type='text/plain',
                file_data="""McGate Technologies - StorePro Deployment Runbook v3.4
======================================================
1. Pre-Deployment Verification:
   - Verify all pull requests are tagged and reviewed by engineering lead.
   - Confirm database migration scripts pass idempotency checks.
   - Notify SecOps on #sec-alerts channel.

2. Release Sequence:
   - Drain canary nodes via Kubernetes rollout command.
   - Execute db migration scripts.
   - Warm cache redis instances.
   - Switch DNS weighted routing 10% -> 50% -> 100%.

3. Rollback Procedures:
   - Revert image tag in Helm values file.
   - Issue fast-rollback command to cluster.
   - Review audit logs for discrepancies.""",
                uploaded_by_user=super_user_instance,
                uploaded_by_name='Super User'
            )

        self.stdout.write(self.style.SUCCESS("Enterprise seed complete! Database is fully operational."))
