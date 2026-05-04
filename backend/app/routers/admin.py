from fastapi import APIRouter, Depends, HTTPException
from typing import Any, List
from datetime import datetime, timedelta
from bson import ObjectId
from pydantic import BaseModel
from app.database import get_database
from app.routers.auth import get_current_user
from app.models.organization import OrganizationOut

router = APIRouter(prefix="/admin", tags=["admin"])

def require_admin(current_user: Any = Depends(get_current_user)):
    if current_user.get("role") != "superadmin" and current_user.get("role") != "admin" and not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user

@router.get("/users")
async def get_all_users(admin_user: Any = Depends(require_admin)):
    db = get_database()
    users = await db.users.find({}).to_list(length=None)
    
    result = []
    for u in users:
        user_id = str(u["_id"])
        event_count = await db.events.count_documents({"user_id": user_id})
        
        # Calculate cert count
        events = await db.events.find({"user_id": user_id}).to_list(length=None)
        event_ids = [str(e["_id"]) for e in events]
        cert_count = await db.certificates.count_documents({"event_id": {"$in": event_ids}})
        
        result.append({
            "id": user_id,
            "email": u.get("email", ""),
            "created_at": u.get("created_at", datetime.utcnow()).isoformat(),
            "event_count": event_count,
            "cert_count": cert_count,
            "disabled": u.get("disabled", False)
        })
    return result

class UserDisableUpdate(BaseModel):
    disabled: bool

@router.patch("/users/{user_id}")
async def update_user_status(user_id: str, payload: UserDisableUpdate, admin_user: Any = Depends(require_admin)):
    db = get_database()
    if not ObjectId.is_valid(user_id):
        raise HTTPException(status_code=400, detail="Invalid user ID")
    
    result = await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"disabled": payload.disabled}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
        
    return {"message": "User status updated"}

@router.get("/events")
async def get_recent_events(admin_user: Any = Depends(require_admin)):
    db = get_database()
    events = await db.events.find({}).sort("created_at", -1).limit(20).to_list(length=20)
    
    result = []
    for e in events:
        owner = await db.users.find_one({"_id": ObjectId(e["user_id"])}) if ObjectId.is_valid(e["user_id"]) else None
        owner_email = owner.get("email", "Unknown") if owner else "Unknown"
        cert_count = await db.certificates.count_documents({"event_id": str(e["_id"])})
        
        result.append({
            "id": str(e["_id"]),
            "name": e.get("name", "Unnamed Event"),
            "owner_email": owner_email,
            "cert_count": cert_count,
            "created_at": e.get("created_at", datetime.utcnow()).isoformat()
        })
    return result

@router.get("/failed-emails")
async def get_failed_emails(admin_user: Any = Depends(require_admin)):
    db = get_database()
    failed_certs = await db.certificates.find({"email_status": "failed"}).sort("issued_at", -1).limit(50).to_list(length=50)
    
    result = []
    for c in failed_certs:
        event = await db.events.find_one({"_id": ObjectId(c["event_id"])}) if ObjectId.is_valid(c["event_id"]) else None
        event_name = event.get("name", "Unknown") if event else "Unknown"
        
        result.append({
            "cert_id": c["id"],
            "recipient": c.get("participant_name", ""),
            "event_id": c["event_id"],
            "event_name": event_name,
            "failed_at": c.get("email_failed_at", datetime.utcnow()).isoformat(),
            "error_msg": c.get("email_error", "Unknown error")
        })
    return result

@router.get("/health-stats")
async def get_health_stats(admin_user: Any = Depends(require_admin)):
    db = get_database()
    
    today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    seven_days_ago = today - timedelta(days=7)
    
    emails_sent_today = await db.certificate_events.count_documents({
        "event_type": "emailed",
        "created_at": {"$gte": today}
    })
    
    certs_gen_today = await db.certificates.count_documents({
        "issued_at": {"$gte": today}
    })
    
    verifications_today = await db.certificate_events.count_documents({
        "event_type": "verified",
        "created_at": {"$gte": today}
    })
    
    # Very active users 7d
    active_users = len(await db.events.distinct("user_id", {"created_at": {"$gte": seven_days_ago}}))
    
    return {
        "emails_sent_today": emails_sent_today,
        "certs_generated_today": certs_gen_today,
        "verifications_today": verifications_today,
        "active_users_7d": active_users
    }

@router.get("/organizations", response_model=List[OrganizationOut])
async def list_organizations(admin_user: Any = Depends(require_admin)):
    db = get_database()
    orgs = await db.organizations.find().to_list(length=1000)
    for org in orgs:
        org["id"] = str(org["_id"])
    return orgs

class OrganizationUpdate(BaseModel):
    plan: str
    max_certs: int

@router.patch("/organizations/{org_id}", response_model=OrganizationOut)
async def update_organization(org_id: str, payload: OrganizationUpdate, admin_user: Any = Depends(require_admin)):
    db = get_database()
    if not ObjectId.is_valid(org_id):
        raise HTTPException(status_code=400, detail="Invalid organization ID")
        
    update_data = {"plan": payload.plan, "max_certs": payload.max_certs}
    
    result = await db.organizations.find_one_and_update(
        {"_id": ObjectId(org_id)},
        {"$set": update_data},
        return_document=True
    )
    
    if not result:
        raise HTTPException(status_code=404, detail="Organization not found")
        
    result["id"] = str(result["_id"])
    return result
