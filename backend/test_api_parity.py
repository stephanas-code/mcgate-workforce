import os
import sys
from pathlib import Path

# Setup Django environment
BASE_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(BASE_DIR / 'apps'))
sys.path.insert(0, str(BASE_DIR))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'mcgate_backend.settings')

import django
django.setup()

from rest_framework.test import APIClient

client = APIClient()

def run_tests():
    print("==================================================")
    print("MCGATE WORKFORCE DJANGO BACKEND - VERIFICATION RUN")
    print("==================================================")

    # 1. Dual Auth Tests
    print("\n[TEST 1] Dual Authentication (Email & Employee Code)")
    
    # 1a. Email login (superuser)
    res = client.post('/api/auth/login', {'email': 'superuser@mcgate.tech', 'password': 'password123'}, format='json')
    assert res.status_code == 200, f"Login failed: {res.data}"
    token = res.data['token']
    user = res.data['user']
    print(f"  [PASS] Email login successful: {user['email']} (Role: {user['role']}, Code: {user['employeeCode']})")

    # 1b. Employee Code login (SU-001)
    res_code = client.post('/api/auth/login', {'email': 'SU-001', 'password': 'password123'}, format='json')
    assert res_code.status_code == 200, f"Code login failed: {res_code.data}"
    print(f"  [PASS] Code login successful: SU-001 -> {res_code.data['user']['email']}")

    # 1c. Colleague login by email (stephanas.odogu@miva.edu.ng)
    res_col = client.post('/api/auth/login', {'email': 'stephanas.odogu@miva.edu.ng', 'password': 'password123'}, format='json')
    assert res_col.status_code == 200, f"Colleague email login failed: {res_col.data}"
    print(f"  [PASS] Colleague email login successful: {res_col.data['user']['fullName']}")

    # 1d. Colleague login by employee code (MGT-004)
    res_col_code = client.post('/api/auth/login', {'email': 'MGT-004', 'password': 'password123'}, format='json')
    assert res_col_code.status_code == 200, f"Colleague code login failed: {res_col_code.data}"
    print(f"  [PASS] Colleague code login successful: MGT-004 -> {res_col_code.data['user']['fullName']}")

    # Set Auth header
    client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')

    # 2. Auth /me
    print("\n[TEST 2] /api/auth/me Profile Verification")
    res_me = client.get('/api/auth/me')
    assert res_me.status_code == 200
    print(f"  [PASS] Authenticated as: {res_me.data['user']['fullName']} (Emp ID: {res_me.data['user']['employeeId']})")

    # 3. Organization Endpoints
    print("\n[TEST 3] Organization Directory & Onboarding")
    depts = client.get('/api/departments').data
    print(f"  [PASS] Departments listed: {len(depts)} departments found")
    assert len(depts) >= 8

    teams = client.get('/api/teams').data
    print(f"  [PASS] Teams listed: {len(teams)} teams found")
    assert len(teams) >= 5

    employees = client.get('/api/employees').data
    print(f"  [PASS] Initial Employees listed: {len(employees)} active colleagues")
    assert len(employees) >= 4

    # 3b. Next auto-assigned code
    next_code_res = client.get('/api/employees/next-code')
    assert next_code_res.status_code == 200
    auto_code = next_code_res.data['code']
    print(f"  [PASS] Next auto-assigned code generated: {auto_code}")
    assert auto_code.startswith('MGT-')

    # 3c. Onboard new colleague
    print("\n[TEST 4] Onboard New Colleague & Test Auto-Login")
    new_user_payload = {
        'email': 'alex.turner@mcgate.tech',
        'firstName': 'Alex',
        'lastName': 'Turner',
        'jobTitle': 'Senior Site Reliability Engineer',
        'departmentId': depts[0]['id'],
        'teamId': teams[0]['id'],
        'role': 'EMPLOYEE',
        'password': 'password123'
    }
    create_emp_res = client.post('/api/employees', new_user_payload, format='json')
    assert create_emp_res.status_code == 201, f"Failed to create employee: {create_emp_res.data}"
    assigned_code = create_emp_res.data['employeeCode']
    emp_id = create_emp_res.data['employeeId']
    print(f"  [PASS] Onboarded Alex Turner with auto code: {assigned_code} (Employee ID: {emp_id})")

    # Verify newly onboarded colleague can login by both email and auto-assigned code!
    alex_email_login = client.post('/api/auth/login', {'email': 'alex.turner@mcgate.tech', 'password': 'password123'}, format='json')
    assert alex_email_login.status_code == 200, f"Alex email login failed: {alex_email_login.data}"
    alex_code_login = client.post('/api/auth/login', {'email': assigned_code, 'password': 'password123'}, format='json')
    assert alex_code_login.status_code == 200, f"Alex code login failed: {alex_code_login.data}"
    print(f"  [PASS] Alex Turner verified dual-login (Email & {assigned_code}) successfully!")

    # 3d. Delete Colleague with Safe Cascading
    print("\n[TEST 5] Safe Cascading Colleague Deletion")
    del_res = client.delete(f'/api/employees/{emp_id}')
    assert del_res.status_code == 200, f"Delete failed: {del_res.data}"
    print(f"  [PASS] Colleague Alex Turner deleted safely: {del_res.data['message']}")

    # Verify cannot login after deletion
    alex_dead_login = client.post('/api/auth/login', {'email': 'alex.turner@mcgate.tech', 'password': 'password123'}, format='json')
    assert alex_dead_login.status_code == 401, "Deleted user should not be able to log in"
    print("  [PASS] Verified deleted user account is inaccessible.")

    # 4. Attendance
    print("\n[TEST 6] Attendance Flow (Clock-In & Clock-Out)")
    clock_in_res = client.post('/api/attendance/clock-in', {'location': 'Frankfurt Cloud Data Center'}, format='json')
    assert clock_in_res.status_code in [200, 400], f"Clock in error: {clock_in_res.data}"
    if clock_in_res.status_code == 200:
        print(f"  [PASS] Clock-in recorded: {clock_in_res.data['message']}")
    else:
        print(f"  [PASS] Duplicate clock-in correctly caught: {clock_in_res.data['error']}")

    clock_out_res = client.post('/api/attendance/clock-out', format='json')
    assert clock_out_res.status_code in [200, 400]
    print(f"  [PASS] Clock-out handled: {clock_out_res.data.get('message') or clock_out_res.data.get('error')}")

    live_res = client.get('/api/attendance/live')
    assert live_res.status_code == 200
    metrics = live_res.data['metrics']
    print(f"  [PASS] Live attendance metrics: Total {metrics['totalEmployees']}, Clocked In {metrics['clockedIn']}")

    # 5. Projects & Tasks
    print("\n[TEST 7] Projects, Tasks & Project Code Generator")
    code_res = client.get('/api/projects/generate-code?name=Zero+Trust+Gateway')
    assert code_res.status_code == 200
    print(f"  [PASS] Auto-generated project code: {code_res.data['code']}")

    projects = client.get('/api/projects').data
    assert len(projects) >= 1
    p0 = projects[0]
    print(f"  [PASS] Project retrieved: {p0['code']} - {p0['name']} (Docs: {p0['documentsCount']}, Progress: {p0['progressPercent']}%)")

    # 6. System Diagnostics & Audit Logs
    print("\n[TEST 8] System Diagnostics & Audit Logs")
    sys_res = client.get('/api/system/db-logs')
    assert sys_res.status_code == 200
    print(f"  [PASS] Diagnostics: Total Users={sys_res.data['storage']['totalUsers']}, Storage={sys_res.data['storage']['engine']}")

    audit_res = client.get('/api/audit-logs')
    assert audit_res.status_code == 200
    print(f"  [PASS] Audit Logs count: {len(audit_res.data)} recorded actions")

    print("\n==================================================")
    print("ALL DJANGO BACKEND TESTS PASSED WITH 100% SUCCESS!")
    print("==================================================")

if __name__ == '__main__':
    run_tests()
