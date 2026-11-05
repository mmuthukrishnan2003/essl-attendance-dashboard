import { query } from '../db/connection';

export interface DayAttendance {
  day: number;
  date: string;
  weekday: string;
  status: 'P' | 'A' | 'WFH' | 'HDL' | 'WO' | string;
  first_in: string | null;
  last_out: string | null;
  punches_count: number;
  is_late: boolean;
  late_mins: number;
  is_override: boolean;
  override_remarks: string;
}

export interface EmployeeMonthlyRecord {
  emp_code: string;
  name: string;
  department: string;
  shift: string;
  is_wfh: boolean;
  days: Record<string, DayAttendance>;
  present_count: number;
  late_count: number;
  total_late_mins: number;
  absent_count: number;
  wfh_count: number;
  hdl_count: number;
  wo_count: number;
  attendance_rate: number;
}

export async function getAllAttendanceOverrides(year?: number, month?: number): Promise<Record<string, any>> {
  try {
    const rows = await query('SELECT value FROM settings WHERE key = ?', ['attendance_overrides']);
    if (rows.length === 0 || !rows[0].value) {
      return {};
    }
    const data = JSON.parse(rows[0].value);
    if (typeof data !== 'object' || data === null) {
      return {};
    }
    if (year && month) {
      const prefix = `${year}-${String(month).padStart(2, '0')}`;
      const filtered: Record<string, any> = {};
      for (const [k, v] of Object.entries(data)) {
        if (k.includes(prefix)) {
          filtered[k] = v;
        }
      }
      return filtered;
    }
    return data;
  } catch (err) {
    console.error('Failed to read attendance overrides:', err);
    return {};
  }
}

export async function setAttendanceOverride(
  empCode: string,
  dateStr: string,
  status: string,
  remarks: string = ''
) {
  const normalizedStatus = (status || '').trim().toUpperCase();
  const key = `${empCode}_${dateStr}`;

  const rows = await query('SELECT value FROM settings WHERE key = ?', ['attendance_overrides']);
  let data: Record<string, any> = {};

  if (rows.length > 0 && rows[0].value) {
    try {
      data = JSON.parse(rows[0].value);
    } catch {
      data = {};
    }
  }

  if (['CLEAR', 'AUTO', 'RESET', ''].includes(normalizedStatus)) {
    if (key in data) {
      delete data[key];
    }
  } else {
    let finalStatus = normalizedStatus;
    if (['HALF_DAY', 'HALFDAY', 'HALF'].includes(finalStatus)) {
      finalStatus = 'HDL';
    }
    data[key] = {
      emp_code: String(empCode),
      date: dateStr,
      status: finalStatus,
      remarks: (remarks || '').trim(),
      updated_at: new Date().toISOString().replace('T', ' ').substring(0, 19),
    };
  }

  const jsonStr = JSON.stringify(data);
  if (rows.length === 0) {
    await query('INSERT INTO settings (key, value) VALUES (?, ?)', ['attendance_overrides', jsonStr]);
  } else {
    await query('UPDATE settings SET value = ? WHERE key = ?', [jsonStr, 'attendance_overrides']);
  }

  return {
    success: true,
    key,
    status: normalizedStatus,
    count: Object.keys(data).length,
    override: data[key] || null,
  };
}

export async function getMonthlyAttendanceMatrix(
  year: number,
  month: number,
  departmentFilter?: string,
  shiftFilter?: string,
  searchQuery?: string
) {
  // Days in month
  const numDays = new Date(year, month, 0).getDate();
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const monthName = `${monthNames[month - 1]} ${year}`;

  const startDt = `${year}-${String(month).padStart(2, '0')}-01 00:00:00`;
  const endDt = `${year}-${String(month).padStart(2, '0')}-${String(numDays).padStart(2, '0')} 23:59:59`;

  // Fetch all punches for the month in one query
  const punches = await query(
    'SELECT emp_code, timestamp, device_ip FROM attendance_punches WHERE timestamp >= ? AND timestamp <= ? ORDER BY timestamp ASC',
    [startDt, endDt]
  );

  // Group by emp_code -> day (1..numDays) -> array of timestamps
  const punchesByEmpDay: Record<string, Record<number, Date[]>> = {};
  for (const p of punches) {
    const dt = new Date(p.timestamp);
    const day = dt.getDate();
    if (!punchesByEmpDay[p.emp_code]) {
      punchesByEmpDay[p.emp_code] = {};
    }
    if (!punchesByEmpDay[p.emp_code][day]) {
      punchesByEmpDay[p.emp_code][day] = [];
    }
    punchesByEmpDay[p.emp_code][day].push(dt);
  }

  // Employees query
  let sql = 'SELECT * FROM employees WHERE is_active = 1 OR is_active = true';
  const params: any[] = [];

  if (departmentFilter && departmentFilter !== 'ALL') {
    sql += ' AND department = ?';
    params.push(departmentFilter);
  }

  if (shiftFilter && shiftFilter !== 'ALL') {
    sql += ' AND (shift_code = ? OR shift_name = ?)';
    params.push(shiftFilter, shiftFilter);
  }

  if (searchQuery && searchQuery.trim()) {
    const term = `%${searchQuery.trim().toLowerCase()}%`;
    sql += ' AND (LOWER(name) LIKE ? OR LOWER(emp_code) LIKE ?)';
    params.push(term, term);
  }

  sql += ' ORDER BY LOWER(name) ASC, emp_code ASC';
  const employees = await query(sql, params);

  // Fetch manual overrides
  const overrides = await getAllAttendanceOverrides(year, month);

  // Build days_meta
  const daysMeta: any[] = [];
  let workingDaysCount = 0;
  const today = new Date();
  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  for (let d = 1; d <= numDays; d++) {
    const curDate = new Date(year, month - 1, d);
    const dayOfWeek = curDate.getDay();
    // Saturday (6) and Sunday (0) are Week Offs
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    if (!isWeekend) {
      workingDaysCount++;
    }
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const isPastOrToday = curDate <= today;

    daysMeta.push({
      day: d,
      weekday: weekdays[dayOfWeek],
      is_weekend: isWeekend,
      date: dateStr,
      is_past_or_today: isPastOrToday,
    });
  }

  const records: EmployeeMonthlyRecord[] = [];
  let totalPresentOverall = 0;
  let totalAbsentOverall = 0;
  let totalWfhOverall = 0;
  let totalHdlOverall = 0;

  for (const emp of employees) {
    const isWfhEmp =
      (emp.shift_code && emp.shift_code.toUpperCase().includes('WFH')) ||
      (emp.shift_name && emp.shift_name.toUpperCase().includes('WFH'));

    const empDays: Record<string, DayAttendance> = {};
    let presCnt = 0;
    let absCnt = 0;
    let wfhCnt = 0;
    let hdlCnt = 0;
    let woCnt = 0;

    for (let d = 1; d <= numDays; d++) {
      const curDate = new Date(year, month - 1, d);
      const dayOfWeek = curDate.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

      const punchList = (punchesByEmpDay[emp.emp_code] && punchesByEmpDay[emp.emp_code][d]) || [];

      // Check manual override
      const overrideKey = `${emp.emp_code}_${dateStr}`;
      const override = overrides[overrideKey];
      const isOverride = Boolean(override);
      const overrideRemarks = override ? override.remarks || '' : '';

      let status = 'A';
      let firstIn: string | null = null;
      let lastOut: string | null = null;
      let dayIsLate = false;
      let dayLateMins = 0;

      if (override) {
        const st = override.status;
        firstIn = punchList.length > 0 ? punchList[0].toTimeString().split(' ')[0] : null;
        lastOut = punchList.length > 1 ? punchList[punchList.length - 1].toTimeString().split(' ')[0] : firstIn;

        if (st === 'WFH') {
          wfhCnt++;
          status = 'WFH';
        } else if (st === 'A') {
          absCnt++;
          status = 'A';
        } else if (st === 'HDL' || st === 'HALF_DAY') {
          hdlCnt++;
          status = 'HDL';
        } else if (st === 'P') {
          presCnt++;
          status = 'P';
        } else if (st === 'WO') {
          woCnt++;
          status = 'WO';
        } else {
          status = st;
        }
      } else if (isWeekend) {
        woCnt++;
        status = 'WO';
        firstIn = punchList.length > 0 ? punchList[0].toTimeString().split(' ')[0] : null;
        lastOut = punchList.length > 1 ? punchList[punchList.length - 1].toTimeString().split(' ')[0] : firstIn;
      } else if (punchList.length > 0) {
        presCnt++;
        status = 'P';
        const firstInDate = punchList[0];
        firstIn = firstInDate.toTimeString().split(' ')[0];
        lastOut = punchList.length > 1 ? punchList[punchList.length - 1].toTimeString().split(' ')[0] : firstIn;

        // Check late arrival (> 09:05:00)
        const nameUp = (emp.name || '').toUpperCase();
        const codeUp = String(emp.emp_code || '').toUpperCase();
        const sStr = `${(emp.shift_code || '').toUpperCase()} ${(emp.shift_name || '').toUpperCase()}`;
        const isExempt =
          sStr.includes('CLEAN') ||
          nameUp.includes('CLEAN') ||
          codeUp.includes('CLEAN') ||
          nameUp.includes('VISIT') ||
          codeUp.includes('VISIT') ||
          nameUp === 'ADMINISTER' ||
          nameUp === 'ADMIN' ||
          codeUp === '1' ||
          codeUp === 'OA';

        if (!isExempt) {
          const hours = firstInDate.getHours();
          const minutes = firstInDate.getMinutes();
          const seconds = firstInDate.getSeconds();
          if (hours > 9 || (hours === 9 && (minutes > 5 || (minutes === 5 && seconds > 0)))) {
            dayIsLate = true;
            dayLateMins = Math.floor((hours * 3600 + minutes * 60 + seconds - (9 * 3600 + 5 * 60)) / 60);
          }
        }
      } else if (isWfhEmp) {
        wfhCnt++;
        status = 'WFH';
      } else {
        absCnt++;
        status = 'A';
      }

      empDays[String(d)] = {
        day: d,
        date: dateStr,
        weekday: weekdays[dayOfWeek],
        status,
        first_in: firstIn,
        last_out: lastOut,
        punches_count: punchList.length,
        is_late: dayIsLate,
        late_mins: dayLateMins,
        is_override: isOverride,
        override_remarks: overrideRemarks,
      };
    }

    totalPresentOverall += presCnt;
    totalAbsentOverall += absCnt;
    totalWfhOverall += wfhCnt;
    totalHdlOverall += hdlCnt;

    const totalWorkDays = presCnt + absCnt + wfhCnt + hdlCnt;
    const effectivePres = presCnt + wfhCnt + 0.5 * hdlCnt;
    const attendanceRate = totalWorkDays > 0 ? Math.round((effectivePres / totalWorkDays) * 1000) / 10 : 0.0;

    const lateCount = Object.values(empDays).filter((d) => d.is_late).length;
    const totalLateMins = Object.values(empDays).reduce((acc, d) => acc + (d.late_mins || 0), 0);

    records.push({
      emp_code: emp.emp_code,
      name: emp.name,
      department: emp.department || 'General',
      shift: emp.shift_name || emp.shift_code || 'Standard Shift',
      is_wfh: isWfhEmp,
      days: empDays,
      present_count: presCnt,
      late_count: lateCount,
      total_late_mins: totalLateMins,
      absent_count: absCnt,
      wfh_count: wfhCnt,
      hdl_count: hdlCnt,
      wo_count: woCnt,
      attendance_rate: attendanceRate,
    });
  }

  const allWorkDays = totalPresentOverall + totalAbsentOverall + totalWfhOverall + totalHdlOverall;
  const allEffective = totalPresentOverall + totalWfhOverall + 0.5 * totalHdlOverall;
  const overallRate = allWorkDays > 0 ? Math.round((allEffective / allWorkDays) * 1000) / 10 : 0.0;

  return {
    year,
    month,
    month_name: monthName,
    num_days: numDays,
    working_days: workingDaysCount,
    days_meta: daysMeta,
    total_employees: employees.length,
    summary: {
      total_present_days: totalPresentOverall,
      total_late_days: records.reduce((acc, r) => acc + r.late_count, 0),
      total_late_staff: records.filter((r) => r.late_count > 0).length,
      total_absent_days: totalAbsentOverall,
      total_wfh_days: totalWfhOverall,
      total_hdl_days: totalHdlOverall,
      overall_rate: overallRate,
    },
    records,
  };
}

