import os
import urllib.parse
from datetime import datetime
from pathlib import Path
from typing import Optional, Dict, Any, List
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import inspect, text, func, create_engine

from app.database import get_db, engine, Base, switch_database_engine
from app.config import DATABASE_PATH, DATABASE_URL, DB_CONFIG_FILE
from seed_data import init_db, populate_sample_data

router = APIRouter(prefix="/api/database", tags=["Database & Schema"])

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

    # File size for SQLite
    file_size_formatted = "N/A"
    is_sqlite = ("sqlite" in dialect_name)
    if is_sqlite and os.path.exists(DATABASE_PATH):
        file_size_bytes = os.path.getsize(DATABASE_PATH)
        if file_size_bytes > 1024 * 1024:
            file_size_formatted = f"{round(file_size_bytes / (1024 * 1024), 2)} MB"
        else:
            file_size_formatted = f"{round(file_size_bytes / 1024, 2)} KB"

    # Inspect tables and schema
    insp = inspect(engine)
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

    server_label = "PostgreSQL (local essl)" if "postgres" in dialect_name else "SQLite (Default Embedded)"

    return {
        "status": status,
        "dialect": dialect_name.upper(),
        "server_label": server_label,
        "is_default_sqlite": is_sqlite,
        "connection_url": display_url,
        "database_file": str(DATABASE_PATH) if is_sqlite else "PostgreSQL Server (Port 5432)",
        "file_size": file_size_formatted,
        "latency_ms": latency_ms,
        "error": error_msg,
        "total_tables": len(tables_meta),
        "total_records": total_records,
        "tables": tables_meta
    }


@router.post("/connect-postgres")
def connect_postgres_db(payload: PostgresConnectRequest, db: Session = Depends(get_db)):
    """
    Connects to the local PostgreSQL server (named 'local essl' in pgAdmin),
    database 'essl_att' (or 'attendance'), with public schema.
    """
    user_esc = urllib.parse.quote_plus(payload.user.strip())
    pass_esc = urllib.parse.quote_plus(payload.password)
    host = payload.host.strip() or "127.0.0.1"
    port = payload.port or 5432
    dbname = payload.dbname.strip() or "essl_att"

    # Construct SQLAlchemy connection URI for psycopg 3
    if pass_esc:
        pg_url = f"postgresql+psycopg://{user_esc}:{pass_esc}@{host}:{port}/{dbname}"
    else:
        pg_url = f"postgresql+psycopg://{user_esc}@{host}:{port}/{dbname}"

    try:
        switch_database_engine(pg_url)
        # Ensure default tables and initial devices exist in PostgreSQL
        init_db()
        return {
            "success": True,
            "message": f"Successfully connected to PostgreSQL 'local essl' ({dbname})! Schema verified.",
            "database": dbname,
            "schema": payload.schema_name
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
    Base.metadata.create_all(bind=engine)
    init_db()
    populate_sample_data(db)
    return {"message": "Default database schema and records re-initialized successfully"}
