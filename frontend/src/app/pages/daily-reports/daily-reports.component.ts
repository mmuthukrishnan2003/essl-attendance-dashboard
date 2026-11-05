import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AttendanceService } from '../../services/attendance.service';

@Component({
  selector: 'app-daily-reports',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="space-y-6">
      <!-- HEADER -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 class="text-xl font-bold text-slate-800 tracking-tight">Daily IN/OUT & Reports</h1>
          <p class="text-xs text-slate-500 mt-0.5">Comprehensive daily biometric punch logs, overtime, and working durations</p>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <!-- Date Picker -->
          <input
            type="date"
            [(ngModel)]="selectedDate"
            (change)="loadData()"
            class="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#0A5482]"
          />

          <!-- Shift Filter -->
          <select
            [(ngModel)]="selectedShift"
            (change)="loadData()"
            class="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none"
          >
            <option value="ALL">All Shifts</option>
            <option value="SHIFT_9_7">General Shift (9-7)</option>
            <option value="SHIFT_9_6">Standard Shift (9-6)</option>
            <option value="SHIFT_WFH">WFH</option>
          </select>

          <!-- Refresh -->
          <button
            (click)="loadData()"
            [disabled]="loading()"
            class="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-sm transition"
          >
            <i class="fa-solid fa-arrows-rotate text-xs" [ngClass]="{'fa-spin': loading()}"></i>
            <span>Refresh</span>
          </button>
        </div>
      </div>

      <!-- SUMMARY STRIP -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div class="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
          <div class="text-[10px] font-bold text-slate-400 uppercase">Total Scheduled</div>
          <div class="text-xl font-black text-slate-800 mt-0.5">{{ dailyData()?.total_employees || 0 }}</div>
        </div>
        <div class="bg-white p-3.5 rounded-xl border border-emerald-100 shadow-sm">
          <div class="text-[10px] font-bold text-emerald-600 uppercase">Present</div>
          <div class="text-xl font-black text-emerald-600 mt-0.5">{{ dailyData()?.present_today || 0 }}</div>
        </div>
        <div class="bg-white p-3.5 rounded-xl border border-amber-100 shadow-sm">
          <div class="text-[10px] font-bold text-amber-600 uppercase">Late (> 09:05 AM)</div>
          <div class="text-xl font-black text-amber-600 mt-0.5">{{ dailyData()?.late_today || 0 }}</div>
        </div>
        <div class="bg-white p-3.5 rounded-xl border border-rose-100 shadow-sm">
          <div class="text-[10px] font-bold text-rose-500 uppercase">Absent</div>
          <div class="text-xl font-black text-rose-500 mt-0.5">{{ dailyData()?.absent_today || 0 }}</div>
        </div>
      </div>

      <!-- TABLE CONTAINER -->
      <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <!-- Search bar -->
        <div class="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div class="relative w-full sm:w-64">
            <span class="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
              <i class="fa-solid fa-magnifying-glass text-xs"></i>
            </span>
            <input
              type="text"
              [(ngModel)]="searchQuery"
              placeholder="Search employee or ID..."
              class="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#0A5482]"
            />
          </div>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse text-xs">
            <thead>
              <tr class="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                <th class="py-3 px-4">Emp ID</th>
                <th class="py-3 px-4">Employee Name</th>
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
              <tr *ngFor="let emp of filteredRecords()" class="hover:bg-slate-50/80 transition">
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
              <h3 class="font-bold text-slate-800 text-sm">Punches for {{ selectedDate }}</h3>
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

  selectedDate = new Date().toISOString().split('T')[0];
  selectedShift = 'ALL';
  searchQuery = '';

  selectedEmp = signal<any>(null);
  punchDetails = signal<any[]>([]);

  constructor(private attendanceService: AttendanceService) {}

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.loading.set(true);
    this.attendanceService.getDaily(this.selectedDate, 'ALL', this.selectedShift).subscribe({
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
    this.attendanceService.getEmployeePunches(emp.emp_code, this.selectedDate).subscribe({
      next: (res) => {
        this.punchDetails.set(res.items || []);
      }
    });
  }

  closePunchDetail(): void {
    this.selectedEmp.set(null);
    this.punchDetails.set([]);
  }
}

