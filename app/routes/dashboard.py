from datetime import date, datetime, timedelta
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.database import get_db
from app.models import Employee, Device, AttendancePunch
from app.attendance_service import (
    calculate_daily_attendance_for_date,
    calculate_daily_overtime_summary
)

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])


@router.get("/summary")
def get_dashboard_summary(db: Session = Depends(get_db)):
    """
    Returns high-level KPI cards and recent activity for the dashboard.
    """
    today = date.today()
    daily_stats = calculate_daily_attendance_for_date(target_date=today, db=db)

    # Device statuses
    devices = db.query(Device).all()
    devices_online = sum(1 for d in devices if d.last_status == "ONLINE")
    total_devices = len(devices)

    # Recent punches (last 10)
    recent_punches_query = db.query(AttendancePunch).order_by(
        desc(AttendancePunch.timestamp)
    ).limit(10).all()

    # Map employee names and devices
    emp_map = {e.emp_code: e.name for e in db.query(Employee).all()}
    dev_map = {d.ip_address: d.device_name for d in devices}

    recent_feed = []
    for p in recent_punches_query:
        recent_feed.append({
            "id": p.id,
            "emp_code": p.emp_code,
            "emp_name": emp_map.get(p.emp_code, f"Emp {p.emp_code}"),
            "timestamp": p.timestamp.strftime("%Y-%m-%d %H:%M:%S"),
            "time": p.timestamp.strftime("%H:%M:%S"),
            "date": p.timestamp.strftime("%b %d"),
            "device_ip": p.device_ip,
            "device_name": dev_map.get(p.device_ip, p.device_ip),
            "punch_type": "OUT" if p.punch_type == 1 else "IN",
        })

    # Optimized trend: Cache past days, compute today using daily_stats
    global _past_trend_cache
    if '_past_trend_cache' not in globals() or _past_trend_cache.get('date') != today:
        past_trend = []
        for day_offset in range(6, 0, -1):
            day_date = today - timedelta(days=day_offset)
            if day_date.weekday() == 6:
                continue
            day_data = calculate_daily_attendance_for_date(target_date=day_date, db=db)
            present_cnt = day_data.get("present_count", day_data.get("punched_in_count", 0))
            total_cnt = day_data.get("total_employees", 0)
            absent_cnt = day_data.get("absent_count", max(0, total_cnt - present_cnt))
            past_trend.append({
                "date": day_date.strftime("%d %b"),
                "full_date": day_date.strftime("%Y-%m-%d"),
                "day": day_date.strftime("%a"),
                "present": present_cnt,
                "absent": absent_cnt,
                "late": day_data.get("late_count", 0),
                "morning_ot_hours": round(day_data.get("total_morning_ot_seconds", 0) / 3600.0, 2),
                "evening_ot_hours": round(day_data.get("total_evening_ot_seconds", 0) / 3600.0, 2),
                "total_ot_hours": round(day_data.get("total_ot_seconds", 0) / 3600.0, 2),
                "morning_ot_text": day_data.get("total_morning_ot_text", "0h 00m"),
                "evening_ot_text": day_data.get("total_evening_ot_text", "0h 00m"),
                "total_ot_text": day_data.get("total_ot_text", "0h 00m"),
                "overtime_count": day_data.get("overtime_employees_count", 0)
            })
        _past_trend_cache = {'date': today, 'data': past_trend}

    trend = list(_past_trend_cache['data'])
    # Append today using already calculated daily_stats (sub-second speed!)
    today_present = daily_stats.get("present_count", daily_stats.get("punched_in_count", 0))
    today_total = daily_stats.get("total_employees", 0)
    trend.append({
        "date": today.strftime("%d %b"),
        "full_date": today.strftime("%Y-%m-%d"),
        "day": today.strftime("%a"),
        "present": today_present,
        "absent": daily_stats.get("absent_count", max(0, today_total - today_present)),
        "late": daily_stats.get("late_count", 0),
        "morning_ot_hours": round(daily_stats.get("total_morning_ot_seconds", 0) / 3600.0, 2),
        "evening_ot_hours": round(daily_stats.get("total_evening_ot_seconds", 0) / 3600.0, 2),
        "total_ot_hours": round(daily_stats.get("total_ot_seconds", 0) / 3600.0, 2),
        "morning_ot_text": daily_stats.get("total_morning_ot_text", "0h 00m"),
        "evening_ot_text": daily_stats.get("total_evening_ot_text", "0h 00m"),
        "total_ot_text": daily_stats.get("total_ot_text", "0h 00m"),
        "overtime_count": daily_stats.get("overtime_employees_count", 0)
    })

    # Today's Overtime Summary (Standard Office Hours: 09:00 AM - 07:00 PM)
    today_overtime = calculate_daily_overtime_summary(target_date=today, db=db)

    total_emp = daily_stats.get("total_employees", 0)
    present = daily_stats.get("present_count", daily_stats.get("punched_in_count", 0))
    absent = daily_stats.get("absent_count", max(0, total_emp - present))
    attendance_rate = round((present / total_emp * 100), 1) if total_emp > 0 else 0

    return {
        "today_date": today.strftime("%A, %d %B %Y"),
        "total_employees": total_emp,
        "present_count": present,
        "absent_count": absent,
        "late_count": daily_stats.get("late_count", 0),
        "punched_in_count": daily_stats.get("punched_in_count", present),
        "punched_out_count": daily_stats.get("punched_out_count", 0),
        "attendance_rate_pct": attendance_rate,
        "devices_online": devices_online,
        "total_devices": total_devices,
        "recent_feed": recent_feed,
        "weekly_trend": trend,
        "today_overtime": today_overtime,
        "today_attendance": daily_stats.get("records", [])
    }

