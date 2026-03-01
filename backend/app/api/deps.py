import uuid

from fastapi import Depends, Header
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import Unauthorized
from app.core.security import decode_token
from app.database import get_db
from app.models.user import BusinessUser


async def get_current_user(
    authorization: str = Header(...),
    db: AsyncSession = Depends(get_db),
) -> BusinessUser:
    if not authorization.startswith("Bearer "):
        raise Unauthorized("Invalid authorization header")

    token = authorization[7:]
    payload = decode_token(token)
    if not payload or payload.get("type") != "access":
        raise Unauthorized("Invalid or expired token")

    user_id = payload.get("sub")
    if not user_id:
        raise Unauthorized("Invalid token payload")

    result = await db.execute(
        select(BusinessUser).where(BusinessUser.id == uuid.UUID(user_id))
    )
    user = result.scalar_one_or_none()
    if not user or not user.is_active:
        raise Unauthorized("User not found or inactive")

    return user
