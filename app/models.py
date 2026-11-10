from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Boolean, DateTime, Text, UniqueConstraint, func
)
from app.database import Base


class Shift(Base):
    __tablename__ = "shifts"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(128), nullable=False)
    code = Column(String(64), unique=True, nullable=False, index=True)
    start_time = Column(String(16), default="09:00")
    end_time = Column(String(16), default="18:00")
    is_night_shift = Column(Boolean, default=False)
    description = Column(String(256), nullable=True)
    is_active = Column(Boolean, default=True)

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "code": self.code,
            "start_time": self.start_time,
            "end_time": self.end_time,
            "is_night_shift": self.is_night_shift,
            "timing_display": f"{self.start_time} - {self.end_time}" + (" (Next Day)" if self.is_night_shift else ""),
            "description": self.description or "",
            "is_active": self.is_active,
        }


class Device(Base):
    __tablename__ = "devices"

    id = Column(Integer, primary_key=True, index=True)
    ip_address = Column(String(64), unique=True, nullable=False, index=True)
    port = Column(Integer, default=4370, nullable=False)
    device_name = Column(String(128), nullable=False)
    device_model = Column(String(64), default="eSSL F18 + F12")
    attendance_type = Column(String(32), default="BOTH")
    is_active = Column(Boolean, default=True)
    last_sync_time = Column(DateTime, nullable=True)
    last_status = Column(String(32), default="UNKNOWN")
    last_error = Column(Text, nullable=True)
    total_punches_synced = Column(Integer, default=0)

    def to_dict(self):
        return {
            "id": self.id,
            "ip_address": self.ip_address,
            "port": self.port,
            "device_name": self.device_name,
            "device_model": self.device_model,
            "attendance_type": self.attendance_type,
            "is_active": self.is_active,
            "last_sync_time": self.last_sync_time.strftime("%Y-%m-%d %H:%M:%S") if self.last_sync_time else None,
            "last_status": self.last_status,
            "last_error": self.last_error,
            "total_punches_synced": self.total_punches_synced,
        }


class Employee(Base):
    __tablename__ = "employees"

    id = Column(Integer, primary_key=True, index=True)
    emp_code = Column(String(64), unique=True, nullable=False, index=True)
    name = Column(String(128), nullable=False)
    department = Column(String(128), default="General")
    designation = Column(String(128), default="Staff")
    email = Column(String(128), nullable=True)
    phone = Column(String(64), nullable=True)
    shift_code = Column(String(64), default="SHIFT_9_6")
    shift_name = Column(String(128), default="Standard Shift (09:00 AM - 06:00 PM)")
    shift_start = Column(String(16), default="09:00")
    shift_end = Column(String(16), default="18:00")
    card_number = Column(String(64), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=func.now())

    def to_dict(self):
        return {
            "id": self.id,
            "emp_code": self.emp_code,
            "name": self.name,
            "department": self.department,
            "designation": self.designation,
            "email": self.email or "",
            "phone": self.phone or "",
            "shift_code": self.shift_code or "SHIFT_9_6",
            "shift_name": self.shift_name or "Standard Shift (09:00 AM - 06:00 PM)",
            "shift_start": self.shift_start or "09:00",
            "shift_end": self.shift_end or "18:00",
            "card_number": self.card_number or "",
            "is_active": self.is_active,
            "created_at": self.created_at.strftime("%Y-%m-%d") if self.created_at else "",
        }


class AttendancePunch(Base):
    __tablename__ = "attendance_punches"

    id = Column(Integer, primary_key=True, index=True)
    emp_code = Column(String(64), nullable=False, index=True)
    timestamp = Column(DateTime, nullable=False, index=True)
    device_ip = Column(String(64), nullable=False)
    punch_type = Column(Integer, default=0)
    verify_type = Column(Integer, default=1)

    __table_args__ = (
        UniqueConstraint("emp_code", "timestamp", name="uix_emp_timestamp"),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "emp_code": self.emp_code,
            "timestamp": self.timestamp.strftime("%Y-%m-%d %H:%M:%S"),
            "date": self.timestamp.strftime("%Y-%m-%d"),
            "time": self.timestamp.strftime("%H:%M:%S"),
            "device_ip": self.device_ip,
            "punch_type": self.punch_type,
            "verify_type": self.verify_type,
        }


class Setting(Base):
    __tablename__ = "settings"

    key = Column(String(64), primary_key=True)
    value = Column(Text, nullable=False)


class DeletedEmployee(Base):
    """Tracks permanently deleted employees so background biometric device sync doesn't resurrect them."""
    __tablename__ = "deleted_employees"

    id = Column(Integer, primary_key=True, index=True)
    emp_code = Column(String(64), unique=True, nullable=False, index=True)
    name = Column(String(128), nullable=True)
    deleted_at = Column(DateTime, default=func.now())

    def to_dict(self):
        return {
            "id": self.id,
            "emp_code": self.emp_code,
            "name": self.name,
            "deleted_at": self.deleted_at.strftime("%Y-%m-%d %H:%M:%S") if self.deleted_at else None,
        }


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(64), unique=True, nullable=False, index=True)
    password_hash = Column(String(256), nullable=False)
    salt = Column(String(64), nullable=False, default="")
    full_name = Column(String(128), default="Administrator")
    email = Column(String(128), nullable=True)
    role = Column(String(32), default="admin")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=func.now())
    last_login = Column(DateTime, nullable=True)

    def to_dict(self):
        return {
            "id": self.id,
            "username": self.username,
            "full_name": self.full_name,
            "email": self.email or "",
            "role": self.role,
            "is_active": self.is_active,
            "created_at": self.created_at.strftime("%Y-%m-%d %H:%M:%S") if self.created_at else "",
            "last_login": self.last_login.strftime("%Y-%m-%d %H:%M:%S") if self.last_login else None,
        }


class AttendanceOverride(Base):
    """
    Manual attendance status override for an employee on a specific date.
    Supported statuses:
      - WFH: Work From Home (Full Day)
      - WFH-FN: Work From Home - Forenoon (1st Half)
      - WFH-AN: Work From Home - Afternoon (2nd Half)
      - PRESENT: Present (In Office)
      - ABSENT: Absent
      - WO: Week Off
    """
    __tablename__ = "attendance_overrides"

    id = Column(Integer, primary_key=True, index=True)
    emp_code = Column(String(64), nullable=False, index=True)
    date = Column(String(10), nullable=False, index=True)  # YYYY-MM-DD
    status = Column(String(32), nullable=False)            # WFH, WFH-FN, WFH-AN, PRESENT, ABSENT, WO
    notes = Column(String(256), nullable=True)
    updated_by = Column(String(64), default="admin")
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint("emp_code", "date", name="uix_override_emp_date"),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "emp_code": self.emp_code,
            "date": self.date,
            "status": self.status,
            "notes": self.notes or "",
            "updated_by": self.updated_by or "admin",
            "updated_at": self.updated_at.strftime("%Y-%m-%d %H:%M:%S") if self.updated_at else "",
        }
