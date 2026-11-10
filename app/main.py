from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, FileResponse, RedirectResponse
from fastapi.middleware.cors import CORSMiddleware

from app.config import STATIC_DIR, TEMPLATES_DIR
from app.database import engine, Base
from app.routes import dashboard, employees, attendance, devices, settings, db_manager, shifts, auth
from app.scheduler import start_scheduler, stop_scheduler
from seed_data import init_db, populate_sample_data


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Ensure tables exist and default data is seeded
    init_db()
    # Check if employees exist, if not seed initial demo data only on fresh database
    from app.database import SessionLocal
    from app.models import Employee, DeletedEmployee
    db = SessionLocal()
    try:
        emp_count = db.query(Employee).count()
        del_count = db.query(DeletedEmployee).count()
        if emp_count == 0 and del_count == 0:
            populate_sample_data(db)
    finally:
        db.close()

    # Start biometric background sync scheduler and 24/7 instant live capture
    from app.live_sync import live_manager
    start_scheduler()
    live_manager.start()
    yield
    # Shutdown: Stop scheduler and live manager
    live_manager.stop()
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
app.include_router(auth.router)
app.include_router(dashboard.router)
app.include_router(employees.router)
app.include_router(attendance.router)
app.include_router(devices.router)
app.include_router(settings.router)
app.include_router(db_manager.router)
app.include_router(shifts.router)


@app.get("/", response_class=HTMLResponse)
async def serve_index(request: Request):
    """Serves the main single-page application dashboard if authenticated."""
    token = request.cookies.get("session_token")
    # Also support auth header
    if not token:
        auth_hdr = request.headers.get("Authorization")
        if auth_hdr and auth_hdr.startswith("Bearer "):
            token = auth_hdr.split(" ", 1)[1].strip()

    from app.routes.auth import is_session_valid
    # If not authenticated, redirect to login page
    if not is_session_valid(token):
        return RedirectResponse(url="/login", status_code=302)

    return FileResponse(
        TEMPLATES_DIR / "index.html",
        headers={
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0"
        }
    )

