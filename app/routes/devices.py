from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Device
from app.schemas import DeviceCreate, DeviceUpdate
from app.zk_service import test_device_connection, sync_device_punches, sync_all_active_devices

router = APIRouter(prefix="/api/devices", tags=["Devices"])


@router.get("")
def list_devices(db: Session = Depends(get_db)):
    """List all registered eSSL biometric devices with their latest status."""
    devices = db.query(Device).order_by(Device.id.asc()).all()
    return {
        "total": len(devices),
        "devices": [d.to_dict() for d in devices]
    }


@router.post("")
def add_device(payload: DeviceCreate, db: Session = Depends(get_db)):
    """Register a new eSSL biometric device."""
    existing = db.query(Device).filter(Device.ip_address == payload.ip_address.strip()).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Device with IP {payload.ip_address} is already registered")

    dev = Device(
        ip_address=payload.ip_address.strip(),
        port=payload.port,
        device_name=payload.device_name.strip(),
        device_model=payload.device_model.strip(),
        attendance_type=payload.attendance_type.strip(),
        is_active=payload.is_active,
        last_status="UNKNOWN"
    )
    db.add(dev)
    db.commit()
    db.refresh(dev)
    return {"message": "Device added successfully", "device": dev.to_dict()}


@router.put("/{device_id}")
def update_device(device_id: int, payload: DeviceUpdate, db: Session = Depends(get_db)):
    """Update device parameters (IP, Name, Port, Status)."""
    dev = db.query(Device).filter(Device.id == device_id).first()
    if not dev:
        raise HTTPException(status_code=404, detail="Device not found")

    if payload.ip_address is not None:
        dev.ip_address = payload.ip_address.strip()
    if payload.port is not None:
        dev.port = payload.port
    if payload.device_name is not None:
        dev.device_name = payload.device_name.strip()
    if payload.device_model is not None:
        dev.device_model = payload.device_model.strip()
    if payload.attendance_type is not None:
        dev.attendance_type = payload.attendance_type.strip()
    if payload.is_active is not None:
        dev.is_active = payload.is_active

    db.commit()
    db.refresh(dev)
    return {"message": "Device updated successfully", "device": dev.to_dict()}


@router.delete("/{device_id}")
def delete_device(device_id: int, db: Session = Depends(get_db)):
    """Delete a registered device."""
    dev = db.query(Device).filter(Device.id == device_id).first()
    if not dev:
        raise HTTPException(status_code=404, detail="Device not found")

    db.delete(dev)
    db.commit()
    return {"message": f"Device {dev.device_name} removed"}


@router.post("/{device_id}/test")
def test_connection(device_id: int, db: Session = Depends(get_db)):
    """
    Test connectivity (Ping and eSSL protocol probe) to the device.
    """
    dev = db.query(Device).filter(Device.id == device_id).first()
    if not dev:
        raise HTTPException(status_code=404, detail="Device not found")

    probe = test_device_connection(ip=dev.ip_address, port=dev.port)
    if probe["reachable"]:
        dev.last_status = "ONLINE"
        dev.last_error = None
    else:
        dev.last_status = "OFFLINE"
        dev.last_error = probe.get("error", "Unreachable")

    db.commit()
    return {
        "device_id": dev.id,
        "device_name": dev.device_name,
        "ip": dev.ip_address,
        "port": dev.port,
        "result": probe
    }


@router.post("/{device_id}/sync")
def sync_single_device(device_id: int, db: Session = Depends(get_db)):
    """
    Manually pulls attendance logs and user info from a specific device.
    """
    dev = db.query(Device).filter(Device.id == device_id).first()
    if not dev:
        raise HTTPException(status_code=404, detail="Device not found")

    report = sync_device_punches(dev, db)
    return report


@router.post("/sync-all")
def sync_all_devices(db: Session = Depends(get_db)):
    """
    Triggers immediate sync across all 4 registered eSSL devices.
    """
    report = sync_all_active_devices(db)
    return report


@router.post("/seed-demo")
def seed_demo_data_endpoint(db: Session = Depends(get_db)):
    """
    Seeds realistic sample employees and punches across the 4 devices
    to demonstrate calculations, reports, and UI immediately.
    """
    from seed_data import populate_sample_data
    result = populate_sample_data(db)
    return {"message": "Sample data populated successfully", "details": result}

