import hashlib
import os
from datetime import datetime

from bson import ObjectId
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel

from app.core.config import settings
from app.database import get_database

router = APIRouter(prefix="/verify", tags=["verification"])


class OrgBranding(BaseModel):
    org_name: str | None = None
    primary_color: str | None = None
    logo_url: str | None = None
    white_label: bool = False
    remove_branding: bool = False


class CertificateResponse(BaseModel):
    id: str
    participant_name: str
    event_name: str
    organization: str | None = None
    role: str | None = None
    date_text: str | None = None
    issued_at: datetime
    verification_hash: str
    issuer_name: str | None = None
    issuer_position: str | None = None
    has_signature: bool = False
    is_valid: bool
    branding: OrgBranding | None = None


async def _track(cert_id: str, event_type: str, source: str = "verify"):
    db = get_database()
    await db.certificate_events.insert_one(
        {
            "cert_id": cert_id,
            "event_type": event_type,
            "source": source,
            "created_at": datetime.utcnow(),
        }
    )


def _validate_hash(cert: dict, cert_id: str, event_name: str) -> bool:
    metadata = cert.get("metadata", {})
    organization = metadata.get("organization", "")
    date_text = metadata.get("date_text", "")
    role = metadata.get("role", "")

    expected_hash_v2 = hashlib.sha256(
        f"{cert.get('participant_name', '')}|{event_name}|{organization}|{date_text}|{role}|{cert_id}|{settings.SECRET_KEY}".encode()
    ).hexdigest()
    expected_hash_v1 = hashlib.sha256(
        f"{cert.get('participant_name', '')}|{event_name}|{cert_id}|{settings.SECRET_KEY}".encode()
    ).hexdigest()
    return cert.get("verification_hash") in {expected_hash_v2, expected_hash_v1}


async def _build_response(cert: dict) -> CertificateResponse:
    db = get_database()
    cert_id = cert["id"]

    event_name = cert.get("metadata", {}).get("event_name")
    event = None
    event_id = cert.get("event_id")
    if event_id and ObjectId.is_valid(event_id):
        event = await db.events.find_one({"_id": ObjectId(event_id)})
    if not event_name and event:
        event_name = event.get("name")
    event_name = event_name or "Unknown Event"

    if not _validate_hash(cert, cert_id, event_name):
        raise HTTPException(status_code=400, detail="Certificate integrity check failed")

    metadata = cert.get("metadata", {})
    organization = metadata.get("organization") or (event.get("organization") if event else None)
    issuer_name = event.get("authority_name") if event else None
    issuer_position = event.get("authority_position") if event else None
    has_signature = bool(event and event.get("signature_path"))

    # Fetch issuer branding
    branding = None
    if event:
        issuer = await db.users.find_one({"_id": event.get("user_id")} if not isinstance(event.get("user_id"), str)
                                         else {"id": event.get("user_id")})
        if not issuer:
            issuer = await db.users.find_one({"_id": ObjectId(event["user_id"])}) if ObjectId.is_valid(str(event.get("user_id", ""))) else None
        if issuer and (issuer.get("white_label") or issuer.get("custom_domain")):
            logo_url = None
            if event.get("logo_path"):
                logo_url = f"/uploads/{event['logo_path'].split('uploads/')[-1]}" if "uploads/" in str(event.get("logo_path", "")) else None
            branding = OrgBranding(
                org_name=issuer.get("org_name_override") or organization,
                primary_color=issuer.get("primary_color"),
                logo_url=logo_url,
                white_label=bool(issuer.get("white_label")),
                remove_branding=bool(issuer.get("remove_branding")),
            )

    return CertificateResponse(
        id=cert["id"],
        participant_name=cert["participant_name"],
        event_name=event_name,
        organization=organization,
        role=metadata.get("role") or None,
        date_text=metadata.get("date_text") or None,
        issued_at=cert["issued_at"],
        verification_hash=cert["verification_hash"],
        issuer_name=issuer_name,
        issuer_position=issuer_position,
        has_signature=has_signature,
        is_valid=True,
        branding=branding,
    )


@router.get("/public-stats")
async def public_stats():
    db = get_database()
    orgs_using = await db.users.count_documents({})
    certs_issued = await db.certificates.count_documents({})
    return {"orgs_using": orgs_using, "certs_issued": certs_issued}


@router.get("/hash/{verification_hash}", response_model=CertificateResponse)
async def verify_by_hash(verification_hash: str):
    db = get_database()
    cert = await db.certificates.find_one({"verification_hash": verification_hash})
    if not cert:
        raise HTTPException(status_code=404, detail="Certificate not found or invalid")
    await _track(cert["id"], "verified", "hash_lookup")
    return await _build_response(cert)


@router.get("/{cert_id}", response_model=CertificateResponse)
async def verify_certificate(cert_id: str):
    db = get_database()
    cert = await db.certificates.find_one({"id": cert_id})
    if not cert:
        raise HTTPException(status_code=404, detail="Certificate not found or invalid")
    await _track(cert_id, "verified", "id_lookup")
    return await _build_response(cert)


@router.post("/{cert_id}/track/open")
async def track_open(cert_id: str):
    db = get_database()
    cert = await db.certificates.find_one({"id": cert_id})
    if not cert:
        raise HTTPException(status_code=404, detail="Certificate not found")
    await _track(cert_id, "opened", "recipient")
    return {"message": "Open tracked"}


@router.post("/{cert_id}/track/share")
async def track_share(cert_id: str):
    db = get_database()
    cert = await db.certificates.find_one({"id": cert_id})
    if not cert:
        raise HTTPException(status_code=404, detail="Certificate not found")
    await _track(cert_id, "shared", "recipient")
    return {"message": "Share tracked"}


@router.get("/{cert_id}/preview")
async def preview_certificate_pdf(cert_id: str):
    db = get_database()
    cert = await db.certificates.find_one({"id": cert_id})
    if not cert:
        raise HTTPException(status_code=404, detail="Certificate not found")
    file_path = cert.get("file_path")
    if not file_path or not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Certificate file not found")
    return FileResponse(file_path, media_type="application/pdf", content_disposition_type="inline")
