"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const crypto_1 = __importDefault(require("crypto"));
const attendanceService_1 = require("../services/attendanceService");
const monthlyService_1 = require("../services/monthlyService");
const excelService_1 = require("../services/excelService");
const liveSyncService_1 = require("../services/liveSyncService");
const router = (0, express_1.Router)();
// GET /api/attendance/summary
router.get('/summary', async (req, res) => {
    try {
        const dateStr = req.query.date || new Date().toISOString().split('T')[0];
        const data = await (0, attendanceService_1.getDailyAttendance)(dateStr);
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
    }
    catch (err) {
        console.error('Summary error:', err);
        return res.status(500).json({ error: err.message });
    }
});
// GET /api/attendance/daily
router.get('/daily', async (req, res) => {
    try {
        const startDate = req.query.start_date || req.query.from_date;
        const endDate = req.query.end_date || req.query.to_date;
        const date = req.query.date || req.query.target_date || new Date().toISOString().split('T')[0];
        const department = req.query.department || 'ALL';
        const shift = req.query.shift || 'ALL';
        const search = req.query.search || '';
        if (startDate && endDate) {
            const data = await (0, attendanceService_1.getRangeAttendance)(startDate, endDate, department, shift, search);
            return res.json(data);
        }
        const data = await (0, attendanceService_1.getDailyAttendance)(date, department, shift, search);
        return res.json(data);
    }
    catch (err) {
        console.error('Daily attendance error:', err);
        return res.status(500).json({ error: err.message });
    }
});
// GET /api/attendance/monthly
router.get('/monthly', async (req, res) => {
    try {
        const now = new Date();
        const year = parseInt(req.query.year || String(now.getFullYear()), 10);
        const month = parseInt(req.query.month || String(now.getMonth() + 1), 10);
        const department = req.query.department || 'ALL';
        const shift = req.query.shift || 'ALL';
        const search = req.query.search || '';
        const data = await (0, monthlyService_1.getMonthlyAttendanceMatrix)(year, month, department, shift, search);
        return res.json(data);
    }
    catch (err) {
        console.error('Monthly attendance error:', err);
        return res.status(500).json({ error: err.message });
    }
});
// GET /api/attendance/employee-punches
router.get('/employee-punches', async (req, res) => {
    try {
        const empCode = req.query.emp_code;
        const date = req.query.date || new Date().toISOString().split('T')[0];
        if (!empCode) {
            return res.status(400).json({ error: 'emp_code is required' });
        }
        const data = await (0, attendanceService_1.getEmployeePunches)(empCode, date);
        return res.json(data);
    }
    catch (err) {
        console.error('Employee punches error:', err);
        return res.status(500).json({ error: err.message });
    }
});
// GET /api/attendance/overrides
router.get('/overrides', async (req, res) => {
    try {
        const year = req.query.year ? parseInt(req.query.year, 10) : undefined;
        const month = req.query.month ? parseInt(req.query.month, 10) : undefined;
        const data = await (0, monthlyService_1.getAllAttendanceOverrides)(year, month);
        return res.json(data);
    }
    catch (err) {
        console.error('Overrides error:', err);
        return res.status(500).json({ error: err.message });
    }
});
// POST /api/attendance/override
router.post('/override', async (req, res) => {
    try {
        const { emp_code, date, status, remarks = '' } = req.body;
        if (!emp_code || !date) {
            return res.status(400).json({ error: 'emp_code and date are required' });
        }
        const result = await (0, monthlyService_1.setAttendanceOverride)(emp_code, date, status, remarks);
        return res.json(result);
    }
    catch (err) {
        console.error('Set override error:', err);
        return res.status(500).json({ error: err.message });
    }
});
// GET /api/attendance/live-stream (SSE)
router.get('/live-stream', (req, res) => {
    const clientId = crypto_1.default.randomBytes(8).toString('hex');
    (0, liveSyncService_1.addSseClient)(clientId, res);
});
// GET /api/attendance/live-status
router.get('/live-status', (req, res) => {
    return res.json((0, liveSyncService_1.getLiveStatus)());
});
// GET /api/attendance/export/excel
router.get(['/export/excel', '/export/monthly-excel'], async (req, res) => {
    try {
        const startDate = req.query.start_date || req.query.from_date;
        const endDate = req.query.end_date || req.query.to_date;
        const department = req.query.department || 'ALL';
        const shift = req.query.shift || 'ALL';
        const search = req.query.search || '';
        let buffer;
        let filename;
        if (startDate && endDate) {
            buffer = await (0, excelService_1.generateDateRangeExcel)(startDate, endDate, department, shift, search);
            filename = `Centizen_Attendance_${startDate.replace(/-/g, '')}_to_${endDate.replace(/-/g, '')}.xlsx`;
        }
        else {
            const now = new Date();
            const year = parseInt(req.query.year || String(now.getFullYear()), 10);
            const month = parseInt(req.query.month || String(now.getMonth() + 1), 10);
            buffer = await (0, excelService_1.generateMonthlyExcel)(year, month, department, shift, search);
            filename = `Centizen_Monthly_Muster_${year}_${String(month).padStart(2, '0')}.xlsx`;
        }
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        return res.send(buffer);
    }
    catch (err) {
        console.error('Excel export error:', err);
        return res.status(500).json({ error: err.message });
    }
});
// GET /api/attendance/export/csv
router.get(['/export/csv', '/export/monthly-csv'], async (req, res) => {
    try {
        const startDate = req.query.start_date || req.query.from_date;
        const endDate = req.query.end_date || req.query.to_date;
        const department = req.query.department || 'ALL';
        const shift = req.query.shift || 'ALL';
        const search = req.query.search || '';
        if (startDate && endDate) {
            const rangeData = await (0, attendanceService_1.getRangeAttendance)(startDate, endDate, department, shift, search);
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
        const year = parseInt(req.query.year || String(now.getFullYear()), 10);
        const month = parseInt(req.query.month || String(now.getMonth() + 1), 10);
        const data = await (0, monthlyService_1.getMonthlyAttendanceMatrix)(year, month, department, shift, search);
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
            row.push(String(rec.present_count), String(rec.absent_count), String(rec.wfh_count), String(rec.hdl_count), String(rec.wo_count), `"${rec.attendance_rate}%"`);
            lines.push(row.join(','));
        }
        const csvContent = lines.join('\n');
        const filename = `Centizen_Attendance_${year}_${String(month).padStart(2, '0')}.csv`;
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        return res.send(csvContent);
    }
    catch (err) {
        console.error('CSV export error:', err);
        return res.status(500).json({ error: err.message });
    }
});
exports.default = router;
