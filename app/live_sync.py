import asyncio
import json
import logging
import threading
import time
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, Set

from zk import ZK
from app.database import SessionLocal
from app.models import Device, Employee, AttendancePunch, DeletedEmployee

logger = logging.getLogger("essl_live_sync")


class LiveSyncManager:
    """
    Manages 24/7 real-time event listeners on all eSSL biometric devices.
    Whenever a physical punch occurs on any device:
    1. It is captured within milliseconds via pyzk live_capture.
    2. Stored immediately into the active database (Postgres / SQLite).
    3. Broadcast immediately to all connected browser dashboards via SSE.
    """

    def __init__(self):
        self.version: int = 1
        self.last_punch_info: Optional[Dict[str, Any]] = None
        self.last_db_sync_time: Optional[str] = None
        self.recent_synced_punches: list = []
        self.total_punches_synced_session: int = 0
        self.subscribers: Set[asyncio.Queue] = set()
        self.workers: Dict[str, threading.Thread] = {}
        self.running: bool = False
        self.supervisor: Optional[threading.Thread] = None

    def start(self):
        if self.running:
            return
        self.running = True
        self._seed_recent_punches()
        self.supervisor = threading.Thread(
            target=self._supervisor_loop,
            daemon=True,
            name="LiveSyncSupervisor"
        )
        self.supervisor.start()
        logger.info("Biometric LiveSyncManager started successfully.")

    def _seed_recent_punches(self):
        """Pre-populates the recent sync feed from the database on startup."""
        try:
            db = SessionLocal()
            recent = (
                db.query(AttendancePunch, Employee)
                .outerjoin(Employee, AttendancePunch.emp_code == Employee.emp_code)
                .order_by(AttendancePunch.timestamp.desc())
                .limit(20)
                .all()
            )
            from app.database import get_active_db_info
            db_meta = get_active_db_info()

            feed = []
            for p, emp in recent:
                emp_name = emp.name if emp else f"Employee {p.emp_code}"
                feed.append({
                    "emp_code": p.emp_code,
                    "name": emp_name,
                    "timestamp": p.timestamp.strftime("%Y-%m-%d %H:%M:%S"),
                    "time_str": p.timestamp.strftime("%H:%M:%S"),
                    "device": p.device_ip,
                    "device_ip": p.device_ip,
                    "punch_type": p.punch_type,
                    "db_synced": True,
                    "db_target": db_meta["label"],
                    "db_dialect": db_meta["dialect"],
                    "sync_time": p.timestamp.strftime("%H:%M:%S"),
                    "status": "Committed to DB"
                })
            self.recent_synced_punches = feed
            if feed:
                self.last_db_sync_time = feed[0]["timestamp"]
                self.last_punch_info = feed[0]
            db.close()
        except Exception as e:
            logger.warning(f"Could not pre-seed recent punches: {e}")

    def stop(self):
        self.running = False
        logger.info("Biometric LiveSyncManager stopping...")

    def broadcast_punch(self, punch_data: Dict[str, Any]):
        self.version += 1
        self.last_punch_info = punch_data
        punch_data["version"] = self.version
        logger.info(
            f"⚡ [INSTANT PUNCH] Emp {punch_data.get('emp_code')} "
            f"({punch_data.get('name')}) at {punch_data.get('device')} "
            f"[{punch_data.get('timestamp')}] -> DB: {punch_data.get('db_target', 'Active DB')}"
        )

        dead_queues = set()
        for q in list(self.subscribers):
            try:
                q.put_nowait(punch_data)
            except Exception:
                dead_queues.add(q)
        self.subscribers.difference_update(dead_queues)

    def record_manual_punch(self, emp_code: str, emp_name: str, punch_time: datetime, device_name: str = "Manual Entry", punch_type: int = 0):
        """Records and broadcasts a manual punch added via API/UI to live sync stream."""
        from app.database import get_active_db_info
        db_meta = get_active_db_info()
        now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        self.last_db_sync_time = now_str
        self.total_punches_synced_session += 1

        punch_data = {
            "type": "new_punch",
            "emp_code": emp_code,
            "name": emp_name,
            "timestamp": punch_time.strftime("%Y-%m-%d %H:%M:%S"),
            "time_str": punch_time.strftime("%H:%M:%S"),
            "device": device_name,
            "device_ip": "Manual Entry",
            "punch_type": punch_type,
            "db_synced": True,
            "db_target": db_meta["label"],
            "db_dialect": db_meta["dialect"],
            "sync_time": now_str,
            "status": "Committed to DB"
        }
        self.last_punch_info = punch_data
        self.recent_synced_punches.insert(0, punch_data)
        if len(self.recent_synced_punches) > 30:
            self.recent_synced_punches.pop()

        self.broadcast_punch(punch_data)

    def record_bulk_sync(self, count: int, device_name: str):
        """Broadcasts device sync activity."""
        from app.database import get_active_db_info
        db_meta = get_active_db_info()
        now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        self.last_db_sync_time = now_str
        self.total_punches_synced_session += count

        sync_data = {
            "type": "catchup_synced",
            "device": device_name,
            "count": count,
            "db_synced": True,
            "db_target": db_meta["label"],
            "db_dialect": db_meta["dialect"],
            "timestamp": now_str
        }
        self.broadcast_punch(sync_data)

    def _supervisor_loop(self):
        """Continuously monitors and maintains live capture worker threads for all active devices."""
        time.sleep(2)  # brief startup delay
        while self.running:
            try:
                db = SessionLocal()
                devices = db.query(Device).filter(Device.is_active == True).all()
                for dev in devices:
                    ip = dev.ip_address
                    if ip not in self.workers or not self.workers[ip].is_alive():
                        t = threading.Thread(
                            target=self._device_worker,
                            args=(dev.id, dev.ip_address, dev.port, dev.device_name),
                            daemon=True,
                            name=f"LiveWorker-{dev.device_name}"
                        )
                        self.workers[ip] = t
                        t.start()
                db.close()
            except Exception as e:
                logger.error(f"LiveSync supervisor error: {e}")
            time.sleep(4)

    def _device_worker(self, device_id: int, ip: str, port: int, device_name: str):
        """Dedicated persistent live event listener for a single eSSL device."""
        logger.info(f"[{device_name}] Live capture worker starting for {ip}:{port}...")
        while self.running:
            zk_client = None
            conn = None
            try:
                zk_client = ZK(ip, port=port, timeout=3, password=0, force_udp=False, ommit_ping=True)
                conn = zk_client.connect()
                logger.info(f"[{device_name}] Live socket connected on {ip}:{port}.")

                # Enter live_capture generator loop (1-second tick)
                for event in conn.live_capture(new_timeout=1):
                    if not self.running:
                        break
                    if event:
                        self._process_live_event(event, ip, device_name)

            except Exception as e:
                logger.warning(f"[{device_name}] Live socket note: {e}, reconnecting in 2s...")
                time.sleep(2)
            finally:
                if conn:
                    try:
                        conn.end_live_capture = True
                        conn.disconnect()
                    except Exception:
                        pass
                time.sleep(1)

    def _process_live_event(self, event, ip: str, device_name: str):
        """Handles an incoming punch event from device in real-time."""
        emp_code = str(event.user_id).strip()
        if not emp_code:
            return

        punch_time = event.timestamp
        punch_type = getattr(event, "status", 0) or 0
        verify_type = getattr(event, "punch", 1) or 1

        db = SessionLocal()
        try:
            # Skip live punch if this employee was deleted by administrator
            if db.query(DeletedEmployee).filter(DeletedEmployee.emp_code == emp_code).first():
                return

            # Check if punch already in DB
            exists = db.query(AttendancePunch).filter(
                AttendancePunch.emp_code == emp_code,
                AttendancePunch.timestamp == punch_time
            ).first()

            if not exists:
                emp = db.query(Employee).filter(Employee.emp_code == emp_code).first()
                if not emp:
                    emp = Employee(
                        emp_code=emp_code,
                        name=f"Employee {emp_code}",
                        department="General",
                        designation="Staff",
                        is_active=True
                    )
                    db.add(emp)
                    db.commit()

                emp_name = emp.name if emp else f"Employee {emp_code}"

                new_punch = AttendancePunch(
                    emp_code=emp_code,
                    timestamp=punch_time,
                    device_ip=ip,
                    punch_type=punch_type,
                    verify_type=verify_type
                )
                db.add(new_punch)
                db.commit()

                from app.database import get_active_db_info
                db_meta = get_active_db_info()
                now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

                self.last_db_sync_time = now_str
                self.total_punches_synced_session += 1

                # Safe secondary dual-sync: if active is Postgres, replicate punch to local SQLite backup
                if db_meta.get("is_postgres"):
                    try:
                        self._replicate_to_sqlite(emp_code, punch_time, ip, punch_type, verify_type)
                    except Exception as rep_err:
                        logger.debug(f"SQLite backup replication note: {rep_err}")

                # Instantly broadcast to browser
                punch_data = {
                    "type": "new_punch",
                    "emp_code": emp_code,
                    "name": emp_name,
                    "timestamp": punch_time.strftime("%Y-%m-%d %H:%M:%S"),
                    "time_str": punch_time.strftime("%H:%M:%S"),
                    "device": device_name,
                    "device_ip": ip,
                    "punch_type": punch_type,
                    "db_synced": True,
                    "db_target": db_meta["label"],
                    "db_dialect": db_meta["dialect"],
                    "sync_time": now_str,
                    "status": "Committed to DB"
                }
                self.last_punch_info = punch_data
                self.recent_synced_punches.insert(0, punch_data)
                if len(self.recent_synced_punches) > 30:
                    self.recent_synced_punches.pop()

                self.broadcast_punch(punch_data)

        except Exception as e:
            logger.error(f"[{device_name}] Error saving live punch: {e}")
            db.rollback()
        finally:
            db.close()

    def _replicate_to_sqlite(self, emp_code: str, punch_time: datetime, ip: str, punch_type: int, verify_type: int):
        """Mirrors the punch into local attendance.db so offline/fallback SQLite is always current."""
        import sqlite3
        from app.config import DATABASE_PATH
        conn = sqlite3.connect(DATABASE_PATH)
        try:
            cur = conn.cursor()
            cur.execute(
                "INSERT OR IGNORE INTO attendance_punches (emp_code, timestamp, device_ip, punch_type, verify_type) VALUES (?, ?, ?, ?, ?)",
                (emp_code, punch_time.strftime("%Y-%m-%d %H:%M:%S"), ip, punch_type, verify_type)
            )
            conn.commit()
        finally:
            conn.close()

    def _fast_catchup(self, conn, ip: str, device_name: str):
        """Catches up any punches that occurred in the last 20 minutes with bulk set checking."""
        try:
            db = SessionLocal()
            cutoff = datetime.now() - timedelta(minutes=20)
            existing = set(
                db.query(AttendancePunch.emp_code, AttendancePunch.timestamp)
                .filter(AttendancePunch.device_ip == ip, AttendancePunch.timestamp >= cutoff)
                .all()
            )

            records = conn.get_attendance()
            recent_recs = [r for r in records if r.timestamp >= cutoff]

            new_count = 0
            for r in recent_recs:
                ec = str(r.user_id).strip()
                if ec and (ec, r.timestamp) not in existing:
                    new_punch = AttendancePunch(
                        emp_code=ec,
                        timestamp=r.timestamp,
                        device_ip=ip,
                        punch_type=getattr(r, "status", 0) or 0,
                        verify_type=getattr(r, "punch", 1) or 1
                    )
                    db.add(new_punch)
                    existing.add((ec, r.timestamp))
                    new_count += 1

            if new_count > 0:
                db.commit()
                logger.info(f"[{device_name}] Fast catchup synced {new_count} recent punches.")
                self.broadcast_punch({
                    "type": "catchup_synced",
                    "device": device_name,
                    "count": new_count,
                    "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                })
            db.close()
        except Exception as e:
            logger.warning(f"[{device_name}] Fast catchup note: {e}")


live_manager = LiveSyncManager()
