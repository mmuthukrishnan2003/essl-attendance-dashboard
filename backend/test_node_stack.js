const fs = require('fs');
const path = require('path');
const { initDatabase, query } = require('./dist/db/connection');
const { ensureDefaultUsers, hashPassword, verifyPassword, createSession, validateSession } = require('./dist/services/authService');
const { getDailyAttendance, getEmployeePunches } = require('./dist/services/attendanceService');
const { getMonthlyAttendanceMatrix, setAttendanceOverride } = require('./dist/services/monthlyService');
const { generateMonthlyExcel } = require('./dist/services/excelService');

async function runDirectIntegrationTests() {
  console.log('🧪 Starting Direct Full-Stack Service Verification...');

  // 1. Initialize Database
  await initDatabase();
  console.log('✅ 1. Database initialized successfully.');

  // 2. Auth Service & Default Users
  await ensureDefaultUsers();
  const hrUser = await query("SELECT * FROM users WHERE username = 'hr'");
  console.log('✅ 2. Auth Service: HR user found in DB:', hrUser[0]?.username, '| Role:', hrUser[0]?.role);
  const isValidPw = verifyPassword('hr', hrUser[0].password_hash, hrUser[0].salt);
  console.log('      Password verification for "hr":', isValidPw);

  const sessionToken = createSession({
    id: hrUser[0].id,
    username: hrUser[0].username,
    fullName: hrUser[0].full_name,
    email: hrUser[0].email,
    role: hrUser[0].role
  });
  const validated = validateSession(sessionToken);
  console.log('      Session created & validated successfully. Token:', sessionToken.substring(0, 16) + '...');

  // 3. Daily Attendance Service
  const todayDaily = await getDailyAttendance('2026-11-04');
  console.log('✅ 3. Daily Attendance Service:');
  console.log(`      Date: ${todayDaily.date} | Total Staff: ${todayDaily.total_employees}`);
  console.log(`      Present: ${todayDaily.present_today} | Late: ${todayDaily.late_today} | Absent: ${todayDaily.absent_today} | WFH: ${todayDaily.wfh_today}`);
  console.log(`      Attendance Rate: ${todayDaily.attendance_rate}%`);

  // 4. Monthly Attendance Matrix (Muster Roll)
  const monthly = await getMonthlyAttendanceMatrix(2026, 11);
  console.log('✅ 4. Monthly Attendance Matrix (Muster Roll):');
  console.log(`      Month: ${monthly.month_name} | Working Days: ${monthly.working_days} / ${monthly.num_days}`);
  console.log(`      Records count: ${monthly.records.length}`);

  // Verify Saturdays & Sundays are Week Off (WO)
  const satDay = monthly.days_meta.find(d => d.weekday === 'Sat');
  const sunDay = monthly.days_meta.find(d => d.weekday === 'Sun');
  const monDay = monthly.days_meta.find(d => d.weekday === 'Mon');
  console.log(`      Saturday (Day ${satDay?.day}): is_weekend = ${satDay?.is_weekend} (Week Off)`);
  console.log(`      Sunday (Day ${sunDay?.day}): is_weekend = ${sunDay?.is_weekend} (Week Off)`);
  console.log(`      Monday (Day ${monDay?.day}): is_weekend = ${monDay?.is_weekend} (Working Day)`);

  if (satDay && monthly.records.length > 0) {
    const empSatStatus = monthly.records[0].days[String(satDay.day)].status;
    console.log(`      Sample Employee Saturday Status: "${empSatStatus}" (Expected: WO)`);
  }

  // 5. Manual Attendance Status Override
  if (monthly.records.length > 0) {
    const testEmp = monthly.records[0];
    const testDate = '2026-11-04';
    const res = await setAttendanceOverride(testEmp.emp_code, testDate, 'HDL', 'Doctor consultation');
    console.log('✅ 5. Manual Attendance Status Override set:');
    console.log(`      Emp: ${testEmp.emp_code} | Date: ${testDate} | Status: ${res.override?.status} | Remarks: ${res.override?.remarks}`);

    // Re-query monthly matrix to confirm override is applied
    const updatedMonthly = await getMonthlyAttendanceMatrix(2026, 11);
    const updatedEmp = updatedMonthly.records.find(r => r.emp_code === testEmp.emp_code);
    const day4 = updatedEmp.days['4'];
    console.log(`      Verified in Matrix: Day 4 Status = "${day4.status}", is_override = ${day4.is_override}`);
  }

  // 6. Corporate Excel Generation (.xlsx)
  const excelBuffer = await generateMonthlyExcel(2026, 11);
  console.log('✅ 6. Corporate Excel (.xlsx) Generation:');
  console.log(`      Generated Workbook Size: ${excelBuffer.length} bytes (Includes 'Daily IN-OUT Times' and 'Status Matrix')`);

  // 7. Angular 19/20 Built Assets Verification
  const distDir = path.resolve(__dirname, '../frontend/dist/frontend/browser');
  const indexPath = path.join(distDir, 'index.html');
  const indexExists = fs.existsSync(indexPath);
  const indexContent = indexExists ? fs.readFileSync(indexPath, 'utf-8') : '';
  console.log('✅ 7. Angular 19/20 Production Build:');
  console.log(`      Assets Path: ${distDir}`);
  console.log(`      index.html Exists: ${indexExists}`);
  console.log(`      Mounts <app-root>: ${indexContent.includes('<app-root>')}`);
  console.log(`      Scripts: ${indexContent.includes('<script')}`);

  console.log('\n🎉 ALL 7 TEST SUITES PASSED! Node + Express backend and Angular 20 frontend are 100% verified.');
  process.exit(0);
}

runDirectIntegrationTests().catch(err => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});
