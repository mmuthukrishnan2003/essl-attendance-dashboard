// Centizen eSSL Attendance Management System Frontend Application

let currentTab = 'dashboard';
let weeklyChart = null;
let allEmployeesCache = [];
let todayAttendanceCache = [];
let reportAttendanceCache = [];

document.addEventListener('DOMContentLoaded', () => {
  const savedZoom = localStorage.getItem('dashboard_zoom') || '90%';
  setDashboardZoom(savedZoom);
  initLiveClock();
  initDefaults();
  loadDashboardData();
  loadDevicesData();
  loadSettings();
});

// ================= ZOOM CONTROL =================
function setDashboardZoom(val = '90%') {
  document.body.style.zoom = val;
  try {
    localStorage.setItem('dashboard_zoom', val);
  } catch (e) {}

  ['85', '90', '100'].forEach(z => {
    const btn = document.getElementById(`zoom-btn-${z}`);
    if (btn) {
      if (`${z}%` === val) {
        btn.className = 'px-2 py-1 rounded text-[11px] bg-white text-brand-navy shadow-xs font-bold transition';
      } else {
        btn.className = 'px-2 py-1 rounded text-[11px] font-medium text-slate-600 hover:text-slate-900 transition';
      }
    }
  });
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
function switchTab(tabId) {
  currentTab = tabId;

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
  const activeView = document.getElementById(`view-${tabId}`);
  if (activeView) activeView.classList.remove('hidden');

  // Trigger relevant data load
  if (tabId === 'dashboard') loadDashboardData();
  else if (tabId === 'reports') loadDailyReport();
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

    // Render Weekly Attendance Chart
    renderWeeklyChart(data.weekly_trend);

    // Render Live Punch Feed
    renderLivePunchFeed(data.recent_feed);

    // Render Today's summary table
    todayAttendanceCache = data.today_attendance || [];
    filterTodayTable();

  } catch (err) {
    console.error('Error loading dashboard:', err);
    showToast('Could not load dashboard data', 'error');
  }
}

function renderWeeklyChart(trendData) {
  const canvas = document.getElementById('weeklyAttendanceChart');
  if (!canvas) return;

  const labels = trendData.map(d => `${d.day} (${d.date})`);
  const presentData = trendData.map(d => d.present);
  const absentData = trendData.map(d => d.absent);

  if (weeklyChart) {
    weeklyChart.destroy();
  }

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
        // datasetIndex 0 is Present, datasetIndex 1 is Absent
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
            generateLabels: (chart) => {
              return [
                {
                  text: 'Present (On-Time / Active)',
                  fillStyle: '#0a5482',
                  strokeStyle: '#0a5482',
                  lineWidth: 0,
                  hidden: false,
                  index: 0
                },
                {
                  text: 'Absent (No Punches - Red)',
                  fillStyle: '#ef4444',
                  strokeStyle: '#ef4444',
                  lineWidth: 0,
                  hidden: false,
                  index: 1
                }
              ];
            }
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

  // Update filter badge
  if (badge) {
    if (type === 'PRESENT') {
      const presCount = todayAttendanceCache.filter(r => (r.total_punches > 0 || r.first_in)).length;
      badge.className = 'text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 inline-flex items-center space-x-1.5';
      badge.innerHTML = `<span>Showing Present Staff (${presCount})</span><button type="button" onclick="setTodayFilter('ALL')" class="ml-1 text-xs font-bold hover:text-emerald-950">&times;</button>`;
      badge.classList.remove('hidden');
    } else if (type === 'ABSENT') {
      const absCount = todayAttendanceCache.filter(r => (!r.total_punches || r.total_punches === 0)).length;
      badge.className = 'text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-300 inline-flex items-center space-x-1.5';
      badge.innerHTML = `<span>Showing Absent Staff (${absCount})</span><button type="button" onclick="setTodayFilter('ALL')" class="ml-1 text-xs font-bold hover:text-rose-950">&times;</button>`;
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
    filtered = filtered.filter(r => (r.total_punches > 0 || r.first_in));
  } else if (currentTodayFilter === 'ABSENT') {
    filtered = filtered.filter(r => (!r.total_punches || r.total_punches === 0));
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
    let shiftBadge = 'bg-blue-50 text-blue-800 border-blue-200';
    if (r.is_night_shift || (r.shift && r.shift.toLowerCase().includes('night'))) {
      shiftBadge = 'bg-indigo-50 text-indigo-800 border-indigo-200';
    } else if (r.shift && r.shift.includes('07:00')) {
      shiftBadge = 'bg-amber-50 text-amber-800 border-amber-200';
    }

    const isPresent = Boolean(r.first_in || r.total_punches > 0);

    return `
      <tr class="hover:bg-slate-50 transition ${!isPresent ? 'bg-rose-50/20' : ''}">
        <td class="px-4 py-3 font-mono font-semibold text-slate-800">${r.emp_code}</td>
        <td class="px-4 py-3 font-medium text-slate-900">${r.name}</td>
        <td class="px-4 py-3 text-slate-600">${r.department}</td>
        <td class="px-4 py-3 text-center">
          <span class="inline-flex px-2 py-0.5 rounded-md text-[10px] font-semibold border ${shiftBadge}">
            ${r.shift}
          </span>
        </td>
        <td class="px-4 py-3 text-center">
          ${isPresent ? `
            <span class="font-mono font-bold text-emerald-700">${r.first_in_time}</span>
          ` : `
            <span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-600 border border-rose-200">
              Absent
            </span>
          `}
        </td>
        <td class="px-4 py-3 text-center">
          ${r.last_out ? `
            <span class="font-mono font-semibold text-blue-700">${r.last_out_time}</span>
          ` : (r.is_in_office ? `
            <span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200" title="Punched IN and currently active inside office">
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1 animate-pulse"></span>In Office
            </span>
          ` : '<span class="text-slate-400 font-mono">--</span>')}
        </td>
        <td class="px-4 py-3 text-center">
          <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${isPresent ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500'}">
            ${r.total_punches}
          </span>
        </td>
        <td class="px-4 py-3 text-right">
          <button onclick="viewEmployeePunches('${r.emp_code}', '${r.date}')" class="text-xs font-semibold text-brand-navy hover:underline">
            View Punches
          </button>
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
    const bAvg = document.getElementById('report-banner-avg');

    if (bDate) bDate.textContent = data.date;
    if (bTotal) bTotal.textContent = data.total_employees;
    if (bIn) bIn.textContent = data.punched_in_count;
    if (bOut) bOut.textContent = data.punched_out_count;
    if (bAbs) bAbs.textContent = data.absent_count;
    if (bAvg) bAvg.textContent = data.avg_working_hours;

    reportAttendanceCache = data.records || [];
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
    let shiftBadge = 'bg-blue-50 text-blue-800 border-blue-200';
    if (r.is_night_shift || (r.shift && r.shift.toLowerCase().includes('night'))) {
      shiftBadge = 'bg-indigo-50 text-indigo-800 border-indigo-200';
    } else if (r.shift && r.shift.includes('07:00')) {
      shiftBadge = 'bg-amber-50 text-amber-800 border-amber-200';
    }

    const isPresent = Boolean(r.first_in || (r.total_punches && r.total_punches > 0));

    return `
      <tr class="hover:bg-slate-50 transition ${!isPresent ? 'bg-rose-50/20' : ''}">
        <td class="px-4 py-3 font-mono text-slate-500 whitespace-nowrap">${r.date}</td>
        <td class="px-4 py-3 font-mono font-semibold text-slate-800">${r.emp_code}</td>
        <td class="px-4 py-3 font-medium text-slate-900">${r.name}</td>
        <td class="px-4 py-3 text-slate-600">${r.department}</td>
        <td class="px-4 py-3 text-center">
          <span class="inline-flex px-2 py-0.5 rounded-md text-[10px] font-semibold border ${shiftBadge}">
            ${r.shift}
          </span>
        </td>
        
        <!-- First IN -->
        <td class="px-4 py-3 text-center">
          ${isPresent ? `
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
          ${r.last_out ? `
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
            <button onclick="viewEmployeePunches('${r.emp_code}', '${r.date}')" class="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition">
              ${r.intermediate_count} punches
            </button>
          ` : '<span class="text-slate-400">0</span>'}
        </td>

        <!-- Action Drilldown -->
        <td class="px-4 py-3 text-center">
          <button onclick="viewEmployeePunches('${r.emp_code}', '${r.date}')" class="inline-flex items-center space-x-1 px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition">
            <svg class="w-3.5 h-3.5 text-brand-navy" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
            <span>Timeline</span>
          </button>
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
    filtered = filtered.filter(r => (r.total_punches > 0 || r.first_in));
  } else if (statusFilter === 'ABSENT') {
    filtered = filtered.filter(r => (!r.total_punches || r.total_punches === 0));
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
    document.getElementById('modal-punches-subtitle').textContent = `Department: ${data.department} • Date: ${data.date}`;
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

    allEmployeesCache = data.employees || [];
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

  tbody.innerHTML = employees.map(e => `
    <tr class="hover:bg-slate-50 transition">
      <td class="px-4 py-3 font-mono font-bold text-slate-800">${e.emp_code}</td>
      <td class="px-4 py-3 font-medium text-slate-900">${e.name}</td>
      <td class="px-4 py-3 text-slate-600">${e.department}</td>
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
  if (code === 'SHIFT_9_7') {
    document.getElementById('emp-form-shift-start').value = '09:00';
    document.getElementById('emp-form-shift-end').value = '19:00';
  } else if (code === 'SHIFT_9_6') {
    document.getElementById('emp-form-shift-start').value = '09:00';
    document.getElementById('emp-form-shift-end').value = '18:00';
  } else if (code === 'SHIFT_NIGHT') {
    document.getElementById('emp-form-shift-start').value = '21:00';
    document.getElementById('emp-form-shift-end').value = '06:00';
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
async function loadDevicesData() {
  try {
    const res = await fetch('/api/devices');
    if (!res.ok) throw new Error('Failed to load devices');
    const data = await res.json();

    const devices = data.devices || [];
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
        <span class="font-mono text-[11px]">${d.ip_address}</span>
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
          <button onclick="testDeviceConnection(${d.id})" class="inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition">
            <svg class="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
            <span>Test Ping</span>
          </button>

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
    if (subTitle) {
      if (isPostgres) {
        subTitle.innerHTML = `<strong class="text-blue-700">PostgreSQL (local essl)</strong> &bull; Database: <strong>${dbName}</strong> &bull; Host: <strong>${data.host_endpoint || '127.0.0.1:5432'}</strong> &bull; Schema: <strong>public</strong>`;
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
      <span class="font-medium">Testing connection to <strong>${host}:${port}</strong> (database: <strong>${dbname}</strong>, user: <strong>${user}</strong>)...</span>
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
        user: user,
        password: password,
        engine_type: 'postgres'
      })
    });

    const data = await res.json();

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
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-emerald-200 text-[11px] font-mono text-emerald-900">
          <div><span class="text-emerald-600 font-sans block text-[10px] font-semibold">SERVER ENDPOINT</span>${data.host}:${data.port}</div>
          <div><span class="text-emerald-600 font-sans block text-[10px] font-semibold">DATABASE NAME</span>${data.database}</div>
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
  const user = document.getElementById('pg-user-input').value.trim() || 'postgres';
  const password = document.getElementById('pg-pass-input').value;
  const btn = document.getElementById('btn-pg-connect');
  const feedback = document.getElementById('pg-connect-feedback');

  btn.disabled = true;
  btn.innerHTML = '<span class="inline-block animate-spin mr-1">↻</span> Connecting...';
  feedback.classList.remove('hidden');
  feedback.className = 'p-3.5 rounded-xl text-xs bg-blue-50 text-blue-800 border border-blue-200';
  feedback.textContent = `Connecting to PostgreSQL 'local essl' on ${host}:${port} (database: ${dbname})...`;

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
        schema_name: 'public'
      })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Connection failed');

    feedback.className = 'p-4 rounded-xl text-xs bg-emerald-50 text-emerald-950 border border-emerald-300 shadow-xs space-y-2';
    feedback.innerHTML = `
      <div class="flex items-center space-x-2">
        <span class="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs">✓</span>
        <span class="font-bold text-emerald-900 text-sm">Switched to New PostgreSQL Database!</span>
      </div>
      <p class="text-emerald-800 font-medium">${data.message}</p>
      <div class="text-[11px] text-emerald-800 bg-emerald-100/60 p-2.5 rounded-lg border border-emerald-200">
        <strong>Active Database Status:</strong> Currently connected to <strong>${dbname}</strong> on <strong>${host}:${port}</strong>. All live attendance logs, employee masters, and reports are now syncing with this database.
      </div>
    `;

    showToast(`Connected to PostgreSQL 'local essl' (${dbname})!`, 'success');

    // Reload all dashboard and schema data
    loadDatabaseData();
    loadDashboardData();
    loadDevicesData();

  } catch (err) {
    feedback.className = 'p-4 rounded-xl text-xs bg-rose-50 text-rose-800 border border-rose-200';
    feedback.textContent = `✕ ${err.message}`;
    showToast(err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<svg class="w-4 h-4 mr-1.5 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg><span>Connect to local essl</span>`;
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
      feedback.className = 'p-3.5 rounded-xl text-xs bg-slate-100 text-slate-800 border border-slate-300 shadow-xs';
      feedback.innerHTML = `
        <div class="flex items-center space-x-2 font-medium">
          <span class="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
          <span>Active database switched back to default embedded SQLite (<strong>attendance.db</strong>).</span>
        </div>
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

async function loadShiftsData() {
  try {
    const res = await fetch('/api/shifts');
    if (!res.ok) throw new Error('Failed to load shifts');
    const data = await res.json();

    allShiftsCache = data.shifts || [];
    renderShiftsCards(allShiftsCache);

    // If employees not loaded yet, fetch them
    if (!allEmployeesCache || allEmployeesCache.length === 0) {
      const empRes = await fetch('/api/employees');
      if (empRes.ok) {
        const empData = await empRes.json();
        allEmployeesCache = empData.employees || [];
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

    if (s.is_night_shift) {
      cardBadge = 'bg-indigo-50 text-indigo-700 border-indigo-200';
      durationText = '9 Hours (Overnight Next-Day)';
      iconBg = 'bg-indigo-100 text-indigo-700';
    } else if (s.end_time === '19:00') {
      cardBadge = 'bg-amber-50 text-amber-800 border-amber-200';
      durationText = '10 Hours';
      iconBg = 'bg-amber-100 text-amber-800';
    }

    return `
      <div class="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex flex-col justify-between hover:border-brand-navy transition">
        <div>
          <div class="flex items-start justify-between">
            <div class="w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center font-bold text-sm">
              ${s.is_night_shift ? '🌙' : '☀️'}
            </div>
            <span class="inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold border ${cardBadge}">
              ${s.is_night_shift ? 'Night Shift' : 'Day Shift'}
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
      <td class="px-4 py-3 text-slate-600">${e.department}</td>
      <td class="px-4 py-3 text-center">
        <span class="inline-flex px-2.5 py-0.5 rounded-md text-[11px] font-semibold ${
          (e.shift_code === 'SHIFT_NIGHT' || (e.shift_name && e.shift_name.toLowerCase().includes('night')))
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
          ${(shifts || []).map(s => `<option value="${s.code}" ${s.code === e.shift_code ? 'selected' : ''}>${s.name}</option>`).join('')}
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
  openModal('modal-shift');
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


