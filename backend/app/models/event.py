from pydantic import BaseModel, Field
from typing import Any, Optional
from datetime import datetime

class EventBase(BaseModel):
    name: str = Field(..., min_length=2)
    description: Optional[str] = None
    date: datetime
    organization: str = Field(default="Event Organizer", min_length=2)
    organization_id: Optional[str] = None # Or derived from user
    logo_path: Optional[str] = None
    signature_path: Optional[str] = None
    authority_name: Optional[str] = None
    authority_position: Optional[str] = None
    certificate_layout: Optional[dict[str, Any]] = None

class EventCreate(EventBase):
    pass

class EventInDB(EventBase):
    id: str
    user_id: str
    organization_id: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

class EventOut(EventBase):
    id: str
    user_id: str
    organization_id: Optional[str] = None
    created_at: datetime
