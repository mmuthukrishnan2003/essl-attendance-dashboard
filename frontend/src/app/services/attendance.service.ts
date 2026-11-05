import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, Subject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AttendanceService {
  private apiUrl = '/api/attendance';
  public liveUpdates$ = new Subject<any>();
  private eventSource: EventSource | null = null;

  constructor(private http: HttpClient) {
    this.initLiveStream();
  }

  private initLiveStream(): void {
    if (typeof window === 'undefined') return;

    try {
      this.eventSource = new EventSource(`${this.apiUrl}/live-stream`);
      this.eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.liveUpdates$.next(data);
        } catch {
          // ignore
        }
      };

      this.eventSource.onerror = () => {
        // Retry connection in 3 seconds if disconnected
        if (this.eventSource) {
          this.eventSource.close();
          this.eventSource = null;
        }
        setTimeout(() => this.initLiveStream(), 3000);
      };
    } catch (err) {
      console.warn('Failed to start EventSource:', err);
    }
  }

  getSummary(date?: string): Observable<any> {
    let params = new HttpParams();
    if (date) params = params.set('date', date);
    return this.http.get(`${this.apiUrl}/summary`, { params, withCredentials: true });
  }

  getDaily(date?: string, department?: string, shift?: string, search?: string): Observable<any> {
    let params = new HttpParams();
    if (date) params = params.set('date', date);
    if (department && department !== 'ALL') params = params.set('department', department);
    if (shift && shift !== 'ALL') params = params.set('shift', shift);
    if (search) params = params.set('search', search);

    return this.http.get(`${this.apiUrl}/daily`, { params, withCredentials: true });
  }

  getMonthly(year?: number, month?: number, department?: string, shift?: string, search?: string): Observable<any> {
    let params = new HttpParams();
    if (year) params = params.set('year', year.toString());
    if (month) params = params.set('month', month.toString());
    if (department && department !== 'ALL') params = params.set('department', department);
    if (shift && shift !== 'ALL') params = params.set('shift', shift);
    if (search) params = params.set('search', search);

    return this.http.get(`${this.apiUrl}/monthly`, { params, withCredentials: true });
  }

  getEmployeePunches(empCode: string, date?: string): Observable<any> {
    let params = new HttpParams().set('emp_code', empCode);
    if (date) params = params.set('date', date);
    return this.http.get(`${this.apiUrl}/employee-punches`, { params, withCredentials: true });
  }

  setOverride(empCode: string, date: string, status: string, remarks: string = ''): Observable<any> {
    return this.http.post(
      `${this.apiUrl}/override`,
      { emp_code: empCode, date, status, remarks },
      { withCredentials: true }
    );
  }

  getDevices(): Observable<any> {
    return this.http.get('/api/devices', { withCredentials: true });
  }

  syncDevices(): Observable<any> {
    return this.http.post('/api/devices/sync', {}, { withCredentials: true });
  }

  getShifts(): Observable<any> {
    return this.http.get('/api/shifts', { withCredentials: true });
  }

  getEmployees(): Observable<any> {
    return this.http.get('/api/employees', { withCredentials: true });
  }

  getExportExcelUrl(year: number, month: number, department?: string, shift?: string): string {
    let url = `${this.apiUrl}/export/excel?year=${year}&month=${month}`;
    if (department && department !== 'ALL') url += `&department=${encodeURIComponent(department)}`;
    if (shift && shift !== 'ALL') url += `&shift=${encodeURIComponent(shift)}`;
    return url;
  }

  getExportCsvUrl(year: number, month: number): string {
    return `${this.apiUrl}/export/csv?year=${year}&month=${month}`;
  }
}

