import io
from collections import defaultdict
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


def format_ot_duration(seconds: int) -> str:
    """Formats overtime seconds into human readable text (e.g. 1h 30m, 45m, or --). Threshold: >= 60s."""
    if not seconds or seconds < 60:
        return "--"
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    if h > 0:
        return f"{h}h {m:02d}m" if m > 0 else f"{h}h 00m"
    return f"{m}m"



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

    # Step 1: Deduplicate accidental double-taps (< 5 seconds apart on the same device)
    valid_punches = []
    for p in raw_punches:
        if not valid_punches:
            valid_punches.append(p)
        else:
            diff = (p.timestamp - valid_punches[-1].timestamp).total_seconds()
            same_dev = (p.device_ip == valid_punches[-1].device_ip)
            if not (same_dev and diff < 5):
                valid_punches.append(p)

    total = len(valid_punches)
    items = []
    now_time = datetime.now()

    # Step 2: Build detailed punch items with alternating IN/OUT
    for idx, p in enumerate(valid_punches):
        dev_name = devices_map.get(p.device_ip, p.device_ip)
        if idx == 0:
            # First punch of the day = First IN
            punch_type = "IN"
            role = "FIRST_IN"
            label = "First IN (Punch #1)"
        elif idx == total - 1 and total > 1:
            # Final punch of the day = Last OUT (matches Monthly Report)
            punch_type = "OUT"
            role = "LAST_OUT"
            label = f"Last OUT (Punch #{idx + 1})"
        else:
            # Intermediate punches
            punch_type = "OUT" if idx % 2 == 1 else "IN"
            role = "INTERMEDIATE"
            label = f"Punch #{idx + 1}"

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

    # Step 3: Determine First IN and Last OUT (consistent with Monthly Report)
    first_p = valid_punches[0]
    first_in_time = first_p.timestamp.strftime("%H:%M:%S")
    first_in_device = devices_map.get(first_p.device_ip, first_p.device_ip)

    if total >= 2:
        # Multiple punches: Latest punch of the day is the Last OUT
        last_p = valid_punches[-1]
        last_out_time = last_p.timestamp.strftime("%H:%M:%S")
        last_out_device = devices_map.get(last_p.device_ip, last_p.device_ip)
        last_out_dt = last_p.timestamp.strftime("%Y-%m-%d %H:%M:%S")
        is_in_office = False
    else:
        # Only 1 punch: Employee punched in, has not punched out yet
        last_p = None
        last_out_time = "--"
        last_out_device = "--"
        last_out_dt = None
        is_in_office = is_today

    # Intermediate punches are all punches between the first and last
    intermediate = items[1:-1] if total > 2 else []

    # Step 4: Calculate accurate working hours across IN->OUT intervals
    total_seconds_worked = 0.0
    if total >= 2:
        for k in range(0, total - 1, 2):
            in_t = valid_punches[k].timestamp
            out_t = valid_punches[k + 1].timestamp
            total_seconds_worked += max(0.0, (out_t - in_t).total_seconds())
        if total % 2 != 0:
            total_seconds_worked += max(0.0, (valid_punches[-1].timestamp - valid_punches[-2].timestamp).total_seconds())
    else:
        if is_today and now_time > valid_punches[0].timestamp:
            total_seconds_worked = max(0.0, (now_time - valid_punches[0].timestamp).total_seconds())

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
    if department_filter and isinstance(department_filter, str) and department_filter != "ALL":
        emp_query = emp_query.filter(Employee.department == department_filter)
    if shift_filter and isinstance(shift_filter, str) and shift_filter != "ALL":
        emp_query = emp_query.filter(
            (Employee.shift_code == shift_filter) |
            (Employee.shift_name == shift_filter)
        )
    if search_query and isinstance(search_query, str) and search_query.strip():
        search_pattern = f"%{search_query.strip()}%"
        emp_query = emp_query.filter(
            (Employee.emp_code.ilike(search_pattern)) |
            (Employee.name.ilike(search_pattern))
        )
    employees = emp_query.order_by(func.lower(Employee.name).asc(), Employee.emp_code.asc()).all()

    # Map device IPs to friendly names
    devices = {d.ip_address: d.device_name for d in db.query(Device).all()}

    # Map shifts
    shifts_map = {s.code: s for s in db.query(Shift).all()}

    records = []
    total_punched_in = 0
    total_punched_out = 0
    total_seconds_worked = 0
    total_wfh_count = 0

    is_today = (target_date == date.today())
    now_time = datetime.now()

    for emp in employees:
        shift_obj = shifts_map.get(emp.shift_code)
        is_wfh = (
            (emp.shift_code == "SHIFT_WFH") or 
            ("WFH" in (emp.shift_code or "").upper()) or 
            ("WFH" in (emp.shift_name or "").upper())
        )
        is_night = False
        if not is_wfh:
            is_night = shift_obj.is_night_shift if shift_obj else (
                "NIGHT" in (emp.shift_code or "").upper() or (emp.shift_start and emp.shift_start >= "20:00")
            )

        # Determine window for punches based on whether Daytime, Overnight Night Shift, or WFH
        if is_night:
            # Night Shift window: from 19:30 on target_date to 08:30 on target_date + 1 day
            window_start = datetime.combine(target_date, time(19, 30))
            window_end = datetime.combine(target_date + timedelta(days=1), time(8, 30))
            shift_label = emp.shift_name or "Night Shift (09:00 PM - Next Day 06:00 AM)"
        elif is_wfh:
            window_start = datetime.combine(target_date, time(5, 0))
            window_end = datetime.combine(target_date, time(23, 59, 59))
            shift_label = emp.shift_name or "Work From Home (WFH)"
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

        if is_wfh:
            total_wfh_count += 1
            if processed["total_punches"] > 0:
                total_punched_in += 1
                if not processed["is_in_office"]:
                    total_punched_out += 1
                total_seconds_worked += processed["total_seconds_worked"]
                is_present = True
                first_in_time = processed["first_in_time"]
                first_in_device = processed["first_in_device"]
                last_out_time = processed["last_out_time"]
                last_out_device = processed["last_out_device"]
                duration = processed["duration"]
            else:
                # WFH employee without biometric door punches: counted as remote present
                is_present = True
                first_in_time = "🏠 WFH"
                first_in_device = "Remote Work"
                last_out_time = "🏠 WFH"
                last_out_device = "Remote Work"
                duration = {"text": "9h 00m", "hours": 9.0, "total_seconds": 32400}
                total_seconds_worked += 32400
        else:
            if processed["total_punches"] > 0:
                total_punched_in += 1
                if not processed["is_in_office"]:
                    total_punched_out += 1
                total_seconds_worked += processed["total_seconds_worked"]

            is_present = processed["total_punches"] > 0
            first_in_time = processed["first_in_time"]
            first_in_device = processed["first_in_device"]
            last_out_time = processed["last_out_time"]
            last_out_device = processed["last_out_device"]
            duration = processed["duration"]

        # Resolve shift start, grace, and end times based on employee's shift
        office_start_t = time(9, 0, 0)
        office_late_grace_t = time(9, 5, 0)
        office_end_t = time(19, 0, 0)
        has_late_cutoff = True
        has_early_cutoff = True

        name_upper = (getattr(emp, "name", "") or "").upper()
        code_upper = str(getattr(emp, "emp_code", "") or "").upper()
        s_code = (getattr(emp, "shift_code", "") or "").upper()
        s_name = (getattr(emp, "shift_name", "") or "").upper()
        s_str = f"{s_code} {s_name}".upper()

        if is_wfh or "VISIT" in name_upper or "VISIT" in code_upper or name_upper in ("ADMINISTER", "ADMIN") or code_upper in ("1", "OA"):
            has_late_cutoff = False
            has_early_cutoff = False
        elif "CLEAN" in s_str or "CLEAN" in name_upper or "CLEAN" in code_upper:
            # Cleaning team - flexible shift, no late arrival penalty
            has_late_cutoff = False
            has_early_cutoff = False
        elif is_night:
            office_start_t = time(21, 0, 0)
            office_late_grace_t = time(21, 5, 0)
            office_end_t = time(6, 0, 0)
            has_late_cutoff = True
            has_early_cutoff = True
        elif "9_6" in s_str or "18:00" in s_str or "STANDARD" in s_str:
            office_start_t = time(9, 0, 0)
            office_late_grace_t = time(9, 5, 0)
            office_end_t = time(18, 0, 0)
            has_late_cutoff = True
            has_early_cutoff = True
        elif "9_7" in s_str or "19:00" in s_str or "GENERAL" in s_str:
            office_start_t = time(9, 0, 0)
            office_late_grace_t = time(9, 5, 0)
            office_end_t = time(19, 0, 0)
            has_late_cutoff = True
            has_early_cutoff = True
        else:
            raw_start = getattr(emp, "shift_start", None) or (shift_obj.start_time if shift_obj else None)
            raw_end = getattr(emp, "shift_end", None) or (shift_obj.end_time if shift_obj else None)
            if raw_start in ("00:00", None, "") or raw_end in ("00:00", None, ""):
                has_late_cutoff = False
                has_early_cutoff = False
            else:
                try:
                    p_s = [int(x) for x in str(raw_start).split(":")[:2]]
                    office_start_t = time(p_s[0], p_s[1])
                    gm = p_s[1] + 5
                    gh = p_s[0]
                    if gm >= 60:
                        gh = (gh + 1) % 24
                        gm -= 60
                    office_late_grace_t = time(gh, gm)
                    has_late_cutoff = True
                except Exception:
                    has_late_cutoff = False
                try:
                    p_e = [int(x) for x in str(raw_end).split(":")[:2]]
                    office_end_t = time(p_e[0], p_e[1])
                    has_early_cutoff = True
                except Exception:
                    has_early_cutoff = False

        morning_ot_sec = 0
        evening_ot_sec = 0

        # Late punch detection: First IN after shift cutoff (grace up to 09:05 AM)
        is_late_punch = False
        late_punch_mins = 0
        late_punch_text = "On Time"

        if has_late_cutoff and first_in_time and first_in_time not in ("--", "🏠 WFH"):
            try:
                fit_t = datetime.strptime(first_in_time, "%H:%M:%S").time()
                if fit_t > office_late_grace_t:
                    is_late_punch = True
                    sec_late = int((datetime.combine(target_date, fit_t) - datetime.combine(target_date, office_late_grace_t)).total_seconds())
                    late_punch_mins = sec_late // 60
                    late_punch_text = f"Late by {late_punch_mins}m" if late_punch_mins > 0 else "Late"
            except Exception:
                pass

        # Early exit detection: Last OUT before shift end
        is_early_out = False
        early_out_mins = 0
        if has_early_cutoff and last_out_time and last_out_time not in ("--", "🏠 WFH", "In Office"):
            try:
                lot_t = datetime.strptime(last_out_time, "%H:%M:%S").time()
                if lot_t < office_end_t:
                    is_early_out = True
                    sec_early = int((datetime.combine(target_date, office_end_t) - datetime.combine(target_date, lot_t)).total_seconds())
                    early_out_mins = sec_early // 60
            except Exception:
                pass

        if first_in_time and first_in_time not in ("--", "🏠 WFH"):
            try:
                fit_t = datetime.strptime(first_in_time, "%H:%M:%S").time()
                if fit_t < office_start_t:
                    sec = int((datetime.combine(target_date, office_start_t) - datetime.combine(target_date, fit_t)).total_seconds())
                    if sec >= 60:
                        morning_ot_sec = sec
            except Exception:
                pass

        if last_out_time and last_out_time not in ("--", "🏠 WFH"):
            try:
                lot_t = datetime.strptime(last_out_time, "%H:%M:%S").time()
                if lot_t > office_end_t:
                    sec = int((datetime.combine(target_date, lot_t) - datetime.combine(target_date, office_end_t)).total_seconds())
                    if sec >= 60:
                        evening_ot_sec = sec
            except Exception:
                pass
        elif processed.get("items") and len(processed["items"]) > 0:
            try:
                latest_p_t = datetime.strptime(processed["items"][-1]["time"], "%H:%M:%S").time()
                if latest_p_t > office_end_t:
                    sec = int((datetime.combine(target_date, latest_p_t) - datetime.combine(target_date, office_end_t)).total_seconds())
                    if sec >= 60:
                        evening_ot_sec = sec
            except Exception:
                pass

        total_ot_sec = morning_ot_sec + evening_ot_sec

        record = {
            "date": target_date.strftime("%d-%m-%Y"),
            "date_iso": target_date.strftime("%Y-%m-%d"),
            "emp_id": emp.id,
            "emp_code": emp.emp_code,
            "name": emp.name,
            "department": emp.department,
            "designation": emp.designation,
            "shift": shift_label,
            "shift_code": emp.shift_code or ("SHIFT_WFH" if is_wfh else "SHIFT_9_6"),
            "is_night_shift": is_night,
            "is_wfh": is_wfh,
            "is_present": is_present,
            "is_absent": not is_present,
            "total_punches": processed["total_punches"],
            "first_in": processed["first_in"],
            "first_in_time": first_in_time,
            "first_in_device": first_in_device,
            "last_out": processed["last_out"],
            "last_out_time": last_out_time,
            "last_out_device": last_out_device,
            "is_in_office": processed["is_in_office"],
            "intermediate_punches": processed["intermediate_punches"],
            "intermediate_count": processed["intermediate_count"],
            "duration": duration,
            "is_late": is_late_punch,
            "late_mins": late_punch_mins,
            "late_text": late_punch_text,
            "is_early_out": is_early_out,
            "early_out_mins": early_out_mins,
            "morning_ot": format_ot_duration(morning_ot_sec),
            "morning_ot_seconds": morning_ot_sec,
            "evening_ot": format_ot_duration(evening_ot_sec),
            "evening_ot_seconds": evening_ot_sec,
            "total_ot": format_ot_duration(total_ot_sec),
            "total_ot_seconds": total_ot_sec,
            "has_overtime": total_ot_sec > 0,
        }

        records.append(record)

    total_employees = len(employees)
    wfh_remote_count = sum(1 for r in records if r["is_wfh"] and r["total_punches"] == 0)
    total_present = total_punched_in + wfh_remote_count
    absent_count = max(0, total_employees - total_present)
    effective_out_count = max(1, total_punched_out + wfh_remote_count)
    avg_hours = round((total_seconds_worked / 3600.0) / effective_out_count, 1)

    tot_m_ot_sec = sum(r["morning_ot_seconds"] for r in records)
    tot_e_ot_sec = sum(r["evening_ot_seconds"] for r in records)
    tot_ot_sec = tot_m_ot_sec + tot_e_ot_sec

    return {
        "date": target_date.strftime("%Y-%m-%d"),
        "total_employees": total_employees,
        "punched_in_count": total_punched_in,
        "punched_out_count": total_punched_out,
        "wfh_count": total_wfh_count,
        "present_count": total_present,
        "absent_count": absent_count,
        "late_count": sum(1 for r in records if r.get("is_late")),
        "avg_working_hours": f"{int(avg_hours)}h {int((avg_hours % 1) * 60):02d}m",
        "overtime_employees_count": sum(1 for r in records if r["has_overtime"]),
        "total_morning_ot_seconds": tot_m_ot_sec,
        "total_morning_ot_text": format_ot_duration(tot_m_ot_sec) if tot_m_ot_sec > 0 else "0h 00m",
        "total_evening_ot_seconds": tot_e_ot_sec,
        "total_evening_ot_text": format_ot_duration(tot_e_ot_sec) if tot_e_ot_sec > 0 else "0h 00m",
        "total_ot_seconds": tot_ot_sec,
        "total_ot_text": format_ot_duration(tot_ot_sec) if tot_ot_sec > 0 else "0h 00m",
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

    # Title Block (7 columns: A to G)
    ws.merge_cells("A1:G1")
    ws["A1"] = f"{company_name} - Biometric Attendance Report"
    ws["A1"].font = title_font
    ws["A1"].alignment = Alignment(horizontal="center", vertical="center")

    ws.merge_cells("A2:G2")
    date_str = (
        f"Date: {start_date.strftime('%d-%m-%Y')}"
        if start_date == end_date
        else f"Date Range: {start_date.strftime('%d-%m-%Y')} to {end_date.strftime('%d-%m-%Y')}"
    )
    ws["A2"] = f"{date_str}  |  Department: {department}  |  Shift: {shift}  |  Generated: {datetime.now().strftime('%d-%m-%Y %H:%M')}"
    ws["A2"].font = subtitle_font
    ws["A2"].alignment = Alignment(horizontal="center", vertical="center")

    # Headers (Department and Status removed)
    headers = [
        "Date", "Emp ID", "Employee Name", "Shift Timing",
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
            date_display = current_date.strftime("%d-%m-%Y")
            ws.cell(row=row_idx, column=1, value=date_display).alignment = Alignment(horizontal="center")
            ws.cell(row=row_idx, column=2, value=rec["emp_code"]).alignment = Alignment(horizontal="center")
            ws.cell(row=row_idx, column=3, value=rec["name"]).alignment = Alignment(horizontal="left")
            ws.cell(row=row_idx, column=4, value=rec["shift"]).alignment = Alignment(horizontal="center")

            if rec.get("is_wfh") and not rec.get("first_in"):
                first_in_val = "🏠 WFH (Remote)"
                last_out_val = "🏠 WFH (Remote)"
            else:
                f_time = rec.get("first_in_time") or "--"
                f_dev = rec.get("first_in_device") or ""
                first_in_val = f"{f_time} ({f_dev})" if rec.get("first_in") and f_time != "--" else "--"

                l_time = rec.get("last_out_time") or "--"
                l_dev = rec.get("last_out_device") or ""
                last_out_val = f"{l_time} ({l_dev})" if rec.get("last_out") and l_time != "--" else "--"
            ws.cell(row=row_idx, column=5, value=first_in_val).alignment = Alignment(horizontal="center")
            ws.cell(row=row_idx, column=6, value=last_out_val).alignment = Alignment(horizontal="center")
            ws.cell(row=row_idx, column=7, value=rec.get("intermediate_count", 0)).alignment = Alignment(horizontal="center")

            for c in range(1, 8):
                cell_item = ws.cell(row=row_idx, column=c)
                cell_item.font = data_font
                cell_item.border = thin_border
                if alt:
                    cell_item.fill = zebra_fill

            row_idx += 1
            alt = not alt

        current_date += timedelta(days=1)

    # Column widths (7 columns)
    col_widths = {1: 15, 2: 12, 3: 26, 4: 34, 5: 25, 6: 25, 7: 22}
    for col_i, w in col_widths.items():
        ws.column_dimensions[get_column_letter(col_i)].width = w

    output = io.BytesIO()
    wb.save(output)
    output.seek(0)
    return output


def calculate_daily_overtime_summary(
    target_date: date,
    db: Session,
    office_start: time = time(9, 0, 0),
    office_end: time = time(19, 0, 0)
) -> Dict[str, Any]:
    """
    Computes daily Overtime summary according to the user's business rule:
    - Office standard time starts at 09:00 AM and ends at 07:00 PM (19:00).
    - Morning OT (🌅 Before 9:00 AM): 09:00 AM - First IN.
    - Evening OT (🌙 After 7:00 PM): Last OUT - 07:00 PM (19:00).
    - Total OT: Morning OT + Evening OT.
    Returns aggregated metrics and employee breakdown sorted descending by Total OT.
    """
    start_dt = datetime.combine(target_date, time(0, 0, 0))
    end_dt = datetime.combine(target_date, time(23, 59, 59))

    employees = {e.emp_code: e for e in db.query(Employee).filter(Employee.is_active == True).all()}
    devices_map = {d.ip_address: d.device_name for d in db.query(Device).all()}

    punches = db.query(AttendancePunch).filter(
        AttendancePunch.timestamp >= start_dt,
        AttendancePunch.timestamp <= end_dt
    ).order_by(AttendancePunch.timestamp.asc()).all()

    emp_punches = defaultdict(list)
    for p in punches:
        emp_punches[p.emp_code].append(p)

    ot_records = []
    total_morning_ot_sec = 0
    total_evening_ot_sec = 0

    for emp_code, p_list in emp_punches.items():
        # Deduplicate scans within 45 seconds
        valid = []
        for p in p_list:
            if not valid or (p.timestamp - valid[-1].timestamp).total_seconds() >= 45:
                valid.append(p)
        if not valid:
            continue

        first_in = valid[0].timestamp

        # Determine last out
        if len(valid) >= 2:
            last_out = valid[-1].timestamp
        elif len(valid) == 1 and valid[0].timestamp.time() > office_end:
            last_out = valid[0].timestamp
        else:
            last_out = None

        morning_ot_sec = 0
        if first_in.time() < office_start:
            sec = int((datetime.combine(target_date, office_start) - first_in).total_seconds())
            if sec >= 60:
                morning_ot_sec = sec

        evening_ot_sec = 0
        if last_out and last_out.time() > office_end:
            sec = int((last_out - datetime.combine(target_date, office_end)).total_seconds())
            if sec >= 60:
                evening_ot_sec = sec

        total_ot_sec = morning_ot_sec + evening_ot_sec

        if total_ot_sec >= 60:
            total_morning_ot_sec += morning_ot_sec
            total_evening_ot_sec += evening_ot_sec
            emp = employees.get(emp_code)
            emp_name = emp.name if emp else f"Emp {emp_code}"
            dept = emp.department if emp else "General"

            ot_records.append({
                "emp_code": emp_code,
                "name": emp_name,
                "department": dept,
                "first_in": first_in.strftime("%H:%M:%S"),
                "first_in_device": devices_map.get(valid[0].device_ip, valid[0].device_ip),
                "last_out": last_out.strftime("%H:%M:%S") if last_out else "--",
                "last_out_device": devices_map.get(valid[-1].device_ip, valid[-1].device_ip) if last_out else "--",
                "morning_ot_seconds": morning_ot_sec,
                "morning_ot_text": f"+{format_ot_duration(morning_ot_sec)}" if morning_ot_sec > 0 else "--",
                "morning_ot_hours": round(morning_ot_sec / 3600.0, 2),
                "evening_ot_seconds": evening_ot_sec,
                "evening_ot_text": f"+{format_ot_duration(evening_ot_sec)}" if evening_ot_sec > 0 else "--",
                "evening_ot_hours": round(evening_ot_sec / 3600.0, 2),
                "total_ot_seconds": total_ot_sec,
                "total_ot_text": format_ot_duration(total_ot_sec),
                "total_ot_hours": round(total_ot_sec / 3600.0, 2),
            })

    # Sort descending by total overtime seconds, then emp name
    ot_records.sort(key=lambda x: (-x["total_ot_seconds"], x["name"].lower()))
    total_ot_sec = total_morning_ot_sec + total_evening_ot_sec

    return {
        "date": target_date.strftime("%Y-%m-%d"),
        "date_formatted": target_date.strftime("%A, %d %B %Y"),
        "office_start": "09:00 AM",
        "office_end": "07:00 PM",
        "total_employees_with_ot": len(ot_records),
        "total_morning_ot_seconds": total_morning_ot_sec,
        "total_morning_ot_text": format_ot_duration(total_morning_ot_sec) if total_morning_ot_sec > 0 else "0h 00m",
        "total_morning_ot_hours": round(total_morning_ot_sec / 3600.0, 2),
        "total_evening_ot_seconds": total_evening_ot_sec,
        "total_evening_ot_text": format_ot_duration(total_evening_ot_sec) if total_evening_ot_sec > 0 else "0h 00m",
        "total_evening_ot_hours": round(total_evening_ot_sec / 3600.0, 2),
        "total_ot_seconds": total_ot_sec,
        "total_ot_text": format_ot_duration(total_ot_sec) if total_ot_sec > 0 else "0h 00m",
        "total_ot_hours": round(total_ot_sec / 3600.0, 2),
        "employees": ot_records
    }


def calculate_weekly_overtime_trend(
    end_date: date,
    db: Session,
    days: int = 7
) -> List[Dict[str, Any]]:
    """
    Computes overtime metrics for the last N days (excluding Sundays) for the weekly overtime chart.
    """
    trend = []
    for day_offset in range(days - 1, -1, -1):
        cur_date = end_date - timedelta(days=day_offset)
        if cur_date.weekday() == 6:  # Skip Sunday
            continue
        ot_summary = calculate_daily_overtime_summary(cur_date, db)
        trend.append({
            "date": cur_date.strftime("%d %b"),
            "full_date": cur_date.strftime("%Y-%m-%d"),
            "day": cur_date.strftime("%a"),
            "morning_ot_hours": ot_summary["total_morning_ot_hours"],
            "evening_ot_hours": ot_summary["total_evening_ot_hours"],
            "total_ot_hours": ot_summary["total_ot_hours"],
            "employees_count": ot_summary["total_employees_with_ot"],
            "morning_ot_text": ot_summary["total_morning_ot_text"],
            "evening_ot_text": ot_summary["total_evening_ot_text"],
            "total_ot_text": ot_summary["total_ot_text"]
        })
    return trend

