import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="min-h-screen bg-gradient-to-br from-[#0A5482] via-[#073B5B] to-[#042438] flex items-center justify-center p-4">
      <div class="max-w-md w-full bg-white rounded-2xl shadow-2xl p-8 border border-slate-100">
        <!-- Logo & Brand Header -->
        <div class="text-center mb-8">
          <div class="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#0A5482] text-white text-2xl font-black mb-3 shadow-lg shadow-[#0A5482]/30">
            C
          </div>
          <h1 class="text-2xl font-bold text-slate-800 tracking-tight">Centizen Attendance Portal</h1>
          <p class="text-xs text-slate-500 mt-1 uppercase font-semibold tracking-wider">eSSL Biometric Enterprise System</p>
        </div>

        <!-- Error Alert -->
        <div *ngIf="errorMessage()" class="mb-5 p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm flex items-center gap-2">
          <i class="fa-solid fa-circle-exclamation"></i>
          <span>{{ errorMessage() }}</span>
        </div>

        <!-- Form -->
        <form (ngSubmit)="onSubmit()" class="space-y-4">
          <div>
            <label class="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">Username</label>
            <div class="relative">
              <span class="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
                <i class="fa-solid fa-user text-sm"></i>
              </span>
              <input
                type="text"
                [(ngModel)]="username"
                name="username"
                required
                placeholder="Enter username (e.g. hr)"
                class="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0A5482] focus:bg-white transition"
              />
            </div>
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">Password</label>
            <div class="relative">
              <span class="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
                <i class="fa-solid fa-lock text-sm"></i>
              </span>
              <input
                type="password"
                [(ngModel)]="password"
                name="password"
                required
                placeholder="Enter password"
                class="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0A5482] focus:bg-white transition"
              />
            </div>
          </div>

          <div class="flex items-center justify-between text-xs pt-1">
            <label class="flex items-center gap-2 text-slate-600 cursor-pointer">
              <input type="checkbox" [(ngModel)]="remember" name="remember" class="rounded text-[#0A5482] focus:ring-[#0A5482]" />
              <span>Keep me signed in</span>
            </label>
            <span class="text-slate-400">Default: hr / hr</span>
          </div>

          <button
            type="submit"
            [disabled]="loading()"
            class="w-full mt-2 py-3 px-4 bg-[#0A5482] hover:bg-[#08456b] active:bg-[#073B5B] text-white font-semibold text-sm rounded-xl shadow-lg shadow-[#0A5482]/25 hover:shadow-none transition duration-150 flex items-center justify-center gap-2"
          >
            <i *ngIf="loading()" class="fa-solid fa-circle-notch fa-spin"></i>
            <span>{{ loading() ? 'Authenticating...' : 'Sign In to Portal' }}</span>
          </button>
        </form>

        <div class="mt-8 pt-4 border-t border-slate-100 text-center text-xs text-slate-400">
          Centizen IT Services & Solutions &copy; 2026
        </div>
      </div>
    </div>
  `
})
export class LoginComponent {
  username = 'hr';
  password = 'hr';
  remember = true;
  loading = signal(false);
  errorMessage = signal('');

  constructor(private authService: AuthService, private router: Router) {}

  onSubmit(): void {
    if (!this.username || !this.password) {
      this.errorMessage.set('Please provide both username and password.');
      return;
    }

    this.loading.set(true);
    this.errorMessage.set('');

    this.authService.login({
      username: this.username,
      password: this.password,
      remember: this.remember
    }).subscribe({
      next: (res) => {
        this.loading.set(false);
        if (res.success) {
          this.router.navigate(['/dashboard']);
        } else {
          this.errorMessage.set(res.error || 'Invalid credentials');
        }
      },
      error: (err) => {
        this.loading.set(false);
        this.errorMessage.set(err.error?.error || 'Authentication failed. Please verify credentials.');
      }
    });
  }
}

