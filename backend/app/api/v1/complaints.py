import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.exceptions import NotFound
from app.database import get_db
from app.models.feedback import Complaint, FeedbackSession
from app.models.user import BusinessUser
from app.schemas.complaint import (
    ComplaintDetailResponse,
    ComplaintListResponse,
    ComplaintUpdateRequest,
)

router = APIRouter(
    prefix="/dashboard/complaints",
    tags=["dashboard-complaints"],
)


@router.get("", response_model=list[ComplaintListResponse])
async def list_complaints(
    status: str | None = Query(None),
    priority: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user: BusinessUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = (
        select(Complaint, FeedbackSession)
        .join(FeedbackSession, Complaint.session_id == FeedbackSession.id)
        .where(Complaint.business_id == user.business_id)
        .order_by(Complaint.created_at.desc())
    )

    if status:
        query = query.where(Complaint.status == status)
    if priority:
        query = query.where(Complaint.priority == priority)

    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    rows = result.all()

    return [
        ComplaintListResponse(
            id=complaint.id,
            session_id=complaint.session_id,
            status=complaint.status,
            priority=complaint.priority,
            summary=complaint.summary,
            customer_name=session.customer_name,
            customer_phone=session.customer_phone,
            customer_email=session.customer_email,
            created_at=complaint.created_at,
        )
        for complaint, session in rows
    ]


@router.get("/{complaint_id}", response_model=ComplaintDetailResponse)
async def get_complaint(
    complaint_id: uuid.UUID,
    user: BusinessUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Complaint, FeedbackSession)
        .join(FeedbackSession, Complaint.session_id == FeedbackSession.id)
        .where(Complaint.id == complaint_id, Complaint.business_id == user.business_id)
    )
    row = result.one_or_none()
    if not row:
        raise NotFound("Complaint")

    complaint, session = row

    return ComplaintDetailResponse(
        id=complaint.id,
        session_id=complaint.session_id,
        business_id=complaint.business_id,
        status=complaint.status,
        priority=complaint.priority,
        summary=complaint.summary,
        resolution_notes=complaint.resolution_notes,
        assigned_to=complaint.assigned_to,
        resolved_at=complaint.resolved_at,
        customer_name=session.customer_name,
        customer_phone=session.customer_phone,
        customer_email=session.customer_email,
        created_at=complaint.created_at,
        updated_at=complaint.updated_at,
    )


@router.put("/{complaint_id}", response_model=ComplaintDetailResponse)
async def update_complaint(
    complaint_id: uuid.UUID,
    body: ComplaintUpdateRequest,
    user: BusinessUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Complaint).where(
            Complaint.id == complaint_id,
            Complaint.business_id == user.business_id,
        )
    )
    complaint = result.scalar_one_or_none()
    if not complaint:
        raise NotFound("Complaint")

    if body.status is not None:
        complaint.status = body.status
        if body.status == "resolved":
            complaint.resolved_at = datetime.now(timezone.utc)
    if body.priority is not None:
        complaint.priority = body.priority
    if body.resolution_notes is not None:
        complaint.resolution_notes = body.resolution_notes

    await db.commit()
    await db.refresh(complaint)

    # Get session for contact info
    sess_result = await db.execute(
        select(FeedbackSession).where(FeedbackSession.id == complaint.session_id)
    )
    session = sess_result.scalar_one()

    return ComplaintDetailResponse(
        id=complaint.id,
        session_id=complaint.session_id,
        business_id=complaint.business_id,
        status=complaint.status,
        priority=complaint.priority,
        summary=complaint.summary,
        resolution_notes=complaint.resolution_notes,
        assigned_to=complaint.assigned_to,
        resolved_at=complaint.resolved_at,
        customer_name=session.customer_name,
        customer_phone=session.customer_phone,
        customer_email=session.customer_email,
        created_at=complaint.created_at,
        updated_at=complaint.updated_at,
    )
