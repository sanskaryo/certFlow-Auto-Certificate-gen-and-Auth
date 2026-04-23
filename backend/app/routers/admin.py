from fastapi import APIRouter, Depends, HTTPException
from typing import Any, List, Optional
from datetime import datetime, timedelta, timezone
from bson import ObjectId
from pydantic import BaseModel, Field
from app.database import get_database
from app.routers.auth import get_current_user

router = APIRouter(prefix="/admin", tags=["admin"])

def require_admin(current_user: Any = Depends(get_current_user)):
    if current_user.get("role") not in ["superadmin", "admin"] and not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user

@router.get("/users")
async def get_all_users(
    skip: int = 0, 
    limit: int = 50,
    admin_user: Any = Depends(require_admin)
):
    db = get_database()
    
    # Using aggregation to get user data + event_count + cert_count in fewer calls
    pipeline = [
        {"$skip": skip},
        {"$limit": limit},
        {
            "$lookup": {
                "from": "events",
                "let": {"user_id_str": {"$toString": "$_id"}},
                "pipeline": [
                    {"$match": {"$expr": {"$eq": ["$user_id", "$$user_id_str"]}}},
                    {"$project": {"_id": 1}}
                ],
                "as": "user_events"
            }
        },
        {
            "$addFields": {
                "event_count": {"$size": "$user_events"},
                "event_ids": {"$map": {"input": "$user_events", "as": "e", "in": {"$toString": "$$e._id"}}}
            }
        },
        {
            "$lookup": {
                "from": "certificates",
                "let": {"e_ids": "$event_ids"},
                "pipeline": [
                    {"$match": {"$expr": {"$in": ["$event_id", "$$e_ids"]}}},
                    {"$count": "count"}
                ],
                "as": "cert_count_agg"
            }
        },
        {
            "$addFields": {
                "cert_count": {"$ifNull": [{"$arrayElemAt": ["$cert_count_agg.count", 0]}, 0]}
            }
        },
        {
            "$project": {
                "user_events": 0,
                "event_ids": 0,
                "cert_count_agg": 0,
                "hashed_password": 0
            }
        }
    ]
    
    cursor = db.users.aggregate(pipeline)
    users = await cursor.to_list(length=limit)
    
    result = []
    for u in users:
        result.append({
            "id": str(u["_id"]),
            "email": u.get("email", ""),
            "created_at": u.get("created_at", datetime.now(timezone.utc)).isoformat(),
            "event_count": u.get("event_count", 0),
            "cert_count": u.get("cert_count", 0),
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
async def get_recent_events(
    skip: int = 0,
    limit: int = 20,
    admin_user: Any = Depends(require_admin)
):
    db = get_database()
    
    pipeline = [
        {"$sort": {"created_at": -1}},
        {"$skip": skip},
        {"$limit": limit},
        {
            "$lookup": {
                "from": "users",
                "let": {"u_id": "$user_id"},
                "pipeline": [
                    {"$match": {"$expr": {"$eq": [{"$toString": "$_id"}, "$$u_id"]}}},
                    {"$project": {"email": 1}}
                ],
                "as": "owner"
            }
        },
        {
            "$lookup": {
                "from": "certificates",
                "let": {"e_id": {"$toString": "$_id"}},
                "pipeline": [
                    {"$match": {"$expr": {"$eq": ["$event_id", "$$e_id"]}}},
                    {"$count": "count"}
                ],
                "as": "certs"
            }
        },
        {
            "$addFields": {
                "owner_email": {"$ifNull": [{"$arrayElemAt": ["$owner.email", 0]}, "Unknown"]},
                "cert_count": {"$ifNull": [{"$arrayElemAt": ["$certs.count", 0]}, 0]}
            }
        }
    ]
    
    cursor = db.events.aggregate(pipeline)
    events = await cursor.to_list(length=limit)
    
    result = []
    for e in events:
        result.append({
            "id": str(e["_id"]),
            "name": e.get("name", "Unnamed Event"),
            "owner_email": e["owner_email"],
            "cert_count": e["cert_count"],
            "created_at": e.get("created_at", datetime.now(timezone.utc)).isoformat()
        })
    return result

@router.get("/failed-emails")
async def get_failed_emails(admin_user: Any = Depends(require_admin)):
    db = get_database()
    # Batch lookup for events to avoid N+1
    failed_certs = await db.certificates.find({"email_status": "failed"}).sort("issued_at", -1).limit(50).to_list(length=50)
    
    if not failed_certs:
        return []
        
    event_ids = list(set([ObjectId(c["event_id"]) for c in failed_certs if ObjectId.is_valid(c["event_id"])]))
    events_cursor = db.events.find({"_id": {"$in": event_ids}}, {"_id": 1, "name": 1})
    events_map = {str(e["_id"]): e.get("name", "Unknown") async for e in events_cursor}
    
    result = []
    for c in failed_certs:
        result.append({
            "cert_id": c.get("id") or str(c.get("_id")),
            "recipient": c.get("participant_name", ""),
            "event_id": c["event_id"],
            "event_name": events_map.get(c["event_id"], "Unknown"),
            "failed_at": c.get("email_failed_at", datetime.now(timezone.utc)).isoformat(),
            "error_msg": c.get("email_error", "Unknown error")
        })
    return result

@router.get("/health-stats")
async def get_health_stats(admin_user: Any = Depends(require_admin)):
    db = get_database()
    
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    seven_days_ago = today_start - timedelta(days=7)
    
    emails_sent_today = await db.certificate_events.count_documents({
        "event_type": "emailed",
        "created_at": {"$gte": today_start}
    })
    
    certs_gen_today = await db.certificates.count_documents({
        "issued_at": {"$gte": today_start}
    })
    
    verifications_today = await db.certificate_events.count_documents({
        "event_type": "verified",
        "created_at": {"$gte": today_start}
    })
    
    active_users = len(await db.events.distinct("user_id", {"created_at": {"$gte": seven_days_ago}}))
    
    return {
        "emails_sent_today": emails_sent_today,
        "certs_generated_today": certs_gen_today,
        "verifications_today": verifications_today,
        "active_users_7d": active_users
    }
