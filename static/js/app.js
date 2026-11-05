// Centizen eSSL Attendance Management System Frontend Application



let currentTab = 'dashboard';

let weeklyChart = null;
let currentChartMode = 'attendance'; // 'attendance' or 'overtime'
let cachedWeeklyTrend = [];
let currentOvertimeRecords = [];
let cachedOvertimeSummary = null;

let allEmployeesCache = [];

let todayAttendanceCache = [];

let reportAttendanceCache = [];

let todaySortOrder = 'ASC';
let reportSortOrder = 'ASC';
let shiftAssignSortOrder = 'ASC';
let employeeSortOrder = 'ASC';

function sortRecordsByName(records, order = 'ASC') {
  if (!records || !Array.isArray(records)) return [];
  return records.slice().sort((a, b) => {
    const nameA = String(a.name || '').trim();
    const nameB = String(b.name || '').trim();
    const cmp = nameA.localeCompare(nameB, undefined, { sensitivity: 'base', numeric: true });
    return order === 'ASC' ? cmp : -cmp;
  });
}

function toggleTodaySort(field) {
  if (field === 'name') {
    todaySortOrder = todaySortOrder === 'ASC' ? 'DESC' : 'ASC';
    const icon = document.getElementById('today-sort-name-icon');
    if (icon) icon.textContent = todaySortOrder === 'ASC' ? '▲ A-Z' : '▼ Z-A';
    todayAttendanceCache = sortRecordsByName(todayAttendanceCache, todaySortOrder);
    filterTodayTable();
  }
}

function toggleReportSort(field) {
  if (field === 'name') {
    reportSortOrder = reportSortOrder === 'ASC' ? 'DESC' : 'ASC';
    const icon = document.getElementById('report-sort-name-icon');
    if (icon) icon.textContent = reportSortOrder === 'ASC' ? '▲ A-Z' : '▼ Z-A';
    reportAttendanceCache = sortRecordsByName(reportAttendanceCache, reportSortOrder);
    filterReportTable();
  }
}

function toggleShiftAssignSort(field) {
  if (field === 'name') {
    shiftAssignSortOrder = shiftAssignSortOrder === 'ASC' ? 'DESC' : 'ASC';
    const icon = document.getElementById('shift-sort-name-icon');
    if (icon) icon.textContent = shiftAssignSortOrder === 'ASC' ? '▲ A-Z' : '▼ Z-A';
    renderShiftAssignmentTable(allEmployeesCache, allShiftsCache);
  }
}

function toggleEmployeeSort(field) {
  if (field === 'name') {
    employeeSortOrder = employeeSortOrder === 'ASC' ? 'DESC' : 'ASC';
    const icon = document.getElementById('emp-sort-name-icon');
    if (icon) icon.textContent = employeeSortOrder === 'ASC' ? '▲ A-Z' : '▼ Z-A';
    allEmployeesCache = sortRecordsByName(allEmployeesCache, employeeSortOrder);
    filterEmployeeList();
  }
}



const VALID_TABS = ['dashboard', 'reports', 'monthly', 'late', 'exceeded', 'shifts', 'employees', 'devices', 'database', 'settings'];

// ================= PER-PAGE IN-PAGE REFRESH FUNCTIONS =================

async function refreshDashboardView() {
  const icon = document.getElementById('dashboard-refresh-icon');
  const text = document.getElementById('dashboard-refresh-text');
  if (icon) icon.classList.add('animate-spin');
  if (text) text.textContent = 'Refreshing...';
  try {
    await loadDashboardData();
    showToast('Dashboard overview refreshed', 'info');
  } catch (e) {
    showToast('Failed to refresh dashboard: ' + (e.message || e), 'error');
  } finally {
    if (icon) icon.classList.remove('animate-spin');
    if (text) text.textContent = 'Refresh';
  }
}

async function refreshReportsView() {
  const icon = document.getElementById('reports-refresh-icon');
  const text = document.getElementById('reports-refresh-text');
  if (icon) icon.classList.add('animate-spin');
  if (text) text.textContent = 'Refreshing...';
  try {
    await loadDailyReport();
    showToast('Daily reports refreshed', 'info');
  } catch (e) {
    showToast('Failed to refresh reports: ' + (e.message || e), 'error');
  } finally {
    if (icon) icon.classList.remove('animate-spin');
    if (text) text.textContent = 'Refresh';
  }
}

async function refreshShiftsView() {
  const icon = document.getElementById('shifts-refresh-icon');
  const text = document.getElementById('shifts-refresh-text');
  if (icon) icon.classList.add('animate-spin');
  if (text) text.textContent = 'Refreshing...';
  try {
    await loadShiftsData();
    showToast('Shift management refreshed', 'info');
  } catch (e) {
    showToast('Failed to refresh shifts: ' + (e.message || e), 'error');
  } finally {
    if (icon) icon.classList.remove('animate-spin');
    if (text) text.textContent = 'Refresh';
  }
}

async function refreshEmployeesView() {
  const icon = document.getElementById('emp-refresh-icon');
  const text = document.getElementById('emp-refresh-text');
  if (icon) icon.classList.add('animate-spin');
  if (text) text.textContent = 'Refreshing...';
  try {
    await loadEmployeesData();
    showToast('Employee directory refreshed', 'info');
  } catch (e) {
    showToast('Failed to refresh employees: ' + (e.message || e), 'error');
  } finally {
    if (icon) icon.classList.remove('animate-spin');
    if (text) text.textContent = 'Refresh';
  }
}

async function refreshDevicesView() {
  const icon = document.getElementById('devices-refresh-icon');
  const text = document.getElementById('devices-refresh-text');
  if (icon) icon.classList.add('animate-spin');
  if (text) text.textContent = 'Refreshing...';
  try {
    await loadDevicesData();
    showToast('Biometric devices refreshed', 'info');
  } catch (e) {
    showToast('Failed to refresh devices: ' + (e.message || e), 'error');
  } finally {
    if (icon) icon.classList.remove('animate-spin');
    if (text) text.textContent = 'Refresh';
  }
}

async function refreshSettingsView() {
  const icon = document.getElementById('settings-refresh-icon');
  const text = document.getElementById('settings-refresh-text');
  if (icon) icon.classList.add('animate-spin');
  if (text) text.textContent = 'Refreshing...';
  try {
    await loadSettings();
    showToast('Settings reloaded from server', 'info');
  } catch (e) {
    showToast('Failed to refresh settings: ' + (e.message || e), 'error');
  } finally {
    if (icon) icon.classList.remove('animate-spin');
    if (text) text.textContent = 'Refresh';
  }
}

function refreshCurrentPage() {
  if (currentTab === 'employees') refreshEmployeesView();
  else if (currentTab === 'shifts') refreshShiftsView();
  else if (currentTab === 'reports') refreshReportsView();

  else if (currentTab === 'monthly') refreshMonthlyView();
  else if (currentTab === 'exceeded') refreshExceededView();
  else if (currentTab === 'devices') refreshDevicesView();
  else if (currentTab === 'database') refreshDatabaseView();
  else if (currentTab === 'settings') refreshSettingsView();
  else refreshDashboardView();
}

document.addEventListener('DOMContentLoaded', () => {
  updateGlobalDbStatusBadge();
  setDashboardZoom('100%');
  initUserProfile();
  initLiveBiometricSync();
  initLiveClock();
  initDefaults();

  // Parse active tab from URL hash first, then localStorage fallback, default to dashboard
  const rawHash = (window.location.hash || '').replace('#', '').trim().toLowerCase();
  let savedTab = null;
  try {
    savedTab = localStorage.getItem('active_tab');
  } catch (e) {}

  const initialTab = VALID_TABS.includes(rawHash)
    ? rawHash
    : (VALID_TABS.includes(savedTab) ? savedTab : 'dashboard');

  // Immediately activate initial tab and load its specific data
  switchTab(initialTab, true);

  // Background initialization of settings & devices if not already active
  if (initialTab !== 'settings') {
    loadSettings();
  }
  if (initialTab !== 'devices' && initialTab !== 'dashboard') {
    loadDevicesData();
  }
});

// Browser Back / Forward hash navigation support
window.addEventListener('hashchange', () => {
  const hash = (window.location.hash || '').replace('#', '').trim().toLowerCase();
  if (hash && VALID_TABS.includes(hash) && hash !== currentTab) {
    switchTab(hash, false);
  }
});



// ================= ZOOM CONTROL (Cleaned / Default 100%) =================
function setDashboardZoom(val = '100%') {
  document.body.style.zoom = '100%';
  try {
    localStorage.removeItem('dashboard_zoom');
  } catch (e) {}
}

// ================= GLOBAL ACTIVE DB STATUS SYNC =================
async function updateGlobalDbStatusBadge() {
  try {
    const res = await fetch('/api/database/info');
    if (!res.ok) return;
    const data = await res.json();
    const isPostgres = Boolean(data.is_postgres || (data.dialect && data.dialect.toUpperCase().includes('POSTGRES')));
    const dbName = data.database_name || (isPostgres ? (data.connection_url ? data.connection_url.split('/').pop().split('?')[0] : 'essl_attendance') : 'attendance.db');

    const headerDbDot = document.getElementById('header-db-dot');
    const headerDbText = document.getElementById('header-db-text');
    const headerDbBadge = document.getElementById('header-db-badge');
    if (headerDbBadge && headerDbDot && headerDbText) {
      if (isPostgres) {
        headerDbBadge.className = 'hidden md:inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-50 text-blue-800 border border-blue-200 shadow-xs cursor-pointer hover:bg-blue-100 transition';
        headerDbDot.className = 'w-2 h-2 rounded-full bg-blue-600 animate-pulse';
        headerDbText.textContent = `DB: PostgreSQL (${dbName})`;
      } else {
        headerDbBadge.className = 'hidden md:inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-xs cursor-pointer hover:bg-emerald-100 transition';
        headerDbDot.className = 'w-2 h-2 rounded-full bg-emerald-500 animate-pulse';
        headerDbText.textContent = 'DB: SQLite';
      }
    }

    const sideDot = document.getElementById('sidebar-db-dot');
    const sideLabel = document.getElementById('sidebar-db-label');
    const sideName = document.getElementById('sidebar-db-name');
    if (sideDot && sideLabel && sideName) {
      if (isPostgres) {
        sideDot.className = 'w-2 h-2 rounded-full bg-blue-500 animate-pulse';
        sideLabel.textContent = 'DB: Postgres';
        sideName.textContent = dbName;
      } else {
        sideDot.className = 'w-2 h-2 rounded-full bg-emerald-500';
        sideLabel.textContent = 'DB: SQLite';
        sideName.textContent = 'attendance.db';
      }
    }
  } catch (e) {
    console.warn('Failed to update DB badge:', e);
  }
}



// ================= CLOCK & THEME =================

function initLiveClock() {

  const timeEl = document.getElementById('live-time');

  const dateEl = document.getElementById('live-date');



  function update() {

    const now = new Date();

    if (timeEl) {

      timeEl.textContent = now.toLocaleTimeString('en-US', { hour12: false });

    }

    if (dateEl) {

      dateEl.textContent = now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

    }

  }

  update();

  setInterval(update, 1000);

}



function initDefaults() {

  const now = new Date();

  const year = now.getFullYear();

  const month = String(now.getMonth() + 1).padStart(2, '0');

  const todayStr = `${year}-${month}-${String(now.getDate()).padStart(2, '0')}`;



  const startInput = document.getElementById('report-start-date');

  const endInput = document.getElementById('report-end-date');



  if (startInput && endInput) {

    // Default to 1 to 10 date set as preferred

    startInput.value = `${year}-${month}-01`;

    endInput.value = `${year}-${month}-10`;

    updateRangeLabel();

  }

}



function updateRangeLabel() {

  const s = document.getElementById('report-start-date')?.value;

  const e = document.getElementById('report-end-date')?.value;

  const label = document.getElementById('label-range-text');

  if (!label) return;



  if (s && e) {

    if (s === e) {

      label.textContent = s;

    } else {

      label.textContent = `${s} to ${e}`;

    }

  } else {

    label.textContent = s || e || '--';

  }

}



function setDateRangePreset(preset) {

  const now = new Date();

  const year = now.getFullYear();

  const month = String(now.getMonth() + 1).padStart(2, '0');

  const todayStr = `${year}-${month}-${String(now.getDate()).padStart(2, '0')}`;



  const startInput = document.getElementById('report-start-date');

  const endInput = document.getElementById('report-end-date');

  if (!startInput || !endInput) return;



  // Reset preset button styling

  ['1-10', 'today', 'last7', 'month'].forEach(id => {

    const b = document.getElementById(`preset-btn-${id}`);

    if (b) {

      b.className = 'px-2.5 py-1 rounded-md font-medium text-slate-600 hover:text-slate-900 transition';

    }

  });



  if (preset === '1_to_10') {

    startInput.value = `${year}-${month}-01`;

    endInput.value = `${year}-${month}-10`;

    const b = document.getElementById('preset-btn-1-10');

    if (b) b.className = 'px-3 py-1 rounded-md font-bold text-brand-navy bg-white border border-blue-200 shadow-xs transition';

  } else if (preset === 'today') {

    startInput.value = todayStr;

    endInput.value = todayStr;

    const b = document.getElementById('preset-btn-today');

    if (b) b.className = 'px-3 py-1 rounded-md font-bold text-brand-navy bg-white border border-blue-200 shadow-xs transition';

  } else if (preset === 'last7') {

    const past7 = new Date();

    past7.setDate(now.getDate() - 6);

    const pastYear = past7.getFullYear();

    const pastMonth = String(past7.getMonth() + 1).padStart(2, '0');

    const pastDay = String(past7.getDate()).padStart(2, '0');

    startInput.value = `${pastYear}-${pastMonth}-${pastDay}`;

    endInput.value = todayStr;

    const b = document.getElementById('preset-btn-last7');

    if (b) b.className = 'px-3 py-1 rounded-md font-bold text-brand-navy bg-white border border-blue-200 shadow-xs transition';

  } else if (preset === 'month') {

    startInput.value = `${year}-${month}-01`;

    const lastDay = new Date(year, now.getMonth() + 1, 0).getDate();

    endInput.value = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;

    const b = document.getElementById('preset-btn-month');

    if (b) b.className = 'px-3 py-1 rounded-md font-bold text-brand-navy bg-white border border-blue-200 shadow-xs transition';

  }



  updateRangeLabel();

  loadDailyReport();

}



// ================= TAB NAVIGATION (LEFT SIDEBAR) =================

function switchTab(tabId, updateHistory = true) {
  updateGlobalDbStatusBadge();
  if (!VALID_TABS.includes(tabId)) {
    tabId = 'dashboard';
  }

  currentTab = tabId;

  // Persist active tab to localStorage so page refresh stays on this page
  try {
    localStorage.setItem('active_tab', tabId);
  } catch (e) {}

  // Synchronize URL hash without full reload or scroll jump
  if (updateHistory) {
    if (window.location.hash !== '#' + tabId) {
      history.replaceState(null, '', '#' + tabId);
    }
  }

  // Toggle active button in left sidebar
  document.querySelectorAll('.nav-tab').forEach(btn => {
    btn.classList.remove('active-tab', 'bg-brand-navy', 'text-white', 'shadow-sm', 'font-bold');
    btn.classList.add('text-slate-600', 'hover:bg-slate-100', 'hover:text-slate-900', 'font-medium');
  });

  const activeBtn = document.getElementById(`tab-btn-${tabId}`);
  if (activeBtn) {
    activeBtn.classList.remove('text-slate-600', 'hover:bg-slate-100', 'hover:text-slate-900', 'font-medium');
    activeBtn.classList.add('active-tab', 'bg-brand-navy', 'text-white', 'shadow-sm', 'font-bold');
  }

  // Update top page title and subtitle
  const pageMeta = {
    dashboard: { title: 'Dashboard Overview', sub: "Today's live attendance metrics and punch tracking" },
    reports: { title: 'Daily IN/OUT & Reports', sub: 'Calculated First IN, Last OUT, intermediate punches, and export' },

    monthly: { title: 'Monthly Attendance Report & Muster Roll', sub: 'Comprehensive 1–31 days attendance matrix, muster roll, and monthly payroll summary' },
    late: { title: 'Monthly Late Punch Count', sub: 'Punctuality tracking, late punch counts, and arrival incidents based on 09:05 AM shift cutoff' },
    exceeded: { title: 'Permission (2 Hours Monthly Quota)', sub: '2-hour monthly permission quota applied to General Shift (9-7) and Standard Shift (9-6)' },
    shifts: { title: 'Shift Management', sub: 'Configure daytime and overnight cross-midnight shifts and assignments' },
    employees: { title: 'Employee Management', sub: 'Manage employee directory and biometric enrollments' },
    devices: { title: 'Connected eSSL Biometric Devices (4)', sub: 'Live integration with 4 eSSL F18 + F12 devices over Port 4370' },
    database: { title: 'Database & Schema Explorer', sub: 'PostgreSQL local essl (essl_att) and default schema management' },
    settings: { title: 'Logo & System Settings', sub: 'Upload company logo, customize theme colors, and thresholds' }
  };

  const titleEl = document.getElementById('topbar-page-title');
  const subEl = document.getElementById('topbar-page-sub');
  if (pageMeta[tabId]) {
    if (titleEl) titleEl.textContent = pageMeta[tabId].title;
    if (subEl) subEl.textContent = pageMeta[tabId].sub;
  }

  // Close mobile sidebar if open
  toggleMobileSidebar(false);

  // Toggle views
  document.querySelectorAll('.tab-view').forEach(view => view.classList.add('hidden'));
  const targetViewId = (tabId === 'exceeded' || tabId === 'late') ? 'view-monthly' : `view-${tabId}`;
  const activeView = document.getElementById(targetViewId);
  if (activeView) activeView.classList.remove('hidden');

  if (tabId === 'exceeded') {
    switchMonthlySubTab('exceeded', false);
  } else if (tabId === 'late') {
    switchMonthlySubTab('late', false);
  } else if (tabId === 'monthly') {
    switchMonthlySubTab('muster', false);
  }

  // Trigger relevant data load for this specific tab only
  if (tabId === 'dashboard') loadDashboardData();
  else if (tabId === 'reports') loadDailyReport();
  else if (tabId === 'monthly') loadMonthlyAttendanceData();
  else if (tabId === 'late') loadMonthlyLateData();
  else if (tabId === 'exceeded') loadExceededData();
  else if (tabId === 'shifts') loadShiftsData();
  else if (tabId === 'employees') loadEmployeesData();
  else if (tabId === 'devices') loadDevicesData();
  else if (tabId === 'database') loadDatabaseData();
  else if (tabId === 'settings') loadSettings();
}



function toggleMobileSidebar(open) {

  const sidebar = document.getElementById('sidebar');

  const backdrop = document.getElementById('mobile-sidebar-backdrop');

  if (!sidebar) return;



  const isCurrentlyClosed = sidebar.classList.contains('-translate-x-full');

  const shouldOpen = open !== undefined ? open : isCurrentlyClosed;



  if (shouldOpen) {

    sidebar.classList.remove('-translate-x-full');

    backdrop?.classList.remove('hidden');

  } else {

    sidebar.classList.add('-translate-x-full');

    backdrop?.classList.add('hidden');

  }

}



// ================= TOAST NOTIFICATIONS =================

function showToast(message, type = 'info') {

  const container = document.getElementById('toast-container');

  if (!container) return;



  const toast = document.createElement('div');

  toast.className = `pointer-events-auto px-4 py-2.5 rounded-xl shadow-lg text-xs font-semibold flex items-center space-x-2 transition-all transform duration-200 animate-fadeIn ${

    type === 'success' ? 'bg-emerald-700 text-white' :

    type === 'error' ? 'bg-rose-700 text-white' :

    type === 'warning' ? 'bg-amber-600 text-white' :

    'bg-slate-800 text-white'

  }`;



  const icon = type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ';

  toast.innerHTML = `<span class="text-sm font-bold">${icon}</span><span>${message}</span>`;



  container.appendChild(toast);

  setTimeout(() => {

    toast.style.opacity = '0';

    toast.style.transform = 'translateY(10px)';

    setTimeout(() => toast.remove(), 200);

  }, 4000);

}



// ================= TAB 1: DASHBOARD =================

let currentTodayFilter = 'ALL'; // 'ALL' | 'PRESENT' | 'ABSENT'



async function loadDashboardData() {

  try {

    const res = await fetch('/api/dashboard/summary');

    if (!res.ok) throw new Error('Failed to fetch dashboard summary');

    const data = await res.json();



    // Fill KPI counters

    document.getElementById('stat-total').textContent = data.total_employees;

    document.getElementById('stat-present').textContent = data.present_count;

    const lateEl = document.getElementById('stat-late');

    if (lateEl) lateEl.textContent = data.late_count;

    document.getElementById('stat-absent').textContent = data.absent_count;

    document.getElementById('stat-rate').textContent = `${data.attendance_rate_pct}% Attendance`;

    document.getElementById('dashboard-date-str').textContent = `${data.today_date} • Live Attendance Summary`;



    // Update pill counters on Today's Attendance table

    const pillAll = document.getElementById('pill-count-all');

    if (pillAll) pillAll.textContent = data.total_employees;

    const pillPres = document.getElementById('pill-count-present');

    if (pillPres) pillPres.textContent = data.present_count;

    const pillAbs = document.getElementById('pill-count-absent');

    if (pillAbs) pillAbs.textContent = data.absent_count;

    const pillWfh = document.getElementById('pill-count-wfh');

    if (pillWfh) {

      const wfhCount = (data.today_attendance || []).filter(r => r.is_wfh || (r.shift && r.shift.toUpperCase().includes('WFH'))).length;

      pillWfh.textContent = wfhCount;

    }

    const pillLate = document.getElementById('pill-count-late');

    if (pillLate) {

      const lateCount = data.late_count !== undefined ? data.late_count : (data.today_attendance || []).filter(r => r.is_late).length;

      pillLate.textContent = lateCount;

    }



    // Render Weekly Attendance / Overtime Chart
    cachedWeeklyTrend = data.weekly_trend || [];
    renderWeeklyChart(cachedWeeklyTrend);

    // Render Overtime (OT) Box
    if (data.today_overtime) {
      renderOvertimeBox(data.today_overtime);
    } else {
      loadTodayOvertimeSummary();
    }

    // Render Live Punch Feed

    renderLivePunchFeed(data.recent_feed);



    // Render Today's summary table

    todayAttendanceCache = sortRecordsByName(data.today_attendance || [], todaySortOrder);

    filterTodayTable();



  } catch (err) {

    console.error('Error loading dashboard:', err);

    showToast('Could not load dashboard data', 'error');

  }

}



function switchChartMode(mode) {
  currentChartMode = mode;
  const btnAtt = document.getElementById('chart-mode-att');
  const btnOt = document.getElementById('chart-mode-ot');
  const titleText = document.getElementById('chart-title-text');
  const subText = document.getElementById('chart-sub-text');

  if (mode === 'overtime') {
    if (btnOt) {
      btnOt.className = 'px-2.5 py-1 rounded-md font-medium text-xs bg-white text-brand-navy shadow-sm transition';
    }
    if (btnAtt) {
      btnAtt.className = 'px-2.5 py-1 rounded-md font-medium text-xs text-slate-600 hover:text-slate-900 transition';
    }
    if (titleText) titleText.textContent = 'Weekly Overtime (OT) Trend';
    if (subText) subText.innerHTML = 'Morning OT (<span class="text-amber-600 font-semibold">Amber</span>) & Evening OT (<span class="text-indigo-600 font-semibold">Indigo</span>)';
  } else {
    if (btnAtt) {
      btnAtt.className = 'px-2.5 py-1 rounded-md font-medium text-xs bg-white text-brand-navy shadow-sm transition';
    }
    if (btnOt) {
      btnOt.className = 'px-2.5 py-1 rounded-md font-medium text-xs text-slate-600 hover:text-slate-900 transition';
    }
    if (titleText) titleText.textContent = 'Weekly Attendance Trend';
    if (subText) subText.innerHTML = 'Daily breakdown of Present (<span class="text-brand-navy font-semibold">Navy</span>) and Absent (<span class="text-rose-600 font-semibold">Red</span>) staff';
  }

  renderWeeklyChart(cachedWeeklyTrend);
}

function renderWeeklyChart(trendData) {
  const canvas = document.getElementById('weeklyAttendanceChart');
  if (!canvas) return;

  if (weeklyChart) {
    weeklyChart.destroy();
  }

  const labels = (trendData || []).map(d => `${d.day} (${d.date})`);

  if (currentChartMode === 'overtime') {
    // Overtime Chart Mode
    const morningData = (trendData || []).map(d => d.morning_ot_hours || 0);
    const eveningData = (trendData || []).map(d => d.evening_ot_hours || 0);

    weeklyChart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Morning OT',
            data: morningData,
            backgroundColor: '#f59e0b', // Amber
            hoverBackgroundColor: '#d97706',
            borderRadius: 4
          },
          {
            label: 'Evening OT',
            data: eveningData,
            backgroundColor: '#6366f1', // Indigo
            hoverBackgroundColor: '#4f46e5',
            borderRadius: 4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        onClick: (event, elements) => {
          if (!elements || elements.length === 0) return;
          const idx = elements[0].index;
          const item = (trendData || [])[idx];
          if (item && item.full_date) {
            changeOvertimeDate(item.full_date);
          }
        },
        scales: {
          x: { stacked: true, grid: { display: false } },
          y: {
            stacked: true,
            beginAtZero: true,
            grid: { color: '#f1f5f9' },
            title: { display: true, text: 'OT Hours', font: { size: 10, weight: '600' } }
          }
        },
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              boxWidth: 12,
              font: { size: 11, weight: '600' },
              generateLabels: () => [
                { text: 'Morning OT', fillStyle: '#f59e0b', strokeStyle: '#f59e0b', lineWidth: 0, index: 0 },
                { text: 'Evening OT', fillStyle: '#6366f1', strokeStyle: '#6366f1', lineWidth: 0, index: 1 }
              ]
            }
          },
          tooltip: {
            padding: 10,
            cornerRadius: 8,
            callbacks: {
              afterBody: function(items) {
                if (!items || items.length === 0) return '';
                const idx = items[0].dataIndex;
                const item = (trendData || [])[idx];
                if (!item) return '';
                return `Total OT: ${item.total_ot_text || '0h 00m'} (${item.overtime_count || 0} Staff)\n💡 Click bar to view detailed employee list`;
              }
            }
          }
        }
      }
    });
  } else {
    // Attendance Chart Mode (Default)
    const presentData = (trendData || []).map(d => d.present);
    const absentData = (trendData || []).map(d => d.absent);

    weeklyChart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Present',
            data: presentData,
            backgroundColor: '#0a5482', // Centizen Navy
            hoverBackgroundColor: '#073e61',
            borderRadius: 4,
          },
          {
            label: 'Absent',
            data: absentData,
            backgroundColor: '#ef4444', // Red for Absent!
            hoverBackgroundColor: '#dc2626',
            borderRadius: 4,
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        onClick: (event, elements) => {
          if (!elements || elements.length === 0) return;
          const datasetIndex = elements[0].datasetIndex;
          const filterType = datasetIndex === 1 ? 'ABSENT' : 'PRESENT';
          setTodayFilter(filterType, true);
        },
        scales: {
          x: { stacked: true, grid: { display: false } },
          y: { stacked: true, beginAtZero: true, grid: { color: '#f1f5f9' } }
        },
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              boxWidth: 12,
              font: { size: 11, weight: '600' },
              generateLabels: (chart) => [
                { text: 'Present (On-Time / Active)', fillStyle: '#0a5482', strokeStyle: '#0a5482', lineWidth: 0, index: 0 },
                { text: 'Absent (No Punches - Red)', fillStyle: '#ef4444', strokeStyle: '#ef4444', lineWidth: 0, index: 1 }
              ]
            }
          },
          tooltip: {
            padding: 10,
            cornerRadius: 8,
            callbacks: {
              label: function(context) {
                const label = context.dataset.label || '';
                const val = context.parsed.y;
                return ` ${label}: ${val} staff`;
              }
            }
          }
        }
      }
    });
  }
}

// ================= OVERTIME (OT) TRACKING PANEL =================

async function loadTodayOvertimeSummary(targetDate) {
  try {
    const url = targetDate 
      ? `/api/attendance/overtime/summary?target_date=${encodeURIComponent(targetDate)}`
      : '/api/attendance/overtime/summary';
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to fetch overtime summary');
    const data = await res.json();
    renderOvertimeBox(data);
  } catch (err) {
    console.error('Error loading overtime summary:', err);
  }
}

function renderOvertimeBox(data) {
  if (!data) return;
  cachedOvertimeSummary = data;
  currentOvertimeRecords = data.employees || [];

  const badgeCount = document.getElementById('ot-badge-count');
  if (badgeCount) badgeCount.textContent = `${data.total_employees_with_ot || 0} Staff`;

  const mTotal = document.getElementById('ot-morning-total');
  if (mTotal) mTotal.textContent = data.total_morning_ot_text || '0h 00m';

  const eTotal = document.getElementById('ot-evening-total');
  if (eTotal) eTotal.textContent = data.total_evening_ot_text || '0h 00m';

  const gTotal = document.getElementById('ot-grand-total');
  if (gTotal) gTotal.textContent = `Total: ${data.total_ot_text || '0h 00m'}`;

  const dateInput = document.getElementById('ot-date-input');
  if (dateInput && data.date) dateInput.value = data.date;

  const footerDate = document.getElementById('ot-footer-date');
  if (footerDate) footerDate.textContent = data.date_formatted || data.date || 'Today';

  filterOvertimeTable();
}

function filterOvertimeTable() {
  const tbody = document.getElementById('ot-table-body');
  if (!tbody) return;

  const searchInput = document.getElementById('ot-search-input');
  const query = (searchInput?.value || '').trim().toLowerCase();

  let list = currentOvertimeRecords || [];
  if (query) {
    list = list.filter(r => 
      (r.name && r.name.toLowerCase().includes(query)) ||
      (r.emp_code && r.emp_code.toLowerCase().includes(query)) ||
      (r.department && r.department.toLowerCase().includes(query))
    );
  }

  if (list.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4" class="px-3 py-8 text-center text-slate-400 italic text-xs">
          ${query ? 'No matching overtime employees' : 'No overtime recorded for this date (Office hours: 9 AM - 7 PM)'}
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = list.map(emp => {
    return `
      <tr class="hover:bg-amber-50/20 transition" title="First IN: ${emp.first_in || '--'} | Last OUT: ${emp.last_out || '--'}">
        <td class="px-3 py-2 font-medium text-slate-800">
          <div class="truncate max-w-[150px] font-semibold text-slate-900" title="${emp.name}">${emp.name}</div>
          <div class="text-[10px] text-slate-400 font-mono">#${emp.emp_code} • ${emp.department || 'General'}</div>
        </td>
        <td class="px-3 py-2 text-right font-semibold text-amber-700 font-mono whitespace-nowrap">
          ${emp.morning_ot_text}
        </td>
        <td class="px-3 py-2 text-right font-semibold text-indigo-700 font-mono whitespace-nowrap">
          ${emp.evening_ot_text}
        </td>
        <td class="px-3 py-2 text-right whitespace-nowrap">
          <span class="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-xs">
            ${emp.total_ot_text}
          </span>
        </td>
      </tr>
    `;
  }).join('');
}

function changeOvertimeDate(dateStr) {
  if (!dateStr) return;
  loadTodayOvertimeSummary(dateStr);
}

function refreshOvertimeData() {
  const dateInput = document.getElementById('ot-date-input');
  const d = dateInput?.value || null;
  loadTodayOvertimeSummary(d);
  showToast('Overtime data refreshed', 'info');
}



function renderLivePunchFeed(feed) {

  const list = document.getElementById('live-punch-list');

  if (!list) return;



  if (!feed || feed.length === 0) {

    list.innerHTML = `<p class="text-slate-400 text-center py-6">No punches recorded today yet</p>`;

    return;

  }



  list.innerHTML = feed.map(p => `

    <div class="pt-2 pb-1 flex items-center justify-between">

      <div class="flex items-center space-x-2.5">

        <div class="w-7 h-7 rounded-full ${p.punch_type === 'IN' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'} flex items-center justify-center font-bold text-[10px]">

          ${p.punch_type}

        </div>

        <div>

          <p class="font-semibold text-slate-800 leading-snug">${p.emp_name} <span class="text-[10px] text-slate-400 font-normal">(${p.emp_code})</span></p>

          <p class="text-[10px] text-slate-500">${p.device_name}</p>

        </div>

      </div>

      <span class="font-mono text-[11px] font-semibold text-slate-700 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">

        ${p.time}

      </span>

    </div>

  `).join('');

}



function setTodayFilter(type, scroll = false) {

  currentTodayFilter = type;



  // Update pill buttons

  const btnAll = document.getElementById('pill-filter-all');

  const btnPres = document.getElementById('pill-filter-present');

  const btnAbs = document.getElementById('pill-filter-absent');

  const btnWfh = document.getElementById('pill-filter-wfh');

  const badge = document.getElementById('today-filter-badge');



  if (btnAll) {

    btnAll.className = type === 'ALL'

      ? 'px-3 py-1 rounded-md font-semibold bg-white text-brand-navy shadow-xs transition'

      : 'px-3 py-1 rounded-md font-medium text-slate-600 hover:text-brand-navy transition';

  }

  if (btnPres) {

    btnPres.className = type === 'PRESENT'

      ? 'px-3 py-1 rounded-md font-bold bg-emerald-600 text-white shadow-xs transition'

      : 'px-3 py-1 rounded-md font-medium text-slate-600 hover:text-emerald-700 transition';

  }

  if (btnAbs) {

    btnAbs.className = type === 'ABSENT'

      ? 'px-3 py-1 rounded-md font-bold bg-rose-600 text-white shadow-xs transition'

      : 'px-3 py-1 rounded-md font-medium text-slate-600 hover:text-rose-700 transition';

  }

  if (btnWfh) {

    btnWfh.className = type === 'WFH'

      ? 'px-3 py-1 rounded-md font-bold bg-teal-600 text-white shadow-xs transition'

      : 'px-3 py-1 rounded-md font-medium text-slate-600 hover:text-emerald-700 transition';

  }

  const btnLate = document.getElementById('pill-filter-late');

  if (btnLate) {

    btnLate.className = type === 'LATE'

      ? 'px-3 py-1 rounded-md font-bold bg-amber-600 text-white shadow-xs transition'

      : 'px-3 py-1 rounded-md font-medium text-slate-600 hover:text-amber-700 transition';

  }



  // Update filter badge

  if (badge) {

    if (type === 'PRESENT') {

      const presCount = todayAttendanceCache.filter(r => (r.total_punches > 0 || r.first_in || r.is_wfh)).length;

      badge.className = 'text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 inline-flex items-center space-x-1.5';

      badge.innerHTML = `<span>Showing Present Staff (${presCount})</span><button type="button" onclick="setTodayFilter('ALL')" class="ml-1 text-xs font-bold hover:text-emerald-950">&times;</button>`;

      badge.classList.remove('hidden');

    } else if (type === 'ABSENT') {

      const absCount = todayAttendanceCache.filter(r => (!r.is_wfh && (!r.total_punches || r.total_punches === 0))).length;

      badge.className = 'text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-300 inline-flex items-center space-x-1.5';

      badge.innerHTML = `<span>Showing Absent Staff (${absCount})</span><button type="button" onclick="setTodayFilter('ALL')" class="ml-1 text-xs font-bold hover:text-rose-950">&times;</button>`;

      badge.classList.remove('hidden');

    } else if (type === 'LATE') {

      const lateCount = todayAttendanceCache.filter(r => r.is_late).length;

      badge.className = 'text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300 inline-flex items-center space-x-1.5';

      badge.innerHTML = `<span>Showing Late Arrivals (${lateCount})</span><button type="button" onclick="setTodayFilter('ALL')" class="ml-1 text-xs font-bold hover:text-amber-950">&times;</button>`;

      badge.classList.remove('hidden');

    } else if (type === 'WFH') {

      const wfhCount = todayAttendanceCache.filter(r => (r.is_wfh || (r.shift && r.shift.toUpperCase().includes('WFH')))).length;

      badge.className = 'text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-teal-100 text-teal-800 border border-teal-300 inline-flex items-center space-x-1.5';

      badge.innerHTML = `<span>Showing WFH Staff (${wfhCount})</span><button type="button" onclick="setTodayFilter('ALL')" class="ml-1 text-xs font-bold hover:text-teal-950">&times;</button>`;

      badge.classList.remove('hidden');

    } else {

      badge.classList.add('hidden');

    }

  }



  filterTodayTable();



  if (scroll) {

    const section = document.getElementById('today-attendance-section');

    if (section) {

      section.scrollIntoView({ behavior: 'smooth', block: 'start' });

    }

  }

}



function filterTodayTable() {

  const query = (document.getElementById('dashboard-search-input')?.value || '').toLowerCase().trim();

  

  let filtered = todayAttendanceCache;



  if (currentTodayFilter === 'PRESENT') {

    filtered = filtered.filter(r => (r.total_punches > 0 || r.first_in || r.is_wfh));

  } else if (currentTodayFilter === 'LATE') {

    filtered = filtered.filter(r => r.is_late);

  } else if (currentTodayFilter === 'ABSENT') {

    filtered = filtered.filter(r => (!r.is_wfh && (!r.total_punches || r.total_punches === 0)));

  } else if (currentTodayFilter === 'WFH') {

    filtered = filtered.filter(r => (r.is_wfh || (r.shift && r.shift.toUpperCase().includes('WFH'))));

  }



  if (query) {

    filtered = filtered.filter(r => 

      (r.name && r.name.toLowerCase().includes(query)) ||

      (r.emp_code && r.emp_code.toLowerCase().includes(query)) ||

      (r.department && r.department.toLowerCase().includes(query))

    );

  }



  renderTodayAttendanceTable(filtered);

}



function renderTodayAttendanceTable(records) {

  const tbody = document.getElementById('today-attendance-tbody');

  if (!tbody) return;



  if (!records || records.length === 0) {

    const emptyMsg = currentTodayFilter === 'ABSENT' 

      ? 'No absent employees found today' 

      : (currentTodayFilter === 'PRESENT' ? 'No present employees found today' : 'No attendance data found for today');

    tbody.innerHTML = `<tr><td colspan="8" class="px-4 py-8 text-center text-slate-400 font-medium">${emptyMsg}</td></tr>`;

    return;

  }



  tbody.innerHTML = records.map(r => {

    const isWfh = Boolean(r.is_wfh || (r.shift && r.shift.toUpperCase().includes('WFH')));

    let shiftBadge = 'bg-blue-50 text-blue-800 border-blue-200';

    if (isWfh) {

      shiftBadge = 'bg-emerald-50 text-emerald-800 border-emerald-200';

    } else if (r.is_night_shift || (r.shift && r.shift.toLowerCase().includes('night'))) {

      shiftBadge = 'bg-indigo-50 text-indigo-800 border-indigo-200';

    } else if (r.shift && r.shift.includes('07:00')) {

      shiftBadge = 'bg-amber-50 text-amber-800 border-amber-200';

    }



    const isPresent = Boolean(r.first_in || (r.total_punches && r.total_punches > 0) || isWfh);



    return `

      <tr class="hover:bg-slate-50 transition ${!isPresent ? 'bg-rose-50/20' : ''}">

        <td class="px-4 py-3 font-mono font-semibold text-slate-800">${r.emp_code}</td>

        <td class="px-4 py-3 font-medium text-slate-900">${r.name}</td>


        <td class="px-4 py-3 text-center">

          <span class="inline-flex px-2 py-0.5 rounded-md text-[10px] font-semibold border ${shiftBadge}">

            ${r.shift}

          </span>

        </td>

        <td class="px-4 py-3 text-center">

          ${isWfh && (!r.total_punches || r.total_punches === 0) ? `

            <span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">

              🏠 WFH

            </span>

          ` : isPresent ? `

            ${r.is_late ? `
              <span class="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded text-xs font-bold bg-amber-50 text-amber-800 border border-amber-300 font-mono" title="${r.late_text || 'Late arrival after 09:05 AM'}">
                <span>${r.first_in_time}</span>
                <span class="text-[9px] bg-amber-200 text-amber-900 px-1 rounded font-extrabold uppercase tracking-tight">Late</span>
              </span>
            ` : `
              <span class="font-mono font-bold text-emerald-700">${r.first_in_time}</span>
            `}

          ` : `

            <span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-600 border border-rose-200">

              Absent

            </span>

          `}

        </td>

        <td class="px-4 py-3 text-center">

          ${isWfh && (!r.total_punches || r.total_punches === 0) ? `

            <span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">

              🏠 WFH

            </span>

          ` : r.last_out ? `

            <span class="font-mono font-semibold text-blue-700">${r.last_out_time}</span>

          ` : (r.is_in_office ? `

            <span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200" title="Punched IN and currently active inside office">

              <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1 animate-pulse"></span>In Office

            </span>

          ` : '<span class="text-slate-400 font-mono">--</span>')}

        </td>

        <td class="px-4 py-3 text-center">

          <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${

            isWfh && (!r.total_punches || r.total_punches === 0)

              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'

              : isPresent ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500'

          }">

            ${isWfh && (!r.total_punches || r.total_punches === 0) ? 'Remote' : (r.total_punches || 0)}

          </span>

        </td>

      </tr>

    `;

  }).join('');

}



// ================= TAB 2: DAILY IN/OUT & REPORTS =================

async function loadDailyReport() {

  const startInput = document.getElementById('report-start-date');

  const endInput = document.getElementById('report-end-date');

  

  // Default to 1st to 10th if not initialized

  if (startInput && !startInput.value) {

    const now = new Date();

    const year = now.getFullYear();

    const month = String(now.getMonth() + 1).padStart(2, '0');

    startInput.value = `${year}-${month}-01`;

  }

  if (endInput && !endInput.value) {

    const now = new Date();

    const year = now.getFullYear();

    const month = String(now.getMonth() + 1).padStart(2, '0');

    endInput.value = `${year}-${month}-10`;

  }



  const startDate = startInput ? startInput.value : '';

  const endDate = endInput ? endInput.value : startDate;

  const dept = document.getElementById('report-dept-select')?.value || 'ALL';

  const shift = document.getElementById('report-shift-select')?.value || 'ALL';

  const search = document.getElementById('report-search-input')?.value || '';



  updateRangeLabel();



  const tbody = document.getElementById('report-tbody');

  if (tbody) {

    tbody.innerHTML = `<tr><td colspan="9" class="px-4 py-8 text-center text-slate-400">Loading attendance calculation for date range (${startDate} to ${endDate})...</td></tr>`;

  }



  try {

    let url = `/api/attendance/daily?start_date=${encodeURIComponent(startDate)}&end_date=${encodeURIComponent(endDate)}`;

    if (dept !== 'ALL') url += `&department=${encodeURIComponent(dept)}`;

    if (shift !== 'ALL') url += `&shift=${encodeURIComponent(shift)}`;

    if (search.trim()) url += `&search=${encodeURIComponent(search.trim())}`;



    const res = await fetch(url);

    if (!res.ok) throw new Error('Failed to load report');

    const data = await res.json();



    // Update banner counters

    const bDate = document.getElementById('report-banner-date');

    const bTotal = document.getElementById('report-banner-total');

    const bIn = document.getElementById('report-banner-in');

    const bOut = document.getElementById('report-banner-out');

    const bAbs = document.getElementById('report-banner-absent');

    const bWfh = document.getElementById('report-banner-wfh');

    const bAvg = document.getElementById('report-banner-avg');



    if (bDate) bDate.textContent = data.date;

    if (bWfh) bWfh.textContent = data.wfh_count || 0;

    if (bTotal) bTotal.textContent = data.total_employees;

    if (bIn) bIn.textContent = data.punched_in_count;

    if (bOut) bOut.textContent = data.punched_out_count;

    if (bAbs) bAbs.textContent = data.absent_count;

    if (bAvg) bAvg.textContent = data.avg_working_hours;



    reportAttendanceCache = sortRecordsByName(data.records || [], reportSortOrder);

    filterReportTable();



    populateDeptDropdowns();



  } catch (err) {

    console.error('Error loading report:', err);

    showToast('Failed to fetch attendance report', 'error');

  }

}



function renderReportTable(records) {

  const tbody = document.getElementById('report-tbody');

  if (!tbody) return;



  if (!records || records.length === 0) {

    tbody.innerHTML = `<tr><td colspan="9" class="px-4 py-8 text-center text-slate-400">No attendance records matching the criteria</td></tr>`;

    return;

  }



  tbody.innerHTML = records.map(r => {

    const isWfh = Boolean(r.is_wfh || (r.shift && r.shift.toUpperCase().includes('WFH')));

    let shiftBadge = 'bg-blue-50 text-blue-800 border-blue-200';

    if (isWfh) {

      shiftBadge = 'bg-emerald-50 text-emerald-800 border-emerald-200';

    } else if (r.is_night_shift || (r.shift && r.shift.toLowerCase().includes('night'))) {

      shiftBadge = 'bg-indigo-50 text-indigo-800 border-indigo-200';

    } else if (r.shift && r.shift.includes('07:00')) {

      shiftBadge = 'bg-amber-50 text-amber-800 border-amber-200';

    }



    const isPresent = Boolean(r.first_in || (r.total_punches && r.total_punches > 0) || isWfh);



    return `

      <tr class="hover:bg-slate-50 transition ${!isPresent ? 'bg-rose-50/20' : ''}">

        <td class="px-4 py-3 font-mono text-slate-500 whitespace-nowrap">${r.date}</td>

        <td class="px-4 py-3 font-mono font-semibold text-slate-800">${r.emp_code}</td>

        <td class="px-4 py-3 font-medium text-slate-900">${r.name}</td>


        <td class="px-4 py-3 text-center">

          <span class="inline-flex px-2 py-0.5 rounded-md text-[10px] font-semibold border ${shiftBadge}">

            ${r.shift}

          </span>

        </td>

        

        <!-- First IN -->

        <td class="px-4 py-3 text-center">

          ${isWfh && (!r.total_punches || r.total_punches === 0) ? `

            <div class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">🏠 WFH</div>

            <div class="text-[10px] text-slate-400">Remote Work</div>

          ` : isPresent ? `

            <div class="font-mono font-semibold text-emerald-700">${r.first_in_time}</div>

            <div class="text-[10px] text-slate-400 truncate max-w-[120px] mx-auto">${r.first_in_device}</div>

          ` : `

            <span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-600 border border-rose-200">

              Absent

            </span>

          `}

        </td>



        <!-- Last OUT -->

        <td class="px-4 py-3 text-center">

          ${isWfh && (!r.total_punches || r.total_punches === 0) ? `

            <div class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">🏠 WFH</div>

            <div class="text-[10px] text-slate-400">Remote Work</div>

          ` : r.last_out ? `

            <div class="font-mono font-semibold text-blue-700">${r.last_out_time}</div>

            <div class="text-[10px] text-slate-400 truncate max-w-[120px] mx-auto">${r.last_out_device}</div>

          ` : (r.is_in_office ? `

            <span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200" title="Returned and currently active inside office">

              <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1 animate-pulse"></span>In Office

            </span>

          ` : '<span class="text-slate-400">--</span>')}

        </td>



        <!-- Intermediate count -->

        <td class="px-4 py-3 text-center">

          ${r.intermediate_count > 0 ? `

            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">

              ${r.intermediate_count} punches

            </span>

          ` : '<span class="text-slate-400 font-mono">0</span>'}

        </td>

      </tr>

    `;

  }).join('');

}



function filterReportTable() {

  const query = (document.getElementById('report-search-input')?.value || '').toLowerCase().trim();

  const statusFilter = document.getElementById('report-status-filter')?.value || 'ALL';



  let filtered = reportAttendanceCache;



  if (statusFilter === 'PRESENT') {

    filtered = filtered.filter(r => (r.total_punches > 0 || r.first_in || r.is_wfh));

  } else if (statusFilter === 'ABSENT') {

    filtered = filtered.filter(r => (!r.is_wfh && (!r.total_punches || r.total_punches === 0)));

  } else if (statusFilter === 'WFH') {

    filtered = filtered.filter(r => (r.is_wfh || (r.shift && r.shift.toUpperCase().includes('WFH'))));

  }



  if (query) {

    filtered = filtered.filter(r =>

      (r.name && r.name.toLowerCase().includes(query)) ||

      (r.emp_code && r.emp_code.toLowerCase().includes(query)) ||

      (r.department && r.department.toLowerCase().includes(query))

    );

  }



  renderReportTable(filtered);

}



function exportExcel() {

  const startInput = document.getElementById('report-start-date');

  const endInput = document.getElementById('report-end-date');

  const s = startInput ? startInput.value : '';

  const e = endInput ? endInput.value : s;

  const dept = document.getElementById('report-dept-select')?.value || 'ALL';

  const shift = document.getElementById('report-shift-select')?.value || 'ALL';

  window.location.href = `/api/attendance/export/excel?start_date=${encodeURIComponent(s)}&end_date=${encodeURIComponent(e)}&department=${encodeURIComponent(dept)}&shift=${encodeURIComponent(shift)}`;

}



function exportCSV() {

  const startInput = document.getElementById('report-start-date');

  const endInput = document.getElementById('report-end-date');

  const s = startInput ? startInput.value : '';

  const e = endInput ? endInput.value : s;

  const dept = document.getElementById('report-dept-select')?.value || 'ALL';

  const shift = document.getElementById('report-shift-select')?.value || 'ALL';

  window.location.href = `/api/attendance/export/csv?start_date=${encodeURIComponent(s)}&end_date=${encodeURIComponent(e)}&department=${encodeURIComponent(dept)}&shift=${encodeURIComponent(shift)}`;

}



// ================= MODAL 1: IN/OUT PUNCH TIMELINE DRILLDOWN =================

async function viewEmployeePunches(empCode, targetDate) {

  try {

    const res = await fetch(`/api/attendance/employee/${empCode}/punches?target_date=${targetDate}`);

    if (!res.ok) throw new Error('Could not load punch history');

    const data = await res.json();



    document.getElementById('modal-punches-emp-name').textContent = `${data.name} (${data.emp_code})`;

    document.getElementById('modal-punches-subtitle').textContent = `Date: ${data.date} • Shift: ${data.shift || 'Standard'}`;

    document.getElementById('modal-punches-total-count').textContent = data.total_punches;

    const durEl = document.getElementById('modal-punches-duration');

    if (durEl) durEl.textContent = data.total_work_duration;



    const timelineContainer = document.getElementById('modal-punches-timeline');

    if (!data.punches || data.punches.length === 0) {

      timelineContainer.innerHTML = `<p class="text-slate-400 py-4">No punch records found for this employee on ${data.date}</p>`;

    } else {

      timelineContainer.innerHTML = data.punches.map(p => {

        let dotColor = 'bg-slate-400';

        let badgeBg = 'bg-slate-100 text-slate-700';



        if (p.punch_type === 'IN') {

          if (p.role === 'FIRST_IN') {

            dotColor = 'bg-emerald-500 ring-4 ring-emerald-100';

            badgeBg = 'bg-emerald-100 text-emerald-800 font-bold border border-emerald-200';

          } else if (p.role === 'CURRENT_IN') {

            dotColor = 'bg-emerald-500 ring-4 ring-emerald-200 animate-pulse';

            badgeBg = 'bg-emerald-600 text-white font-bold shadow-xs';

          } else {

            dotColor = 'bg-emerald-500';

            badgeBg = 'bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200';

          }

        } else {

          if (p.role === 'LAST_OUT') {

            dotColor = 'bg-blue-600 ring-4 ring-blue-100';

            badgeBg = 'bg-blue-100 text-blue-800 font-bold border border-blue-200';

          } else {

            dotColor = 'bg-amber-500';

            badgeBg = 'bg-amber-100 text-amber-800 font-semibold border border-amber-200';

          }

        }



        const typeBadge = p.punch_type === 'IN' 

          ? '<span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200"><span class="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1"></span>Type: IN</span>'

          : '<span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200"><span class="w-1.5 h-1.5 rounded-full bg-blue-500 mr-1"></span>Type: OUT</span>';



        return `

          <div class="relative group">

            <!-- Timeline dot -->

            <div class="absolute -left-[27px] top-1.5 w-3.5 h-3.5 rounded-full ${dotColor}"></div>

            

            <div class="bg-white border border-slate-200 rounded-xl p-3 shadow-xs hover:border-brand-navy transition">

              <div class="flex items-center justify-between">

                <div class="flex items-center space-x-2">

                  <span class="inline-flex px-2 py-0.5 rounded-md text-[11px] ${badgeBg}">

                    ${p.label}

                  </span>

                  <span class="text-xs text-slate-500 font-medium">via ${p.device_name}</span>

                </div>

                <span class="font-mono text-xs font-bold text-slate-800 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">

                  ${p.time}

                </span>

              </div>

              <div class="mt-1.5 text-[11px] text-slate-400 flex items-center justify-between">

                <span>Device IP: ${p.device_ip}</span>

                ${typeBadge}

              </div>

            </div>

          </div>

        `;

      }).join('');

    }



    openModal('modal-punches');



  } catch (err) {

    console.error('Error fetching punches timeline:', err);

    showToast('Failed to load punch timeline', 'error');

  }

}



// ================= TAB 3: EMPLOYEES =================

async function loadEmployeesData() {

  try {

    const res = await fetch('/api/employees');

    if (!res.ok) throw new Error('Failed to load employees');

    const data = await res.json();



    allEmployeesCache = sortRecordsByName(data.employees || [], employeeSortOrder);

    document.getElementById('employee-count-badge').textContent = `Total: ${data.total}`;



    // Populate department dropdowns

    populateDeptDropdowns(data.departments);



    renderEmployeesTable(allEmployeesCache);

  } catch (err) {

    console.error('Error loading employees:', err);

    showToast('Failed to load employee directory', 'error');

  }

}



function renderEmployeesTable(employees) {

  const tbody = document.getElementById('employees-tbody');

  if (!tbody) return;



  if (!employees || employees.length === 0) {

    tbody.innerHTML = `<tr><td colspan="8" class="px-4 py-8 text-center text-slate-400">No employees found</td></tr>`;

    return;

  }



  const sortedEmps = sortRecordsByName(employees, shiftAssignSortOrder);

  tbody.innerHTML = sortedEmps.map(e => `

    <tr class="hover:bg-slate-50 transition">

      <td class="px-4 py-3 font-mono font-bold text-slate-800">${e.emp_code}</td>

      <td class="px-4 py-3 font-medium text-slate-900">${e.name}</td>


      <td class="px-4 py-3 text-slate-600">${e.designation}</td>

      <td class="px-4 py-3 text-center text-[11px] font-mono text-slate-600">${e.shift_start} - ${e.shift_end}</td>

      <td class="px-4 py-3 text-slate-500 text-[11px]">

        <div>${e.email || '--'}</div>

        <div>${e.phone || ''}</div>

      </td>

      <td class="px-4 py-3 text-center">

        <span class="inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold ${e.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}">

          ${e.is_active ? 'Active' : 'Inactive'}

        </span>

      </td>

      <td class="px-4 py-3 text-right space-x-2">

        <button onclick="editEmployee('${e.emp_code}')" class="text-xs font-semibold text-brand-navy hover:underline">Edit</button>

        <button onclick="deleteEmployee('${e.emp_code}')" class="text-xs font-semibold text-rose-600 hover:underline">Delete</button>

      </td>

    </tr>

  `).join('');

}



function filterEmployeeList() {

  const query = (document.getElementById('employee-search-input')?.value || '').toLowerCase();

  const dept = document.getElementById('employee-dept-filter')?.value || 'ALL';



  const filtered = allEmployeesCache.filter(e => {

    const matchesQuery = e.name.toLowerCase().includes(query) || e.emp_code.toLowerCase().includes(query);

    const matchesDept = (dept === 'ALL' || e.department === dept);

    return matchesQuery && matchesDept;

  });



  renderEmployeesTable(filtered);

}



function populateDeptDropdowns(departments) {

  if (!departments) {

    const depts = [...new Set(allEmployeesCache.map(e => e.department).filter(Boolean))];

    departments = depts;

  }



  ['report-dept-select', 'employee-dept-filter'].forEach(id => {

    const sel = document.getElementById(id);

    if (!sel) return;

    const curVal = sel.value;

    sel.innerHTML = '<option value="ALL">All Departments</option>' +

      departments.map(d => `<option value="${d}" ${d === curVal ? 'selected' : ''}>${d}</option>`).join('');

  });

}



function openAddEmployeeModal() {

  document.getElementById('modal-employee-title').textContent = 'Add New Employee';

  document.getElementById('emp-form-mode').value = 'ADD';

  document.getElementById('emp-form-code').disabled = false;

  document.getElementById('employee-form').reset();

  openModal('modal-employee');

}



function editEmployee(empCode) {

  const emp = allEmployeesCache.find(e => e.emp_code === empCode);

  if (!emp) return;



  document.getElementById('modal-employee-title').textContent = `Edit Employee: ${emp.name}`;

  document.getElementById('emp-form-mode').value = 'EDIT';

  document.getElementById('emp-form-code').value = emp.emp_code;

  document.getElementById('emp-form-code').disabled = true;

  document.getElementById('emp-form-name').value = emp.name;

  document.getElementById('emp-form-dept').value = emp.department;

  document.getElementById('emp-form-desig').value = emp.designation;

  document.getElementById('emp-form-email').value = emp.email || '';

  document.getElementById('emp-form-phone').value = emp.phone || '';

  const shiftSel = document.getElementById('emp-form-shift-select');

  if (shiftSel) shiftSel.value = emp.shift_code || 'SHIFT_9_6';

  document.getElementById('emp-form-shift-start').value = emp.shift_start || '09:00';

  document.getElementById('emp-form-shift-end').value = emp.shift_end || '18:00';

  document.getElementById('emp-form-card').value = emp.card_number || '';



  openModal('modal-employee');

}



function onEmpShiftSelectChange(code) {
  const shift = (allShiftsCache || []).find(s => s.code === code);
  if (shift) {
    if (shift.start_time && shift.start_time !== '00:00') {
      document.getElementById('emp-form-shift-start').value = shift.start_time;
    }
    if (shift.end_time && shift.end_time !== '00:00') {
      document.getElementById('emp-form-shift-end').value = shift.end_time;
    }
    return;
  }
  if (code === 'SHIFT_9_7') {
    document.getElementById('emp-form-shift-start').value = '09:00';
    document.getElementById('emp-form-shift-end').value = '19:00';
  } else if (code === 'SHIFT_9_6') {
    document.getElementById('emp-form-shift-start').value = '09:00';
    document.getElementById('emp-form-shift-end').value = '18:00';
  } else if (code === 'SHIFT_NIGHT') {
    document.getElementById('emp-form-shift-start').value = '21:00';
    document.getElementById('emp-form-shift-end').value = '06:00';
  } else if (code === 'SHIFT_WFH') {
    document.getElementById('emp-form-shift-start').value = '09:30';
    document.getElementById('emp-form-shift-end').value = '18:30';
  }
}



async function submitEmployeeForm(event) {

  event.preventDefault();

  const mode = document.getElementById('emp-form-mode').value;

  const empCode = document.getElementById('emp-form-code').value.trim();

  const shiftSelect = document.getElementById('emp-form-shift-select');

  const shiftCode = shiftSelect ? shiftSelect.value : 'SHIFT_9_6';

  const shiftName = shiftSelect ? shiftSelect.options[shiftSelect.selectedIndex].text : 'Standard Shift (09:00 AM - 06:00 PM)';



  const payload = {

    emp_code: empCode,

    name: document.getElementById('emp-form-name').value.trim(),

    department: document.getElementById('emp-form-dept').value.trim(),

    designation: document.getElementById('emp-form-desig').value.trim(),

    email: document.getElementById('emp-form-email').value.trim() || null,

    phone: document.getElementById('emp-form-phone').value.trim() || null,

    shift_code: shiftCode,

    shift_name: shiftName,

    shift_start: document.getElementById('emp-form-shift-start').value || '09:00',

    shift_end: document.getElementById('emp-form-shift-end').value || '18:00',

    card_number: document.getElementById('emp-form-card').value.trim() || null,

    is_active: true

  };



  try {

    let res;

    if (mode === 'ADD') {

      res = await fetch('/api/employees', {

        method: 'POST',

        headers: { 'Content-Type': 'application/json' },

        body: JSON.stringify(payload)

      });

    } else {

      res = await fetch(`/api/employees/${empCode}`, {

        method: 'PUT',

        headers: { 'Content-Type': 'application/json' },

        body: JSON.stringify(payload)

      });

    }



    if (!res.ok) {

      const err = await res.json();

      throw new Error(err.detail || 'Failed to save employee');

    }



    closeModal('modal-employee');

    showToast(`Employee ${payload.name} saved successfully`, 'success');

    loadEmployeesData();



  } catch (err) {

    showToast(err.message, 'error');

  }

}



async function deleteEmployee(empCode) {

  if (!confirm(`Are you sure you want to remove employee ${empCode}?`)) return;



  try {

    const res = await fetch(`/api/employees/${empCode}`, { method: 'DELETE' });

    if (!res.ok) throw new Error('Failed to delete employee');

    showToast(`Employee ${empCode} deleted`, 'success');

    loadEmployeesData();

  } catch (err) {

    showToast(err.message, 'error');

  }

}



// ================= TAB 4: BIOMETRIC DEVICES =================

let currentDevicesCache = [];



async function loadDevicesData() {

  try {

    const res = await fetch('/api/devices');

    if (!res.ok) throw new Error('Failed to load devices');

    const data = await res.json();



    const devices = data.devices || [];

    currentDevicesCache = devices;

    renderDeviceCards(devices);

    renderDevicePillsInHeader(devices);



  } catch (err) {

    console.error('Error loading devices:', err);

  }

}



function renderDevicePillsInHeader(devices) {

  const container = document.getElementById('dashboard-device-pills');

  if (!container) return;



  container.innerHTML = devices.map(d => {

    const isOnline = d.last_status === 'ONLINE';

    return `

      <div class="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border ${

        isOnline ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-slate-100 text-slate-600 border-slate-200'

      }">

        <span class="w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-slate-400'}"></span>

        <span class="font-semibold text-[11px]">${d.device_name || d.ip_address}</span>

      </div>

    `;

  }).join('');

}



function renderDeviceCards(devices) {

  const grid = document.getElementById('devices-cards-grid');

  if (!grid) return;



  grid.innerHTML = devices.map(d => {

    const isOnline = d.last_status === 'ONLINE';

    const statusColor = isOnline ? 'text-emerald-700 bg-emerald-50 border-emerald-200' :

                        d.last_status === 'ERROR' ? 'text-rose-700 bg-rose-50 border-rose-200' :

                        'text-slate-600 bg-slate-100 border-slate-200';



    return `

      <div class="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex flex-col justify-between">

        <div>

          <div class="flex items-start justify-between">

            <div>

              <h3 class="text-sm font-bold text-slate-900">${d.device_name}</h3>

              <p class="text-xs text-slate-500 mt-0.5">${d.device_model} &bull; Type: <strong class="text-brand-navy">${d.attendance_type}</strong></p>

            </div>

            <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${statusColor}">

              <span class="w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-slate-400'} mr-1.5"></span>

              ${d.last_status}

            </span>

          </div>



          <div class="mt-4 grid grid-cols-2 gap-3 text-xs bg-slate-50 p-3 rounded-lg border border-slate-100">

            <div>

              <span class="text-slate-400 text-[11px]">IP Address:</span>

              <p class="font-mono font-bold text-slate-800">${d.ip_address}</p>

            </div>

            <div>

              <span class="text-slate-400 text-[11px]">Port:</span>

              <p class="font-mono font-bold text-slate-800">${d.port}</p>

            </div>

            <div>

              <span class="text-slate-400 text-[11px]">Punches Synced:</span>

              <p class="font-bold text-slate-800">${d.total_punches_synced}</p>

            </div>

            <div>

              <span class="text-slate-400 text-[11px]">Last Sync:</span>

              <p class="text-slate-700">${d.last_sync_time || 'Never'}</p>

            </div>

          </div>



          ${d.last_error ? `

            <div class="mt-2 text-[11px] text-rose-600 bg-rose-50 p-2 rounded border border-rose-100">

              Note: ${d.last_error}

            </div>

          ` : ''}

        </div>



        <div class="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between">

          <div class="flex items-center space-x-2">

            <button onclick="testDeviceConnection(${d.id})" class="inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition" title="Test device TCP reachability">

              <svg class="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>

              <span>Test Ping</span>

            </button>

            <button onclick="openEditDeviceModal(${d.id})" class="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-blue-50 hover:bg-blue-100 text-brand-navy border border-blue-200 transition" title="Edit device name, location or IP">

              <svg class="w-3.5 h-3.5 text-brand-navy" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>

              <span>Edit</span>

            </button>

          </div>



          <button onclick="syncSingleDevice(${d.id})" class="inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-brand-navy hover:bg-brand-navyHover text-white transition">

            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>

            <span>Sync Logs</span>

          </button>

        </div>

      </div>

    `;

  }).join('');

}



async function testDeviceConnection(deviceId) {

  showToast(`Testing device connection...`, 'info');

  try {

    const res = await fetch(`/api/devices/${deviceId}/test`, { method: 'POST' });

    const data = await res.json();

    if (data.result.reachable) {

      showToast(`Device ${data.ip} is ONLINE (${data.result.latency_ms}ms)`, 'success');

    } else {

      showToast(`Device ${data.ip} is OFFLINE: ${data.result.error}`, 'warning');

    }

    loadDevicesData();

  } catch (err) {

    showToast('Failed to test connection', 'error');

  }

}



async function syncSingleDevice(deviceId) {

  showToast(`Syncing device logs...`, 'info');

  try {

    const res = await fetch(`/api/devices/${deviceId}/sync`, { method: 'POST' });

    const data = await res.json();

    if (data.status === 'SUCCESS') {

      showToast(`Synced ${data.synced_count} new punches from ${data.ip}`, 'success');

    } else {

      showToast(`Sync failed for ${data.ip}: ${data.error}`, 'error');

    }

    loadDevicesData();

    loadDashboardData();

  } catch (err) {

    showToast('Device sync failed', 'error');

  }

}



async function syncAllDevices() {

  const icon = document.getElementById('header-sync-icon');

  const text = document.getElementById('header-sync-text');

  if (icon) icon.classList.add('animate-spin');

  if (text) text.textContent = 'Syncing...';



  showToast('Connecting to all 4 biometric devices...', 'info');



  try {

    const res = await fetch('/api/devices/sync-all', { method: 'POST' });

    const data = await res.json();



    if (data.success_devices > 0) {

      showToast(`Synced ${data.total_new_punches} punches from ${data.success_devices}/${data.total_devices} devices!`, 'success');

    } else {

      showToast(`No devices reachable on current network (${data.failed_devices} offline).`, 'warning');

    }



    loadDevicesData();

    loadDashboardData();

    if (currentTab === 'reports') loadDailyReport();



  } catch (err) {

    showToast('Device synchronization error', 'error');

  } finally {

    if (icon) icon.classList.remove('animate-spin');

    if (text) text.textContent = 'Sync Devices';

  }

}



async function seedDemoData() {

  showToast('Generating sample punches across all 4 devices...', 'info');

  try {

    const res = await fetch('/api/devices/seed-demo', { method: 'POST' });

    if (!res.ok) throw new Error('Seeding failed');

    const data = await res.json();

    showToast(`Seeded ${data.details.punches_added} punches for ${data.details.employees_seeded} employees across 5 days!`, 'success');



    loadDashboardData();

    loadDevicesData();

    if (currentTab === 'reports') loadDailyReport();

    if (currentTab === 'employees') loadEmployeesData();



  } catch (err) {

    showToast('Failed to seed demo data', 'error');

  }

}



// ================= TAB 5: LOGO & SETTINGS =================

async function loadSettings() {

  try {

    const res = await fetch('/api/settings');

    if (!res.ok) throw new Error('Failed to load settings');

    const s = await res.json();



    if (s.company_name) {

      document.getElementById('setting-company-name').value = s.company_name;

      const hdrName = document.getElementById('header-company-name');

      if (hdrName) hdrName.textContent = s.company_name;

    }



    if (s.logo_path) {

      const logoEl = document.getElementById('header-logo');

      const prevEl = document.getElementById('settings-logo-preview');

      if (logoEl) logoEl.src = s.logo_path + '?t=' + Date.now();

      if (prevEl) prevEl.src = s.logo_path + '?t=' + Date.now();

    }



    if (s.primary_color) {

      document.getElementById('setting-primary-color').value = s.primary_color;

      document.getElementById('setting-primary-color-text').value = s.primary_color;

      applyDynamicTheme(s.primary_color, s.accent_color || '#f27e20');

    }



    if (s.accent_color) {

      document.getElementById('setting-accent-color').value = s.accent_color;

      document.getElementById('setting-accent-color-text').value = s.accent_color;

    }



    if (s.shift_start_time) document.getElementById('setting-shift-start').value = s.shift_start_time;

    if (s.shift_end_time) document.getElementById('setting-shift-end').value = s.shift_end_time;

    if (s.late_grace_minutes) document.getElementById('setting-late-grace').value = s.late_grace_minutes;

    if (s.full_day_hours) document.getElementById('setting-full-day-hours').value = s.full_day_hours;

    if (s.half_day_hours) document.getElementById('setting-half-day-hours').value = s.half_day_hours;

    if (s.auto_sync_interval_mins) document.getElementById('setting-sync-interval').value = s.auto_sync_interval_mins;



  } catch (err) {

    console.error('Error loading settings:', err);

  }

}



function applyDynamicTheme(primary, accent) {

  document.documentElement.style.setProperty('--primary-color', primary);

  document.documentElement.style.setProperty('--accent-color', accent);

}



// Sync color inputs

document.getElementById('setting-primary-color')?.addEventListener('input', (e) => {

  document.getElementById('setting-primary-color-text').value = e.target.value;

  applyDynamicTheme(e.target.value, document.getElementById('setting-accent-color').value);

});



document.getElementById('setting-accent-color')?.addEventListener('input', (e) => {

  document.getElementById('setting-accent-color-text').value = e.target.value;

  applyDynamicTheme(document.getElementById('setting-primary-color').value, e.target.value);

});



function resetCentizenTheme() {

  const pri = '#0a5482';

  const acc = '#f27e20';

  document.getElementById('setting-primary-color').value = pri;

  document.getElementById('setting-primary-color-text').value = pri;

  document.getElementById('setting-accent-color').value = acc;

  document.getElementById('setting-accent-color-text').value = acc;

  applyDynamicTheme(pri, acc);

  showToast('Reset to Centizen brand colors', 'info');

}



async function uploadLogo(input) {

  if (!input.files || input.files.length === 0) return;

  const file = input.files[0];



  const formData = new FormData();

  formData.append('file', file);



  try {

    const res = await fetch('/api/settings/logo', {

      method: 'POST',

      body: formData

    });



    if (!res.ok) throw new Error('Logo upload failed');

    const data = await res.json();



    document.getElementById('header-logo').src = data.logo_url + '?t=' + Date.now();

    document.getElementById('settings-logo-preview').src = data.logo_url + '?t=' + Date.now();



    showToast('Company logo updated successfully', 'success');

  } catch (err) {

    showToast(err.message, 'error');

  }

}



async function saveSettings() {

  const payload = {

    company_name: document.getElementById('setting-company-name').value.trim(),

    primary_color: document.getElementById('setting-primary-color').value,

    accent_color: document.getElementById('setting-accent-color').value,

    shift_start_time: document.getElementById('setting-shift-start').value,

    shift_end_time: document.getElementById('setting-shift-end').value,

    late_grace_minutes: document.getElementById('setting-late-grace').value,

    full_day_hours: document.getElementById('setting-full-day-hours').value,

    half_day_hours: document.getElementById('setting-half-day-hours').value,

    auto_sync_interval_mins: document.getElementById('setting-sync-interval').value

  };



  try {

    const res = await fetch('/api/settings', {

      method: 'PUT',

      headers: { 'Content-Type': 'application/json' },

      body: JSON.stringify(payload)

    });



    if (!res.ok) throw new Error('Failed to save settings');

    showToast('Settings saved successfully', 'success');

    loadSettings();

  } catch (err) {

    showToast(err.message, 'error');

  }

}



// ================= TAB 6: DATABASE & SCHEMA =================

async function loadDatabaseData() {

  try {

    const res = await fetch('/api/database/info');

    if (!res.ok) throw new Error('Failed to load database info');

    const data = await res.json();



    const isPostgres = data.is_postgres || data.dialect.includes('POSTGRES');

    const dbName = data.database_name || (isPostgres ? data.connection_url.split('/').pop() : 'attendance.db');



    // 0. Synchronize Form Inputs with Active / Saved Connection Details

    if (data.connection_details) {

      const cd = data.connection_details;

      const hostPortInput = document.getElementById('pg-host-port');

      const dbnameInput = document.getElementById('pg-dbname-select');

      const userInput = document.getElementById('pg-user-input');

      const passInput = document.getElementById('pg-pass-input');



      if (hostPortInput && cd.host_port) {

        hostPortInput.value = cd.host_port;

      }

      if (dbnameInput && cd.dbname) {

        dbnameInput.value = cd.dbname;

      }

      if (userInput && cd.user) {

        userInput.value = cd.user;

      }

      const schemaInput = document.getElementById('pg-schema-input');

      if (schemaInput && (cd.schema || data.schema_name)) {

        schemaInput.value = cd.schema || data.schema_name || 'public';

      }

      if (passInput && cd.password !== undefined && cd.password !== null) {

        passInput.value = cd.password;

      }

    }



    // 1. KPI Cards

    const dialectEl = document.getElementById('db-stat-dialect');

    if (dialectEl) dialectEl.textContent = isPostgres ? `POSTGRESQL (${dbName})` : 'SQLITE (Default)';



    const dialectSubEl = document.getElementById('db-stat-dialect-sub');

    if (dialectSubEl) {

      if (isPostgres) {

        dialectSubEl.className = 'text-[11px] text-blue-600 font-semibold';

        dialectSubEl.textContent = `Live Server: ${data.host_endpoint || '127.0.0.1:5432'}`;

      } else {

        dialectSubEl.className = 'text-[11px] text-emerald-600 font-medium';

        dialectSubEl.textContent = 'Embedded Local Database';

      }

    }



    document.getElementById('db-stat-size').textContent = data.file_size || '--';

    document.getElementById('db-stat-tables').textContent = `${data.total_tables} Tables`;

    document.getElementById('db-stat-records').textContent = `${data.total_records} Records`;

    document.getElementById('db-connection-path').textContent = data.connection_url;

    document.getElementById('db-stat-latency').textContent = `${data.latency_ms}ms`;



    // 2. Subtitle

    const subTitle = document.getElementById('db-server-subtitle');

    const activeSchema = data.schema_name || data.connection_details?.schema || 'public';

    if (subTitle) {

      if (isPostgres) {

        subTitle.innerHTML = `<strong class="text-blue-700">PostgreSQL (local essl)</strong> &bull; Database: <strong>${dbName}</strong> &bull; Host: <strong>${data.host_endpoint || '127.0.0.1:5432'}</strong> &bull; Schema: <strong>${activeSchema}</strong>`;

      } else {

        subTitle.innerHTML = `Active: <strong>SQLite (Default Embedded Database)</strong> &bull; Schema: <strong>public</strong> &bull; File: attendance.db`;

      }

    }



    // 3. Top Status Pill

    const statusPill = document.getElementById('db-status-pill');

    if (statusPill) {

      if (data.status === 'CONNECTED') {

        if (isPostgres) {

          statusPill.className = 'inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-800 border border-blue-200';

          statusPill.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-blue-600 mr-1.5 animate-pulse"></span>CONNECTED: POSTGRESQL (${dbName})`;

        } else {

          statusPill.className = 'inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200';

          statusPill.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse"></span>CONNECTED: SQLITE (Default)';

        }

      } else {

        statusPill.className = 'inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200';

        statusPill.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-rose-500 mr-1.5"></span>DISCONNECTED';

      }

    }



    // 4. Quick Connect Box Active State Banner (#pg-active-status-bar)

    const activeDot = document.getElementById('pg-active-dot');

    const activeMsg = document.getElementById('pg-active-msg');

    const activePill = document.getElementById('pg-active-pill');

    const activeBar = document.getElementById('pg-active-status-bar');

    const btnConnect = document.getElementById('btn-pg-connect');



    if (activeBar && activeDot && activeMsg && activePill) {

      if (isPostgres) {

        activeBar.className = 'p-3 rounded-lg border text-xs flex items-center justify-between transition-all bg-emerald-50/80 border-emerald-300 shadow-xs';

        activeDot.className = 'w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse';

        activeMsg.innerHTML = `<span class="font-bold text-emerald-950">✓ CURRENT ACTIVE DB:</span> <span class="text-emerald-800">Connected to PostgreSQL ("local essl") &bull; Database: <strong>${dbName}</strong> (${data.host_endpoint || '127.0.0.1:5432'})</span>`;

        activePill.className = 'px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-600 text-white';

        activePill.textContent = 'Active Engine';

        if (btnConnect) {

          btnConnect.innerHTML = '<svg class="w-4 h-4 mr-1.5 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg><span>Active (Re-Sync)</span>';

          btnConnect.className = 'inline-flex items-center space-x-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm transition';

        }

      } else {

        activeBar.className = 'p-3 rounded-lg border text-xs flex items-center justify-between transition-all bg-slate-50 border-slate-200';

        activeDot.className = 'w-2.5 h-2.5 rounded-full bg-amber-500';

        activeMsg.innerHTML = `<span class="font-bold text-slate-800">Current Active Database:</span> <span class="text-slate-600">SQLite (attendance.db) &mdash; Enter credentials below to switch to PostgreSQL.</span>`;

        activePill.className = 'px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-200 text-slate-700';

        activePill.textContent = 'SQLite Active';

        if (btnConnect) {

          btnConnect.innerHTML = '<svg class="w-4 h-4 mr-1.5 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg><span>Connect to local essl</span>';

          btnConnect.className = 'inline-flex items-center space-x-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-sm transition';

        }

      }

    }



    // 5. Global Header DB Chip

    const headerDbDot = document.getElementById('header-db-dot');

    const headerDbText = document.getElementById('header-db-text');

    const headerDbBadge = document.getElementById('header-db-badge');

    if (headerDbBadge && headerDbDot && headerDbText) {

      if (isPostgres) {

        headerDbBadge.className = 'hidden md:inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-50 text-blue-800 border border-blue-200 shadow-xs cursor-pointer hover:bg-blue-100 transition';

        headerDbDot.className = 'w-2 h-2 rounded-full bg-blue-600 animate-pulse';

        headerDbText.textContent = `DB: PostgreSQL (${dbName})`;

      } else {

        headerDbBadge.className = 'hidden md:inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-xs cursor-pointer hover:bg-emerald-100 transition';

        headerDbDot.className = 'w-2 h-2 rounded-full bg-emerald-500 animate-pulse';

        headerDbText.textContent = 'DB: SQLite';

      }

    }



    // 6. Sidebar Bottom DB Info

    const sideDot = document.getElementById('sidebar-db-dot');

    const sideLabel = document.getElementById('sidebar-db-label');

    const sideName = document.getElementById('sidebar-db-name');

    if (sideDot && sideLabel && sideName) {

      if (isPostgres) {

        sideDot.className = 'w-2 h-2 rounded-full bg-blue-500 animate-pulse';

        sideLabel.textContent = 'DB: Postgres';

        sideName.textContent = dbName;

      } else {

        sideDot.className = 'w-2 h-2 rounded-full bg-emerald-500';

        sideLabel.textContent = 'DB: SQLite';

        sideName.textContent = 'attendance.db';

      }

    }



    renderDatabaseTables(data.tables || []);



    // Refresh live TCP port reachability

    refreshPortStatus();



  } catch (err) {

    console.error('Error loading database data:', err);

    showToast('Failed to fetch database information', 'error');

  }

}



function renderDatabaseTables(tables) {

  const container = document.getElementById('db-tables-container');

  if (!container) return;



  if (!tables || tables.length === 0) {

    container.innerHTML = '<p class="text-slate-400 py-6 text-center text-xs">No tables detected in current database</p>';

    return;

  }



  container.innerHTML = tables.map(t => `

    <div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">

      <!-- Table Header Bar -->

      <div class="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">

        <div class="flex items-center space-x-3">

          <div class="w-8 h-8 rounded-lg bg-blue-100 text-brand-navy flex items-center justify-center font-bold text-xs">

            SQL

          </div>

          <div>

            <div class="flex items-center space-x-2">

              <h4 class="font-mono text-sm font-bold text-slate-900">${t.table_name}</h4>

              <span class="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-brand-navy border border-blue-200">

                ${t.row_count} rows

              </span>

              <span class="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600">

                ${t.column_count} columns

              </span>

            </div>

            <p class="text-xs text-slate-500 mt-0.5">${t.description}</p>

          </div>

        </div>



        <button onclick="previewTableRows('${t.table_name}')" class="inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-brand-navy hover:bg-brand-navyHover text-white shadow-sm transition">

          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>

          <span>Preview Records</span>

        </button>

      </div>



      <!-- Columns Schema Subtable -->

      <div class="overflow-x-auto">

        <table class="min-w-full divide-y divide-slate-100 text-[11px]">

          <thead class="bg-white text-slate-500 font-semibold uppercase tracking-wider border-b border-slate-100">

            <tr>

              <th class="px-4 py-2 text-left">Column Name</th>

              <th class="px-4 py-2 text-left">SQL Data Type</th>

              <th class="px-4 py-2 text-center">Primary Key</th>

              <th class="px-4 py-2 text-center">Nullable</th>

              <th class="px-4 py-2 text-left">Default Value</th>

            </tr>

          </thead>

          <tbody class="divide-y divide-slate-50 text-slate-700 bg-white">

            ${t.columns.map(c => `

              <tr class="hover:bg-slate-50">

                <td class="px-4 py-2 font-mono font-semibold text-slate-900">${c.name}</td>

                <td class="px-4 py-2 font-mono text-blue-700">${c.type}</td>

                <td class="px-4 py-2 text-center">

                  ${c.primary_key ? '<span class="inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">PK</span>' : '<span class="text-slate-300">-</span>'}

                </td>

                <td class="px-4 py-2 text-center">

                  ${c.nullable ? '<span class="text-slate-500">YES</span>' : '<span class="font-bold text-slate-800">NO</span>'}

                </td>

                <td class="px-4 py-2 font-mono text-slate-400">${c.default || '--'}</td>

              </tr>

            `).join('')}

          </tbody>

        </table>

      </div>

    </div>

  `).join('');

}



async function previewTableRows(tableName) {

  try {

    const res = await fetch(`/api/database/table/${tableName}/rows?limit=25`);

    if (!res.ok) throw new Error('Could not load table rows');

    const data = await res.json();



    document.getElementById('modal-table-title').textContent = `Table: ${data.table_name}`;

    document.getElementById('modal-table-subtitle').textContent = `Previewing latest ${data.total_returned} records from default schema`;

    document.getElementById('modal-table-row-count').textContent = `Total rows displayed: ${data.total_returned}`;



    const thead = document.getElementById('modal-preview-thead');

    thead.innerHTML = `<tr>${data.columns.map(c => `<th class="px-3 py-2 text-left font-mono font-bold">${c}</th>`).join('')}</tr>`;



    const tbody = document.getElementById('modal-preview-tbody');

    if (!data.rows || data.rows.length === 0) {

      tbody.innerHTML = `<tr><td colspan="${data.columns.length}" class="text-center py-6 text-slate-400">Table currently has no records</td></tr>`;

    } else {

      tbody.innerHTML = data.rows.map(r => `

        <tr class="hover:bg-slate-50">

          ${data.columns.map(c => `<td class="px-3 py-2 font-mono text-[11px] text-slate-700 truncate max-w-[180px]">${r[c] !== null && r[c] !== undefined ? r[c] : '<span class="text-slate-300">NULL</span>'}</td>`).join('')}

        </tr>

      `).join('');

    }



    openModal('modal-table-data');



  } catch (err) {

    showToast(`Failed to preview ${tableName}: ${err.message}`, 'error');

  }

}



function applyDbPreset(preset) {

  const input = document.getElementById('db-connection-input');

  if (preset === 'sqlite_default') {

    input.value = 'sqlite:///attendance.db';

  } else if (preset === 'postgresql') {

    input.value = 'postgresql+psycopg://postgres:password@localhost:5432/attendance_db';

  } else if (preset === 'mysql') {

    input.value = 'mysql+pymysql://root:password@localhost:3306/attendance_db';

  } else {

    input.value = '';

  }

}



async function testCustomDbConnection() {

  const url = document.getElementById('db-connection-input').value.trim();

  const banner = document.getElementById('db-test-result');

  banner.classList.remove('hidden', 'bg-emerald-50', 'text-emerald-800', 'border', 'border-emerald-200', 'bg-rose-50', 'text-rose-800', 'border-rose-200');



  banner.className = 'p-3 rounded-lg text-xs bg-slate-100 text-slate-700';

  banner.textContent = 'Testing connection...';



  try {

    const res = await fetch('/api/database/test-connection', {

      method: 'POST',

      headers: { 'Content-Type': 'application/json' },

      body: JSON.stringify({ connection_url: url })

    });

    const data = await res.json();



    if (data.success) {

      banner.className = 'p-3 rounded-lg text-xs bg-emerald-50 text-emerald-800 border border-emerald-200';

      banner.textContent = data.message;

    } else {

      banner.className = 'p-3 rounded-lg text-xs bg-rose-50 text-rose-800 border border-rose-200';

      banner.textContent = data.message;

    }

  } catch (err) {

    banner.className = 'p-3 rounded-lg text-xs bg-rose-50 text-rose-800 border border-rose-200';

    banner.textContent = `Test failed: ${err.message}`;

  }

}



function saveDbPreset() {

  closeModal('modal-db-config');

  showToast('Database connection settings applied', 'success');

  loadDatabaseData();

}



function updatePortBadge(isOpen, port = 5432, host = '') {

  const dot = document.getElementById('pg-port-dot');

  const text = document.getElementById('pg-port-text');

  const btn = document.getElementById('pg-port-badge-btn');

  if (!dot || !text || !btn) return;



  const hostLabel = (host && host !== '127.0.0.1' && host !== 'localhost') ? ` (${host})` : '';



  if (isOpen) {

    dot.className = 'w-2 h-2 rounded-full bg-emerald-500 animate-pulse';

    text.textContent = `Port ${port}${hostLabel}: Active`;

    btn.className = 'text-xs font-mono px-2.5 py-1 rounded-md font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 transition flex items-center gap-1.5 cursor-pointer';

    btn.title = `Port ${port} on ${host || '127.0.0.1'} is active and accepting connections (Click to re-test)`;

  } else {

    dot.className = 'w-2 h-2 rounded-full bg-rose-500';

    text.textContent = `Port ${port}${hostLabel}: Offline`;

    btn.className = 'text-xs font-mono px-2.5 py-1 rounded-md font-semibold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition flex items-center gap-1.5 cursor-pointer';

    btn.title = `Port ${port} on ${host || '127.0.0.1'} is closed or unreachable (Click to re-test)`;

  }

}



async function refreshPortStatus() {

  const hostPortInput = document.getElementById('pg-host-port')?.value.trim() || '127.0.0.1:5432';

  let host = '127.0.0.1';

  let port = 5432;

  if (hostPortInput.includes(':')) {

    const parts = hostPortInput.split(':');

    host = parts[0].trim() || '127.0.0.1';

    port = parseInt(parts[1], 10) || 5432;

  } else {

    host = hostPortInput;

  }



  const dot = document.getElementById('pg-port-dot');

  const text = document.getElementById('pg-port-text');

  if (dot && text) {

    dot.className = 'w-2 h-2 rounded-full bg-amber-400 animate-pulse';

    text.textContent = `Port ${port}: Checking...`;

  }



  try {

    const res = await fetch(`/api/database/port-status?host=${encodeURIComponent(host)}&port=${port}`);

    if (res.ok) {

      const data = await res.json();

      updatePortBadge(data.is_open, data.port, data.host);

    }

  } catch (e) {

    updatePortBadge(false, port, host);

  }

}



function togglePgPasswordVisibility() {

  const passInput = document.getElementById('pg-pass-input');

  const eyeIcon = document.getElementById('pg-pass-icon-eye');

  if (!passInput) return;



  if (passInput.type === 'password') {

    passInput.type = 'text';

    if (eyeIcon) {

      eyeIcon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18"></path>';

    }

  } else {

    passInput.type = 'password';

    if (eyeIcon) {

      eyeIcon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>';

    }

  }

}



async function checkActiveDbConnection() {

  const btn = document.getElementById('btn-check-active-db');

  const origHtml = btn ? btn.innerHTML : '';

  if (btn) {

    btn.disabled = true;

    btn.innerHTML = '<span class="inline-block animate-spin mr-1">↻</span> Testing...';

  }



  try {

    const res = await fetch('/api/database/check-active', { method: 'POST' });

    const data = await res.json();

    if (data.success) {

      document.getElementById('db-stat-latency').textContent = `${data.latency_ms}ms`;

      showToast(data.message, 'success');

      loadDatabaseData();

    } else {

      showToast(data.message, 'error');

    }

  } catch (err) {

    showToast(`Active DB check failed: ${err.message}`, 'error');

  } finally {

    if (btn) {

      btn.disabled = false;

      btn.innerHTML = origHtml;

    }

  }

}



async function checkPostgresConnection() {

  const hostPortInput = document.getElementById('pg-host-port')?.value.trim() || '127.0.0.1:5432';

  let host = '127.0.0.1';

  let port = 5432;

  if (hostPortInput.includes(':')) {

    const parts = hostPortInput.split(':');

    host = parts[0].trim() || '127.0.0.1';

    port = parseInt(parts[1], 10) || 5432;

  } else {

    host = hostPortInput;

  }



  const dbname = document.getElementById('pg-dbname-select')?.value.trim() || 'attendance';

  const schema = document.getElementById('pg-schema-input')?.value.trim() || 'public';

  const user = document.getElementById('pg-user-input')?.value.trim() || 'postgres';

  const password = document.getElementById('pg-pass-input')?.value || '';

  const btn = document.getElementById('btn-pg-check');

  const feedback = document.getElementById('pg-connect-feedback');



  const origBtnContent = btn ? btn.innerHTML : '';

  if (btn) {

    btn.disabled = true;

    btn.innerHTML = '<span class="inline-block animate-spin mr-1">↻</span> Checking Connection...';

  }



  feedback.classList.remove('hidden');

  feedback.className = 'p-3.5 rounded-xl text-xs bg-blue-50 text-blue-900 border border-blue-200 animate-fadeIn';

  feedback.innerHTML = `

    <div class="flex items-center space-x-2">

      <span class="inline-block animate-spin text-blue-600 font-bold">↻</span>

      <span class="font-medium">Testing connection to <strong>${host}:${port}</strong> (database: <strong>${dbname}</strong>, schema: <strong>${schema}</strong>, user: <strong>${user}</strong>)...</span>

    </div>

  `;



  try {

    const res = await fetch('/api/database/check-connection', {

      method: 'POST',

      headers: { 'Content-Type': 'application/json' },

      body: JSON.stringify({

        host: host,

        port: port,

        dbname: dbname,

        schema_name: schema,

        user: user,

        password: password,

        engine_type: 'postgres'

      })

    });



    let data;

    try {

      data = await res.json();

    } catch (parseErr) {

      throw new Error(`Server error (${res.status}: ${res.statusText || 'Check failed'})`);

    }



    // Update port reachability badge

    updatePortBadge(data.port_open, port, host);



    if (data.success) {

      feedback.className = 'p-4 rounded-xl text-xs bg-emerald-50 text-emerald-950 border border-emerald-300 shadow-xs space-y-2.5 animate-fadeIn';

      feedback.innerHTML = `

        <div class="flex items-center justify-between">

          <div class="flex items-center space-x-2">

            <span class="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs">✓</span>

            <span class="font-bold text-emerald-900 text-sm">PostgreSQL Connection Verified!</span>

          </div>

          <span class="font-mono bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded text-[11px] font-bold">${data.latency_ms} ms</span>

        </div>

        <p class="text-emerald-800 font-medium">${data.message}</p>

        <div class="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-2 border-t border-emerald-200 text-[11px] font-mono text-emerald-900">

          <div><span class="text-emerald-600 font-sans block text-[10px] font-semibold">SERVER ENDPOINT</span>${data.host}:${data.port}</div>

          <div><span class="text-emerald-600 font-sans block text-[10px] font-semibold">DATABASE NAME</span>${data.database}</div>

          <div><span class="text-emerald-600 font-sans block text-[10px] font-semibold">TARGET SCHEMA</span>${data.schema || schema}</div>

          <div><span class="text-emerald-600 font-sans block text-[10px] font-semibold">SERVER VERSION</span>${data.server_version || 'PostgreSQL'}</div>

          <div><span class="text-emerald-600 font-sans block text-[10px] font-semibold">EXISTING TABLES</span>${data.table_count} tables</div>

        </div>

        ${data.tables && data.tables.length > 0 ? `

          <div class="text-[11px] text-emerald-800 pt-1">

            <strong>Detected Tables:</strong> <span class="font-mono text-slate-700">${data.tables.join(', ')}</span>

          </div>

        ` : `

          <div class="text-[11px] text-emerald-700 pt-1">

            Database is currently empty. Clicking "Connect to local essl" will automatically initialize the schema and tables.

          </div>

        `}

        <div class="pt-2 flex items-center justify-between border-t border-emerald-200/60">

          <span class="text-emerald-700 text-[11px]">Ready to activate: Click <strong>"Connect to local essl"</strong> to switch the active database.</span>

        </div>

      `;

      showToast('Database connection check passed!', 'success');

    } else {

      feedback.className = 'p-4 rounded-xl text-xs bg-rose-50 text-rose-950 border border-rose-300 shadow-xs space-y-2.5 animate-fadeIn';

      feedback.innerHTML = `

        <div class="flex items-center justify-between">

          <div class="flex items-center space-x-2">

            <span class="w-5 h-5 rounded-full bg-rose-600 text-white flex items-center justify-center font-bold text-xs">✕</span>

            <span class="font-bold text-rose-900 text-sm">Connection Check Failed</span>

          </div>

          <span class="font-mono bg-rose-100 text-rose-800 px-2 py-0.5 rounded text-[11px] font-bold">${data.status || 'UNREACHABLE'}</span>

        </div>

        <p class="font-semibold text-rose-900">${data.message}</p>

        ${data.suggestion ? `

          <div class="p-2.5 bg-white/80 rounded-lg border border-rose-200 text-rose-800 text-[11px] space-y-1">

            <span class="font-bold block text-slate-800">💡 Diagnostic Advice:</span>

            <span>${data.suggestion}</span>

          </div>

        ` : ''}

        ${data.raw_error ? `

          <details class="text-[11px] font-mono text-rose-700 cursor-pointer pt-1">

            <summary class="hover:underline">View technical details</summary>

            <pre class="mt-1 p-2 bg-rose-100/70 rounded text-[10px] overflow-x-auto whitespace-pre-wrap">${data.raw_error}</pre>

          </details>

        ` : ''}

      `;

      showToast(data.message, 'error');

    }

  } catch (err) {

    feedback.className = 'p-4 rounded-xl text-xs bg-rose-50 text-rose-950 border border-rose-300 shadow-xs';

    feedback.innerHTML = `

      <div class="flex items-center space-x-2 font-bold text-rose-900">

        <span class="w-5 h-5 rounded-full bg-rose-600 text-white flex items-center justify-center text-xs">✕</span>

        <span>Check request failed: ${err.message}</span>

      </div>

    `;

    showToast(`Check failed: ${err.message}`, 'error');

  } finally {

    if (btn) {

      btn.disabled = false;

      btn.innerHTML = origBtnContent;

    }

  }

}



async function refreshDatabaseView() {

  const btn = document.getElementById('btn-refresh-db-view');

  const icon = document.getElementById('db-refresh-icon');

  const text = document.getElementById('db-refresh-text');



  if (btn) btn.disabled = true;

  if (icon) icon.classList.add('animate-spin');

  if (text) text.textContent = 'Refreshing...';



  try {

    await loadDatabaseData();

    await refreshPortStatus();

    showToast('Database schema and records refreshed!', 'success');

  } catch (err) {

    showToast(`Refresh error: ${err.message}`, 'error');

  } finally {

    if (btn) btn.disabled = false;

    if (icon) icon.classList.remove('animate-spin');

    if (text) text.textContent = 'Refresh Data';

  }

}



async function connectPostgres(event) {

  if (event) event.preventDefault();

  const hostPortInput = document.getElementById('pg-host-port')?.value.trim() || '127.0.0.1:5432';

  let host = '127.0.0.1';

  let port = 5432;

  if (hostPortInput.includes(':')) {

    const parts = hostPortInput.split(':');

    host = parts[0].trim() || '127.0.0.1';

    port = parseInt(parts[1], 10) || 5432;

  } else {

    host = hostPortInput;

  }



  const dbname = document.getElementById('pg-dbname-select').value.trim() || 'attendance';

  const schema = document.getElementById('pg-schema-input')?.value.trim() || 'public';

  const user = document.getElementById('pg-user-input').value.trim() || 'postgres';

  const password = document.getElementById('pg-pass-input').value;

  const btn = document.getElementById('btn-pg-connect');

  const feedback = document.getElementById('pg-connect-feedback');



  if (btn) {

    btn.disabled = true;

    btn.innerHTML = '<span class="inline-block animate-spin mr-1">↻</span> Connecting...';

  }

  if (feedback) {

    feedback.classList.remove('hidden');

    feedback.className = 'p-4 rounded-xl text-xs bg-blue-50 text-blue-900 border border-blue-200 shadow-xs space-y-3 animate-fadeIn';

    feedback.innerHTML = `

      <div class="flex items-center space-x-2 font-bold text-sm text-blue-950">

        <span class="inline-block animate-spin text-blue-600 text-base">↻</span>

        <span>Connecting to Database: <strong>${dbname}</strong> (Schema: <strong>${schema}</strong>)...</span>

      </div>

      <div class="space-y-1.5 text-[11px] text-slate-700 bg-white/70 p-3 rounded-lg border border-blue-100">

        <div class="flex items-center space-x-2 text-blue-800 font-semibold">

          <span class="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></span>

          <span>Step 1: Connecting to PostgreSQL on <strong>${host}:${port}</strong>...</span>

        </div>

        <div class="flex items-center space-x-2 text-slate-500">

          <span class="w-2 h-2 rounded-full bg-slate-300"></span>

          <span>Step 2: Creating & verifying target schema '<strong>${schema}</strong>' (5 tables: shifts, devices, employees, attendance_punches, settings)...</span>

        </div>

        <div class="flex items-center space-x-2 text-slate-500">

          <span class="w-2 h-2 rounded-full bg-slate-300"></span>

          <span>Step 3: Initializing biometric devices (Door 1 - 4) & punch synchronization...</span>

        </div>

      </div>

    `;

  }



  try {

    const res = await fetch('/api/database/connect-postgres', {

      method: 'POST',

      headers: { 'Content-Type': 'application/json' },

      body: JSON.stringify({

        host: host,

        port: port,

        dbname: dbname,

        user: user,

        password: password,

        schema_name: schema

      })

    });



    let data;

    try {

      data = await res.json();

    } catch (parseErr) {

      throw new Error(`Server error (${res.status}: ${res.statusText || 'Connection failed'})`);

    }

    if (!res.ok) throw new Error(data.detail || 'Connection failed');



    if (feedback) {

      feedback.className = 'p-4 rounded-xl text-xs bg-emerald-50 text-emerald-950 border border-emerald-300 shadow-xs space-y-3 animate-fadeIn';

      feedback.innerHTML = `

        <div class="flex items-center justify-between border-b border-emerald-200 pb-2.5">

          <div class="flex items-center space-x-2 font-bold text-emerald-900 text-sm">

            <span class="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs">✓</span>

            <span>Connected to Database: <span class="font-mono">${dbname}</span></span>

          </div>

          <button type="button" onclick="refreshDatabaseView()" class="inline-flex items-center space-x-1.5 px-3 py-1 rounded-lg bg-brand-navy hover:bg-brand-navyHover text-white font-semibold text-xs shadow-xs transition cursor-pointer" title="Refresh database view and table counts">

            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>

            <span>Refresh Data</span>

          </button>

        </div>



        <!-- Default Schema Creation Confirmation -->

        <div class="bg-white/85 p-3 rounded-lg border border-emerald-200 space-y-1">

          <div class="flex items-center space-x-2">

            <span class="w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] font-bold">✓</span>

            <strong class="text-emerald-950">Default Schema Created & Verified</strong>

            <span class="text-[10px] px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-mono font-bold">5 Tables Active</span>

          </div>

          <p class="text-[11px] text-emerald-800 pl-6">

            ${data.schema_message || "Default tables (shifts, devices, employees, attendance_punches, settings) successfully created in schema 'public'."}

          </p>

        </div>



        <!-- Biometric Sync Status Confirmation -->

        <div id="pg-sync-status-card" class="bg-white/85 p-3 rounded-lg border border-blue-200 space-y-1">

          <div class="flex items-center space-x-2">

            <span id="pg-sync-status-icon" class="w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold">↻</span>

            <strong id="pg-sync-status-title" class="text-slate-900">Syncing Biometric Devices & Attendance Logs...</strong>

          </div>

          <p id="pg-sync-status-msg" class="text-[11px] text-slate-600 pl-6">

            Registering 4 eSSL devices (Door 1, Door 2, Door 3, Door 4) and syncing biometric punch logs into database <strong>${dbname}</strong>...

          </p>

        </div>



        <div class="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-emerald-200/60">

          <span>Server: <strong>${host}:${port}</strong> &bull; Dialect: PostgreSQL</span>

          <span>Click <strong>Refresh Data</strong> to update live table row counts</span>

        </div>

      `;

    }



    showToast(`Connected to PostgreSQL (${dbname})! Default schema created.`, 'success');



    // Reload all dashboard and schema data

    loadDatabaseData();

    loadDashboardData();

    loadDevicesData();



    // Trigger initial punch sync into new DB in background

    fetch('/api/devices/sync-all', { method: 'POST' })

      .then(r => r.json())

      .then(syncRes => {

        const syncCard = document.getElementById('pg-sync-status-card');

        const syncTitle = document.getElementById('pg-sync-status-title');

        const syncMsg = document.getElementById('pg-sync-status-msg');

        const syncIcon = document.getElementById('pg-sync-status-icon');

        if (syncCard && syncTitle && syncMsg && syncIcon) {

          syncCard.className = 'bg-white/85 p-3 rounded-lg border border-emerald-300 space-y-1';

          syncIcon.className = 'w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] font-bold';

          syncIcon.textContent = '✓';

          syncTitle.className = 'text-emerald-950 font-bold';

          syncTitle.textContent = 'Biometric Sync Complete!';

          syncMsg.className = 'text-[11px] text-emerald-800 pl-6';

          syncMsg.innerHTML = `Successfully synchronized 4 eSSL devices into <strong>${dbname}</strong>! Total punches recorded: <strong>${syncRes.total_new_punches || 0}</strong> new punches.`;

        }

        loadDatabaseData();

        loadDashboardData();

      })

      .catch(err => {

        console.warn('Initial sync notice:', err);

        loadDatabaseData();

      });



  } catch (err) {

    if (feedback) {

      feedback.className = 'p-4 rounded-xl text-xs bg-rose-50 text-rose-950 border border-rose-300 shadow-xs space-y-2';

      feedback.innerHTML = `

        <div class="flex items-center space-x-2 font-bold text-rose-900 text-sm">

          <span class="w-5 h-5 rounded-full bg-rose-600 text-white flex items-center justify-center text-xs">✕</span>

          <span>Database Connection Failed</span>

        </div>

        <p class="text-rose-800">${err.message}</p>

      `;

    }

    showToast(err.message, 'error');

  } finally {

    if (btn) {

      btn.disabled = false;

      btn.innerHTML = `<svg class="w-4 h-4 mr-1.5 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg><span>Connect to local essl</span>`;

    }

  }

}



async function switchToDefaultSqlite() {

  if (!confirm('Switch database back to default embedded SQLite (attendance.db)?')) return;



  const feedback = document.getElementById('pg-connect-feedback');

  try {

    const res = await fetch('/api/database/use-default-sqlite', { method: 'POST' });

    if (!res.ok) throw new Error('Failed to switch database');

    showToast('Switched to default SQLite database', 'info');

    if (feedback) {

      feedback.classList.remove('hidden');

      feedback.className = 'p-4 rounded-xl text-xs bg-emerald-50 text-emerald-950 border border-emerald-300 shadow-xs space-y-2 animate-fadeIn';

      feedback.innerHTML = `

        <div class="flex items-center justify-between">

          <div class="flex items-center space-x-2 font-bold text-emerald-900">

            <span class="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs">✓</span>

            <span>Switched to Default SQLite Database (attendance.db)</span>

          </div>

          <button type="button" onclick="refreshDatabaseView()" class="inline-flex items-center space-x-1.5 px-3 py-1 rounded-lg bg-brand-navy hover:bg-brand-navyHover text-white font-semibold text-xs shadow-xs transition cursor-pointer">

            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>

            <span>Refresh Data</span>

          </button>

        </div>

        <p class="text-[11px] text-emerald-800">

          Default schema tables active. Biometric device logs are now syncing with local <strong>attendance.db</strong>.

        </p>

      `;

    }

    loadDatabaseData();

    loadDashboardData();

    loadDevicesData();

  } catch (err) {

    showToast(err.message, 'error');

  }

}



async function resetDefaultSchema() {

  if (!confirm('This will ensure all default schema tables (punches, devices, employees, settings) are verified and initialized. Proceed?')) return;



  try {

    const res = await fetch('/api/database/reset-default-schema', { method: 'POST' });

    if (!res.ok) throw new Error('Reset failed');

    showToast('Default schema verified and re-initialized!', 'success');

    loadDatabaseData();

    loadDashboardData();

  } catch (err) {

    showToast(`Error: ${err.message}`, 'error');

  }

}



// ================= SHIFT MANAGEMENT =================

let allShiftsCache = [];



function populateAllShiftDropdowns(shifts) {
  if (!shifts || shifts.length === 0) return;

  // 1. Bulk Assign dropdown in Shift Management: #quick-assign-shift-code
  const quickAssignSelect = document.getElementById('quick-assign-shift-code');
  if (quickAssignSelect) {
    const currentVal = quickAssignSelect.value;
    quickAssignSelect.innerHTML = shifts.map(s => {
      const timingPart = (s.start_time && s.end_time && s.start_time !== '00:00') ? ` (${s.start_time} - ${s.end_time})` : '';
      return `<option value="${s.code}">${s.name}${s.name.includes('(') ? '' : timingPart}</option>`;
    }).join('');
    if (currentVal && shifts.some(s => s.code === currentVal)) {
      quickAssignSelect.value = currentVal;
    }
  }

  // 2. Employee Add/Edit modal shift select: #emp-form-shift-select
  const empFormSelect = document.getElementById('emp-form-shift-select');
  if (empFormSelect) {
    const currentVal = empFormSelect.value;
    empFormSelect.innerHTML = shifts.map(s => {
      const timingPart = (s.start_time && s.end_time && s.start_time !== '00:00') ? ` (${s.start_time} - ${s.end_time})` : '';
      return `<option value="${s.code}" data-start="${s.start_time}" data-end="${s.end_time}">${s.name}${s.name.includes('(') ? '' : timingPart}</option>`;
    }).join('');
    if (currentVal && shifts.some(s => s.code === currentVal)) {
      empFormSelect.value = currentVal;
    }
  }

  // 3. Daily Report filter: #report-shift-select
  const reportShiftSelect = document.getElementById('report-shift-select');
  if (reportShiftSelect) {
    const currentVal = reportShiftSelect.value;
    reportShiftSelect.innerHTML = `<option value="ALL">All Shifts</option>` + shifts.map(s => {
      const timingPart = (s.start_time && s.end_time && s.start_time !== '00:00') ? ` (${s.start_time} - ${s.end_time})` : '';
      return `<option value="${s.code}">${s.name}${s.name.includes('(') ? '' : timingPart}</option>`;
    }).join('');
    if (currentVal) reportShiftSelect.value = currentVal;
  }

  // 4. Monthly Attendance Report filter: #monthly-shift-select
  const monthlyShiftSelect = document.getElementById('monthly-shift-select');
  if (monthlyShiftSelect) {
    const currentVal = monthlyShiftSelect.value;
    monthlyShiftSelect.innerHTML = `<option value="ALL">All Shifts</option>` + shifts.map(s => {
      const timingPart = (s.start_time && s.end_time && s.start_time !== '00:00') ? ` (${s.start_time} - ${s.end_time})` : '';
      return `<option value="${s.code}">${s.name}${s.name.includes('(') ? '' : timingPart}</option>`;
    }).join('');
    if (currentVal) monthlyShiftSelect.value = currentVal;
  }

  // 5. Permission filter: #exceeded-shift-select
  const exceededShiftSelect = document.getElementById('exceeded-shift-select');
  if (exceededShiftSelect) {
    const currentVal = exceededShiftSelect.value;
    exceededShiftSelect.innerHTML = `<option value="ALL">All Applicable Shifts</option>` + shifts.map(s => {
      const timingPart = (s.start_time && s.end_time && s.start_time !== '00:00') ? ` (${s.start_time} - ${s.end_time})` : '';
      return `<option value="${s.code}">${s.name}${s.name.includes('(') ? '' : timingPart}</option>`;
    }).join('');
    if (currentVal) exceededShiftSelect.value = currentVal;
  }
}

async function loadShiftsData() {

  try {

    const res = await fetch('/api/shifts');

    if (!res.ok) throw new Error('Failed to load shifts');

    const data = await res.json();



    allShiftsCache = data.shifts || [];

    renderShiftsCards(allShiftsCache);
    populateAllShiftDropdowns(allShiftsCache);



    // If employees not loaded yet, fetch them

    if (!allEmployeesCache || allEmployeesCache.length === 0) {

      const empRes = await fetch('/api/employees');

      if (empRes.ok) {

        const empData = await empRes.json();

        allEmployeesCache = sortRecordsByName(empData.employees || [], employeeSortOrder);

      }

    }

    renderShiftAssignmentTable(allEmployeesCache, allShiftsCache);



  } catch (err) {

    console.error('Error loading shifts:', err);

    showToast('Failed to load shift information', 'error');

  }

}



function renderShiftsCards(shifts) {

  const container = document.getElementById('shifts-cards-grid');

  if (!container) return;



  if (!shifts || shifts.length === 0) {

    container.innerHTML = '<p class="text-slate-400 py-6 text-center text-xs">No shifts configured</p>';

    return;

  }



  container.innerHTML = shifts.map(s => {

    let cardBadge = 'bg-blue-50 text-brand-navy border-blue-200';

    let durationText = '9 Hours';

    let iconBg = 'bg-blue-100 text-brand-navy';

    let iconChar = '☀️';

    let shiftBadgeText = 'Day Shift';



    if (s.code === 'SHIFT_WFH' || (s.name && s.name.toUpperCase().includes('WFH'))) {

      cardBadge = 'bg-emerald-50 text-emerald-800 border-emerald-200';

      durationText = 'Remote / Flexible (9 Hours)';

      iconBg = 'bg-emerald-100 text-emerald-800';

      iconChar = '🏠';

      shiftBadgeText = 'WFH / Remote';

    } else if (s.is_night_shift) {

      cardBadge = 'bg-indigo-50 text-indigo-700 border-indigo-200';

      durationText = '9 Hours (Overnight Next-Day)';

      iconBg = 'bg-indigo-100 text-indigo-700';

      iconChar = '🌙';

      shiftBadgeText = 'Night Shift';

    } else if (s.end_time === '19:00') {

      cardBadge = 'bg-amber-50 text-amber-800 border-amber-200';

      durationText = '10 Hours';

      iconBg = 'bg-amber-100 text-amber-800';

      iconChar = '☀️';

      shiftBadgeText = 'Day Shift';

    }



    return `

      <div class="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex flex-col justify-between hover:border-brand-navy transition">

        <div>

          <div class="flex items-start justify-between">

            <div class="w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center font-bold text-sm">

              ${iconChar}

            </div>

            <span class="inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold border ${cardBadge}">

              ${shiftBadgeText}

            </span>

          </div>



          <div class="mt-4">

            <h3 class="text-sm font-bold text-slate-900">${s.name}</h3>

            <p class="text-[11px] font-mono text-slate-500 mt-0.5">Code: ${s.code}</p>

          </div>



          <div class="mt-4 p-3 bg-slate-50 rounded-lg border border-slate-100 space-y-1.5 text-xs">

            <div class="flex items-center justify-between">

              <span class="text-slate-400">Timings:</span>

              <strong class="font-mono text-slate-800">${s.timing_display}</strong>

            </div>

            <div class="flex items-center justify-between">

              <span class="text-slate-400">Duration:</span>

              <span class="font-semibold text-slate-700">${durationText}</span>

            </div>

            <div class="flex items-center justify-between pt-1 border-t border-slate-200">

              <span class="text-slate-400">Assigned Staff:</span>

              <span class="inline-flex px-2 py-0.5 rounded-full text-[11px] font-bold bg-white border border-slate-200 text-brand-navy">

                ${s.assigned_employee_count || 0} employees

              </span>

            </div>

          </div>



          ${s.description ? `<p class="mt-2 text-[11px] text-slate-400 italic">${s.description}</p>` : ''}

        </div>



        <div class="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between">

          <button onclick="editShift(${s.id})" class="text-xs font-semibold text-brand-navy hover:underline">

            Edit Shift

          </button>

          <span class="text-[11px] text-slate-400">Active</span>

        </div>

      </div>

    `;

  }).join('');

}



function renderShiftAssignmentTable(employees, shifts) {

  const tbody = document.getElementById('shift-assignment-tbody');

  if (!tbody) return;



  if (!employees || employees.length === 0) {

    tbody.innerHTML = '<tr><td colspan="6" class="px-4 py-6 text-center text-slate-400">No employees available</td></tr>';

    return;

  }



  const shiftOptions = (shifts || []).map(s => `<option value="${s.code}">${s.name}</option>`).join('');



  tbody.innerHTML = employees.map(e => `

    <tr class="hover:bg-slate-50 transition">

      <td class="px-4 py-3">

        <input type="checkbox" value="${e.emp_code}" class="emp-shift-checkbox rounded text-brand-navy">

      </td>

      <td class="px-4 py-3 font-mono font-bold text-slate-800">${e.emp_code}</td>

      <td class="px-4 py-3 font-medium text-slate-900">${e.name}</td>


      <td class="px-4 py-3 text-center">

        <span class="inline-flex px-2.5 py-0.5 rounded-md text-[11px] font-semibold ${

          (e.shift_code === 'SHIFT_WFH' || (e.shift_name && e.shift_name.toUpperCase().includes('WFH')))

            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'

            : (e.shift_code === 'SHIFT_NIGHT' || (e.shift_name && e.shift_name.toLowerCase().includes('night')))

            ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'

            : (e.shift_name && e.shift_name.includes('07:00'))

            ? 'bg-amber-50 text-amber-800 border border-amber-200'

            : 'bg-blue-50 text-brand-navy border border-blue-200'

        }">

          ${e.shift_name || 'Standard Shift (09:00 AM - 06:00 PM)'}

        </span>

      </td>

      <td class="px-4 py-3 text-right">

        <select onchange="quickChangeEmpShift('${e.emp_code}', this.value)" class="text-xs px-2 py-1 rounded border border-slate-300 bg-white">

          ${(shifts || []).map(s => { const t = (s.start_time && s.end_time && s.start_time !== '00:00') ? ` (${s.start_time} - ${s.end_time})` : ''; return `<option value="${s.code}" ${s.code === e.shift_code ? 'selected' : ''}>${s.name}${s.name.includes('(') ? '' : t}</option>`; }).join('')}

        </select>

      </td>

    </tr>

  `).join('');

}



function toggleSelectAllEmployeesForShift(masterCb) {

  document.querySelectorAll('.emp-shift-checkbox').forEach(cb => {

    cb.checked = masterCb.checked;

  });

}



async function applyQuickShiftAssignment() {

  const shiftCode = document.getElementById('quick-assign-shift-code').value;

  const checked = Array.from(document.querySelectorAll('.emp-shift-checkbox:checked')).map(cb => cb.value);



  if (checked.length === 0) {

    showToast('Please select at least one employee from the list', 'warning');

    return;

  }



  try {

    const res = await fetch('/api/shifts/assign', {

      method: 'POST',

      headers: { 'Content-Type': 'application/json' },

      body: JSON.stringify({

        shift_code: shiftCode,

        emp_codes: checked

      })

    });



    if (!res.ok) throw new Error('Failed to assign shifts');

    const data = await res.json();

    showToast(data.message, 'success');



    // Reload

    loadShiftsData();

    loadEmployeesData();

    loadDailyReport();



  } catch (err) {

    showToast(err.message, 'error');

  }

}



async function quickChangeEmpShift(empCode, shiftCode) {

  try {

    const res = await fetch('/api/shifts/assign', {

      method: 'POST',

      headers: { 'Content-Type': 'application/json' },

      body: JSON.stringify({

        shift_code: shiftCode,

        emp_codes: [empCode]

      })

    });



    if (!res.ok) throw new Error('Failed to change shift');

    showToast(`Shift updated for employee ${empCode}`, 'success');

    loadShiftsData();

    loadDailyReport();

  } catch (err) {

    showToast(err.message, 'error');

  }

}



function openAddShiftModal() {
  document.getElementById('modal-shift-title').textContent = 'Create New Shift';
  document.getElementById('shift-form-id').value = '';
  document.getElementById('shift-form-code').disabled = false;
  document.getElementById('shift-form').reset();
  document.getElementById('shift-form-start').value = '09:00';
  document.getElementById('shift-form-end').value = '18:00';
  openModal('modal-shift');
}

function autoSuggestShiftCode(name) {
  const codeEl = document.getElementById('shift-form-code');
  if (codeEl && !codeEl.disabled && (!codeEl.value || codeEl.dataset.isAuto !== 'false')) {
    const slug = name.trim().toUpperCase().replace(/[^A-Z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
    if (slug) {
      codeEl.value = slug.startsWith('SHIFT_') ? slug : 'SHIFT_' + slug;
      codeEl.dataset.isAuto = 'true';
    }
  }
}



function editShift(shiftId) {

  const shift = allShiftsCache.find(s => s.id === shiftId);

  if (!shift) return;



  document.getElementById('modal-shift-title').textContent = `Edit Shift: ${shift.name}`;

  document.getElementById('shift-form-id').value = shift.id;

  document.getElementById('shift-form-name').value = shift.name;

  document.getElementById('shift-form-code').value = shift.code;

  document.getElementById('shift-form-code').disabled = true;

  document.getElementById('shift-form-start').value = shift.start_time;

  document.getElementById('shift-form-end').value = shift.end_time;

  document.getElementById('shift-form-is-night').checked = shift.is_night_shift;

  document.getElementById('shift-form-desc').value = shift.description || '';



  openModal('modal-shift');

}



async function submitShiftForm(event) {

  event.preventDefault();

  const shiftId = document.getElementById('shift-form-id').value;

  const isAdd = !shiftId;



  const payload = {

    name: document.getElementById('shift-form-name').value.trim(),

    code: document.getElementById('shift-form-code').value.trim().toUpperCase(),

    start_time: document.getElementById('shift-form-start').value,

    end_time: document.getElementById('shift-form-end').value,

    is_night_shift: document.getElementById('shift-form-is-night').checked,

    description: document.getElementById('shift-form-desc').value.trim() || null,

    is_active: true

  };



  try {

    let res;

    if (isAdd) {

      res = await fetch('/api/shifts', {

        method: 'POST',

        headers: { 'Content-Type': 'application/json' },

        body: JSON.stringify(payload)

      });

    } else {

      res = await fetch(`/api/shifts/${shiftId}`, {

        method: 'PUT',

        headers: { 'Content-Type': 'application/json' },

        body: JSON.stringify(payload)

      });

    }



    if (!res.ok) {

      const err = await res.json();

      throw new Error(err.detail || 'Failed to save shift');

    }



    closeModal('modal-shift');

    showToast(`Shift ${payload.name} saved successfully`, 'success');

    loadShiftsData();

    loadDailyReport();



  } catch (err) {

    showToast(err.message, 'error');

  }

}



// ================= MODAL HELPERS =================

function openModal(id) {

  const m = document.getElementById(id);

  if (m) m.classList.remove('hidden');

}



function closeModal(id) {

  const m = document.getElementById(id);

  if (m) m.classList.add('hidden');

}



function copyShareUrl(url, btn) {

  navigator.clipboard.writeText(url).then(() => {

    const originalText = btn.innerHTML;

    btn.innerHTML = '✓ Copied!';

    showToast(`Copied ${url} to clipboard!`, 'success');

    setTimeout(() => {

      btn.innerHTML = originalText;

    }, 2000);

  }).catch(() => {

    showToast(`URL: ${url}`, 'info');

  });

}









function openEditDeviceModal(deviceId) {

  const dev = currentDevicesCache.find(d => d.id === deviceId);

  if (!dev) return;



  document.getElementById('device-edit-id').value = dev.id;

  document.getElementById('device-edit-name').value = dev.device_name;

  document.getElementById('device-edit-ip').value = dev.ip_address;

  document.getElementById('device-edit-port').value = dev.port || 4370;

  document.getElementById('device-edit-model').value = dev.device_model || 'eSSL F18 + F12';

  document.getElementById('device-edit-type').value = dev.attendance_type || 'BOTH';



  openModal('modal-device-edit');

}



async function submitDeviceEditForm(e) {

  e.preventDefault();

  const id = document.getElementById('device-edit-id').value;

  const name = document.getElementById('device-edit-name').value.trim();

  const ip = document.getElementById('device-edit-ip').value.trim();

  const port = parseInt(document.getElementById('device-edit-port').value, 10) || 4370;

  const model = document.getElementById('device-edit-model').value.trim();

  const type = document.getElementById('device-edit-type').value;



  try {

    const res = await fetch(`/api/devices/${id}`, {

      method: 'PUT',

      headers: { 'Content-Type': 'application/json' },

      body: JSON.stringify({

        device_name: name,

        ip_address: ip,

        port: port,

        device_model: model,

        attendance_type: type

      })

    });



    if (!res.ok) {

      const err = await res.json();

      throw new Error(err.detail || 'Failed to update device');

    }



    closeModal('modal-device-edit');

    showToast('Device details updated successfully', 'success');

    loadDevicesData();

  } catch (err) {

    showToast(err.message, 'error');

  }

}



// ================= EMPLOYEES EXCEEDING 2 HOURS LIST MONTHLY =================

let exceededDataCache = null;
let exceededTableMode = 'summary'; // 'summary' (Employee Ledger) or 'incidents' (Daily Incidents)
let exceededSortOrder = 'ASC';

function switchMonthlySubTab(tabName, reloadData = true) {
  const btnMuster = document.getElementById('subtab-btn-muster');
  const btnLate = document.getElementById('subtab-btn-late');
  const btnExceeded = document.getElementById('subtab-btn-exceeded');
  const viewMuster = document.getElementById('monthly-subview-muster');
  const viewLate = document.getElementById('monthly-subview-late');
  const viewExceeded = document.getElementById('monthly-subview-exceeded');

  // Reset all buttons
  [btnMuster, btnLate, btnExceeded].forEach(b => {
    if (b) b.className = 'px-3.5 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition';
  });

  // Hide all views
  if (viewMuster) viewMuster.classList.add('hidden');
  if (viewLate) viewLate.classList.add('hidden');
  if (viewExceeded) viewExceeded.classList.add('hidden');

  if (tabName === 'late') {
    if (btnLate) btnLate.className = 'px-3.5 py-1.5 rounded-lg text-xs font-bold bg-brand-navy text-white shadow-xs transition';
    if (viewLate) viewLate.classList.remove('hidden');

    const mMonth = document.getElementById('monthly-month-select');
    const mYear = document.getElementById('monthly-year-select');
    const lMonth = document.getElementById('late-month-select');
    const lYear = document.getElementById('late-year-select');
    if (mMonth && lMonth && !lMonth.dataset.userChanged) lMonth.value = mMonth.value;
    if (mYear && lYear && !lYear.dataset.userChanged) lYear.value = mYear.value;

    if (reloadData) loadMonthlyLateData();
  } else if (tabName === 'exceeded') {
    if (btnExceeded) btnExceeded.className = 'px-3.5 py-1.5 rounded-lg text-xs font-bold bg-brand-navy text-white shadow-xs transition';
    if (viewExceeded) viewExceeded.classList.remove('hidden');

    const mMonth = document.getElementById('monthly-month-select');
    const mYear = document.getElementById('monthly-year-select');
    const eMonth = document.getElementById('exceeded-month-select');
    const eYear = document.getElementById('exceeded-year-select');
    if (mMonth && eMonth && !eMonth.dataset.userChanged) eMonth.value = mMonth.value;
    if (mYear && eYear && !eYear.dataset.userChanged) eYear.value = mYear.value;

    if (reloadData) loadExceededData();
  } else {
    if (btnMuster) btnMuster.className = 'px-3.5 py-1.5 rounded-lg text-xs font-bold bg-brand-navy text-white shadow-xs transition';
    if (viewMuster) viewMuster.classList.remove('hidden');
    if (reloadData) loadMonthlyAttendanceData();
  }
}

function setExceededTableMode(mode) {
  exceededTableMode = mode;
  const btnInc = document.getElementById('btn-exceeded-mode-incidents');
  const btnSum = document.getElementById('btn-exceeded-mode-summary');

  if (mode === 'incidents') {
    if (btnInc) btnInc.className = 'px-3 py-1 rounded-md font-bold text-brand-navy bg-white border border-blue-200 shadow-xs transition';
    if (btnSum) btnSum.className = 'px-3 py-1 rounded-md font-medium text-slate-600 hover:text-slate-900 transition';
  } else {
    if (btnInc) btnInc.className = 'px-3 py-1 rounded-md font-medium text-slate-600 hover:text-slate-900 transition';
    if (btnSum) btnSum.className = 'px-3 py-1 rounded-md font-bold text-brand-navy bg-white border border-blue-200 shadow-xs transition';
  }

  if (exceededDataCache) {
    renderExceededTable(exceededDataCache);
  }
}

async function refreshExceededView() {
  const icon = document.getElementById('exceeded-refresh-icon');
  const text = document.getElementById('exceeded-refresh-text');
  if (icon) icon.classList.add('animate-spin');
  if (text) text.textContent = 'Refreshing...';
  try {
    await loadExceededData();
    showToast('Permission quota report refreshed', 'info');
  } catch (e) {
    showToast('Failed to refresh: ' + (e.message || e), 'error');
  } finally {
    if (icon) icon.classList.remove('animate-spin');
    if (text) text.textContent = 'Refresh';
  }
}

async function loadExceededData() {
  const tbody = document.getElementById('exceeded-table-tbody');
  if (tbody) {
    tbody.innerHTML = `<tr><td colspan="12" class="text-center py-12 text-slate-400">
      <svg class="w-6 h-6 animate-spin mx-auto text-brand-navy mb-2" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
      Calculating monthly 2-hour permission quota ledger...
    </td></tr>`;
  }

  const now = new Date();
  const yearEl = document.getElementById('exceeded-year-select') || document.getElementById('monthly-year-select');
  const monthEl = document.getElementById('exceeded-month-select') || document.getElementById('monthly-month-select');
  const threshEl = document.getElementById('exceeded-threshold-select');
  const catEl = document.getElementById('exceeded-category-select');
  const deptEl = document.getElementById('exceeded-dept-select');
  const shiftEl = document.getElementById('exceeded-shift-select');
  const searchEl = document.getElementById('exceeded-search-input');

  const year = yearEl ? yearEl.value : now.getFullYear();
  const month = monthEl ? monthEl.value : (now.getMonth() + 1);
  const threshold = threshEl ? threshEl.value : '2.0';
  const category = catEl ? catEl.value : 'EXCEEDED';
  const dept = deptEl ? deptEl.value : 'ALL';
  const shift = shiftEl ? shiftEl.value : 'ALL';
  const search = searchEl ? searchEl.value.trim() : '';

  try {
    const url = `/api/attendance/monthly-exceeded?year=${year}&month=${month}&threshold=${threshold}&category=${category}&department=${encodeURIComponent(dept)}&shift=${encodeURIComponent(shift)}&search=${encodeURIComponent(search)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to load exceeded report');

    const data = await res.json();
    exceededDataCache = data;

    // Update KPIs
    const kpiInc = document.getElementById('exceeded-kpi-incidents');
    const kpiEmp = document.getElementById('exceeded-kpi-employees');
    const kpiMonth = document.getElementById('exceeded-kpi-month');
    const kpiThresh = document.getElementById('exceeded-kpi-threshold');

    if (kpiInc) kpiInc.textContent = data.total_exceeded_hours_text || '0h 00m';
    if (kpiEmp) kpiEmp.textContent = `${data.total_exceeded_staff} Staff`;
    if (kpiMonth) kpiMonth.textContent = data.month_name;
    if (kpiThresh) kpiThresh.textContent = data.monthly_quota_text || '2h 00m';

    // Populate dept dropdown
    if (deptEl && deptEl.options.length <= 1) {
      const depts = new Set();
      (data.summary || []).forEach(r => { if (r.department) depts.add(r.department); });
      Array.from(depts).sort().forEach(d => {
        const opt = document.createElement('option');
        opt.value = d;
        opt.textContent = d;
        deptEl.appendChild(opt);
      });
      deptEl.value = dept;
    }

    renderExceededTable(data);
  } catch (err) {
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="12" class="text-center py-12 text-rose-500 font-semibold">Error: ${err.message}</td></tr>`;
    }
  }
}

function renderExceededTable(data) {
  const thead = document.getElementById('exceeded-table-thead');
  const tbody = document.getElementById('exceeded-table-tbody');
  if (!thead || !tbody || !data) return;

  if (exceededTableMode === 'summary') {
    // Mode 1: Employee Permission Ledger
    thead.innerHTML = `
      <tr>
        <th class="px-3 py-3 text-center text-[11px] font-bold uppercase tracking-wider text-slate-700 min-w-[70px]">Emp ID</th>
        <th class="px-3.5 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-700 min-w-[180px] cursor-pointer hover:bg-slate-200 select-none" onclick="toggleExceededSort('name')">
          <div class="flex items-center justify-between">
            <span>Employee Name</span>
            <span id="exceeded-sort-icon" class="text-[10px] text-brand-navy font-bold">${exceededSortOrder === 'ASC' ? '▲ A-Z' : '▼ Z-A'}</span>
          </div>
        </th>
          <th class="px-3 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-700 min-w-[150px]">Shift Timing</th>
        <th class="px-3 py-3 text-center text-[11px] font-bold uppercase tracking-wider text-slate-700 min-w-[95px]">Monthly Quota</th>
        <th class="px-3 py-3 text-center text-[11px] font-bold uppercase tracking-wider text-amber-800 bg-amber-50/50 min-w-[130px]">Morning Late (&gt; 09:05)</th>
        <th class="px-3 py-3 text-center text-[11px] font-bold uppercase tracking-wider text-indigo-800 bg-indigo-50/50 min-w-[130px]">Evening Early (Shift End)</th>
        <th class="px-3 py-3 text-center text-[11px] font-bold uppercase tracking-wider text-slate-800 bg-slate-200/60 min-w-[105px]">Total Used</th>
        <th class="px-3 py-3 text-center text-[11px] font-bold uppercase tracking-wider text-emerald-800 min-w-[95px]">Balance Left</th>
        <th class="px-3 py-3 text-center text-[11px] font-bold uppercase tracking-wider text-rose-700 min-w-[140px]">Exceeded (&gt; 2h)</th>
        <th class="px-3 py-3 text-center text-[11px] font-bold uppercase tracking-wider text-slate-700 min-w-[85px]">Drilldown</th>
      </tr>
    `;

    const summary = data.summary || [];
    if (summary.length === 0) {
      tbody.innerHTML = `<tr><td colspan="12" class="text-center py-12 text-slate-400">No employees exceeded the ${data.monthly_quota_text || '2h'} permission limit during ${data.month_name}.</td></tr>`;
      return;
    }

    let rows = '';
    summary.forEach((emp_s, idx) => {
      const bg = idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40';
      const isEx = emp_s.is_exceeded;
      const statusBadge = isEx
        ? `<span class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-extrabold bg-rose-100 text-rose-800 border border-rose-300">⚠️ ${emp_s.exceeded_text}</span>`
        : `<span class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">✅ Within Limit</span>`;

      rows += `
        <tr class="${bg} hover:bg-slate-100/60 transition">
          <td class="px-3 py-2.5 text-center font-mono font-bold text-slate-700">${emp_s.emp_code}</td>
          <td class="px-3.5 py-2.5 font-semibold text-slate-900 whitespace-nowrap">
            <button type="button" onclick="openEmployeePermissionDrilldown('${emp_s.emp_code}')" class="text-left hover:text-brand-navy hover:underline font-semibold text-slate-900">
              ${emp_s.name}
            </button>
          </td>
            <td class="px-3 py-2.5 text-slate-500 text-xs whitespace-nowrap">${emp_s.shift}</td>
          <td class="px-3 py-2.5 text-center font-mono font-bold text-slate-600">${emp_s.monthly_quota_text}</td>
          <td class="px-3 py-2.5 text-center font-mono text-xs text-amber-800 bg-amber-50/30 whitespace-nowrap font-semibold">
            ${emp_s.morning_late_text}
          </td>
          <td class="px-3 py-2.5 text-center font-mono text-xs text-indigo-800 bg-indigo-50/30 whitespace-nowrap font-semibold">
            ${emp_s.evening_early_text}
          </td>
          <td class="px-3 py-2.5 text-center font-bold text-slate-900 bg-slate-100/50 whitespace-nowrap">
            ${emp_s.total_used_text}
          </td>
          <td class="px-3 py-2.5 text-center font-bold font-mono text-xs ${emp_s.balance_mins > 0 ? 'text-emerald-700' : 'text-slate-400'} whitespace-nowrap">
            ${emp_s.balance_text}
          </td>
          <td class="px-3 py-2.5 text-center whitespace-nowrap">
            ${statusBadge}
          </td>
          <td class="px-3 py-2.5 text-center whitespace-nowrap">
            <button type="button" onclick="openEmployeePermissionDrilldown('${emp_s.emp_code}')" class="inline-flex items-center space-x-1 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-white border border-slate-300 hover:bg-brand-navy hover:text-white hover:border-brand-navy text-slate-700 shadow-2xs transition" title="View day-by-day punch breakdown">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
              <span>Daily Log</span>
            </button>
          </td>
        </tr>
      `;
    });
    tbody.innerHTML = rows;

  } else {
    // Mode 2: Detailed Deduction Incidents Log
    thead.innerHTML = `
      <tr>
        <th class="px-3.5 py-3 text-center text-[11px] font-bold uppercase tracking-wider text-slate-700 min-w-[120px]">Date</th>
        <th class="px-3 py-3 text-center text-[11px] font-bold uppercase tracking-wider text-slate-700 min-w-[70px]">Emp ID</th>
        <th class="px-3.5 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-700 min-w-[170px] cursor-pointer hover:bg-slate-200 select-none" onclick="toggleExceededSort('name')">
          <div class="flex items-center justify-between">
            <span>Employee Name</span>
            <span id="exceeded-sort-icon" class="text-[10px] text-brand-navy font-bold">${exceededSortOrder === 'ASC' ? '▲ A-Z' : '▼ Z-A'}</span>
          </div>
        </th>
          <th class="px-3 py-3 text-center text-[11px] font-bold uppercase tracking-wider text-amber-800 bg-amber-50/50 min-w-[130px]">First IN (Device)</th>
        <th class="px-3 py-3 text-center text-[11px] font-bold uppercase tracking-wider text-indigo-800 bg-indigo-50/50 min-w-[130px]">Last OUT (Device)</th>
        <th class="px-3 py-3 text-center text-[11px] font-bold uppercase tracking-wider text-slate-700 min-w-[95px]">Late (&gt; 09:05)</th>
        <th class="px-3 py-3 text-center text-[11px] font-bold uppercase tracking-wider text-indigo-800 bg-indigo-50/50 min-w-[130px]">Evening Early (Shift End)</th>
        <th class="px-3 py-3 text-center text-[11px] font-bold uppercase tracking-wider text-rose-700 min-w-[100px]">Deducted</th>
        <th class="px-3.5 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-700 min-w-[190px]">Deduction Reasons</th>
      </tr>
    `;

    const incidents = data.incidents || [];
    if (incidents.length === 0) {
      tbody.innerHTML = `<tr><td colspan="11" class="text-center py-12 text-slate-400">No deduction incidents logged during ${data.month_name}.</td></tr>`;
      return;
    }

    let rows = '';
    incidents.forEach((inc, idx) => {
      const bg = idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40';
      rows += `
        <tr class="${bg} hover:bg-rose-50/20 transition">
          <td class="px-3.5 py-2 text-center font-medium text-slate-800 whitespace-nowrap">${inc.date_str}</td>
          <td class="px-3 py-2 text-center font-mono font-bold text-slate-700">${inc.emp_code}</td>
          <td class="px-3.5 py-2 font-semibold text-slate-900 whitespace-nowrap">${inc.name}</td>
            <td class="px-3 py-2 text-center font-mono text-xs text-amber-800 bg-amber-50/20 whitespace-nowrap">
            ${inc.first_in} <span class="text-[10px] text-slate-400">(${inc.first_in_device})</span>
          </td>
          <td class="px-3 py-2 text-center font-mono text-xs text-indigo-800 bg-indigo-50/20 whitespace-nowrap">
            ${inc.last_out} <span class="text-[10px] text-slate-400">(${inc.last_out_device})</span>
          </td>
          <td class="px-3 py-2 text-center font-mono text-xs font-semibold ${inc.morning_late_mins > 0 ? 'text-amber-700' : 'text-slate-400'}">
            ${inc.morning_late_mins > 0 ? `+${inc.morning_late_mins}m` : '--'}
          </td>
          <td class="px-3 py-2 text-center font-mono text-xs font-semibold ${inc.evening_early_mins > 0 ? 'text-indigo-700' : 'text-slate-400'}">
            ${inc.evening_early_mins > 0 ? `+${inc.evening_early_mins}m` : '--'}
          </td>
          <td class="px-3 py-2 text-center font-extrabold text-rose-700 whitespace-nowrap">
            <span class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-rose-50 text-rose-800 border border-rose-200">
              -${inc.day_deducted_text}
            </span>
          </td>
          <td class="px-3.5 py-2 text-slate-600 text-xs">${inc.reasons_str}</td>
        </tr>
      `;
    });
    tbody.innerHTML = rows;
  }
}

function openEmployeePermissionDrilldown(empCode) {
  if (!exceededDataCache) return;
  const list = exceededDataCache.all_summary || exceededDataCache.summary || [];
  const emp = list.find(s => String(s.emp_code) === String(empCode));
  if (!emp) return;

  // Title
  const titleEl = document.getElementById('drilldown-modal-title');
  const subEl = document.getElementById('drilldown-modal-sub');
  if (titleEl) titleEl.textContent = `${emp.name} (#${emp.emp_code}) - Permission Ledger Drilldown`;
  if (subEl) subEl.textContent = `${emp.shift} • ${exceededDataCache.month_name}`;

  // Metrics
  const metricsEl = document.getElementById('drilldown-modal-metrics');
  if (metricsEl) {
    metricsEl.innerHTML = `
      <div class="bg-white p-2.5 rounded-lg border border-slate-200">
        <span class="text-slate-500 font-semibold block text-[10px] uppercase">Monthly Quota</span>
        <span class="text-sm font-extrabold text-brand-navy">${emp.monthly_quota_text}</span>
      </div>
      <div class="bg-white p-2.5 rounded-lg border border-slate-200">
        <span class="text-slate-500 font-semibold block text-[10px] uppercase">Total Used</span>
        <span class="text-sm font-extrabold text-slate-800">${emp.total_used_text}</span>
      </div>
      <div class="bg-white p-2.5 rounded-lg border border-slate-200">
        <span class="text-slate-500 font-semibold block text-[10px] uppercase">Balance Remaining</span>
        <span class="text-sm font-extrabold ${emp.balance_mins > 0 ? 'text-emerald-700' : 'text-slate-400'}">${emp.balance_text}</span>
      </div>
      <div class="bg-white p-2.5 rounded-lg border border-slate-200">
        <span class="text-slate-500 font-semibold block text-[10px] uppercase">Exceeded Over 2h</span>
        <span class="text-sm font-extrabold ${emp.is_exceeded ? 'text-rose-600' : 'text-emerald-700'}">${emp.is_exceeded ? emp.exceeded_text : 'Within Limit'}</span>
      </div>
    `;
  }

  // Incidents rows
  const tbody = document.getElementById('drilldown-modal-tbody');
  const empIncidents = (exceededDataCache.incidents || []).filter(inc => String(inc.emp_code) === String(empCode));

  if (!empIncidents || empIncidents.length === 0) {
    if (tbody) tbody.innerHTML = `<tr><td colspan="8" class="text-center py-8 text-slate-400">No late arrivals or early exits recorded for ${emp.name} in this month.</td></tr>`;
  } else {
    let rows = '';
    empIncidents.forEach((inc, idx) => {
      const bg = idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50';
      rows += `
        <tr class="${bg}">
          <td class="px-3 py-2 text-center font-medium text-slate-800">${inc.date_str}</td>
          <td class="px-3 py-2 text-center font-mono text-xs text-amber-800">${inc.first_in}</td>
          <td class="px-3 py-2 text-center font-mono text-xs text-indigo-800">${inc.last_out}</td>
          <td class="px-3 py-2 text-center font-mono text-xs font-semibold ${inc.morning_late_mins > 0 ? 'text-amber-700' : 'text-slate-400'}">
            ${inc.morning_late_mins > 0 ? `+${inc.morning_late_mins}m` : '--'}
          </td>
          <td class="px-3 py-2 text-center font-mono text-xs font-semibold ${inc.evening_early_mins > 0 ? 'text-indigo-700' : 'text-slate-400'}">
            ${inc.evening_early_mins > 0 ? `+${inc.evening_early_mins}m` : '--'}
          </td>
          <td class="px-3 py-2 text-center font-bold text-rose-700">-${inc.day_deducted_text}</td>
          <td class="px-3 py-2 text-left text-xs text-slate-600">${inc.reasons_str}</td>
        </tr>
      `;
    });
    if (tbody) tbody.innerHTML = rows;
  }

  openModal('modal-permission-drilldown');
}

function filterExceededTableLocal() {
  if (!exceededDataCache) return;
  const input = document.getElementById('exceeded-search-input');
  const query = (input ? input.value : '').trim().toLowerCase();

  if (!query) {
    renderExceededTable(exceededDataCache);
    return;
  }

  const filtered = Object.assign({}, exceededDataCache, {
    incidents: (exceededDataCache.incidents || []).filter(inc =>
      (inc.name && inc.name.toLowerCase().includes(query)) ||
      (inc.emp_code && String(inc.emp_code).toLowerCase().includes(query))
    ),
    summary: (exceededDataCache.summary || []).filter(s =>
      (s.name && s.name.toLowerCase().includes(query)) ||
      (s.emp_code && String(s.emp_code).toLowerCase().includes(query))
    )
  });

  renderExceededTable(filtered);
}

function toggleExceededSort(field) {
  if (!exceededDataCache) return;
  if (field === 'name') {
    exceededSortOrder = exceededSortOrder === 'ASC' ? 'DESC' : 'ASC';
    const icon = document.getElementById('exceeded-sort-icon');
    if (icon) icon.textContent = exceededSortOrder === 'ASC' ? '▲ A-Z' : '▼ Z-A';

    if (exceededDataCache.incidents) {
      exceededDataCache.incidents = sortRecordsByName(exceededDataCache.incidents, exceededSortOrder);
    }
    if (exceededDataCache.summary) {
      exceededDataCache.summary = sortRecordsByName(exceededDataCache.summary, exceededSortOrder);
    }
    renderExceededTable(exceededDataCache);
  }
}

function exportExceededExcel() {
  const year = document.getElementById('exceeded-year-select')?.value || document.getElementById('monthly-year-select')?.value || new Date().getFullYear();
  const month = document.getElementById('exceeded-month-select')?.value || document.getElementById('monthly-month-select')?.value || (new Date().getMonth() + 1);
  const thresh = document.getElementById('exceeded-threshold-select')?.value || '2.0';
  const cat = document.getElementById('exceeded-category-select')?.value || 'EXCEEDED';
  const dept = document.getElementById('exceeded-dept-select')?.value || 'ALL';
  const shift = document.getElementById('exceeded-shift-select')?.value || 'ALL';

  window.location.href = `/api/attendance/export/monthly-exceeded-excel?year=${year}&month=${month}&threshold=${thresh}&category=${cat}&department=${encodeURIComponent(dept)}&shift=${encodeURIComponent(shift)}`;
}

function exportExceededCSV() {
  const year = document.getElementById('exceeded-year-select')?.value || document.getElementById('monthly-year-select')?.value || new Date().getFullYear();
  const month = document.getElementById('exceeded-month-select')?.value || document.getElementById('monthly-month-select')?.value || (new Date().getMonth() + 1);
  const thresh = document.getElementById('exceeded-threshold-select')?.value || '2.0';
  const cat = document.getElementById('exceeded-category-select')?.value || 'EXCEEDED';
  const dept = document.getElementById('exceeded-dept-select')?.value || 'ALL';
  const shift = document.getElementById('exceeded-shift-select')?.value || 'ALL';

  window.location.href = `/api/attendance/export/monthly-exceeded-csv?year=${year}&month=${month}&threshold=${thresh}&category=${cat}&department=${encodeURIComponent(dept)}&shift=${encodeURIComponent(shift)}`;
}

// ================= MONTHLY ATTENDANCE MUSTER ROLL (1-31 GRID) =================

let monthlyMusterCache = null;
let monthlyGridMode = 'inout'; // 'inout' (Per-Day First IN / Last OUT) or 'status' (P / A / WO)

function setMonthlyGridMode(mode) {
  monthlyGridMode = mode;
  const btnInout = document.getElementById('btn-monthly-mode-inout');
  const btnStatus = document.getElementById('btn-monthly-mode-status');

  if (mode === 'inout') {
    if (btnInout) btnInout.className = 'px-3 py-1 rounded-md font-bold text-brand-navy bg-white border border-blue-200 shadow-xs transition flex items-center space-x-1';
    if (btnStatus) btnStatus.className = 'px-3 py-1 rounded-md font-medium text-slate-600 hover:text-slate-900 transition flex items-center space-x-1';
  } else {
    if (btnInout) btnInout.className = 'px-3 py-1 rounded-md font-medium text-slate-600 hover:text-slate-900 transition flex items-center space-x-1';
    if (btnStatus) btnStatus.className = 'px-3 py-1 rounded-md font-bold text-brand-navy bg-white border border-blue-200 shadow-xs transition flex items-center space-x-1';
  }

  updateMonthlyLegend();
  if (monthlyMusterCache) {
    renderMonthlyMusterTable(monthlyMusterCache);
  }
}

function updateMonthlyLegend() {
  const legendEl = document.getElementById('monthly-legend-container');
  if (!legendEl) return;
  if (monthlyGridMode === 'inout') {
    legendEl.innerHTML = `
      <span class="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1">Legend:</span>
      <span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-300">
        <span class="w-1.5 h-1.5 rounded-full bg-emerald-600 mr-1"></span>Top: First IN
      </span>
      <span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-300">
        <span class="w-1.5 h-1.5 rounded-full bg-blue-600 mr-1"></span>Bottom: Last OUT
      </span>
      <span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-300">
        <span class="w-1.5 h-1.5 rounded-full bg-amber-600 mr-1"></span>Late (> 09:05)
      </span>
      <span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
        A = Absent
      </span>
      <span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
        WO = Week Off
      </span>
    `;
  } else {
    legendEl.innerHTML = `
      <span class="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1">Legend:</span>
      <span class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">P = Present</span>
      <span class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300">Late (> 09:05)</span>
      <span class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-300">A = Absent</span>
      <span class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-300">WFH = Remote</span>
      <span class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300">WO = Week Off</span>
    `;
  }
}

async function loadMonthlyAttendanceData() {
  const mSelect = document.getElementById('monthly-month-select');
  const ySelect = document.getElementById('monthly-year-select');
  const sSelect = document.getElementById('monthly-shift-select');

  const now = new Date();
  const month = mSelect ? mSelect.value : (now.getMonth() + 1);
  const year = ySelect ? ySelect.value : now.getFullYear();
  const shift = sSelect ? sSelect.value : 'ALL';

  const tbody = document.getElementById('monthly-table-tbody');
  if (tbody) {
    tbody.innerHTML = `<tr><td colspan="45" class="text-center py-12 text-slate-400 font-medium">
      <div class="inline-flex items-center space-x-2">
        <svg class="w-5 h-5 animate-spin text-brand-navy" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path></svg>
        <span>Loading monthly attendance report for ${month}/${year}...</span>
      </div>
    </td></tr>`;
  }

  try {
    const res = await fetch(`/api/attendance/monthly?year=${year}&month=${month}&shift=${encodeURIComponent(shift)}`);
    if (!res.ok) throw new Error('Failed to load monthly attendance');
    const data = await res.json();
    monthlyMusterCache = data;

    // Populate KPIs
    const kpiStaff = document.getElementById('monthly-kpi-employees');
    const kpiDays = document.getElementById('monthly-kpi-days');
    const kpiPres = document.getElementById('monthly-kpi-present');
    const kpiAbs = document.getElementById('monthly-kpi-absent');
    const kpiWfh = document.getElementById('monthly-kpi-wfh');
    const kpiRate = document.getElementById('monthly-kpi-rate');
    const kpiMonthName = document.getElementById('monthly-kpi-monthname');

    if (kpiStaff) kpiStaff.textContent = data.summary?.total_employees || data.total_staff || (data.records ? data.records.length : 0);
    if (kpiDays) kpiDays.textContent = data.days_in_month || (data.days_meta ? data.days_meta.length : 0);
    if (kpiPres) kpiPres.textContent = data.summary?.total_present_days || 0;
    if (kpiAbs) kpiAbs.textContent = data.summary?.total_absent_days || 0;
    if (kpiWfh) kpiWfh.textContent = data.summary?.total_wfh_days || 0;
    if (kpiRate) kpiRate.textContent = `${data.summary?.avg_attendance_rate || data.summary?.overall_rate || 0}%`;
    if (kpiMonthName) kpiMonthName.textContent = `Month of ${data.month_name || ''} ${data.year || year}`;

    updateMonthlyLegend();
    renderMonthlyMusterTable(data);
  } catch (err) {
    console.error('Error loading monthly muster roll:', err);
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="45" class="text-center py-8 text-rose-500 font-medium">Failed to load monthly attendance: ${err.message}</td></tr>`;
    }
  }
}

function renderMonthlyMusterTable(data) {
  const thead = document.getElementById('monthly-table-thead');
  const tbody = document.getElementById('monthly-table-tbody');
  if (!thead || !tbody || !data) return;

  const daysMeta = data.days_meta || [];
  const records = data.records || [];

  const topHeaderTitle = monthlyGridMode === 'inout'
    ? `Days of Month (1 – ${daysMeta.length}) • Per-Day First IN &amp; Last OUT Timestamps`
    : `Days of Month (1 – ${daysMeta.length}) • Attendance Status (P / A / WO)`;

  // Build thead: 2 rows
  let row1 = `<tr>
    <th rowspan="2" class="px-3 py-2 border-r border-slate-200 bg-slate-100 font-bold sticky left-0 z-30 min-w-[75px]">Emp ID</th>
    <th rowspan="2" class="px-3 py-2 border-r border-slate-200 bg-slate-100 font-bold sticky left-[75px] z-30 min-w-[150px]">Employee Name</th>
    <th rowspan="2" class="px-3 py-2 border-r border-slate-200 bg-slate-100 font-bold min-w-[130px]">Shift</th>
    <th colspan="${daysMeta.length}" class="px-2 py-1.5 border-r border-slate-200 text-center font-bold bg-slate-200 text-slate-800 text-xs">${topHeaderTitle}</th>
    <th rowspan="2" class="px-2 py-2 border-r border-slate-200 text-center font-bold bg-emerald-50 text-emerald-900 min-w-[45px]">P</th>
    <th rowspan="2" class="px-2 py-2 border-r border-slate-200 text-center font-bold bg-amber-50 text-amber-900 min-w-[50px]" title="Monthly Late Punch Count (> 09:05 AM)">Late</th>
    <th rowspan="2" class="px-2 py-2 border-r border-slate-200 text-center font-bold bg-rose-50 text-rose-900 min-w-[45px]">A</th>
    <th rowspan="2" class="px-2 py-2 border-r border-slate-200 text-center font-bold bg-indigo-50 text-indigo-900 min-w-[45px]">WFH</th>
    <th rowspan="2" class="px-2 py-2 border-r border-slate-200 text-center font-bold bg-slate-100 text-slate-700 min-w-[45px]">WO</th>
    <th rowspan="2" class="px-2 py-2 text-center font-bold bg-blue-50 text-blue-900 min-w-[55px]">Rate %</th>
  </tr>`;

  let row2 = `<tr>`;
  daysMeta.forEach(d => {
    const weekendClass = d.is_weekend ? 'bg-amber-100/70 text-amber-900 font-bold' : 'bg-slate-50 text-slate-700';
    const minW = monthlyGridMode === 'inout' ? 'min-w-[54px]' : 'min-w-[36px]';
    row2 += `<th class="px-1 py-1 border-r border-slate-200 text-center text-[10px] ${minW} ${weekendClass}" title="${d.weekday}">
      <div class="font-bold">${d.day}</div>
      <div class="text-[8px] font-normal opacity-80 uppercase">${d.weekday.slice(0, 2)}</div>
      ${monthlyGridMode === 'inout' ? `<div class="text-[8px] font-mono flex justify-between px-1 border-t border-slate-200/50 mt-0.5 pt-0.5"><span class="text-emerald-700 font-bold">IN</span><span class="text-blue-700 font-bold">OUT</span></div>` : ''}
    </th>`;
  });
  row2 += `</tr>`;

  thead.innerHTML = row1 + row2;

  // Filter records by search input if present
  const query = (document.getElementById('monthly-search-input')?.value || '').toLowerCase().trim();
  let filtered = records;
  if (query) {
    filtered = records.filter(r =>
      (r.name && r.name.toLowerCase().includes(query)) ||
      (r.emp_code && r.emp_code.toLowerCase().includes(query))
    );
  }

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="${daysMeta.length + 10}" class="text-center py-8 text-slate-400 font-medium">No matching employee records found</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(r => {
    let dayCells = '';
    daysMeta.forEach(d => {
      const dKey = String(d.day);
      const dayData = (r.days && r.days[dKey]) ? r.days[dKey] : null;
      const status = dayData ? dayData.status : '--';
      const isLate = dayData ? Boolean(dayData.is_late) : false;
      const lateMins = dayData ? (dayData.late_mins || 0) : 0;
      const firstIn = dayData?.first_in || '';
      const lastOut = dayData?.last_out || '';

      let cellBg = 'bg-white text-slate-400';
      let title = `Day ${d.day} (${d.weekday}): No Punch`;

      if (status === 'P') {
        if (isLate) {
          cellBg = 'bg-amber-50/70 border-amber-200';
          title = `Day ${d.day}: Present - Late Punch (+${lateMins}m)\nFirst IN: ${firstIn}\nLast OUT: ${lastOut || '--'}`;
        } else {
          cellBg = 'bg-emerald-50/60 border-emerald-100';
          title = `Day ${d.day}: Present (On Time)\nFirst IN: ${firstIn}\nLast OUT: ${lastOut || '--'}`;
        }
      } else if (status === 'A') {
        cellBg = 'bg-rose-50/40 text-rose-600';
        title = `Day ${d.day}: Absent`;
      } else if (status === 'WFH') {
        cellBg = 'bg-indigo-50/50 text-indigo-800';
        title = `Day ${d.day}: WFH (Remote)`;
      } else if (status === 'WO') {
        cellBg = 'bg-slate-100 text-slate-500';
        title = `Day ${d.day}: Week Off (${d.weekday})`;
      }

      if (monthlyGridMode === 'inout') {
        let cellBody = '';
        if (status === 'P') {
          const inTime = firstIn ? firstIn.slice(0, 5) : '--:--';
          const outTime = lastOut ? lastOut.slice(0, 5) : '--:--';
          cellBody = `
            <div class="leading-tight py-0.5 flex flex-col justify-center items-center">
              <span class="font-mono text-[10px] font-bold ${isLate ? 'text-amber-900 bg-amber-200/90 px-1 rounded' : 'text-emerald-700'}" title="First IN: ${firstIn || '--'}${isLate ? ' (Late +' + lateMins + 'm)' : ''}">
                ${inTime}
              </span>
              <span class="font-mono text-[10px] font-medium text-blue-700 mt-0.5 pt-0.5 border-t border-slate-200/70 w-full text-center" title="Last OUT: ${lastOut || '--'}">
                ${outTime}
              </span>
            </div>
          `;
        } else if (status === 'A') {
          cellBody = `<div class="py-2 text-center"><span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-600 border border-rose-200">A</span></div>`;
        } else if (status === 'WO') {
          cellBody = `<div class="py-2 text-center text-slate-400 font-bold text-[10px]">WO</div>`;
        } else if (status === 'WFH') {
          cellBody = `<div class="py-2 text-center text-indigo-700 font-bold text-[10px]">WFH</div>`;
        } else {
          cellBody = `<div class="py-2 text-center text-slate-300 font-mono">--</div>`;
        }

        dayCells += `<td class="px-0.5 py-1 border-r border-slate-200 text-center ${cellBg}" title="${title}">
          ${cellBody}
        </td>`;
      } else {
        // Status Only Mode
        dayCells += `<td class="px-1 py-1.5 border-r border-slate-200 text-center text-[10px] ${cellBg}" title="${title}">
          ${status === 'P' && isLate ? `<span class="relative inline-block"><span class="w-1.5 h-1.5 bg-amber-600 rounded-full inline-block mr-0.5"></span>P</span>` : status}
        </td>`;
      }
    });

    const lateCount = r.late_count || 0;
    const lateBadge = lateCount > 0
      ? `<span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300 font-mono">${lateCount}</span>`
      : `<span class="text-slate-400 font-mono">0</span>`;

    return `<tr class="hover:bg-slate-50 transition border-b border-slate-100">
      <td class="px-3 py-2 font-mono font-semibold text-slate-800 border-r border-slate-200 bg-white sticky left-0 z-10">${r.emp_code}</td>
      <td onclick="openMonthlyEmpDrilldown('${r.emp_code}')" class="px-3 py-2 font-medium text-slate-900 border-r border-slate-200 bg-white sticky left-[75px] z-10 truncate max-w-[180px] cursor-pointer hover:text-brand-navy hover:underline select-none" title="Click to view detailed monthly punch timesheet">${r.name}</td>
      <td class="px-3 py-2 text-slate-600 border-r border-slate-200 text-[10px] truncate max-w-[140px]">${r.shift || 'Standard Shift'}</td>
      ${dayCells}
      <td class="px-2 py-2 text-center font-bold text-emerald-700 border-r border-slate-200 font-mono">${r.present_count}</td>
      <td class="px-2 py-2 text-center border-r border-slate-200">${lateBadge}</td>
      <td class="px-2 py-2 text-center font-bold text-rose-600 border-r border-slate-200 font-mono">${r.absent_count}</td>
      <td class="px-2 py-2 text-center font-bold text-indigo-700 border-r border-slate-200 font-mono">${r.wfh_count || 0}</td>
      <td class="px-2 py-2 text-center font-bold text-slate-500 border-r border-slate-200 font-mono">${r.wo_count || 0}</td>
      <td class="px-2 py-2 text-center font-extrabold text-blue-700 font-mono">${r.attendance_rate}%</td>
    </tr>`;
  }).join('');
}

function openMonthlyEmpDrilldown(empCode) {
  if (!monthlyMusterCache || !monthlyMusterCache.records) return;
  const emp = monthlyMusterCache.records.find(r => String(r.emp_code) === String(empCode));
  if (!emp) return;

  const titleEl = document.getElementById('monthly-drilldown-emp-name');
  const subEl = document.getElementById('monthly-drilldown-sub');
  const metricsEl = document.getElementById('monthly-drilldown-metrics');
  const tbodyEl = document.getElementById('monthly-drilldown-tbody');

  if (titleEl) titleEl.textContent = `${emp.name} (#${emp.emp_code}) - Monthly Timesheet`;
  if (subEl) subEl.textContent = `${emp.shift || 'Standard Shift'} • ${monthlyMusterCache.month_name || ''} ${monthlyMusterCache.year || ''}`;

  if (metricsEl) {
    metricsEl.innerHTML = `
      <div class="bg-white p-2.5 rounded-lg border border-slate-200">
        <p class="text-[10px] font-bold text-emerald-700 uppercase">Present Days</p>
        <p class="text-base font-extrabold text-emerald-700 font-mono mt-0.5">${emp.present_count}</p>
      </div>
      <div class="bg-white p-2.5 rounded-lg border border-amber-200 bg-amber-50/20">
        <p class="text-[10px] font-bold text-amber-800 uppercase">Late Count</p>
        <p class="text-base font-extrabold text-amber-800 font-mono mt-0.5">${emp.late_count || 0}</p>
      </div>
      <div class="bg-white p-2.5 rounded-lg border border-rose-200 bg-rose-50/20">
        <p class="text-[10px] font-bold text-rose-700 uppercase">Absent Days</p>
        <p class="text-base font-extrabold text-rose-700 font-mono mt-0.5">${emp.absent_count || 0}</p>
      </div>
      <div class="bg-white p-2.5 rounded-lg border border-indigo-200 bg-indigo-50/20">
        <p class="text-[10px] font-bold text-indigo-700 uppercase">WFH Days</p>
        <p class="text-base font-extrabold text-indigo-700 font-mono mt-0.5">${emp.wfh_count || 0}</p>
      </div>
      <div class="bg-white p-2.5 rounded-lg border border-blue-200 bg-blue-50/20">
        <p class="text-[10px] font-bold text-blue-700 uppercase">Attendance %</p>
        <p class="text-base font-extrabold text-blue-700 font-mono mt-0.5">${emp.attendance_rate}%</p>
      </div>
    `;
  }

  if (tbodyEl) {
    const daysMeta = monthlyMusterCache.days_meta || [];
    tbodyEl.innerHTML = daysMeta.map(d => {
      const dKey = String(d.day);
      const dayData = (emp.days && emp.days[dKey]) ? emp.days[dKey] : null;
      const status = dayData ? dayData.status : '--';
      const fIn = dayData?.first_in || '--';
      const lOut = dayData?.last_out || '--';
      const punches = dayData?.punches_count || 0;
      const isLate = Boolean(dayData?.is_late);
      const lateMins = dayData?.late_mins || 0;

      let statusBadge = '<span class="text-slate-400 font-bold">--</span>';
      let note = '<span class="text-slate-400">--</span>';

      if (status === 'P') {
        statusBadge = '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">Present</span>';
        if (isLate) {
          note = `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">Late by +${lateMins}m (Cutoff 09:05)</span>`;
        } else {
          note = '<span class="text-emerald-700 font-semibold text-[11px]">✓ On Time</span>';
        }
      } else if (status === 'A') {
        statusBadge = '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-700 border border-rose-300">Absent</span>';
        note = '<span class="text-rose-600 text-[11px]">No punches logged</span>';
      } else if (status === 'WO') {
        statusBadge = '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">Week Off</span>';
        note = `<span class="text-slate-500 text-[11px]">${d.weekday} Weekend</span>`;
      } else if (status === 'WFH') {
        statusBadge = '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">WFH</span>';
        note = '<span class="text-indigo-700 text-[11px]">Work From Home</span>';
      }

      return `
        <tr class="hover:bg-slate-50 transition border-b border-slate-100 ${status === 'P' && isLate ? 'bg-amber-50/20' : ''}">
          <td class="px-3 py-2 font-bold text-slate-800">${d.day}</td>
          <td class="px-3 py-2 text-slate-600 whitespace-nowrap">${monthlyMusterCache.year}-${String(monthlyMusterCache.month).padStart(2, '0')}-${String(d.day).padStart(2, '0')}</td>
          <td class="px-3 py-2 ${d.is_weekend ? 'font-bold text-amber-800' : 'text-slate-700'}">${d.weekday}</td>
          <td class="px-3 py-2 text-center">${statusBadge}</td>
          <td class="px-3 py-2 text-center font-bold ${isLate ? 'text-amber-800' : 'text-emerald-700'}">${fIn}</td>
          <td class="px-3 py-2 text-center font-semibold text-blue-700">${lOut}</td>
          <td class="px-3 py-2 text-center text-slate-700">${punches}</td>
          <td class="px-3 py-2 text-center">${note}</td>
        </tr>
      `;
    }).join('');
  }

  openModal('modal-monthly-emp-drilldown');
}

function filterMonthlyTableLocal() {
  if (monthlyMusterCache) {
    renderMonthlyMusterTable(monthlyMusterCache);
  }
}

function navigateMonth(direction) {
  const mSelect = document.getElementById('monthly-month-select');
  const ySelect = document.getElementById('monthly-year-select');
  if (!mSelect || !ySelect) return;
  let m = parseInt(mSelect.value, 10) + direction;
  let y = parseInt(ySelect.value, 10);
  if (m < 1) { m = 12; y -= 1; }
  else if (m > 12) { m = 1; y += 1; }
  mSelect.value = String(m);
  ySelect.value = String(y);
  loadMonthlyAttendanceData();
}

function refreshMonthlyView() {
  loadMonthlyAttendanceData();
}

function exportMonthlyExcel() {
  const m = document.getElementById('monthly-month-select')?.value || 11;
  const y = document.getElementById('monthly-year-select')?.value || 2026;
  const dept = document.getElementById('monthly-dept-select')?.value || 'ALL';
  const shift = document.getElementById('monthly-shift-select')?.value || 'ALL';
  window.location.href = `/api/attendance/export/monthly-excel?year=${y}&month=${m}&department=${encodeURIComponent(dept)}&shift=${encodeURIComponent(shift)}`;
}

function exportMonthlyCSV() {
  const m = document.getElementById('monthly-month-select')?.value || 11;
  const y = document.getElementById('monthly-year-select')?.value || 2026;
  const dept = document.getElementById('monthly-dept-select')?.value || 'ALL';
  const shift = document.getElementById('monthly-shift-select')?.value || 'ALL';
  window.location.href = `/api/attendance/export/monthly-csv?year=${y}&month=${m}&department=${encodeURIComponent(dept)}&shift=${encodeURIComponent(shift)}`;
}


// ================= MONTHLY LATE PUNCH COUNT LOGIC =================

let monthlyLateCache = null;
let lateTableMode = 'summary'; // 'summary' or 'incidents'

async function loadMonthlyLateData() {
  const mSelect = document.getElementById('late-month-select') || document.getElementById('monthly-month-select');
  const ySelect = document.getElementById('late-year-select') || document.getElementById('monthly-year-select');
  const deptSelect = document.getElementById('late-dept-select');
  const shiftSelect = document.getElementById('late-shift-select');
  const onlyLateCheck = document.getElementById('late-only-checkbox');

  const now = new Date();
  const month = mSelect ? mSelect.value : (now.getMonth() + 1);
  const year = ySelect ? ySelect.value : now.getFullYear();
  const dept = deptSelect ? deptSelect.value : 'ALL';
  const shift = shiftSelect ? shiftSelect.value : 'ALL';
  const onlyLate = onlyLateCheck ? onlyLateCheck.checked : true;

  const tbody = document.getElementById('monthly-late-table-tbody');
  if (tbody) {
    tbody.innerHTML = `<tr><td colspan="10" class="text-center py-12 text-slate-400 font-medium">
      <div class="inline-flex items-center space-x-2">
        <svg class="w-5 h-5 animate-spin text-brand-navy" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path></svg>
        <span>Loading monthly late punch data for ${month}/${year}...</span>
      </div>
    </td></tr>`;
  }

  try {
    const url = `/api/attendance/monthly-late-punches?year=${year}&month=${month}&only_late=${onlyLate}&department=${encodeURIComponent(dept)}&shift=${encodeURIComponent(shift)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to load late punches');
    const data = await res.json();
    monthlyLateCache = data;

    // Populate department options
    if (deptSelect && deptSelect.options.length <= 1) {
      const depts = new Set();
      (data.summary || []).forEach(s => { if (s.department) depts.add(s.department); });
      depts.forEach(d => {
        const opt = document.createElement('option');
        opt.value = d;
        opt.textContent = d;
        deptSelect.appendChild(opt);
      });
      deptSelect.value = dept;
    }

    // Populate KPIs
    const kpiStaff = document.getElementById('late-kpi-total-staff');
    const kpiLateStaff = document.getElementById('late-kpi-late-staff');
    const kpiPunches = document.getElementById('late-kpi-total-punches');
    const kpiTime = document.getElementById('late-kpi-total-time');
    const kpiPunctuality = document.getElementById('late-kpi-punctuality');
    const kpiCutoff = document.getElementById('late-kpi-cutoff');

    if (kpiStaff) kpiStaff.textContent = data.total_active_staff || 0;
    if (kpiLateStaff) kpiLateStaff.textContent = data.total_late_staff || 0;
    if (kpiPunches) kpiPunches.textContent = data.total_late_punches || 0;
    if (kpiTime) kpiTime.textContent = data.total_late_hours_text || '0m';
    if (kpiPunctuality) kpiPunctuality.textContent = `${data.overall_punctuality || 0}%`;
    if (kpiCutoff) kpiCutoff.textContent = data.cutoff_time || '09:05 AM';

    renderMonthlyLateTable(data);
  } catch (err) {
    console.error('Error loading monthly late data:', err);
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="10" class="text-center py-8 text-rose-500 font-medium">Failed to load monthly late punch report: ${err.message}</td></tr>`;
    }
  }
}

function setLateTableMode(mode) {
  lateTableMode = mode;
  const btnSum = document.getElementById('btn-late-mode-summary');
  const btnInc = document.getElementById('btn-late-mode-incidents');

  if (mode === 'incidents') {
    if (btnInc) btnInc.className = 'px-3 py-1 rounded-md font-bold text-brand-navy bg-white border border-blue-200 shadow-xs transition';
    if (btnSum) btnSum.className = 'px-3 py-1 rounded-md font-medium text-slate-600 hover:text-slate-900 transition';
  } else {
    if (btnInc) btnInc.className = 'px-3 py-1 rounded-md font-medium text-slate-600 hover:text-slate-900 transition';
    if (btnSum) btnSum.className = 'px-3 py-1 rounded-md font-bold text-brand-navy bg-white border border-blue-200 shadow-xs transition';
  }

  if (monthlyLateCache) {
    renderMonthlyLateTable(monthlyLateCache);
  }
}

function renderMonthlyLateTable(data) {
  const thead = document.getElementById('monthly-late-table-thead');
  const tbody = document.getElementById('monthly-late-table-tbody');
  if (!thead || !tbody || !data) return;

  const query = (document.getElementById('late-search-input')?.value || '').toLowerCase().trim();

  if (lateTableMode === 'incidents') {
    // Detailed Incidents Mode
    thead.innerHTML = `<tr>
      <th class="px-4 py-3 font-bold">Date</th>
      <th class="px-4 py-3 font-bold">Emp ID</th>
      <th class="px-4 py-3 font-bold">Employee Name</th>
      <th class="px-4 py-3 font-bold">Shift Timing</th>
      <th class="px-4 py-3 text-center font-bold">First IN (Time & Device)</th>
      <th class="px-4 py-3 text-center font-bold text-amber-900 bg-amber-50">Late Minutes</th>
      <th class="px-4 py-3 text-center font-bold">Cutoff (Grace)</th>
      <th class="px-4 py-3 text-center font-bold">Last OUT</th>
    </tr>`;

    let incidents = data.incidents || [];
    if (query) {
      incidents = incidents.filter(i =>
        (i.name && i.name.toLowerCase().includes(query)) ||
        (i.emp_code && i.emp_code.toLowerCase().includes(query)) ||
        (i.department && i.department.toLowerCase().includes(query)) ||
        (i.date && i.date.includes(query))
      );
    }

    if (incidents.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9" class="text-center py-8 text-slate-400 font-medium">No late arrival incidents recorded for selected month and filters</td></tr>`;
      return;
    }

    tbody.innerHTML = incidents.map(inc => `
      <tr class="hover:bg-slate-50 transition border-b border-slate-100">
        <td class="px-4 py-3 font-medium text-slate-900 whitespace-nowrap">${inc.date_str || inc.date}</td>
        <td class="px-4 py-3 font-mono font-semibold text-slate-800">${inc.emp_code}</td>
        <td class="px-4 py-3 font-medium text-slate-900">${inc.name}</td>
        <td class="px-4 py-3 text-slate-600 text-[11px]">${inc.shift}</td>
        <td class="px-4 py-3 text-center">
          <span class="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-xs font-bold bg-amber-50 text-amber-800 border border-amber-300 font-mono">
            <span>${inc.first_in}</span>
            <span class="text-[9px] bg-amber-200 text-amber-900 px-1 rounded uppercase font-extrabold">Late</span>
          </span>
          <div class="text-[9px] text-slate-400 mt-0.5 font-mono">${inc.first_in_device}</div>
        </td>
        <td class="px-4 py-3 text-center font-mono font-extrabold text-amber-700 bg-amber-50/50">
          +${inc.late_mins}m
        </td>
        <td class="px-4 py-3 text-center font-mono text-slate-500 text-xs">
          ${inc.cutoff_time}
        </td>
        <td class="px-4 py-3 text-center">
          ${inc.last_out !== '--' ? `
            <span class="font-mono text-slate-800 text-xs">${inc.last_out}</span>
            <div class="text-[9px] text-slate-400 font-mono">${inc.last_out_device}</div>
          ` : '<span class="text-slate-400 font-mono">--</span>'}
        </td>
      </tr>
    `).join('');
  } else {
    // Summary Ledger Mode
    thead.innerHTML = `<tr>
      <th class="px-4 py-3 font-bold">Emp ID</th>
      <th class="px-4 py-3 font-bold">Employee Name</th>
      <th class="px-4 py-3 font-bold">Shift Timing</th>
      <th class="px-3 py-3 text-center font-bold">Present Days</th>
      <th class="px-3 py-3 text-center font-bold text-amber-900 bg-amber-50">Late Count</th>
      <th class="px-3 py-3 text-center font-bold text-emerald-800 bg-emerald-50">On-Time Days</th>
      <th class="px-3 py-3 text-center font-bold">Punctuality %</th>
      <th class="px-3 py-3 text-center font-bold">Total Late Time</th>
      <th class="px-4 py-3 font-bold">Late Arrival Dates & Punches</th>
    </tr>`;

    let summary = data.summary || [];
    if (query) {
      summary = summary.filter(s =>
        (s.name && s.name.toLowerCase().includes(query)) ||
        (s.emp_code && s.emp_code.toLowerCase().includes(query)) ||
        (s.department && s.department.toLowerCase().includes(query))
      );
    }

    if (summary.length === 0) {
      tbody.innerHTML = `<tr><td colspan="10" class="text-center py-8 text-slate-400 font-medium">No employees found matching late punch criteria</td></tr>`;
      return;
    }

    tbody.innerHTML = summary.map(emp => {
      const isLateStaff = emp.late_punch_count > 0;
      const countBadge = isLateStaff
        ? `<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-extrabold bg-amber-100 text-amber-900 border border-amber-300 font-mono">${emp.late_punch_count}</span>`
        : `<span class="text-slate-400 font-mono">0</span>`;

      return `
        <tr class="hover:bg-slate-50 transition border-b border-slate-100 ${isLateStaff ? 'bg-amber-50/10' : ''}">
          <td class="px-4 py-3 font-mono font-semibold text-slate-800">${emp.emp_code}</td>
          <td class="px-4 py-3 font-medium text-slate-900">${emp.name}</td>
          <td class="px-4 py-3 text-slate-600 text-[11px]">${emp.shift}</td>
          <td class="px-3 py-3 text-center font-mono font-bold text-slate-800">${emp.present_days}</td>
          <td class="px-3 py-3 text-center bg-amber-50/40">${countBadge}</td>
          <td class="px-3 py-3 text-center font-mono font-bold text-emerald-700 bg-emerald-50/40">${emp.on_time_days}</td>
          <td class="px-3 py-3 text-center font-mono font-extrabold ${emp.punctuality_rate < 80 ? 'text-amber-700' : 'text-emerald-700'}">${emp.punctuality_rate}%</td>
          <td class="px-3 py-3 text-center font-mono font-bold ${isLateStaff ? 'text-rose-700' : 'text-slate-400'}">${emp.total_late_text}</td>
          <td class="px-4 py-3 text-xs text-slate-600 max-w-[280px]">
            ${emp.late_dates_list !== '--' ? `
              <div class="line-clamp-2 text-[11px] font-mono text-amber-900" title="${emp.late_dates_list}">
                ${emp.late_dates_list}
              </div>
            ` : '<span class="text-slate-400 font-mono">--</span>'}
          </td>
        </tr>
      `;
    }).join('');
  }
}

function filterLateTableLocal() {
  if (monthlyLateCache) {
    renderMonthlyLateTable(monthlyLateCache);
  }
}

function navigateLateMonth(dir) {
  const mSelect = document.getElementById('late-month-select');
  const ySelect = document.getElementById('late-year-select');
  if (!mSelect || !ySelect) return;
  let m = parseInt(mSelect.value, 10) + dir;
  let y = parseInt(ySelect.value, 10);
  if (m < 1) { m = 12; y -= 1; }
  else if (m > 12) { m = 1; y += 1; }
  mSelect.value = String(m);
  ySelect.value = String(y);
  loadMonthlyLateData();
}

function exportMonthlyLateExcel() {
  const m = document.getElementById('late-month-select')?.value || 11;
  const y = document.getElementById('late-year-select')?.value || 2026;
  const dept = document.getElementById('late-dept-select')?.value || 'ALL';
  const shift = document.getElementById('late-shift-select')?.value || 'ALL';
  window.location.href = `/api/attendance/export/monthly-late-excel?year=${y}&month=${m}&department=${encodeURIComponent(dept)}&shift=${encodeURIComponent(shift)}`;
}

function exportMonthlyLateCSV() {
  const m = document.getElementById('late-month-select')?.value || 11;
  const y = document.getElementById('late-year-select')?.value || 2026;
  const dept = document.getElementById('late-dept-select')?.value || 'ALL';
  const shift = document.getElementById('late-shift-select')?.value || 'ALL';
  const onlyLate = document.getElementById('late-only-checkbox')?.checked ? 'true' : 'false';
  window.location.href = `/api/attendance/export/monthly-late-csv?year=${y}&month=${m}&only_late=${onlyLate}&department=${encodeURIComponent(dept)}&shift=${encodeURIComponent(shift)}`;
}


// ================= AUTHENTICATION & USER SESSION =================
async function initUserProfile() {
  try {
    let user = null;
    try {
      const cached = localStorage.getItem('auth_user');
      if (cached) user = JSON.parse(cached);
    } catch (e) {}

    const res = await fetch('/api/auth/me');
    if (res.ok) {
      const data = await res.json();
      if (data.authenticated && data.user) {
        user = data.user;
        try { localStorage.setItem('auth_user', JSON.stringify(user)); } catch (e) {}
      }
    } else if (res.status === 401) {
      window.location.href = '/login';
      return;
    }

    if (user) {
      const nameEl = document.getElementById('sidebar-user-name') || document.getElementById('header-user-name');
      const roleEl = document.getElementById('sidebar-user-role') || document.getElementById('header-user-role');
      const avatarEl = document.getElementById('sidebar-user-avatar') || document.getElementById('header-user-avatar');
      if (nameEl) nameEl.textContent = user.name || user.username || 'Centizen Administrator';
      if (roleEl) roleEl.textContent = user.role || 'Administrator';
      if (avatarEl) {
        const initial = (user.name || user.username || 'C').charAt(0).toUpperCase();
        avatarEl.textContent = initial;
      }
    }
  } catch (err) {
    console.warn('initUserProfile error:', err);
  }
}

async function handleLogout() {
  if (!confirm('Are you sure you want to sign out of the Centizen Attendance Portal?')) {
    return;
  }
  try {
    await fetch('/api/auth/logout', { method: 'POST' });
  } catch (e) {}
  try {
    localStorage.removeItem('auth_user');
    localStorage.removeItem('session_token');
  } catch (e) {}
  window.location.href = '/login';
}


// ================= REAL-TIME SUB-SECOND BIOMETRIC AUTO-SYNC (< 1s) =================
let livePunchVersion = 0;
let liveEventSource = null;

function initLiveBiometricSync() {
  console.log('⚡ Initializing real-time biometric auto-sync (< 1s latency)...');
  connectLiveEventStream();
  setInterval(pollLiveStatusHeartbeat, 1000);
}

function connectLiveEventStream() {
  if (!window.EventSource) return;

  try {
    if (liveEventSource) {
      liveEventSource.close();
    }

    liveEventSource = new EventSource('/api/attendance/live-stream');

    liveEventSource.onmessage = function(e) {
      if (!e.data) return;
      try {
        const payload = JSON.parse(e.data);
        if (payload.type === 'connected') {
          livePunchVersion = payload.version || livePunchVersion;
          console.log('⚡ Live biometric stream connected at version:', livePunchVersion);
        } else if (payload.type === 'new_punch') {
          console.log('⚡ REAL-TIME PUNCH ARRIVED:', payload);
          livePunchVersion = payload.version || (livePunchVersion + 1);
          handleLivePunchArrival(payload);
        } else if (payload.type === 'catchup_synced') {
          livePunchVersion = payload.version || (livePunchVersion + 1);
          silentRefreshActiveTab();
        }
      } catch (err) {
        console.warn('Error parsing live stream event:', err);
      }
    };

    liveEventSource.onerror = function() {
      if (liveEventSource.readyState === EventSource.CLOSED) {
        setTimeout(connectLiveEventStream, 2000);
      }
    };
  } catch (err) {
    console.warn('Live EventSource setup error:', err);
  }
}

async function pollLiveStatusHeartbeat() {
  // Ultra-fast 1-second fallback poll to ensure 100% sub-second synchronization
  try {
    const res = await fetch('/api/attendance/live-status');
    if (!res.ok) return;
    const data = await res.json();
    if (data && data.version) {
      if (livePunchVersion === 0) {
        livePunchVersion = data.version;
      } else if (data.version > livePunchVersion) {
        console.log(`⚡ Punch version changed: ${livePunchVersion} -> ${data.version}, refreshing dashboard...`);
        livePunchVersion = data.version;
        if (data.last_punch) {
          handleLivePunchArrival(data.last_punch);
        } else {
          silentRefreshActiveTab();
        }
      }
    }
  } catch (e) {
    // Ignore transient poll blips
  }
}

function handleLivePunchArrival(punch) {
  // 1. Show live toast banner
  showLivePunchToast(punch);

  // 2. Refresh active tab data in real-time without screen flickering
  silentRefreshActiveTab();
}

function showLivePunchToast(punch) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = 'pointer-events-auto px-4 py-2.5 rounded-xl shadow-xl text-xs font-semibold flex items-center space-x-2.5 transition-all transform duration-200 animate-fadeIn bg-slate-900 text-white border border-brand-orange/60 shadow-brand-orange/20';

  const punchTypeBadge = punch.punch_type === 1 
    ? '<span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">OUT</span>' 
    : '<span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">IN</span>';

  toast.innerHTML = `
    <span class="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping flex-shrink-0"></span>
    <div class="flex items-center space-x-1.5 truncate">
      <span class="text-brand-orange font-bold">⚡ Live Punch:</span>
      <span class="font-bold text-white">${punch.name || ('Emp #' + punch.emp_code)}</span>
      ${punchTypeBadge}
      <span class="text-slate-300">at ${punch.device || 'Door'}</span>
      <span class="font-mono text-emerald-300">(${punch.time_str || punch.timestamp})</span>
    </div>
  `;

  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-10px)';
    setTimeout(() => toast.remove(), 250);
  }, 4500);
}

function silentRefreshActiveTab() {
  if (currentTab === 'dashboard') {
    loadDashboardData();
  } else if (currentTab === 'reports') {
    loadDailyReport();
  } else if (currentTab === 'devices') {
    loadDevicesData();
  }
}
