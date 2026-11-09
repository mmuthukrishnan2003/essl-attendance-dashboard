import random
from datetime import datetime, date, timedelta, time
from sqlalchemy.orm import Session

from app.database import engine, Base, SessionLocal
from app.models import Device, Employee, AttendancePunch, Setting, Shift, User, AttendanceOverride
from app.config import DEFAULT_DEVICES, DEFAULT_SETTINGS

DEFAULT_SHIFTS = [
    {
        "name": "General Shift (09:00 AM - 07:00 PM)",
        "code": "SHIFT_9_7",
        "start_time": "09:00",
        "end_time": "19:00",
        "is_night_shift": False,
        "description": "Standard 10-hour daytime general shift",
    },
    {
        "name": "Standard Shift (09:00 AM - 06:00 PM)",
        "code": "SHIFT_9_6",
        "start_time": "09:00",
        "end_time": "18:00",
        "is_night_shift": False,
        "description": "Standard 9-hour daytime office shift",
    },
    {
        "name": "Night Shift (09:00 PM - Next Day 06:00 AM)",
        "code": "SHIFT_NIGHT",
        "start_time": "21:00",
        "end_time": "06:00",
        "is_night_shift": True,
        "description": "Overnight rotational cross-midnight shift",
    },
    {
        "name": "Work From Home (WFH)",
        "code": "SHIFT_WFH",
        "start_time": "09:30",
        "end_time": "18:30",
        "is_night_shift": False,
        "description": "Remote Work From Home arrangement with flexible office logging",
    },
    {
        "name": "Work From Home - Forenoon (WFH-FN)",
        "code": "SHIFT_WFH_FN",
        "start_time": "09:30",
        "end_time": "18:30",
        "is_night_shift": False,
        "description": "WFH in Forenoon (Morning 1st Half) with Office in Afternoon (2nd Half)",
    },
    {
        "name": "Work From Home - Afternoon (WFH-AN)",
        "code": "SHIFT_WFH_AN",
        "start_time": "09:30",
        "end_time": "18:30",
        "is_night_shift": False,
        "description": "Office in Forenoon (Morning 1st Half) with WFH in Afternoon (2nd Half)",
    },
]


def init_db():
    """Initializes tables and seeds default devices, shifts, and settings."""
    Base.metadata.create_all(bind=engine)
    
    # Auto-migrate columns for existing tables
    try:
        with engine.begin() as conn:
            # Check employees table columns
            if "sqlite" in str(engine.url):
                res = conn.exec_driver_sql("PRAGMA table_info(employees)").fetchall()
                existing_cols = [r[1] for r in res]
                if existing_cols:
                    if "shift_code" not in existing_cols:
                        conn.exec_driver_sql("ALTER TABLE employees ADD COLUMN shift_code VARCHAR(64) DEFAULT 'SHIFT_9_6'")
                    if "shift_name" not in existing_cols:
                        conn.exec_driver_sql("ALTER TABLE employees ADD COLUMN shift_name VARCHAR(128) DEFAULT 'Standard Shift (09:00 AM - 06:00 PM)'")
                    if "shift_start" not in existing_cols:
                        conn.exec_driver_sql("ALTER TABLE employees ADD COLUMN shift_start VARCHAR(16) DEFAULT '09:00'")
                    if "shift_end" not in existing_cols:
                        conn.exec_driver_sql("ALTER TABLE employees ADD COLUMN shift_end VARCHAR(16) DEFAULT '18:00'")
    except Exception as e:
        print(f"Migration notice: {e}")

    db = SessionLocal()
    try:
        # 1. Initialize Default Shifts
        for s_data in DEFAULT_SHIFTS:
            s = db.query(Shift).filter(Shift.code == s_data["code"]).first()
            if not s:
                s = Shift(
                    name=s_data["name"],
                    code=s_data["code"],
                    start_time=s_data["start_time"],
                    end_time=s_data["end_time"],
                    is_night_shift=s_data["is_night_shift"],
                    description=s_data["description"],
                    is_active=True
                )
                db.add(s)

        # 2. Initialize Default Devices
        for dev_data in DEFAULT_DEVICES:
            exists = db.query(Device).filter(Device.ip_address == dev_data["ip_address"]).first()
            if not exists:
                dev = Device(
                    ip_address=dev_data["ip_address"],
                    port=dev_data["port"],
                    device_name=dev_data["device_name"],
                    device_model=dev_data["device_model"],
                    attendance_type=dev_data["attendance_type"],
                    is_active=True,
                    last_status="UNKNOWN"
                )
                db.add(dev)

        # 3. Initialize Default Settings
        for k, v in DEFAULT_SETTINGS.items():
            s = db.query(Setting).filter(Setting.key == k).first()
            if not s:
                db.add(Setting(key=k, value=v))

        # 4. Initialize Default Admin User
        from app.routes.auth import ensure_default_admin
        ensure_default_admin(db)

        db.commit()
    finally:
        db.close()


def populate_sample_data(db: Session = None):
    """
    Populates sample employees and punches for demonstration with the 3 shifts.
    """
    close_db_at_end = False
    if db is None:
        db = SessionLocal()
        close_db_at_end = True

    try:
        # Code, Name, Dept, Designation, Email, Phone, ShiftCode, ShiftName, Start, End
        sample_employees = [
            ("1001", "Arun Prakash", "Engineering", "Principal Architect", "arun.p@centizen.com", "9876543210",
             "SHIFT_9_7", "General Shift (09:00 AM - 07:00 PM)", "09:00", "19:00"),
            ("1002", "Priya Sharma", "Engineering", "Senior Full-Stack Dev", "priya.s@centizen.com", "9876543211",
             "SHIFT_9_7", "General Shift (09:00 AM - 07:00 PM)", "09:00", "19:00"),
            ("1003", "Karthik Raja", "Engineering", "Backend Engineer", "karthik.r@centizen.com", "9876543212",
             "SHIFT_9_7", "General Shift (09:00 AM - 07:00 PM)", "09:00", "19:00"),
            ("1004", "Deepa Mohan", "Quality Assurance", "QA Lead", "deepa.m@centizen.com", "9876543213",
             "SHIFT_9_7", "General Shift (09:00 AM - 07:00 PM)", "09:00", "19:00"),
            ("1005", "Vignesh Kumar", "Cloud & DevOps", "DevOps Engineer", "vignesh.k@centizen.com", "9876543214",
             "SHIFT_9_6", "Standard Shift (09:00 AM - 06:00 PM)", "09:00", "18:00"),
            ("1006", "Sneha Rangan", "Project Management", "Technical Project Manager", "sneha.r@centizen.com", "9876543215",
             "SHIFT_9_6", "Standard Shift (09:00 AM - 06:00 PM)", "09:00", "18:00"),
            ("1007", "Manoj Chandran", "Engineering", "Frontend Engineer", "manoj.c@centizen.com", "9876543216",
             "SHIFT_9_6", "Standard Shift (09:00 AM - 06:00 PM)", "09:00", "18:00"),
            ("1008", "Divya Lakshmi", "Human Resources", "HR Executive", "divya.l@centizen.com", "9876543217",
             "SHIFT_9_6", "Standard Shift (09:00 AM - 06:00 PM)", "09:00", "18:00"),
            ("1009", "Suresh Gopinath", "Administration", "Facilities Coordinator", "suresh.g@centizen.com", "9876543218",
             "SHIFT_9_6", "Standard Shift (09:00 AM - 06:00 PM)", "09:00", "18:00"),
            ("1010", "Ananya Sundaram", "Engineering", "Data Engineer", "ananya.s@centizen.com", "9876543219",
             "SHIFT_9_6", "Standard Shift (09:00 AM - 06:00 PM)", "09:00", "18:00"),
            ("1011", "Ramesh Babu", "Quality Assurance", "Night QA Lead", "ramesh.b@centizen.com", "9876543220",
             "SHIFT_NIGHT", "Night Shift (09:00 PM - Next Day 06:00 AM)", "21:00", "06:00"),
            ("1012", "Keerthana Nair", "Cloud & DevOps", "Night Ops Engineer", "keerthana.n@centizen.com", "9876543221",
             "SHIFT_NIGHT", "Night Shift (09:00 PM - Next Day 06:00 AM)", "21:00", "06:00"),
        ]

        # Add or update employees
        for code, name, dept, desig, email, phone, s_code, s_name, s_start, s_end in sample_employees:
            emp = db.query(Employee).filter(Employee.emp_code == code).first()
            if not emp:
                emp = Employee(
                    emp_code=code,
                    name=name,
                    department=dept,
                    designation=desig,
                    email=email,
                    phone=phone,
                    shift_code=s_code,
                    shift_name=s_name,
                    shift_start=s_start,
                    shift_end=s_end,
                    is_active=True
                )
                db.add(emp)
            else:
                emp.shift_code = s_code
                emp.shift_name = s_name
                emp.shift_start = s_start
                emp.shift_end = s_end
        db.commit()

        # Seed realistic punches for the last 5 business days
        device_ips = ["172.16.0.4", "172.16.0.20", "172.16.0.5", "172.16.0.44"]
        today = date.today()

        days_to_seed = []
        for d_offset in range(5):
            cur = today - timedelta(days=d_offset)
            if cur.weekday() != 6:
                days_to_seed.append(cur)

        punches_added = 0
        for target_date in days_to_seed:
            is_current_day = (target_date == today)
            for code, name, dept, _, _, _, s_code, _, s_start, s_end in sample_employees:
                is_night = (s_code == "SHIFT_NIGHT")

                if is_night:
                    # Night shift: IN in evening around 20:50 - 21:10
                    first_in_dt = datetime.combine(target_date, time(20, random.randint(50, 59), random.randint(0, 59)))
                    # Intermediate: Night break around 01:30 AM
                    break_dt = datetime.combine(target_date + timedelta(days=1), time(1, random.randint(25, 45), random.randint(0, 59)))
                    # Last OUT: morning around 05:50 - 06:15 AM
                    last_out_dt = datetime.combine(target_date + timedelta(days=1), time(6, random.randint(0, 15), random.randint(0, 59)))
                elif s_code == "SHIFT_9_7":
                    # Daytime General Shift (09:00 - 19:00)
                    first_in_dt = datetime.combine(target_date, time(9, random.randint(0, 15), random.randint(0, 59)))
                    break_dt = datetime.combine(target_date, time(13, random.randint(15, 30), random.randint(0, 59)))
                    last_out_dt = datetime.combine(target_date, time(19, random.randint(0, 20), random.randint(0, 59)))
                else:
                    # Standard Shift (09:00 - 18:00)
                    first_in_dt = datetime.combine(target_date, time(9, random.randint(0, 15), random.randint(0, 59)))
                    break_dt = datetime.combine(target_date, time(13, random.randint(15, 30), random.randint(0, 59)))
                    last_out_dt = datetime.combine(target_date, time(18, random.randint(5, 25), random.randint(0, 59)))

                # Add First IN
                if not db.query(AttendancePunch).filter(AttendancePunch.emp_code == code, AttendancePunch.timestamp == first_in_dt).first():
                    db.add(AttendancePunch(emp_code=code, timestamp=first_in_dt, device_ip="172.16.0.4", punch_type=0))
                    punches_added += 1

                # Add Intermediate punch
                if not is_current_day or datetime.now() > break_dt:
                    if not db.query(AttendancePunch).filter(AttendancePunch.emp_code == code, AttendancePunch.timestamp == break_dt).first():
                        db.add(AttendancePunch(emp_code=code, timestamp=break_dt, device_ip="172.16.0.44", punch_type=1))
                        punches_added += 1

                # Add Last OUT
                if not is_current_day or datetime.now() > last_out_dt:
                    if not db.query(AttendancePunch).filter(AttendancePunch.emp_code == code, AttendancePunch.timestamp == last_out_dt).first():
                        db.add(AttendancePunch(emp_code=code, timestamp=last_out_dt, device_ip="172.16.0.20", punch_type=1))
                        punches_added += 1

        db.commit()

        # Update devices with count
        for d in db.query(Device).all():
            cnt = db.query(AttendancePunch).filter(AttendancePunch.device_ip == d.ip_address).count()
            d.total_punches_synced = cnt
            d.last_sync_time = datetime.now()
        db.commit()

        return {
            "employees_seeded": len(sample_employees),
            "punches_added": punches_added,
            "days_covered": len(days_to_seed)
        }
    finally:
        if close_db_at_end:
            db.close()


if __name__ == "__main__":
    init_db()
    res = populate_sample_data()
    print("Database initialized and sample data seeded:", res)
