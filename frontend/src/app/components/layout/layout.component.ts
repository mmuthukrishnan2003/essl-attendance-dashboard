import { Component, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { AttendanceService } from '../../services/attendance.service';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="flex h-screen bg-[#F8FAFC] overflow-hidden">
      <!-- SIDEBAR -->
      <aside class="w-64 bg-white border-r border-slate-200 flex flex-col justify-between shrink-0 shadow-sm z-20">
        <div>
          <!-- BRAND HEADER -->
          <div class="p-5 border-b border-slate-100 flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-[#0A5482] flex items-center justify-center text-white font-black text-lg shadow-md shadow-[#0A5482]/20 shrink-0">
              C
            </div>
            <div class="overflow-hidden">
              <h2 class="text-xs font-bold text-slate-800 uppercase tracking-tight truncate">Centizen IT Services</h2>
              <p class="text-[10px] text-slate-400 font-medium truncate">eSSL Attendance Portal</p>
            </div>
          </div>

          <!-- NAV MENU -->
          <div class="p-4 space-y-6">
            <div>
              <div class="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-3 mb-2">Main Menu</div>
              <nav class="space-y-1">
                <a
                  routerLink="/dashboard"
                  routerLinkActive="bg-[#0A5482] text-white shadow-sm font-semibold"
                  [routerLinkActiveOptions]="{exact: true}"
                  class="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-50 transition duration-150"
                >
                  <i class="fa-solid fa-house w-4 text-center"></i>
                  <span>Dashboard</span>
                </a>

                <a
                  routerLink="/daily-reports"
                  routerLinkActive="bg-[#0A5482] text-white shadow-sm font-semibold"
                  class="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-50 transition duration-150"
                >
                  <i class="fa-solid fa-clipboard-list w-4 text-center"></i>
                  <span>Daily IN/OUT & Reports</span>
                </a>

                <a
                  routerLink="/monthly-report"
                  routerLinkActive="bg-[#0A5482] text-white shadow-sm font-semibold"
                  class="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-50 transition duration-150"
                >
                  <i class="fa-solid fa-calendar-days w-4 text-center"></i>
                  <span>Monthly Attendance Report</span>
                </a>

                <a
                  routerLink="/shifts"
                  routerLinkActive="bg-[#0A5482] text-white shadow-sm font-semibold"
                  class="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-50 transition duration-150"
                >
                  <i class="fa-solid fa-clock w-4 text-center"></i>
                  <span>Shift Management</span>
                </a>
              </nav>
            </div>

            <div>
              <div class="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-3 mb-2">Personnel & Devices</div>
              <nav class="space-y-1">
                <a
                  routerLink="/employees"
                  routerLinkActive="bg-[#0A5482] text-white shadow-sm font-semibold"
                  class="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-50 transition duration-150"
                >
                  <i class="fa-solid fa-users w-4 text-center"></i>
                  <span>Employees</span>
                </a>

                <a
                  routerLink="/devices"
                  routerLinkActive="bg-[#0A5482] text-white shadow-sm font-semibold"
                  class="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-50 transition duration-150"
                >
                  <i class="fa-solid fa-fingerprint w-4 text-center"></i>
                  <span>Biometric Devices</span>
                  <span class="ml-auto bg-slate-100 text-slate-600 text-[10px] font-semibold px-2 py-0.5 rounded-full">4</span>
                </a>
              </nav>
            </div>
          </div>
        </div>

        <!-- FOOTER USER PROFILE & SYSTEM STATUS -->
        <div class="p-4 border-t border-slate-100 bg-slate-50/50">
          <div class="flex items-center justify-between mb-3">
            <div class="flex items-center gap-2.5 overflow-hidden">
              <div class="w-8 h-8 rounded-full bg-orange-100 text-[#F27E20] font-bold text-xs flex items-center justify-center shrink-0 border border-orange-200">
                {{ user()?.fullName?.charAt(0) || 'C' }}
              </div>
              <div class="overflow-hidden">
                <div class="text-xs font-bold text-slate-800 truncate">{{ user()?.fullName || 'Administrator' }}</div>
                <div class="text-[10px] text-slate-400 font-medium truncate">{{ user()?.role || 'Administrator' }}</div>
              </div>
            </div>
            <button
              (click)="onLogout()"
              title="Logout"
              class="text-xs text-red-500 hover:text-red-700 p-1.5 rounded-lg hover:bg-red-50 transition"
            >
              <i class="fa-solid fa-right-from-bracket"></i>
            </button>
          </div>

          <div class="pt-2 border-t border-slate-200/60 flex items-center justify-between text-[10px] text-slate-400 font-medium">
            <span class="flex items-center gap-1.5">
              <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              eSSL Port 4370
            </span>
            <span>Online</span>
          </div>
        </div>
      </aside>

      <!-- MAIN CONTENT WRAPPER -->
      <div class="flex-1 flex flex-col min-w-0 overflow-hidden">
        <!-- TOP NAVBAR -->
        <header class="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between shrink-0 shadow-sm z-10">
          <div class="flex items-center gap-4">
            <div class="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1.5">
              <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
              Live Sync Active (&lt; 1s)
            </div>
          </div>

          <div class="flex items-center gap-4">
            <!-- LIVE TIME -->
            <div class="text-right">
              <div class="text-sm font-bold text-slate-800 tracking-tight">{{ currentTime() }}</div>
              <div class="text-[10px] text-slate-400 font-medium">{{ currentDate() }}</div>
            </div>

            <!-- SYNC BUTTON -->
            <button
              (click)="syncDevices()"
              [disabled]="syncing()"
              class="px-3.5 py-2 bg-[#0A5482] hover:bg-[#08456b] text-white text-xs font-semibold rounded-xl flex items-center gap-2 shadow-sm transition"
            >
              <i class="fa-solid fa-rotate text-xs" [ngClass]="{'fa-spin': syncing()}"></i>
              <span>{{ syncing() ? 'Syncing...' : 'Sync Devices' }}</span>
            </button>
          </div>
        </header>

        <!-- ROUTER OUTLET -->
        <main class="flex-1 overflow-y-auto p-6">
          <router-outlet></router-outlet>
        </main>
      </div>
    </div>
  `
})
export class LayoutComponent implements OnInit, OnDestroy {
  user;
  currentTime = signal('');
  currentDate = signal('');
  syncing = signal(false);
  private timer: any;

  constructor(
    private authService: AuthService,
    private attendanceService: AttendanceService,
    private router: Router
  ) {
    this.user = this.authService.currentUser;
  }

  ngOnInit(): void {
    this.updateClock();
    this.timer = setInterval(() => this.updateClock(), 1000);
  }

  ngOnDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  updateClock(): void {
    const now = new Date();
    this.currentTime.set(now.toLocaleTimeString());
    this.currentDate.set(now.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }));
  }

  syncDevices(): void {
    this.syncing.set(true);
    this.attendanceService.syncDevices().subscribe({
      next: () => {
        setTimeout(() => this.syncing.set(false), 1000);
      },
      error: () => this.syncing.set(false)
    });
  }

  onLogout(): void {
    this.authService.logout();
  }
}
