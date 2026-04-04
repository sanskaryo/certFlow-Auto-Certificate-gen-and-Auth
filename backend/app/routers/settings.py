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
    smtp_from_name: Optional[str] = None
    smtp_from_email: Optional[str] = None
    smtp_host: Optional[str] = None
    smtp_port: Optional[int] = None
    smtp_username: Optional[str] = None
    smtp_password: Optional[str] = None

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
        "smtp_from_name": user.get("smtp_from_name", ""),
        "smtp_from_email": user.get("smtp_from_email", ""),
        "smtp_host": user.get("smtp_host", ""),
        "smtp_port": user.get("smtp_port"),
        "smtp_username": user.get("smtp_username", ""),
        "smtp_password": user.get("smtp_password", "")
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
    if payload.smtp_from_name is not None: update["smtp_from_name"] = payload.smtp_from_name
    if payload.smtp_from_email is not None: update["smtp_from_email"] = payload.smtp_from_email
    if payload.smtp_host is not None: update["smtp_host"] = payload.smtp_host
    if payload.smtp_port is not None: update["smtp_port"] = payload.smtp_port
    if payload.smtp_username is not None: update["smtp_username"] = payload.smtp_username
    if payload.smtp_password is not None: update["smtp_password"] = payload.smtp_password

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

class SMTPTestRequest(BaseModel):
    from_name: str
    from_email: str
    smtp_host: str
    smtp_port: int
    smtp_username: str
    smtp_password: str

@router.post("/smtp/test")
async def test_smtp(req: SMTPTestRequest, current_user: Any = Depends(get_current_user)):
    import smtplib
    from email.mime.text import MIMEText
    try:
        msg = MIMEText("This is a test email from CertFlow to verify your SMTP settings.")
        msg['Subject'] = "CertFlow SMTP Test"
        msg['From'] = f"{req.from_name} <{req.from_email}>"
        msg['To'] = current_user.get("email")

        server = smtplib.SMTP(req.smtp_host, req.smtp_port, timeout=10)
        server.starttls()
        server.login(req.smtp_username, req.smtp_password)
        server.send_message(msg)
        server.quit()
        return {"success": True, "message": "Test email sent successfully"}
    except Exception as e:
        return {"success": False, "message": str(e)}
