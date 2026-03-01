import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services.ai_conversation import (
    ConversationState,
    build_system_prompt,
    check_profanity,
)
from app.services.reward_service import generate_reward_code


def test_check_profanity_detected():
    assert check_profanity("this is shit") is True
    assert check_profanity("What the fuck") is True


def test_check_profanity_clean():
    assert check_profanity("The coffee was great!") is False
    assert check_profanity("I really enjoyed the atmosphere") is False


def test_build_system_prompt_friendly():
    prompt = build_system_prompt("Cafe Deluxe", "friendly", "Welcome!")
    assert "Cafe Deluxe" in prompt
    assert "casual" in prompt.lower()
    assert "FORBIDDEN" in prompt


def test_build_system_prompt_professional():
    prompt = build_system_prompt("Law Office", "professional")
    assert "professional" in prompt.lower()


def test_build_system_prompt_energetic():
    prompt = build_system_prompt("Gym", "energetic")
    assert "energy" in prompt.lower() or "enthusiastic" in prompt.lower()


def test_generate_reward_code_format():
    code = generate_reward_code()
    assert code.startswith("SS-")
    assert len(code) == 9  # SS- + 6 hex chars


def test_generate_reward_code_unique():
    codes = {generate_reward_code() for _ in range(100)}
    assert len(codes) == 100  # All unique


def test_conversation_state_enum():
    assert ConversationState.GREETING == "greeting"
    assert ConversationState.COMPLETE == "complete"


@pytest.mark.asyncio
async def test_analyze_sentiment_mocked():
    with patch("app.services.ai_conversation.anthropic") as mock_anthropic:
        mock_client = AsyncMock()
        mock_anthropic.AsyncAnthropic.return_value = mock_client

        mock_response = MagicMock()
        mock_response.content = [MagicMock(text='{"sentiment_label": "positive", "sentiment_score": 0.9, "star_rating": 5, "key_topics": ["coffee"], "summary": "Great coffee!"}')]
        mock_client.messages.create = AsyncMock(return_value=mock_response)

        from app.services.ai_conversation import analyze_sentiment_and_extract
        result = await analyze_sentiment_and_extract("Customer: Great coffee!", "Test Cafe")
        assert result["sentiment_label"] == "positive"
        assert result["star_rating"] == 5
