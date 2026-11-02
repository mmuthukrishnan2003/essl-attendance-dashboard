import io
from datetime import datetime, date, timedelta, time
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func

import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

from app.models import Employee, AttendancePunch, Setting, Device, Shift


def get_setting_dict(db: Session) -> Dict[str, str]:
    """Retrieve all company settings as a dictionary."""
    settings = db.query(Setting).all()
    res = {}
    for s in settings:
        res[s.key] = s.value
    return res


def parse_time_str(time_str: str, default: time = time(9, 0)) -> time:
    """Helper to parse HH:MM into a time object."""
    try:
        parts = time_str.split(":")
        return time(int(parts[0]), int(parts[1]))
    except Exception:
        return default


def format_duration(seconds: float) -> Dict[str, Any]:
    """Formats seconds into human readable duration and numeric hours."""
    if seconds <= 0:
        return {"text": "0h 00m", "hours": 0.0, "total_seconds": 0}

    total_seconds = int(seconds)
    hours = total_seconds // 3600
    minutes = (total_seconds % 3600) // 60
    decimal_hours = round(seconds / 3600.0, 2)

    return {
        "text": f"{hours}h {minutes:02d}m",
        "hours": decimal_hours,
        "total_seconds": total_seconds
    }


def process_punches_sequence(
    raw_punches: List[AttendancePunch],
    devices_map: Dict[str, str],
    is_today: bool = False
) -> Dict[str, Any]:
    """
    Processes raw biometric punches for an employee on a target date:
    1. Deduplicates rapid bounce / double-taps (< 45s).
    2. Identifies alternating IN/OUT sequence for biometric devices in BOTH mode:
       - Punch 1: IN (Arrival)
       - Punch 2: OUT (Exit / Break out)
       - Punch 3: IN (Return to office)
       - Punch 4: OUT (Exit / Departure)
       - Punch 5: IN (Return to office)
       ...
    3. If total punches is ODD (1, 3, 5...):
       - The latest punch is an IN punch (Return IN / In Office).
       - The employee is currently inside the office.
       - Last OUT is None ('--').
    4. If total punches is EVEN (2, 4, 6...):
       - The latest punch is an OUT punch (Last OUT).
       - The employee has left the office.
    5. Accurately calculates working hours across all active IN->OUT intervals,
       excluding outside break times.
    """
    if not raw_punches:
        return {
            "total_punches": 0,
            "first_in": None,
            "first_in_time": "--",
            "first_in_device": "--",
            "last_out": None,
            "last_out_time": "--",
            "last_out_device": "--",
            "is_in_office": False,
            "intermediate_punches": [],
            "intermediate_count": 0,
            "duration": {"text": "0h 00m", "hours": 0.0, "total_seconds": 0},
            "total_seconds_worked": 0.0,
            "items": []
        }

    # Step 1: Deduplicate accidental double-taps (< 45 seconds apart)
    valid_punches = []
    for p in raw_punches:
        if not valid_punches:
            valid_punches.append(p)
        else:
            diff = (p.timestamp - valid_punches[-1].timestamp).total_seconds()
            if diff >= 45:
                valid_punches.append(p)

    total = len(valid_punches)
    items = []
    now_time = datetime.now()

    # Step 2: Build detailed punch items with alternating IN/OUT
    for idx, p in enumerate(valid_punches):
        dev_name = devices_map.get(p.device_ip, p.device_ip)
        if idx % 2 == 0:
            # Even index (0, 2, 4...) = IN punch
            punch_type = "IN"
            if idx == 0:
                role = "FIRST_IN"
                label = "First IN (Punch #1)"
            elif idx == total - 1:
                role = "CURRENT_IN"
                label = f"Return IN (Punch #{idx + 1} - In Office)"
            else:
                role = "INTERMEDIATE_IN"
                label = f"Return IN (Punch #{idx + 1})"
        else:
            # Odd index (1, 3, 5...) = OUT punch
            punch_type = "OUT"
            if idx == total - 1:
                role = "LAST_OUT"
                label = f"Last OUT (Punch #{idx + 1})"
            else:
                role = "INTERMEDIATE_OUT"
                label = f"Exit OUT (Punch #{idx + 1})"

        items.append({
            "id": p.id,
            "punch_number": idx + 1,
            "role": role,
            "label": label,
            "timestamp": p.timestamp.strftime("%Y-%m-%d %H:%M:%S"),
            "time": p.timestamp.strftime("%H:%M:%S"),
            "device_ip": p.device_ip,
            "device_name": dev_name,
            "punch_type": punch_type,
            "verify_type": p.verify_type
        })

    # Step 3: Determine First IN and Last OUT
    first_p = valid_punches[0]
    first_in_time = first_p.timestamp.strftime("%H:%M:%S")
    first_in_device = devices_map.get(first_p.device_ip, first_p.device_ip)

    if total % 2 == 0:
        # Even number of punches: Latest punch is an actual OUT punch
        last_p = valid_punches[-1]
        last_out_time = last_p.timestamp.strftime("%H:%M:%S")
        last_out_device = devices_map.get(last_p.device_ip, last_p.device_ip)
        last_out_dt = last_p.timestamp.strftime("%Y-%m-%d %H:%M:%S")
        is_in_office = False
    else:
        # Odd number of punches: Latest punch is an IN punch! Employee is currently in office!
        last_p = None
        last_out_time = "--"
        last_out_device = "--"
        last_out_dt = None
        is_in_office = True

    # Intermediate punches are all punches between the first and last
    intermediate = items[1:-1] if total > 2 else []

    # Step 4: Calculate accurate working hours across IN->OUT intervals
    total_seconds_worked = 0.0
    for k in range(0, total, 2):
        in_t = valid_punches[k].timestamp
        if k + 1 < total:
            out_t = valid_punches[k + 1].timestamp
            total_seconds_worked += max(0.0, (out_t - in_t).total_seconds())
        else:
            # Currently working inside office on an open interval
            if is_today and now_time > in_t:
                total_seconds_worked += max(0.0, (now_time - in_t).total_seconds())

    duration = format_duration(total_seconds_worked)

    return {
        "total_punches": total,
        "first_in": first_p.timestamp.strftime("%Y-%m-%d %H:%M:%S"),
        "first_in_time": first_in_time,
        "first_in_device": first_in_device,
        "last_out": last_out_dt,
        "last_out_time": last_out_time,
        "last_out_device": last_out_device,
        "is_in_office": is_in_office,
        "intermediate_punches": intermediate,
        "intermediate_count": len(intermediate),
        "duration": duration,
        "total_seconds_worked": total_seconds_worked,
        "items": items
    }


def calculate_daily_attendance_for_date(
    target_date: date,
    db: Session,
    department_filter: Optional[str] = None,
    shift_filter: Optional[str] = None,
    search_query: Optional[str] = None
) -> Dict[str, Any]:
    """
    Core attendance engine:
    Calculates First IN, Last OUT, Intermediate punches, and working duration
    for all active employees based on their assigned shift (Daytime or Night Shift).
    Status column is excluded.
    """
    # Query active employees
    emp_query = db.query(Employee).filter(Employee.is_active == True)
    if department_filter and department_filter != "ALL":
        emp_query = emp_query.filter(Employee.department == department_filter)
    if shift_filter and shift_filter != "ALL":
        emp_query = emp_query.filter(
            (Employee.shift_code == shift_filter) |
            (Employee.shift_name == shift_filter)
        )
    if search_query:
        search_pattern = f"%{search_query.strip()}%"
        emp_query = emp_query.filter(
            (Employee.emp_code.ilike(search_pattern)) |
            (Employee.name.ilike(search_pattern))
        )
    employees = emp_query.order_by(Employee.emp_code.asc()).all()

    # Map device IPs to friendly names
    devices = {d.ip_address: d.device_name for d in db.query(Device).all()}

    # Map shifts
    shifts_map = {s.code: s for s in db.query(Shift).all()}

    records = []
    total_punched_in = 0
    total_punched_out = 0
    total_seconds_worked = 0

    is_today = (target_date == date.today())
    now_time = datetime.now()

    for emp in employees:
        shift_obj = shifts_map.get(emp.shift_code)
        is_night = shift_obj.is_night_shift if shift_obj else (
            "NIGHT" in (emp.shift_code or "").upper() or (emp.shift_start and emp.shift_start >= "20:00")
        )

        # Determine window for punches based on whether Daytime or Overnight Night Shift
        if is_night:
            # Night Shift window: from 19:30 on target_date to 08:30 on target_date + 1 day
            window_start = datetime.combine(target_date, time(19, 30))
            window_end = datetime.combine(target_date + timedelta(days=1), time(8, 30))
            shift_label = emp.shift_name or "Night Shift (09:00 PM - Next Day 06:00 AM)"
        else:
            # Daytime window: 05:00 to 23:59:59 on target_date
            window_start = datetime.combine(target_date, time(5, 0))
            window_end = datetime.combine(target_date, time(23, 59, 59))
            shift_label = emp.shift_name or f"{emp.shift_start} - {emp.shift_end}"

        emp_punches = db.query(AttendancePunch).filter(
            AttendancePunch.emp_code == emp.emp_code,
            AttendancePunch.timestamp >= window_start,
            AttendancePunch.timestamp <= window_end
        ).order_by(AttendancePunch.timestamp.asc()).all()

        # Process punches using alternating IN/OUT sequence logic
        processed = process_punches_sequence(emp_punches, devices, is_today=is_today)

        if processed["total_punches"] > 0:
            total_punched_in += 1
            if not processed["is_in_office"]:
                total_punched_out += 1
            total_seconds_worked += processed["total_seconds_worked"]

        is_present = processed["total_punches"] > 0
        record = {
            "date": target_date.strftime("%Y-%m-%d"),
            "emp_id": emp.id,
            "emp_code": emp.emp_code,
            "name": emp.name,
            "department": emp.department,
            "designation": emp.designation,
            "shift": shift_label,
            "is_night_shift": is_night,
            "is_present": is_present,
            "is_absent": not is_present,
            "total_punches": processed["total_punches"],
            "first_in": processed["first_in"],
            "first_in_time": processed["first_in_time"],
            "first_in_device": processed["first_in_device"],
            "last_out": processed["last_out"],
            "last_out_time": processed["last_out_time"],
            "last_out_device": processed["last_out_device"],
            "is_in_office": processed["is_in_office"],
            "intermediate_punches": processed["intermediate_punches"],
            "intermediate_count": processed["intermediate_count"],
            "duration": processed["duration"],
        }

        records.append(record)

    total_employees = len(employees)
    avg_hours = round((total_seconds_worked / 3600.0) / max(1, total_punched_out), 1)

    return {
        "date": target_date.strftime("%Y-%m-%d"),
        "total_employees": total_employees,
        "punched_in_count": total_punched_in,
        "punched_out_count": total_punched_out,
        "present_count": total_punched_in,
        "absent_count": max(0, total_employees - total_punched_in),
        "late_count": 0,
        "avg_working_hours": f"{int(avg_hours)}h {int((avg_hours % 1) * 60):02d}m",
        "records": records
    }


def get_employee_punches_history(
    emp_code: str,
    target_date: date,
    db: Session
) -> Dict[str, Any]:
    """
    Returns the complete list of punches for an employee on a given date,
    clearly identifying First IN, Intermediate Punches, and Last OUT.
    Uses alternating IN/OUT sequence logic to correctly distinguish office entries and exits.
    """
    emp = db.query(Employee).filter(Employee.emp_code == emp_code).first()
    if not emp:
        return {"error": "Employee not found", "punches": []}

    devices = {d.ip_address: d.device_name for d in db.query(Device).all()}

    shift_obj = db.query(Shift).filter(Shift.code == emp.shift_code).first()
    is_night = shift_obj.is_night_shift if shift_obj else (
        "NIGHT" in (emp.shift_code or "").upper() or (emp.shift_start and emp.shift_start >= "20:00")
    )

    if is_night:
        start_dt = datetime.combine(target_date, time(19, 30))
        end_dt = datetime.combine(target_date + timedelta(days=1), time(8, 30))
    else:
        start_dt = datetime.combine(target_date, time(5, 0))
        end_dt = datetime.combine(target_date, time(23, 59, 59))

    punches = db.query(AttendancePunch).filter(
        AttendancePunch.emp_code == emp_code,
        AttendancePunch.timestamp >= start_dt,
        AttendancePunch.timestamp <= end_dt
    ).order_by(AttendancePunch.timestamp.asc()).all()

    processed = process_punches_sequence(punches, devices, is_today=(target_date == date.today()))

    return {
        "emp_code": emp.emp_code,
        "name": emp.name,
        "department": emp.department,
        "designation": emp.designation,
        "shift": emp.shift_name or f"{emp.shift_start} - {emp.shift_end}",
        "is_night_shift": is_night,
        "date": target_date.strftime("%Y-%m-%d"),
        "total_punches": processed["total_punches"],
        "first_in": processed["first_in_time"] if processed["first_in"] else None,
        "last_out": processed["last_out_time"] if processed["last_out"] else None,
        "is_in_office": processed["is_in_office"],
        "total_work_duration": processed["duration"]["text"],
        "punches": processed["items"]
    }


def generate_excel_report(start_date: date, end_date: date, db: Session, department: str = "ALL", shift: str = "ALL") -> io.BytesIO:
    """
    Generates a corporate Excel attendance report for Centizen without status column.
    """
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Attendance Summary"

    settings = get_setting_dict(db)
    company_name = settings.get("company_name", "Centizen IT Services & Solutions")

    navy_fill = PatternFill(start_color="0A5482", end_color="0A5482", fill_type="solid")
    zebra_fill = PatternFill(start_color="FAFAFA", end_color="FAFAFA", fill_type="solid")

    title_font = Font(name="Calibri", size=16, bold=True, color="0A5482")
    subtitle_font = Font(name="Calibri", size=11, italic=True, color="555555")
    header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
    data_font = Font(name="Calibri", size=10)

    thin_border = Border(
        left=Side(style="thin", color="CCCCCC"),
        right=Side(style="thin", color="CCCCCC"),
        top=Side(style="thin", color="CCCCCC"),
        bottom=Side(style="thin", color="CCCCCC"),
    )

    # Title Block
    ws.merge_cells("A1:H1")
    ws["A1"] = f"{company_name} - Biometric Attendance Report"
    ws["A1"].font = title_font
    ws["A1"].alignment = Alignment(horizontal="center", vertical="center")

    ws.merge_cells("A2:H2")
    date_str = (
        f"Date: {start_date.strftime('%d-%b-%Y')}"
        if start_date == end_date
        else f"Date Range: {start_date.strftime('%d-%b-%Y')} to {end_date.strftime('%d-%b-%Y')}"
    )
    ws["A2"] = f"{date_str}  |  Department: {department}  |  Shift: {shift}  |  Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}"
    ws["A2"].font = subtitle_font
    ws["A2"].alignment = Alignment(horizontal="center", vertical="center")

    # Headers (Status and Work Duration removed)
    headers = [
        "Date", "Emp ID", "Employee Name", "Department", "Shift Timing",
        "First IN", "Last OUT", "Intermediate Punches"
    ]

    header_row = 4
    for col_idx, h in enumerate(headers, 1):
        cell = ws.cell(row=header_row, column=col_idx, value=h)
        cell.font = header_font
        cell.fill = navy_fill
        cell.alignment = Alignment(horizontal="center", vertical="center")
        cell.border = thin_border
    ws.row_dimensions[header_row].height = 26

    current_date = start_date
    row_idx = 5
    alt = False

    while current_date <= end_date:
        daily_res = calculate_daily_attendance_for_date(
            target_date=current_date,
            db=db,
            department_filter=department if department != "ALL" else None,
            shift_filter=shift if shift != "ALL" else None
        )

        for rec in daily_res["records"]:
            ws.cell(row=row_idx, column=1, value=rec["date"]).alignment = Alignment(horizontal="center")
            ws.cell(row=row_idx, column=2, value=rec["emp_code"]).alignment = Alignment(horizontal="center")
            ws.cell(row=row_idx, column=3, value=rec["name"]).alignment = Alignment(horizontal="left")
            ws.cell(row=row_idx, column=4, value=rec["department"]).alignment = Alignment(horizontal="left")
            ws.cell(row=row_idx, column=5, value=rec["shift"]).alignment = Alignment(horizontal="center")

            first_in_val = f"{rec['first_in_time']} ({rec['first_in_device']})" if rec['first_in'] else "--"
            ws.cell(row=row_idx, column=6, value=first_in_val).alignment = Alignment(horizontal="center")

            last_out_val = f"{rec['last_out_time']} ({rec['last_out_device']})" if rec['last_out'] else "--"
            ws.cell(row=row_idx, column=7, value=last_out_val).alignment = Alignment(horizontal="center")

            ws.cell(row=row_idx, column=8, value=rec["intermediate_count"]).alignment = Alignment(horizontal="center")

            for c in range(1, 9):
                cell_item = ws.cell(row=row_idx, column=c)
                cell_item.font = data_font
                cell_item.border = thin_border
                if alt:
                    cell_item.fill = zebra_fill

            row_idx += 1
            alt = not alt

        current_date += timedelta(days=1)

    # Column widths
    col_widths = {1: 13, 2: 12, 3: 25, 4: 18, 5: 32, 6: 28, 7: 28, 8: 22}
    for col_i, w in col_widths.items():
        ws.column_dimensions[get_column_letter(col_i)].width = w

    output = io.BytesIO()
    wb.save(output)
    output.seek(0)
    return output
