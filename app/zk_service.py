import socket
import logging
from datetime import datetime
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

try:
    from zk import ZK
    from zk.exception import ZKError, ZKNetworkError
except ImportError:
    ZK = None
    ZKError = Exception
    ZKNetworkError = Exception

from app.models import Device, Employee, AttendancePunch

logger = logging.getLogger("essl_zk_service")
logging.basicConfig(level=logging.INFO)


def test_device_connection(ip: str, port: int = 4370, timeout: int = 3) -> Dict[str, Any]:
    """
    Performs a fast socket & pyzk probe to check if the eSSL biometric device is online.
    """
    result = {
        "ip": ip,
        "port": port,
        "reachable": False,
        "latency_ms": None,
        "device_info": {},
        "error": None
    }

    start_time = datetime.now()
    # 1. Quick TCP socket probe
    tcp_ok = False
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(timeout)
        check = sock.connect_ex((ip, port))
        sock.close()
        if check == 0:
            tcp_ok = True
    except Exception as e:
        logger.debug(f"TCP probe failed for {ip}: {e}")

    # 2. Try pyzk protocol connection (TCP and UDP with ommit_ping=True)
    if ZK is not None:
        conn = None
        for force_udp in [False, True]:
            try:
                zk_client = ZK(
                    ip,
                    port=port,
                    timeout=timeout,
                    password=0,
                    force_udp=force_udp,
                    ommit_ping=True,
                    verbose=False
                )
                conn = zk_client.connect()
                if conn:
                    result["reachable"] = True
                    elapsed = (datetime.now() - start_time).total_seconds() * 1000
                    result["latency_ms"] = round(elapsed, 1)
                    try:
                        result["device_info"] = {
                            "name": conn.get_device_name() or "eSSL Biometric",
                            "serial": conn.get_serialnumber() or "Unknown",
                            "firmware": conn.get_firmware_version() or "Unknown",
                            "protocol": "UDP" if force_udp else "TCP"
                        }
                    except Exception:
                        pass
                    conn.disconnect()
                    return result
            except Exception as e:
                result["error"] = str(e)
            finally:
                if conn:
                    try:
                        conn.disconnect()
                    except Exception:
                        pass

    if tcp_ok:
        result["reachable"] = True
        elapsed = (datetime.now() - start_time).total_seconds() * 1000
        result["latency_ms"] = round(elapsed, 1)
        result["device_info"] = {"protocol": "TCP"}
        result["error"] = None
        return result

    if not result["error"]:
        result["error"] = f"Device at {ip}:{port} did not respond within {timeout}s"
    return result


def sync_device_punches(device: Device, db: Session) -> Dict[str, Any]:
    """
    Connects to a single eSSL device, pulls all attendance logs,
    and inserts non-duplicate records into the database.
    """
    sync_report = {
        "device_id": device.id,
        "ip": device.ip_address,
        "name": device.device_name,
        "status": "FAILED",
        "synced_count": 0,
        "total_on_device": 0,
        "new_users_found": 0,
        "error": None
    }

    if not ZK:
        sync_report["error"] = "pyzk library not available"
        device.last_status = "ERROR"
        device.last_error = sync_report["error"]
        db.commit()
        return sync_report

    zk_client = None
    conn = None

    # Try TCP first, then UDP
    connected = False
    for force_udp in [False, True]:
        try:
            zk_client = ZK(
                device.ip_address,
                port=device.port,
                timeout=5,
                password=0,
                force_udp=force_udp,
                ommit_ping=True
            )
            conn = zk_client.connect()
            if conn:
                connected = True
                break
        except Exception as e:
            logger.warning(f"Connection attempt to {device.ip_address} (UDP={force_udp}) failed: {e}")

    if not connected or not conn:
        sync_report["error"] = f"Unable to reach device at {device.ip_address}:{device.port}"
        device.last_status = "OFFLINE"
        device.last_error = sync_report["error"]
        db.commit()
        return sync_report

    try:
        # Step 1: Sync Users registered on device (if any are missing locally)
        try:
            device_users = conn.get_users()
            for u in device_users:
                u_id = str(u.user_id).strip()
                if not u_id:
                    continue
                existing_emp = db.query(Employee).filter(Employee.emp_code == u_id).first()
                if not existing_emp:
                    emp_name = (u.name.strip() if hasattr(u, "name") and u.name else f"Employee {u_id}")
                    card = str(u.card) if hasattr(u, "card") and u.card else None
                    new_emp = Employee(
                        emp_code=u_id,
                        name=emp_name,
                        department="General",
                        designation="Staff",
                        card_number=card,
                        is_active=True
                    )
                    db.add(new_emp)
                    sync_report["new_users_found"] += 1
            if sync_report["new_users_found"] > 0:
                db.commit()
        except Exception as ue:
            logger.warning(f"Could not read users from {device.ip_address}: {ue}")

        # Step 2: Fetch Attendance Records
        records = conn.get_attendance()
        sync_report["total_on_device"] = len(records)

        # Step 3: Insert only unique punches
        new_punches_count = 0
        for rec in records:
            emp_code = str(rec.user_id).strip()
            if not emp_code:
                continue

            # Ensure employee exists in db (auto-create if new ID punched)
            emp = db.query(Employee).filter(Employee.emp_code == emp_code).first()
            if not emp:
                emp = Employee(
                    emp_code=emp_code,
                    name=f"Employee {emp_code}",
                    department="General",
                    designation="Staff"
                )
                db.add(emp)
                db.flush()

            punch_time = rec.timestamp
            punch_type = getattr(rec, "status", 0) or 0
            verify_type = getattr(rec, "punch", 1) or 1

            # Check if this punch already exists
            exists = db.query(AttendancePunch).filter(
                AttendancePunch.emp_code == emp_code,
                AttendancePunch.timestamp == punch_time
            ).first()

            if not exists:
                new_punch = AttendancePunch(
                    emp_code=emp_code,
                    timestamp=punch_time,
                    device_ip=device.ip_address,
                    punch_type=punch_type,
                    verify_type=verify_type
                )
                db.add(new_punch)
                new_punches_count += 1

        db.commit()

        # Update Device status and statistics
        device.last_status = "ONLINE"
        device.last_sync_time = datetime.now()
        device.last_error = None
        device.total_punches_synced = (device.total_punches_synced or 0) + new_punches_count
        db.commit()

        if new_punches_count > 0:
            try:
                from app.live_sync import live_manager
                live_manager.record_bulk_sync(new_punches_count, device.device_name)
            except Exception:
                pass

        sync_report["status"] = "SUCCESS"
        sync_report["synced_count"] = new_punches_count
        return sync_report

    except Exception as e:
        db.rollback()
        sync_report["error"] = str(e)
        device.last_status = "ERROR"
        device.last_error = str(e)
        db.commit()
        return sync_report
    finally:
        if conn:
            try:
                conn.disconnect()
            except Exception:
                pass


def sync_all_active_devices(db: Session) -> Dict[str, Any]:
    """
    Syncs all 4 eSSL devices registered and active in the database.
    """
    devices = db.query(Device).filter(Device.is_active == True).all()
    results = []
    total_synced = 0
    total_users_added = 0
    success_count = 0

    for dev in devices:
        res = sync_device_punches(dev, db)
        results.append(res)
        if res["status"] == "SUCCESS":
            success_count += 1
            total_synced += res["synced_count"]
            total_users_added += res["new_users_found"]

    return {
        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "total_devices": len(devices),
        "success_devices": success_count,
        "failed_devices": len(devices) - success_count,
        "total_new_punches": total_synced,
        "total_new_users": total_users_added,
        "details": results
    }

