import { Component, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { AttendanceService } from '../../services/attendance.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="space-y-6">
      <!-- HEADER -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 class="text-xl font-bold text-slate-800 tracking-tight">Dashboard Overview</h1>
          <p class="text-xs text-slate-500 mt-0.5">Today's live attendance metrics and biometric punch tracking</p>
        </div>
        <div class="flex items-center gap-3">
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

      <!-- KPI CARDS -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <!-- TOTAL EMPLOYEES -->
        <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div class="flex items-center justify-between">
            <div>
              <span class="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Employees</span>
              <div class="text-2xl font-black text-slate-800 mt-1">{{ dailyData()?.total_employees || 0 }}</div>
              <div class="text-[11px] text-slate-500 mt-1">Enrolled staff members</div>
            </div>
            <div class="w-12 h-12 rounded-xl bg-blue-50 text-[#0A5482] flex items-center justify-center text-lg shadow-sm">
              <i class="fa-solid fa-users"></i>
            </div>
          </div>
        </div>

        <!-- PRESENT TODAY -->
        <div class="bg-white p-5 rounded-2xl border border-emerald-100 shadow-sm relative overflow-hidden">
          <div class="flex items-center justify-between">
            <div>
              <span class="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">Present Today</span>
              <div class="text-2xl font-black text-emerald-600 mt-1">{{ dailyData()?.present_today || 0 }}</div>
              <div class="text-[11px] text-emerald-600/80 font-medium mt-1">
                {{ dailyData()?.attendance_rate || 0 }}% Attendance Rate
              </div>
            </div>
            <div class="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-lg shadow-sm">
              <i class="fa-solid fa-user-check"></i>
            </div>
          </div>
        </div>

        <!-- LATE ARRIVALS -->
        <div class="bg-white p-5 rounded-2xl border border-amber-100 shadow-sm relative overflow-hidden">
          <div class="flex items-center justify-between">
            <div>
              <span class="text-[11px] font-bold text-amber-600 uppercase tracking-wider">Late Arrivals</span>
              <div class="text-2xl font-black text-amber-600 mt-1">{{ dailyData()?.late_today || 0 }}</div>
              <div class="text-[11px] text-amber-600/80 font-medium mt-1">Arrived after 09:05 AM</div>
            </div>
            <div class="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center text-lg shadow-sm">
              <i class="fa-solid fa-business-time"></i>
            </div>
          </div>
        </div>

        <!-- ABSENT TODAY -->
        <div class="bg-white p-5 rounded-2xl border border-rose-100 shadow-sm relative overflow-hidden">
          <div class="flex items-center justify-between">
            <div>
              <span class="text-[11px] font-bold text-rose-500 uppercase tracking-wider">Absent Today</span>
              <div class="text-2xl font-black text-rose-500 mt-1">{{ dailyData()?.absent_today || 0 }}</div>
              <div class="text-[11px] text-rose-400 font-medium mt-1">No punches recorded</div>
            </div>
            <div class="w-12 h-12 rounded-xl bg-rose-50 text-rose-500 flex items-center justify-center text-lg shadow-sm">
              <i class="fa-solid fa-user-xmark"></i>
            </div>
          </div>
        </div>
      </div>

      <!-- MAIN DATA CARD & TABLE -->
      <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <!-- FILTER BAR -->
        <div class="p-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50/50">
          <!-- Filter Tabs -->
          <div class="flex items-center gap-1.5 overflow-x-auto">
            <button
              (click)="activeTab.set('ALL')"
              [class]="activeTab() === 'ALL' ? 'bg-[#0A5482] text-white' : 'bg-white text-slate-600 hover:bg-slate-100'"
              class="px-3 py-1.5 rounded-lg text-xs font-semibold shadow-sm transition"
            >
              All ({{ records().length }})
            </button>
            <button
              (click)="activeTab.set('PRESENT')"
              [class]="activeTab() === 'PRESENT' ? 'bg-emerald-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-100'"
              class="px-3 py-1.5 rounded-lg text-xs font-semibold shadow-sm transition"
            >
              Present ({{ countPresent() }})
            </button>
            <button
              (click)="activeTab.set('LATE')"
              [class]="activeTab() === 'LATE' ? 'bg-amber-500 text-white' : 'bg-white text-slate-600 hover:bg-slate-100'"
              class="px-3 py-1.5 rounded-lg text-xs font-semibold shadow-sm transition"
            >
              Late ({{ dailyData()?.late_today || 0 }})
            </button>
            <button
              (click)="activeTab.set('ABSENT')"
              [class]="activeTab() === 'ABSENT' ? 'bg-rose-500 text-white' : 'bg-white text-slate-600 hover:bg-slate-100'"
              class="px-3 py-1.5 rounded-lg text-xs font-semibold shadow-sm transition"
            >
              Absent ({{ dailyData()?.absent_today || 0 }})
            </button>
            <button
              (click)="activeTab.set('WFH')"
              [class]="activeTab() === 'WFH' ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-100'"
              class="px-3 py-1.5 rounded-lg text-xs font-semibold shadow-sm transition"
            >
              WFH ({{ dailyData()?.wfh_today || 0 }})
            </button>
          </div>

          <!-- Search Input -->
          <div class="relative w-full md:w-64">
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

        <!-- TABLE -->
        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse text-xs">
            <thead>
              <tr class="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                <th class="py-3 px-4">Emp Code</th>
                <th class="py-3 px-4">Employee Name</th>
                <th class="py-3 px-4">Assigned Shift</th>
                <th class="py-3 px-4 text-center">First IN</th>
                <th class="py-3 px-4 text-center">Last OUT</th>
                <th class="py-3 px-4 text-center">Duration</th>
                <th class="py-3 px-4 text-center">Punches</th>
                <th class="py-3 px-4 text-center">Status</th>
                <th class="py-3 px-4 text-center">Detail</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr *ngFor="let emp of filteredRecords()" class="hover:bg-slate-50/80 transition">
                <td class="py-3 px-4 font-bold text-slate-700">{{ emp.emp_code }}</td>
                <td class="py-3 px-4 font-semibold text-slate-800">{{ emp.name }}</td>
                <td class="py-3 px-4">
                  <span class="inline-block px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600">
                    {{ emp.shift_name }}
                  </span>
                </td>
                <td class="py-3 px-4 text-center">
                  <div class="flex items-center justify-center gap-1.5">
                    <span [class]="emp.is_late ? 'text-amber-600 font-bold' : 'text-slate-700 font-medium'">
                      {{ emp.first_in_time }}
                    </span>
                    <span *ngIf="emp.is_late" class="px-1.5 py-0.2 bg-amber-100 text-amber-700 text-[9px] font-bold rounded">
                      LATE
                    </span>
                  </div>
                </td>
                <td class="py-3 px-4 text-center font-medium text-slate-700">
                  <span *ngIf="emp.is_in_office" class="text-emerald-600 font-semibold flex items-center justify-center gap-1">
                    <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    In Office
                  </span>
                  <span *ngIf="!emp.is_in_office">{{ emp.last_out_time }}</span>
                </td>
                <td class="py-3 px-4 text-center font-semibold text-slate-700">
                  {{ emp.duration }}
                </td>
                <td class="py-3 px-4 text-center">
                  <span class="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-slate-700 font-bold text-[10px]">
                    {{ emp.total_punches }}
                  </span>
                </td>
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
                    class="text-[#0A5482] hover:text-[#08456b] p-1.5 rounded hover:bg-blue-50 transition"
                    title="View Punch History"
                  >
                    <i class="fa-solid fa-list-check"></i>
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- PUNCH HISTORY MODAL -->
      <div *ngIf="selectedEmp()" class="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div class="bg-white rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden border border-slate-100">
          <div class="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
            <div>
              <h3 class="font-bold text-slate-800 text-sm">Biometric Punch Sequence</h3>
              <p class="text-xs text-slate-500 mt-0.5">{{ selectedEmp()?.name }} (ID: {{ selectedEmp()?.emp_code }})</p>
            </div>
            <button (click)="closePunchDetail()" class="text-slate-400 hover:text-slate-600 text-sm p-1 rounded-lg">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>

          <div class="p-5 max-h-96 overflow-y-auto">
            <div *ngIf="loadingPunches()" class="text-center py-8 text-slate-400">
              <i class="fa-solid fa-circle-notch fa-spin text-xl mb-2"></i>
              <p class="text-xs">Fetching punches...</p>
            </div>

            <div *ngIf="!loadingPunches() && punchDetails().length === 0" class="text-center py-8 text-slate-400">
              <i class="fa-solid fa-fingerprint text-2xl mb-2 text-slate-300"></i>
              <p class="text-xs">No biometric punches recorded for this date.</p>
            </div>

            <div *ngIf="!loadingPunches() && punchDetails().length > 0" class="space-y-2">
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
                <div class="text-right">
                  <span class="text-[10px] font-semibold text-slate-500 px-2 py-0.5 rounded-full bg-slate-200">
                    {{ p.label }}
                  </span>
                </div>
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
export class DashboardComponent implements OnInit, OnDestroy {
  dailyData = signal<any>(null);
  records = signal<any[]>([]);
  loading = signal(false);
  activeTab = signal('ALL');
  searchQuery = '';

  selectedEmp = signal<any>(null);
  punchDetails = signal<any[]>([]);
  loadingPunches = signal(false);

  private liveSub: Subscription | null = null;

  constructor(private attendanceService: AttendanceService) {}

  ngOnInit(): void {
    this.loadData();
    // Auto-sync silently on new punch
    this.liveSub = this.attendanceService.liveUpdates$.subscribe((msg) => {
      if (msg.type === 'new_punches') {
        this.loadData(true);
      }
    });
  }

  ngOnDestroy(): void {
    if (this.liveSub) this.liveSub.unsubscribe();
  }

  loadData(silent = false): void {
    if (!silent) this.loading.set(true);
    this.attendanceService.getDaily().subscribe({
      next: (res) => {
        this.dailyData.set(res);
        this.records.set(res.records || []);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  countPresent(): number {
    return this.records().filter(r => r.is_present).length;
  }

  filteredRecords(): any[] {
    let list = this.records();
    const tab = this.activeTab();

    if (tab === 'PRESENT') {
      list = list.filter(r => r.is_present);
    } else if (tab === 'LATE') {
      list = list.filter(r => r.is_late);
    } else if (tab === 'ABSENT') {
      list = list.filter(r => !r.is_present && !r.is_wfh);
    } else if (tab === 'WFH') {
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
    this.loadingPunches.set(true);
    this.attendanceService.getEmployeePunches(emp.emp_code).subscribe({
      next: (res) => {
        this.punchDetails.set(res.items || []);
        this.loadingPunches.set(false);
      },
      error: () => this.loadingPunches.set(false)
    });
  }

  closePunchDetail(): void {
    this.selectedEmp.set(null);
    this.punchDetails.set([]);
  }
}

