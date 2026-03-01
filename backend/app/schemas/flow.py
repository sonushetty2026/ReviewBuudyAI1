import uuid
from datetime import datetime

from pydantic import BaseModel


# --- Request schemas ---

class StartSessionRequest(BaseModel):
    visitor_id: str
    request_id: str = ""
    input_mode: str = "voice"  # "voice" or "text"
    presentation_mode: str = "fast"  # "fast" or "camera"


class SendMessageRequest(BaseModel):
    content: str
    source: str = "text"  # "voice" or "text"


class ConfirmReviewRequest(BaseModel):
    review_text: str


class ConsentRequest(BaseModel):
    consent_website: bool = False
    consent_google: bool = False


class GoogleStatusRequest(BaseModel):
    posted: bool


class RewardRequest(BaseModel):
    send_sms: bool = False
    phone: str | None = None


class ContactInfoRequest(BaseModel):
    name: str | None = None
    phone: str | None = None
    email: str | None = None


# --- Response schemas ---

class FlowBrandingResponse(BaseModel):
    primary_color: str
    secondary_color: str
    avatar_style: str
    welcome_message: str
    thank_you_message: str
    logo_url: str | None = None

    model_config = {"from_attributes": True}


class FlowBusinessResponse(BaseModel):
    id: uuid.UUID
    name: str
    slug: str
    branding: FlowBrandingResponse

    model_config = {"from_attributes": True}


class SessionResponse(BaseModel):
    id: uuid.UUID
    status: str
    greeting: str

    model_config = {"from_attributes": True}


class MessageResponse(BaseModel):
    text: str
    state: str
    ready_to_complete: bool
    sequence: int


class CompleteResponse(BaseModel):
    sentiment_label: str
    star_rating: int
    summary: str
    rewritten_review: str | None = None
    flow: str  # "positive" | "negative" | "neutral"


class ReviewConfirmResponse(BaseModel):
    confirmed: bool


class ConsentResponse(BaseModel):
    google_review_url: str | None = None


class RewardResponse(BaseModel):
    code: str
    description: str
    expires_at: datetime | None = None
    sms_sent: bool = False
