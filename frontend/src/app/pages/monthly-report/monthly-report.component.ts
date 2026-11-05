import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AttendanceService } from '../../services/attendance.service';

@Component({
  selector: 'app-monthly-report',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="space-y-6">
      <!-- HEADER -->
      <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 class="text-xl font-bold text-slate-800 tracking-tight">Monthly Attendance Matrix</h1>
          <p class="text-xs text-slate-500 mt-0.5">Enterprise muster roll (Days 1–31) with live punch timings & manual overrides</p>
        </div>

        <!-- CONTROLS & EXPORTS -->
        <div class="flex flex-wrap items-center gap-2">
          <!-- Month Selector -->
          <select
            [(ngModel)]="selectedMonth"
            (change)="loadData()"
            class="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#0A5482]"
          >
            <option *ngFor="let m of months; let i = index" [value]="i + 1">{{ m }}</option>
          </select>

          <!-- Year Selector -->
          <select
            [(ngModel)]="selectedYear"
            (change)="loadData()"
            class="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#0A5482]"
          >
            <option *ngFor="let y of years" [value]="y">{{ y }}</option>
          </select>

          <!-- Display Mode Toggle -->
          <div class="bg-slate-100 p-1 rounded-xl flex items-center gap-1 border border-slate-200">
            <button
              (click)="displayMode.set('TIMINGS')"
              [class]="displayMode() === 'TIMINGS' ? 'bg-white text-[#0A5482] shadow-sm' : 'text-slate-500 hover:text-slate-700'"
              class="px-2.5 py-1 text-[11px] font-bold rounded-lg transition"
            >
              First IN & Last OUT
            </button>
            <button
              (click)="displayMode.set('STATUS')"
              [class]="displayMode() === 'STATUS' ? 'bg-white text-[#0A5482] shadow-sm' : 'text-slate-500 hover:text-slate-700'"
              class="px-2.5 py-1 text-[11px] font-bold rounded-lg transition"
            >
              Status (P/A)
            </button>
          </div>

          <!-- Refresh -->
          <button
            (click)="loadData()"
            [disabled]="loading()"
            class="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-sm transition"
          >
            <i class="fa-solid fa-arrows-rotate text-xs" [ngClass]="{'fa-spin': loading()}"></i>
            <span>Refresh</span>
          </button>

          <!-- Export Excel -->
          <button
            (click)="exportExcel()"
            class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-sm transition"
          >
            <i class="fa-solid fa-file-excel text-xs"></i>
            <span>Export Excel</span>
          </button>

          <!-- Export CSV -->
          <button
            (click)="exportCsv()"
            class="px-3 py-1.5 bg-[#0A5482] hover:bg-[#08456b] text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-sm transition"
          >
            <i class="fa-solid fa-file-csv text-xs"></i>
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      <!-- SUMMARY STRIP -->
      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div class="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
          <div class="text-[10px] font-bold text-slate-400 uppercase">Working Days</div>
          <div class="text-lg font-black text-slate-800 mt-0.5">{{ matrixData()?.working_days || 0 }} Days</div>
          <div class="text-[10px] text-amber-600 font-medium">Sat & Sun Week Offs</div>
        </div>

        <div class="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
          <div class="text-[10px] font-bold text-slate-400 uppercase">Total Employees</div>
          <div class="text-lg font-black text-slate-800 mt-0.5">{{ matrixData()?.total_employees || 0 }} Staff</div>
          <div class="text-[10px] text-slate-400 font-medium">Active enrolled</div>
        </div>

        <div class="bg-white p-3.5 rounded-xl border border-emerald-100 shadow-sm">
          <div class="text-[10px] font-bold text-emerald-600 uppercase">Present Staff-Days</div>
          <div class="text-lg font-black text-emerald-600 mt-0.5">{{ matrixData()?.summary?.total_present_days || 0 }}</div>
          <div class="text-[10px] text-emerald-600/80 font-medium">Recorded punches</div>
        </div>

        <div class="bg-white p-3.5 rounded-xl border border-rose-100 shadow-sm">
          <div class="text-[10px] font-bold text-rose-500 uppercase">Absent Staff-Days</div>
          <div class="text-lg font-black text-rose-500 mt-0.5">{{ matrixData()?.summary?.total_absent_days || 0 }}</div>
          <div class="text-[10px] text-rose-400 font-medium">Working days missed</div>
        </div>

        <div class="bg-white p-3.5 rounded-xl border border-blue-100 shadow-sm">
          <div class="text-[10px] font-bold text-blue-600 uppercase">WFH Days</div>
          <div class="text-lg font-black text-blue-600 mt-0.5">{{ matrixData()?.summary?.total_wfh_days || 0 }}</div>
          <div class="text-[10px] text-blue-500 font-medium">Remote approved</div>
        </div>

        <div class="bg-white p-3.5 rounded-xl border border-purple-100 shadow-sm">
          <div class="text-[10px] font-bold text-purple-600 uppercase">Overall Attendance</div>
          <div class="text-lg font-black text-purple-600 mt-0.5">{{ matrixData()?.summary?.overall_rate || 0 }}%</div>
          <div class="text-[10px] text-purple-500 font-medium">Month average</div>
        </div>
      </div>

      <!-- MATRIX TABLE CONTAINER -->
      <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <!-- Search & Shift Filter -->
        <div class="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
          <div class="flex items-center gap-2">
            <span class="text-xs font-semibold text-slate-500">Filter Shift:</span>
            <select
              [(ngModel)]="shiftFilter"
              (change)="loadData()"
              class="px-2.5 py-1 text-xs bg-white border border-slate-200 rounded-lg text-slate-700 font-medium focus:outline-none"
            >
              <option value="ALL">All Shifts</option>
              <option value="SHIFT_9_7">General Shift (09:00 AM - 07:00 PM)</option>
              <option value="SHIFT_9_6">Standard Shift (09:00 AM - 06:00 PM)</option>
              <option value="SHIFT_WFH">Work From Home (WFH)</option>
            </select>
          </div>

          <div class="relative w-full sm:w-64">
            <span class="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
              <i class="fa-solid fa-magnifying-glass text-xs"></i>
            </span>
            <input
              type="text"
              [(ngModel)]="searchQuery"
              placeholder="Search employee..."
              class="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#0A5482]"
            />
          </div>
        </div>

        <!-- MATRIX SCROLL AREA -->
        <div class="overflow-x-auto max-h-[calc(100vh-320px)] relative">
          <table class="w-full text-left border-collapse text-[11px]">
            <thead class="sticky top-0 z-20">
              <tr class="bg-[#0A5482] text-white">
                <th class="py-2.5 px-3 sticky left-0 z-30 bg-[#0A5482] border-r border-[#073B5B] w-20">Emp ID</th>
                <th class="py-2.5 px-3 sticky left-20 z-30 bg-[#0A5482] border-r border-[#073B5B] w-44">Employee Name</th>
                <th class="py-2.5 px-3 border-r border-[#073B5B] w-36">Shift</th>

                <!-- Day Headers 1..N -->
                <th
                  *ngFor="let d of matrixData()?.days_meta"
                  [ngClass]="d.is_weekend ? 'bg-amber-100 text-amber-900 border-amber-300' : 'bg-[#0A5482] text-white border-[#073B5B]'"
                  class="py-2 px-1 text-center border-r font-bold min-w-[42px]"
                >
                  <div class="text-[11px]">{{ d.day }}</div>
                  <div class="text-[9px] font-semibold uppercase opacity-90">{{ d.weekday }}</div>
                </th>

                <th class="py-2.5 px-2 text-center bg-[#073B5B] text-white font-bold w-12">P</th>
                <th class="py-2.5 px-2 text-center bg-[#073B5B] text-white font-bold w-12">A</th>
                <th class="py-2.5 px-2 text-center bg-[#073B5B] text-white font-bold w-12">WFH</th>
                <th class="py-2.5 px-2 text-center bg-[#073B5B] text-white font-bold w-12">½L</th>
                <th class="py-2.5 px-2 text-center bg-[#073B5B] text-white font-bold w-12">WO</th>
                <th class="py-2.5 px-3 text-center bg-[#073B5B] text-white font-bold w-16">%</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-200">
              <tr
                *ngFor="let rec of filteredRecords(); let rIdx = index"
                [class]="rIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'"
                class="hover:bg-blue-50/40 transition"
              >
                <!-- Emp ID -->
                <td class="py-2 px-3 font-bold text-slate-700 sticky left-0 z-10 bg-inherit border-r border-slate-200">
                  {{ rec.emp_code }}
                </td>

                <!-- Emp Name -->
                <td class="py-2 px-3 font-semibold text-slate-800 sticky left-20 z-10 bg-inherit border-r border-slate-200 truncate max-w-[176px]">
                  {{ rec.name }}
                </td>

                <!-- Shift -->
                <td class="py-2 px-3 text-slate-500 border-r border-slate-200 truncate max-w-[144px]">
                  {{ rec.shift }}
                </td>

                <!-- 1..N Day Cells -->
                <td
                  *ngFor="let d of matrixData()?.days_meta"
                  (click)="openChangeStatusModal(rec, d)"
                  [ngClass]="{
                    'bg-amber-50/60': d.is_weekend && !rec.days[d.day.toString()]?.is_override,
                    'bg-purple-50 ring-1 ring-purple-300': rec.days[d.day.toString()]?.is_override
                  }"
                  class="py-1.5 px-1 text-center border-r border-slate-200 cursor-pointer hover:bg-blue-100 transition relative group select-none"
                  [title]="getCellTooltip(rec, d)"
                >
                  <!-- OVERRIDE INDICATOR PIN -->
                  <span
                    *ngIf="rec.days[d.day.toString()]?.is_override"
                    class="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-purple-600"
                    title="Manual Override Active"
                  ></span>

                  <!-- DISPLAY MODE 1: TIMINGS -->
                  <div *ngIf="displayMode() === 'TIMINGS'" class="text-[10px] leading-tight">
                    <ng-container *ngIf="rec.days[d.day.toString()] as dayInfo">
                      <div *ngIf="dayInfo.status === 'WO'" class="text-amber-700 font-bold">WO</div>
                      <div *ngIf="dayInfo.status === 'WFH'" class="text-blue-600 font-bold">WFH</div>
                      <div *ngIf="dayInfo.status === 'HDL'" class="text-purple-600 font-bold">½L</div>
                      <div *ngIf="dayInfo.status === 'A'" class="text-rose-500 font-semibold">A</div>
                      <div *ngIf="dayInfo.status === 'P'">
                        <div [class]="dayInfo.is_late ? 'text-amber-600 font-bold' : 'text-emerald-700 font-semibold'">
                          {{ dayInfo.first_in?.substring(0, 5) || '--' }}
                        </div>
                        <div class="text-slate-500 text-[9px]">
                          {{ dayInfo.last_out?.substring(0, 5) || '--' }}
                        </div>
                      </div>
                    </ng-container>
                  </div>

                  <!-- DISPLAY MODE 2: STATUS ONLY -->
                  <div *ngIf="displayMode() === 'STATUS'">
                    <ng-container *ngIf="rec.days[d.day.toString()] as dayInfo">
                      <span
                        [ngClass]="{
                          'bg-emerald-100 text-emerald-800 font-bold': dayInfo.status === 'P',
                          'bg-rose-100 text-rose-700 font-bold': dayInfo.status === 'A',
                          'bg-blue-100 text-blue-800 font-bold': dayInfo.status === 'WFH',
                          'bg-purple-100 text-purple-800 font-bold': dayInfo.status === 'HDL',
                          'bg-amber-100 text-amber-800 font-bold': dayInfo.status === 'WO'
                        }"
                        class="inline-block px-1.5 py-0.5 rounded text-[10px]"
                      >
                        {{ dayInfo.status === 'HDL' ? '½L' : dayInfo.status }}
                      </span>
                    </ng-container>
                  </div>
                </td>

                <!-- SUMMARY COLUMNS -->
                <td class="py-2 px-2 text-center font-bold text-emerald-700 border-r border-slate-200">{{ rec.present_count }}</td>
                <td class="py-2 px-2 text-center font-bold text-rose-600 border-r border-slate-200">{{ rec.absent_count }}</td>
                <td class="py-2 px-2 text-center font-bold text-blue-600 border-r border-slate-200">{{ rec.wfh_count }}</td>
                <td class="py-2 px-2 text-center font-bold text-purple-600 border-r border-slate-200">{{ rec.hdl_count }}</td>
                <td class="py-2 px-2 text-center font-bold text-amber-700 border-r border-slate-200">{{ rec.wo_count }}</td>
                <td class="py-2 px-3 text-center font-black text-slate-800">{{ rec.attendance_rate }}%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- CHANGE ATTENDANCE STATUS MODAL DIALOG -->
      <div *ngIf="modalData()" class="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div class="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
          <!-- MODAL HEADER -->
          <div class="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
            <div>
              <h3 class="font-bold text-slate-800 text-sm">Change Attendance Status</h3>
              <p class="text-xs text-slate-500 mt-0.5">{{ modalData()?.employee?.name }} (ID: {{ modalData()?.employee?.emp_code }})</p>
            </div>
            <button (click)="closeModal()" class="text-slate-400 hover:text-slate-600 text-sm p-1 rounded-lg">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>

          <!-- MODAL BODY -->
          <div class="p-5 space-y-4">
            <!-- Day & Date Info Box -->
            <div class="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
              <div>
                <span class="text-slate-400 font-semibold uppercase text-[10px]">Date Selected</span>
                <div class="font-bold text-slate-800">{{ modalData()?.dayMeta?.date }} ({{ modalData()?.dayMeta?.weekday }})</div>
              </div>
              <div class="text-right">
                <span class="text-slate-400 font-semibold uppercase text-[10px]">Current Status</span>
                <div class="font-bold text-slate-800">{{ modalCurrentStatus() }}</div>
              </div>
            </div>

            <!-- STATUS SELECTOR PILLS -->
            <div>
              <label class="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">Select New Status</label>
              <div class="grid grid-cols-2 gap-2 text-xs">
                <!-- WFH -->
                <button
                  type="button"
                  (click)="selectedStatus.set('WFH')"
                  [class]="selectedStatus() === 'WFH' ? 'bg-blue-600 text-white ring-2 ring-blue-300' : 'bg-blue-50 text-blue-700 hover:bg-blue-100'"
                  class="p-2.5 rounded-xl font-bold flex items-center gap-2 transition"
                >
                  <i class="fa-solid fa-house-laptop"></i>
                  <span>Work From Home (WFH)</span>
                </button>

                <!-- ABSENT -->
                <button
                  type="button"
                  (click)="selectedStatus.set('A')"
                  [class]="selectedStatus() === 'A' ? 'bg-rose-600 text-white ring-2 ring-rose-300' : 'bg-rose-50 text-rose-700 hover:bg-rose-100'"
                  class="p-2.5 rounded-xl font-bold flex items-center gap-2 transition"
                >
                  <i class="fa-solid fa-user-xmark"></i>
                  <span>Absent (A)</span>
                </button>

                <!-- HALF DAY LEAVE -->
                <button
                  type="button"
                  (click)="selectedStatus.set('HDL')"
                  [class]="selectedStatus() === 'HDL' ? 'bg-purple-600 text-white ring-2 ring-purple-300' : 'bg-purple-50 text-purple-700 hover:bg-purple-100'"
                  class="p-2.5 rounded-xl font-bold flex items-center gap-2 transition"
                >
                  <i class="fa-solid fa-hourglass-half"></i>
                  <span>Half Day Leave (½L)</span>
                </button>

                <!-- PRESENT -->
                <button
                  type="button"
                  (click)="selectedStatus.set('P')"
                  [class]="selectedStatus() === 'P' ? 'bg-emerald-600 text-white ring-2 ring-emerald-300' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'"
                  class="p-2.5 rounded-xl font-bold flex items-center gap-2 transition"
                >
                  <i class="fa-solid fa-user-check"></i>
                  <span>Present (P)</span>
                </button>

                <!-- WEEK OFF -->
                <button
                  type="button"
                  (click)="selectedStatus.set('WO')"
                  [class]="selectedStatus() === 'WO' ? 'bg-amber-600 text-white ring-2 ring-amber-300' : 'bg-amber-50 text-amber-700 hover:bg-amber-100'"
                  class="p-2.5 rounded-xl font-bold flex items-center gap-2 transition"
                >
                  <i class="fa-solid fa-mug-hot"></i>
                  <span>Week Off (WO)</span>
                </button>

                <!-- RESET / AUTO -->
                <button
                  type="button"
                  (click)="selectedStatus.set('AUTO')"
                  [class]="selectedStatus() === 'AUTO' ? 'bg-slate-700 text-white ring-2 ring-slate-400' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'"
                  class="p-2.5 rounded-xl font-bold flex items-center gap-2 transition"
                >
                  <i class="fa-solid fa-rotate-left"></i>
                  <span>Reset to Auto</span>
                </button>
              </div>
            </div>

            <!-- REMARKS -->
            <div>
              <label class="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">Remarks / Reason</label>
              <input
                type="text"
                [(ngModel)]="overrideRemarks"
                placeholder="e.g. Approved leave / client visit"
                class="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#0A5482]"
              />
            </div>
          </div>

          <!-- MODAL ACTIONS -->
          <div class="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-2">
            <button
              (click)="closeModal()"
              class="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl transition"
            >
              Cancel
            </button>
            <button
              (click)="saveOverride()"
              [disabled]="savingOverride()"
              class="px-5 py-2 bg-[#0A5482] hover:bg-[#08456b] text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-sm transition"
            >
              <i *ngIf="savingOverride()" class="fa-solid fa-circle-notch fa-spin"></i>
              <span>{{ savingOverride() ? 'Saving...' : 'Apply Status' }}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  `
})
export class MonthlyReportComponent implements OnInit {
  matrixData = signal<any>(null);
  loading = signal(false);
  displayMode = signal<'TIMINGS' | 'STATUS'>('TIMINGS');

  selectedMonth = new Date().getMonth() + 1;
  selectedYear = new Date().getFullYear();
  shiftFilter = 'ALL';
  searchQuery = '';

  months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  years = [2025, 2026, 2027];

  // Modal State
  modalData = signal<{ employee: any; dayMeta: any } | null>(null);
  selectedStatus = signal<string>('WFH');
  overrideRemarks = '';
  savingOverride = signal(false);

  constructor(private attendanceService: AttendanceService) {}

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.loading.set(true);
    this.attendanceService.getMonthly(
      this.selectedYear,
      this.selectedMonth,
      'ALL',
      this.shiftFilter
    ).subscribe({
      next: (res) => {
        this.matrixData.set(res);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  filteredRecords(): any[] {
    const list = this.matrixData()?.records || [];
    if (!this.searchQuery.trim()) return list;
    const q = this.searchQuery.trim().toLowerCase();
    return list.filter((r: any) =>
      (r.name || '').toLowerCase().includes(q) ||
      (r.emp_code || '').toLowerCase().includes(q)
    );
  }

  getCellTooltip(rec: any, d: any): string {
    const day = rec.days[d.day.toString()];
    if (!day) return 'Click to edit status';
    let t = `Day ${d.day} (${d.weekday}) - Status: ${day.status}`;
    if (day.first_in) t += `\nFirst IN: ${day.first_in}`;
    if (day.last_out) t += `\nLast OUT: ${day.last_out}`;
    if (day.is_override) t += `\n[Manual Override: ${day.override_remarks || 'Yes'}]`;
    t += '\nClick to edit status';
    return t;
  }

  modalCurrentStatus(): string {
    if (!this.modalData()) return '--';
    const day = this.modalData()?.employee.days[this.modalData()?.dayMeta.day.toString()];
    return day ? day.status : 'A';
  }

  openChangeStatusModal(emp: any, dayMeta: any): void {
    const day = emp.days[dayMeta.day.toString()];
    const currentSt = day ? day.status : (dayMeta.is_weekend ? 'WO' : 'A');

    this.modalData.set({ employee: emp, dayMeta });
    this.selectedStatus.set(currentSt);
    this.overrideRemarks = day?.override_remarks || '';
  }

  closeModal(): void {
    this.modalData.set(null);
    this.overrideRemarks = '';
  }

  saveOverride(): void {
    const m = this.modalData();
    if (!m) return;

    this.savingOverride.set(true);
    this.attendanceService.setOverride(
      m.employee.emp_code,
      m.dayMeta.date,
      this.selectedStatus(),
      this.overrideRemarks
    ).subscribe({
      next: () => {
        this.savingOverride.set(false);
        this.closeModal();
        this.loadData();
      },
      error: () => this.savingOverride.set(false)
    });
  }

  exportExcel(): void {
    const url = this.attendanceService.getExportExcelUrl(
      this.selectedYear,
      this.selectedMonth,
      'ALL',
      this.shiftFilter
    );
    window.open(url, '_blank');
  }

  exportCsv(): void {
    const url = this.attendanceService.getExportCsvUrl(
      this.selectedYear,
      this.selectedMonth
    );
    window.open(url, '_blank');
  }
}

