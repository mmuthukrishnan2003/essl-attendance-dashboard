import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import {
  getDailyAttendance,
  getRangeAttendance,
  getEmployeePunches,
} from '../services/attendanceService';
import {
  getMonthlyAttendanceMatrix,
  getAllAttendanceOverrides,
  setAttendanceOverride,
} from '../services/monthlyService';
import { generateMonthlyExcel, generateDateRangeExcel } from '../services/excelService';
import { addSseClient, getLiveStatus } from '../services/liveSyncService';

const router = Router();

// GET /api/attendance/summary
router.get('/summary', async (req: Request, res: Response) => {
  try {
    const dateStr = (req.query.date as string) || new Date().toISOString().split('T')[0];
    const data = await getDailyAttendance(dateStr);
    return res.json({
      date: data.date,
      total_employees: data.total_employees,
      present_today: data.present_today,
      absent_today: data.absent_today,
      late_today: data.late_today,
      wfh_today: data.wfh_today,
      punched_in_count: data.punched_in_count,
      punched_out_count: data.punched_out_count,
      attendance_rate: data.attendance_rate,
    });
  } catch (err: any) {
    console.error('Summary error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/attendance/daily
router.get('/daily', async (req: Request, res: Response) => {
  try {
    const startDate = (req.query.start_date as string) || (req.query.from_date as string);
    const endDate = (req.query.end_date as string) || (req.query.to_date as string);
    const date = (req.query.date as string) || (req.query.target_date as string) || new Date().toISOString().split('T')[0];
    const department = (req.query.department as string) || 'ALL';
    const shift = (req.query.shift as string) || 'ALL';
    const search = (req.query.search as string) || '';

    if (startDate && endDate) {
      const data = await getRangeAttendance(startDate, endDate, department, shift, search);
      return res.json(data);
    }

    const data = await getDailyAttendance(date, department, shift, search);
    return res.json(data);
  } catch (err: any) {
    console.error('Daily attendance error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/attendance/monthly
router.get('/monthly', async (req: Request, res: Response) => {
  try {
    const now = new Date();
    const year = parseInt((req.query.year as string) || String(now.getFullYear()), 10);
    const month = parseInt((req.query.month as string) || String(now.getMonth() + 1), 10);
    const department = (req.query.department as string) || 'ALL';
    const shift = (req.query.shift as string) || 'ALL';
    const search = (req.query.search as string) || '';

    const data = await getMonthlyAttendanceMatrix(year, month, department, shift, search);
    return res.json(data);
  } catch (err: any) {
    console.error('Monthly attendance error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/attendance/employee-punches
router.get('/employee-punches', async (req: Request, res: Response) => {
  try {
    const empCode = req.query.emp_code as string;
    const date = (req.query.date as string) || new Date().toISOString().split('T')[0];

    if (!empCode) {
      return res.status(400).json({ error: 'emp_code is required' });
    }

    const data = await getEmployeePunches(empCode, date);
    return res.json(data);
  } catch (err: any) {
    console.error('Employee punches error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/attendance/overrides
router.get('/overrides', async (req: Request, res: Response) => {
  try {
    const year = req.query.year ? parseInt(req.query.year as string, 10) : undefined;
    const month = req.query.month ? parseInt(req.query.month as string, 10) : undefined;
    const data = await getAllAttendanceOverrides(year, month);
    return res.json(data);
  } catch (err: any) {
    console.error('Overrides error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/attendance/override
router.post('/override', async (req: Request, res: Response) => {
  try {
    const { emp_code, date, status, remarks = '' } = req.body;

    if (!emp_code || !date) {
      return res.status(400).json({ error: 'emp_code and date are required' });
    }

    const result = await setAttendanceOverride(emp_code, date, status, remarks);
    return res.json(result);
  } catch (err: any) {
    console.error('Set override error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/attendance/live-stream (SSE)
router.get('/live-stream', (req: Request, res: Response) => {
  const clientId = crypto.randomBytes(8).toString('hex');
  addSseClient(clientId, res);
});

// GET /api/attendance/live-status
router.get('/live-status', (req: Request, res: Response) => {
  return res.json(getLiveStatus());
});

// GET /api/attendance/export/excel
router.get(['/export/excel', '/export/monthly-excel'], async (req: Request, res: Response) => {
  try {
    const startDate = (req.query.start_date as string) || (req.query.from_date as string);
    const endDate = (req.query.end_date as string) || (req.query.to_date as string);
    const department = (req.query.department as string) || 'ALL';
    const shift = (req.query.shift as string) || 'ALL';
    const search = (req.query.search as string) || '';

    let buffer: Buffer;
    let filename: string;

    if (startDate && endDate) {
      buffer = await generateDateRangeExcel(startDate, endDate, department, shift, search);
      filename = `Centizen_Attendance_${startDate.replace(/-/g, '')}_to_${endDate.replace(/-/g, '')}.xlsx`;
    } else {
      const now = new Date();
      const year = parseInt((req.query.year as string) || String(now.getFullYear()), 10);
      const month = parseInt((req.query.month as string) || String(now.getMonth() + 1), 10);
      buffer = await generateMonthlyExcel(year, month, department, shift, search);
      filename = `Centizen_Monthly_Muster_${year}_${String(month).padStart(2, '0')}.xlsx`;
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(buffer);
  } catch (err: any) {
    console.error('Excel export error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/attendance/export/csv
router.get(['/export/csv', '/export/monthly-csv'], async (req: Request, res: Response) => {
  try {
    const startDate = (req.query.start_date as string) || (req.query.from_date as string);
    const endDate = (req.query.end_date as string) || (req.query.to_date as string);
    const department = (req.query.department as string) || 'ALL';
    const shift = (req.query.shift as string) || 'ALL';
    const search = (req.query.search as string) || '';

    if (startDate && endDate) {
      const rangeData = await getRangeAttendance(startDate, endDate, department, shift, search);
      const header = ['Date', 'Emp ID', 'Employee Name', 'Shift', 'First IN', 'Last OUT', 'Intermediate Punches', 'Work Duration', 'Status'];
      const lines = [header.join(',')];

      for (const rec of rangeData.records) {
        const inStr = rec.first_in_time !== '--' ? `"${rec.first_in_time} (${rec.first_in_device})"` : '"--"';
        const outStr = rec.last_out_time !== '--' ? `"${rec.last_out_time} (${rec.last_out_device})"` : '"--"';
        const row = [
          `"${rec.date}"`,
          `"${rec.emp_code}"`,
          `"${(rec.name || '').replace(/"/g, '""')}"`,
          `"${(rec.shift_name || '').replace(/"/g, '""')}"`,
          inStr,
          outStr,
          String(rec.intermediate_count),
          `"${rec.duration}"`,
          `"${rec.status}"`,
        ];
        lines.push(row.join(','));
      }

      const csvContent = lines.join('\n');
      const filename = `Centizen_Attendance_${startDate.replace(/-/g, '')}_to_${endDate.replace(/-/g, '')}.csv`;
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.send(csvContent);
    }

    const now = new Date();
    const year = parseInt((req.query.year as string) || String(now.getFullYear()), 10);
    const month = parseInt((req.query.month as string) || String(now.getMonth() + 1), 10);

    const data = await getMonthlyAttendanceMatrix(year, month, department, shift, search);

    const header = ['Emp ID', 'Name', 'Department', 'Shift'];
    for (const d of data.days_meta) {
      header.push(`Day ${d.day} (${d.weekday})`);
    }
    header.push('Present', 'Absent', 'WFH', 'Half Day', 'Week Off', 'Attendance Rate');

    const lines = [header.join(',')];

    for (const rec of data.records) {
      const row = [
        `"${rec.emp_code}"`,
        `"${rec.name.replace(/"/g, '""')}"`,
        `"${rec.department.replace(/"/g, '""')}"`,
        `"${rec.shift.replace(/"/g, '""')}"`,
      ];
      for (let d = 1; d <= data.num_days; d++) {
        const day = rec.days[String(d)];
        row.push(`"${day ? day.status : 'A'}"`);
      }
      row.push(
        String(rec.present_count),
        String(rec.absent_count),
        String(rec.wfh_count),
        String(rec.hdl_count),
        String(rec.wo_count),
        `"${rec.attendance_rate}%"`
      );
      lines.push(row.join(','));
    }

    const csvContent = lines.join('\n');
    const filename = `Centizen_Attendance_${year}_${String(month).padStart(2, '0')}.csv`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(csvContent);
  } catch (err: any) {
    console.error('CSV export error:', err);
    return res.status(500).json({ error: err.message });
  }
});

export default router;
