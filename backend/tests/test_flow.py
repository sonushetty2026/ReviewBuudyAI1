import uuid
from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_get_business_by_slug(client: AsyncClient, seed_business: dict):
    response = await client.get("/api/v1/flow/test-coffee-shop")
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Test Coffee Shop"
    assert data["slug"] == "test-coffee-shop"
    assert data["branding"]["primary_color"] == "#4F46E5"
    assert data["branding"]["avatar_style"] == "friendly"


@pytest.mark.asyncio
async def test_get_business_not_found(client: AsyncClient):
    response = await client.get("/api/v1/flow/nonexistent-slug")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_start_session(client: AsyncClient, seed_business: dict):
    with patch("app.services.fingerprint_service.verify_fingerprint", new_callable=AsyncMock) as mock_fp, \
         patch("app.services.fingerprint_service.check_rate_limit", new_callable=AsyncMock) as mock_rate, \
         patch("app.services.ai_conversation.get_conversation_response", new_callable=AsyncMock) as mock_ai:

        mock_fp.return_value = {"valid": True, "confidence": 0.99}
        mock_rate.return_value = {"allowed": True, "sessions_in_24h": 0, "max_allowed": 3}
        mock_ai.return_value = {"text": "Hey! How was your visit today?", "state": "greeting", "ready_to_complete": False}

        response = await client.post(
            "/api/v1/flow/test-coffee-shop/start",
            json={"visitor_id": "test-visitor-123", "request_id": "req-123"},
        )
        assert response.status_code == 200
        data = response.json()
        assert "id" in data
        assert data["status"] == "active"
        assert data["greeting"] == "Hey! How was your visit today?"


@pytest.mark.asyncio
async def test_start_session_rate_limited(client: AsyncClient, seed_business: dict):
    with patch("app.services.fingerprint_service.verify_fingerprint", new_callable=AsyncMock) as mock_fp, \
         patch("app.services.fingerprint_service.check_rate_limit", new_callable=AsyncMock) as mock_rate:

        mock_fp.return_value = {"valid": True, "confidence": 0.99}
        mock_rate.return_value = {"allowed": False, "sessions_in_24h": 3, "max_allowed": 3}

        response = await client.post(
            "/api/v1/flow/test-coffee-shop/start",
            json={"visitor_id": "test-visitor-123", "request_id": "req-123"},
        )
        assert response.status_code == 429


@pytest.mark.asyncio
async def test_send_message(client: AsyncClient, seed_business: dict):
    # Create session first
    with patch("app.services.fingerprint_service.verify_fingerprint", new_callable=AsyncMock) as mock_fp, \
         patch("app.services.fingerprint_service.check_rate_limit", new_callable=AsyncMock) as mock_rate, \
         patch("app.services.ai_conversation.get_conversation_response", new_callable=AsyncMock) as mock_ai:

        mock_fp.return_value = {"valid": True, "confidence": 0.99}
        mock_rate.return_value = {"allowed": True, "sessions_in_24h": 0, "max_allowed": 3}
        mock_ai.return_value = {"text": "Welcome!", "state": "greeting", "ready_to_complete": False}

        session_res = await client.post(
            "/api/v1/flow/test-coffee-shop/start",
            json={"visitor_id": "test-visitor-456", "request_id": ""},
        )
        session_id = session_res.json()["id"]

    # Send message
    with patch("app.services.ai_conversation.get_conversation_response", new_callable=AsyncMock) as mock_ai:
        mock_ai.return_value = {
            "text": "That sounds great! What specifically did you enjoy?",
            "state": "probing",
            "ready_to_complete": False,
        }

        response = await client.post(
            f"/api/v1/flow/session/{session_id}/message",
            json={"content": "The coffee was amazing!", "source": "text"},
        )
        assert response.status_code == 200
        data = response.json()
        assert "text" in data
        assert data["state"] == "probing"
        assert data["ready_to_complete"] is False


@pytest.mark.asyncio
async def test_send_message_profanity(client: AsyncClient, seed_business: dict):
    with patch("app.services.fingerprint_service.verify_fingerprint", new_callable=AsyncMock) as mock_fp, \
         patch("app.services.fingerprint_service.check_rate_limit", new_callable=AsyncMock) as mock_rate, \
         patch("app.services.ai_conversation.get_conversation_response", new_callable=AsyncMock) as mock_ai:

        mock_fp.return_value = {"valid": True, "confidence": 0.99}
        mock_rate.return_value = {"allowed": True, "sessions_in_24h": 0, "max_allowed": 3}
        mock_ai.return_value = {"text": "Welcome!", "state": "greeting", "ready_to_complete": False}

        session_res = await client.post(
            "/api/v1/flow/test-coffee-shop/start",
            json={"visitor_id": "test-visitor-prof", "request_id": ""},
        )
        session_id = session_res.json()["id"]

    response = await client.post(
        f"/api/v1/flow/session/{session_id}/message",
        json={"content": "This place is shit", "source": "text"},
    )
    assert response.status_code == 200
    data = response.json()
    assert "respectful" in data["text"].lower()


@pytest.mark.asyncio
async def test_complete_session_positive(client: AsyncClient, seed_business: dict):
    # Create and populate session
    with patch("app.services.fingerprint_service.verify_fingerprint", new_callable=AsyncMock) as mock_fp, \
         patch("app.services.fingerprint_service.check_rate_limit", new_callable=AsyncMock) as mock_rate, \
         patch("app.services.ai_conversation.get_conversation_response", new_callable=AsyncMock) as mock_ai:

        mock_fp.return_value = {"valid": True, "confidence": 0.99}
        mock_rate.return_value = {"allowed": True, "sessions_in_24h": 0, "max_allowed": 3}
        mock_ai.return_value = {"text": "Welcome!", "state": "greeting", "ready_to_complete": False}

        session_res = await client.post(
            "/api/v1/flow/test-coffee-shop/start",
            json={"visitor_id": "test-visitor-pos", "request_id": ""},
        )
        session_id = session_res.json()["id"]

    # Add a customer message
    with patch("app.services.ai_conversation.get_conversation_response", new_callable=AsyncMock) as mock_ai:
        mock_ai.return_value = {"text": "Great!", "state": "listening", "ready_to_complete": False}
        await client.post(
            f"/api/v1/flow/session/{session_id}/message",
            json={"content": "The coffee was excellent!", "source": "text"},
        )

    # Complete with positive sentiment
    with patch("app.services.ai_conversation.analyze_sentiment_and_extract", new_callable=AsyncMock) as mock_analyze, \
         patch("app.services.review_writer.rewrite_review", new_callable=AsyncMock) as mock_rewrite:

        mock_analyze.return_value = {
            "sentiment_label": "positive",
            "sentiment_score": 0.8,
            "star_rating": 5,
            "key_topics": ["coffee quality"],
            "summary": "Customer loved the coffee.",
        }
        mock_rewrite.return_value = "Amazing coffee! Best I've had in town."

        response = await client.post(f"/api/v1/flow/session/{session_id}/complete")
        assert response.status_code == 200
        data = response.json()
        assert data["flow"] == "positive"
        assert data["star_rating"] == 5
        assert data["rewritten_review"] == "Amazing coffee! Best I've had in town."


@pytest.mark.asyncio
async def test_complete_session_negative(client: AsyncClient, seed_business: dict):
    with patch("app.services.fingerprint_service.verify_fingerprint", new_callable=AsyncMock) as mock_fp, \
         patch("app.services.fingerprint_service.check_rate_limit", new_callable=AsyncMock) as mock_rate, \
         patch("app.services.ai_conversation.get_conversation_response", new_callable=AsyncMock) as mock_ai:

        mock_fp.return_value = {"valid": True, "confidence": 0.99}
        mock_rate.return_value = {"allowed": True, "sessions_in_24h": 0, "max_allowed": 3}
        mock_ai.return_value = {"text": "Welcome!", "state": "greeting", "ready_to_complete": False}

        session_res = await client.post(
            "/api/v1/flow/test-coffee-shop/start",
            json={"visitor_id": "test-visitor-neg", "request_id": ""},
        )
        session_id = session_res.json()["id"]

    with patch("app.services.ai_conversation.get_conversation_response", new_callable=AsyncMock) as mock_ai:
        mock_ai.return_value = {"text": "Sorry to hear that.", "state": "listening", "ready_to_complete": False}
        await client.post(
            f"/api/v1/flow/session/{session_id}/message",
            json={"content": "Terrible service, waited 30 minutes.", "source": "text"},
        )

    with patch("app.services.ai_conversation.analyze_sentiment_and_extract", new_callable=AsyncMock) as mock_analyze, \
         patch("app.services.email_service.send_complaint_notification", new_callable=AsyncMock) as mock_email:

        mock_analyze.return_value = {
            "sentiment_label": "negative",
            "sentiment_score": -0.8,
            "star_rating": 1,
            "key_topics": ["wait time", "service"],
            "summary": "Customer waited 30 minutes and was frustrated.",
        }
        mock_email.return_value = True

        response = await client.post(f"/api/v1/flow/session/{session_id}/complete")
        assert response.status_code == 200
        data = response.json()
        assert data["flow"] == "negative"
        assert data["star_rating"] == 1
        assert data["rewritten_review"] is None
        mock_email.assert_called_once()


@pytest.mark.asyncio
async def test_confirm_review(client: AsyncClient, seed_business: dict):
    with patch("app.services.fingerprint_service.verify_fingerprint", new_callable=AsyncMock) as mock_fp, \
         patch("app.services.fingerprint_service.check_rate_limit", new_callable=AsyncMock) as mock_rate, \
         patch("app.services.ai_conversation.get_conversation_response", new_callable=AsyncMock) as mock_ai:

        mock_fp.return_value = {"valid": True, "confidence": 0.99}
        mock_rate.return_value = {"allowed": True, "sessions_in_24h": 0, "max_allowed": 3}
        mock_ai.return_value = {"text": "Welcome!", "state": "greeting", "ready_to_complete": False}

        session_res = await client.post(
            "/api/v1/flow/test-coffee-shop/start",
            json={"visitor_id": "test-visitor-review", "request_id": ""},
        )
        session_id = session_res.json()["id"]

    response = await client.post(
        f"/api/v1/flow/session/{session_id}/confirm-review",
        json={"review_text": "Great coffee shop!"},
    )
    assert response.status_code == 200
    assert response.json()["confirmed"] is True


@pytest.mark.asyncio
async def test_consent_with_google(client: AsyncClient, seed_business: dict):
    with patch("app.services.fingerprint_service.verify_fingerprint", new_callable=AsyncMock) as mock_fp, \
         patch("app.services.fingerprint_service.check_rate_limit", new_callable=AsyncMock) as mock_rate, \
         patch("app.services.ai_conversation.get_conversation_response", new_callable=AsyncMock) as mock_ai:

        mock_fp.return_value = {"valid": True, "confidence": 0.99}
        mock_rate.return_value = {"allowed": True, "sessions_in_24h": 0, "max_allowed": 3}
        mock_ai.return_value = {"text": "Welcome!", "state": "greeting", "ready_to_complete": False}

        session_res = await client.post(
            "/api/v1/flow/test-coffee-shop/start",
            json={"visitor_id": "test-visitor-consent", "request_id": ""},
        )
        session_id = session_res.json()["id"]

    response = await client.post(
        f"/api/v1/flow/session/{session_id}/consent",
        json={"consent_website": True, "consent_google": True},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["google_review_url"] is not None
    assert "ChIJtest123" in data["google_review_url"]


@pytest.mark.asyncio
async def test_google_tracking(client: AsyncClient, seed_business: dict):
    with patch("app.services.fingerprint_service.verify_fingerprint", new_callable=AsyncMock) as mock_fp, \
         patch("app.services.fingerprint_service.check_rate_limit", new_callable=AsyncMock) as mock_rate, \
         patch("app.services.ai_conversation.get_conversation_response", new_callable=AsyncMock) as mock_ai:

        mock_fp.return_value = {"valid": True, "confidence": 0.99}
        mock_rate.return_value = {"allowed": True, "sessions_in_24h": 0, "max_allowed": 3}
        mock_ai.return_value = {"text": "Welcome!", "state": "greeting", "ready_to_complete": False}

        session_res = await client.post(
            "/api/v1/flow/test-coffee-shop/start",
            json={"visitor_id": "test-visitor-track", "request_id": ""},
        )
        session_id = session_res.json()["id"]

    # Create consent/tracking record first
    await client.post(
        f"/api/v1/flow/session/{session_id}/consent",
        json={"consent_google": True},
    )

    # Track click
    response = await client.post(f"/api/v1/flow/session/{session_id}/google-clicked")
    assert response.status_code == 200

    # Track status
    response = await client.post(
        f"/api/v1/flow/session/{session_id}/google-status",
        json={"posted": True},
    )
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_claim_reward(client: AsyncClient, seed_business: dict):
    with patch("app.services.fingerprint_service.verify_fingerprint", new_callable=AsyncMock) as mock_fp, \
         patch("app.services.fingerprint_service.check_rate_limit", new_callable=AsyncMock) as mock_rate, \
         patch("app.services.ai_conversation.get_conversation_response", new_callable=AsyncMock) as mock_ai:

        mock_fp.return_value = {"valid": True, "confidence": 0.99}
        mock_rate.return_value = {"allowed": True, "sessions_in_24h": 0, "max_allowed": 3}
        mock_ai.return_value = {"text": "Welcome!", "state": "greeting", "ready_to_complete": False}

        session_res = await client.post(
            "/api/v1/flow/test-coffee-shop/start",
            json={"visitor_id": "test-visitor-reward", "request_id": ""},
        )
        session_id = session_res.json()["id"]

    response = await client.post(
        f"/api/v1/flow/session/{session_id}/reward",
        json={"send_sms": False},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["code"].startswith("SS-")
    assert "10%" in data["description"]


@pytest.mark.asyncio
async def test_claim_reward_with_sms(client: AsyncClient, seed_business: dict):
    with patch("app.services.fingerprint_service.verify_fingerprint", new_callable=AsyncMock) as mock_fp, \
         patch("app.services.fingerprint_service.check_rate_limit", new_callable=AsyncMock) as mock_rate, \
         patch("app.services.ai_conversation.get_conversation_response", new_callable=AsyncMock) as mock_ai:

        mock_fp.return_value = {"valid": True, "confidence": 0.99}
        mock_rate.return_value = {"allowed": True, "sessions_in_24h": 0, "max_allowed": 3}
        mock_ai.return_value = {"text": "Welcome!", "state": "greeting", "ready_to_complete": False}

        session_res = await client.post(
            "/api/v1/flow/test-coffee-shop/start",
            json={"visitor_id": "test-visitor-sms", "request_id": ""},
        )
        session_id = session_res.json()["id"]

    with patch("app.services.reward_service.send_reward_sms", new_callable=AsyncMock) as mock_sms:
        mock_sms.return_value = True

        response = await client.post(
            f"/api/v1/flow/session/{session_id}/reward",
            json={"send_sms": True, "phone": "+15559876543"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["sms_sent"] is True
        mock_sms.assert_called_once()


@pytest.mark.asyncio
async def test_contact_info(client: AsyncClient, seed_business: dict):
    with patch("app.services.fingerprint_service.verify_fingerprint", new_callable=AsyncMock) as mock_fp, \
         patch("app.services.fingerprint_service.check_rate_limit", new_callable=AsyncMock) as mock_rate, \
         patch("app.services.ai_conversation.get_conversation_response", new_callable=AsyncMock) as mock_ai:

        mock_fp.return_value = {"valid": True, "confidence": 0.99}
        mock_rate.return_value = {"allowed": True, "sessions_in_24h": 0, "max_allowed": 3}
        mock_ai.return_value = {"text": "Welcome!", "state": "greeting", "ready_to_complete": False}

        session_res = await client.post(
            "/api/v1/flow/test-coffee-shop/start",
            json={"visitor_id": "test-visitor-contact", "request_id": ""},
        )
        session_id = session_res.json()["id"]

    response = await client.post(
        f"/api/v1/flow/session/{session_id}/contact",
        json={"name": "John Doe", "phone": "+15551112222", "email": "john@example.com"},
    )
    assert response.status_code == 200
