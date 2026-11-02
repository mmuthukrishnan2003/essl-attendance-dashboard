import csv
import io
from datetime import date, datetime, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, Query, HTTPException, Response
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import AttendancePunch, Employee
from app.schemas import ManualPunchCreate
from app.attendance_service import (
    calculate_daily_attendance_for_date,
    get_employee_punches_history,
    generate_excel_report
)

router = APIRouter(prefix="/api/attendance", tags=["Attendance"])


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
            cur += timedelta(days=1)

        days_count = (e_date - s_date).days + 1
        absent_count = max(0, (total_emp * days_count) - total_punched_in)

        return {
            "date": f"{s_date.strftime('%d-%b-%Y')} to {e_date.strftime('%d-%b-%Y')}",
            "start_date": s_date.strftime("%Y-%m-%d"),
            "end_date": e_date.strftime("%Y-%m-%d"),
            "is_range": True,
            "days_count": days_count,
            "total_employees": total_emp,
            "punched_in_count": total_punched_in,
            "punched_out_count": total_punched_out,
            "present_count": total_punched_in,
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
        "Date", "Employee ID", "Employee Name", "Department", "Shift",
        "First IN", "Last OUT", "Intermediate Punches Count"
    ])

    cur = s_date
    while cur <= e_date:
        daily_res = calculate_daily_attendance_for_date(
            target_date=cur,
            db=db,
            department_filter=department if department != "ALL" else None,
            shift_filter=shift if shift != "ALL" else None
        )
        for r in daily_res["records"]:
            writer.writerow([
                r["date"],
                r["emp_code"],
                r["name"],
                r["department"],
                r["shift"],
                f"{r['first_in_time']} ({r['first_in_device']})" if r["first_in"] else "--",
                f"{r['last_out_time']} ({r['last_out_device']})" if r["last_out"] else "--",
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
