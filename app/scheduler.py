import logging
from apscheduler.schedulers.background import BackgroundScheduler
from app.database import SessionLocal
from app.models import Setting
from app.zk_service import sync_all_active_devices

logger = logging.getLogger("essl_scheduler")
scheduler = BackgroundScheduler(daemon=True)


def scheduled_sync_job():
    """Triggered periodically by APScheduler to pull punches from all 4 devices."""
    logger.info("Executing scheduled biometric sync job...")
    db = SessionLocal()
    try:
        # Check if auto sync is enabled
        setting = db.query(Setting).filter(Setting.key == "auto_sync_enabled").first()
        if setting and setting.value.lower() != "true":
            logger.info("Auto sync is currently disabled in settings.")
            return

        res = sync_all_active_devices(db)
        logger.info(f"Scheduled sync completed: {res['success_devices']}/{res['total_devices']} devices online, {res['total_new_punches']} new punches.")
    except Exception as e:
        logger.error(f"Scheduled sync job error: {e}")
    finally:
        db.close()


def start_scheduler():
    """Initializes and starts the background sync scheduler."""
    if not scheduler.running:
        db = SessionLocal()
        interval_mins = 15
        try:
            int_setting = db.query(Setting).filter(Setting.key == "auto_sync_interval_mins").first()
            if int_setting:
                interval_mins = max(1, int(int_setting.value))
        except Exception:
            pass
        finally:
            db.close()

        scheduler.add_job(
            scheduled_sync_job,
            "interval",
            minutes=interval_mins,
            id="essl_auto_sync_job",
            replace_existing=True
        )
        scheduler.start()
        logger.info(f"Biometric background scheduler started with {interval_mins} mins interval.")


def update_scheduler_interval(minutes: int):
    """Dynamically updates the recurring sync interval."""
    if scheduler.running:
        scheduler.reschedule_job(
            "essl_auto_sync_job",
            trigger="interval",
            minutes=max(1, minutes)
        )
        logger.info(f"Rescheduled sync job to {minutes} minutes.")


def stop_scheduler():
    """Shuts down scheduler gracefully."""
    if scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("Biometric background scheduler stopped.")
