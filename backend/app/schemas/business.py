import uuid
from datetime import datetime

from pydantic import BaseModel


class BusinessResponse(BaseModel):
    id: uuid.UUID
    name: str
    slug: str
    google_place_id: str | None = None
    industry: str | None = None
    phone: str | None = None
    email: str
    address: str | None = None
    timezone: str
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class BusinessUpdate(BaseModel):
    name: str | None = None
    google_place_id: str | None = None
    industry: str | None = None
    phone: str | None = None
    address: str | None = None
    timezone: str | None = None


class BrandingResponse(BaseModel):
    id: uuid.UUID
    logo_url: str | None = None
    primary_color: str
    secondary_color: str
    avatar_style: str
    welcome_message: str
    thank_you_message: str

    model_config = {"from_attributes": True}


class BrandingUpdate(BaseModel):
    primary_color: str | None = None
    secondary_color: str | None = None
    avatar_style: str | None = None
    welcome_message: str | None = None
    thank_you_message: str | None = None


class RewardTemplateResponse(BaseModel):
    id: uuid.UUID
    name: str
    reward_type: str
    reward_value: str
    is_active: bool
    expiry_days: int

    model_config = {"from_attributes": True}


class RewardTemplateCreate(BaseModel):
    name: str
    reward_type: str
    reward_value: str
    expiry_days: int = 365


class RewardTemplateUpdate(BaseModel):
    name: str | None = None
    reward_type: str | None = None
    reward_value: str | None = None
    is_active: bool | None = None
    expiry_days: int | None = None


class StatsResponse(BaseModel):
    total_sessions: int
    completed_feedbacks: int
    google_reviews: int
    complaints: int
