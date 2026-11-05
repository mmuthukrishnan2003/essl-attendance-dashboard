import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AttendanceService } from '../../services/attendance.service';

@Component({
  selector: 'app-employees',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="space-y-6">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 class="text-xl font-bold text-slate-800 tracking-tight">Employees Directory</h1>
          <p class="text-xs text-slate-500 mt-0.5">Manage enrolled workforce, biometric IDs, and shift assignments</p>
        </div>

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

      <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse text-xs">
            <thead>
              <tr class="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                <th class="py-3 px-4">Emp Code</th>
                <th class="py-3 px-4">Full Name</th>
                <th class="py-3 px-4">Department</th>
                <th class="py-3 px-4">Designation</th>
                <th class="py-3 px-4">Assigned Shift</th>
                <th class="py-3 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr *ngFor="let emp of filteredEmployees()" class="hover:bg-slate-50/80 transition">
                <td class="py-3 px-4 font-bold text-slate-700">{{ emp.emp_code }}</td>
                <td class="py-3 px-4 font-semibold text-slate-800">{{ emp.name }}</td>
                <td class="py-3 px-4 text-slate-600">{{ emp.department || 'General' }}</td>
                <td class="py-3 px-4 text-slate-600">{{ emp.designation || 'Staff' }}</td>
                <td class="py-3 px-4">
                  <span class="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-blue-50 text-[#0A5482]">
                    {{ emp.shift_name }}
                  </span>
                </td>
                <td class="py-3 px-4 text-center">
                  <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Active
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `
})
export class EmployeesComponent implements OnInit {
  employees = signal<any[]>([]);
  searchQuery = '';

  constructor(private attendanceService: AttendanceService) {}

  ngOnInit(): void {
    this.attendanceService.getEmployees().subscribe({
      next: (res) => this.employees.set(res || [])
    });
  }

  filteredEmployees(): any[] {
    let list = this.employees();
    if (this.searchQuery.trim()) {
      const q = this.searchQuery.trim().toLowerCase();
      list = list.filter(e =>
        (e.name || '').toLowerCase().includes(q) ||
        (e.emp_code || '').toLowerCase().includes(q) ||
        (e.department || '').toLowerCase().includes(q)
      );
    }
    return list;
  }
}

