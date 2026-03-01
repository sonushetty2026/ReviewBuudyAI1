import asyncio
import logging
import secrets
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from twilio.rest import Client as TwilioClient

from app.config import get_settings
from app.models.reward import RewardCode, RewardTemplate

logger = logging.getLogger(__name__)


def generate_reward_code() -> str:
    return f"SS-{secrets.token_hex(3).upper()}"


async def create_reward(
    session_id: uuid.UUID,
    business_id: uuid.UUID,
    db: AsyncSession,
) -> RewardCode | None:
    result = await db.execute(
        select(RewardTemplate).where(
            RewardTemplate.business_id == business_id,
            RewardTemplate.is_active == True,  # noqa: E712
        ).limit(1)
    )
    template = result.scalar_one_or_none()
    if not template:
        return None

    code = generate_reward_code()
    expires_at = datetime.now(timezone.utc) + timedelta(days=template.expiry_days)

    reward = RewardCode(
        business_id=business_id,
        session_id=session_id,
        code=code,
        reward_description=f"{template.name}: {template.reward_value}",
        expires_at=expires_at,
    )
    db.add(reward)
    await db.flush()
    return reward


async def send_reward_sms(
    phone: str,
    code: str,
    reward_description: str,
    business_name: str,
) -> bool:
    settings = get_settings()

    body = (
        f"Thanks for your feedback at {business_name}! "
        f"Your reward: {reward_description}. "
        f"Code: {code}"
    )

    def _send():
        try:
            client = TwilioClient(settings.twilio_account_sid, settings.twilio_auth_token)
            client.messages.create(
                body=body,
                from_=settings.twilio_from_number,
                to=phone,
            )
            return True
        except Exception as e:
            logger.error(f"Twilio SMS error: {e}")
            return False

    return await asyncio.to_thread(_send)
