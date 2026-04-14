import io
import os
import zipfile
import aiohttp
from datetime import datetime
import logging
from typing import Any, List, Optional
import hashlib
import secrets
from PIL import Image, ImageOps

logger = logging.getLogger(__name__)
import pandas as pd
from bson import ObjectId
from fastapi import APIRouter, BackgroundTasks, Depends, File, Header, HTTPException, UploadFile, Query
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


class AITemplateRequest(BaseModel):
    prompt: str


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
    event_name: str = Field(default="")
    organization: str = Field(default="")
    date_text: str = Field(default="")
    template_id: str = Field(default="classic-blue")


class TeamMemberCreate(BaseModel):
    email: str
    role: str = Field(default="viewer")


class TeamMemberUpdate(BaseModel):
    role: str


class APIIssueRequest(BaseModel):
    participant_name: str
    event_name: str
    organization: str
    date_text: str
    role: str = ""
    email: str = ""
    template_id: str = "classic-blue"


def _hash_api_key(raw_key: str) -> str:
    return hashlib.sha256(raw_key.encode()).hexdigest()


async def _get_event_or_404(event_id: str):
    if not ObjectId.is_valid(event_id):
        raise HTTPException(status_code=400, detail="Invalid event ID")
    db = get_database()
    event = await db.events.find_one({"_id": ObjectId(event_id)})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    return event


async def _get_event_role(db, event_id: str, current_user: Any) -> str | None:
    if str(current_user.get("_id")) == str((await db.events.find_one({"_id": ObjectId(event_id)})).get("user_id")):
        return "admin"
    team = await db.team_members.find_one({"event_id": event_id, "member_user_id": str(current_user.get("_id"))})
    return team.get("role") if team else None


def _role_allows(role: str | None, allowed: set[str]) -> bool:
    if role == "admin":
        return True
    return role in allowed


async def _require_event_access(event_id: str, current_user: Any, allowed: set[str]) -> tuple[dict, str]:
    db = get_database()
    event = await _get_event_or_404(event_id)

    if str(event.get("user_id")) == str(current_user.get("_id")):
        return event, "admin"

    team = await db.team_members.find_one({"event_id": event_id, "member_user_id": str(current_user.get("_id"))})
    team_role = team.get("role") if team else None
    if not _role_allows(team_role, allowed):
        raise HTTPException(status_code=403, detail="Not authorized for this event")
    return event, team_role


async def _track_cert_event(cert_id: str, event_type: str, source: str = "app"):
    db = get_database()
    await db.certificate_events.insert_one(
        {
            "cert_id": cert_id,
            "event_type": event_type,
            "source": source,
            "created_at": datetime.utcnow(),
        }
    )


@router.get("/templates")
async def list_templates():
    return {"templates": template_catalog()}


@router.get("/", response_model=List[EventOut])
async def list_events(current_user: Any = Depends(get_current_user)) -> Any:
    logger.info(f"Fetching events for user {current_user.get('_id')}")
    user_id = str(current_user.get("_id"))
    db = get_database()

    own_events = await db.events.find({"user_id": user_id}).to_list(length=100)
    team_memberships = await db.team_members.find({"member_user_id": user_id}).to_list(length=200)
    team_event_ids = [m["event_id"] for m in team_memberships]
    team_events = []
    if team_event_ids:
        team_events = await db.events.find({"_id": {"$in": [ObjectId(eid) for eid in team_event_ids if ObjectId.is_valid(eid)]}}).to_list(length=200)

    merged = {str(evt["_id"]): evt for evt in own_events + team_events}
    events = list(merged.values())
    for evt in events:
        evt["id"] = str(evt["_id"])
    return events


@router.get("/{event_id}", response_model=EventOut)
async def get_event(event_id: str, current_user: Any = Depends(get_current_user)) -> Any:
    event, _ = await _require_event_access(event_id, current_user, {"issuer", "viewer"})
    event["id"] = str(event["_id"])
    return event


@router.post("/", response_model=EventOut)
async def create_event(event_in: EventCreate, current_user: Any = Depends(get_current_user)) -> Any:
    logger.info(f"Creating event '{event_in.name}' for user {current_user.get('_id')}")
    db = get_database()
    event_dict = event_in.model_dump()
    event_dict["user_id"] = str(current_user.get("_id"))
    event_dict["created_at"] = datetime.utcnow()

    if event_dict.get("description"):
        logger.info(f"Generating AI background for event based on description: {event_dict['description']}")
        try:
            result = await db.events.insert_one(event_dict)
            event_id = str(result.inserted_id)
            event_dict["id"] = event_id
            bg_path = generate_certificate_background(event_dict["description"], event_id)
            await db.events.update_one({"_id": ObjectId(event_id)}, {"$set": {"template_path": bg_path, "template_id": "ai-generated"}})
            event_dict["template_path"] = bg_path
            event_dict["template_id"] = "ai-generated"
            return event_dict
        except Exception as e:
            logger.error(f"Failed to generate AI background: {e}")
            return event_dict

    result = await db.events.insert_one(event_dict)
    event_dict["id"] = str(result.inserted_id)
    return event_dict


@router.delete("/{event_id}")
async def delete_event(event_id: str, current_user: Any = Depends(get_current_user)):
    event, role = await _require_event_access(event_id, current_user, {"issuer", "viewer"})
    if role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can delete events")

    db = get_database()
    result = await db.events.delete_one({"_id": ObjectId(event_id)})
    if result.deleted_count == 1:
        await db.participants.delete_many({"event_id": event_id})
        await db.certificates.delete_many({"event_id": event_id})
        await db.team_members.delete_many({"event_id": event_id})
        await db.api_keys.delete_many({"event_id": event_id})
        logger.info(f"Event {event_id} deleted successfully by user {current_user.get('_id')}")
        return {"message": "Event deleted successfully"}

    raise HTTPException(status_code=500, detail="Failed to delete event")


@router.post("/{event_id}/template")
async def upload_template(event_id: str, file: UploadFile = File(...), current_user: Any = Depends(get_current_user)):
    await _require_event_access(event_id, current_user, {"issuer"})
    file_path = os.path.join(UPLOAD_DIR, f"{event_id}_template_{file.filename}")
    with open(file_path, "wb") as f:
        f.write(await file.read())

    db = get_database()
    result = await db.events.update_one({"_id": ObjectId(event_id)}, {"$set": {"template_path": file_path}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Event not found")
    return {"message": "Template uploaded successfully", "template_path": file_path}


@router.post("/{event_id}/ai-template")
async def generate_ai_template_endpoint(event_id: str, payload: AITemplateRequest, current_user: Any = Depends(get_current_user)):
    await _require_event_access(event_id, current_user, {"issuer"})
    db = get_database()

    try:
        bg_path = generate_certificate_background(payload.prompt, event_id)
        await db.events.update_one({"_id": ObjectId(event_id)}, {"$set": {"template_path": bg_path, "template_id": "ai-generated"}})
        return {"message": "AI Template generated successfully", "template_path": bg_path}
    except Exception as e:
        logger.error(f"Failed to generate AI background: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate AI template: {str(e)}")


@router.post("/{event_id}/logo")
async def upload_logo(
    event_id: str, 
    file: UploadFile = File(...), 
    key: Optional[str] = "logo_path", 
    current_user: Any = Depends(get_current_user)
):
    await _require_event_access(event_id, current_user, {"issuer"})

    os.makedirs(UPLOAD_DIR, exist_ok=True)
    file_path = os.path.abspath(os.path.join(UPLOAD_DIR, f"{event_id}_{key}_{file.filename}"))
    with open(file_path, "wb") as f:
        f.write(await file.read())

    db = get_database()
    if key == "logo_path":
        update = {"logo_path": file_path}
    else:
        update = {f"additional_logos.{key}": file_path}
    
    result = await db.events.update_one({"_id": ObjectId(event_id)}, {"$set": update})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Event not found")
    return {"message": "Logo uploaded successfully", "logo_path": file_path, "key": key}


@router.post("/{event_id}/signature")
async def upload_signature(
    event_id: str, 
    file: UploadFile = File(...), 
    key: Optional[str] = "signature_path",
    current_user: Any = Depends(get_current_user)
):
    await _require_event_access(event_id, current_user, {"issuer"})

    os.makedirs(UPLOAD_DIR, exist_ok=True)
    raw_bytes = await file.read()
    processed_bytes = raw_bytes
    ext = file.filename.split('.')[-1].lower() if '.' in file.filename else 'png'

    try:
        from PIL import Image, ImageChops
        img = Image.open(io.BytesIO(raw_bytes)).convert("RGBA")
        
        # 1. White to transparent
        datas = img.getdata()
        new_data = []
        for item in datas:
            # if almost white, make transparent
            if item[0] > 220 and item[1] > 220 and item[2] > 220:
                new_data.append((255, 255, 255, 0))
            else:
                new_data.append(item)
        img.putdata(new_data)
        
        # 2. Auto-crop whitespace
        bg = Image.new("RGBA", img.size, (255, 255, 255, 0))
        diff = ImageChops.difference(img, bg)
        bbox = diff.getbbox()
        if bbox:
            img = img.crop(bbox)
            
        out = io.BytesIO()
        img.save(out, format="PNG")
        processed_bytes = out.getvalue()
        ext = "png"
    except Exception as e:
        logger.error(f"Failed to process signature transparency: {e}")

    file_path = os.path.abspath(os.path.join(UPLOAD_DIR, f"{event_id}_{key}_processed.{ext}"))
    with open(file_path, "wb") as f:
        f.write(processed_bytes)

    db = get_database()
    if key == "signature_path":
        update = {"signature_path": file_path}
    else:
        update = {f"additional_signatures.{key}": file_path}

    result = await db.events.update_one({"_id": ObjectId(event_id)}, {"$set": update})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Event not found")
    return {"message": "Signature uploaded successfully", "signature_path": file_path, "key": key}


class EventAuthorityUpdate(BaseModel):
    authority_name: str
    authority_position: str


@router.patch("/{event_id}/authority")
async def update_authority(event_id: str, payload: EventAuthorityUpdate, current_user: Any = Depends(get_current_user)):
    await _require_event_access(event_id, current_user, {"issuer"})

    db = get_database()
    result = await db.events.update_one(
        {"_id": ObjectId(event_id)},
        {"$set": {"authority_name": payload.authority_name, "authority_position": payload.authority_position}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Event not found")
    return {"message": "Authority updated successfully"}


class LogoPositionUpdate(BaseModel):
    x: float = Field(..., ge=0, le=1, description="X position as fraction of certificate width (0=left, 1=right)")
    y: float = Field(..., ge=0, le=1, description="Y position as fraction of certificate height (0=bottom, 1=top)")
    size: float = Field(default=0.25, ge=0.05, le=0.8, description="Logo size as fraction of certificate width")
    shape: str = Field(default="rectangle", description="Logo frame shape: rectangle, rounded, circle, oval")


@router.patch("/{event_id}/logo-position")
async def update_logo_position(event_id: str, payload: LogoPositionUpdate, current_user: Any = Depends(get_current_user)):
    await _require_event_access(event_id, current_user, {"issuer"})
    db = get_database()
    result = await db.events.update_one(
        {"_id": ObjectId(event_id)},
        {"$set": {"logo_position": {"x": payload.x, "y": payload.y, "size": payload.size, "shape": payload.shape}}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Event not found")
    return {"message": "Logo position saved"}


class CertificateLayoutUpdate(BaseModel):
    certificate_layout: dict | None = None
    logo_position: dict | None = None


@router.patch("/{event_id}/certificate-layout")
async def update_certificate_layout(
    event_id: str,
    payload: CertificateLayoutUpdate,
    current_user: Any = Depends(get_current_user),
):
    await _require_event_access(event_id, current_user, {"issuer"})
    update_doc: dict = {}
    if payload.certificate_layout is not None:
        update_doc["certificate_layout"] = payload.certificate_layout
    if payload.logo_position is not None:
        update_doc["logo_position"] = payload.logo_position
    if not update_doc:
        raise HTTPException(status_code=400, detail="Nothing to update")
    db = get_database()
    result = await db.events.update_one({"_id": ObjectId(event_id)}, {"$set": update_doc})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Event not found")
    return {"message": "Certificate layout saved"}


@router.post("/{event_id}/participants")
async def upload_participants(event_id: str, file: UploadFile = File(...), current_user: Any = Depends(get_current_user)):
    await _require_event_access(event_id, current_user, {"issuer"})
    db = get_database()

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
    await _require_event_access(event_id, current_user, {"issuer"})
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
    await _track_cert_event(result["certificate_id"], "issued", "manual")
    return {"message": "Certificate generated", **result}


@router.post("/{event_id}/generate/manual-bulk")
async def generate_manual_bulk(event_id: str, payload: ManualBulkGenerateRequest, current_user: Any = Depends(get_current_user)):
    event, _ = await _require_event_access(event_id, current_user, {"issuer"})

    if not payload.participants:
        raise HTTPException(status_code=400, detail="At least one participant entry is required")

    # Fill in missing fields from the stored event document
    event_name = payload.event_name.strip() or event.get("name", "Event")
    organization = payload.organization.strip() or event.get("organization", "Organization")
    date_text = payload.date_text.strip() or event.get("date_text", datetime.utcnow().strftime("%Y-%m-%d"))
    template_id = (payload.template_id or event.get("template_id") or "classic-blue").strip()

    results = []
    for p in payload.participants:
        generated = await generate_single_manual_certificate(
            event_id=event_id,
            participant_name=p.name.strip(),
            event_name=event_name,
            organization=organization,
            date_text=date_text,
            template_id=template_id,
            role=p.role.strip() if p.role else "",
            email=p.email.strip() if p.email else "",
        )
        await _track_cert_event(generated["certificate_id"], "issued", "manual-bulk")
        results.append(generated)

    return {"message": f"Generated {len(results)} certificates", "certificates": results}


@router.post("/{event_id}/generate/api")
async def generate_via_api(event_id: str, payload: APIIssueRequest, x_api_key: str = Header(default="")):
    db = get_database()
    if not x_api_key:
        raise HTTPException(status_code=401, detail="Missing API key")

    key_hash = _hash_api_key(x_api_key)
    key_doc = await db.api_keys.find_one({"event_id": event_id, "key_hash": key_hash, "is_active": True})
    if not key_doc:
        raise HTTPException(status_code=401, detail="Invalid API key")

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
    await _track_cert_event(result["certificate_id"], "issued", "api")
    return {"message": "Certificate generated", **result}


@router.post("/{event_id}/certificates/{cert_id}/send-email")
async def send_manual_email(event_id: str, cert_id: str, current_user: Any = Depends(get_current_user)):
    await _require_event_access(event_id, current_user, {"issuer"})
    db = get_database()
    cert = await db.certificates.find_one({"id": cert_id, "event_id": event_id})
    if not cert:
        raise HTTPException(status_code=404, detail="Certificate not found")

    meta = cert.get("metadata", {})
    target_email = ""

    participant = await db.participants.find_one({"certificate_id": cert_id})
    if participant:
        target_email = participant.get("email", "")

    if not target_email:
        target_email = meta.get("email", "")

    if not target_email:
        raise HTTPException(status_code=400, detail="No email address found for this certificate. Please ensure participant has an email.")

    event_name = meta.get("event_name", "Event")
    org = meta.get("organization", "Organization")
    subject = f"Your Certificate for {event_name}"
    body = f"Hello {cert['participant_name']},\n\nAttached is your certificate for {event_name}.\n\nBest regards,\n{org}"

    from app.core.config import settings

    if not settings.SMTP_HOST or not settings.SMTP_USER or not settings.SMTP_PASSWORD:
        raise HTTPException(
            status_code=400,
            detail="SMTP is not configured. Please add SMTP_USER and SMTP_PASSWORD to your .env file.",
        )

    from app.services.certificate_service import _verify_base_url
    verify_url = _verify_base_url() + cert_id

    success = await send_certificate_email(
        target_email, subject, body, cert["file_path"],
        participant_name=cert.get("participant_name", ""),
        event_name=event_name,
        organization=org,
        date_text=meta.get("date_text", ""),
        role=meta.get("role", ""),
        verify_url=verify_url,
    )

    if success:
        await _track_cert_event(cert_id, "emailed", "manual")
        return {"message": f"Email sent to {target_email}"}

    raise HTTPException(status_code=500, detail="Failed to send email")


@router.post("/{event_id}/generate")
async def generate_certificates(event_id: str, background_tasks: BackgroundTasks, current_user: Any = Depends(get_current_user)):
    event, _ = await _require_event_access(event_id, current_user, {"issuer"})
    if "template_path" not in event:
        raise HTTPException(status_code=400, detail="Please upload a template first")
    background_tasks.add_task(process_certificate_generation, event_id)
    return {"message": "Certificate generation started in background"}


@router.get("/{event_id}/certificates/{cert_id}/download")
async def download_single_certificate(event_id: str, cert_id: str, current_user: Any = Depends(get_current_user)):
    await _require_event_access(event_id, current_user, {"issuer", "viewer"})
    db = get_database()
    cert = await db.certificates.find_one({"id": cert_id, "event_id": event_id})
    if not cert:
        raise HTTPException(status_code=404, detail="Certificate not found")

    file_path = cert.get("file_path")
    if not file_path or not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Certificate file not found on server. It may have been deleted.")

    participant_name = cert.get("participant_name", "certificate").replace(" ", "_")
    filename = f"{participant_name}_{cert_id[:8]}.pdf"
    return FileResponse(
        file_path,
        media_type="application/pdf",
        filename=filename,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/{event_id}/download")
async def download_certificates(event_id: str, current_user: Any = Depends(get_current_user)):
    await _require_event_access(event_id, current_user, {"issuer", "viewer"})
    db = get_database()
    cursor = db.certificates.find({"event_id": event_id})
    certs = await cursor.to_list(length=None)
    if not certs:
        raise HTTPException(status_code=404, detail="No certificates generated yet")

    zip_filename = f"event_{event_id}_certificates.zip"
    zip_path = os.path.join(UPLOAD_DIR, zip_filename)
    added = 0
    with zipfile.ZipFile(zip_path, "w") as zipf:
        for cert in certs:
            file_path = cert.get("file_path")
            if file_path and os.path.exists(file_path):
                zipf.write(file_path, os.path.basename(file_path))
                added += 1
    if added == 0:
        raise HTTPException(status_code=404, detail="Certificate files not found on server.")
    return FileResponse(zip_path, media_type="application/zip", filename=zip_filename)



@router.get("/{event_id}/team")
async def get_team(event_id: str, current_user: Any = Depends(get_current_user)):
    await _require_event_access(event_id, current_user, {"issuer", "viewer"})
    db = get_database()
    team_docs = await db.team_members.find({"event_id": event_id}).to_list(length=200)
    user_ids = [ObjectId(t["member_user_id"]) for t in team_docs if ObjectId.is_valid(t["member_user_id"])]
    users = await db.users.find({"_id": {"$in": user_ids}}).to_list(length=200) if user_ids else []
    by_id = {str(u["_id"]): u for u in users}

    out = []
    for t in team_docs:
        u = by_id.get(t["member_user_id"], {})
        out.append(
            {
                "member_user_id": t["member_user_id"],
                "role": t.get("role", "viewer"),
                "name": u.get("name", "Unknown"),
                "email": u.get("email", ""),
            }
        )
    return {"team": out}


@router.post("/{event_id}/team")
async def add_team_member(event_id: str, payload: TeamMemberCreate, current_user: Any = Depends(get_current_user)):
    _, role = await _require_event_access(event_id, current_user, {"issuer", "viewer"})
    if role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can manage team")

    db = get_database()
    user = await db.users.find_one({"email": payload.email})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    team_role = payload.role if payload.role in {"admin", "issuer", "viewer"} else "viewer"
    await db.team_members.update_one(
        {"event_id": event_id, "member_user_id": str(user["_id"])},
        {"$set": {"role": team_role, "updated_at": datetime.utcnow()}, "$setOnInsert": {"created_at": datetime.utcnow()}},
        upsert=True,
    )
    return {"message": "Team member added"}


@router.patch("/{event_id}/team/{member_user_id}")
async def update_team_member(event_id: str, member_user_id: str, payload: TeamMemberUpdate, current_user: Any = Depends(get_current_user)):
    _, role = await _require_event_access(event_id, current_user, {"issuer", "viewer"})
    if role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can manage team")

    if payload.role not in {"admin", "issuer", "viewer"}:
        raise HTTPException(status_code=400, detail="Invalid role")

    db = get_database()
    result = await db.team_members.update_one(
        {"event_id": event_id, "member_user_id": member_user_id},
        {"$set": {"role": payload.role, "updated_at": datetime.utcnow()}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Team member not found")
    return {"message": "Team member updated"}


@router.delete("/{event_id}/team/{member_user_id}")
async def remove_team_member(event_id: str, member_user_id: str, current_user: Any = Depends(get_current_user)):
    _, role = await _require_event_access(event_id, current_user, {"issuer", "viewer"})
    if role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can manage team")

    db = get_database()
    await db.team_members.delete_one({"event_id": event_id, "member_user_id": member_user_id})
    return {"message": "Team member removed"}


@router.post("/{event_id}/api-keys")
async def create_api_key(event_id: str, current_user: Any = Depends(get_current_user)):
    _, role = await _require_event_access(event_id, current_user, {"issuer", "viewer"})
    if role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can manage API keys")

    db = get_database()
    raw_key = f"cf_{secrets.token_urlsafe(32)}"
    key_hash = _hash_api_key(raw_key)
    await db.api_keys.insert_one(
        {
            "event_id": event_id,
            "key_hash": key_hash,
            "created_by": str(current_user.get("_id")),
            "is_active": True,
            "created_at": datetime.utcnow(),
        }
    )
    return {"api_key": raw_key}


@router.get("/{event_id}/analytics")
async def event_analytics(event_id: str, current_user: Any = Depends(get_current_user)):
    await _require_event_access(event_id, current_user, {"issuer", "viewer"})
    db = get_database()

    certs = await db.certificates.find({"event_id": event_id}).to_list(length=None)
    cert_ids = [c["id"] for c in certs]

    issued = len(certs)
    verified = await db.certificate_events.count_documents({"cert_id": {"$in": cert_ids}, "event_type": "verified"}) if cert_ids else 0
    opened = await db.certificate_events.count_documents({"cert_id": {"$in": cert_ids}, "event_type": "opened"}) if cert_ids else 0
    shared = await db.certificate_events.count_documents({"cert_id": {"$in": cert_ids}, "event_type": "shared"}) if cert_ids else 0
    emailed = await db.certificate_events.count_documents({"cert_id": {"$in": cert_ids}, "event_type": "emailed"}) if cert_ids else 0

    return {
        "issued": issued,
        "opened": opened,
        "shared": shared,
        "verified": verified,
        "emailed": emailed,
    }


@router.get("/{event_id}/certificates")
async def list_event_certificates(event_id: str, current_user: Any = Depends(get_current_user)):
    await _require_event_access(event_id, current_user, {"issuer", "viewer"})
    db = get_database()

    certs = await db.certificates.find({"event_id": event_id}).to_list(length=None)

    result = []
    for c in certs:
        cert_id = c["id"]

        # view count from certificate_events
        view_count = await db.certificate_events.count_documents({"cert_id": cert_id, "event_type": "opened"})

        # last verified timestamp
        last_verified_doc = await db.certificate_events.find_one(
            {"cert_id": cert_id, "event_type": "verified"},
            sort=[("timestamp", -1)],
        )
        last_verified_at = last_verified_doc["timestamp"].isoformat() if last_verified_doc and last_verified_doc.get("timestamp") else None

        meta = c.get("metadata", {})
        # try to get email from participants collection first
        participant = await db.participants.find_one({"certificate_id": cert_id})
        email = (participant or {}).get("email") or meta.get("email", "")

        result.append({
            "cert_id": cert_id,
            "name": c.get("participant_name", ""),
            "email": email,
            "role": meta.get("role", ""),
            "issued_at": c.get("created_at").isoformat() if c.get("created_at") else None,
            "view_count": view_count,
            "last_verified_at": last_verified_at,
        })

    return result
