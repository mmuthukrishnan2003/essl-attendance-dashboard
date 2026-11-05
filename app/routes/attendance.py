import csv
import io
import json
import asyncio
from datetime import date, datetime, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, Query, HTTPException, Response, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from app.live_sync import live_manager

from app.database import get_db
from app.models import AttendancePunch, Employee
from app.schemas import ManualPunchCreate
from app.attendance_service import (
    calculate_daily_attendance_for_date,
    get_employee_punches_history,
    generate_excel_report,
    calculate_daily_overtime_summary,
    calculate_weekly_overtime_trend
)

router = APIRouter(prefix="/api/attendance", tags=["Attendance"])


@router.get("/overtime/summary")
def get_overtime_summary(
    target_date: Optional[str] = Query(None, description="Date in YYYY-MM-DD format"),
    db: Session = Depends(get_db)
):
    """
    Returns Overtime calculation and employee breakdown for a specific date:
    - Office standard hours: 09:00 AM to 07:00 PM (19:00)
    - Morning OT: Any time worked before 09:00 AM
    - Evening OT: Any time worked after 07:00 PM
    - Total OT: Morning OT + Evening OT
    """
    if target_date:
        try:
            d = datetime.strptime(target_date, "%Y-%m-%d").date()
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
    else:
        d = date.today()

    return calculate_daily_overtime_summary(target_date=d, db=db)


@router.get("/overtime/weekly")
def get_overtime_weekly_trend(
    end_date: Optional[str] = Query(None, description="End date in YYYY-MM-DD format"),
    db: Session = Depends(get_db)
):
    """
    Returns weekly overtime hours trend (last 7 days) for the dashboard chart.
    """
    if end_date:
        try:
            d = datetime.strptime(end_date, "%Y-%m-%d").date()
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
    else:
        d = date.today()

    return calculate_weekly_overtime_trend(end_date=d, db=db)



@router.get("/daily")
def get_daily_attendance(
    target_date: Optional[str] = Query(None, description="Date in YYYY-MM-DD format"),
    start_date: Optional[str] = Query(None, description="Start date in YYYY-MM-DD format"),
    end_date: Optional[str] = Query(None, description="End date in YYYY-MM-DD format"),
    department: Optional[str] = Query(None, description="Department filter"),
    shift: Optional[str] = Query(None, description="Shift code or name filter"),
    search: Optional[str] = Query(None, description="Search employee code or name"),
    db: Session = Depends(get_db)
):
    """
    Returns calculated daily attendance for all employees on the selected date or date range (e.g. 1 to 10).
    Computes First IN, Last OUT, Intermediate Punches, and Duration by Shift.
    Status column has been removed as requested.
    """
    # If a date range is supplied (start_date and end_date)
    if start_date and end_date:
        try:
            s_date = datetime.strptime(start_date, "%Y-%m-%d").date()
            e_date = datetime.strptime(end_date, "%Y-%m-%d").date()
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")

        if s_date > e_date:
            raise HTTPException(status_code=400, detail="start_date must be before or equal to end_date")

        all_records = []
        cur = s_date
        total_emp = 0
        total_punched_in = 0
        total_punched_out = 0
        total_wfh = 0

        while cur <= e_date:
            day_res = calculate_daily_attendance_for_date(
                target_date=cur,
                db=db,
                department_filter=department,
                shift_filter=shift,
                search_query=search
            )
            all_records.extend(day_res.get("records", []))
            total_emp = max(total_emp, day_res.get("total_employees", 0))
            total_punched_in += day_res.get("punched_in_count", 0)
            total_punched_out += day_res.get("punched_out_count", 0)
            total_wfh += day_res.get("wfh_count", 0)
            cur += timedelta(days=1)

        days_count = (e_date - s_date).days + 1
        wfh_remote_total = sum(1 for r in all_records if r.get("is_wfh") and r.get("total_punches", 0) == 0)
        present_count = total_punched_in + wfh_remote_total
        absent_count = max(0, (total_emp * days_count) - present_count)

        return {
            "date": f"{s_date.strftime('%d-%b-%Y')} to {e_date.strftime('%d-%b-%Y')}",
            "start_date": s_date.strftime("%Y-%m-%d"),
            "end_date": e_date.strftime("%Y-%m-%d"),
            "is_range": True,
            "days_count": days_count,
            "total_employees": total_emp,
            "punched_in_count": total_punched_in,
            "punched_out_count": total_punched_out,
            "wfh_count": total_wfh,
            "present_count": present_count,
            "absent_count": absent_count,
            "records": all_records
        }

    # Otherwise fallback to single target_date
    if target_date:
        try:
            d = datetime.strptime(target_date, "%Y-%m-%d").date()
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
    else:
        d = date.today()

    return calculate_daily_attendance_for_date(
        target_date=d,
        db=db,
        department_filter=department,
        shift_filter=shift,
        search_query=search
    )


@router.get("/employee/{emp_code}/punches")
def get_employee_punches(
    emp_code: str,
    target_date: Optional[str] = Query(None, description="Date in YYYY-MM-DD format"),
    db: Session = Depends(get_db)
):
    """
    Returns the complete list of IN/OUT punches for an employee on a given date,
    clearly separating First IN, Intermediate punches, and Last OUT.
    """
    if target_date:
        try:
            d = datetime.strptime(target_date, "%Y-%m-%d").date()
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
    else:
        d = date.today()

    result = get_employee_punches_history(emp_code=emp_code, target_date=d, db=db)
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    return result


@router.get("/export/excel")
def export_attendance_excel(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    department: Optional[str] = Query("ALL"),
    shift: Optional[str] = Query("ALL"),
    db: Session = Depends(get_db)
):
    """
    Exports attendance report as a styled Excel (.xlsx) spreadsheet with Centizen branding.
    """
    try:
        s_date = datetime.strptime(start_date, "%Y-%m-%d").date() if start_date else date.today()
        e_date = datetime.strptime(end_date, "%Y-%m-%d").date() if end_date else s_date
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")

    if s_date > e_date:
        raise HTTPException(status_code=400, detail="start_date must be before or equal to end_date")

    excel_stream = generate_excel_report(
        start_date=s_date,
        end_date=e_date,
        db=db,
        department=department or "ALL",
        shift=shift or "ALL"
    )
    filename = f"Centizen_Attendance_{s_date.strftime('%Y%m%d')}_to_{e_date.strftime('%Y%m%d')}.xlsx"

    return StreamingResponse(
        excel_stream,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/export/csv")
def export_attendance_csv(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    department: Optional[str] = Query("ALL"),
    shift: Optional[str] = Query("ALL"),
    db: Session = Depends(get_db)
):
    """
    Exports attendance report as CSV (Status column removed).
    """
    try:
        s_date = datetime.strptime(start_date, "%Y-%m-%d").date() if start_date else date.today()
        e_date = datetime.strptime(end_date, "%Y-%m-%d").date() if end_date else s_date
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")

    output = io.StringIO()
    writer = csv.writer(output)

    writer.writerow([
        "Date", "Employee ID", "Employee Name", "Shift Timing",
        "First IN", "Last OUT", "Intermediate Punches"
    ])

    cur = s_date
    while cur <= e_date:
        daily_res = calculate_daily_attendance_for_date(
            target_date=cur,
            db=db,
            department_filter=department if department != "ALL" else None,
            shift_filter=shift if shift != "ALL" else None
        )
        date_str = cur.strftime("%d-%m-%Y")
        for r in daily_res["records"]:
            if r.get("is_wfh") and not r.get("first_in"):
                first_in_val = "🏠 WFH (Remote)"
                last_out_val = "🏠 WFH (Remote)"
            else:
                first_in_val = f"{r['first_in_time']} ({r['first_in_device']})" if r.get("first_in") else "--"
                last_out_val = f"{r['last_out_time']} ({r['last_out_device']})" if r.get("last_out") else "--"
            writer.writerow([
                date_str,
                r["emp_code"],
                r["name"],
                r["shift"],
                first_in_val,
                last_out_val,
                r["intermediate_count"]
            ])
        cur += timedelta(days=1)

    csv_data = output.getvalue()
    if s_date == e_date:
        filename = f"Centizen_Attendance_{s_date.strftime('%Y%m%d')}.csv"
    else:
        filename = f"Centizen_Attendance_{s_date.strftime('%Y%m%d')}_to_{e_date.strftime('%Y%m%d')}.csv"

    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )




@router.post("/manual-punch")
def add_manual_punch(payload: ManualPunchCreate, db: Session = Depends(get_db)):
    """Add a manual punch (admin adjustment for missed punches)."""
    emp = db.query(Employee).filter(Employee.emp_code == payload.emp_code).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    try:
        p_time = datetime.strptime(payload.timestamp, "%Y-%m-%d %H:%M:%S")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid timestamp format. Use YYYY-MM-DD HH:MM:SS")

    punch = AttendancePunch(
        emp_code=payload.emp_code,
        timestamp=p_time,
        device_ip=payload.device_ip or "Manual Entry",
        punch_type=payload.punch_type,
        verify_type=1
    )
    db.add(punch)
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(status_code=400, detail="A punch already exists for this employee at this exact timestamp")

    return {"message": "Manual punch added successfully", "punch": punch.to_dict()}


@router.get("/monthly")
def get_monthly_attendance(
    year: Optional[int] = Query(None, description="Year (e.g. 2026)"),
    month: Optional[int] = Query(None, description="Month (1-12)"),
    department: Optional[str] = Query("ALL"),
    shift: Optional[str] = Query("ALL"),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """
    Returns monthly attendance matrix (Muster Roll) for all employees across days 1 to 31.
    """
    from app.monthly_service import get_monthly_attendance_matrix
    now = datetime.now()
    y = year or now.year
    m = month or now.month

    if m < 1 or m > 12:
        raise HTTPException(status_code=400, detail="Invalid month. Must be between 1 and 12")

    return get_monthly_attendance_matrix(
        year=y,
        month=m,
        db=db,
        department_filter=department,
        shift_filter=shift,
        search_query=search
    )


@router.get("/export/monthly-excel")
def export_monthly_excel(
    year: Optional[int] = Query(None),
    month: Optional[int] = Query(None),
    department: Optional[str] = Query("ALL"),
    shift: Optional[str] = Query("ALL"),
    db: Session = Depends(get_db)
):
    """
    Exports full monthly attendance muster roll (Days 1 to 31) as a styled corporate Excel spreadsheet.
    """
    from app.monthly_service import generate_monthly_excel_report
    now = datetime.now()
    y = year or now.year
    m = month or now.month

    excel_stream = generate_monthly_excel_report(
        year=y,
        month=m,
        db=db,
        department=department or "ALL",
        shift=shift or "ALL"
    )
    month_name = date(y, m, 1).strftime("%B_%Y")
    filename = f"Centizen_Monthly_Attendance_{month_name}.xlsx"

    return StreamingResponse(
        excel_stream,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/export/monthly-csv")
def export_monthly_csv(
    year: Optional[int] = Query(None),
    month: Optional[int] = Query(None),
    department: Optional[str] = Query("ALL"),
    shift: Optional[str] = Query("ALL"),
    db: Session = Depends(get_db)
):
    """
    Exports monthly attendance summary and day-by-day status matrix as CSV.
    """
    from app.monthly_service import get_monthly_attendance_matrix
    now = datetime.now()
    y = year or now.year
    m = month or now.month

    matrix = get_monthly_attendance_matrix(
        year=y,
        month=m,
        db=db,
        department_filter=department,
        shift_filter=shift
    )

    output = io.StringIO()
    writer = csv.writer(output)

    # Header: Emp Code, Name, Dept, Shift, Days 1..N, Present, Absent, WFH, WO, Rate %
    days_headers = [f"Day_{d['day']:02d}_{d['weekday']}" for d in matrix["days_meta"]]
    header_row = ["Emp Code", "Employee Name", "Shift"] + days_headers + [
        "Present Count", "Late Count", "Absent Count", "WFH Count", "Week Off Count", "Attendance Rate %"
    ]
    writer.writerow(header_row)

    for rec in matrix["records"]:
        day_vals = []
        for d in matrix["days_meta"]:
            d_info = rec["days"].get(str(d["day"]), {})
            st = d_info.get("status", "--")
            if st == "P":
                f_in = d_info.get("first_in")
                l_out = d_info.get("last_out")
                if f_in and l_out:
                    day_vals.append(f"{f_in[:5]} - {l_out[:5]}")
                elif f_in:
                    day_vals.append(f"{f_in[:5]} (IN)")
                else:
                    day_vals.append("P")
            else:
                day_vals.append(st)
        row = [
            rec["emp_code"],
            rec["name"],
            rec["shift"]
        ] + day_vals + [
            rec["present_count"],
            rec.get("late_count", 0),
            rec["absent_count"],
            rec["wfh_count"],
            rec["wo_count"],
            f"{rec['attendance_rate']}%"
        ]
        writer.writerow(row)

    csv_data = output.getvalue()
    month_name = date(y, m, 1).strftime("%B_%Y")
    filename = f"Centizen_Monthly_Attendance_{month_name}.csv"

    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/monthly-exceeded")
def get_monthly_exceeded(
    year: Optional[int] = Query(None),
    month: Optional[int] = Query(None),
    threshold: Optional[float] = Query(2.0, description="Monthly quota hours (default: 2.0)"),
    category: Optional[str] = Query("EXCEEDED", description="EXCEEDED or ALL"),
    department: Optional[str] = Query("ALL"),
    shift: Optional[str] = Query("ALL"),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """
    Returns monthly permission ledger (120 mins quota) & employees exceeding 2 hours.
    """
    from app.monthly_service import get_monthly_exceeded_report
    now = datetime.now()
    y = year or now.year
    m = month or now.month

    return get_monthly_exceeded_report(
        year=y,
        month=m,
        db=db,
        threshold_hours=threshold or 2.0,
        category=category or "EXCEEDED",
        department_filter=department,
        shift_filter=shift,
        search_query=search
    )


@router.get("/export/monthly-exceeded-excel")
def export_monthly_exceeded_excel(
    year: Optional[int] = Query(None),
    month: Optional[int] = Query(None),
    threshold: Optional[float] = Query(2.0),
    category: Optional[str] = Query("EXCEEDED"),
    department: Optional[str] = Query("ALL"),
    shift: Optional[str] = Query("ALL"),
    db: Session = Depends(get_db)
):
    """
    Exports monthly 2-hour permission report as styled Excel spreadsheet.
    """
    from app.monthly_service import generate_exceeded_excel_report
    now = datetime.now()
    y = year or now.year
    m = month or now.month

    excel_stream = generate_exceeded_excel_report(
        year=y,
        month=m,
        db=db,
        threshold_hours=threshold or 2.0,
        category=category or "EXCEEDED",
        department=department or "ALL",
        shift=shift or "ALL"
    )
    month_name = date(y, m, 1).strftime("%B_%Y")
    filename = f"Centizen_Monthly_Permission_Exceeded_{month_name}.xlsx"

    return StreamingResponse(
        excel_stream,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/export/monthly-exceeded-csv")
def export_monthly_exceeded_csv(
    year: Optional[int] = Query(None),
    month: Optional[int] = Query(None),
    threshold: Optional[float] = Query(2.0),
    category: Optional[str] = Query("EXCEEDED"),
    department: Optional[str] = Query("ALL"),
    shift: Optional[str] = Query("ALL"),
    db: Session = Depends(get_db)
):
    """
    Exports monthly 2-hour permission report as CSV.
    """
    from app.monthly_service import get_monthly_exceeded_report
    now = datetime.now()
    y = year or now.year
    m = month or now.month

    data = get_monthly_exceeded_report(
        year=y,
        month=m,
        db=db,
        threshold_hours=threshold or 2.0,
        category=category or "EXCEEDED",
        department_filter=department,
        shift_filter=shift
    )

    output = io.StringIO()
    writer = csv.writer(output)

    writer.writerow([
        "Emp ID", "Employee Name", "Shift Timing",
        "Monthly Quota", "Morning Late", "Evening Early",
        "Total Permission Used", "Balance Left", "Exceeded Duration (> 2h)", "Status"
    ])

    for emp_s in data["summary"]:
        writer.writerow([
            emp_s["emp_code"],
            emp_s["name"],
            emp_s["shift"],
            emp_s["monthly_quota_text"],
            emp_s["morning_late_text"],
            emp_s["evening_early_text"],
            emp_s["total_used_text"],
            emp_s["balance_text"],
            emp_s["exceeded_text"],
            emp_s["status"]
        ])

    csv_data = output.getvalue()
    month_name = date(y, m, 1).strftime("%B_%Y")
    filename = f"Centizen_Monthly_Permission_Exceeded_{month_name}.csv"

    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/monthly-late-punches")
def get_monthly_late_punches(
    year: Optional[int] = Query(None),
    month: Optional[int] = Query(None),
    only_late: Optional[bool] = Query(True, description="Show only staff with >= 1 late punch"),
    department: Optional[str] = Query("ALL"),
    shift: Optional[str] = Query("ALL"),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """
    Returns monthly late punch summary & day-by-day late arrival incidents (First IN > 09:05 AM).
    """
    from app.monthly_service import get_monthly_late_count_report
    now = datetime.now()
    y = year or now.year
    m = month or now.month

    return get_monthly_late_count_report(
        year=y,
        month=m,
        db=db,
        only_late=only_late if only_late is not None else True,
        department_filter=department,
        shift_filter=shift,
        search_query=search
    )


@router.get("/export/monthly-late-excel")
def export_monthly_late_excel(
    year: Optional[int] = Query(None),
    month: Optional[int] = Query(None),
    department: Optional[str] = Query("ALL"),
    shift: Optional[str] = Query("ALL"),
    db: Session = Depends(get_db)
):
    """
    Exports monthly late punch report as styled Excel spreadsheet.
    """
    from app.monthly_service import generate_monthly_late_excel_report
    now = datetime.now()
    y = year or now.year
    m = month or now.month

    excel_stream = generate_monthly_late_excel_report(
        year=y,
        month=m,
        db=db,
        department=department or "ALL",
        shift=shift or "ALL"
    )
    month_name = date(y, m, 1).strftime("%B_%Y")
    filename = f"Centizen_Monthly_Late_Punch_Count_{month_name}.xlsx"

    return StreamingResponse(
        excel_stream,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/export/monthly-late-csv")
def export_monthly_late_csv(
    year: Optional[int] = Query(None),
    month: Optional[int] = Query(None),
    only_late: Optional[bool] = Query(False),
    department: Optional[str] = Query("ALL"),
    shift: Optional[str] = Query("ALL"),
    db: Session = Depends(get_db)
):
    """
    Exports monthly late punch report as CSV.
    """
    from app.monthly_service import get_monthly_late_count_report
    now = datetime.now()
    y = year or now.year
    m = month or now.month

    data = get_monthly_late_count_report(
        year=y,
        month=m,
        db=db,
        only_late=only_late or False,
        department_filter=department,
        shift_filter=shift
    )

    output = io.StringIO()
    writer = csv.writer(output)

    writer.writerow([
        "Emp ID", "Employee Name", "Shift Timing",
        "Present Days", "Late Punch Count", "On-Time Days", "Punctuality Rate %",
        "Total Late Time", "Late Dates & Times"
    ])

    for emp_s in data["summary"]:
        writer.writerow([
            emp_s["emp_code"],
            emp_s["name"],
            emp_s["shift"],
            emp_s["present_days"],
            emp_s["late_punch_count"],
            emp_s["on_time_days"],
            f"{emp_s['punctuality_rate']}%",
            emp_s["total_late_text"],
            emp_s["late_dates_list"]
        ])

    csv_data = output.getvalue()
    month_name = date(y, m, 1).strftime("%B_%Y")
    filename = f"Centizen_Monthly_Late_Punch_Count_{month_name}.csv"

    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/live-stream")
async def live_attendance_stream(request: Request):
    """
    Real-time Server-Sent Events (SSE) stream.
    Pushes live biometric punches within milliseconds directly to the portal dashboard.
    """
    async def event_generator():
        q = asyncio.Queue()
        live_manager.subscribers.add(q)
        try:
            # Send initial connected status
            init_msg = json.dumps({"type": "connected", "version": live_manager.version})
            yield f"data: {init_msg}\n\n"
            while True:
                if await request.is_disconnected():
                    break
                try:
                    # Wait for next punch event with 12-second heartbeat
                    data = await asyncio.wait_for(q.get(), timeout=12.0)
                    yield f"data: {json.dumps(data)}\n\n"
                except asyncio.TimeoutError:
                    # Send keep-alive comment so proxy/browser connection stays open
                    yield ": heartbeat\n\n"
        finally:
            live_manager.subscribers.discard(q)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )


@router.get("/live-status")
def get_live_attendance_status():
    """
    Fast sub-second poll endpoint providing current punch version and latest punch info.
    """
    return {
        "version": live_manager.version,
        "last_punch": live_manager.last_punch_info,
        "server_time": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    }
