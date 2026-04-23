import dns.resolver
import os
import uuid
import shutil
import hashlib
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Request
from pydantic import BaseModel
from typing import Any, Optional
from app.database import get_database
from app.routers.auth import get_current_user
from app.core.ratelimit import limiter

router = APIRouter(prefix="/settings", tags=["settings"])

CERTFLOW_CNAME_TARGET = "verify.certflow.app"
MAX_ASSET_SIZE = 5 * 1024 * 1024 # 5MB

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
    admin_name: Optional[str] = None
    admin_role: Optional[str] = None
    admin_organization: Optional[str] = None
    default_signature_path: Optional[str] = None
    default_logo_path: Optional[str] = None

class SMTPTestRequest(BaseModel):
    from_name: str
    from_email: str
    smtp_host: str
    smtp_port: int
    smtp_username: str
    smtp_password: str

@router.get("")
async def get_settings(current_user: Any = Depends(get_current_user)):
    db = get_database()
    user = await db.users.find_one({"_id": current_user["_id"]})
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
        "admin_name": user.get("admin_name", ""),
        "admin_role": user.get("admin_role", ""),
        "admin_organization": user.get("admin_organization", ""),
        "default_signature_path": user.get("default_signature_path", ""),
        "default_logo_path": user.get("default_logo_path", "")
        # Don't return SMTP password
    }

@router.patch("")
async def update_settings(payload: OrgSettingsUpdate, current_user: Any = Depends(get_current_user)):
    db = get_database()
    update: dict = {}
    fields = [
        "custom_domain", "white_label", "primary_color", "org_name_override",
        "remove_branding", "smtp_from_name", "smtp_from_email", "smtp_host",
        "smtp_port", "smtp_username", "smtp_password", "admin_name",
        "admin_role", "admin_organization", "default_signature_path", "default_logo_path"
    ]
    
    for field in fields:
        val = getattr(payload, field)
        if val is not None:
            if field == "custom_domain":
                update[field] = val.strip().lower()
                update["domain_verified"] = False
            else:
                update[field] = val

    if not update:
        raise HTTPException(status_code=400, detail="No fields to update")
        
    await db.users.update_one({"_id": current_user["_id"]}, {"$set": update})
    return {"message": "Settings updated"}

@router.post("/verify-domain")
@limiter.limit("5/minute")
async def verify_domain(request: Request, current_user: Any = Depends(get_current_user)):
    db = get_database()
    user = await db.users.find_one({"_id": current_user["_id"]})
    domain = user.get("custom_domain", "").strip()
    if not domain:
        raise HTTPException(status_code=400, detail="No custom domain configured")

    verified = False
    try:
        answers = dns.resolver.resolve(domain, "CNAME")
        for rdata in answers:
            if str(rdata.target).rstrip(".") == CERTFLOW_CNAME_TARGET:
                verified = True
                break
    except Exception:
        verified = False

    if verified:
        await db.users.update_one({"_id": current_user["_id"]}, {"$set": {"domain_verified": True}})

    return {"verified": verified}

@router.get("/domain-status")
async def domain_status(current_user: Any = Depends(get_current_user)):
    db = get_database()
    user = await db.users.find_one({"_id": current_user["_id"]})
    return {
        "custom_domain": user.get("custom_domain", ""),
        "domain_verified": user.get("domain_verified", False),
    }

@router.post("/smtp/test")
@limiter.limit("3/hour") # strict limit to prevent spam abuse
async def test_smtp(request: Request, req: SMTPTestRequest, current_user: Any = Depends(get_current_user)):
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

@router.post("/upload-asset")
@limiter.limit("10/hour")
async def upload_org_asset(
    request: Request,
    asset_type: str = Form(...),
    file: UploadFile = File(...),
    current_user: Any = Depends(get_current_user)
):
    if asset_type not in ["logo", "signature"]:
        raise HTTPException(status_code=400, detail="Invalid asset type")

    ext = file.filename.split('.')[-1].lower() if '.' in file.filename else 'png'
    if ext not in ["png", "jpg", "jpeg"]:
        raise HTTPException(status_code=400, detail="Invalid image type")
        
    os.makedirs("uploads", exist_ok=True)
    safe_name = f"org_{hashlib.md5(current_user['email'].encode()).hexdigest()}_{asset_type}_{uuid.uuid4().hex[:6]}.png"
    filepath = os.path.join("uploads", safe_name)

    # Read and process
    try:
        from PIL import Image, ImageChops
        content = await file.read()
        if len(content) > MAX_ASSET_SIZE:
             raise HTTPException(status_code=400, detail="File too large")
             
        img = Image.open(io.BytesIO(content)).convert("RGBA")
        
        if asset_type == "signature":
            datas = img.getdata()
            new_data = []
            for item in datas:
                if item[0] > 220 and item[1] > 220 and item[2] > 220:
                    new_data.append((255, 255, 255, 0))
                else:
                    new_data.append(item)
            img.putdata(new_data)
            bg = Image.new("RGBA", img.size, (255, 255, 255, 0))
            diff = ImageChops.difference(img, bg)
            bbox = diff.getbbox()
            if bbox:
                img = img.crop(bbox)
        
        img.save(filepath, "PNG")
    except Exception as e:
        logger.error(f"Asset upload error: {e}")
        raise HTTPException(status_code=500, detail="Failed to process image")

    db = get_database()
    field = "default_signature_path" if asset_type == "signature" else "default_logo_path"
    await db.users.update_one({"_id": current_user["_id"]}, {"$set": {field: filepath}})
    
    return {"path": filepath, "message": f"{asset_type.capitalize()} saved"}
