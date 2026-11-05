import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AttendanceService } from '../../services/attendance.service';

@Component({
  selector: 'app-shifts',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="space-y-6">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-xl font-bold text-slate-800 tracking-tight">Shift Management</h1>
          <p class="text-xs text-slate-500 mt-0.5">Configure office schedules, timings, and overnight shifts</p>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div *ngFor="let s of shifts()" class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div class="flex items-center justify-between mb-2">
              <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-[#0A5482]">
                {{ s.code }}
              </span>
              <span *ngIf="s.is_night_shift" class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700">
                Overnight Shift
              </span>
            </div>
            <h3 class="font-bold text-sm text-slate-800">{{ s.name }}</h3>
            <p class="text-xs text-slate-500 mt-1">{{ s.description || 'Standard corporate operational shift' }}</p>
          </div>

          <div class="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
            <div class="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
              <i class="fa-solid fa-clock text-slate-400"></i>
              <span>{{ s.start_time }} - {{ s.end_time }}</span>
            </div>
            <span class="text-[11px] font-bold text-emerald-600">Active</span>
          </div>
        </div>
      </div>
    </div>
  `
})
export class ShiftsComponent implements OnInit {
  shifts = signal<any[]>([]);

  constructor(private attendanceService: AttendanceService) {}

  ngOnInit(): void {
    this.attendanceService.getShifts().subscribe({
      next: (res) => this.shifts.set(res || [])
    });
  }
}

