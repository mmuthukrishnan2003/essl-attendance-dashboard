import os
import re
import json
import socket
import urllib.parse
from datetime import datetime
from pathlib import Path
from typing import Optional, Dict, Any, List
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import inspect, text, func, create_engine
from sqlalchemy.engine import make_url

from app.database import get_db, engine, Base, switch_database_engine
from app.config import DATABASE_PATH, DATABASE_URL, DB_CONFIG_FILE
from seed_data import init_db, populate_sample_data

router = APIRouter(prefix="/api/database", tags=["Database & Schema"])

def test_tcp_port(host: str, port: int, timeout_sec: float = 2.0) -> bool:
    """Tests if a TCP port is actively reachable with timeout."""
    try:
        with socket.create_connection((host, port), timeout=timeout_sec):
            return True
    except (socket.timeout, ConnectionRefusedError, OSError):
        return False

TABLE_DESCRIPTIONS = {
    "attendance_punches": "Raw biometric attendance logs synced from all 4 eSSL devices. Includes first IN, intermediate, and last OUT punches.",
    "devices": "eSSL biometric hardware registry. Stores device IP (172.16.0.4, 172.16.0.20, etc.), port 4370, model, and online status.",
    "employees": "Employee master directory. Stores employee ID/code, full name, department, designation, and shift timings.",
    "settings": "System branding and configuration parameters: Centizen company name, logo path, theme colors, and grace periods."
}


class DbConnectionTestRequest(BaseModel):
    connection_url: str


class PostgresConnectRequest(BaseModel):
    host: str = "127.0.0.1"
    port: int = 5432
    dbname: str = "essl_att"
    user: str = "postgres"
    password: str = ""
    schema_name: str = "public"


class DbCheckRequest(BaseModel):
    host: Optional[str] = "127.0.0.1"
    port: Optional[int] = 5432
    dbname: Optional[str] = "attendance"
    user: Optional[str] = "postgres"
    password: Optional[str] = ""
    schema_name: Optional[str] = "public"
    engine_type: Optional[str] = "postgres"
    connection_url: Optional[str] = None


@router.get("/info")
def get_database_info(db: Session = Depends(get_db)):
    """
    Returns full metadata about the current active database connection,
    schema definitions, row counts, and table structures.
    """
    start_t = datetime.now()
    dialect_name = engine.dialect.name
    latency_ms = 0.0

    # Test basic query
    try:
        db.execute(text("SELECT 1"))
        latency_ms = round((datetime.now() - start_t).total_seconds() * 1000, 2)
        status = "CONNECTED"
        error_msg = None
    except Exception as e:
        status = "ERROR"
        error_msg = str(e)

    # File size for SQLite or PostgreSQL
    file_size_formatted = "N/A"
    is_sqlite = ("sqlite" in dialect_name)
    if is_sqlite and os.path.exists(DATABASE_PATH):
        file_size_bytes = os.path.getsize(DATABASE_PATH)
        if file_size_bytes > 1024 * 1024:
            file_size_formatted = f"{round(file_size_bytes / (1024 * 1024), 2)} MB"
        else:
            file_size_formatted = f"{round(file_size_bytes / 1024, 2)} KB"
    elif not is_sqlite:
        try:
            size_res = db.execute(text("SELECT pg_size_pretty(pg_database_size(current_database()))")).scalar()
            if size_res:
                file_size_formatted = str(size_res)
        except Exception:
            file_size_formatted = "Server DB"

    # Determine active schema
    active_schema = "public"
    if DB_CONFIG_FILE.exists():
        try:
            with open(DB_CONFIG_FILE, "r") as f:
                saved_cfg = json.load(f)
                active_schema = str(saved_cfg.get("schema_name") or "public")
        except Exception:
            pass

    # Inspect tables and schema
    insp = inspect(engine)
    try:
        table_names = insp.get_table_names(schema=active_schema if active_schema != "public" else None)
        if not table_names and active_schema != "public":
            table_names = insp.get_table_names()
    except Exception:
        table_names = insp.get_table_names()

    tables_meta = []
    total_records = 0

    for tbl in table_names:
        # Get row count safely
        try:
            count_res = db.execute(text(f"SELECT COUNT(*) FROM {tbl}")).scalar()
            row_count = int(count_res)
        except Exception:
            row_count = 0
        total_records += row_count

        # Get columns
        columns = []
        pk_constraint = insp.get_pk_constraint(tbl)
        pk_cols = pk_constraint.get("constrained_columns", []) if pk_constraint else []

        for col in insp.get_columns(tbl):
            columns.append({
                "name": col["name"],
                "type": str(col["type"]),
                "nullable": col.get("nullable", True),
                "primary_key": col["name"] in pk_cols,
                "default": str(col.get("default")) if col.get("default") is not None else None
            })

        # Get unique constraints
        uniques = []
        try:
            for u in insp.get_unique_constraints(tbl):
                uniques.append(u.get("name") or ", ".join(u.get("column_names", [])))
        except Exception:
            pass

        tables_meta.append({
            "table_name": tbl,
            "description": TABLE_DESCRIPTIONS.get(tbl, "Application data table"),
            "row_count": row_count,
            "column_count": len(columns),
            "columns": columns,
            "unique_constraints": uniques
        })

    # Sanitize URL for UI
    active_url = str(engine.url)
    display_url = active_url
    if "@" in display_url:
        # Mask password
        parts = display_url.split("@")
        cred_part = parts[0]
        if ":" in cred_part:
            prefix, _ = cred_part.rsplit(":", 1)
            display_url = f"{prefix}:****@{parts[1]}"

    is_postgres = ("postgres" in dialect_name)
    if is_postgres:
        db_name = engine.url.database or "attendance"
        host_str = f"{engine.url.host or '127.0.0.1'}:{engine.url.port or 5432}"
        server_label = f"PostgreSQL ({db_name})"
        subtitle_text = f"Active: PostgreSQL Server (\"local essl\") • Database: {db_name} • Host: {host_str} • Schema: {active_schema}"
    else:
        db_name = "attendance.db"
        host_str = "Local Embedded"
        server_label = "SQLite (Default Embedded)"
        subtitle_text = "Active: SQLite (Default Embedded Database) • Schema: public • File: attendance.db"

    # Connection form details synchronized with active database
    conn_details = {
        "host": "127.0.0.1",
        "port": 5432,
        "dbname": "attendance",
        "user": "postgres",
        "password": "",
        "schema": active_schema,
    }

    if DB_CONFIG_FILE.exists():
        try:
            with open(DB_CONFIG_FILE, "r") as f:
                saved_cfg = json.load(f)
                if "host" in saved_cfg:
                    conn_details["host"] = str(saved_cfg.get("host") or "127.0.0.1")
                    conn_details["port"] = int(saved_cfg.get("port") or 5432)
                    conn_details["dbname"] = str(saved_cfg.get("dbname") or "attendance")
                    conn_details["schema"] = str(saved_cfg.get("schema_name") or "public")
                    conn_details["user"] = str(saved_cfg.get("user") or "postgres")
                    conn_details["password"] = str(saved_cfg.get("password") or "")
                elif "connection_url" in saved_cfg and saved_cfg["connection_url"]:
                    u = make_url(saved_cfg["connection_url"])
                    if "postgres" in u.drivername:
                        conn_details["host"] = u.host or "127.0.0.1"
                        conn_details["port"] = u.port or 5432
                        conn_details["dbname"] = u.database or "attendance"
                        conn_details["user"] = u.username or "postgres"
                        conn_details["password"] = u.password or ""
        except Exception:
            pass

    if is_postgres:
        conn_details["host"] = engine.url.host or conn_details["host"]
        conn_details["port"] = engine.url.port or conn_details["port"]
        conn_details["dbname"] = engine.url.database or conn_details["dbname"]
        conn_details["user"] = engine.url.username or conn_details["user"]
        if engine.url.password:
            conn_details["password"] = engine.url.password

    # Get punch count specifically
    total_punches = 0
    try:
        total_punches = int(db.execute(text("SELECT COUNT(*) FROM attendance_punches")).scalar() or 0)
    except Exception:
        pass

    from app.live_sync import live_manager
    from app.database import get_active_db_info
    active_meta = get_active_db_info()

    live_status = {
        "is_active": live_manager.running,
        "last_db_sync_time": live_manager.last_db_sync_time or "Active / Listening",
        "last_synced_punch": live_manager.last_punch_info,
        "recent_sync_log": live_manager.recent_synced_punches[:15],
        "active_db": active_meta,
        "active_workers": [name for name, t in live_manager.workers.items() if t.is_alive()]
    }

    return {
        "status": status,
        "dialect": dialect_name.upper(),
        "server_label": server_label,
        "is_default_sqlite": is_sqlite,
        "is_postgres": is_postgres,
        "database_name": db_name,
        "host_endpoint": host_str,
        "subtitle": subtitle_text,
        "connection_url": display_url,
        "schema_name": active_schema,
        "connection_details": {
            "host_port": f"{conn_details['host']}:{conn_details['port']}",
            "host": conn_details["host"],
            "port": conn_details["port"],
            "dbname": conn_details["dbname"],
            "schema": conn_details.get("schema", active_schema),
            "user": conn_details["user"],
            "password": conn_details["password"],
        },
        "database_file": str(DATABASE_PATH) if is_sqlite else f"PostgreSQL Server ({host_str})",
        "file_size": file_size_formatted,
        "latency_ms": latency_ms,
        "error": error_msg,
        "total_tables": len(tables_meta),
        "total_records": total_records,
        "total_punches": total_punches,
        "live_sync_status": live_status,
        "tables": tables_meta
    }


@router.get("/live-sync-feed")
def get_live_sync_feed(db: Session = Depends(get_db)):
    """
    Returns real-time biometric punch sync feed and current database connection status.
    """
    from app.live_sync import live_manager
    from app.database import get_active_db_info

    total_punches = 0
    try:
        total_punches = int(db.execute(text("SELECT COUNT(*) FROM attendance_punches")).scalar() or 0)
    except Exception:
        pass

    return {
        "connected_db": get_active_db_info(),
        "is_live_sync_active": live_manager.running,
        "last_db_sync_time": live_manager.last_db_sync_time,
        "total_punches": total_punches,
        "recent_syncs": live_manager.recent_synced_punches[:25]
    }


@router.post("/sync-sqlite-to-postgres")
def sync_sqlite_to_postgres(db: Session = Depends(get_db)):
    """
    Transfers/synchronizes all biometric punch records, employees, shifts, and overrides
    from the default SQLite attendance.db into the currently connected PostgreSQL database.
    """
    import sqlite3
    from app.config import DATABASE_PATH
    from app.database import engine, get_active_db_info

    meta = get_active_db_info()
    if not meta["is_postgres"]:
        raise HTTPException(status_code=400, detail="Active database is SQLite. Switch to PostgreSQL first before syncing SQLite data into PostgreSQL.")

    if not os.path.exists(DATABASE_PATH):
        raise HTTPException(status_code=404, detail="attendance.db not found on server.")

    conn = sqlite3.connect(DATABASE_PATH)
    cur = conn.cursor()

    try:
        # 1. Sync Employees
        cur.execute("SELECT emp_code, name, department, designation, email, phone, shift_code, shift_name, shift_start, shift_end, card_number, is_active FROM employees")
        emp_rows = cur.fetchall()
        for r in emp_rows:
            db.execute(text("""
                INSERT INTO employees (emp_code, name, department, designation, email, phone, shift_code, shift_name, shift_start, shift_end, card_number, is_active)
                VALUES (:emp_code, :name, :department, :designation, :email, :phone, :shift_code, :shift_name, :shift_start, :shift_end, :card_number, :is_active)
                ON CONFLICT (emp_code) DO NOTHING
            """), {
                "emp_code": r[0], "name": r[1], "department": r[2], "designation": r[3],
                "email": r[4], "phone": r[5], "shift_code": r[6], "shift_name": r[7],
                "shift_start": r[8], "shift_end": r[9], "card_number": r[10], "is_active": bool(r[11])
            })
        db.commit()

        # 2. Sync Attendance Punches in chunks
        cur.execute("SELECT emp_code, timestamp, device_ip, punch_type, verify_type FROM attendance_punches")
        punches = cur.fetchall()
        chunk_size = 500
        for i in range(0, len(punches), chunk_size):
            chunk = punches[i:i + chunk_size]
            for p in chunk:
                db.execute(text("""
                    INSERT INTO attendance_punches (emp_code, timestamp, device_ip, punch_type, verify_type)
                    VALUES (:emp_code, :timestamp, :device_ip, :punch_type, :verify_type)
                    ON CONFLICT (emp_code, timestamp) DO NOTHING
                """), {
                    "emp_code": p[0], "timestamp": p[1], "device_ip": p[2], "punch_type": p[3], "verify_type": p[4]
                })
            db.commit()

        # 3. Sync Attendance Overrides if any
        try:
            cur.execute("SELECT emp_code, date, status, notes, updated_by FROM attendance_overrides")
            overrides = cur.fetchall()
            for o in overrides:
                db.execute(text("""
                    INSERT INTO attendance_overrides (emp_code, date, status, notes, updated_by)
                    VALUES (:emp_code, :date, :status, :notes, :updated_by)
                    ON CONFLICT (emp_code, date) DO UPDATE SET status = EXCLUDED.status, notes = EXCLUDED.notes
                """), {
                    "emp_code": o[0], "date": o[1], "status": o[2], "notes": o[3], "updated_by": o[4]
                })
            db.commit()
        except Exception:
            pass

        return {
            "success": True,
            "message": f"Successfully synced {len(punches)} biometric punches and {len(emp_rows)} employees into PostgreSQL ({meta['db_name']})!",
            "punches_synced": len(punches),
            "employees_synced": len(emp_rows),
            "target_database": meta["db_name"]
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Data sync failed: {str(e)}")
    finally:
        conn.close()


@router.post("/connect-postgres")
def connect_postgres_db(payload: PostgresConnectRequest, db: Session = Depends(get_db)):
    """
    Connects to the local PostgreSQL server (named 'local essl' in pgAdmin),
    database 'essl_att' (or 'attendance'), with public schema.
    """
    user_esc = urllib.parse.quote_plus(payload.user.strip())
    pass_esc = urllib.parse.quote_plus(payload.password)
    
    host_raw = payload.host.strip() or "127.0.0.1"
    if ":" in host_raw:
        parts = host_raw.split(":", 1)
        host = parts[0].strip() or "127.0.0.1"
        try:
            port = int(parts[1])
        except ValueError:
            port = payload.port or 5432
    else:
        host = host_raw
        port = payload.port or 5432

    dbname = payload.dbname.strip() or "essl_att"
    raw_schema = (payload.schema_name or "public").strip()
    schema_clean = re.sub(r"[^a-zA-Z0-9_]", "", raw_schema) or "public"

    # Construct SQLAlchemy connection URI for psycopg 3
    base_pg_url = f"postgresql+psycopg://{user_esc}:{pass_esc}@{host}:{port}/{dbname}" if pass_esc else f"postgresql+psycopg://{user_esc}@{host}:{port}/{dbname}"
    if schema_clean != "public":
        pg_url = f"{base_pg_url}?options=-csearch_path%3D{schema_clean}"
    else:
        pg_url = base_pg_url

    try:
        # Pre-ensure schema exists in PostgreSQL
        try:
            pre_engine = create_engine(base_pg_url, connect_args={"connect_timeout": 5}, echo=False)
            with pre_engine.connect() as conn:
                conn.execute(text(f'CREATE SCHEMA IF NOT EXISTS "{schema_clean}"'))
                conn.commit()
            pre_engine.dispose()
        except Exception as schema_err:
            print(f"Notice during schema check: {schema_err}")

        switch_database_engine(pg_url)

        # Force table creation explicitly in target schema
        with engine.begin() as conn:
            conn.execute(text(f'CREATE SCHEMA IF NOT EXISTS "{schema_clean}"'))
            conn.execute(text(f'SET search_path TO "{schema_clean}"'))
            Base.metadata.create_all(bind=conn)

        # Ensure default tables and initial devices exist in PostgreSQL
        init_db()

        # Persist structured parameters to disk
        try:
            with open(DB_CONFIG_FILE, "w") as f:
                json.dump({
                    "connection_url": pg_url,
                    "host": host,
                    "port": port,
                    "dbname": dbname,
                    "schema_name": schema_clean,
                    "user": payload.user.strip(),
                    "password": payload.password
                }, f, indent=2)
        except Exception:
            pass

        return {
            "success": True,
            "message": f"Successfully connected to PostgreSQL 'local essl' ({dbname})!",
            "database": dbname,
            "schema": payload.schema_name or "public",
            "schema_created": True,
            "schema_message": f"Default schema created & verified. Core tables (shifts, devices, employees, attendance_punches, settings) ready in '{dbname}'.",
            "sync_message": "4 eSSL biometric door units registered. Punch synchronization initiated.",
            "tables_created": ["shifts", "devices", "employees", "attendance_punches", "settings"],
            "database": dbname,
            "schema": payload.schema_name,
            "connection_details": {
                "host_port": f"{host}:{port}",
                "host": host,
                "port": port,
                "dbname": dbname,
                "user": payload.user.strip(),
                "password": payload.password
            }
        }
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Failed to connect to PostgreSQL 'local essl' ({dbname}): {str(e)}"
        )


@router.post("/use-default-sqlite")
def use_default_sqlite():
    """Switches back to the default local SQLite database."""
    default_url = f"sqlite:///{DATABASE_PATH}"
    try:
        switch_database_engine(default_url)
        if DB_CONFIG_FILE.exists():
            try:
                os.remove(DB_CONFIG_FILE)
            except Exception:
                pass
        return {"success": True, "message": "Switched back to default SQLite database."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/port-status")
def get_port_status(host: str = "127.0.0.1", port: int = 5432):
    """
    Fast reachability check for database server TCP port (default 5432).
    """
    if ":" in host:
        parts = host.split(":", 1)
        host = parts[0].strip() or "127.0.0.1"
        try:
            port = int(parts[1])
        except ValueError:
            pass

    is_open = test_tcp_port(host, port, timeout_sec=1.5)
    return {
        "host": host,
        "port": port,
        "is_open": is_open,
        "status": "ACTIVE" if is_open else "OFFLINE",
        "badge_text": f"Port {port}: {'Active' if is_open else 'Offline'}"
    }


@router.post("/check-active")
def check_active_database_connection(db: Session = Depends(get_db)):
    """
    Verifies that the currently active database connection is healthy,
    executing a test query and reporting response latency.
    """
    start_t = datetime.now()
    dialect_name = engine.dialect.name.upper()
    try:
        db.execute(text("SELECT 1"))
        latency_ms = round((datetime.now() - start_t).total_seconds() * 1000, 2)
        insp = inspect(engine)
        tables = insp.get_table_names()
        return {
            "success": True,
            "status": "HEALTHY",
            "dialect": dialect_name,
            "latency_ms": latency_ms,
            "table_count": len(tables),
            "connection_url": str(engine.url),
            "message": f"Active {dialect_name} database connection verified healthy! Latency: {latency_ms}ms"
        }
    except Exception as e:
        return {
            "success": False,
            "status": "UNHEALTHY",
            "dialect": dialect_name,
            "error": str(e),
            "message": f"Active database connection test failed: {str(e)}"
        }


@router.post("/check-connection")
def check_database_connection(payload: DbCheckRequest):
    """
    Non-destructive connection verification.
    Tests TCP reachability, credentials, database accessibility, and measures latency
    WITHOUT switching the active database engine.
    """
    engine_type = (payload.engine_type or "postgres").lower()

    # 1. Custom URL check
    if payload.connection_url and payload.connection_url.strip():
        url = payload.connection_url.strip()
        start_t = datetime.now()
        test_engine = None
        try:
            connect_args = {"check_same_thread": False} if "sqlite" in url else {"connect_timeout": 5}
            test_engine = create_engine(url, connect_args=connect_args)
            with test_engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            latency = round((datetime.now() - start_t).total_seconds() * 1000, 2)
            insp = inspect(test_engine)
            tables = insp.get_table_names()
            return {
                "success": True,
                "status": "CONNECTED",
                "dialect": test_engine.dialect.name.upper(),
                "latency_ms": latency,
                "table_count": len(tables),
                "tables": tables,
                "message": f"Successfully connected to {test_engine.dialect.name.upper()} database ({latency}ms)!"
            }
        except Exception as e:
            return {
                "success": False,
                "status": "ERROR",
                "error": str(e),
                "message": f"Connection check failed: {str(e)}"
            }
        finally:
            if test_engine:
                test_engine.dispose()

    # 2. SQLite check
    if engine_type == "sqlite":
        start_t = datetime.now()
        test_engine = None
        try:
            test_engine = create_engine(f"sqlite:///{DATABASE_PATH}", connect_args={"check_same_thread": False})
            with test_engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            latency = round((datetime.now() - start_t).total_seconds() * 1000, 2)
            insp = inspect(test_engine)
            tables = insp.get_table_names()
            return {
                "success": True,
                "status": "CONNECTED",
                "dialect": "SQLITE",
                "latency_ms": latency,
                "table_count": len(tables),
                "tables": tables,
                "message": f"SQLite database is online and accessible ({latency}ms)."
            }
        except Exception as e:
            return {
                "success": False,
                "status": "ERROR",
                "error": str(e),
                "message": f"SQLite check failed: {str(e)}"
            }
        finally:
            if test_engine:
                test_engine.dispose()

    # 3. PostgreSQL Server check
    host_raw = (payload.host or "127.0.0.1").strip()
    if ":" in host_raw:
        parts = host_raw.split(":", 1)
        host = parts[0].strip() or "127.0.0.1"
        try:
            port = int(parts[1])
        except ValueError:
            port = payload.port or 5432
    else:
        host = host_raw
        port = payload.port or 5432

    dbname = (payload.dbname or "attendance").strip()
    user = (payload.user or "postgres").strip()
    password = payload.password or ""

    # Step 1: TCP Port Reachability Check
    is_port_open = test_tcp_port(host, port, timeout_sec=2.0)
    if not is_port_open:
        return {
            "success": False,
            "port_open": False,
            "status": "PORT_OFFLINE",
            "host": host,
            "port": port,
            "dbname": dbname,
            "user": user,
            "message": f"Cannot reach PostgreSQL server on {host}:{port}. Port is closed or server is not running.",
            "suggestion": f"Please verify PostgreSQL is started on {host}:{port}. In Windows Services, ensure 'postgresql-x64' service is Running, or verify host and port."
        }

    # Step 2: Attempt PostgreSQL Authentication and Handshake
    user_esc = urllib.parse.quote_plus(user)
    pass_esc = urllib.parse.quote_plus(password)
    if pass_esc:
        pg_url = f"postgresql+psycopg://{user_esc}:{pass_esc}@{host}:{port}/{dbname}"
    else:
        pg_url = f"postgresql+psycopg://{user_esc}@{host}:{port}/{dbname}"

    raw_schema = (payload.schema_name or "public").strip()
    schema_clean = re.sub(r"[^a-zA-Z0-9_]", "", raw_schema) or "public"

    start_t = datetime.now()
    test_engine = None
    test_pg_url = f"{pg_url}?options=-csearch_path%3D{schema_clean}" if schema_clean != "public" else pg_url
    try:
        test_engine = create_engine(test_pg_url, connect_args={"connect_timeout": 5}, echo=False)
        with test_engine.connect() as conn:
            conn.execute(text("SELECT 1"))
            latency = round((datetime.now() - start_t).total_seconds() * 1000, 2)
            try:
                server_ver = conn.execute(text("SELECT version()")).scalar()
            except Exception:
                server_ver = "PostgreSQL Server"

        insp = inspect(test_engine)
        try:
            tables = insp.get_table_names(schema=schema_clean)
            if not tables and schema_clean != "public":
                tables = insp.get_table_names()
        except Exception:
            tables = insp.get_table_names()

        ver_short = str(server_ver).split(",")[0].strip() if server_ver else "PostgreSQL"

        return {
            "success": True,
            "port_open": True,
            "status": "CONNECTED",
            "dialect": "POSTGRESQL",
            "host": host,
            "port": port,
            "database": dbname,
            "schema": schema_clean,
            "user": user,
            "latency_ms": latency,
            "server_version": ver_short,
            "table_count": len(tables),
            "tables": tables,
            "message": f"Connection verified successfully! {ver_short} responded on {host}:{port} ({latency}ms). Database: '{dbname}', Schema: '{schema_clean}' ({len(tables)} tables)."
        }
    except Exception as exc:
        err_str = str(exc)
        suggestion = None
        status_code = "GENERAL_ERROR"

        if "password authentication failed" in err_str.lower():
            status_code = "AUTH_FAILED"
            clean_msg = f"Authentication failed for user '{user}'. Incorrect PostgreSQL password."
            suggestion = "Please check the PostgreSQL password you entered and try again."
        elif "does not exist" in err_str.lower() and dbname.lower() in err_str.lower():
            status_code = "DB_NOT_FOUND"
            clean_msg = f"Database '{dbname}' does not exist on PostgreSQL server at {host}:{port}."
            suggestion = f"Create '{dbname}' in pgAdmin, or select 'essl_att' / 'postgres' database."
        elif "connection refused" in err_str.lower() or "permission denied" in err_str.lower():
            status_code = "CONNECTION_REFUSED"
            clean_msg = f"Connection to {host}:{port} was rejected."
            suggestion = "Make sure the PostgreSQL service is running and allows incoming connections."
        else:
            clean_msg = f"PostgreSQL connection error: {err_str}"

        return {
            "success": False,
            "port_open": True,
            "status": status_code,
            "host": host,
            "port": port,
            "dbname": dbname,
            "user": user,
            "message": clean_msg,
            "suggestion": suggestion,
            "raw_error": err_str
        }
    finally:
        if test_engine:
            test_engine.dispose()


@router.post("/test-connection")
def test_custom_connection(payload: DbConnectionTestRequest):
    """
    Tests connection to a specified database URL.
    """
    url = payload.connection_url.strip()
    if not url:
        raise HTTPException(status_code=400, detail="Database connection string cannot be empty")

    start_t = datetime.now()
    test_engine = None
    try:
        connect_args = {"check_same_thread": False} if "sqlite" in url else {}
        test_engine = create_engine(url, connect_args=connect_args)
        with test_engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        latency = round((datetime.now() - start_t).total_seconds() * 1000, 2)
        return {
            "success": True,
            "dialect": test_engine.dialect.name.upper(),
            "latency_ms": latency,
            "message": f"Successfully connected to {test_engine.dialect.name.upper()} database ({latency}ms)!"
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "message": f"Connection failed: {str(e)}"
        }
    finally:
        if test_engine:
            test_engine.dispose()


@router.get("/table/{table_name}/rows")
def preview_table_rows(table_name: str, limit: int = 25, db: Session = Depends(get_db)):
    """
    Returns preview rows of any database table for live inspection in the dashboard.
    """
    insp = inspect(engine)
    if table_name not in insp.get_table_names():
        raise HTTPException(status_code=404, detail=f"Table '{table_name}' does not exist")

    cols = [c["name"] for c in insp.get_columns(table_name)]

    try:
        result = db.execute(text(f"SELECT * FROM {table_name} ORDER BY 1 DESC LIMIT :lim"), {"lim": limit})
        rows_data = []
        for r in result.mappings():
            row_dict = {}
            for col in cols:
                val = r.get(col)
                if isinstance(val, datetime):
                    val = val.strftime("%Y-%m-%d %H:%M:%S")
                row_dict[col] = val
            rows_data.append(row_dict)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    return {
        "table_name": table_name,
        "columns": cols,
        "total_returned": len(rows_data),
        "rows": rows_data
    }


@router.get("/download-backup")
def download_database_backup():
    """
    Downloads the current SQLite database file directly as a backup.
    """
    if not os.path.exists(DATABASE_PATH):
        raise HTTPException(status_code=404, detail="Database file not found")

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"Centizen_Attendance_DB_{timestamp}.db"

    return FileResponse(
        path=str(DATABASE_PATH),
        filename=filename,
        media_type="application/octet-stream"
    )


@router.post("/reset-default-schema")
def reset_default_schema(db: Session = Depends(get_db)):
    """
    Recreates tables according to the default schema and re-seeds default eSSL devices.
    """
    active_schema = "public"
    if DB_CONFIG_FILE.exists():
        try:
            with open(DB_CONFIG_FILE, "r") as f:
                saved_cfg = json.load(f)
                active_schema = str(saved_cfg.get("schema_name") or "public")
        except Exception:
            pass

    if "postgres" in engine.dialect.name:
        with engine.begin() as conn:
            conn.execute(text(f'CREATE SCHEMA IF NOT EXISTS "{active_schema}"'))
            conn.execute(text(f'SET search_path TO "{active_schema}"'))
            Base.metadata.create_all(bind=conn)
    else:
        Base.metadata.create_all(bind=engine)

    init_db()
    return {
        "success": True,
        "schema": active_schema,
        "message": f"Default database schema '{active_schema}' and tables (shifts, devices, employees, attendance_punches, settings) verified successfully!"
    }
