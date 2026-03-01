import uuid

from sqlalchemy import Boolean, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin


class Business(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "businesses"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    google_place_id: Mapped[str | None] = mapped_column(String(255))
    industry: Mapped[str | None] = mapped_column(String(100))
    phone: Mapped[str | None] = mapped_column(String(20))
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    address: Mapped[str | None] = mapped_column(Text)
    timezone: Mapped[str] = mapped_column(String(50), default="America/New_York")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    stripe_customer_id: Mapped[str | None] = mapped_column(String(255), unique=True)

    # Relationships
    branding: Mapped["BusinessBranding | None"] = relationship(
        back_populates="business", uselist=False, cascade="all, delete-orphan"
    )
    users: Mapped[list["app.models.user.BusinessUser"]] = relationship(
        back_populates="business", cascade="all, delete-orphan"
    )
    feedback_sessions: Mapped[list["app.models.feedback.FeedbackSession"]] = relationship(
        back_populates="business"
    )


class BusinessBranding(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "business_branding"

    business_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("businesses.id"), unique=True, nullable=False
    )
    logo_url: Mapped[str | None] = mapped_column(Text)
    primary_color: Mapped[str] = mapped_column(String(7), default="#4F46E5")
    secondary_color: Mapped[str] = mapped_column(String(7), default="#10B981")
    avatar_style: Mapped[str] = mapped_column(String(50), default="friendly")
    welcome_message: Mapped[str] = mapped_column(
        Text, default="Hey there! How was your experience today?"
    )
    thank_you_message: Mapped[str] = mapped_column(Text, default="Thanks for your feedback!")

    # Relationships
    business: Mapped["Business"] = relationship(back_populates="branding")
