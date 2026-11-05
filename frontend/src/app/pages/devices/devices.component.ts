import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AttendanceService } from '../../services/attendance.service';

@Component({
  selector: 'app-devices',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="space-y-6">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-xl font-bold text-slate-800 tracking-tight">Biometric Devices</h1>
          <p class="text-xs text-slate-500 mt-0.5">eSSL biometric hardware terminals running on office LAN TCP Port 4370</p>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div *ngFor="let d of devices()" class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div class="flex items-center justify-between mb-3">
              <span class="w-8 h-8 rounded-xl bg-blue-50 text-[#0A5482] flex items-center justify-center text-sm font-bold">
                <i class="fa-solid fa-fingerprint"></i>
              </span>
              <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 flex items-center gap-1">
                <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                ONLINE
              </span>
            </div>

            <h3 class="font-bold text-slate-800 text-sm">{{ d.device_name }}</h3>
            <p class="text-xs text-slate-400 mt-0.5 font-medium">{{ d.device_model || 'eSSL F18 + F12' }}</p>

            <div class="mt-4 space-y-1.5 text-xs text-slate-600">
              <div class="flex items-center justify-between">
                <span class="text-slate-400">IP Address:</span>
                <span class="font-bold text-slate-800">{{ d.ip_address }}</span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-slate-400">TCP Port:</span>
                <span class="font-semibold">{{ d.port || 4370 }}</span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-slate-400">Mode:</span>
                <span class="font-semibold">{{ d.attendance_type || 'BOTH' }}</span>
              </div>
            </div>
          </div>

          <div class="mt-4 pt-4 border-t border-slate-100 text-[10px] text-slate-400 flex items-center justify-between">
            <span>Last Sync: Real-time</span>
            <span class="text-emerald-600 font-bold">&lt; 1s Latency</span>
          </div>
        </div>
      </div>
    </div>
  `
})
export class DevicesComponent implements OnInit {
  devices = signal<any[]>([]);

  constructor(private attendanceService: AttendanceService) {}

  ngOnInit(): void {
    this.attendanceService.getDevices().subscribe({
      next: (res) => this.devices.set(res || [])
    });
  }
}

