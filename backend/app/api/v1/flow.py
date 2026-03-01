import logging
import uuid
from datetime import datetime, timezone

import httpx
from fastapi import APIRouter, Depends, Request, WebSocket
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import get_settings
from app.core.exceptions import NotFound, RateLimited
from app.database import get_db
from app.models.business import Business, BusinessBranding
from app.models.feedback import (
    Complaint,
    ConversationMessage,
    FeedbackSession,
    GoogleReviewTracking,
)
from app.schemas.flow import (
    CompleteResponse,
    ConfirmReviewRequest,
    ConsentRequest,
    ConsentResponse,
    ContactInfoRequest,
    FlowBrandingResponse,
    FlowBusinessResponse,
    GoogleStatusRequest,
    MessageResponse,
    ReviewConfirmResponse,
    RewardRequest,
    RewardResponse,
    SendMessageRequest,
    SessionResponse,
    StartSessionRequest,
)
from app.services import (
    ai_conversation,
    deepgram_proxy,
    email_service,
    fingerprint_service,
    review_writer,
    reward_service,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/flow", tags=["customer-flow"])


# --- Helpers ---

async def _get_business_by_slug(slug: str, db: AsyncSession) -> Business:
    result = await db.execute(
        select(Business)
        .options(selectinload(Business.branding))
        .where(Business.slug == slug, Business.is_active == True)  # noqa: E712
    )
    business = result.scalar_one_or_none()
    if not business:
        raise NotFound("Business")
    return business


async def _get_session(session_id: uuid.UUID, db: AsyncSession) -> FeedbackSession:
    result = await db.execute(
        select(FeedbackSession).where(FeedbackSession.id == session_id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise NotFound("Session")
    return session


# --- Endpoints ---

@router.get("/heygen-token")
async def get_heygen_token():
    settings = get_settings()
    if not settings.heygen_api_key:
        raise NotFound("HeyGen API key not configured")

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            "https://api.heygen.com/v1/streaming.create_token",
            headers={"x-api-key": settings.heygen_api_key},
        )
        resp.raise_for_status()
        data = resp.json()

    return {"token": data.get("data", {}).get("token", data.get("token", ""))}


@router.get("/{slug}", response_model=FlowBusinessResponse)
async def get_business_for_flow(slug: str, db: AsyncSession = Depends(get_db)):
    business = await _get_business_by_slug(slug, db)
    branding = business.branding
    return FlowBusinessResponse(
        id=business.id,
        name=business.name,
        slug=business.slug,
        branding=FlowBrandingResponse(
            primary_color=branding.primary_color if branding else "#4F46E5",
            secondary_color=branding.secondary_color if branding else "#10B981",
            avatar_style=branding.avatar_style if branding else "friendly",
            welcome_message=branding.welcome_message if branding else "How was your experience?",
            thank_you_message=branding.thank_you_message if branding else "Thanks for your feedback!",
            logo_url=branding.logo_url if branding else None,
        ),
    )


@router.post("/{slug}/start", response_model=SessionResponse)
async def start_session(
    slug: str,
    body: StartSessionRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    business = await _get_business_by_slug(slug, db)

    # Fingerprint verification
    if body.request_id:
        fp_result = await fingerprint_service.verify_fingerprint(body.visitor_id, body.request_id)
        if not fp_result.get("valid"):
            raise RateLimited("Invalid device fingerprint")

    # Rate limit check
    rate = await fingerprint_service.check_rate_limit(body.visitor_id, db)
    if not rate["allowed"]:
        raise RateLimited(
            f"Rate limit exceeded. Max {rate['max_allowed']} sessions per 24 hours."
        )

    # Create session
    branding = business.branding
    session = FeedbackSession(
        business_id=business.id,
        status="active",
        presentation_mode=body.presentation_mode,
        device_fingerprint=body.visitor_id,
        ip_address=request.client.host if request.client else None,
    )
    db.add(session)
    await db.flush()

    # Generate greeting
    try:
        greeting_response = await ai_conversation.get_conversation_response(
            messages=[{"role": "user", "content": "Start the conversation."}],
            business_name=business.name,
            avatar_style=branding.avatar_style if branding else "friendly",
            welcome_message=branding.welcome_message if branding else "",
        )
    except Exception as e:
        logger.error(f"AI greeting generation failed: {e}", exc_info=True)
        welcome = branding.welcome_message if branding and branding.welcome_message else "How was your experience today?"
        greeting_response = {
            "text": f"Welcome to {business.name}! {welcome}",
            "state": "greeting",
            "ready_to_complete": False,
        }

    greeting_msg = ConversationMessage(
        session_id=session.id,
        role="assistant",
        content=greeting_response["text"],
        source="text",
        sequence=1,
    )
    db.add(greeting_msg)
    await db.commit()

    return SessionResponse(
        id=session.id,
        status=session.status,
        greeting=greeting_response["text"],
    )


@router.post("/session/{session_id}/message", response_model=MessageResponse)
async def send_message(
    session_id: uuid.UUID,
    body: SendMessageRequest,
    db: AsyncSession = Depends(get_db),
):
    session = await _get_session(session_id, db)

    if session.status == "completed":
        raise NotFound("Session is already completed")

    # Check profanity
    if ai_conversation.check_profanity(body.content):
        return MessageResponse(
            text="I'd love to hear about your experience, but let's keep things respectful. What did you think of your visit?",
            state="listening",
            ready_to_complete=False,
            sequence=0,
        )

    # Get existing messages
    result = await db.execute(
        select(ConversationMessage)
        .where(ConversationMessage.session_id == session_id)
        .order_by(ConversationMessage.sequence)
    )
    existing = result.scalars().all()
    next_seq = len(existing) + 1

    # Store customer message
    customer_msg = ConversationMessage(
        session_id=session_id,
        role="user",
        content=body.content,
        source=body.source,
        sequence=next_seq,
    )
    db.add(customer_msg)

    # Build message history for Claude
    messages = []
    for msg in existing:
        messages.append({"role": msg.role, "content": msg.content})
    messages.append({"role": "user", "content": body.content})

    # Get business info for prompt
    biz_result = await db.execute(
        select(Business)
        .options(selectinload(Business.branding))
        .where(Business.id == session.business_id)
    )
    business = biz_result.scalar_one()
    branding = business.branding

    # Count customer messages
    customer_count = sum(1 for m in messages if m["role"] == "user")

    response = await ai_conversation.get_conversation_response(
        messages=messages,
        business_name=business.name,
        avatar_style=branding.avatar_style if branding else "friendly",
        welcome_message=branding.welcome_message if branding else "",
        message_count=customer_count,
    )

    # Store assistant response
    assistant_msg = ConversationMessage(
        session_id=session_id,
        role="assistant",
        content=response["text"],
        source="text",
        sequence=next_seq + 1,
    )
    db.add(assistant_msg)
    await db.commit()

    return MessageResponse(
        text=response["text"],
        state=response["state"],
        ready_to_complete=response["ready_to_complete"],
        sequence=next_seq + 1,
    )


@router.post("/session/{session_id}/complete", response_model=CompleteResponse)
async def complete_session(
    session_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    session = await _get_session(session_id, db)

    # Get conversation text
    result = await db.execute(
        select(ConversationMessage)
        .where(ConversationMessage.session_id == session_id)
        .order_by(ConversationMessage.sequence)
    )
    messages = result.scalars().all()
    conversation_text = "\n".join(
        f"{'Customer' if m.role == 'user' else 'Assistant'}: {m.content}"
        for m in messages
    )

    # Get business
    biz_result = await db.execute(
        select(Business)
        .options(selectinload(Business.branding))
        .where(Business.id == session.business_id)
    )
    business = biz_result.scalar_one()

    # Analyze sentiment
    analysis = await ai_conversation.analyze_sentiment_and_extract(
        conversation_text, business.name
    )

    # Update session
    session.status = "completed"
    session.sentiment_label = analysis["sentiment_label"]
    session.sentiment_score = analysis.get("sentiment_score", 0)
    session.star_rating = analysis["star_rating"]
    session.key_topics = analysis.get("key_topics", [])
    session.original_text = conversation_text
    session.completed_at = datetime.now(timezone.utc)

    flow = "positive"
    rewritten = None

    if analysis["sentiment_label"] == "positive" and analysis["star_rating"] >= 4:
        # Positive flow: rewrite review
        rewritten = await review_writer.rewrite_review(
            conversation_text=conversation_text,
            business_name=business.name,
            star_rating=analysis["star_rating"],
            key_topics=analysis.get("key_topics", []),
        )
        session.rewritten_review = rewritten
    else:
        # Negative flow: create complaint
        flow = "negative"
        priority = "medium"
        if analysis["star_rating"] <= 1:
            priority = "urgent"
        elif analysis["star_rating"] <= 2:
            priority = "high"

        complaint = Complaint(
            session_id=session_id,
            business_id=business.id,
            status="new",
            priority=priority,
            summary=analysis.get("summary", "Customer reported a negative experience."),
        )
        db.add(complaint)
        await db.flush()

        # Send email notification
        if business.email:
            await email_service.send_complaint_notification(
                business_email=business.email,
                business_name=business.name,
                complaint_summary=analysis.get("summary", ""),
                customer_name=session.customer_name,
                customer_phone=session.customer_phone,
                customer_email=session.customer_email,
                complaint_id=complaint.id,
                session_created_at=session.created_at,
            )

    await db.commit()

    return CompleteResponse(
        sentiment_label=analysis["sentiment_label"],
        star_rating=analysis["star_rating"],
        summary=analysis.get("summary", ""),
        rewritten_review=rewritten,
        flow=flow,
    )


@router.post("/session/{session_id}/confirm-review", response_model=ReviewConfirmResponse)
async def confirm_review(
    session_id: uuid.UUID,
    body: ConfirmReviewRequest,
    db: AsyncSession = Depends(get_db),
):
    session = await _get_session(session_id, db)
    session.rewritten_review = body.review_text
    session.customer_approved_review = True
    await db.commit()

    return ReviewConfirmResponse(confirmed=True)


@router.post("/session/{session_id}/consent", response_model=ConsentResponse)
async def submit_consent(
    session_id: uuid.UUID,
    body: ConsentRequest,
    db: AsyncSession = Depends(get_db),
):
    session = await _get_session(session_id, db)

    google_url = None

    if body.consent_google:
        # Get business for google_place_id
        biz_result = await db.execute(
            select(Business).where(Business.id == session.business_id)
        )
        business = biz_result.scalar_one()

        review_text = session.rewritten_review or ""

        tracking = GoogleReviewTracking(
            session_id=session_id,
            review_text=review_text,
            consent_given=True,
        )
        db.add(tracking)

        if business.google_place_id:
            google_url = f"https://search.google.com/local/writereview?placeid={business.google_place_id}"

    await db.commit()

    return ConsentResponse(google_review_url=google_url)


@router.post("/session/{session_id}/google-clicked")
async def record_google_clicked(
    session_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(GoogleReviewTracking).where(GoogleReviewTracking.session_id == session_id)
    )
    tracking = result.scalar_one_or_none()
    if tracking:
        tracking.link_clicked = True
        tracking.clicked_at = datetime.now(timezone.utc)
        await db.commit()

    return {"ok": True}


@router.post("/session/{session_id}/google-status")
async def record_google_status(
    session_id: uuid.UUID,
    body: GoogleStatusRequest,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(GoogleReviewTracking).where(GoogleReviewTracking.session_id == session_id)
    )
    tracking = result.scalar_one_or_none()
    if tracking:
        tracking.self_reported_posted = body.posted
        await db.commit()

    return {"ok": True}


@router.post("/session/{session_id}/contact")
async def submit_contact_info(
    session_id: uuid.UUID,
    body: ContactInfoRequest,
    db: AsyncSession = Depends(get_db),
):
    session = await _get_session(session_id, db)
    if body.name:
        session.customer_name = body.name
    if body.phone:
        session.customer_phone = body.phone
    if body.email:
        session.customer_email = body.email

    # Update complaint with contact info if exists
    result = await db.execute(
        select(Complaint).where(Complaint.session_id == session_id)
    )
    complaint = result.scalar_one_or_none()

    await db.commit()

    # If complaint exists and we now have contact info, send updated email
    if complaint and (body.name or body.phone or body.email):
        biz_result = await db.execute(
            select(Business).where(Business.id == session.business_id)
        )
        business = biz_result.scalar_one()
        if business.email:
            await email_service.send_complaint_notification(
                business_email=business.email,
                business_name=business.name,
                complaint_summary=complaint.summary,
                customer_name=session.customer_name,
                customer_phone=session.customer_phone,
                customer_email=session.customer_email,
                complaint_id=complaint.id,
                session_created_at=session.created_at,
            )

    return {"ok": True}


@router.post("/session/{session_id}/reward", response_model=RewardResponse)
async def claim_reward(
    session_id: uuid.UUID,
    body: RewardRequest,
    db: AsyncSession = Depends(get_db),
):
    session = await _get_session(session_id, db)

    reward = await reward_service.create_reward(session_id, session.business_id, db)
    if not reward:
        raise NotFound("No active reward template found")

    sms_sent = False
    if body.send_sms and body.phone:
        # Get business name
        biz_result = await db.execute(
            select(Business).where(Business.id == session.business_id)
        )
        business = biz_result.scalar_one()

        sms_sent = await reward_service.send_reward_sms(
            phone=body.phone,
            code=reward.code,
            reward_description=reward.reward_description,
            business_name=business.name,
        )
        if sms_sent:
            reward.sent_via = "sms"

    await db.commit()

    return RewardResponse(
        code=reward.code,
        description=reward.reward_description,
        expires_at=reward.expires_at,
        sms_sent=sms_sent,
    )


@router.websocket("/session/{session_id}/audio-stream")
async def audio_stream(
    websocket: WebSocket,
    session_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    await websocket.accept()
    await deepgram_proxy.handle_audio_stream(websocket, session_id, db)
