import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AttendanceService } from '../../services/attendance.service';

@Component({
  selector: 'app-daily-reports',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="space-y-5">
      <!-- PAGE HEADER -->
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-xl font-bold text-slate-800 tracking-tight">Daily IN/OUT & Reports</h1>
          <p class="text-xs text-slate-500 mt-0.5">Comprehensive daily attendance, punch timings & duration ledger</p>
        </div>
      </div>

      <!-- FILTER CONTROLS CARD (Matches mobile phone card layout) -->
      <div class="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-sm space-y-4">
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          <!-- FROM DATE -->
          <div>
            <label class="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">From Date</label>
            <input
              type="date"
              [(ngModel)]="fromDate"
              (change)="loadData()"
              class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#0A5482] focus:bg-white transition"
            />
          </div>

          <!-- TO DATE -->
          <div>
            <label class="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">To Date</label>
            <input
              type="date"
              [(ngModel)]="toDate"
              (change)="loadData()"
              class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#0A5482] focus:bg-white transition"
            />
          </div>

          <!-- ATTENDANCE STATUS -->
          <div>
            <label class="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Attendance</label>
            <select
              [(ngModel)]="attendanceFilter"
              class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#0A5482] focus:bg-white transition"
            >
              <option value="ALL">All Staff</option>
              <option value="PRESENT">Present Only</option>
              <option value="LATE">Late Arrivals</option>
              <option value="ABSENT">Absent Only</option>
              <option value="WFH">WFH Only</option>
            </select>
          </div>

          <!-- SHIFT TIMING -->
          <div>
            <label class="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Shift Timing</label>
            <select
              [(ngModel)]="selectedShift"
              (change)="loadData()"
              class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#0A5482] focus:bg-white transition"
            >
              <option value="ALL">All Shifts</option>
              <option value="SHIFT_9_7">General Shift (09:00 AM - 07:00 PM)</option>
              <option value="SHIFT_9_6">Standard Shift (09:00 AM - 06:00 PM)</option>
              <option value="SHIFT_WFH">Work From Home (WFH)</option>
            </select>
          </div>
        </div>

        <!-- SEARCH INPUT -->
        <div>
          <label class="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Search Employee</label>
          <div class="relative w-full">
            <span class="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
              <i class="fa-solid fa-magnifying-glass text-xs"></i>
            </span>
            <input
              type="text"
              [(ngModel)]="searchQuery"
              placeholder="Name or Emp Code..."
              class="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-[#0A5482] focus:bg-white transition"
            />
          </div>
        </div>

        <!-- ACTION BUTTONS STRIP -->
        <div class="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
          <!-- Refresh -->
          <button
            (click)="loadData()"
            [disabled]="loading()"
            class="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-sm transition"
          >
            <i class="fa-solid fa-arrows-rotate text-xs" [ngClass]="{'fa-spin': loading()}"></i>
            <span>Refresh</span>
          </button>

          <!-- Export Excel -->
          <button
            (click)="exportExcel()"
            class="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-sm transition"
          >
            <i class="fa-solid fa-file-excel text-xs"></i>
            <span>Export Excel</span>
          </button>

          <!-- Export CSV -->
          <button
            (click)="exportCsv()"
            class="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-sm transition"
          >
            <i class="fa-solid fa-file-csv text-xs"></i>
            <span>CSV</span>
          </button>

          <!-- Print -->
          <button
            (click)="printReport()"
            class="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-sm transition"
          >
            <i class="fa-solid fa-print text-xs"></i>
            <span>Print</span>
          </button>
        </div>

        <!-- SUMMARY COUNTERS BAR (Matches screenshot) -->
        <div class="pt-3 border-t border-slate-100">
          <div class="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs">
            <div>
              <span class="text-slate-400 font-medium">Report Date: </span>
              <span class="font-bold text-slate-800">{{ dailyData()?.date || '--' }}</span>
            </div>
            <div>
              <span class="text-slate-400 font-medium">Total Staff: </span>
              <span class="font-bold text-slate-800">{{ dailyData()?.total_employees || '--' }}</span>
            </div>
            <div>
              <span class="text-slate-400 font-medium">Present: </span>
              <span class="font-bold text-emerald-600">{{ dailyData()?.present_today || '--' }}</span>
            </div>
            <div>
              <span class="text-slate-400 font-medium">Absent: </span>
              <span class="font-bold text-rose-500">{{ dailyData()?.absent_today || '--' }}</span>
            </div>
            <div>
              <span class="text-slate-400 font-medium">WFH: </span>
              <span class="font-bold text-blue-600">{{ dailyData()?.wfh_today || '--' }}</span>
            </div>
            <div>
              <span class="text-slate-400 font-medium">Punched OUT: </span>
              <span class="font-bold text-slate-700">{{ dailyData()?.punched_out_count || '--' }}</span>
            </div>
          </div>
          <p class="text-[10px] text-slate-400 mt-2 font-medium">
            * First IN & Last OUT calculated automatically across all 4 devices
          </p>
        </div>
      </div>

      <!-- TABLE CONTAINER -->
      <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse text-xs whitespace-nowrap">
            <thead>
              <tr class="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                <th *ngIf="dailyData()?.is_range" class="py-3 px-4">Date</th>
                <th class="py-3 px-4">Emp Code</th>
                <th class="py-3 px-4">Employee Name ▲ A-Z</th>
                <th class="py-3 px-4">Shift</th>
                <th class="py-3 px-4 text-center">First IN</th>
                <th class="py-3 px-4 text-center">Last OUT</th>
                <th class="py-3 px-4 text-center">Working Hours</th>
                <th class="py-3 px-4 text-center">Morning OT</th>
                <th class="py-3 px-4 text-center">Evening OT</th>
                <th class="py-3 px-4 text-center">Total OT</th>
                <th class="py-3 px-4 text-center">Status</th>
                <th class="py-3 px-4 text-center">Punches</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <!-- LOADING ROW -->
              <tr *ngIf="loading()">
                <td [attr.colspan]="dailyData()?.is_range ? 12 : 11" class="py-12 text-center text-slate-400">
                  <i class="fa-solid fa-circle-notch fa-spin text-2xl mb-2 text-[#0A5482]"></i>
                  <p class="text-xs font-medium">Calculating attendance for {{ fromDate }} to {{ toDate }}...</p>
                </td>
              </tr>

              <!-- EMPTY ROW -->
              <tr *ngIf="!loading() && filteredRecords().length === 0">
                <td [attr.colspan]="dailyData()?.is_range ? 12 : 11" class="py-12 text-center text-slate-400">
                  <i class="fa-solid fa-calendar-xmark text-2xl mb-2 text-slate-300"></i>
                  <p class="text-xs font-semibold">No attendance records found for this criteria.</p>
                </td>
              </tr>

              <!-- DATA ROWS -->
              <tr *ngFor="let emp of filteredRecords()" class="hover:bg-slate-50/80 transition">
                <td *ngIf="dailyData()?.is_range" class="py-3 px-4 font-semibold text-slate-600">{{ emp.date }}</td>
                <td class="py-3 px-4 font-bold text-slate-700">{{ emp.emp_code }}</td>
                <td class="py-3 px-4 font-semibold text-slate-800">{{ emp.name }}</td>
                <td class="py-3 px-4 text-slate-500 text-[11px]">{{ emp.shift_name }}</td>
                <td class="py-3 px-4 text-center">
                  <span [class]="emp.is_late ? 'text-amber-600 font-bold' : 'text-slate-700 font-medium'">
                    {{ emp.first_in_time }}
                  </span>
                </td>
                <td class="py-3 px-4 text-center font-medium text-slate-700">
                  <span *ngIf="emp.is_in_office" class="text-emerald-600 font-bold">In Office</span>
                  <span *ngIf="!emp.is_in_office">{{ emp.last_out_time }}</span>
                </td>
                <td class="py-3 px-4 text-center font-bold text-slate-700">{{ emp.duration }}</td>
                <td class="py-3 px-4 text-center text-slate-600">{{ emp.morning_ot }}</td>
                <td class="py-3 px-4 text-center text-slate-600">{{ emp.evening_ot }}</td>
                <td class="py-3 px-4 text-center font-bold text-[#F27E20]">{{ emp.total_ot }}</td>
                <td class="py-3 px-4 text-center">
                  <span
                    [ngClass]="{
                      'bg-emerald-50 text-emerald-700 border-emerald-200': emp.status === 'Present',
                      'bg-amber-50 text-amber-700 border-amber-200': emp.status === 'Late',
                      'bg-rose-50 text-rose-700 border-rose-200': emp.status === 'Absent',
                      'bg-blue-50 text-blue-700 border-blue-200': emp.status === 'WFH'
                    }"
                    class="px-2 py-0.5 rounded-full text-[10px] font-bold border"
                  >
                    {{ emp.status }}
                  </span>
                </td>
                <td class="py-3 px-4 text-center">
                  <button
                    (click)="openPunchDetail(emp)"
                    class="px-2 py-1 rounded bg-slate-100 hover:bg-[#0A5482] hover:text-white font-semibold text-[10px] text-slate-700 transition"
                  >
                    {{ emp.total_punches }} punches
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- PUNCH DRILLDOWN MODAL -->
      <div *ngIf="selectedEmp()" class="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div class="bg-white rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden border border-slate-100">
          <div class="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
            <div>
              <h3 class="font-bold text-slate-800 text-sm">Punches Detail</h3>
              <p class="text-xs text-slate-500 mt-0.5">{{ selectedEmp()?.name }} (ID: {{ selectedEmp()?.emp_code }})</p>
            </div>
            <button (click)="closePunchDetail()" class="text-slate-400 hover:text-slate-600 text-sm p-1 rounded-lg">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>

          <div class="p-5 max-h-96 overflow-y-auto space-y-2">
            <div
              *ngFor="let p of punchDetails()"
              class="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50/50"
            >
              <div class="flex items-center gap-3">
                <span
                  [class]="p.punch_type === 'IN' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'"
                  class="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold"
                >
                  {{ p.punch_type }}
                </span>
                <div>
                  <div class="text-xs font-bold text-slate-800">{{ p.time }}</div>
                  <div class="text-[10px] text-slate-400 font-medium">{{ p.device_name }}</div>
                </div>
              </div>
              <div>
                <span class="text-[10px] font-semibold text-slate-500 px-2 py-0.5 rounded-full bg-slate-200">
                  {{ p.label }}
                </span>
              </div>
            </div>
          </div>

          <div class="p-4 border-t border-slate-100 bg-slate-50 text-right">
            <button
              (click)="closePunchDetail()"
              class="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold rounded-xl transition"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  `
})
export class DailyReportsComponent implements OnInit {
  dailyData = signal<any>(null);
  records = signal<any[]>([]);
  loading = signal(false);

  // Default date range: 1st of month to today
  fromDate = '';
  toDate = '';
  attendanceFilter = 'ALL';
  selectedShift = 'ALL';
  searchQuery = '';

  selectedEmp = signal<any>(null);
  punchDetails = signal<any[]>([]);

  constructor(private attendanceService: AttendanceService) {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    this.fromDate = `${y}-${m}-01`;
    this.toDate = now.toISOString().split('T')[0];
  }

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.loading.set(true);
    this.attendanceService.getDaily(
      this.fromDate,
      this.toDate,
      'ALL',
      this.selectedShift
    ).subscribe({
      next: (res) => {
        this.dailyData.set(res);
        this.records.set(res.records || []);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  filteredRecords(): any[] {
    let list = this.records();

    if (this.attendanceFilter === 'PRESENT') {
      list = list.filter(r => r.is_present);
    } else if (this.attendanceFilter === 'LATE') {
      list = list.filter(r => r.is_late);
    } else if (this.attendanceFilter === 'ABSENT') {
      list = list.filter(r => !r.is_present && !r.is_wfh);
    } else if (this.attendanceFilter === 'WFH') {
      list = list.filter(r => r.is_wfh);
    }

    if (this.searchQuery.trim()) {
      const q = this.searchQuery.trim().toLowerCase();
      list = list.filter(r =>
        (r.name || '').toLowerCase().includes(q) ||
        (r.emp_code || '').toLowerCase().includes(q)
      );
    }
    return list;
  }

  openPunchDetail(emp: any): void {
    this.selectedEmp.set(emp);
    const targetDate = emp.date || this.fromDate;
    this.attendanceService.getEmployeePunches(emp.emp_code, targetDate).subscribe({
      next: (res) => {
        this.punchDetails.set(res.items || []);
      }
    });
  }

  closePunchDetail(): void {
    this.selectedEmp.set(null);
    this.punchDetails.set([]);
  }

  exportExcel(): void {
    const now = new Date();
    const url = this.attendanceService.getExportExcelUrl(now.getFullYear(), now.getMonth() + 1);
    window.open(url, '_blank');
  }

  exportCsv(): void {
    const now = new Date();
    const url = this.attendanceService.getExportCsvUrl(now.getFullYear(), now.getMonth() + 1);
    window.open(url, '_blank');
  }

  printReport(): void {
    window.print();
  }
}
