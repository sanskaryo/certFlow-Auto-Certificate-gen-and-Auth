import dns.resolver
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Any, Optional

from app.database import get_database
from app.routers.auth import get_current_user

router = APIRouter(prefix="/settings", tags=["settings"])

CERTFLOW_CNAME_TARGET = "verify.certflow.app"


class OrgSettingsUpdate(BaseModel):
    custom_domain: Optional[str] = None
    white_label: Optional[bool] = None
    primary_color: Optional[str] = None
    org_name_override: Optional[str] = None
    remove_branding: Optional[bool] = None


@router.get("")
async def get_settings(current_user: Any = Depends(get_current_user)):
    db = get_database()
    user = await db.users.find_one({"email": current_user["email"]})
    return {
        "custom_domain": user.get("custom_domain", ""),
        "white_label": user.get("white_label", False),
        "primary_color": user.get("primary_color", "#0d9488"),
        "org_name_override": user.get("org_name_override", ""),
        "remove_branding": user.get("remove_branding", False),
        "domain_verified": user.get("domain_verified", False),
    }


@router.patch("")
async def update_settings(payload: OrgSettingsUpdate, current_user: Any = Depends(get_current_user)):
    db = get_database()
    update: dict = {}
    if payload.custom_domain is not None:
        update["custom_domain"] = payload.custom_domain.strip().lower()
        update["domain_verified"] = False  # reset on domain change
    if payload.white_label is not None:
        update["white_label"] = payload.white_label
    if payload.primary_color is not None:
        update["primary_color"] = payload.primary_color
    if payload.org_name_override is not None:
        update["org_name_override"] = payload.org_name_override
    if payload.remove_branding is not None:
        update["remove_branding"] = payload.remove_branding
    if not update:
        raise HTTPException(status_code=400, detail="No fields to update")
    await db.users.update_one({"email": current_user["email"]}, {"$set": update})
    return {"message": "Settings updated"}


@router.post("/verify-domain")
async def verify_domain(current_user: Any = Depends(get_current_user)):
    db = get_database()
    user = await db.users.find_one({"email": current_user["email"]})
    domain = user.get("custom_domain", "").strip()
    if not domain:
        raise HTTPException(status_code=400, detail="No custom domain configured")

    verified = False
    try:
        answers = dns.resolver.resolve(domain, "CNAME")
        for rdata in answers:
            target = str(rdata.target).rstrip(".")
            if target == CERTFLOW_CNAME_TARGET:
                verified = True
                break
    except Exception:
        verified = False

    if verified:
        await db.users.update_one(
            {"email": current_user["email"]},
            {"$set": {"domain_verified": True}},
        )

    return {"verified": verified}


@router.get("/domain-status")
async def domain_status(current_user: Any = Depends(get_current_user)):
    db = get_database()
    user = await db.users.find_one({"email": current_user["email"]})
    return {
        "custom_domain": user.get("custom_domain", ""),
        "domain_verified": user.get("domain_verified", False),
    }
