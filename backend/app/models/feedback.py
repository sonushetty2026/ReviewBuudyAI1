import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin


class FeedbackSession(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "feedback_sessions"

    business_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("businesses.id"), nullable=False, index=True
    )
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="started")
    sentiment_label: Mapped[str | None] = mapped_column(String(20))
    sentiment_score: Mapped[float | None] = mapped_column(Float)
    star_rating: Mapped[int | None] = mapped_column(Integer)
    key_topics: Mapped[dict | None] = mapped_column(JSONB)
    original_text: Mapped[str | None] = mapped_column(Text)
    rewritten_review: Mapped[str | None] = mapped_column(Text)
    customer_approved_review: Mapped[bool] = mapped_column(Boolean, default=False)
    customer_name: Mapped[str | None] = mapped_column(String(255))
    customer_phone: Mapped[str | None] = mapped_column(String(20))
    customer_email: Mapped[str | None] = mapped_column(String(255))
    device_fingerprint: Mapped[str | None] = mapped_column(String(255))
    ip_address: Mapped[str | None] = mapped_column(String(45))
    device_info: Mapped[dict | None] = mapped_column(JSONB)
    is_billed: Mapped[bool] = mapped_column(Boolean, default=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    duration_seconds: Mapped[int | None] = mapped_column(Integer)

    # Relationships
    business: Mapped["app.models.business.Business"] = relationship(
        back_populates="feedback_sessions"
    )
    messages: Mapped[list["ConversationMessage"]] = relationship(
        back_populates="session", cascade="all, delete-orphan", order_by="ConversationMessage.sequence"
    )
    google_review: Mapped["GoogleReviewTracking | None"] = relationship(
        back_populates="session", uselist=False, cascade="all, delete-orphan"
    )
    complaint: Mapped["Complaint | None"] = relationship(
        back_populates="session", uselist=False, cascade="all, delete-orphan"
    )
    reward: Mapped["app.models.reward.RewardCode | None"] = relationship(
        back_populates="session", uselist=False
    )


class ConversationMessage(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "conversation_messages"

    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("feedback_sessions.id"), nullable=False, index=True
    )
    role: Mapped[str] = mapped_column(String(20), nullable=False)  # 'assistant' or 'customer'
    content: Mapped[str] = mapped_column(Text, nullable=False)
    audio_url: Mapped[str | None] = mapped_column(String(500))
    source: Mapped[str] = mapped_column(String(10), default="text")  # 'voice' or 'text'
    sequence: Mapped[int] = mapped_column(Integer, nullable=False)

    # Relationships
    session: Mapped["FeedbackSession"] = relationship(back_populates="messages")


class GoogleReviewTracking(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "google_review_tracking"

    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("feedback_sessions.id"), unique=True, nullable=False
    )
    review_text: Mapped[str] = mapped_column(Text, nullable=False)
    consent_given: Mapped[bool] = mapped_column(Boolean, default=False)
    link_clicked: Mapped[bool] = mapped_column(Boolean, default=False)
    clicked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    self_reported_posted: Mapped[bool | None] = mapped_column(Boolean)

    # Relationships
    session: Mapped["FeedbackSession"] = relationship(back_populates="google_review")


class Complaint(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "complaints"

    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("feedback_sessions.id"), unique=True, nullable=False
    )
    business_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("businesses.id"), nullable=False, index=True
    )
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="new")
    priority: Mapped[str] = mapped_column(String(10), default="medium")
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    resolution_notes: Mapped[str | None] = mapped_column(Text)
    assigned_to: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("business_users.id")
    )
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # Relationships
    session: Mapped["FeedbackSession"] = relationship(back_populates="complaint")
