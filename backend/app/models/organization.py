from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class OrganizationBase(BaseModel):
    name: str = Field(..., min_length=2)
    plan: str = Field(default="free") # "free", "pro", "premium"
    max_certs: int = Field(default=100)
    certs_issued: int = Field(default=0)

class OrganizationCreate(OrganizationBase):
    owner_user_id: str

class OrganizationInDB(OrganizationBase):
    id: str
    owner_user_id: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

class OrganizationOut(OrganizationBase):
    id: str
    owner_user_id: str
    created_at: datetime
