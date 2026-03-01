import re
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.exceptions import Conflict, Unauthorized
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.database import get_db
from app.models.business import Business, BusinessBranding
from app.models.user import BusinessUser
from app.schemas.auth import (
    LoginRequest,
    RefreshRequest,
    RegisterRequest,
    TokenResponse,
    UserResponse,
)

router = APIRouter(prefix="/auth", tags=["auth"])


def _slugify(name: str) -> str:
    slug = name.lower().strip()
    slug = re.sub(r"[^\w\s-]", "", slug)
    slug = re.sub(r"[\s_]+", "-", slug)
    slug = re.sub(r"-+", "-", slug).strip("-")
    return slug


@router.post("/register", response_model=TokenResponse)
async def register(body: RegisterRequest, db: AsyncSession = Depends(get_db)):
    # Check if email already exists
    existing = await db.execute(
        select(BusinessUser).where(BusinessUser.email == body.email)
    )
    if existing.scalar_one_or_none():
        raise Conflict("An account with this email already exists")

    # Create business
    base_slug = _slugify(body.business_name)
    slug = base_slug
    # Ensure unique slug
    for i in range(1, 100):
        exists = await db.execute(select(Business).where(Business.slug == slug))
        if not exists.scalar_one_or_none():
            break
        slug = f"{base_slug}-{i}"

    business = Business(
        name=body.business_name,
        slug=slug,
        email=body.email,
    )
    db.add(business)
    await db.flush()

    # Create default branding
    branding = BusinessBranding(business_id=business.id)
    db.add(branding)

    # Create owner user
    user = BusinessUser(
        business_id=business.id,
        email=body.email,
        password_hash=hash_password(body.password),
        full_name=body.full_name,
        role="owner",
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    # Generate tokens
    token_data = {"sub": str(user.id), "business_id": str(business.id), "role": user.role}
    return TokenResponse(
        access_token=create_access_token(token_data),
        refresh_token=create_refresh_token(token_data),
    )


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(BusinessUser).where(BusinessUser.email == body.email)
    )
    user = result.scalar_one_or_none()
    if not user or not verify_password(body.password, user.password_hash):
        raise Unauthorized("Invalid email or password")

    if not user.is_active:
        raise Unauthorized("Account is disabled")

    # Update last login
    user.last_login_at = datetime.now(timezone.utc)
    await db.commit()

    token_data = {"sub": str(user.id), "business_id": str(user.business_id), "role": user.role}
    return TokenResponse(
        access_token=create_access_token(token_data),
        refresh_token=create_refresh_token(token_data),
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh(body: RefreshRequest, db: AsyncSession = Depends(get_db)):
    payload = decode_token(body.refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise Unauthorized("Invalid refresh token")

    user_id = payload.get("sub")
    result = await db.execute(
        select(BusinessUser).where(BusinessUser.id == uuid.UUID(user_id))
    )
    user = result.scalar_one_or_none()
    if not user or not user.is_active:
        raise Unauthorized("User not found or inactive")

    token_data = {"sub": str(user.id), "business_id": str(user.business_id), "role": user.role}
    return TokenResponse(
        access_token=create_access_token(token_data),
        refresh_token=create_refresh_token(token_data),
    )


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: BusinessUser = Depends(get_current_user)):
    return current_user
