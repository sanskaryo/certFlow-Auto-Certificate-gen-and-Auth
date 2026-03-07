from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from datetime import datetime
from app.database import get_database
from app.core.config import settings
import hashlib
import os
from bson import ObjectId

router = APIRouter(prefix="/verify", tags=["verification"])

class CertificateResponse(BaseModel):
    id: str
    participant_name: str
    event_name: str
    role: str | None = None
    issued_at: datetime
    verification_hash: str
    is_valid: bool

@router.get("/{cert_id}", response_model=CertificateResponse)
async def verify_certificate(cert_id: str):
    db = get_database()
    cert = await db.certificates.find_one({"id": cert_id})
    if not cert:
        raise HTTPException(status_code=404, detail="Certificate not found or invalid")

    event_name = cert.get("metadata", {}).get("event_name")
    if not event_name:
        event_id = cert.get("event_id")
        if event_id and ObjectId.is_valid(event_id):
            event = await db.events.find_one({"_id": ObjectId(event_id)})
            if event:
                event_name = event.get("name")
    event_name = event_name or "Unknown Event"

    metadata = cert.get("metadata", {})
    organization = metadata.get("organization", "")
    date_text = metadata.get("date_text", "")
    role = metadata.get("role", "")

    # New hash format (v2): includes key metadata to strengthen tamper resistance.
    expected_hash_v2 = hashlib.sha256(
        f"{cert.get('participant_name', '')}|{event_name}|{organization}|{date_text}|{role}|{cert_id}|{settings.SECRET_KEY}".encode()
    ).hexdigest()
    # Legacy hash format (v1): backward compatibility for already-issued certs.
    expected_hash_v1 = hashlib.sha256(
        f"{cert.get('participant_name', '')}|{event_name}|{cert_id}|{settings.SECRET_KEY}".encode()
    ).hexdigest()

    if cert.get("verification_hash") not in {expected_hash_v2, expected_hash_v1}:
        raise HTTPException(status_code=400, detail="Certificate integrity check failed")
    
    return CertificateResponse(
        id=cert["id"],
        participant_name=cert["participant_name"],
        event_name=event_name,
        role=role or None,
        issued_at=cert["issued_at"],
        verification_hash=cert["verification_hash"],
        is_valid=True
    )


@router.get("/{cert_id}/preview")
async def preview_certificate_pdf(cert_id: str):
    db = get_database()
    cert = await db.certificates.find_one({"id": cert_id})
    if not cert:
        raise HTTPException(status_code=404, detail="Certificate not found")
    file_path = cert.get("file_path")
    if not file_path or not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Certificate file not found")
    return FileResponse(file_path, media_type="application/pdf", filename=f"{cert_id}.pdf")
