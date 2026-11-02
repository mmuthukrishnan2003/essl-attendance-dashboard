from typing import Optional, List
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Shift, Employee
from app.schemas import ShiftCreate, ShiftUpdate

router = APIRouter(prefix="/api/shifts", tags=["Shift Management"])


class ShiftAssignPayload(BaseModel):
    shift_code: str
    emp_codes: List[str]


@router.get("")
def list_shifts(db: Session = Depends(get_db)):
    """List all shifts with assigned employee count."""
    shifts = db.query(Shift).order_by(Shift.id.asc()).all()
    res = []
    for s in shifts:
        cnt = db.query(Employee).filter(Employee.shift_code == s.code).count()
        item = s.to_dict()
        item["assigned_employee_count"] = cnt
        res.append(item)
    return {
        "total": len(res),
        "shifts": res
    }


@router.post("")
def create_shift(payload: ShiftCreate, db: Session = Depends(get_db)):
    """Create a new shift."""
    existing = db.query(Shift).filter(Shift.code == payload.code.strip()).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Shift code '{payload.code}' already exists")

    shift = Shift(
        name=payload.name.strip(),
        code=payload.code.strip(),
        start_time=payload.start_time.strip(),
        end_time=payload.end_time.strip(),
        is_night_shift=payload.is_night_shift,
        description=payload.description.strip() if payload.description else None,
        is_active=payload.is_active
    )
    db.add(shift)
    db.commit()
    db.refresh(shift)
    return {"message": "Shift created successfully", "shift": shift.to_dict()}


@router.put("/{shift_id}")
def update_shift(shift_id: int, payload: ShiftUpdate, db: Session = Depends(get_db)):
    """Update shift timings and configuration."""
    shift = db.query(Shift).filter(Shift.id == shift_id).first()
    if not shift:
        raise HTTPException(status_code=404, detail="Shift not found")

    if payload.name is not None:
        shift.name = payload.name.strip()
    if payload.start_time is not None:
        shift.start_time = payload.start_time.strip()
    if payload.end_time is not None:
        shift.end_time = payload.end_time.strip()
    if payload.is_night_shift is not None:
        shift.is_night_shift = payload.is_night_shift
    if payload.description is not None:
        shift.description = payload.description.strip()
    if payload.is_active is not None:
        shift.is_active = payload.is_active

    db.commit()

    # Also update employees who have this shift code to reflect updated name and times
    emps = db.query(Employee).filter(Employee.shift_code == shift.code).all()
    for e in emps:
        e.shift_name = shift.name
        e.shift_start = shift.start_time
        e.shift_end = shift.end_time
    db.commit()

    return {"message": "Shift updated successfully", "shift": shift.to_dict()}


@router.delete("/{shift_id}")
def delete_shift(shift_id: int, db: Session = Depends(get_db)):
    """Delete a shift (if no employees are assigned)."""
    shift = db.query(Shift).filter(Shift.id == shift_id).first()
    if not shift:
        raise HTTPException(status_code=404, detail="Shift not found")

    count = db.query(Employee).filter(Employee.shift_code == shift.code).count()
    if count > 0:
        raise HTTPException(status_code=400, detail=f"Cannot delete shift '{shift.name}': {count} employees are assigned to it.")

    db.delete(shift)
    db.commit()
    return {"message": f"Shift '{shift.name}' deleted successfully"}


@router.post("/assign")
def assign_shift_to_employees(payload: ShiftAssignPayload, db: Session = Depends(get_db)):
    """Assign a shift to multiple employees."""
    shift = db.query(Shift).filter(Shift.code == payload.shift_code).first()
    if not shift:
        raise HTTPException(status_code=404, detail="Shift not found")

    updated_count = 0
    for code in payload.emp_codes:
        emp = db.query(Employee).filter(Employee.emp_code == code).first()
        if emp:
            emp.shift_code = shift.code
            emp.shift_name = shift.name
            emp.shift_start = shift.start_time
            emp.shift_end = shift.end_time
            updated_count += 1

    db.commit()
    return {"message": f"Shift '{shift.name}' assigned to {updated_count} employees."}

