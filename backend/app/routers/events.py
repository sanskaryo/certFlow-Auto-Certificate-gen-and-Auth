import io
import os
import zipfile
from datetime import datetime
import logging
from typing import Any, List

logger = logging.getLogger(__name__)
import pandas as pd
from bson import ObjectId
from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from app.database import get_database
from app.models.event import EventCreate, EventOut
from app.routers.auth import get_current_user
from app.services.ai_service import generate_certificate_background
from app.services.certificate_service import (
    generate_single_manual_certificate,
    process_certificate_generation,
    template_catalog,
)
from app.services.email_service import send_certificate_email

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
    email: str = Field(default="")


class ParticipantEntry(BaseModel):
    name: str
    email: str = ""
    role: str = ""

class ManualBulkGenerateRequest(BaseModel):
    participants: List[ParticipantEntry]
    event_name: str = Field(..., min_length=2)
    organization: str = Field(..., min_length=2)
    date_text: str = Field(..., min_length=4)
    template_id: str = Field(default="classic-blue")


@router.get("/templates")
async def list_templates():
    return {"templates": template_catalog()}


@router.get("/", response_model=List[EventOut])
async def list_events(current_user: Any = Depends(get_current_user)) -> Any:
    logger.info(f"Fetching events for user {current_user.get('_id')}")
    user_id = str(current_user.get("_id"))
    db = get_database()
    cursor = db.events.find({"user_id": user_id})
    events = await cursor.to_list(length=100)
    for evt in events:
        evt["id"] = str(evt["_id"])
    return events


@router.get("/{event_id}", response_model=EventOut)
async def get_event(event_id: str, current_user: Any = Depends(get_current_user)) -> Any:
    db = get_database()
    if not ObjectId.is_valid(event_id):
        raise HTTPException(status_code=400, detail="Invalid event ID")
    event = await db.events.find_one({"_id": ObjectId(event_id)})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    # Check authorization
    if str(event.get("user_id")) != str(current_user.get("_id")):
        raise HTTPException(status_code=403, detail="Not authorized to access this event")
        
    event["id"] = str(event["_id"])
    return event


@router.post("/", response_model=EventOut)
async def create_event(event_in: EventCreate, current_user: Any = Depends(get_current_user)) -> Any:
    logger.info(f"Creating event '{event_in.name}' for user {current_user.get('_id')}")
    db = get_database()
    event_dict = event_in.model_dump()
    event_dict["user_id"] = str(current_user.get("_id"))
    event_dict["created_at"] = datetime.utcnow()
    
    # Generate AI background if description is provided
    if event_dict.get("description"):
        logger.info(f"Generating AI background for event based on description: {event_dict['description']}")
        try:
            # Event isn't in DB yet, but we can generate a temporary ID or use insert_one first
            result = await db.events.insert_one(event_dict)
            event_id = str(result.inserted_id)
            event_dict["id"] = event_id
            
            # Generate the image
            bg_path = generate_certificate_background(event_dict["description"], event_id)
            
            # Update the event with the template path
            await db.events.update_one({"_id": ObjectId(event_id)}, {"$set": {"template_path": bg_path, "template_id": "ai-generated"}})
            event_dict["template_path"] = bg_path
            event_dict["template_id"] = "ai-generated"
            return event_dict
        except Exception as e:
            logger.error(f"Failed to generate AI background: {e}")
            # If it fails, we still created the event, but we might want to return a warning
            pass
            return event_dict
            
    # Standard flow (no AI)
    result = await db.events.insert_one(event_dict)
    event_dict["id"] = str(result.inserted_id)
    return event_dict


@router.delete("/{event_id}")
async def delete_event(event_id: str, current_user: Any = Depends(get_current_user)):
    db = get_database()
    if not ObjectId.is_valid(event_id):
        raise HTTPException(status_code=400, detail="Invalid event ID")
    
    event = await db.events.find_one({"_id": ObjectId(event_id)})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
        
    if str(event.get("user_id")) != str(current_user.get("_id")):
        logger.warning(f"User {current_user.get('_id')} attempted to delete unauthorized event {event_id}")
        raise HTTPException(status_code=403, detail="Not authorized to delete this event")
        
    result = await db.events.delete_one({"_id": ObjectId(event_id)})
    if result.deleted_count == 1:
        await db.participants.delete_many({"event_id": event_id})
        await db.certificates.delete_many({"event_id": event_id})
        logger.info(f"Event {event_id} deleted successfully by user {current_user.get('_id')}")
        return {"message": "Event deleted successfully"}
    
    raise HTTPException(status_code=500, detail="Failed to delete event")

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

@router.post("/{event_id}/logo")
async def upload_logo(event_id: str, file: UploadFile = File(...), current_user: Any = Depends(get_current_user)):
    if not ObjectId.is_valid(event_id):
        raise HTTPException(status_code=400, detail="Invalid event ID")
    
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    file_path = os.path.abspath(os.path.join(UPLOAD_DIR, f"{event_id}_logo_{file.filename}"))
    with open(file_path, "wb") as f:
        f.write(await file.read())

    db = get_database()
    result = await db.events.update_one({"_id": ObjectId(event_id)}, {"$set": {"logo_path": file_path}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Event not found")
    return {"message": "Logo uploaded successfully", "logo_path": file_path}

@router.post("/{event_id}/signature")
async def upload_signature(event_id: str, file: UploadFile = File(...), current_user: Any = Depends(get_current_user)):
    if not ObjectId.is_valid(event_id):
        raise HTTPException(status_code=400, detail="Invalid event ID")
    
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    file_path = os.path.abspath(os.path.join(UPLOAD_DIR, f"{event_id}_sig_{file.filename}"))
    with open(file_path, "wb") as f:
        f.write(await file.read())

    db = get_database()
    result = await db.events.update_one({"_id": ObjectId(event_id)}, {"$set": {"signature_path": file_path}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Event not found")
    return {"message": "Signature uploaded successfully", "signature_path": file_path}

class EventAuthorityUpdate(BaseModel):
    authority_name: str
    authority_position: str

@router.patch("/{event_id}/authority")
async def update_authority(event_id: str, payload: EventAuthorityUpdate, current_user: Any = Depends(get_current_user)):
    if not ObjectId.is_valid(event_id):
        raise HTTPException(status_code=400, detail="Invalid event ID")
    
    db = get_database()
    result = await db.events.update_one(
        {"_id": ObjectId(event_id)}, 
        {"$set": {"authority_name": payload.authority_name, "authority_position": payload.authority_position}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Event not found")
    return {"message": "Authority updated successfully"}


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
        email=payload.email.strip() if payload.email else "",
    )
    return {"message": "Certificate generated", **result}


@router.post("/{event_id}/generate/manual-bulk")
async def generate_manual_bulk(event_id: str, payload: ManualBulkGenerateRequest, current_user: Any = Depends(get_current_user)):
    if not ObjectId.is_valid(event_id):
        raise HTTPException(status_code=400, detail="Invalid event ID")

    results = []
    if not payload.participants:
        raise HTTPException(status_code=400, detail="At least one participant entry is required")

    for p in payload.participants:
        generated = await generate_single_manual_certificate(
            event_id=event_id,
            participant_name=p.name.strip(),
            event_name=payload.event_name.strip(),
            organization=payload.organization.strip(),
            date_text=payload.date_text.strip(),
            template_id=payload.template_id.strip(),
            role=p.role.strip() if p.role else "",
            email=p.email.strip() if p.email else "",
        )
        results.append(generated)

    return {"message": f"Generated {len(results)} certificates", "certificates": results}


@router.post("/{event_id}/certificates/{cert_id}/send-email")
async def send_manual_email(event_id: str, cert_id: str, current_user: Any = Depends(get_current_user)):
    db = get_database()
    cert = await db.certificates.find_one({"id": cert_id, "event_id": event_id})
    if not cert:
        raise HTTPException(status_code=404, detail="Certificate not found")
    
    # Try to find user email in metadata or participants collection
    meta = cert.get("metadata", {})
    target_email = ""
    
    # Check if we have email in metadata or if we can find participant
    participant = await db.participants.find_one({"certificate_id": cert_id})
    if participant:
        target_email = participant.get("email", "")
    
    # Check metadata if participant collection failed
    if not target_email:
        target_email = meta.get("email", "")
    
    if not target_email:
         raise HTTPException(status_code=400, detail="No email address found for this certificate. Please ensure participant has an email.")

    event_name = meta.get("event_name", "Event")
    org = meta.get("organization", "Organization")
    subject = f"Your Certificate for {event_name}"
    body = f"Hello {cert['participant_name']},\n\nAttached is your certificate for {event_name}.\n\nBest regards,\n{org}"
    
    from app.services.email_service import send_certificate_email
    from app.services.email_service import send_certificate_email
    from app.core.config import settings
    
    if not settings.SMTP_HOST or not settings.SMTP_USER or not settings.SMTP_PASSWORD:
        raise HTTPException(
            status_code=400, 
            detail="SMTP is not configured. Please add SMTP_USER and SMTP_PASSWORD to your .env file."
        )

    success = await send_certificate_email(target_email, subject, body, cert["file_path"])
    
    if success:
        return {"message": f"Email sent to {target_email}"}
    else:
        raise HTTPException(status_code=500, detail="Failed to send email")


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
