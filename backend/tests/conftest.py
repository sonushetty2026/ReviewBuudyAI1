from collections.abc import AsyncGenerator

import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import get_settings
from app.database import get_db
from app.main import app
from app.models.base import Base
from app.models.business import Business, BusinessBranding
from app.models.feedback import Complaint, ConversationMessage, FeedbackSession, GoogleReviewTracking  # noqa: F401
from app.models.reward import RewardCode, RewardTemplate
from app.models.user import BusinessUser
from app.models.billing import BillingUsage, SubscriptionPlan  # noqa: F401
from app.core.security import hash_password

settings = get_settings()

TEST_DB_URL = settings.database_url.replace("/scanandspeak", "/scanandspeak_test")


@pytest_asyncio.fixture
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    engine = create_async_engine(TEST_DB_URL, echo=False)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with session_factory() as session:
        yield session

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

    await engine.dispose()


@pytest_asyncio.fixture
async def client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    async def _override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = _override_get_db

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as ac:
        yield ac

    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def seed_business(db_session: AsyncSession) -> dict:
    business = Business(
        name="Test Coffee Shop",
        slug="test-coffee-shop",
        email="owner@test.com",
        google_place_id="ChIJtest123",
        industry="Restaurant",
        phone="+15551234567",
    )
    db_session.add(business)
    await db_session.flush()

    branding = BusinessBranding(
        business_id=business.id,
        primary_color="#4F46E5",
        secondary_color="#10B981",
        avatar_style="friendly",
        welcome_message="Welcome! How was your experience?",
        thank_you_message="Thanks for your feedback!",
    )
    db_session.add(branding)

    user = BusinessUser(
        business_id=business.id,
        email="owner@test.com",
        password_hash=hash_password("testpassword123"),
        full_name="Test Owner",
        role="owner",
    )
    db_session.add(user)

    template = RewardTemplate(
        business_id=business.id,
        name="10% Off",
        reward_type="discount",
        reward_value="10% off next visit",
        is_active=True,
        expiry_days=30,
    )
    db_session.add(template)

    await db_session.commit()

    return {
        "business": business,
        "branding": branding,
        "user": user,
        "template": template,
    }


@pytest_asyncio.fixture
async def auth_headers(client: AsyncClient, seed_business: dict) -> dict:
    response = await client.post(
        "/api/v1/auth/login",
        json={"email": "owner@test.com", "password": "testpassword123"},
    )
    tokens = response.json()
    return {"Authorization": f"Bearer {tokens['access_token']}"}
