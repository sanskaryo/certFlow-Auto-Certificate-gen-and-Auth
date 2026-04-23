from datetime import datetime, timezone
from typing import Any
import re
from fastapi import APIRouter, Depends, HTTPException, Request
from app.database import get_database
from app.routers.auth import get_current_user
from app.core.ratelimit import limiter

router = APIRouter(prefix="/profiles", tags=["profiles"])

def _slugify(value: str) -> str:
    value = value.lower().strip()
    value = re.sub(r"[^a-z0-9_]+", "_", value)
    value = re.sub(r"_+", "_", value).strip("_")
    return value[:24] or "recipient"

async def _ensure_unique_username(db, base: str, existing_email: str | None = None) -> str:
    candidate = _slugify(base)
    i = 0
    while True:
        found = await db.recipient_profiles.find_one({"username": candidate})
        if not found:
            return candidate
        if existing_email and found.get("recipient_email") == existing_email:
            return candidate
        i += 1
        candidate = f"{_slugify(base)}{i}"

async def ensure_profile_for_recipient(email: str, display_name: str) -> dict:
    db = get_database()
    profile = await db.recipient_profiles.find_one({"recipient_email": email})
    if profile:
        return profile

    username = await _ensure_unique_username(db, email.split("@")[0], email)
    profile = {
        "username": username,
        "recipient_email": email,
        "display_name": display_name,
        "bio": "",
        "is_public": True,
        "hidden_certificate_ids": [],
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }
    await db.recipient_profiles.insert_one(profile)
    return profile

@router.get("/me")
async def get_my_profile(current_user: Any = Depends(get_current_user)):
    db = get_database()
    profile = await db.recipient_profiles.find_one({"recipient_email": current_user["email"]})
    if not profile:
        profile = await ensure_profile_for_recipient(current_user["email"], current_user.get("name", "Recipient"))

    return {
        "username": profile["username"],
        "display_name": profile.get("display_name", ""),
        "bio": profile.get("bio", ""),
        "is_public": profile.get("is_public", True),
        "hidden_certificate_ids": profile.get("hidden_certificate_ids", []),
    }

@router.patch("/me")
@limiter.limit("10/hour")
async def update_my_profile(request: Request, payload: dict[str, Any], current_user: Any = Depends(get_current_user)):
    db = get_database()
    profile = await db.recipient_profiles.find_one({"recipient_email": current_user["email"]})
    if not profile:
        profile = await ensure_profile_for_recipient(current_user["email"], current_user.get("name", "Recipient"))

    update = {
        "display_name": str(payload.get("display_name", profile.get("display_name", ""))).strip()[:100],
        "bio": str(payload.get("bio", profile.get("bio", ""))).strip()[:500],
        "is_public": bool(payload.get("is_public", profile.get("is_public", True))),
        "updated_at": datetime.now(timezone.utc),
    }

    if "username" in payload:
        update["username"] = await _ensure_unique_username(db, str(payload["username"]), current_user["email"])

    await db.recipient_profiles.update_one({"recipient_email": current_user["email"]}, {"$set": update})
    return {"message": "Profile updated"}

@router.get("/{username}")
@limiter.limit("60/minute")
async def get_public_profile(request: Request, username: str):
    db = get_database()
    profile = await db.recipient_profiles.find_one({"username": username})
    if not profile or not profile.get("is_public", True):
        raise HTTPException(status_code=404, detail="Profile not found")

    rec_email = profile.get("recipient_email", "")
    hidden = set(profile.get("hidden_certificate_ids", []))
    certs = await db.certificates.find({"recipient_email": rec_email}).sort("issued_at", -1).to_list(length=100)

    out = []
    for c in certs:
        if c["id"] in hidden: continue
        meta = c.get("metadata", {})
        out.append({
            "id": c["id"],
            "participant_name": c.get("participant_name", ""),
            "event_name": meta.get("event_name", "Event"),
            "organization": meta.get("organization", ""),
            "date_text": meta.get("date_text", ""),
            "role": meta.get("role", ""),
            "issued_at": c.get("issued_at", c.get("created_at")),
            "verification_hash": c.get("verification_hash", ""),
        })

    return {
        "username": profile["username"],
        "display_name": profile.get("display_name", ""),
        "bio": profile.get("bio", ""),
        "certificates": out,
    }
