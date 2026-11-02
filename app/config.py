import os
import json
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
STATIC_DIR = BASE_DIR / "static"
UPLOADS_DIR = STATIC_DIR / "uploads"
TEMPLATES_DIR = BASE_DIR / "templates"
DATABASE_PATH = BASE_DIR / "attendance.db"
DB_CONFIG_FILE = BASE_DIR / "db_config.json"
DATABASE_URL = f"sqlite:///{DATABASE_PATH}"

# Check for saved custom database config (e.g. PostgreSQL local essl)
if DB_CONFIG_FILE.exists():
    try:
        with open(DB_CONFIG_FILE, "r") as f:
            cfg = json.load(f)
            if "connection_url" in cfg and cfg["connection_url"]:
                DATABASE_URL = cfg["connection_url"]
    except Exception:
        pass

# Ensure required directories exist
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
STATIC_DIR.mkdir(parents=True, exist_ok=True)
TEMPLATES_DIR.mkdir(parents=True, exist_ok=True)

# Default eSSL Devices requested by user
DEFAULT_DEVICES = [
    {
        "ip_address": "172.16.0.4",
        "port": 4370,
        "device_name": "Device 1 - Main Entrance (eSSL F18 + F12)",
        "device_model": "eSSL F18 + F12",
        "attendance_type": "BOTH",
    },
    {
        "ip_address": "172.16.0.20",
        "port": 4370,
        "device_name": "Device 2 - Office Floor 1 (eSSL F18 + F12)",
        "device_model": "eSSL F18 + F12",
        "attendance_type": "BOTH",
    },
    {
        "ip_address": "172.16.0.5",
        "port": 4370,
        "device_name": "Device 3 - Office Floor 2 (eSSL F18 + F12)",
        "device_model": "eSSL F18 + F12",
        "attendance_type": "BOTH",
    },
    {
        "ip_address": "172.16.0.44",
        "port": 4370,
        "device_name": "Device 4 - Rear Exit / Cafeteria (eSSL F18 + F12)",
        "device_model": "eSSL F18 + F12",
        "attendance_type": "BOTH",
    },
]

# Default Settings based on Centizen Branding
DEFAULT_SETTINGS = {
    "company_name": "Centizen IT Services & Solutions",
    "logo_path": "/static/uploads/company_logo.jpg",
    "primary_color": "#0a5482",   # Centizen Deep Navy Blue
    "accent_color": "#f27e20",    # Centizen Vibrant Orange
    "shift_start_time": "09:30",
    "shift_end_time": "18:30",
    "late_grace_minutes": "15",   # Late if after 09:45
    "half_day_hours": "4.0",
    "full_day_hours": "8.0",
    "auto_sync_interval_mins": "15",
    "auto_sync_enabled": "true",
}

