from typing import Optional, List
from pydantic import BaseModel


class ShiftCreate(BaseModel):
    name: str
    code: str
    start_time: str = "09:00"
    end_time: str = "18:00"
    is_night_shift: bool = False
    description: Optional[str] = None
    is_active: bool = True


class ShiftUpdate(BaseModel):
    name: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    is_night_shift: Optional[bool] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None


class DeviceCreate(BaseModel):
    ip_address: str
    port: int = 4370
    device_name: str
    device_model: str = "eSSL F18 + F12"
    attendance_type: str = "BOTH"
    is_active: bool = True


class DeviceUpdate(BaseModel):
    ip_address: Optional[str] = None
    port: Optional[int] = None
    device_name: Optional[str] = None
    device_model: Optional[str] = None
    attendance_type: Optional[str] = None
    is_active: Optional[bool] = None


class EmployeeCreate(BaseModel):
    emp_code: str
    name: str
    department: Optional[str] = "General"
    designation: Optional[str] = "Staff"
    email: Optional[str] = None
    phone: Optional[str] = None
    shift_code: Optional[str] = "SHIFT_9_6"
    shift_name: Optional[str] = "Standard Shift (09:00 AM - 06:00 PM)"
    shift_start: Optional[str] = "09:00"
    shift_end: Optional[str] = "18:00"
    card_number: Optional[str] = None
    is_active: bool = True


class EmployeeUpdate(BaseModel):
    name: Optional[str] = None
    department: Optional[str] = None
    designation: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    shift_code: Optional[str] = None
    shift_name: Optional[str] = None
    shift_start: Optional[str] = None
    shift_end: Optional[str] = None
    card_number: Optional[str] = None
    is_active: Optional[bool] = None


class ManualPunchCreate(BaseModel):
    emp_code: str
    timestamp: str
    device_ip: str = "Manual Entry"
    punch_type: int = 0


class SettingsUpdate(BaseModel):
    company_name: Optional[str] = None
    primary_color: Optional[str] = None
    accent_color: Optional[str] = None
    shift_start_time: Optional[str] = None
    shift_end_time: Optional[str] = None
    late_grace_minutes: Optional[str] = None
    half_day_hours: Optional[str] = None
    full_day_hours: Optional[str] = None
    auto_sync_interval_mins: Optional[str] = None
    auto_sync_enabled: Optional[str] = None


class AttendanceOverrideCreate(BaseModel):
    emp_code: str
    date: str  # YYYY-MM-DD
    status: str  # WFH, WFH-FN, WFH-AN, PRESENT, ABSENT, WO, AUTO
    notes: Optional[str] = None


class AttendanceBatchOverrideCreate(BaseModel):
    emp_codes: List[str]
    start_date: str  # YYYY-MM-DD
    end_date: str    # YYYY-MM-DD
    status: str      # WFH, WFH-FN, WFH-AN, PRESENT, ABSENT, WO, AUTO
    notes: Optional[str] = None
