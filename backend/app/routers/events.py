import io
import os
import zipfile
from datetime import datetime, timezone
import logging
from typing import Any, List, Optional
import hashlib
import secrets
from bson import ObjectId
from fastapi import APIRouter, BackgroundTasks, Depends, File, Header, HTTPException, UploadFile, Query, Request
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel, Field
import pandas as pd

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
from app.core.config import settings
from app.core.ratelimit import limiter

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/events", tags=["events"])

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

MAX_FILE_SIZE = 10 * 1024 * 1024 # 10MB
ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "pdf", "csv"}

def _validate_file(file: UploadFile):
    ext = file.filename.split('.')[-1].lower() if '.' in file.filename else ''
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"File extension {ext} not allowed")
    return ext

class AITemplateRequest(BaseModel):
    prompt: str = Field(..., min_length=5, max_length=500)

class ManualGenerateRequest(BaseModel):
    participant_name: str = Field(..., min_length=2, max_length=100)
    event_name: str = Field(..., min_length=2, max_length=100)
    organization: str = Field(..., min_length=2, max_length=100)
    date_text: str = Field(..., min_length=4, max_length=50)
    template_id: str = Field(default="classic-blue")
    role: str = Field(default="", max_length=50)
    email: str = Field(default="", max_length=100)

class ParticipantEntry(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    email: str = Field(default="", max_length=100)
    role: str = Field(default="", max_length=50)

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

class EventAuthorityUpdate(BaseModel):
    authority_name: str
    authority_position: str

class LogoPositionUpdate(BaseModel):
    x: float = Field(..., ge=0, le=1)
    y: float = Field(..., ge=0, le=1)
    size: float = Field(default=0.25, ge=0.05, le=0.8)
    shape: str = Field(default="rectangle")

class CertificateLayoutUpdate(BaseModel):
    certificate_layout: dict | None = None
    logo_position: dict | None = None

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

async def _require_event_access(event_id: str, current_user: Any, allowed: set[str]) -> tuple[dict, str]:
    db = get_database()
    event = await _get_event_or_404(event_id)

    if str(event.get("user_id")) == str(current_user.get("_id")):
        return event, "admin"

    team = await db.team_members.find_one({"event_id": event_id, "member_user_id": str(current_user.get("_id"))})
    team_role = team.get("role") if team else None
    if not team_role or (team_role not in allowed and "admin" not in allowed):
        raise HTTPException(status_code=403, detail="Not authorized for this event")
    return event, team_role

async def _track_cert_event(cert_id: str, event_type: str, source: str = "app"):
    db = get_database()
    await db.certificate_events.insert_one(
        {
            "cert_id": cert_id,
            "event_type": event_type,
            "source": source,
            "created_at": datetime.now(timezone.utc),
        }
    )

@router.get("/templates")
async def list_templates():
    return {"templates": template_catalog()}

@router.get("/", response_model=List[EventOut])
async def list_events(current_user: Any = Depends(get_current_user)) -> Any:
    user_id = str(current_user.get("_id"))
    db = get_database()
    own_events = await db.events.find({"user_id": user_id}).to_list(length=100)
    team_memberships = await db.team_members.find({"member_user_id": user_id}).to_list(length=200)
    team_event_ids = [m["event_id"] for m in team_memberships]
    team_events = []
    if team_event_ids:
        ids = [ObjectId(eid) for eid in team_event_ids if ObjectId.is_valid(eid)]
        team_events = await db.events.find({"_id": {"$in": ids}}).to_list(length=200)

    merged = {str(evt["_id"]): evt for evt in own_events + team_events}
    events = list(merged.values())
    for evt in events: evt["id"] = str(evt["_id"])
    return sorted(events, key=lambda x: x.get("created_at", datetime.min.replace(tzinfo=timezone.utc)), reverse=True)

@router.get("/{event_id}", response_model=EventOut)
async def get_event(event_id: str, current_user: Any = Depends(get_current_user)) -> Any:
    event, _ = await _require_event_access(event_id, current_user, {"issuer", "viewer", "admin"})
    event["id"] = str(event["_id"])
    return event

@router.post("/", response_model=EventOut)
@limiter.limit("10/hour")
async def create_event(request: Request, event_in: EventCreate, current_user: Any = Depends(get_current_user)) -> Any:
    db = get_database()
    event_dict = event_in.model_dump()
    event_dict["user_id"] = str(current_user.get("_id"))
    event_dict["created_at"] = datetime.now(timezone.utc)
    if event_dict.get("description"):
        # AI template path
        try:
            result = await db.events.insert_one(event_dict)
            event_id = str(result.inserted_id)
            bg_path = generate_certificate_background(event_dict["description"], event_id)
            await db.events.update_one({"_id": ObjectId(event_id)}, {"$set": {"template_path": bg_path, "template_id": "ai-generated"}})
            event_dict["id"] = event_id
            event_dict["template_path"] = bg_path
            event_dict["template_id"] = "ai-generated"
            return event_dict
        except Exception as e:
            logger.error(f"AI Template error: {e}")
    result = await db.events.insert_one(event_dict)
    event_dict["id"] = str(result.inserted_id)
    return event_dict

@router.delete("/{event_id}")
async def delete_event(event_id: str, current_user: Any = Depends(get_current_user)):
    _, role = await _require_event_access(event_id, current_user, {"admin"})
    db = get_database()
    await db.events.delete_one({"_id": ObjectId(event_id)})
    await db.participants.delete_many({"event_id": event_id})
    await db.certificates.delete_many({"event_id": event_id})
    return {"message": "Event deleted"}

@router.post("/{event_id}/template")
async def upload_template(event_id: str, file: UploadFile = File(...), current_user: Any = Depends(get_current_user)):
    await _require_event_access(event_id, current_user, {"admin", "issuer"})
    _validate_file(file)
    file_bytes = await file.read()
    if len(file_bytes) > MAX_FILE_SIZE: raise HTTPException(status_code=400, detail="File too large")
    safe_name = hashlib.md5(f"{event_id}_{file.filename}".encode()).hexdigest() + ".pdf"
    file_path = os.path.join(UPLOAD_DIR, safe_name)
    with open(file_path, "wb") as f: f.write(file_bytes)
    db = get_database()
    await db.events.update_one({"_id": ObjectId(event_id)}, {"$set": {"template_path": file_path}})
    return {"message": "Template uploaded", "template_path": file_path}

@router.post("/{event_id}/ai-template")
@limiter.limit("5/hour")
async def generate_ai_template_endpoint(request: Request, event_id: str, payload: AITemplateRequest, current_user: Any = Depends(get_current_user)):
    await _require_event_access(event_id, current_user, {"admin", "issuer"})
    bg_path = generate_certificate_background(payload.prompt, event_id)
    db = get_database()
    await db.events.update_one({"_id": ObjectId(event_id)}, {"$set": {"template_path": bg_path, "template_id": "ai-generated"}})
    return {"message": "AI Template ready", "template_path": bg_path}

@router.post("/{event_id}/logo")
async def upload_logo(event_id: str, file: UploadFile = File(...), key: str = "logo_path", current_user: Any = Depends(get_current_user)):
    await _require_event_access(event_id, current_user, {"admin", "issuer"})
    ext = _validate_file(file)
    file_bytes = await file.read()
    if len(file_bytes) > MAX_FILE_SIZE: raise HTTPException(status_code=400, detail="File too large")
    safe_name = f"{event_id}_{key}_{hashlib.md5(file_bytes).hexdigest()[:8]}.{ext}"
    file_path = os.path.abspath(os.path.join(UPLOAD_DIR, safe_name))
    with open(file_path, "wb") as f: f.write(file_bytes)
    db = get_database()
    update = {"logo_path": file_path} if key == "logo_path" else {f"additional_logos.{key}": file_path}
    await db.events.update_one({"_id": ObjectId(event_id)}, {"$set": update})
    return {"message": "Logo uploaded", "logo_path": file_path}

@router.post("/{event_id}/signature")
async def upload_signature(event_id: str, file: UploadFile = File(...), key: str = "signature_path", current_user: Any = Depends(get_current_user)):
    await _require_event_access(event_id, current_user, {"admin", "issuer"})
    _validate_file(file)
    raw_bytes = await file.read()
    if len(raw_bytes) > MAX_FILE_SIZE: raise HTTPException(status_code=400, detail="File too large")
    try:
        from PIL import Image, ImageChops
        img = Image.open(io.BytesIO(raw_bytes)).convert("RGBA")
        datas = img.getdata()
        new_data = []
        for item in datas:
            if item[0] > 220 and item[1] > 220 and item[2] > 220: new_data.append((255, 255, 255, 0))
            else: new_data.append(item)
        img.putdata(new_data)
        bg = Image.new("RGBA", img.size, (255, 255, 255, 0))
        diff = ImageChops.difference(img, bg)
        bbox = diff.getbbox()
        if bbox: img = img.crop(bbox)
        out = io.BytesIO()
        img.save(out, format="PNG")
        processed_bytes = out.getvalue()
    except Exception: processed_bytes = raw_bytes
    safe_name = f"{event_id}_{key}_sig_{hashlib.md5(processed_bytes).hexdigest()[:8]}.png"
    file_path = os.path.abspath(os.path.join(UPLOAD_DIR, safe_name))
    with open(file_path, "wb") as f: f.write(processed_bytes)
    db = get_database()
    update = {"signature_path": file_path} if key == "signature_path" else {f"additional_signatures.{key}": file_path}
    await db.events.update_one({"_id": ObjectId(event_id)}, {"$set": update})
    return {"message": "Signature uploaded", "signature_path": file_path}

@router.patch("/{event_id}/authority")
async def update_authority(event_id: str, payload: EventAuthorityUpdate, current_user: Any = Depends(get_current_user)):
    await _require_event_access(event_id, current_user, {"admin", "issuer"})
    db = get_database()
    await db.events.update_one({"_id": ObjectId(event_id)}, {"$set": {"authority_name": payload.authority_name, "authority_position": payload.authority_position}})
    return {"message": "Authority updated"}

@router.patch("/{event_id}/certificate-layout")
async def update_certificate_layout(event_id: str, payload: CertificateLayoutUpdate, current_user: Any = Depends(get_current_user)):
    await _require_event_access(event_id, current_user, {"admin", "issuer"})
    update_doc = {}
    if payload.certificate_layout is not None: update_doc["certificate_layout"] = payload.certificate_layout
    if payload.logo_position is not None: update_doc["logo_position"] = payload.logo_position
    db = get_database()
    await db.events.update_one({"_id": ObjectId(event_id)}, {"$set": update_doc})
    return {"message": "Layout saved"}

@router.post("/{event_id}/participants")
async def upload_participants(event_id: str, file: UploadFile = File(...), current_user: Any = Depends(get_current_user)):
    await _require_event_access(event_id, current_user, {"admin", "issuer"})
    _validate_file(file)
    df = pd.read_csv(io.BytesIO(await file.read()))
    df.columns = df.columns.astype(str).str.lower().str.strip()
    participants = []
    for _, row in df.iterrows():
        participants.append({
            "event_id": event_id, "name": str(row["name"]).strip(), "email": str(row["email"]).strip(),
            "position": str(row.get("position", "")).strip(), "status": "pending", "created_at": datetime.now(timezone.utc)
        })
    db = get_database()
    if participants: await db.participants.insert_many(participants)
    return {"message": f"Uploaded {len(participants)} participants"}

@router.post("/{event_id}/generate/manual")
async def generate_manual_certificate(event_id: str, payload: ManualGenerateRequest, current_user: Any = Depends(get_current_user)):
    await _require_event_access(event_id, current_user, {"admin", "issuer"})
    result = await generate_single_manual_certificate(
        event_id=event_id, participant_name=payload.participant_name.strip(), event_name=payload.event_name.strip(),
        organization=payload.organization.strip(), date_text=payload.date_text.strip(),
        template_id=payload.template_id.strip(), role=payload.role.strip(), email=payload.email.strip()
    )
    await _track_cert_event(result["certificate_id"], "issued", "manual")
    return {"message": "Generated", **result}

@router.post("/{event_id}/certificates/{cert_id}/send-email")
@limiter.limit("50/hour")
async def send_manual_email(request: Request, event_id: str, cert_id: str, current_user: Any = Depends(get_current_user)):
    await _require_event_access(event_id, current_user, {"admin", "issuer"})
    db = get_database()
    cert = await db.certificates.find_one({"id": cert_id, "event_id": event_id})
    if not cert: raise HTTPException(status_code=404, detail="Not found")
    meta = cert.get("metadata", {})
    participant = await db.participants.find_one({"certificate_id": cert_id})
    target = (participant or {}).get("email") or meta.get("email")
    if not target: raise HTTPException(status_code=400, detail="No email")
    from app.services.certificate_service import _verify_base_url
    success = await send_certificate_email(
        target, f"Certificate: {meta.get('event_name')}", f"Hello {cert['participant_name']},\n\nAttached is your certificate.", 
        cert["file_path"], participant_name=cert["participant_name"], event_name=meta.get("event_name"), organization=meta.get("organization"),
        verify_url=_verify_base_url() + cert_id
    )
    if success:
        await _track_cert_event(cert_id, "emailed", "manual")
        return {"message": "Email sent"}
    raise HTTPException(status_code=500, detail="Email failed")

@router.get("/{event_id}/certificates")
async def list_event_certificates(event_id: str, skip: int = 0, limit: int = 50, current_user: Any = Depends(get_current_user)):
    await _require_event_access(event_id, current_user, {"admin", "issuer", "viewer"})
    db = get_database()
    pipeline = [
        {"$match": {"event_id": event_id}}, {"$sort": {"issued_at": -1}}, {"$skip": skip}, {"$limit": limit},
        {"$lookup": {"from": "certificate_events", "let": {"c_id": "$id"}, "pipeline": [{"$match": {"$expr": {"$eq": ["$cert_id", "$$c_id"]}}}, {"$group": {"_id": "$event_type", "count": {"$sum": 1}}}], "as": "activity"}},
        {"$lookup": {"from": "participants", "let": {"c_id": "$id"}, "pipeline": [{"$match": {"$expr": {"$eq": ["$certificate_id", "$$c_id"]}}}, {"$project": {"email": 1}}], "as": "participant"}}
    ]
    cursor = db.certificates.aggregate(pipeline)
    certs = await cursor.to_list(length=limit)
    result = []
    for c in certs:
        act = {a["_id"]: a["count"] for a in c.get("activity", [])}
        email = (c.get("participant", []) or [{}])[0].get("email") or c.get("metadata", {}).get("email", "")
        result.append({
            "cert_id": c["id"], "name": c.get("participant_name", ""), "email": email, "role": c.get("metadata", {}).get("role", ""),
            "issued_at": c.get("issued_at", c.get("created_at")).isoformat() if (c.get("issued_at") or c.get("created_at")) else None,
            "view_count": act.get("opened", 0), "verified_count": act.get("verified", 0)
        })
    return result

@router.get("/{event_id}/analytics")
async def event_analytics(event_id: str, current_user: Any = Depends(get_current_user)):
    await _require_event_access(event_id, current_user, {"admin", "issuer", "viewer"})
    db = get_database()
    issued = await db.certificates.count_documents({"event_id": event_id})
    certs = await db.certificates.find({"event_id": event_id}, {"id": 1}).to_list(length=None)
    ids = [c["id"] for c in certs]
    if not ids: return {"issued": 0, "opened": 0, "shared": 0, "verified": 0, "emailed": 0}
    events = await db.certificate_events.aggregate([{"$match": {"cert_id": {"$in": ids}}}, {"$group": {"_id": "$event_type", "count": {"$sum": 1}}}]).to_list(length=None)
    counts = {e["_id"]: e["count"] for e in events}
    return {"issued": issued, "opened": counts.get("opened", 0), "shared": counts.get("shared", 0), "verified": counts.get("verified", 0), "emailed": counts.get("emailed", 0)}

