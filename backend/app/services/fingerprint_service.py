import logging
from datetime import datetime, timedelta, timezone

import httpx
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.feedback import FeedbackSession

logger = logging.getLogger(__name__)

FINGERPRINT_API_URL = "https://api.fpjs.io"


async def verify_fingerprint(visitor_id: str, request_id: str) -> dict:
    settings = get_settings()

    if not settings.fingerprint_pro_secret_key:
        return {"valid": True, "confidence": 1.0}

    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{FINGERPRINT_API_URL}/visitors/{visitor_id}",
                headers={"Auth-API-Key": settings.fingerprint_pro_secret_key},
                params={"request_id": request_id},
                timeout=10.0,
            )
            if response.status_code == 200:
                data = response.json()
                visits = data.get("visits", [])
                if visits:
                    confidence = visits[0].get("confidence", {}).get("score", 0)
                    return {"valid": True, "confidence": confidence}
            return {"valid": False, "confidence": 0}
    except Exception as e:
        logger.error(f"Fingerprint verification error: {e}")
        return {"valid": True, "confidence": 0}


async def check_rate_limit(visitor_id: str, db: AsyncSession) -> dict:
    settings = get_settings()
    cutoff = datetime.now(timezone.utc) - timedelta(hours=24)

    result = await db.execute(
        select(func.count()).where(
            FeedbackSession.device_fingerprint == visitor_id,
            FeedbackSession.created_at >= cutoff,
        )
    )
    count = result.scalar() or 0

    return {
        "allowed": count < settings.max_sessions_per_fingerprint_24h,
        "sessions_in_24h": count,
        "max_allowed": settings.max_sessions_per_fingerprint_24h,
    }
