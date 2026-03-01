import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin


class RewardTemplate(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "reward_templates"

    business_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("businesses.id"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    reward_type: Mapped[str] = mapped_column(String(50), nullable=False)
    reward_value: Mapped[str] = mapped_column(String(100), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    expiry_days: Mapped[int] = mapped_column(Integer, default=365)


class RewardCode(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "reward_codes"

    business_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("businesses.id"), nullable=False, index=True
    )
    session_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("feedback_sessions.id")
    )
    code: Mapped[str] = mapped_column(String(20), unique=True, nullable=False, index=True)
    reward_description: Mapped[str] = mapped_column(String(255), nullable=False)
    is_redeemed: Mapped[bool] = mapped_column(Boolean, default=False)
    redeemed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    sent_via: Mapped[str] = mapped_column(String(10), default="screen")

    # Relationships
    session: Mapped["app.models.feedback.FeedbackSession | None"] = relationship(
        back_populates="reward"
    )
