from fastapi import APIRouter, Depends, HTTPException
from typing import Any
from app.database import get_database
from app.routers.auth import get_current_user

router = APIRouter(prefix="/analytics", tags=["analytics"])

@router.get("/dashboard")
async def get_dashboard_analytics(current_user: Any = Depends(get_current_user)):
    db = get_database()
    user_id = str(current_user.get("_id"))
    
    events = await db.events.find({"user_id": user_id}).to_list(length=None)
    event_ids = [str(e["_id"]) for e in events]
    
    total_events = len(event_ids)
    
    certs = await db.certificates.find({"event_id": {"$in": event_ids}}).to_list(length=None)
    cert_ids = [c["id"] for c in certs]
    
    total_issued = len(certs)
    
    verified = await db.certificate_events.count_documents({"cert_id": {"$in": cert_ids}, "event_type": "verified"}) if cert_ids else 0
    opened = await db.certificate_events.count_documents({"cert_id": {"$in": cert_ids}, "event_type": "opened"}) if cert_ids else 0
    emailed = await db.certificate_events.count_documents({"cert_id": {"$in": cert_ids}, "event_type": "emailed"}) if cert_ids else 0
    
    return {
        "total_events": total_events,
        "total_issued": total_issued,
        "total_verified": verified,
        "total_opened": opened,
        "total_emailed": emailed
    }

@router.get("/admin")
async def get_admin_analytics(current_user: Any = Depends(get_current_user)):
    # Assuming role field indicates overall admin status
    if current_user.get("role") != "superadmin" and current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
        
    db = get_database()
    
    total_users = await db.users.count_documents({})
    total_events = await db.events.count_documents({})
    total_certs = await db.certificates.count_documents({})
    
    verified = await db.certificate_events.count_documents({"event_type": "verified"})
    opened = await db.certificate_events.count_documents({"event_type": "opened"})
    emailed = await db.certificate_events.count_documents({"event_type": "emailed"})
    
    recent_events = await db.events.find().sort("created_at", -1).limit(5).to_list(length=5)
    recent_events_formatted = [{"id": str(e["_id"]), "name": e.get("name")} for e in recent_events]
    
    return {
        "total_users": total_users,
        "total_events": total_events,
        "total_certs": total_certs,
        "total_verified": verified,
        "total_opened": opened,
        "total_emailed": emailed,
        "recent_events": recent_events_formatted
    }
