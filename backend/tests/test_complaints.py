import uuid
from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.feedback import Complaint, FeedbackSession


@pytest.mark.asyncio
async def test_list_complaints_empty(client: AsyncClient, seed_business: dict, auth_headers: dict):
    response = await client.get("/api/v1/dashboard/complaints", headers=auth_headers)
    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.asyncio
async def test_list_complaints_with_data(
    client: AsyncClient, seed_business: dict, auth_headers: dict, db_session: AsyncSession
):
    business = seed_business["business"]

    # Create a session and complaint
    session = FeedbackSession(
        business_id=business.id,
        status="completed",
        device_fingerprint="test-fp",
        customer_name="Unhappy Customer",
    )
    db_session.add(session)
    await db_session.flush()

    complaint = Complaint(
        session_id=session.id,
        business_id=business.id,
        status="new",
        priority="high",
        summary="Waited too long for service.",
    )
    db_session.add(complaint)
    await db_session.commit()

    response = await client.get("/api/v1/dashboard/complaints", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["summary"] == "Waited too long for service."
    assert data[0]["priority"] == "high"
    assert data[0]["customer_name"] == "Unhappy Customer"


@pytest.mark.asyncio
async def test_filter_complaints(
    client: AsyncClient, seed_business: dict, auth_headers: dict, db_session: AsyncSession
):
    business = seed_business["business"]

    for i, (status, priority) in enumerate([("new", "urgent"), ("resolved", "medium")]):
        session = FeedbackSession(
            business_id=business.id,
            status="completed",
            device_fingerprint=f"test-fp-{i}",
        )
        db_session.add(session)
        await db_session.flush()

        complaint = Complaint(
            session_id=session.id,
            business_id=business.id,
            status=status,
            priority=priority,
            summary=f"Complaint {i}",
        )
        db_session.add(complaint)

    await db_session.commit()

    # Filter by status
    response = await client.get(
        "/api/v1/dashboard/complaints", params={"status": "new"}, headers=auth_headers
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["status"] == "new"

    # Filter by priority
    response = await client.get(
        "/api/v1/dashboard/complaints", params={"priority": "urgent"}, headers=auth_headers
    )
    assert len(response.json()) == 1


@pytest.mark.asyncio
async def test_update_complaint(
    client: AsyncClient, seed_business: dict, auth_headers: dict, db_session: AsyncSession
):
    business = seed_business["business"]

    session = FeedbackSession(
        business_id=business.id,
        status="completed",
        device_fingerprint="test-fp-update",
    )
    db_session.add(session)
    await db_session.flush()

    complaint = Complaint(
        session_id=session.id,
        business_id=business.id,
        status="new",
        priority="medium",
        summary="Issue to update.",
    )
    db_session.add(complaint)
    await db_session.commit()

    response = await client.put(
        f"/api/v1/dashboard/complaints/{complaint.id}",
        json={"status": "resolved", "resolution_notes": "Called customer, resolved."},
        headers=auth_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "resolved"
    assert data["resolution_notes"] == "Called customer, resolved."
    assert data["resolved_at"] is not None


@pytest.mark.asyncio
async def test_complaint_unauthorized(client: AsyncClient, seed_business: dict):
    response = await client.get("/api/v1/dashboard/complaints")
    assert response.status_code == 422  # Missing auth header
