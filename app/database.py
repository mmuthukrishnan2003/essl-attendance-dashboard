import json
import logging
import re
from typing import Optional
from sqlalchemy import create_engine
from sqlalchemy.engine import make_url
from sqlalchemy.orm import declarative_base, sessionmaker
from app.config import DATABASE_URL, DATABASE_PATH, DB_CONFIG_FILE

logger = logging.getLogger("essl.database")

def extract_schema_from_url(url_str: str) -> str:
    """Extracts search_path schema from database URL options if present."""
    m = re.search(r"search_path(?:%3D|=)([a-zA-Z0-9_]+)", str(url_str))
    return m.group(1) if m else "public"

def create_initial_engine():
    connect_args = {"check_same_thread": False} if "sqlite" in DATABASE_URL else {"connect_timeout": 3}
    try:
        eng = create_engine(DATABASE_URL, connect_args=connect_args, echo=False)
        with eng.connect() as conn:
            pass
        return eng
    except Exception as exc:
        logger.warning(f"Could not connect to configured database {DATABASE_URL}: {exc}. Falling back to default SQLite database.")
        sqlite_url = f"sqlite:///{DATABASE_PATH}"
        return create_engine(sqlite_url, connect_args={"check_same_thread": False}, echo=False)

engine = create_initial_engine()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    """Dependency that provides an active database session per request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def switch_database_engine(new_url: str, schema_name: Optional[str] = None):
    """
    Dynamically switches the active SQLAlchemy engine and SessionLocal
    to a new database (e.g. PostgreSQL local essl).
    """
    global engine, SessionLocal
    connect_args = {"check_same_thread": False} if "sqlite" in new_url else {}
    new_engine = create_engine(new_url, connect_args=connect_args, echo=False)

    # Test connectivity
    with new_engine.connect() as conn:
        pass

    engine = new_engine
    SessionLocal.configure(bind=engine)
    Base.metadata.create_all(bind=engine)

    # Persist config to disk with full parameters
    try:
        sch = schema_name or extract_schema_from_url(new_url)
        u = make_url(new_url)
        cfg_data = {
            "connection_url": new_url,
            "schema_name": sch,
            "dbname": u.database or "attendance",
            "host": u.host or "127.0.0.1",
            "port": u.port or 5432,
            "user": u.username or "postgres"
        }
        with open(DB_CONFIG_FILE, "w") as f:
            json.dump(cfg_data, f, indent=2)
    except Exception:
        pass

    return engine


def get_active_db_info():
    """
    Returns structured connection metadata for the currently active database engine.
    """
    dialect = engine.dialect.name
    is_sqlite = "sqlite" in dialect
    is_postgres = "postgres" in dialect

    active_schema = "public"
    if is_postgres:
        db_name = engine.url.database or "essl_attendance"
        host_str = f"{engine.url.host or '127.0.0.1'}:{engine.url.port or 5432}"
        label = f"PostgreSQL ({db_name})"
        active_schema = extract_schema_from_url(str(engine.url))
        if DB_CONFIG_FILE.exists():
            try:
                with open(DB_CONFIG_FILE, "r") as f:
                    cfg = json.load(f)
                    if cfg.get("schema_name"):
                        active_schema = cfg["schema_name"]
            except Exception:
                pass
        full_label = f"PostgreSQL Server (\"local essl\") • Database: {db_name} • Host: {host_str} • Schema: {active_schema}"
    else:
        db_name = "attendance.db"
        host_str = "Local Embedded"
        label = "SQLite (attendance.db)"
        full_label = "SQLite (Default Embedded Database) • File: attendance.db"

    return {
        "dialect": dialect.upper(),
        "is_sqlite": is_sqlite,
        "is_postgres": is_postgres,
        "db_name": db_name,
        "schema": active_schema,
        "schema_name": active_schema,
        "host_endpoint": host_str,
        "label": label,
        "full_label": full_label,
        "connection_url": str(engine.url)
    }


