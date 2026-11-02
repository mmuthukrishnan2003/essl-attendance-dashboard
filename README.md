# Centizen eSSL Attendance Management System

A simple, user-friendly, and modern **Employee Attendance Management Dashboard** integrating four eSSL biometric devices (F18 + F12) over Port 4370 with automated First IN, Last OUT, and Intermediate punches calculation.

---

## 🏢 Connected eSSL Biometric Devices

Pre-configured in the database:

| # | Device Name | IP Address | Port | Device Model | Attendance Type |
|---|---|---|---:|---|---|
| 1 | Device 1 - Main Entrance | `172.16.0.4` | 4370 | eSSL F18 + F12 | BOTH (IN & OUT) |
| 2 | Device 2 - Office Floor 1 | `172.16.0.20` | 4370 | eSSL F18 + F12 | BOTH (IN & OUT) |
| 3 | Device 3 - Office Floor 2 | `172.16.0.5` | 4370 | eSSL F18 + F12 | BOTH (IN & OUT) |
| 4 | Device 4 - Rear Exit / Cafeteria | `172.16.0.44` | 4370 | eSSL F18 + F12 | BOTH (IN & OUT) |

---

## 🚀 Key Features

1. **Dashboard Overview**
   - KPI metrics: Total enrolled employees, Present today, Late arrivals, Absent employees.
   - Live punch feed showing real-time biometric logs with employee names and devices.
   - Interactive 7-day weekly attendance trend chart.
   - Connected devices status bar with live ping/health indicator.

2. **Employee Management**
   - Complete employee list with search and department filtering.
   - Employee ID, name, department, designation, shift times, and contact info.
   - Modal to Add, Edit, or Delete employees.
   - Employee profile drilldown with 30-day attendance history and average work hours.

3. **Date-Based Attendance Reports**
   - Interactive date selector (choose any date or date range).
   - Department and attendance status filters (All, Present, Late, Half Day, Absent).
   - Instant export to styled Excel spreadsheet (`.xlsx`) with Centizen headers and formatting.
   - Instant export to CSV (`.csv`) and print-ready stylesheet.

4. **Daily IN/OUT & Duration Calculation**
   - Automatically determines the **First IN** (earliest punch of the day) and **Last OUT** (latest punch of the day).
   - Displays all **Intermediate punches** between the first IN and last OUT.
   - Clickable **"Timeline"** button on each row showing the sequence of punches, exact times, device names, and punch types.
   - Accurately calculates total working hours (e.g. `8h 45m`) based on First IN and Last OUT.
   - Identifies late arrivals using shift start time + grace period (e.g., 09:30 + 15 min grace = 09:45).

5. **Device Integration & Duplicate Prevention**
   - Standalone ZKTeco/pyzk driver supporting both TCP and UDP protocol fallbacks on Port 4370.
   - Automatic background sync every 15 minutes (configurable) via APScheduler.
   - Manual "Sync All Devices" and individual "Sync Logs" buttons.
   - Database-level unique constraint on `(employee_id, timestamp)` prevents duplicate punches.
   - "Seed Sample Office Data" button to test all features when working offline.

6. **Centizen Branding & UI Customization**
   - Pre-loaded with Centizen logo (`company_logo.jpg`).
   - Dynamic Centizen corporate color palette: Deep Navy (`#0a5482`) and Vibrant Orange (`#f27e20`).
   - Logo upload interface allowing live upload and instant preview.
   - Configurable shift start/end times, grace period, and minimum hours for half day / full day.

---

## 🛠️ Quick Start

### 1. Requirements
- Python 3.10+
- Installed packages: `fastapi`, `uvicorn`, `pyzk`, `sqlalchemy`, `openpyxl`, `apscheduler`, `jinja2`

### 2. Launch the Application
Double-click `start_server.bat` or run from terminal:
```bash
python run.py
```

### 3. Open in Browser
Visit:
```
http://localhost:8881
```

