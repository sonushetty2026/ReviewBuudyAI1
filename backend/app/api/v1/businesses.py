import io
import uuid

import qrcode
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.config import get_settings
from app.core.exceptions import NotFound
from app.database import get_db
from app.models.business import Business, BusinessBranding
from app.models.feedback import Complaint, FeedbackSession, GoogleReviewTracking
from app.models.reward import RewardTemplate
from app.models.user import BusinessUser
from app.schemas.business import (
    BrandingResponse,
    BrandingUpdate,
    BusinessResponse,
    BusinessUpdate,
    RewardTemplateCreate,
    RewardTemplateResponse,
    RewardTemplateUpdate,
    StatsResponse,
)

router = APIRouter(prefix="/businesses", tags=["businesses"])


@router.get("/me", response_model=BusinessResponse)
async def get_my_business(
    current_user: BusinessUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Business).where(Business.id == current_user.business_id)
    )
    business = result.scalar_one_or_none()
    if not business:
        raise NotFound("Business")
    return business


@router.put("/me", response_model=BusinessResponse)
async def update_my_business(
    body: BusinessUpdate,
    current_user: BusinessUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Business).where(Business.id == current_user.business_id)
    )
    business = result.scalar_one_or_none()
    if not business:
        raise NotFound("Business")

    update_data = body.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(business, field, value)

    await db.commit()
    await db.refresh(business)
    return business


@router.get("/me/branding", response_model=BrandingResponse)
async def get_branding(
    current_user: BusinessUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(BusinessBranding).where(
            BusinessBranding.business_id == current_user.business_id
        )
    )
    branding = result.scalar_one_or_none()
    if not branding:
        raise NotFound("Branding")
    return branding


@router.put("/me/branding", response_model=BrandingResponse)
async def update_branding(
    body: BrandingUpdate,
    current_user: BusinessUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(BusinessBranding).where(
            BusinessBranding.business_id == current_user.business_id
        )
    )
    branding = result.scalar_one_or_none()
    if not branding:
        raise NotFound("Branding")

    update_data = body.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(branding, field, value)

    await db.commit()
    await db.refresh(branding)
    return branding


# --- Reward Template CRUD ---


@router.get("/me/rewards", response_model=list[RewardTemplateResponse])
async def list_reward_templates(
    current_user: BusinessUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(RewardTemplate)
        .where(RewardTemplate.business_id == current_user.business_id)
        .order_by(RewardTemplate.created_at.desc())
    )
    return result.scalars().all()


@router.post("/me/rewards", response_model=RewardTemplateResponse, status_code=201)
async def create_reward_template(
    body: RewardTemplateCreate,
    current_user: BusinessUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    template = RewardTemplate(
        business_id=current_user.business_id,
        name=body.name,
        reward_type=body.reward_type,
        reward_value=body.reward_value,
        expiry_days=body.expiry_days,
    )
    db.add(template)
    await db.commit()
    await db.refresh(template)
    return template


@router.put("/me/rewards/{reward_id}", response_model=RewardTemplateResponse)
async def update_reward_template(
    reward_id: uuid.UUID,
    body: RewardTemplateUpdate,
    current_user: BusinessUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(RewardTemplate).where(
            RewardTemplate.id == reward_id,
            RewardTemplate.business_id == current_user.business_id,
        )
    )
    template = result.scalar_one_or_none()
    if not template:
        raise NotFound("Reward template")

    update_data = body.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(template, field, value)

    await db.commit()
    await db.refresh(template)
    return template


@router.delete("/me/rewards/{reward_id}", status_code=204)
async def delete_reward_template(
    reward_id: uuid.UUID,
    current_user: BusinessUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(RewardTemplate).where(
            RewardTemplate.id == reward_id,
            RewardTemplate.business_id == current_user.business_id,
        )
    )
    template = result.scalar_one_or_none()
    if not template:
        raise NotFound("Reward template")

    template.is_active = False
    await db.commit()


# --- Stats ---


@router.get("/me/stats", response_model=StatsResponse)
async def get_stats(
    current_user: BusinessUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    biz_id = current_user.business_id

    total_sessions = (
        await db.execute(
            select(func.count()).where(FeedbackSession.business_id == biz_id)
        )
    ).scalar() or 0

    completed_feedbacks = (
        await db.execute(
            select(func.count()).where(
                FeedbackSession.business_id == biz_id,
                FeedbackSession.status == "completed",
            )
        )
    ).scalar() or 0

    google_reviews = (
        await db.execute(
            select(func.count())
            .select_from(GoogleReviewTracking)
            .join(FeedbackSession, GoogleReviewTracking.session_id == FeedbackSession.id)
            .where(
                FeedbackSession.business_id == biz_id,
                GoogleReviewTracking.consent_given == True,  # noqa: E712
            )
        )
    ).scalar() or 0

    complaints_count = (
        await db.execute(
            select(func.count()).where(Complaint.business_id == biz_id)
        )
    ).scalar() or 0

    return StatsResponse(
        total_sessions=total_sessions,
        completed_feedbacks=completed_feedbacks,
        google_reviews=google_reviews,
        complaints=complaints_count,
    )


# --- QR Code ---


@router.get("/me/qr-code")
async def get_qr_code(
    current_user: BusinessUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Business).where(Business.id == current_user.business_id)
    )
    business = result.scalar_one_or_none()
    if not business:
        raise NotFound("Business")

    settings = get_settings()
    url = f"{settings.base_url}/c/{business.slug}"

    qr = qrcode.QRCode(version=1, box_size=10, border=4)
    qr.add_data(url)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")

    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)

    return StreamingResponse(buf, media_type="image/png")
