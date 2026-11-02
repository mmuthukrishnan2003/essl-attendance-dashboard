from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware

from app.config import STATIC_DIR, TEMPLATES_DIR
from app.database import engine, Base
from app.routes import dashboard, employees, attendance, devices, settings, db_manager, shifts
from app.scheduler import start_scheduler, stop_scheduler
from seed_data import init_db, populate_sample_data


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Ensure tables exist and default data is seeded
    init_db()
    # Check if employees exist, if not seed initial demo data
    from app.database import SessionLocal
    from app.models import Employee
    db = SessionLocal()
    try:
        emp_count = db.query(Employee).count()
        if emp_count == 0:
            populate_sample_data(db)
    finally:
        db.close()

    # Start biometric background sync scheduler
    start_scheduler()
    yield
    # Shutdown: Stop scheduler
    stop_scheduler()


app = FastAPI(
    title="Centizen eSSL Biometric Attendance Management System",
    description="Attendance dashboard integrating four eSSL biometric devices with automated IN/OUT calculation",
    version="1.0.0",
    lifespan=lifespan
)

# Enable CORS for all domains and IPs including centizen.AttendancePortal.com
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount Static Files
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

# Include API Routers
app.include_router(dashboard.router)
app.include_router(employees.router)
app.include_router(attendance.router)
app.include_router(devices.router)
app.include_router(settings.router)
app.include_router(db_manager.router)
app.include_router(shifts.router)


@app.get("/", response_class=HTMLResponse)
async def serve_index(request: Request):
    """Serves the main single-page application dashboard."""
    return FileResponse(TEMPLATES_DIR / "index.html")

