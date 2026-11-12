import calendar
import io
from datetime import datetime, date, timedelta, time
from typing import Dict, Any, List, Optional
from collections import defaultdict
from sqlalchemy.orm import Session
from sqlalchemy import func
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

from app.models import Employee, AttendancePunch, Shift, Device, AttendanceOverride
from app.attendance_service import get_setting_dict

def get_monthly_attendance_matrix(
    year: int,
    month: int,
    db: Session,
    department_filter: Optional[str] = None,
    shift_filter: Optional[str] = None,
    search_query: Optional[str] = None
) -> Dict[str, Any]:
    """
    Computes a monthly muster roll matrix (Days 1 to 31) for all employees in a single high-performance query.
    Returns status per day:
      'P' = Present (punched in), includes first_in and last_out times
      'WFH' = Work From Home (WFH shift assigned)
      'WO' = Weekly Off (Sundays)
      'A' = Absent (working day without punch)
    """
    num_days = calendar.monthrange(year, month)[1]
    month_name = date(year, month, 1).strftime("%B %Y")
    start_dt = datetime(year, month, 1, 0, 0, 0)
    end_dt = datetime(year, month, num_days, 23, 59, 59)

    # 1. Fetch all punches in the month in a single indexed query
    raw_punches = db.query(
        AttendancePunch.emp_code,
        AttendancePunch.timestamp,
        AttendancePunch.device_ip
    ).filter(
        AttendancePunch.timestamp >= start_dt,
        AttendancePunch.timestamp <= end_dt
    ).order_by(AttendancePunch.timestamp.asc()).all()

    # Organize punches by [emp_code][day_int] -> list of timestamps
    emp_day_punches = defaultdict(lambda: defaultdict(list))
    for p in raw_punches:
        emp_day_punches[p.emp_code][p.timestamp.day].append(p.timestamp)

    # 2. Query employees (sorted A-Z)
    emp_query = db.query(Employee)
    if department_filter and department_filter != "ALL":
        emp_query = emp_query.filter(Employee.department == department_filter)
    if shift_filter and shift_filter != "ALL":
        if shift_filter == "SHIFT_9_6":
            emp_query = emp_query.filter(
                (Employee.shift_code == "SHIFT_9_6") | 
                (func.lower(Employee.shift_name).contains("06:00")) |
                (func.lower(Employee.shift_name).contains("standard"))
            )
        elif shift_filter == "SHIFT_9_7":
            emp_query = emp_query.filter(
                (Employee.shift_code == "SHIFT_9_7") | 
                (func.lower(Employee.shift_name).contains("07:00")) |
                (func.lower(Employee.shift_name).contains("general"))
            )
        else:
            emp_query = emp_query.filter(
                (Employee.shift_code == shift_filter) | (Employee.shift_name == shift_filter)
            )
    else:
        # Default: Apply to the two permission groups: General Shift and Standard Shift
        emp_query = emp_query.filter(
            (Employee.shift_code.in_(["SHIFT_9_7", "SHIFT_9_6"])) |
            (func.lower(Employee.shift_name).contains("general")) |
            (func.lower(Employee.shift_name).contains("standard")) |
            (func.lower(Employee.shift_name).contains("07:00")) |
            (func.lower(Employee.shift_name).contains("06:00"))
        )
    if search_query and isinstance(search_query, str) and search_query.strip():
        sq = f"%{search_query.strip().lower()}%"
        emp_query = emp_query.filter(
            (func.lower(Employee.name).like(sq)) | (func.lower(Employee.emp_code).like(sq))
        )

    employees = emp_query.order_by(func.lower(Employee.name).asc()).all()

    # Meta for each day of the month
    days_meta = []
    working_days_count = 0
    today = date.today()

    for d in range(1, num_days + 1):
        cur_date = date(year, month, d)
        is_sun = (cur_date.weekday() == 6)
        if not is_sun:
            working_days_count += 1
        days_meta.append({
            "day": d,
            "weekday": cur_date.strftime("%a"),
            "is_weekend": is_sun,
            "date": cur_date.strftime("%Y-%m-%d"),
            "is_past_or_today": (cur_date <= today)
        })

    # Query attendance status overrides for the month
    start_date_str = f"{year:04d}-{month:02d}-01"
    end_date_str = f"{year:04d}-{month:02d}-{num_days:02d}"
    overrides_list = db.query(AttendanceOverride).filter(
        AttendanceOverride.date >= start_date_str,
        AttendanceOverride.date <= end_date_str
    ).all()
    emp_overrides = defaultdict(dict)
    for o in overrides_list:
        try:
            day_num = int(o.date.split("-")[2])
            emp_overrides[o.emp_code][day_num] = o
        except Exception:
            pass

    records = []
    total_present_overall = 0
    total_absent_overall = 0
    total_wfh_overall = 0
    total_wfh_fn_overall = 0
    total_wfh_an_overall = 0

    for emp in employees:
        is_wfh_emp = (
            (emp.shift_code and "WFH" in emp.shift_code.upper()) or
            (emp.shift_name and "WFH" in emp.shift_name.upper())
        )

        emp_days = {}
        pres_cnt = 0
        abs_cnt = 0
        wfh_cnt = 0
        wfh_fn_cnt = 0
        wfh_an_cnt = 0
        wo_cnt = 0

        for d in range(1, num_days + 1):
            cur_date = date(year, month, d)
            cur_date_str = cur_date.strftime("%Y-%m-%d")
            is_sun = (cur_date.weekday() == 6)
            punches_list = emp_day_punches[emp.emp_code].get(d, [])
            ovr = emp_overrides.get(emp.emp_code, {}).get(d)
            is_overridden = bool(ovr)
            override_notes = ovr.notes if ovr else None
            day_is_late = False
            day_late_mins = 0

            # Default calculation from punches & shifts
            if is_sun:
                default_status = "WO"
                f_in = punches_list[0].strftime("%H:%M:%S") if punches_list else None
                l_out = punches_list[-1].strftime("%H:%M:%S") if len(punches_list) > 1 else f_in
            elif punches_list:
                default_status = "P"
                f_in_dt = punches_list[0]
                f_in = f_in_dt.strftime("%H:%M:%S")
                l_out = punches_list[-1].strftime("%H:%M:%S") if len(punches_list) > 1 else f_in
                # Check late arrival (> 09:05 AM based on shift)
                emp_n_up = (getattr(emp, "name", "") or "").upper()
                emp_c_up = str(getattr(emp, "emp_code", "") or "").upper()
                emp_s_up = f"{getattr(emp, 'shift_code', '') or ''} {getattr(emp, 'shift_name', '') or ''}".upper()
                is_exempt = ("VISIT" in emp_n_up or "VISIT" in emp_c_up)

                if not is_exempt and f_in_dt.time() > time(9, 5, 0):
                    day_is_late = True
                    sec_late = int((f_in_dt - datetime.combine(cur_date, time(9, 5, 0))).total_seconds())
                    day_late_mins = sec_late // 60
                else:
                    day_is_late = False
                    day_late_mins = 0
            elif is_wfh_emp:
                default_status = "WFH"
                f_in = None
                l_out = None
            else:
                default_status = "A"
                f_in = None
                l_out = None

            # Apply manual override if present
            if ovr:
                status = ovr.status
                if status == "WFH":
                    wfh_cnt += 1
                    day_is_late = False
                    day_late_mins = 0
                elif status == "WFH-FN":
                    wfh_fn_cnt += 1
                    wfh_cnt += 1
                    day_is_late = False
                    day_late_mins = 0
                elif status == "WFH-AN":
                    wfh_an_cnt += 1
                    wfh_cnt += 1
                    day_is_late = False
                    day_late_mins = 0
                elif status in ("P", "PRESENT"):
                    status = "P"
                    pres_cnt += 1
                elif status in ("A", "ABSENT"):
                    status = "A"
                    abs_cnt += 1
                    day_is_late = False
                    day_late_mins = 0
                elif status == "WO":
                    status = "WO"
                    wo_cnt += 1
                    day_is_late = False
                    day_late_mins = 0
                else:
                    status = ovr.status
            else:
                status = default_status
                if status == "WO":
                    wo_cnt += 1
                elif status == "P":
                    pres_cnt += 1
                elif status == "WFH":
                    wfh_cnt += 1
                elif status == "A":
                    abs_cnt += 1

            emp_days[str(d)] = {
                "day": d,
                "date": cur_date_str,
                "status": status,
                "first_in": f_in,
                "last_out": l_out,
                "punches_count": len(punches_list),
                "is_late": day_is_late if punches_list and not is_sun and status == "P" else False,
                "late_mins": day_late_mins if punches_list and not is_sun and status == "P" else 0,
                "is_overridden": is_overridden,
                "override_status": ovr.status if ovr else None,
                "override_notes": override_notes
            }

        total_present_overall += pres_cnt
        total_absent_overall += abs_cnt
        total_wfh_overall += wfh_cnt
        total_wfh_fn_overall += wfh_fn_cnt
        total_wfh_an_overall += wfh_an_cnt

        total_work_days = pres_cnt + abs_cnt + wfh_cnt
        attendance_rate = round(((pres_cnt + wfh_cnt) / total_work_days * 100), 1) if total_work_days > 0 else 0.0

        emp_late_cnt = sum(1 for d_info in emp_days.values() if d_info.get("is_late"))
        emp_total_late_mins = sum(d_info.get("late_mins", 0) for d_info in emp_days.values())

        records.append({
            "emp_code": emp.emp_code,
            "name": emp.name,
            "department": emp.department or "General",
            "shift": emp.shift_name or emp.shift_code or "Standard Shift",
            "is_wfh": is_wfh_emp,
            "days": emp_days,
            "present_count": pres_cnt,
            "late_count": emp_late_cnt,
            "total_late_mins": emp_total_late_mins,
            "absent_count": abs_cnt,
            "wfh_count": wfh_cnt,
            "wfh_fn_count": wfh_fn_cnt,
            "wfh_an_count": wfh_an_cnt,
            "wo_count": wo_cnt,
            "attendance_rate": attendance_rate
        })

    # Overall attendance rate
    all_work_days = total_present_overall + total_absent_overall + total_wfh_overall
    overall_rate = round(((total_present_overall + total_wfh_overall) / all_work_days * 100), 1) if all_work_days > 0 else 0.0

    return {
        "year": year,
        "month": month,
        "month_name": month_name,
        "num_days": num_days,
        "working_days": working_days_count,
        "days_meta": days_meta,
        "total_employees": len(employees),
        "summary": {
            "total_present_days": total_present_overall,
            "total_late_days": sum(r["late_count"] for r in records),
            "total_late_staff": sum(1 for r in records if r["late_count"] > 0),
            "total_absent_days": total_absent_overall,
            "total_wfh_days": total_wfh_overall,
            "total_wfh_fn_days": total_wfh_fn_overall,
            "total_wfh_an_days": total_wfh_an_overall,
            "overall_rate": overall_rate
        },
        "records": records
    }


def generate_monthly_excel_report(
    year: int,
    month: int,
    db: Session,
    department: str = "ALL",
    shift: str = "ALL"
) -> io.BytesIO:
    """
    Generates a corporate Muster Roll Excel (.xlsx) workbook for Centizen with 2 sheets:
    Sheet 1: Daily First IN & Last OUT Timestamps per day (Days 1..31)
    Sheet 2: Attendance Status Matrix (P / A / WO / WFH)
    """
    matrix = get_monthly_attendance_matrix(
        year=year,
        month=month,
        db=db,
        department_filter=department,
        shift_filter=shift
    )

    wb = openpyxl.Workbook()
    settings = get_setting_dict(db)
    company_name = settings.get("company_name", "Centizen IT Services & Solutions")

    navy_fill = PatternFill(start_color="0A5482", end_color="0A5482", fill_type="solid")
    p_fill = PatternFill(start_color="D1FAE5", end_color="D1FAE5", fill_type="solid")     # Emerald light
    late_fill = PatternFill(start_color="FEF3C7", end_color="FEF3C7", fill_type="solid")  # Amber light
    a_fill = PatternFill(start_color="FEE2E2", end_color="FEE2E2", fill_type="solid")     # Rose light
    wfh_fill = PatternFill(start_color="E0E7FF", end_color="E0E7FF", fill_type="solid")   # Indigo light
    wfh_fn_fill = PatternFill(start_color="F3E8FF", end_color="F3E8FF", fill_type="solid") # Purple light
    wfh_an_fill = PatternFill(start_color="E0F2FE", end_color="E0F2FE", fill_type="solid") # Sky light
    wo_fill = PatternFill(start_color="F1F5F9", end_color="F1F5F9", fill_type="solid")    # Slate light
    gray_fill = PatternFill(start_color="F8FAFC", end_color="F8FAFC", fill_type="solid")

    title_font = Font(name="Calibri", size=15, bold=True, color="0A5482")
    sub_font = Font(name="Calibri", size=10, italic=True, color="555555")
    header_font = Font(name="Calibri", size=9, bold=True, color="FFFFFF")
    data_font = Font(name="Calibri", size=9)
    bold_font = Font(name="Calibri", size=9, bold=True)
    late_font = Font(name="Calibri", size=9, bold=True, color="92400E")

    thin_border = Border(
        left=Side(style="thin", color="D1D5DB"),
        right=Side(style="thin", color="D1D5DB"),
        top=Side(style="thin", color="D1D5DB"),
        bottom=Side(style="thin", color="D1D5DB")
    )

    num_days = matrix["num_days"]
    total_cols = 3 + num_days + 6  # EmpID, Name, Shift + Days + P, Late, A, WFH, WO, Rate%
    end_letter = get_column_letter(total_cols)
    headers_right = ["Present (P)", "Late Count", "Absent (A)", "WFH", "Week Off (WO)", "Attendance %"]

    # ---------------- SHEET 1: Daily First IN & Last OUT ----------------
    ws1 = wb.active
    ws1.title = "Daily IN-OUT Times"

    ws1.merge_cells(f"A1:{end_letter}1")
    ws1["A1"] = f"{company_name} - Monthly Attendance (Daily First IN & Last OUT)"
    ws1["A1"].font = title_font
    ws1["A1"].alignment = Alignment(horizontal="center", vertical="center")

    ws1.merge_cells(f"A2:{end_letter}2")
    ws1["A2"] = (
        f"Month: {matrix['month_name']}  |  Working Days: {matrix['working_days']}  |  "
        f"Total Employees: {matrix['total_employees']}  |  Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}"
    )
    ws1["A2"].font = sub_font
    ws1["A2"].alignment = Alignment(horizontal="center", vertical="center")

    ws1.merge_cells("A4:A5"); ws1["A4"] = "Emp ID"
    ws1.merge_cells("B4:B5"); ws1["B4"] = "Employee Name"
    ws1.merge_cells("C4:C5"); ws1["C4"] = "Shift Timing"

    for c in range(1, 4):
        for r_h in (4, 5):
            cell = ws1.cell(row=r_h, column=c)
            cell.fill = navy_fill
            cell.font = header_font
            cell.alignment = Alignment(horizontal="center", vertical="center")
            cell.border = thin_border

    # Days columns
    for idx, d_meta in enumerate(matrix["days_meta"], start=4):
        c4 = ws1.cell(row=4, column=idx, value=f"{d_meta['day']:02d}")
        c5 = ws1.cell(row=5, column=idx, value=d_meta["weekday"])
        for cell in (c4, c5):
            cell.fill = navy_fill
            cell.font = header_font
            cell.alignment = Alignment(horizontal="center", vertical="center")
            cell.border = thin_border

    start_summary = 4 + num_days
    for i, h_text in enumerate(headers_right):
        col_i = start_summary + i
        ws1.merge_cells(start_row=4, start_column=col_i, end_row=5, end_column=col_i)
        for r_h in (4, 5):
            cell = ws1.cell(row=r_h, column=col_i)
            cell.fill = navy_fill
            cell.font = header_font
            cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
            cell.border = thin_border
        ws1.cell(row=4, column=col_i, value=h_text)

    ws1.row_dimensions[4].height = 18
    ws1.row_dimensions[5].height = 18

    # Populate Sheet 1 Data
    for r_idx, rec in enumerate(matrix["records"], start=6):
        ws1.cell(row=r_idx, column=1, value=rec["emp_code"]).alignment = Alignment(horizontal="center")
        ws1.cell(row=r_idx, column=2, value=rec["name"]).alignment = Alignment(horizontal="left")
        ws1.cell(row=r_idx, column=3, value=rec["shift"]).alignment = Alignment(horizontal="center")
        for c in range(1, 4):
            ws1.cell(row=r_idx, column=c).font = data_font
            ws1.cell(row=r_idx, column=c).border = thin_border

        for idx, d_meta in enumerate(matrix["days_meta"], start=4):
            d_str = str(d_meta["day"])
            day_info = rec["days"].get(d_str, {"status": "--"})
            st = day_info["status"]
            is_late = day_info.get("is_late", False)

            if st == "P":
                f_in = day_info.get("first_in")
                l_out = day_info.get("last_out")
                if f_in and l_out:
                    val = f"{f_in[:5]} - {l_out[:5]}"
                elif f_in:
                    val = f"{f_in[:5]} (IN)"
                else:
                    val = "P"
                cell_fill = late_fill if is_late else p_fill
                cell_font = late_font if is_late else bold_font
            elif st == "A":
                val = "A"
                cell_fill = a_fill
                cell_font = data_font
            elif st == "WFH":
                val = "WFH"
                cell_fill = wfh_fill
                cell_font = bold_font
            elif st == "WFH-FN":
                val = "WFH-FN"
                cell_fill = wfh_fn_fill
                cell_font = bold_font
            elif st == "WFH-AN":
                val = "WFH-AN"
                cell_fill = wfh_an_fill
                cell_font = bold_font
            elif st == "WO":
                val = "WO"
                cell_fill = wo_fill
                cell_font = data_font
            else:
                val = "--"
                cell_fill = gray_fill
                cell_font = data_font

            c_cell = ws1.cell(row=r_idx, column=idx, value=val)
            c_cell.font = cell_font
            c_cell.fill = cell_fill
            c_cell.alignment = Alignment(horizontal="center", vertical="center")
            c_cell.border = thin_border

        # Summary cells
        ws1.cell(row=r_idx, column=start_summary, value=rec["present_count"]).alignment = Alignment(horizontal="center")
        late_c = ws1.cell(row=r_idx, column=start_summary + 1, value=rec.get("late_count", 0))
        late_c.alignment = Alignment(horizontal="center")
        if rec.get("late_count", 0) > 0:
            late_c.font = late_font
            late_c.fill = late_fill
        ws1.cell(row=r_idx, column=start_summary + 2, value=rec["absent_count"]).alignment = Alignment(horizontal="center")
        ws1.cell(row=r_idx, column=start_summary + 3, value=rec["wfh_count"]).alignment = Alignment(horizontal="center")
        ws1.cell(row=r_idx, column=start_summary + 4, value=rec["wo_count"]).alignment = Alignment(horizontal="center")
        ws1.cell(row=r_idx, column=start_summary + 5, value=f"{rec['attendance_rate']}%").alignment = Alignment(horizontal="center")

        for s_idx in range(start_summary, start_summary + 6):
            c_sum = ws1.cell(row=r_idx, column=s_idx)
            if not c_sum.font or c_sum.font == data_font:
                c_sum.font = bold_font
            c_sum.border = thin_border
        ws1.row_dimensions[r_idx].height = 20

    ws1.column_dimensions["A"].width = 10
    ws1.column_dimensions["B"].width = 24
    ws1.column_dimensions["C"].width = 22
    for idx in range(4, 4 + num_days):
        ws1.column_dimensions[get_column_letter(idx)].width = 13
    for idx in range(start_summary, start_summary + 6):
        ws1.column_dimensions[get_column_letter(idx)].width = 12

    # ---------------- SHEET 2: Muster Roll (Status P/A/WO) ----------------
    ws2 = wb.create_sheet(title="Muster Roll (Status)")
    ws2.merge_cells(f"A1:{end_letter}1")
    ws2["A1"] = f"{company_name} - Monthly Attendance Muster Roll (Status)"
    ws2["A1"].font = title_font
    ws2["A1"].alignment = Alignment(horizontal="center", vertical="center")

    ws2.merge_cells(f"A2:{end_letter}2")
    ws2["A2"] = ws1["A2"].value
    ws2["A2"].font = sub_font
    ws2["A2"].alignment = Alignment(horizontal="center", vertical="center")

    ws2.merge_cells("A4:A5"); ws2["A4"] = "Emp ID"
    ws2.merge_cells("B4:B5"); ws2["B4"] = "Employee Name"
    ws2.merge_cells("C4:C5"); ws2["C4"] = "Shift Timing"
    for c in range(1, 4):
        for r_h in (4, 5):
            cell = ws2.cell(row=r_h, column=c)
            cell.fill = navy_fill
            cell.font = header_font
            cell.alignment = Alignment(horizontal="center", vertical="center")
            cell.border = thin_border

    for idx, d_meta in enumerate(matrix["days_meta"], start=4):
        c4 = ws2.cell(row=4, column=idx, value=f"{d_meta['day']:02d}")
        c5 = ws2.cell(row=5, column=idx, value=d_meta["weekday"])
        for cell in (c4, c5):
            cell.fill = navy_fill
            cell.font = header_font
            cell.alignment = Alignment(horizontal="center", vertical="center")
            cell.border = thin_border

    for i, h_text in enumerate(headers_right):
        col_i = start_summary + i
        ws2.merge_cells(start_row=4, start_column=col_i, end_row=5, end_column=col_i)
        for r_h in (4, 5):
            cell = ws2.cell(row=r_h, column=col_i)
            cell.fill = navy_fill
            cell.font = header_font
            cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
            cell.border = thin_border
        ws2.cell(row=4, column=col_i, value=h_text)

    for r_idx, rec in enumerate(matrix["records"], start=6):
        ws2.cell(row=r_idx, column=1, value=rec["emp_code"]).alignment = Alignment(horizontal="center")
        ws2.cell(row=r_idx, column=2, value=rec["name"]).alignment = Alignment(horizontal="left")
        ws2.cell(row=r_idx, column=3, value=rec["shift"]).alignment = Alignment(horizontal="center")
        for c in range(1, 4):
            ws2.cell(row=r_idx, column=c).font = data_font
            ws2.cell(row=r_idx, column=c).border = thin_border

        for idx, d_meta in enumerate(matrix["days_meta"], start=4):
            d_str = str(d_meta["day"])
            day_info = rec["days"].get(d_str, {"status": "--"})
            st = day_info["status"]
            c_cell = ws2.cell(row=r_idx, column=idx, value=st)
            c_cell.font = bold_font if st in ("P", "WFH", "WFH-FN", "WFH-AN") else data_font
            c_cell.alignment = Alignment(horizontal="center", vertical="center")
            c_cell.border = thin_border
            if st == "P": c_cell.fill = p_fill
            elif st == "A": c_cell.fill = a_fill
            elif st == "WFH": c_cell.fill = wfh_fill
            elif st == "WFH-FN": c_cell.fill = wfh_fn_fill
            elif st == "WFH-AN": c_cell.fill = wfh_an_fill
            elif st == "WO": c_cell.fill = wo_fill
            else: c_cell.fill = gray_fill

        ws2.cell(row=r_idx, column=start_summary, value=rec["present_count"]).alignment = Alignment(horizontal="center")
        late_c = ws2.cell(row=r_idx, column=start_summary + 1, value=rec.get("late_count", 0))
        late_c.alignment = Alignment(horizontal="center")
        if rec.get("late_count", 0) > 0:
            late_c.font = late_font
            late_c.fill = late_fill
        ws2.cell(row=r_idx, column=start_summary + 2, value=rec["absent_count"]).alignment = Alignment(horizontal="center")
        ws2.cell(row=r_idx, column=start_summary + 3, value=rec["wfh_count"]).alignment = Alignment(horizontal="center")
        ws2.cell(row=r_idx, column=start_summary + 4, value=rec["wo_count"]).alignment = Alignment(horizontal="center")
        ws2.cell(row=r_idx, column=start_summary + 5, value=f"{rec['attendance_rate']}%").alignment = Alignment(horizontal="center")
        for s_idx in range(start_summary, start_summary + 6):
            c_sum = ws2.cell(row=r_idx, column=s_idx)
            if not c_sum.font or c_sum.font == data_font: c_sum.font = bold_font
            c_sum.border = thin_border
        ws2.row_dimensions[r_idx].height = 20

    ws2.column_dimensions["A"].width = 10
    ws2.column_dimensions["B"].width = 24
    ws2.column_dimensions["C"].width = 22
    for idx in range(4, 4 + num_days):
        ws2.column_dimensions[get_column_letter(idx)].width = 7
    for idx in range(start_summary, start_summary + 6):
        ws2.column_dimensions[get_column_letter(idx)].width = 12

    stream = io.BytesIO()
    wb.save(stream)
    stream.seek(0)
    return stream


def get_shift_permission_rules(emp):
    """
    Determines shift timings for 2-hour permission quota:
    Supported Groups ONLY:
      1. General Shift (09:00 AM - 07:00 PM): End = 19:00:00 (07:00 PM)
      2. Standard Shift (09:00 AM - 06:00 PM): End = 18:00:00 (06:00 PM)
    Both start at 09:00 AM with grace up to 09:05 AM.
    All other shifts (Cleaning Team, Night Shift, WFH, Visitors, System) are EXCLUDED (is_applicable=False).
    """
    name_upper = (getattr(emp, "name", "") or "").upper()
    code_upper = str(getattr(emp, "emp_code", "") or "").upper()
    
    # Exclude visitors
    if "VISIT" in name_upper or "VISIT" in code_upper:
        return {"is_applicable": False, "shift_name": "Visitor"}

    s_code = (getattr(emp, "shift_code", "") or "").upper()
    s_name = (getattr(emp, "shift_name", "") or "").upper()
    s_str = f"{s_code} {s_name} {getattr(emp, 'shift_end', '') or ''}".upper()

    # Exclude Night Shift, WFH
    if "NIGHT" in s_str:
        return {"is_applicable": False, "shift_name": "Night Shift"}
    if "WFH" in s_str or "REMOTE" in s_str:
        return {"is_applicable": False, "shift_name": "Work From Home"}

    # Standard Shift (9-6)
    if "9_6" in s_str or "18:00" in s_str or "STANDARD" in s_str:
        return {
            "shift_code": "SHIFT_9_6",
            "shift_name": "Standard Shift (09:00 AM - 06:00 PM)",
            "start_time": time(9, 0, 0),
            "grace_time": time(9, 5, 0),
            "end_time": time(18, 0, 0),
            "end_label": "06:00 PM",
            "earliest_exit": time(14, 0, 0),
            "is_applicable": True
        }

    # General Shift / Admin & Cleaning Team (9-7)
    if "9_7" in s_str or "19:00" in s_str or "GENERAL" in s_str or "ADMIN" in s_str or "CLEAN" in s_str:
        return {
            "shift_code": "SHIFT_9_7",
            "shift_name": getattr(emp, "shift_name", None) or "General Shift (09:00 AM - 07:00 PM)",
            "start_time": time(9, 0, 0),
            "grace_time": time(9, 5, 0),
            "end_time": time(19, 0, 0),
            "end_label": "07:00 PM",
            "earliest_exit": time(15, 0, 0),
            "is_applicable": True
        }

    # Dynamic fallback based on employee shift start/end
    raw_start = getattr(emp, "shift_start", "09:00") or "09:00"
    raw_end = getattr(emp, "shift_end", "19:00") or "19:00"
    try:
        p_s = [int(x) for x in str(raw_start).split(":")[:2]]
        st = time(p_s[0], p_s[1])
        gm = p_s[1] + 5
        gh = p_s[0]
        if gm >= 60:
            gh = (gh + 1) % 24
            gm -= 60
        gt = time(gh, gm)
        p_e = [int(x) for x in str(raw_end).split(":")[:2]]
        et = time(p_e[0], p_e[1])
        return {
            "shift_code": getattr(emp, "shift_code", "CUSTOM") or "CUSTOM",
            "shift_name": getattr(emp, "shift_name", "Assigned Shift") or "Assigned Shift",
            "start_time": st,
            "grace_time": gt,
            "end_time": et,
            "end_label": et.strftime("%I:%M %p"),
            "earliest_exit": time(max(0, p_e[0] - 4), p_e[1]),
            "is_applicable": True
        }
    except Exception:
        return {"is_applicable": False, "shift_name": getattr(emp, "shift_name", "Other")}


def get_monthly_exceeded_report(
    year: int,
    month: int,
    db: Session,
    threshold_hours: float = 2.0,
    category: str = "EXCEEDED",  # 'EXCEEDED' (> 2h limit) or 'ALL' (all staff ledger)
    department_filter: Optional[str] = None,
    shift_filter: Optional[str] = None,
    search_query: Optional[str] = None
) -> Dict[str, Any]:
    """
    Computes the Monthly Permission Ledger (2 Hours = 120 Minutes monthly quota per employee).
    
    Business Rules:
      1. Quota: Each employee gets 120 minutes (2 hours) permission per month.
      2. Morning Late Arrival: Standard start is 09:00 AM (grace up to 09:05 AM).
         Arrivals after 09:05 AM are deducted from the 120m quota (e.g. 09:10 AM -> 5m deducted).
      3. Evening Early Exit: Standard exit is 07:00 PM (19:00:00).
         Exits before 07:00 PM are deducted from the 120m quota (e.g. 06:59 PM -> 1m deducted).
         Exits after 07:05 PM are credited as Overtime, NOT deducted from permission.
      4. Midday Breaks: Intermediate scans during office hours consume permission.
      5. Balance Remaining = max(0, 120 - Total Used).
      6. Exceeded Duration = max(0, Total Used - 120). Flagged in RED if Exceeded.
    """
    num_days = calendar.monthrange(year, month)[1]
    month_name = date(year, month, 1).strftime("%B %Y")
    start_dt = datetime(year, month, 1, 0, 0, 0)
    end_dt = datetime(year, month, num_days, 23, 59, 59)

    # 1. Fetch punches for the month
    raw_punches = db.query(
        AttendancePunch.emp_code,
        AttendancePunch.timestamp,
        AttendancePunch.device_ip
    ).filter(
        AttendancePunch.timestamp >= start_dt,
        AttendancePunch.timestamp <= end_dt
    ).order_by(AttendancePunch.timestamp.asc()).all()

    # Devices map
    devices = {d.ip_address: d.device_name for d in db.query(Device).all()}

    # Group by emp_code and date
    emp_day_punches = defaultdict(lambda: defaultdict(list))
    for p in raw_punches:
        emp_day_punches[p.emp_code][p.timestamp.date()].append(p)

    # Query employees
    emp_query = db.query(Employee)
    if department_filter and department_filter != "ALL":
        emp_query = emp_query.filter(Employee.department == department_filter)
    if shift_filter and shift_filter != "ALL":
        if shift_filter == "SHIFT_WFH":
            emp_query = emp_query.filter(
                (Employee.shift_code == "SHIFT_WFH") | (func.lower(Employee.shift_name).contains("wfh"))
            )
        else:
            emp_query = emp_query.filter(
                (Employee.shift_code == shift_filter) | (Employee.shift_name == shift_filter)
            )
    if search_query and isinstance(search_query, str) and search_query.strip():
        sq = f"%{search_query.strip().lower()}%"
        emp_query = emp_query.filter(
            (func.lower(Employee.name).like(sq)) | (func.lower(Employee.emp_code).like(sq))
        )

    employees = {e.emp_code: e for e in emp_query.order_by(func.lower(Employee.name).asc()).all()}

    MONTHLY_QUOTA_MINS = int(threshold_hours * 60) # Default: 120 mins = 2.0 hours
    MORNING_GRACE = time(9, 5, 0)   # 09:05 AM
    OFFICE_END = time(19, 0, 0)     # 07:00 PM

    incidents = []
    summary_list = []
    total_exceeded_mins_sum = 0
    total_used_mins_sum = 0

    for emp_code, days in emp_day_punches.items():
        if emp_code not in employees:
            continue
        emp = employees[emp_code]

        # Resolve employee's shift group rules (General Shift 9-7 vs Standard Shift 9-6)
        shift_cfg = get_shift_permission_rules(emp)
        if not shift_cfg.get("is_applicable"):
            continue
        emp_shift_name = shift_cfg["shift_name"]
        grace_time = shift_cfg["grace_time"]       # 09:05 AM
        office_end = shift_cfg["end_time"]         # 19:00:00 or 18:00:00
        end_label = shift_cfg["end_label"]         # 07:00 PM or 06:00 PM
        earliest_exit = shift_cfg["earliest_exit"] # 15:00 or 14:00

        tot_m_late_mins = 0
        cnt_late_days = 0
        tot_e_early_mins = 0
        cnt_early_days = 0
        active_days_cnt = len(days)
        emp_dates = []

        for dt in sorted(days.keys()):
            p_list = days[dt]
            # Deduplicate scans within 45 seconds
            v_punches = []
            for p in p_list:
                if not v_punches or (p.timestamp - v_punches[-1].timestamp).total_seconds() >= 45:
                    v_punches.append(p)
            if not v_punches:
                continue

            first_in = v_punches[0].timestamp
            last_out = v_punches[-1].timestamp if len(v_punches) >= 2 else None

            day_m_late = 0
            day_e_early = 0
            reasons = []

            # 1. Morning Late (> 09:05 AM)
            # Both General Shift and Standard Shift start at 09:00 AM (grace up to 09:05 AM)
            if grace_time < first_in.time() <= time(13, 0, 0):
                sec = int((first_in - datetime.combine(dt, grace_time)).total_seconds())
                if sec >= 60:
                    day_m_late = sec // 60
                    tot_m_late_mins += day_m_late
                    cnt_late_days += 1
                    reasons.append(f"Late: {day_m_late}m (> 09:05 AM)")

            # 2. Evening Early Exit (< 07:00 PM for General Shift / < 06:00 PM for Standard Shift)
            # Only consider completed days, or today after the shift end time.
            # Never deduct if the day is still in progress (today before shift end).
            now_dt = datetime.now()
            is_past_or_ended = (dt < now_dt.date()) or (dt == now_dt.date() and now_dt.time() >= office_end)
            if is_past_or_ended and last_out and earliest_exit <= last_out.time() < office_end:
                sec = int((datetime.combine(dt, office_end) - last_out).total_seconds())
                if sec >= 60:
                    day_e_early = sec // 60
                    tot_e_early_mins += day_e_early
                    cnt_early_days += 1
                    reasons.append(f"Left Early: {day_e_early}m (< {end_label})")

            day_deducted = day_m_late + day_e_early

            if day_deducted > 0:
                emp_dates.append(dt.strftime("%d-%b"))
                incidents.append({
                    "emp_code": emp.emp_code,
                    "name": emp.name,
                    "department": emp.department or "General",
                    "shift": emp_shift_name,
                    "date": dt.strftime("%Y-%m-%d"),
                    "date_str": dt.strftime("%d-%b-%Y (%a)"),
                    "first_in": first_in.strftime("%H:%M:%S"),
                    "first_in_device": devices.get(v_punches[0].device_ip, v_punches[0].device_ip),
                    "last_out": last_out.strftime("%H:%M:%S") if last_out else "--",
                    "last_out_device": devices.get(v_punches[-1].device_ip, v_punches[-1].device_ip) if last_out else "--",
                    "morning_late_mins": day_m_late,
                    "evening_early_mins": day_e_early,
                    "midday_break_mins": 0,
                    "day_deducted_mins": day_deducted,
                    "day_deducted_text": f"{day_deducted}m" if day_deducted < 60 else f"{day_deducted//60}h {day_deducted%60:02d}m",
                    "reasons": reasons,
                    "reasons_str": " • ".join(reasons),
                    "total_punches": len(v_punches)
                })

        total_used_mins = tot_m_late_mins + tot_e_early_mins
        balance_mins = max(0, MONTHLY_QUOTA_MINS - total_used_mins)
        exceeded_mins = max(0, total_used_mins - MONTHLY_QUOTA_MINS)
        is_exceeded = (exceeded_mins > 0)

        if is_exceeded:
            total_exceeded_mins_sum += exceeded_mins
        total_used_mins_sum += total_used_mins

        summary_list.append({
            "emp_code": emp.emp_code,
            "name": emp.name,
            "department": emp.department or "General",
            "shift": emp_shift_name,
            "monthly_quota_mins": MONTHLY_QUOTA_MINS,
            "monthly_quota_text": f"{MONTHLY_QUOTA_MINS//60}h {MONTHLY_QUOTA_MINS%60:02d}m",
            "morning_late_mins": tot_m_late_mins,
            "morning_late_days": cnt_late_days,
            "morning_late_text": f"{tot_m_late_mins}m ({cnt_late_days}d)" if tot_m_late_mins > 0 else "--",
            "evening_early_mins": tot_e_early_mins,
            "evening_early_days": cnt_early_days,
            "evening_early_text": f"{tot_e_early_mins}m ({cnt_early_days}d)" if tot_e_early_mins > 0 else "--",
            "midday_break_mins": 0,
            "midday_breaks_count": 0,
            "midday_break_text": "--",
            "total_used_mins": total_used_mins,
            "total_used_text": f"{total_used_mins//60}h {total_used_mins%60:02d}m" if total_used_mins >= 60 else f"{total_used_mins}m",
            "balance_mins": balance_mins,
            "balance_text": f"{balance_mins//60}h {balance_mins%60:02d}m" if balance_mins >= 60 else f"{balance_mins}m",
            "exceeded_mins": exceeded_mins,
            "exceeded_text": f"+{exceeded_mins//60}h {exceeded_mins%60:02d}m" if exceeded_mins >= 60 else (f"+{exceeded_mins}m" if exceeded_mins > 0 else "--"),
            "is_exceeded": is_exceeded,
            "status": "EXCEEDED" if is_exceeded else "WITHIN_LIMIT",
            "status_label": f"Exceeded by +{exceeded_mins//60}h {exceeded_mins%60:02d}m" if is_exceeded else "Within 2h Limit",
            "active_days_count": active_days_cnt,
            "dates_list": ", ".join(emp_dates) if emp_dates else "--"
        })

    # Sort summary: exceeded first desc, then total used desc, then name
    summary_list.sort(key=lambda x: (-x["exceeded_mins"], -x["total_used_mins"], x["name"].lower()))
    incidents.sort(key=lambda x: (x["date"], x["first_in"]), reverse=True)

    # Filter summary based on category
    filtered_summary = summary_list
    if category == "EXCEEDED":
        filtered_summary = [s for s in summary_list if s["is_exceeded"]]
        exceeded_codes = {s["emp_code"] for s in filtered_summary}
        filtered_incidents = [inc for inc in incidents if inc["emp_code"] in exceeded_codes]
    else:
        filtered_incidents = incidents

    total_active_staff = len(summary_list)
    total_exceeded_staff = sum(1 for s in summary_list if s["is_exceeded"])
    total_within_limit_staff = total_active_staff - total_exceeded_staff
    avg_used_mins = round(total_used_mins_sum / max(1, total_active_staff), 1)

    return {
        "year": year,
        "month": month,
        "month_name": month_name,
        "threshold_hours": threshold_hours,
        "category": category,
        "monthly_quota_mins": MONTHLY_QUOTA_MINS,
        "monthly_quota_text": f"{MONTHLY_QUOTA_MINS//60}h {MONTHLY_QUOTA_MINS%60:02d}m",
        "total_active_staff": total_active_staff,
        "total_exceeded_staff": total_exceeded_staff,
        "total_within_limit_staff": total_within_limit_staff,
        "total_exceeded_minutes": total_exceeded_mins_sum,
        "total_exceeded_hours_text": f"{total_exceeded_mins_sum//60}h {total_exceeded_mins_sum%60:02d}m",
        "avg_used_minutes": avg_used_mins,
        "avg_used_text": f"{int(avg_used_mins//60)}h {int(avg_used_mins%60):02d}m" if avg_used_mins >= 60 else f"{int(avg_used_mins)}m",
        "total_incidents": len(filtered_incidents),
        "total_employees_affected": len(filtered_summary),
        "summary": filtered_summary,
        "incidents": filtered_incidents,
        "all_summary": summary_list
    }


def generate_exceeded_excel_report(
    year: int,
    month: int,
    db: Session,
    threshold_hours: float = 2.0,
    category: str = "EXCEEDED",
    department: str = "ALL",
    shift: str = "ALL"
) -> io.BytesIO:
    """
    Generates a corporate styled Excel (.xlsx) report for Employees Exceeding 2 Hours.
    Contains 2 sheets:
    Sheet 1: Employee Permission Ledger (Emp ID, Name, Department, Quota, Morning Late, Evening Early, Midday, Total Used, Balance, Exceeded)
    Sheet 2: Detailed Daily Incidents (Date, Emp ID, Name, Dept, First IN, Last OUT, Deduction Reasons, Day Mins)
    """
    data = get_monthly_exceeded_report(
        year=year,
        month=month,
        db=db,
        threshold_hours=threshold_hours,
        category=category,
        department_filter=department,
        shift_filter=shift
    )

    wb = openpyxl.Workbook()
    # Sheet 1: Employee Summary
    ws1 = wb.active
    ws1.title = "Permission Ledger"

    settings = get_setting_dict(db)
    company_name = settings.get("company_name", "Centizen IT Services & Solutions")

    navy_fill = PatternFill(start_color="0A5482", end_color="0A5482", fill_type="solid")
    rose_fill = PatternFill(start_color="FEE2E2", end_color="FEE2E2", fill_type="solid")
    green_fill = PatternFill(start_color="DCFCE7", end_color="DCFCE7", fill_type="solid")
    header_font = Font(name="Calibri", size=10, bold=True, color="FFFFFF")
    title_font = Font(name="Calibri", size=14, bold=True, color="0A5482")
    sub_font = Font(name="Calibri", size=10, italic=True, color="555555")
    data_font = Font(name="Calibri", size=10)
    bold_font = Font(name="Calibri", size=10, bold=True)
    rose_bold_font = Font(name="Calibri", size=10, bold=True, color="991B1B")
    green_bold_font = Font(name="Calibri", size=10, bold=True, color="166534")

    thin_border = Border(
        left=Side(style="thin", color="CCCCCC"),
        right=Side(style="thin", color="CCCCCC"),
        top=Side(style="thin", color="CCCCCC"),
        bottom=Side(style="thin", color="CCCCCC")
    )

    # Title block
    ws1.merge_cells("A1:K1")
    ws1["A1"] = f"{company_name} - Monthly Permission Ledger (Exceeding {threshold_hours:g}h / 120m Quota)"
    ws1["A1"].font = title_font
    ws1["A1"].alignment = Alignment(horizontal="center", vertical="center")

    ws1.merge_cells("A2:K2")
    ws1["A2"] = (
        f"Month: {data['month_name']}  |  Quota: {data['monthly_quota_text']}  |  "
        f"Total Active Staff: {data['total_active_staff']}  |  Exceeded Quota: {data['total_exceeded_staff']}  |  "
        f"Total Exceeded Time: {data['total_exceeded_hours_text']}  |  Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}"
    )
    ws1["A2"].font = sub_font
    ws1["A2"].alignment = Alignment(horizontal="center", vertical="center")

    headers1 = [
        "Emp ID", "Employee Name", "Shift Timing",
        "Monthly Quota", "Morning Late (> 09:05)", "Evening Early (Shift End)",
        "Total Permission Used", "Balance Left", "Exceeded Duration (> 2h)", "Status"
    ]
    for col_idx, h in enumerate(headers1, 1):
        cell = ws1.cell(row=4, column=col_idx, value=h)
        cell.font = header_font
        cell.fill = navy_fill
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        cell.border = thin_border
    ws1.row_dimensions[4].height = 28

    for r_idx, emp_s in enumerate(data["summary"], start=5):
        ws1.cell(row=r_idx, column=1, value=emp_s["emp_code"]).alignment = Alignment(horizontal="center")
        ws1.cell(row=r_idx, column=2, value=emp_s["name"]).alignment = Alignment(horizontal="left")
        ws1.cell(row=r_idx, column=3, value=emp_s["shift"]).alignment = Alignment(horizontal="center")
        ws1.cell(row=r_idx, column=4, value=emp_s["monthly_quota_text"]).alignment = Alignment(horizontal="center")
        ws1.cell(row=r_idx, column=5, value=emp_s["morning_late_text"]).alignment = Alignment(horizontal="center")
        ws1.cell(row=r_idx, column=6, value=emp_s["evening_early_text"]).alignment = Alignment(horizontal="center")
        ws1.cell(row=r_idx, column=7, value=emp_s["total_used_text"]).alignment = Alignment(horizontal="center")
        ws1.cell(row=r_idx, column=8, value=emp_s["balance_text"]).alignment = Alignment(horizontal="center")

        ex_cell = ws1.cell(row=r_idx, column=9, value=emp_s["exceeded_text"])
        ex_cell.alignment = Alignment(horizontal="center")

        stat_cell = ws1.cell(row=r_idx, column=10, value=emp_s["status"])
        stat_cell.alignment = Alignment(horizontal="center")

        if emp_s["is_exceeded"]:
            ex_cell.font = rose_bold_font
            ex_cell.fill = rose_fill
            stat_cell.font = rose_bold_font
            stat_cell.fill = rose_fill
        else:
            ex_cell.font = data_font
            stat_cell.font = green_bold_font
            stat_cell.fill = green_fill

        for c in range(1, 11):
            cell = ws1.cell(row=r_idx, column=c)
            if not cell.font or cell.font == data_font:
                cell.font = data_font
            cell.border = thin_border

    ws1.column_dimensions["A"].width = 12
    ws1.column_dimensions["B"].width = 24
    ws1.column_dimensions["C"].width = 18
    ws1.column_dimensions["D"].width = 22
    ws1.column_dimensions["E"].width = 16
    ws1.column_dimensions["F"].width = 20
    ws1.column_dimensions["G"].width = 20
    ws1.column_dimensions["H"].width = 14
    ws1.column_dimensions["I"].width = 20
    ws1.column_dimensions["J"].width = 14
    ws1.column_dimensions["K"].width = 22
    ws1.column_dimensions["L"].width = 16

    # Sheet 2: Detailed Daily Incidents Log
    ws2 = wb.create_sheet(title="Daily Incidents Log")
    ws2.merge_cells("A1:K1")
    ws2["A1"] = f"{company_name} - Daily Permission Deduction Incidents ({data['month_name']})"
    ws2["A1"].font = title_font
    ws2["A1"].alignment = Alignment(horizontal="center", vertical="center")

    headers2 = [
        "Date", "Emp ID", "Employee Name",
        "First IN (Device)", "Last OUT (Device)",
        "Morning Late Mins", "Evening Early Mins", "Total Day Mins", "Deduction Reasons"
    ]
    for col_idx, h in enumerate(headers2, 1):
        cell = ws2.cell(row=3, column=col_idx, value=h)
        cell.font = header_font
        cell.fill = navy_fill
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        cell.border = thin_border
    ws2.row_dimensions[3].height = 26

    for r_idx, inc in enumerate(data["incidents"], start=4):
        ws2.cell(row=r_idx, column=1, value=inc["date_str"]).alignment = Alignment(horizontal="center")
        ws2.cell(row=r_idx, column=2, value=inc["emp_code"]).alignment = Alignment(horizontal="center")
        ws2.cell(row=r_idx, column=3, value=inc["name"]).alignment = Alignment(horizontal="left")
        ws2.cell(row=r_idx, column=4, value=f"{inc['first_in']} ({inc['first_in_device']})").alignment = Alignment(horizontal="center")
        ws2.cell(row=r_idx, column=5, value=f"{inc['last_out']} ({inc['last_out_device']})").alignment = Alignment(horizontal="center")
        ws2.cell(row=r_idx, column=6, value=inc["morning_late_mins"]).alignment = Alignment(horizontal="center")
        ws2.cell(row=r_idx, column=7, value=inc["evening_early_mins"]).alignment = Alignment(horizontal="center")
        ws2.cell(row=r_idx, column=8, value=inc["day_deducted_text"]).alignment = Alignment(horizontal="center")
        ws2.cell(row=r_idx, column=9, value=inc["reasons_str"]).alignment = Alignment(horizontal="left")

        for c in range(1, 10):
            cell = ws2.cell(row=r_idx, column=c)
            cell.font = data_font
            cell.border = thin_border

    ws2.column_dimensions["A"].width = 18
    ws2.column_dimensions["B"].width = 12
    ws2.column_dimensions["C"].width = 24
    ws2.column_dimensions["D"].width = 18
    ws2.column_dimensions["E"].width = 24
    ws2.column_dimensions["F"].width = 24
    ws2.column_dimensions["G"].width = 16
    ws2.column_dimensions["H"].width = 16
    ws2.column_dimensions["I"].width = 14
    ws2.column_dimensions["J"].width = 16
    ws2.column_dimensions["K"].width = 34

    output = io.BytesIO()
    wb.save(output)
    output.seek(0)
    return output


def get_monthly_late_count_report(
    year: int,
    month: int,
    db: Session,
    department_filter: Optional[str] = None,
    shift_filter: Optional[str] = None,
    search_query: Optional[str] = None,
    only_late: bool = False
) -> Dict[str, Any]:
    """
    Computes Monthly Late Punch Count Report (Item 6):
    First IN after 09:05 AM is considered a late punch based on shift start (09:00 AM) + 5m grace.
    Tracks late punch count, total late minutes, on-time days, punctuality rate,
    and timestamps for each employee.
    """
    num_days = calendar.monthrange(year, month)[1]
    month_name = date(year, month, 1).strftime("%B %Y")
    start_dt = datetime(year, month, 1, 0, 0, 0)
    end_dt = datetime(year, month, num_days, 23, 59, 59)

    raw_punches = db.query(
        AttendancePunch.emp_code,
        AttendancePunch.timestamp,
        AttendancePunch.device_ip
    ).filter(
        AttendancePunch.timestamp >= start_dt,
        AttendancePunch.timestamp <= end_dt
    ).order_by(AttendancePunch.timestamp.asc()).all()

    devices = {d.ip_address: d.device_name for d in db.query(Device).all()}

    emp_day_punches = defaultdict(lambda: defaultdict(list))
    for p in raw_punches:
        emp_day_punches[p.emp_code][p.timestamp.date()].append(p)

    emp_query = db.query(Employee)
    if department_filter and department_filter != "ALL":
        emp_query = emp_query.filter(Employee.department == department_filter)
    if shift_filter and shift_filter != "ALL":
        if shift_filter == "SHIFT_WFH":
            emp_query = emp_query.filter(
                (Employee.shift_code == "SHIFT_WFH") | (func.lower(Employee.shift_name).contains("wfh"))
            )
        else:
            emp_query = emp_query.filter(
                (Employee.shift_code == shift_filter) | (Employee.shift_name == shift_filter)
            )
    if search_query and isinstance(search_query, str) and search_query.strip():
        sq = f"%{search_query.strip().lower()}%"
        emp_query = emp_query.filter(
            (func.lower(Employee.name).like(sq)) | (func.lower(Employee.emp_code).like(sq))
        )

    employees = {e.emp_code: e for e in emp_query.order_by(func.lower(Employee.name).asc()).all()}

    OFFICE_GRACE = time(9, 5, 0) # 09:05 AM cutoff

    summary_list = []
    all_late_incidents = []
    total_late_punches_all = 0
    total_late_mins_all = 0

    for emp_code, days in emp_day_punches.items():
        if emp_code not in employees:
            continue
        emp = employees[emp_code]

        name_upper = (getattr(emp, "name", "") or "").upper()
        code_upper = str(getattr(emp, "emp_code", "") or "").upper()
        s_code = (getattr(emp, "shift_code", "") or "").upper()
        s_name = (getattr(emp, "shift_name", "") or "").upper()
        s_str = f"{s_code} {s_name}".upper()

        if "VISIT" in name_upper or "VISIT" in code_upper:
            continue
        if "WFH" in s_str:
            continue

        emp_shift_name = emp.shift_name or "General Shift (09:00 AM - 07:00 PM)"
        present_days = len(days)
        late_cnt = 0
        tot_late_mins = 0
        emp_late_dates = []
        emp_incidents = []

        for dt in sorted(days.keys()):
            p_list = days[dt]
            v_punches = []
            for p in p_list:
                if not v_punches or (p.timestamp - v_punches[-1].timestamp).total_seconds() >= 45:
                    v_punches.append(p)
            if not v_punches:
                continue

            first_in = v_punches[0].timestamp
            last_out = v_punches[-1].timestamp if len(v_punches) >= 2 else None

            if first_in.time() > OFFICE_GRACE:
                late_cnt += 1
                sec = int((first_in - datetime.combine(dt, OFFICE_GRACE)).total_seconds())
                m_late = sec // 60
                tot_late_mins += m_late
                date_label = f"{dt.strftime('%d-%b')} ({first_in.strftime('%H:%M:%S')})"
                emp_late_dates.append(date_label)

                inc_obj = {
                    "emp_code": emp.emp_code,
                    "name": emp.name,
                    "department": emp.department or "General",
                    "shift": emp_shift_name,
                    "date": dt.strftime("%Y-%m-%d"),
                    "date_str": dt.strftime("%d-%b-%Y (%a)"),
                    "first_in": first_in.strftime("%H:%M:%S"),
                    "first_in_device": devices.get(v_punches[0].device_ip, v_punches[0].device_ip),
                    "last_out": last_out.strftime("%H:%M:%S") if last_out else "--",
                    "last_out_device": devices.get(v_punches[-1].device_ip, v_punches[-1].device_ip) if last_out else "--",
                    "late_mins": m_late,
                    "late_mins_text": f"+{m_late}m" if m_late > 0 else "< 1m",
                    "cutoff_time": "09:05:00",
                    "total_punches": len(v_punches)
                }
                emp_incidents.append(inc_obj)
                all_late_incidents.append(inc_obj)

        on_time_days = max(0, present_days - late_cnt)
        punctuality_rate = round((on_time_days / max(1, present_days)) * 100, 1)

        total_late_punches_all += late_cnt
        total_late_mins_all += tot_late_mins

        summary_list.append({
            "emp_code": emp.emp_code,
            "name": emp.name,
            "department": emp.department or "General",
            "shift": emp_shift_name,
            "present_days": present_days,
            "late_punch_count": late_cnt,
            "on_time_days": on_time_days,
            "punctuality_rate": punctuality_rate,
            "total_late_mins": tot_late_mins,
            "total_late_text": f"{tot_late_mins//60}h {tot_late_mins%60:02d}m" if tot_late_mins >= 60 else f"{tot_late_mins}m",
            "avg_late_mins": round(tot_late_mins / max(1, late_cnt), 1),
            "late_dates_list": ", ".join(emp_late_dates) if emp_late_dates else "--",
            "incidents": emp_incidents,
            "has_late": late_cnt > 0
        })

    # Sort summary: late_punch_count desc, then total_late_mins desc, then name asc
    summary_list.sort(key=lambda x: (-x["late_punch_count"], -x["total_late_mins"], x["name"].lower()))
    all_late_incidents.sort(key=lambda x: (x["date"], x["first_in"]), reverse=True)

    filtered_summary = [s for s in summary_list if s["has_late"]] if only_late else summary_list

    total_active = len(summary_list)
    total_late_staff = sum(1 for s in summary_list if s["has_late"])
    overall_punctuality = round((sum(s["on_time_days"] for s in summary_list) / max(1, sum(s["present_days"] for s in summary_list))) * 100, 1) if summary_list else 100.0

    return {
        "year": year,
        "month": month,
        "month_name": month_name,
        "cutoff_time": "09:05 AM",
        "total_active_staff": total_active,
        "total_late_staff": total_late_staff,
        "total_late_punches": total_late_punches_all,
        "total_late_minutes": total_late_mins_all,
        "total_late_hours_text": f"{total_late_mins_all//60}h {total_late_mins_all%60:02d}m" if total_late_mins_all >= 60 else f"{total_late_mins_all}m",
        "overall_punctuality": overall_punctuality,
        "total_incidents": len(all_late_incidents),
        "summary": filtered_summary,
        "incidents": all_late_incidents
    }


def generate_monthly_late_excel_report(
    year: int,
    month: int,
    db: Session,
    department: str = "ALL",
    shift: str = "ALL"
) -> io.BytesIO:
    """
    Generates a corporate styled Excel (.xlsx) report for Monthly Late Punch Count.
    Sheet 1: Monthly Late Punch Summary (Emp ID, Name, Dept, Shift, Present Days, Late Count, On-Time Days, Punctuality %, Total Late Time, Dates)
    Sheet 2: Detailed Daily Late Punches Log (Date, Emp ID, Name, Dept, First IN, Device, Late Mins)
    """
    data = get_monthly_late_count_report(
        year=year,
        month=month,
        db=db,
        department_filter=department,
        shift_filter=shift
    )

    wb = openpyxl.Workbook()
    ws1 = wb.active
    ws1.title = "Late Punch Summary"

    settings = get_setting_dict(db)
    company_name = settings.get("company_name", "Centizen IT Services & Solutions")

    navy_fill = PatternFill(start_color="0A5482", end_color="0A5482", fill_type="solid")
    amber_fill = PatternFill(start_color="FEF3C7", end_color="FEF3C7", fill_type="solid")
    header_font = Font(name="Calibri", size=10, bold=True, color="FFFFFF")
    title_font = Font(name="Calibri", size=14, bold=True, color="0A5482")
    sub_font = Font(name="Calibri", size=10, italic=True, color="555555")
    data_font = Font(name="Calibri", size=10)
    bold_font = Font(name="Calibri", size=10, bold=True)
    amber_bold_font = Font(name="Calibri", size=10, bold=True, color="92400E")

    thin_border = Border(
        left=Side(style="thin", color="CCCCCC"),
        right=Side(style="thin", color="CCCCCC"),
        top=Side(style="thin", color="CCCCCC"),
        bottom=Side(style="thin", color="CCCCCC")
    )

    ws1.merge_cells("A1:J1")
    ws1["A1"] = f"{company_name} - Monthly Late Punch Count Report ({data['month_name']})"
    ws1["A1"].font = title_font
    ws1["A1"].alignment = Alignment(horizontal="center", vertical="center")

    ws1.merge_cells("A2:J2")
    ws1["A2"] = (
        f"Month: {data['month_name']}  |  Cutoff: First IN > {data['cutoff_time']}  |  "
        f"Total Late Punches: {data['total_late_punches']}  |  Staff Affected: {data['total_late_staff']}  |  "
        f"Total Late Time: {data['total_late_hours_text']}  |  Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}"
    )
    ws1["A2"].font = sub_font
    ws1["A2"].alignment = Alignment(horizontal="center", vertical="center")

    headers1 = [
        "Emp ID", "Employee Name", "Department", "Shift Timing",
        "Present Days", "Late Punch Count", "On-Time Days", "Punctuality %", "Total Late Time", "Dates Occurred"
    ]
    for col_idx, h in enumerate(headers1, 1):
        cell = ws1.cell(row=4, column=col_idx, value=h)
        cell.font = header_font
        cell.fill = navy_fill
        cell.alignment = Alignment(horizontal="center", vertical="center")
        cell.border = thin_border
    ws1.row_dimensions[4].height = 26

    for r_idx, s in enumerate(data["summary"], start=5):
        ws1.cell(row=r_idx, column=1, value=s["emp_code"]).alignment = Alignment(horizontal="center")
        ws1.cell(row=r_idx, column=2, value=s["name"]).alignment = Alignment(horizontal="left")
        ws1.cell(row=r_idx, column=3, value=s["department"]).alignment = Alignment(horizontal="left")
        ws1.cell(row=r_idx, column=4, value=s["shift"]).alignment = Alignment(horizontal="center")
        ws1.cell(row=r_idx, column=5, value=s["present_days"]).alignment = Alignment(horizontal="center")

        late_c = ws1.cell(row=r_idx, column=6, value=s["late_punch_count"])
        late_c.alignment = Alignment(horizontal="center")
        if s["late_punch_count"] > 0:
            late_c.font = amber_bold_font
            late_c.fill = amber_fill
        else:
            late_c.font = data_font

        ws1.cell(row=r_idx, column=7, value=s["on_time_days"]).alignment = Alignment(horizontal="center")
        ws1.cell(row=r_idx, column=8, value=f"{s['punctuality_rate']}%").alignment = Alignment(horizontal="center")
        ws1.cell(row=r_idx, column=9, value=s["total_late_text"]).alignment = Alignment(horizontal="center")
        ws1.cell(row=r_idx, column=10, value=s["late_dates_list"]).alignment = Alignment(horizontal="left")

        for c in range(1, 11):
            cell = ws1.cell(row=r_idx, column=c)
            if not cell.font or cell.font == data_font:
                cell.font = data_font
            cell.border = thin_border

    ws1.column_dimensions["A"].width = 12
    ws1.column_dimensions["B"].width = 24
    ws1.column_dimensions["C"].width = 18
    ws1.column_dimensions["D"].width = 22
    ws1.column_dimensions["E"].width = 14
    ws1.column_dimensions["F"].width = 18
    ws1.column_dimensions["G"].width = 14
    ws1.column_dimensions["H"].width = 16
    ws1.column_dimensions["I"].width = 16
    ws1.column_dimensions["J"].width = 36

    # Sheet 2: Daily Late Punches Log
    ws2 = wb.create_sheet(title="Daily Late Punches")
    ws2.merge_cells("A1:G1")
    ws2["A1"] = f"{company_name} - All Late Punch Incidents (> 09:05 AM) ({data['month_name']})"
    ws2["A1"].font = title_font
    ws2["A1"].alignment = Alignment(horizontal="center", vertical="center")

    headers2 = ["Date", "Emp ID", "Employee Name", "Department", "First IN Time", "Device Name", "Late Mins (> 09:05)"]
    for col_idx, h in enumerate(headers2, 1):
        cell = ws2.cell(row=3, column=col_idx, value=h)
        cell.font = header_font
        cell.fill = navy_fill
        cell.alignment = Alignment(horizontal="center", vertical="center")
        cell.border = thin_border
    ws2.row_dimensions[3].height = 24

    for r_idx, inc in enumerate(data["incidents"], start=4):
        ws2.cell(row=r_idx, column=1, value=inc["date_str"]).alignment = Alignment(horizontal="center")
        ws2.cell(row=r_idx, column=2, value=inc["emp_code"]).alignment = Alignment(horizontal="center")
        ws2.cell(row=r_idx, column=3, value=inc["name"]).alignment = Alignment(horizontal="left")
        ws2.cell(row=r_idx, column=4, value=inc["department"]).alignment = Alignment(horizontal="left")
        ws2.cell(row=r_idx, column=5, value=inc["first_in"]).alignment = Alignment(horizontal="center")
        ws2.cell(row=r_idx, column=6, value=inc["first_in_device"]).alignment = Alignment(horizontal="center")
        ws2.cell(row=r_idx, column=7, value=inc["late_mins_text"]).alignment = Alignment(horizontal="center")

        for c in range(1, 8):
            cell = ws2.cell(row=r_idx, column=c)
            cell.font = data_font
            cell.border = thin_border

    ws2.column_dimensions["A"].width = 18
    ws2.column_dimensions["B"].width = 12
    ws2.column_dimensions["C"].width = 24
    ws2.column_dimensions["D"].width = 18
    ws2.column_dimensions["E"].width = 16
    ws2.column_dimensions["F"].width = 20
    ws2.column_dimensions["G"].width = 20

    output = io.BytesIO()
    wb.save(output)
    output.seek(0)
    return output
