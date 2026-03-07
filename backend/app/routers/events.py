import io
import os
import zipfile
from datetime import datetime
from typing import Any, List

import pandas as pd
from bson import ObjectId
from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from app.database import get_database
from app.models.event import EventCreate, EventOut
from app.routers.auth import get_current_user
from app.services.certificate_service import (
    generate_single_manual_certificate,
    process_certificate_generation,
    template_catalog,
)

router = APIRouter(prefix="/events", tags=["events"])

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)


class ManualGenerateRequest(BaseModel):
    participant_name: str = Field(..., min_length=2)
    event_name: str = Field(..., min_length=2)
    organization: str = Field(..., min_length=2)
    date_text: str = Field(..., min_length=4)
    template_id: str = Field(default="classic-blue")
    role: str = Field(default="")


class ManualBulkGenerateRequest(BaseModel):
    participant_names: List[str] = Field(..., min_length=1)
    event_name: str = Field(..., min_length=2)
    organization: str = Field(..., min_length=2)
    date_text: str = Field(..., min_length=4)
    template_id: str = Field(default="classic-blue")
    role: str = Field(default="")


@router.get("/templates")
async def list_templates():
    return {"templates": template_catalog()}


@router.get("/", response_model=List[EventOut])
async def list_events(current_user: Any = Depends(get_current_user)) -> Any:
    user_id = str(current_user.get("_id"))
    db = get_database()
    cursor = db.events.find({"user_id": user_id})
    events = await cursor.to_list(length=100)
    for evt in events:
        evt["id"] = str(evt["_id"])
    return events


@router.post("/", response_model=EventOut)
async def create_event(event_in: EventCreate, current_user: Any = Depends(get_current_user)) -> Any:
    db = get_database()
    event_dict = event_in.model_dump()
    event_dict["user_id"] = str(current_user.get("_id"))
    event_dict["created_at"] = datetime.utcnow()
    result = await db.events.insert_one(event_dict)
    event_dict["id"] = str(result.inserted_id)
    return event_dict


@router.post("/{event_id}/template")
async def upload_template(event_id: str, file: UploadFile = File(...), current_user: Any = Depends(get_current_user)):
    if not ObjectId.is_valid(event_id):
        raise HTTPException(status_code=400, detail="Invalid event ID")
    file_path = os.path.join(UPLOAD_DIR, f"{event_id}_template_{file.filename}")
    with open(file_path, "wb") as f:
        f.write(await file.read())

    db = get_database()
    result = await db.events.update_one({"_id": ObjectId(event_id)}, {"$set": {"template_path": file_path}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Event not found")
    return {"message": "Template uploaded successfully", "template_path": file_path}


@router.post("/{event_id}/participants")
async def upload_participants(event_id: str, file: UploadFile = File(...), current_user: Any = Depends(get_current_user)):
    db = get_database()
    if not ObjectId.is_valid(event_id):
        raise HTTPException(status_code=400, detail="Invalid event ID")

    contents = await file.read()
    try:
        df = pd.read_csv(io.BytesIO(contents))
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid CSV format")

    df.columns = df.columns.astype(str).str.lower().str.strip()
    required_cols = {"name", "email"}
    if not required_cols.issubset(set(df.columns)):
        raise HTTPException(status_code=400, detail="CSV must contain 'name' and 'email' columns")

    participants = []
    for _, row in df.iterrows():
        participants.append(
            {
                "event_id": event_id,
                "name": str(row["name"]).strip(),
                "email": str(row["email"]).strip(),
                "position": str(row.get("position", "")).strip(),
                "status": "pending",
            }
        )

    if participants:
        await db.participants.insert_many(participants)
    return {"message": f"Successfully uploaded {len(participants)} participants"}


@router.post("/{event_id}/generate/manual")
async def generate_manual_certificate(event_id: str, payload: ManualGenerateRequest, current_user: Any = Depends(get_current_user)):
    if not ObjectId.is_valid(event_id):
        raise HTTPException(status_code=400, detail="Invalid event ID")
    result = await generate_single_manual_certificate(
        event_id=event_id,
        participant_name=payload.participant_name.strip(),
        event_name=payload.event_name.strip(),
        organization=payload.organization.strip(),
        date_text=payload.date_text.strip(),
        template_id=payload.template_id.strip(),
        role=payload.role.strip(),
    )
    return {"message": "Certificate generated", **result}


@router.post("/{event_id}/generate/manual-bulk")
async def generate_manual_bulk(event_id: str, payload: ManualBulkGenerateRequest, current_user: Any = Depends(get_current_user)):
    if not ObjectId.is_valid(event_id):
        raise HTTPException(status_code=400, detail="Invalid event ID")

    results = []
    cleaned_names = [n.strip() for n in payload.participant_names if n.strip()]
    if not cleaned_names:
        raise HTTPException(status_code=400, detail="At least one participant name is required")

    for name in cleaned_names:
        generated = await generate_single_manual_certificate(
            event_id=event_id,
            participant_name=name,
            event_name=payload.event_name.strip(),
            organization=payload.organization.strip(),
            date_text=payload.date_text.strip(),
            template_id=payload.template_id.strip(),
            role=payload.role.strip(),
        )
        results.append(generated)

    return {"message": f"Generated {len(results)} certificates", "certificates": results}


@router.post("/{event_id}/generate")
async def generate_certificates(event_id: str, background_tasks: BackgroundTasks, current_user: Any = Depends(get_current_user)):
    db = get_database()
    if not ObjectId.is_valid(event_id):
        raise HTTPException(status_code=400, detail="Invalid event ID")
    event = await db.events.find_one({"_id": ObjectId(event_id)})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    if "template_path" not in event:
        raise HTTPException(status_code=400, detail="Please upload a template first")
    background_tasks.add_task(process_certificate_generation, event_id)
    return {"message": "Certificate generation started in background"}


@router.get("/{event_id}/download")
async def download_certificates(event_id: str, current_user: Any = Depends(get_current_user)):
    db = get_database()
    cursor = db.certificates.find({"event_id": event_id})
    certs = await cursor.to_list(length=None)
    if not certs:
        raise HTTPException(status_code=404, detail="No certificates generated yet")

    zip_filename = f"event_{event_id}_certificates.zip"
    zip_path = os.path.join(UPLOAD_DIR, zip_filename)
    with zipfile.ZipFile(zip_path, "w") as zipf:
        for cert in certs:
            file_path = cert.get("file_path")
            if file_path and os.path.exists(file_path):
                zipf.write(file_path, os.path.basename(file_path))
    return FileResponse(zip_path, media_type="application/zip", filename=zip_filename)
