import { Router } from 'express';
import { queryOne, queryAll, execute } from '../db.ts';
import { authenticateToken, requireRoles, AuthRequest } from '../auth.ts';
import { logAudit } from '../audit.ts';
import crypto from 'crypto';

const router = Router();

// Helper to format duration in hours and minutes
function formatDuration(startIso: string, endIso: string): { minutes: number; formatted: string } {
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  const diffMs = Math.max(0, end - start);
  const totalMinutes = Math.round(diffMs / (1000 * 60));
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  return {
    minutes: totalMinutes,
    formatted: `${hours}h ${mins < 10 ? '0' : ''}${mins}m`
  };
}

// Helper to get current date string YYYY-MM-DD in specific timezone or UTC
function getServerDate(timeZone?: string): string {
  try {
    if (timeZone) {
      const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
      return formatter.format(new Date());
    }
  } catch (e) {}
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// 1. Clock In (MANDATORY)
router.post('/clock-in', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const employeeId = req.user?.employeeId;
    if (!employeeId) {
      return res.status(400).json({ error: 'Authenticated user is not registered as an employee.' });
    }

    const clientTz = (req.body.timezone as string) || undefined;
    const today = getServerDate(clientTz);
    const serverTimestamp = new Date().toISOString();

    // Check if employee has already clocked in for today
    const existing = await queryOne<{
      id: number;
      clock_in_time: string;
      clock_out_time: string | null;
      status: string;
    }>(
      'SELECT id, clock_in_time, clock_out_time, status FROM attendance WHERE employee_id = ? AND date = ?',
      [employeeId, today]
    );

    if (existing) {
      let inTime = new Date(existing.clock_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      if (clientTz) {
        try {
          inTime = new Intl.DateTimeFormat('en-US', {
            timeZone: clientTz,
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
          }).format(new Date(existing.clock_in_time));
        } catch (e) {}
      }
      return res.status(400).json({
        error: `Duplicate clock-in rejected. You have already clocked in for today at ${inTime}.`,
        alreadyClockedIn: true,
        clockInTime: existing.clock_in_time
      });
    }

    // Inspect server settings for working hours / late status
    const settings = await queryOne<{ work_start_time: string; grace_period_minutes: number; timezone: string }>(
      'SELECT work_start_time, grace_period_minutes, timezone FROM company_settings WHERE id = 1'
    );

    const effectiveTz = clientTz || settings?.timezone || 'Europe/Berlin';
    let status = 'PRESENT';
    if (settings) {
      const [startH, startM] = settings.work_start_time.split(':').map(Number);
      const graceLimit = (startH * 60) + startM + (settings.grace_period_minutes || 15);
      const serverDateObj = new Date(serverTimestamp);

      let localHours = serverDateObj.getHours();
      let localMinutes = serverDateObj.getMinutes();
      try {
        const parts = new Intl.DateTimeFormat('en-US', {
          timeZone: effectiveTz,
          hour: 'numeric',
          minute: 'numeric',
          hour12: false
        }).formatToParts(serverDateObj);
        const hPart = parts.find((p) => p.type === 'hour');
        const mPart = parts.find((p) => p.type === 'minute');
        if (hPart && mPart) {
          localHours = parseInt(hPart.value, 10);
          localMinutes = parseInt(mPart.value, 10);
        }
      } catch (e) {}

      const currentMinutes = (localHours * 60) + localMinutes;
      if (currentMinutes > graceLimit) {
        status = 'LATE';
      }
    }

    const ipAddress = (req.headers['x-forwarded-for'] as string) || req.ip || '127.0.0.1';
    const deviceInfo = (req.headers['user-agent'] as string) || 'Standard Enterprise Browser';
    const locationInfo = req.body.location
      ? (clientTz ? `${req.body.location} (${clientTz})` : req.body.location)
      : (clientTz ? `Remote Location (${clientTz})` : 'HQ Campus - Frankfurt');
    const sessionId = `sess-${employeeId}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

    // Insert attendance record (protected by DB UNIQUE constraint on employee_id, date)
    const { lastInsertRowid: attendanceId } = await execute(`
      INSERT INTO attendance (
        employee_id, date, clock_in_time, clock_out_time, duration_minutes, duration_formatted,
        ip_address, device_info, location_info, status, work_session_id, is_manually_corrected,
        created_at, updated_at
      ) VALUES (?, ?, ?, NULL, NULL, NULL, ?, ?, ?, ?, ?, 0, ?, ?)
    `, [
      employeeId, today, serverTimestamp, ipAddress, deviceInfo, locationInfo, status, sessionId, serverTimestamp, serverTimestamp
    ]);

    // Create active work session
    await execute(`
      INSERT INTO work_sessions (session_id, employee_id, attendance_id, start_time, status, created_at)
      VALUES (?, ?, ?, ?, 'ACTIVE', ?)
    `, [
      sessionId, employeeId, attendanceId, serverTimestamp, serverTimestamp
    ]);

    let formattedTime = new Date(serverTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    try {
      formattedTime = new Intl.DateTimeFormat('en-US', {
        timeZone: effectiveTz,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      }).format(new Date(serverTimestamp));
    } catch (e) {}

    await logAudit({
      userId: req.user!.id,
      userName: req.user!.fullName || req.user!.email,
      userRole: req.user!.role,
      action: 'CLOCK_IN',
      resource: 'ATTENDANCE',
      resourceId: attendanceId,
      ipAddress,
      afterValue: `Clocked in at ${formattedTime} (${status}) from ${locationInfo}`
    });

    res.json({
      success: true,
      message: `Clock-in timestamp recorded successfully at ${formattedTime}.`,
      record: {
        id: attendanceId,
        date: today,
        clockInTime: serverTimestamp,
        formattedTime,
        status,
        workSessionId: sessionId
      }
    });
  } catch (err: any) {
    if (err.message && err.message.includes('unq_employee_daily_attendance')) {
      return res.status(400).json({ error: 'Duplicate clock-in prevented at database level.' });
    }
    console.error('Clock-in error:', err);
    res.status(500).json({ error: 'Failed to record clock-in.' });
  }
});

// 2. Clock Out (OPTIONAL)
router.post('/clock-out', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const employeeId = req.user?.employeeId;
    if (!employeeId) {
      return res.status(400).json({ error: 'Authenticated user is not registered as an employee.' });
    }

    const clientTz = (req.body.timezone as string) || undefined;
    const today = getServerDate(clientTz);
    const serverTimestamp = new Date().toISOString();

    // Check if employee clocked in today or has an active session
    let record = await queryOne<{
      id: number;
      clock_in_time: string;
      clock_out_time: string | null;
      work_session_id: string;
      status: string;
    }>(
      'SELECT id, clock_in_time, clock_out_time, work_session_id, status FROM attendance WHERE employee_id = ? AND date = ?',
      [employeeId, today]
    );

    if (!record) {
      record = await queryOne<{
        id: number;
        clock_in_time: string;
        clock_out_time: string | null;
        work_session_id: string;
        status: string;
      }>(
        'SELECT id, clock_in_time, clock_out_time, work_session_id, status FROM attendance WHERE employee_id = ? AND clock_out_time IS NULL ORDER BY id DESC LIMIT 1',
        [employeeId]
      );
    }

    if (!record) {
      return res.status(400).json({
        error: 'Cannot clock out: You have not clocked in for today yet. Clock-in is mandatory before clock-out.'
      });
    }

    if (record.clock_out_time) {
      return res.status(400).json({
        error: `You have already clocked out for today.`
      });
    }

    const duration = formatDuration(record.clock_in_time, serverTimestamp);
    const newStatus = 'COMPLETED';

    await execute(`
      UPDATE attendance SET
        clock_out_time = ?,
        duration_minutes = ?,
        duration_formatted = ?,
        status = ?,
        updated_at = ?
      WHERE id = ?
    `, [
      serverTimestamp,
      duration.minutes,
      duration.formatted,
      newStatus,
      serverTimestamp,
      record.id
    ]);

    // Close work session
    await execute(`
      UPDATE work_sessions SET
        end_time = ?,
        status = 'CLOSED'
      WHERE session_id = ?
    `, [serverTimestamp, record.work_session_id]);

    let formattedIn = new Date(record.clock_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    let formattedOut = new Date(serverTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (clientTz) {
      try {
        formattedIn = new Intl.DateTimeFormat('en-US', {
          timeZone: clientTz,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true
        }).format(new Date(record.clock_in_time));
        formattedOut = new Intl.DateTimeFormat('en-US', {
          timeZone: clientTz,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true
        }).format(new Date(serverTimestamp));
      } catch (e) {}
    }

    await logAudit({
      userId: req.user!.id,
      userName: req.user!.fullName || req.user!.email,
      userRole: req.user!.role,
      action: 'CLOCK_OUT',
      resource: 'ATTENDANCE',
      resourceId: record.id,
      ipAddress: req.ip,
      afterValue: `Clocked out at ${formattedOut}. Duration: ${duration.formatted}`
    });

    res.json({
      success: true,
      message: `Clock-out timestamp recorded at ${formattedOut} (Arrival: ${formattedIn}).`,
      record: {
        id: record.id,
        clockInTime: record.clock_in_time,
        clockOutTime: serverTimestamp,
        durationFormatted: duration.formatted,
        durationMinutes: duration.minutes,
        status: newStatus
      }
    });
  } catch (err: any) {
    console.error('Clock-out error:', err);
    res.status(500).json({ error: 'Failed to record clock-out.' });
  }
});

// 3. Get employee's own attendance (Today status + History with filters)
router.get('/me', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const employeeId = req.user?.employeeId;
    if (!employeeId) {
      return res.json({
        today: null,
        history: []
      });
    }

    const clientTz = (req.query.timezone as string) || undefined;
    const today = getServerDate(clientTz);

    // Fetch today's record (or currently active session)
    let todayRecord = await queryOne<{
      id: number;
      date: string;
      clock_in_time: string;
      clock_out_time: string | null;
      duration_formatted: string | null;
      duration_minutes: number | null;
      status: string;
      work_session_id: string;
      ip_address: string;
      device_info: string;
      location_info: string;
      is_manually_corrected: number;
      correction_reason: string | null;
    }>(
      'SELECT * FROM attendance WHERE employee_id = ? AND date = ?',
      [employeeId, today]
    );

    if (!todayRecord) {
      todayRecord = await queryOne<any>(
        'SELECT * FROM attendance WHERE employee_id = ? AND clock_out_time IS NULL ORDER BY id DESC LIMIT 1',
        [employeeId]
      );
    }

    // Filters for history
    const filter = (req.query.filter as string) || 'all';
    let dateFilterClause = '';
    const params: any[] = [employeeId];

    if (filter === 'today') {
      dateFilterClause = 'AND date = ?';
      params.push(today);
    } else if (filter === 'this_week') {
      // Last 7 days
      const d = new Date();
      d.setDate(d.getDate() - 7);
      const weekAgo = d.toISOString().split('T')[0];
      dateFilterClause = 'AND date >= ?';
      params.push(weekAgo);
    } else if (filter === 'this_month') {
      // First day of current month
      const d = new Date();
      const firstOfMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
      dateFilterClause = 'AND date >= ?';
      params.push(firstOfMonth);
    } else if (req.query.startDate && req.query.endDate) {
      dateFilterClause = 'AND date BETWEEN ? AND ?';
      params.push(req.query.startDate, req.query.endDate);
    }

    const history = await queryAll<{
      id: number;
      date: string;
      clock_in_time: string;
      clock_out_time: string | null;
      duration_formatted: string | null;
      duration_minutes: number | null;
      status: string;
      ip_address: string;
      device_info: string;
      is_manually_corrected: number;
      correction_reason: string | null;
      corrected_at: string | null;
    }>(`
      SELECT 
        id, date, clock_in_time, clock_out_time, duration_formatted, duration_minutes,
        status, ip_address, device_info, is_manually_corrected, correction_reason, corrected_at
      FROM attendance
      WHERE employee_id = ? ${dateFilterClause}
      ORDER BY date DESC, clock_in_time DESC
      LIMIT 100
    `, params);

    res.json({
      today: todayRecord || null,
      history
    });
  } catch (err: any) {
    console.error('Fetch attendance error:', err);
    res.status(500).json({ error: 'Failed to retrieve attendance data.' });
  }
});

// 4. Live Attendance Dashboard Overview (For Admins and Managers)
router.get('/live', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const today = getServerDate();
    const userRole = req.user?.role;
    const userTeamId = req.user?.teamId;
    const userDeptId = req.user?.departmentId;

    let employeeFilter = '';
    const filterParams: any[] = [today];

    // Team Leads can only view their team
    if (userRole === 'MANAGER') {
      if (userTeamId) {
        employeeFilter = 'WHERE e.team_id = ?';
        filterParams.push(userTeamId);
      } else if (userDeptId) {
        employeeFilter = 'WHERE e.department_id = ?';
        filterParams.push(userDeptId);
      }
    } else if (userRole === 'EMPLOYEE') {
      // Employees can only view basic team attendance if allowed
      employeeFilter = 'WHERE e.id = ?';
      filterParams.push(req.user?.employeeId || 0);
    }

    // Get all employees and their today's attendance
    const rows = await queryAll<{
      emp_id: number;
      emp_code: string;
      first_name: string;
      last_name: string;
      job_title: string;
      department_name: string;
      team_name: string;
      att_id: number | null;
      clock_in_time: string | null;
      clock_out_time: string | null;
      duration_formatted: string | null;
      duration_minutes: number | null;
      att_status: string | null;
      is_manually_corrected: number | null;
      correction_reason: string | null;
      ip_address: string | null;
    }>(`
      SELECT 
        e.id as emp_id, e.employee_code as emp_code, e.first_name, e.last_name, e.job_title,
        d.name as department_name,
        t.name as team_name,
        a.id as att_id,
        a.clock_in_time,
        a.clock_out_time,
        a.duration_formatted,
        a.duration_minutes,
        a.status as att_status,
        a.is_manually_corrected,
        a.correction_reason,
        a.ip_address
      FROM employees e
      LEFT JOIN departments d ON d.id = e.department_id
      LEFT JOIN teams t ON t.id = e.team_id
      LEFT JOIN attendance a ON a.employee_id = e.id AND a.date = ?
      ${employeeFilter}
      ORDER BY 
        CASE 
          WHEN a.clock_in_time IS NOT NULL AND a.clock_out_time IS NULL THEN 1
          WHEN a.clock_in_time IS NOT NULL AND a.clock_out_time IS NOT NULL THEN 2
          ELSE 3
        END, e.first_name ASC
    `, filterParams);

    // Compute metrics
    const totalEmployees = rows.length;
    let clockedIn = 0;
    let clockedOut = 0;
    let notClockedIn = 0;
    let currentlyActive = 0;
    let lateArrivals = 0;

    const list = rows.map(r => {
      let displayStatus = 'Not Present';
      if (r.clock_in_time) {
        clockedIn++;
        if (r.clock_out_time) {
          clockedOut++;
          displayStatus = 'Completed';
        } else {
          currentlyActive++;
          displayStatus = 'Active';
        }
        if (r.att_status === 'LATE') {
          lateArrivals++;
        }
      } else {
        notClockedIn++;
      }

      return {
        employeeId: r.emp_id,
        employeeCode: r.emp_code,
        name: `${r.first_name} ${r.last_name}`,
        jobTitle: r.job_title,
        department: r.department_name || 'General',
        team: r.team_name || 'Unassigned',
        attendanceId: r.att_id,
        clockInTime: r.clock_in_time,
        clockOutTime: r.clock_out_time,
        duration: r.duration_formatted || '—',
        status: displayStatus,
        isLate: r.att_status === 'LATE',
        isManuallyCorrected: Boolean(r.is_manually_corrected),
        correctionReason: r.correction_reason,
        ipAddress: r.ip_address
      };
    });

    // Check for open sessions from previous days ("No clock-out recorded")
    const openPastSessions = await queryAll<{
      id: number;
      date: string;
      first_name: string;
      last_name: string;
      clock_in_time: string;
      department_name: string;
    }>(`
      SELECT 
        a.id, a.date, a.clock_in_time,
        e.first_name, e.last_name,
        d.name as department_name
      FROM attendance a
      JOIN employees e ON e.id = a.employee_id
      LEFT JOIN departments d ON d.id = e.department_id
      WHERE a.clock_out_time IS NULL AND a.date < ?
      ORDER BY a.date DESC
      LIMIT 20
    `, [today]);

    res.json({
      today,
      metrics: {
        totalEmployees,
        clockedIn,
        notClockedIn,
        clockedOut,
        currentlyActive,
        lateArrivals,
        unclosedSessionsCount: openPastSessions.length
      },
      records: list,
      openPastSessions: openPastSessions.map(s => ({
        id: s.id,
        date: s.date,
        employeeName: `${s.first_name} ${s.last_name}`,
        clockInTime: s.clock_in_time,
        department: s.department_name
      }))
    });
  } catch (err: any) {
    console.error('Live attendance error:', err);
    res.status(500).json({ error: 'Failed to retrieve live attendance dashboard.' });
  }
});

// 5. Correct Attendance / Close Open Session (Admins and HR only)
router.post('/correct', authenticateToken, requireRoles('SUPER_ADMIN', 'ADMIN'), async (req: AuthRequest, res) => {
  try {
    const { attendanceId, clockOutTime, reason } = req.body;
    if (!attendanceId || !reason) {
      return res.status(400).json({ error: 'Attendance ID and correction reason are required.' });
    }

    const existing = await queryOne<{
      id: number;
      employee_id: number;
      date: string;
      clock_in_time: string;
      clock_out_time: string | null;
      status: string;
      work_session_id: string;
      first_name: string;
      last_name: string;
    }>(`
      SELECT a.*, e.first_name, e.last_name 
      FROM attendance a
      JOIN employees e ON e.id = a.employee_id
      WHERE a.id = ?
    `, [attendanceId]);

    if (!existing) {
      return res.status(404).json({ error: 'Attendance record not found.' });
    }

    // Determine final clock-out time (if user entered e.g. "17:20", construct ISO from record date)
    let finalClockOutIso = clockOutTime;
    if (clockOutTime && !clockOutTime.includes('T')) {
      finalClockOutIso = `${existing.date}T${clockOutTime}:00Z`;
    } else if (!clockOutTime) {
      // Default to standard work end time
      finalClockOutIso = `${existing.date}T17:00:00Z`;
    }

    const duration = formatDuration(existing.clock_in_time, finalClockOutIso);
    const now = new Date().toISOString();

    await execute(`
      UPDATE attendance SET
        clock_out_time = ?,
        duration_minutes = ?,
        duration_formatted = ?,
        status = 'COMPLETED',
        is_manually_corrected = 1,
        corrected_by_user_id = ?,
        correction_reason = ?,
        corrected_at = ?,
        updated_at = ?
      WHERE id = ?
    `, [
      finalClockOutIso,
      duration.minutes,
      duration.formatted,
      req.user!.id,
      reason.trim(),
      now,
      now,
      attendanceId
    ]);

    // Close active work session
    await execute(`
      UPDATE work_sessions SET
        end_time = ?,
        status = 'CORRECTED'
      WHERE session_id = ?
    `, [finalClockOutIso, existing.work_session_id]);

    await logAudit({
      userId: req.user!.id,
      userName: req.user!.fullName || req.user!.email,
      userRole: req.user!.role,
      action: 'ATTENDANCE_CORRECTED',
      resource: 'ATTENDANCE',
      resourceId: attendanceId,
      ipAddress: req.ip,
      beforeValue: `Clock-out: ${existing.clock_out_time || 'None (Open)'}`,
      afterValue: `Clock-out set to ${finalClockOutIso}. Reason: ${reason}`
    });

    res.json({
      success: true,
      message: `Attendance corrected for ${existing.first_name} ${existing.last_name}. Duration: ${duration.formatted}.`,
      record: {
        id: attendanceId,
        clockOutTime: finalClockOutIso,
        durationFormatted: duration.formatted,
        isManuallyCorrected: true,
        reason
      }
    });
  } catch (err: any) {
    console.error('Attendance correction error:', err);
    res.status(500).json({ error: 'Failed to correct attendance record.' });
  }
});

export default router;
