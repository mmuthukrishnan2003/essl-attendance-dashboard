import os
import shutil
from pathlib import Path
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Setting
from app.schemas import SettingsUpdate
from app.config import UPLOADS_DIR
from app.scheduler import update_scheduler_interval

router = APIRouter(prefix="/api/settings", tags=["Settings"])


@router.get("")
def get_settings(db: Session = Depends(get_db)):
    """Retrieve all company branding and attendance calculation settings."""
    settings = db.query(Setting).all()
    res = {s.key: s.value for s in settings}
    return res


@router.put("")
def update_settings(payload: SettingsUpdate, db: Session = Depends(get_db)):
    """Update settings."""
    update_data = payload.dict(exclude_unset=True)

    for k, v in update_data.items():
        if v is not None:
            s = db.query(Setting).filter(Setting.key == k).first()
            if s:
                s.value = str(v)
            else:
                db.add(Setting(key=k, value=str(v)))

    db.commit()

    # If scheduler interval was changed, update it
    if "auto_sync_interval_mins" in update_data and update_data["auto_sync_interval_mins"]:
        try:
            update_scheduler_interval(int(update_data["auto_sync_interval_mins"]))
        except Exception:
            pass

    return {"message": "Settings updated successfully"}


@router.post("/logo")
async def upload_company_logo(file: UploadFile = File(...), db: Session = Depends(get_db)):
    """Upload custom company logo and set it in settings."""
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Uploaded file must be an image (PNG, JPG, SVG, WebP)")

    ext = Path(file.filename).suffix or ".png"
    target_filename = f"company_logo{ext}"
    target_path = UPLOADS_DIR / target_filename

    with open(target_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    logo_url = f"/static/uploads/{target_filename}"
    s = db.query(Setting).filter(Setting.key == "logo_path").first()
    if s:
        s.value = logo_url
    else:
        db.add(Setting(key="logo_path", value=logo_url))

    db.commit()

    return {
        "message": "Logo uploaded successfully",
        "logo_url": logo_url
    }

