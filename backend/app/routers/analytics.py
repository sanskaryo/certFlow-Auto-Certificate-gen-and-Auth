from fastapi import APIRouter, Depends, HTTPException
from typing import Any
from app.database import get_database
from app.routers.auth import get_current_user

router = APIRouter(prefix="/analytics", tags=["analytics"])

@router.get("/dashboard")
async def get_dashboard_analytics(current_user: Any = Depends(get_current_user)):
    db = get_database()
    user_id = str(current_user.get("_id"))
    
    # 1. Total events owned by user
    total_events = await db.events.count_documents({"user_id": user_id})
    
    # 2. Total certificates issued for those events (using aggregation)
    # This is much faster than fetching all certs in memory
    pipeline = [
        {"$match": {"user_id": user_id}},
        {"$project": {"_id": 1}},
        {
            "$lookup": {
                "from": "certificates",
                "let": {"e_id": {"$toString": "$_id"}},
                "pipeline": [
                    {"$match": {"$expr": {"$eq": ["$event_id", "$$e_id"]}}},
                    {"$project": {"id": 1}}
                ],
                "as": "event_certs"
            }
        },
        {"$unwind": "$event_certs"},
        {
            "$lookup": {
                "from": "certificate_events",
                "localField": "event_certs.id",
                "foreignField": "cert_id",
                "as": "activity"
            }
        },
        {"$unwind": {"path": "$activity", "preserveNullAndEmptyArrays": True}}
    ]
    
    # Actually, simpler to just get the cert IDs first and then aggregate events
    events = await db.events.find({"user_id": user_id}, {"_id": 1}).to_list(length=None)
    event_ids = [str(e["_id"]) for e in events]
    
    if not event_ids:
        return {
            "total_events": 0, "total_issued": 0, "total_verified": 0,
            "total_opened": 0, "total_emailed": 0
        }
        
    total_issued = await db.certificates.count_documents({"event_id": {"$in": event_ids}})
    
    # Aggregated counts for activity
    # We need to find certificate_events where cert_id is in (certs of these events)
    # A cleaner aggregation:
    certs = await db.certificates.find({"event_id": {"$in": event_ids}}, {"id": 1}).to_list(length=None)
    cert_ids = [c["id"] for c in certs]
    
    if not cert_ids:
        return {
            "total_events": total_events, "total_issued": 0, "total_verified": 0,
            "total_opened": 0, "total_emailed": 0
        }

    activity_counts = await db.certificate_events.aggregate([
        {"$match": {"cert_id": {"$in": cert_ids}}},
        {"$group": {"_id": "$event_type", "count": {"$sum": 1}}}
    ]).to_list(length=None)
    
    counts = {a["_id"]: a["count"] for a in activity_counts}
    
    return {
        "total_events": total_events,
        "total_issued": total_issued,
        "total_verified": counts.get("verified", 0),
        "total_opened": counts.get("opened", 0),
        "total_emailed": counts.get("emailed", 0)
    }

@router.get("/admin")
async def get_admin_analytics(current_user: Any = Depends(get_current_user)):
    if current_user.get("role") not in ["superadmin", "admin"] and not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Not authorized")
        
    db = get_database()
    
    total_users = await db.users.count_documents({})
    total_events = await db.events.count_documents({})
    total_certs = await db.certificates.count_documents({})
    
    activity_counts = await db.certificate_events.aggregate([
        {"$group": {"_id": "$event_type", "count": {"$sum": 1}}}
    ]).to_list(length=None)
    
    counts = {a["_id"]: a["count"] for a in activity_counts}
    
    recent_events = await db.events.find().sort("created_at", -1).limit(5).to_list(length=5)
    recent_events_formatted = [{"id": str(e["_id"]), "name": e.get("name")} for e in recent_events]
    
    return {
        "total_users": total_users,
        "total_events": total_events,
        "total_certs": total_certs,
        "total_verified": counts.get("verified", 0),
        "total_opened": counts.get("opened", 0),
        "total_emailed": counts.get("emailed", 0),
        "recent_events": recent_events_formatted
    }
