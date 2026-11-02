from datetime import date, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.database import get_db
from app.models import Employee, AttendancePunch, Device
from app.schemas import EmployeeCreate, EmployeeUpdate
from app.attendance_service import format_duration

router = APIRouter(prefix="/api/employees", tags=["Employees"])


@router.get("")
def list_employees(
    department: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """List all employees with optional filtering."""
    query = db.query(Employee)
    if department and department != "ALL":
        query = query.filter(Employee.department == department)
    if search:
        p = f"%{search.strip()}%"
        query = query.filter((Employee.emp_code.ilike(p)) | (Employee.name.ilike(p)))

    employees = query.order_by(Employee.emp_code.asc()).all()

    # Get distinct departments for filter dropdown
    depts = [d[0] for d in db.query(Employee.department).distinct().all() if d[0]]

    return {
        "total": len(employees),
        "departments": depts,
        "employees": [e.to_dict() for e in employees]
    }


@router.post("")
def create_employee(payload: EmployeeCreate, db: Session = Depends(get_db)):
    """Add a new employee."""
    existing = db.query(Employee).filter(Employee.emp_code == payload.emp_code).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Employee code '{payload.emp_code}' already exists")

    emp = Employee(
        emp_code=payload.emp_code.strip(),
        name=payload.name.strip(),
        department=payload.department.strip() if payload.department else "General",
        designation=payload.designation.strip() if payload.designation else "Staff",
        email=payload.email.strip() if payload.email else None,
        phone=payload.phone.strip() if payload.phone else None,
        shift_start=payload.shift_start or "09:30",
        shift_end=payload.shift_end or "18:30",
        card_number=payload.card_number,
        is_active=payload.is_active
    )
    db.add(emp)
    db.commit()
    db.refresh(emp)
    return {"message": "Employee created successfully", "employee": emp.to_dict()}


@router.get("/{emp_code}")
def get_employee_profile(emp_code: str, db: Session = Depends(get_db)):
    """
    Get detailed employee profile including attendance history for the last 30 days.
    """
    emp = db.query(Employee).filter(Employee.emp_code == emp_code).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    today = date.today()
    thirty_days_ago = today - timedelta(days=30)

    # Get all punches in last 30 days
    punches = db.query(AttendancePunch).filter(
        AttendancePunch.emp_code == emp_code,
        AttendancePunch.timestamp >= thirty_days_ago
    ).order_by(desc(AttendancePunch.timestamp)).all()

    devices = {d.ip_address: d.device_name for d in db.query(Device).all()}

    # Group punches by date
    punches_by_date = {}
    for p in punches:
        d_str = p.timestamp.strftime("%Y-%m-%d")
        if d_str not in punches_by_date:
            punches_by_date[d_str] = []
        punches_by_date[d_str].append(p)

    history = []
    days_present = 0
    total_seconds_worked = 0

    for d_str, day_punches in sorted(punches_by_date.items(), reverse=True):
        day_punches.sort(key=lambda x: x.timestamp)
        first_in = day_punches[0]
        last_out = day_punches[-1] if len(day_punches) > 1 else None

        dur_sec = (last_out.timestamp - first_in.timestamp).total_seconds() if last_out else 0
        total_seconds_worked += dur_sec
        days_present += 1

        history.append({
            "date": d_str,
            "total_punches": len(day_punches),
            "first_in": first_in.timestamp.strftime("%H:%M:%S"),
            "first_in_device": devices.get(first_in.device_ip, first_in.device_ip),
            "last_out": last_out.timestamp.strftime("%H:%M:%S") if last_out else "--",
            "last_out_device": devices.get(last_out.device_ip, last_out.device_ip) if last_out else "--",
            "duration": format_duration(dur_sec)["text"]
        })

    avg_hours = round((total_seconds_worked / 3600.0) / max(1, days_present), 1)

    return {
        "employee": emp.to_dict(),
        "stats": {
            "days_present_last_30": days_present,
            "total_punches_last_30": len(punches),
            "avg_daily_hours": avg_hours,
        },
        "history": history
    }


@router.put("/{emp_code}")
def update_employee(emp_code: str, payload: EmployeeUpdate, db: Session = Depends(get_db)):
    """Update employee details."""
    emp = db.query(Employee).filter(Employee.emp_code == emp_code).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    if payload.name is not None:
        emp.name = payload.name.strip()
    if payload.department is not None:
        emp.department = payload.department.strip()
    if payload.designation is not None:
        emp.designation = payload.designation.strip()
    if payload.email is not None:
        emp.email = payload.email.strip()
    if payload.phone is not None:
        emp.phone = payload.phone.strip()
    if payload.shift_start is not None:
        emp.shift_start = payload.shift_start.strip()
    if payload.shift_end is not None:
        emp.shift_end = payload.shift_end.strip()
    if payload.card_number is not None:
        emp.card_number = payload.card_number.strip()
    if payload.is_active is not None:
        emp.is_active = payload.is_active

    db.commit()
    db.refresh(emp)
    return {"message": "Employee updated successfully", "employee": emp.to_dict()}


@router.delete("/{emp_code}")
def delete_employee(emp_code: str, db: Session = Depends(get_db)):
    """Delete employee and associated punch logs."""
    emp = db.query(Employee).filter(Employee.emp_code == emp_code).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    # Delete employee punches
    db.query(AttendancePunch).filter(AttendancePunch.emp_code == emp_code).delete()
    db.delete(emp)
    db.commit()
    return {"message": f"Employee {emp_code} deleted successfully"}

