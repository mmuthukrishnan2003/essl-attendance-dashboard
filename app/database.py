import json
import logging
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from app.config import DATABASE_URL, DATABASE_PATH, DB_CONFIG_FILE

logger = logging.getLogger("essl.database")

def create_initial_engine():
    connect_args = {"check_same_thread": False} if "sqlite" in DATABASE_URL else {}
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
