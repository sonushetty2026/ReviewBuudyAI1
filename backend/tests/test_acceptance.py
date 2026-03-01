"""
Acceptance tests: end-to-end flows through the customer feedback pipeline.
All external services (AI, email, SMS, fingerprint) are mocked.
"""
from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient


def _mock_externals():
    """Return context managers for all external service mocks."""
    return (
        patch("app.services.fingerprint_service.verify_fingerprint", new_callable=AsyncMock,
              return_value={"valid": True, "confidence": 0.99}),
        patch("app.services.fingerprint_service.check_rate_limit", new_callable=AsyncMock,
              return_value={"allowed": True, "sessions_in_24h": 0, "max_allowed": 3}),
    )


@pytest.mark.asyncio
async def test_positive_flow_e2e(client: AsyncClient, seed_business: dict):
    """Full positive flow: start → messages → complete → confirm → consent → google → reward"""
    fp_mock, rate_mock = _mock_externals()

    with fp_mock, rate_mock, \
         patch("app.services.ai_conversation.get_conversation_response", new_callable=AsyncMock) as mock_ai:

        # Start session
        mock_ai.return_value = {"text": "Hey! How was your visit?", "state": "greeting", "ready_to_complete": False}
        res = await client.post("/api/v1/flow/test-coffee-shop/start", json={"visitor_id": "e2e-pos", "request_id": ""})
        assert res.status_code == 200
        session_id = res.json()["id"]

        # Message 1
        mock_ai.return_value = {"text": "That sounds great! What did you like most?", "state": "probing", "ready_to_complete": False}
        res = await client.post(f"/api/v1/flow/session/{session_id}/message", json={"content": "Loved the coffee!", "source": "text"})
        assert res.status_code == 200

        # Message 2
        mock_ai.return_value = {"text": "Wonderful! Anything else?", "state": "probing", "ready_to_complete": False}
        res = await client.post(f"/api/v1/flow/session/{session_id}/message", json={"content": "Staff was super friendly too.", "source": "text"})
        assert res.status_code == 200

        # Message 3
        mock_ai.return_value = {"text": "Thanks for sharing!", "state": "wrapping_up", "ready_to_complete": True}
        res = await client.post(f"/api/v1/flow/session/{session_id}/message", json={"content": "The pastries were fresh.", "source": "text"})
        assert res.status_code == 200
        assert res.json()["ready_to_complete"] is True

    # Complete session (positive)
    with patch("app.services.ai_conversation.analyze_sentiment_and_extract", new_callable=AsyncMock) as mock_analyze, \
         patch("app.services.review_writer.rewrite_review", new_callable=AsyncMock) as mock_rewrite:

        mock_analyze.return_value = {
            "sentiment_label": "positive", "sentiment_score": 0.9, "star_rating": 5,
            "key_topics": ["coffee", "staff", "pastries"], "summary": "Great experience overall.",
        }
        mock_rewrite.return_value = "Had an amazing time! The coffee was excellent, staff super friendly, and the pastries were fresh."

        res = await client.post(f"/api/v1/flow/session/{session_id}/complete")
        assert res.status_code == 200
        assert res.json()["flow"] == "positive"
        assert res.json()["rewritten_review"] is not None

    # Confirm review
    res = await client.post(f"/api/v1/flow/session/{session_id}/confirm-review",
                           json={"review_text": "Had an amazing time at Test Coffee Shop!"})
    assert res.status_code == 200

    # Consent for Google
    res = await client.post(f"/api/v1/flow/session/{session_id}/consent",
                           json={"consent_website": True, "consent_google": True})
    assert res.status_code == 200
    assert res.json()["google_review_url"] is not None

    # Google clicked
    res = await client.post(f"/api/v1/flow/session/{session_id}/google-clicked")
    assert res.status_code == 200

    # Self-reported posted
    res = await client.post(f"/api/v1/flow/session/{session_id}/google-status", json={"posted": True})
    assert res.status_code == 200

    # Claim reward
    res = await client.post(f"/api/v1/flow/session/{session_id}/reward", json={"send_sms": False})
    assert res.status_code == 200
    assert res.json()["code"].startswith("SS-")


@pytest.mark.asyncio
async def test_negative_flow_e2e(client: AsyncClient, seed_business: dict):
    """Negative flow: start → messages → complete → contact → reward + verify complaint + email"""
    fp_mock, rate_mock = _mock_externals()

    with fp_mock, rate_mock, \
         patch("app.services.ai_conversation.get_conversation_response", new_callable=AsyncMock) as mock_ai:

        mock_ai.return_value = {"text": "Hey! How was your visit?", "state": "greeting", "ready_to_complete": False}
        res = await client.post("/api/v1/flow/test-coffee-shop/start", json={"visitor_id": "e2e-neg", "request_id": ""})
        session_id = res.json()["id"]

        mock_ai.return_value = {"text": "I'm sorry to hear that.", "state": "listening", "ready_to_complete": False}
        await client.post(f"/api/v1/flow/session/{session_id}/message",
                         json={"content": "Terrible service, waited 30 minutes!", "source": "text"})

        mock_ai.return_value = {"text": "Thanks for sharing. We'll follow up.", "state": "wrapping_up", "ready_to_complete": True}
        await client.post(f"/api/v1/flow/session/{session_id}/message",
                         json={"content": "And the food was cold.", "source": "text"})

    with patch("app.services.ai_conversation.analyze_sentiment_and_extract", new_callable=AsyncMock) as mock_analyze, \
         patch("app.services.email_service.send_complaint_notification", new_callable=AsyncMock) as mock_email:

        mock_analyze.return_value = {
            "sentiment_label": "negative", "sentiment_score": -0.8, "star_rating": 1,
            "key_topics": ["wait time", "cold food"], "summary": "Long wait, cold food.",
        }
        mock_email.return_value = True

        res = await client.post(f"/api/v1/flow/session/{session_id}/complete")
        assert res.json()["flow"] == "negative"
        assert res.json()["star_rating"] == 1
        mock_email.assert_called_once()

    # Submit contact info
    res = await client.post(f"/api/v1/flow/session/{session_id}/contact",
                           json={"name": "Jane Doe", "phone": "+15559999999", "email": "jane@test.com"})
    assert res.status_code == 200

    # Claim reward
    res = await client.post(f"/api/v1/flow/session/{session_id}/reward", json={"send_sms": False})
    assert res.status_code == 200


@pytest.mark.asyncio
async def test_rate_limiting(client: AsyncClient, seed_business: dict):
    """3 sessions OK → 4th blocked"""
    session_count = 0

    async def mock_rate_limit(visitor_id, db):
        nonlocal session_count
        session_count += 1
        return {
            "allowed": session_count <= 3,
            "sessions_in_24h": session_count - 1,
            "max_allowed": 3,
        }

    with patch("app.services.fingerprint_service.verify_fingerprint", new_callable=AsyncMock,
               return_value={"valid": True, "confidence": 0.99}), \
         patch("app.services.fingerprint_service.check_rate_limit", side_effect=mock_rate_limit), \
         patch("app.services.ai_conversation.get_conversation_response", new_callable=AsyncMock,
               return_value={"text": "Welcome!", "state": "greeting", "ready_to_complete": False}):

        for i in range(3):
            res = await client.post("/api/v1/flow/test-coffee-shop/start",
                                   json={"visitor_id": "rate-limit-test", "request_id": ""})
            assert res.status_code == 200, f"Session {i+1} should succeed"

        res = await client.post("/api/v1/flow/test-coffee-shop/start",
                               json={"visitor_id": "rate-limit-test", "request_id": ""})
        assert res.status_code == 429, "4th session should be rate limited"


@pytest.mark.asyncio
async def test_text_fallback_flow(client: AsyncClient, seed_business: dict):
    """Full flow via text-only input"""
    fp_mock, rate_mock = _mock_externals()

    with fp_mock, rate_mock, \
         patch("app.services.ai_conversation.get_conversation_response", new_callable=AsyncMock) as mock_ai:

        mock_ai.return_value = {"text": "Welcome! Type your feedback.", "state": "greeting", "ready_to_complete": False}
        res = await client.post("/api/v1/flow/test-coffee-shop/start",
                               json={"visitor_id": "e2e-text", "request_id": "", "input_mode": "text"})
        session_id = res.json()["id"]

        mock_ai.return_value = {"text": "Thanks!", "state": "wrapping_up", "ready_to_complete": True}
        res = await client.post(f"/api/v1/flow/session/{session_id}/message",
                               json={"content": "Good coffee, nothing special.", "source": "text"})
        assert res.json()["ready_to_complete"] is True

    with patch("app.services.ai_conversation.analyze_sentiment_and_extract", new_callable=AsyncMock) as mock_analyze:
        mock_analyze.return_value = {
            "sentiment_label": "neutral", "sentiment_score": 0.1, "star_rating": 3,
            "key_topics": ["coffee"], "summary": "Neutral experience.",
        }

        res = await client.post(f"/api/v1/flow/session/{session_id}/complete")
        assert res.status_code == 200
        # Neutral with star 3 goes negative flow (no rewrite)
        assert res.json()["flow"] == "negative"

    # Can still claim reward
    res = await client.post(f"/api/v1/flow/session/{session_id}/reward", json={"send_sms": False})
    assert res.status_code == 200
