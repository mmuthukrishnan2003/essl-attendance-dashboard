"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatDuration = formatDuration;
exports.formatOtDuration = formatOtDuration;
exports.processPunchesSequence = processPunchesSequence;
exports.getDailyAttendance = getDailyAttendance;
exports.getEmployeePunches = getEmployeePunches;
exports.getRangeAttendance = getRangeAttendance;
const connection_1 = require("../db/connection");
function formatDuration(seconds) {
    if (seconds <= 0) {
        return { text: '0h 00m', hours: 0.0, total_seconds: 0 };
    }
    const totalSeconds = Math.floor(seconds);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const decimalHours = Math.round((seconds / 3600.0) * 100) / 100;
    return {
        text: `${hours}h ${String(minutes).padStart(2, '0')}m`,
        hours: decimalHours,
        total_seconds: totalSeconds,
    };
}
function formatOtDuration(seconds) {
    if (!seconds || seconds < 60)
        return '--';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) {
        return `${h}h ${String(m).padStart(2, '0')}m`;
    }
    return `${m}m`;
}
function processPunchesSequence(rawPunches, devicesMap, isToday = false) {
    if (!rawPunches || rawPunches.length === 0) {
        return {
            total_punches: 0,
            first_in: null,
            first_in_time: '--',
            first_in_device: '--',
            last_out: null,
            last_out_time: '--',
            last_out_device: '--',
            is_in_office: false,
            intermediate_punches: [],
            intermediate_count: 0,
            duration: { text: '0h 00m', hours: 0.0, total_seconds: 0 },
            total_seconds_worked: 0,
            items: [],
        };
    }
    // Deduplicate rapid taps (< 5s on same device)
    const validPunches = [];
    for (const p of rawPunches) {
        const pDate = new Date(p.timestamp);
        if (validPunches.length === 0) {
            validPunches.push({ ...p, dateObj: pDate });
        }
        else {
            const prev = validPunches[validPunches.length - 1];
            const diffSec = (pDate.getTime() - prev.dateObj.getTime()) / 1000;
            const sameDev = p.device_ip === prev.device_ip;
            if (!(sameDev && diffSec < 5)) {
                validPunches.push({ ...p, dateObj: pDate });
            }
        }
    }
    const total = validPunches.length;
    const items = [];
    for (let idx = 0; idx < total; idx++) {
        const p = validPunches[idx];
        const devName = devicesMap[p.device_ip] || p.device_ip;
        const timeStr = p.dateObj.toTimeString().split(' ')[0];
        const tsStr = p.dateObj.toISOString().replace('T', ' ').substring(0, 19);
        let role;
        let label;
        let punchType;
        if (idx === 0) {
            role = 'FIRST_IN';
            punchType = 'IN';
            label = 'First IN (Punch #1)';
        }
        else if (idx === total - 1 && total > 1) {
            role = 'LAST_OUT';
            punchType = 'OUT';
            label = `Last OUT (Punch #${idx + 1})`;
        }
        else {
            role = 'INTERMEDIATE';
            punchType = idx % 2 === 1 ? 'OUT' : 'IN';
            label = `Punch #${idx + 1}`;
        }
        items.push({
            id: p.id || idx + 1,
            punch_number: idx + 1,
            role,
            label,
            timestamp: tsStr,
            time: timeStr,
            device_ip: p.device_ip,
            device_name: devName,
            punch_type: punchType,
            verify_type: p.verify_type || 1,
        });
    }
    const firstP = validPunches[0];
    const firstInTime = firstP.dateObj.toTimeString().split(' ')[0];
    const firstInDevice = devicesMap[firstP.device_ip] || firstP.device_ip;
    let lastOutTime = '--';
    let lastOutDevice = '--';
    let lastOutDt = null;
    let isInOffice = false;
    if (total >= 2) {
        const lastP = validPunches[total - 1];
        lastOutTime = lastP.dateObj.toTimeString().split(' ')[0];
        lastOutDevice = devicesMap[lastP.device_ip] || lastP.device_ip;
        lastOutDt = lastP.dateObj.toISOString().replace('T', ' ').substring(0, 19);
        isInOffice = false;
    }
    else {
        isInOffice = isToday;
    }
    const intermediate = total > 2 ? items.slice(1, -1) : [];
    let totalSecondsWorked = 0;
    if (total >= 2) {
        for (let k = 0; k < total - 1; k += 2) {
            const inT = validPunches[k].dateObj.getTime();
            const outT = validPunches[k + 1].dateObj.getTime();
            totalSecondsWorked += Math.max(0, (outT - inT) / 1000);
        }
        if (total % 2 !== 0) {
            const inT = validPunches[total - 2].dateObj.getTime();
            const outT = validPunches[total - 1].dateObj.getTime();
            totalSecondsWorked += Math.max(0, (outT - inT) / 1000);
        }
    }
    else if (isToday) {
        const now = Date.now();
        const inT = validPunches[0].dateObj.getTime();
        if (now > inT) {
            totalSecondsWorked = Math.max(0, (now - inT) / 1000);
        }
    }
    const duration = formatDuration(totalSecondsWorked);
    return {
        total_punches: total,
        first_in: firstP.dateObj.toISOString().replace('T', ' ').substring(0, 19),
        first_in_time: firstInTime,
        first_in_device: firstInDevice,
        last_out: lastOutDt,
        last_out_time: lastOutTime,
        last_out_device: lastOutDevice,
        is_in_office: isInOffice,
        intermediate_punches: intermediate,
        intermediate_count: intermediate.length,
        duration,
        total_seconds_worked: totalSecondsWorked,
        items,
    };
}
async function getDailyAttendance(targetDateStr, departmentFilter, shiftFilter, searchQuery) {
    const targetDate = targetDateStr || new Date().toISOString().split('T')[0];
    const isToday = targetDate === new Date().toISOString().split('T')[0];
    // Fetch all devices
    const devices = await (0, connection_1.query)('SELECT * FROM devices');
    const devicesMap = {};
    for (const d of devices) {
        devicesMap[d.ip_address] = d.device_name;
    }
    // Fetch all shifts
    const shifts = await (0, connection_1.query)('SELECT * FROM shifts');
    const shiftsMap = {};
    for (const s of shifts) {
        shiftsMap[s.code] = s;
    }
    // Build employee query
    let sql = 'SELECT * FROM employees WHERE is_active = 1 OR is_active = true';
    const params = [];
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
    const employees = await (0, connection_1.query)(sql, params);
    // Fetch all punches for the target window in one go
    // Night shifts can cross to next day morning, so window is targetDate 05:00:00 to nextDay 08:30:00
    const nextDateObj = new Date(targetDate + 'T00:00:00');
    nextDateObj.setDate(nextDateObj.getDate() + 1);
    const nextDateStr = nextDateObj.toISOString().split('T')[0];
    const windowStart = `${targetDate} 05:00:00`;
    const windowEnd = `${nextDateStr} 08:30:00`;
    const allPunches = await (0, connection_1.query)('SELECT * FROM attendance_punches WHERE timestamp >= ? AND timestamp <= ? ORDER BY timestamp ASC', [windowStart, windowEnd]);
    const punchesByEmp = {};
    for (const p of allPunches) {
        if (!punchesByEmp[p.emp_code]) {
            punchesByEmp[p.emp_code] = [];
        }
        punchesByEmp[p.emp_code].push(p);
    }
    const records = [];
    let totalPunchedIn = 0;
    let totalPunchedOut = 0;
    let totalLateCount = 0;
    let totalWfhCount = 0;
    let totalPresentCount = 0;
    let totalAbsentCount = 0;
    for (const emp of employees) {
        const shiftObj = shiftsMap[emp.shift_code];
        const isWfh = emp.shift_code === 'SHIFT_WFH' ||
            (emp.shift_code || '').toUpperCase().includes('WFH') ||
            (emp.shift_name || '').toUpperCase().includes('WFH');
        let isNight = false;
        if (!isWfh) {
            isNight = shiftObj
                ? Boolean(shiftObj.is_night_shift)
                : (emp.shift_code || '').toUpperCase().includes('NIGHT') ||
                    (emp.shift_start && emp.shift_start >= '20:00');
        }
        // Filter punches strictly for this employee's shift window
        const empRaw = punchesByEmp[emp.emp_code] || [];
        let shiftPunches = [];
        if (isNight) {
            const nightStart = `${targetDate} 19:30:00`;
            const nightEnd = `${nextDateStr} 08:30:00`;
            shiftPunches = empRaw.filter((p) => {
                const ts = typeof p.timestamp === 'string' ? p.timestamp : p.timestamp.toISOString().replace('T', ' ');
                return ts >= nightStart && ts <= nightEnd;
            });
        }
        else {
            const dayStart = `${targetDate} 05:00:00`;
            const dayEnd = `${targetDate} 23:59:59`;
            shiftPunches = empRaw.filter((p) => {
                const ts = typeof p.timestamp === 'string' ? p.timestamp : p.timestamp.toISOString().replace('T', ' ');
                return ts >= dayStart && ts <= dayEnd;
            });
        }
        const processed = processPunchesSequence(shiftPunches, devicesMap, isToday);
        let isPresent = false;
        let isLate = false;
        let lateMinutes = 0;
        let firstInTime = processed.first_in_time;
        let firstInDevice = processed.first_in_device;
        let lastOutTime = processed.last_out_time;
        let lastOutDevice = processed.last_out_device;
        let duration = processed.duration;
        if (isWfh) {
            totalWfhCount++;
            isPresent = true;
            if (processed.total_punches > 0) {
                totalPunchedIn++;
                if (!processed.is_in_office)
                    totalPunchedOut++;
            }
            else {
                firstInTime = '🏠 WFH';
                firstInDevice = 'Remote Work';
                lastOutTime = '🏠 WFH';
                lastOutDevice = 'Remote Work';
                duration = { text: '9h 00m', hours: 9.0, total_seconds: 32400 };
            }
        }
        else {
            if (processed.total_punches > 0) {
                totalPunchedIn++;
                isPresent = true;
                if (!processed.is_in_office) {
                    totalPunchedOut++;
                }
            }
        }
        // Late arrival cutoff detection
        const nameUp = (emp.name || '').toUpperCase();
        const codeUp = String(emp.emp_code || '').toUpperCase();
        const sCode = (emp.shift_code || '').toUpperCase();
        const sName = (emp.shift_name || '').toUpperCase();
        const sStr = `${sCode} ${sName}`;
        const isExempt = isWfh ||
            nameUp.includes('VISIT') ||
            codeUp.includes('VISIT') ||
            nameUp === 'ADMINISTER' ||
            nameUp === 'ADMIN' ||
            codeUp === '1' ||
            codeUp === 'OA' ||
            sStr.includes('CLEAN');
        let officeStartStr = '09:00:00';
        let lateGraceStr = '09:05:00';
        let officeEndStr = '19:00:00';
        if (isNight) {
            officeStartStr = '21:00:00';
            lateGraceStr = '21:05:00';
            officeEndStr = '06:00:00';
        }
        else if (sStr.includes('9_6') || sStr.includes('18:00') || sStr.includes('STANDARD')) {
            officeStartStr = '09:00:00';
            lateGraceStr = '09:05:00';
            officeEndStr = '18:00:00';
        }
        else if (sStr.includes('9_7') || sStr.includes('19:00') || sStr.includes('GENERAL')) {
            officeStartStr = '09:00:00';
            lateGraceStr = '09:05:00';
            officeEndStr = '19:00:00';
        }
        if (isPresent && !isExempt && processed.first_in_time !== '--' && !isWfh) {
            if (processed.first_in_time > lateGraceStr) {
                isLate = true;
                totalLateCount++;
                // Calculate late minutes
                const [ah, am, as] = processed.first_in_time.split(':').map(Number);
                const [gh, gm, gs] = lateGraceStr.split(':').map(Number);
                const arrivalSec = ah * 3600 + am * 60 + (as || 0);
                const graceSec = gh * 3600 + gm * 60 + (gs || 0);
                lateMinutes = Math.floor((arrivalSec - graceSec) / 60);
            }
        }
        if (isPresent) {
            totalPresentCount++;
        }
        else {
            totalAbsentCount++;
        }
        // Overtime Calculation
        let morningOtSec = 0;
        let eveningOtSec = 0;
        if (processed.first_in_time !== '--' && !isWfh && !isNight) {
            if (processed.first_in_time < officeStartStr) {
                const [ah, am, as] = processed.first_in_time.split(':').map(Number);
                const [sh, sm, ss] = officeStartStr.split(':').map(Number);
                const arrivalSec = ah * 3600 + am * 60 + (as || 0);
                const startSec = sh * 3600 + sm * 60 + (ss || 0);
                if (startSec > arrivalSec) {
                    morningOtSec = startSec - arrivalSec;
                }
            }
        }
        if (processed.last_out_time !== '--' && !isWfh && !isNight) {
            if (processed.last_out_time > officeEndStr) {
                const [oh, om, os] = processed.last_out_time.split(':').map(Number);
                const [eh, em, es] = officeEndStr.split(':').map(Number);
                const outSec = oh * 3600 + om * 60 + (os || 0);
                const endSec = eh * 3600 + em * 60 + (es || 0);
                if (outSec > endSec) {
                    eveningOtSec = outSec - endSec;
                }
            }
        }
        const totalOtSec = morningOtSec + eveningOtSec;
        records.push({
            id: emp.id,
            emp_code: emp.emp_code,
            name: emp.name,
            department: emp.department || 'General',
            designation: emp.designation || 'Staff',
            shift_code: emp.shift_code || 'SHIFT_9_6',
            shift_name: emp.shift_name || 'Standard Shift (09:00 AM - 06:00 PM)',
            is_wfh: isWfh,
            is_present: isPresent,
            is_late: isLate,
            late_minutes: lateMinutes,
            status: isWfh ? 'WFH' : isPresent ? (isLate ? 'Late' : 'Present') : 'Absent',
            first_in: processed.first_in,
            first_in_time: firstInTime,
            first_in_device: firstInDevice,
            last_out: processed.last_out,
            last_out_time: lastOutTime,
            last_out_device: lastOutDevice,
            total_punches: processed.total_punches,
            duration: duration.text,
            duration_hours: duration.hours,
            total_seconds_worked: processed.total_seconds_worked,
            is_in_office: processed.is_in_office,
            intermediate_punches: processed.intermediate_punches,
            intermediate_count: processed.intermediate_count,
            morning_ot: formatOtDuration(morningOtSec),
            evening_ot: formatOtDuration(eveningOtSec),
            total_ot: formatOtDuration(totalOtSec),
            total_ot_seconds: totalOtSec,
        });
    }
    return {
        date: targetDate,
        is_today: isToday,
        total_employees: employees.length,
        present_today: totalPresentCount,
        absent_today: totalAbsentCount,
        late_today: totalLateCount,
        wfh_today: totalWfhCount,
        punched_in_count: totalPunchedIn,
        punched_out_count: totalPunchedOut,
        attendance_rate: employees.length > 0 ? Math.round((totalPresentCount / employees.length) * 1000) / 10 : 0,
        records,
    };
}
async function getEmployeePunches(empCode, dateStr) {
    const windowStart = `${dateStr} 00:00:00`;
    const windowEnd = `${dateStr} 23:59:59`;
    const devices = await (0, connection_1.query)('SELECT * FROM devices');
    const devicesMap = {};
    for (const d of devices) {
        devicesMap[d.ip_address] = d.device_name;
    }
    const punches = await (0, connection_1.query)('SELECT * FROM attendance_punches WHERE emp_code = ? AND timestamp >= ? AND timestamp <= ? ORDER BY timestamp ASC', [empCode, windowStart, windowEnd]);
    return processPunchesSequence(punches, devicesMap, dateStr === new Date().toISOString().split('T')[0]);
}
async function getRangeAttendance(startDateStr, endDateStr, departmentFilter, shiftFilter, searchQuery) {
    const start = new Date(startDateStr);
    const end = new Date(endDateStr);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) {
        throw new Error('Invalid start_date or end_date range');
    }
    const allRecords = [];
    let totalPunchedIn = 0;
    let totalPunchedOut = 0;
    let totalWfh = 0;
    let totalPresent = 0;
    let totalAbsent = 0;
    let totalLate = 0;
    let totalEmployees = 0;
    const cur = new Date(start);
    while (cur <= end) {
        const curStr = cur.toISOString().split('T')[0];
        const dayData = await getDailyAttendance(curStr, departmentFilter, shiftFilter, searchQuery);
        totalEmployees = Math.max(totalEmployees, dayData.total_employees);
        totalPunchedIn += dayData.punched_in_count;
        totalPunchedOut += dayData.punched_out_count;
        totalWfh += dayData.wfh_today;
        totalPresent += dayData.present_today;
        totalAbsent += dayData.absent_today;
        totalLate += dayData.late_today;
        for (const r of dayData.records) {
            allRecords.push({
                ...r,
                date: curStr,
            });
        }
        cur.setDate(cur.getDate() + 1);
    }
    return {
        date: `${startDateStr} to ${endDateStr}`,
        start_date: startDateStr,
        end_date: endDateStr,
        is_range: true,
        total_employees: totalEmployees,
        punched_in_count: totalPunchedIn,
        punched_out_count: totalPunchedOut,
        wfh_count: totalWfh,
        wfh_today: totalWfh,
        present_count: totalPresent,
        present_today: totalPresent,
        absent_count: totalAbsent,
        absent_today: totalAbsent,
        late_today: totalLate,
        records: allRecords,
    };
}
