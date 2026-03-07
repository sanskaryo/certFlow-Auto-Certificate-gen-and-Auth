from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class EventBase(BaseModel):
    name: str = Field(..., min_length=2)
    description: Optional[str] = None
    date: datetime
    organization_id: Optional[str] = None # Or derived from user

class EventCreate(EventBase):
    pass

class EventInDB(EventBase):
    id: str
    user_id: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

class EventOut(EventBase):
    id: str
    user_id: str
    created_at: datetime
