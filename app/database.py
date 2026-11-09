import json
import logging
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from app.config import DATABASE_URL, DATABASE_PATH, DB_CONFIG_FILE

logger = logging.getLogger("essl.database")

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


def switch_database_engine(new_url: str):
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

    # Persist config to disk
    try:
        with open(DB_CONFIG_FILE, "w") as f:
            json.dump({"connection_url": new_url}, f, indent=2)
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

    if is_postgres:
        db_name = engine.url.database or "essl_attendance"
        host_str = f"{engine.url.host or '127.0.0.1'}:{engine.url.port or 5432}"
        label = f"PostgreSQL ({db_name})"
        full_label = f"PostgreSQL Server (\"local essl\") • Database: {db_name} • Host: {host_str}"
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
        "host_endpoint": host_str,
        "label": label,
        "full_label": full_label,
        "connection_url": str(engine.url)
    }

