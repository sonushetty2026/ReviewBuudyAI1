import uuid
from datetime import datetime

from pydantic import BaseModel


class ComplaintListResponse(BaseModel):
    id: uuid.UUID
    session_id: uuid.UUID
    status: str
    priority: str
    summary: str
    customer_name: str | None = None
    customer_phone: str | None = None
    customer_email: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class ComplaintDetailResponse(BaseModel):
    id: uuid.UUID
    session_id: uuid.UUID
    business_id: uuid.UUID
    status: str
    priority: str
    summary: str
    resolution_notes: str | None = None
    assigned_to: uuid.UUID | None = None
    resolved_at: datetime | None = None
    customer_name: str | None = None
    customer_phone: str | None = None
    customer_email: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ComplaintUpdateRequest(BaseModel):
    status: str | None = None
    priority: str | None = None
    resolution_notes: str | None = None
