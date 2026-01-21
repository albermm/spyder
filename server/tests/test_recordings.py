"""Tests for recordings endpoints."""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import crud
from app.services.auth import AuthService
from app.models.device import DeviceSettings


async def setup_device_with_recording(db_session: AsyncSession, device_id: str = "test-device"):
    """Helper to create a device with a recording."""
    await crud.create_device(
        db=db_session,
        device_id=device_id,
        name="Test iPhone",
        secret_hash=AuthService.hash_password("secret"),
        device_info={"model": "iPhone 14"},
        settings_dict=DeviceSettings().model_dump(),
    )

    recording = await crud.create_recording(
        db=db_session,
        device_id=device_id,
        recording_type="audio",
        filename="test_recording.m4a",
        size=1024000,
        triggered_by="manual",
        duration=60,
        extra_data={"quality": "high"},
    )
    await db_session.commit()
    return recording


@pytest.mark.asyncio
async def test_list_recordings_empty(client: AsyncClient):
    """Test listing recordings when none exist."""
    response = await client.get("/api/recordings")
    assert response.status_code == 200
    data = response.json()
    assert data["recordings"] == []
    assert "pagination" in data


@pytest.mark.asyncio
async def test_list_recordings(client: AsyncClient, db_session: AsyncSession):
    """Test listing recordings."""
    recording = await setup_device_with_recording(db_session)

    response = await client.get("/api/recordings")
    assert response.status_code == 200
    data = response.json()
    assert len(data["recordings"]) == 1
    assert data["recordings"][0]["id"] == recording.id
    assert data["recordings"][0]["type"] == "audio"
    assert data["recordings"][0]["filename"] == "test_recording.m4a"


@pytest.mark.asyncio
async def test_list_recordings_with_device_filter(client: AsyncClient, db_session: AsyncSession):
    """Test filtering recordings by device_id."""
    await setup_device_with_recording(db_session, device_id="device-1")

    # Create another device with recording
    await crud.create_device(
        db=db_session,
        device_id="device-2",
        name="Second iPhone",
        secret_hash=AuthService.hash_password("secret"),
        device_info={},
        settings_dict=DeviceSettings().model_dump(),
    )
    await crud.create_recording(
        db=db_session,
        device_id="device-2",
        recording_type="photo",
        filename="photo.jpg",
        size=500000,
        triggered_by="sound_detection",
    )
    await db_session.commit()

    # Filter by device-1
    response = await client.get("/api/recordings?device_id=device-1")
    assert response.status_code == 200
    data = response.json()
    assert len(data["recordings"]) == 1
    assert data["recordings"][0]["device_id"] == "device-1"


@pytest.mark.asyncio
async def test_list_recordings_with_type_filter(client: AsyncClient, db_session: AsyncSession):
    """Test filtering recordings by type."""
    await setup_device_with_recording(db_session)

    # Filter by audio
    response = await client.get("/api/recordings?type=audio")
    assert response.status_code == 200
    data = response.json()
    assert len(data["recordings"]) >= 1
    for rec in data["recordings"]:
        assert rec["type"] == "audio"


@pytest.mark.asyncio
async def test_list_recordings_with_trigger_filter(client: AsyncClient, db_session: AsyncSession):
    """Test filtering recordings by trigger type."""
    await setup_device_with_recording(db_session)

    # Filter by manual trigger
    response = await client.get("/api/recordings?triggered_by=manual")
    assert response.status_code == 200
    data = response.json()
    assert len(data["recordings"]) >= 1


@pytest.mark.asyncio
async def test_list_recordings_with_date_filter(client: AsyncClient, db_session: AsyncSession):
    """Test filtering recordings by date range."""
    await setup_device_with_recording(db_session)

    # Filter with date range
    response = await client.get(
        "/api/recordings?start_date=2020-01-01T00:00:00&end_date=2030-01-01T00:00:00"
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data["recordings"]) >= 1


@pytest.mark.asyncio
async def test_list_recordings_pagination(client: AsyncClient, db_session: AsyncSession):
    """Test recordings pagination."""
    # Create multiple recordings
    await crud.create_device(
        db=db_session,
        device_id="test-device",
        name="Test iPhone",
        secret_hash=AuthService.hash_password("secret"),
        device_info={},
        settings_dict=DeviceSettings().model_dump(),
    )

    for i in range(5):
        await crud.create_recording(
            db=db_session,
            device_id="test-device",
            recording_type="audio",
            filename=f"recording_{i}.m4a",
            size=1000,
            triggered_by="manual",
        )
    await db_session.commit()

    # Get first page
    response = await client.get("/api/recordings?limit=2&offset=0")
    assert response.status_code == 200
    data = response.json()
    assert len(data["recordings"]) == 2
    assert data["pagination"]["limit"] == 2
    assert data["pagination"]["offset"] == 0


@pytest.mark.asyncio
async def test_get_recording(client: AsyncClient, db_session: AsyncSession):
    """Test getting a specific recording."""
    recording = await setup_device_with_recording(db_session)

    response = await client.get(f"/api/recordings/{recording.id}")
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["recording"]["id"] == recording.id
    assert data["recording"]["deviceId"] == "test-device"
    assert data["recording"]["type"] == "audio"
    assert "downloadUrl" in data["recording"]


@pytest.mark.asyncio
async def test_get_nonexistent_recording(client: AsyncClient):
    """Test getting a non-existent recording."""
    response = await client.get("/api/recordings/nonexistent-id")
    assert response.status_code == 404
    data = response.json()
    assert "RECORDING_NOT_FOUND" in str(data)


@pytest.mark.asyncio
async def test_download_recording_not_implemented(client: AsyncClient, db_session: AsyncSession):
    """Test downloading a recording returns not implemented."""
    recording = await setup_device_with_recording(db_session)

    response = await client.get(f"/api/recordings/{recording.id}/download")
    assert response.status_code == 501
    data = response.json()
    assert "NOT_IMPLEMENTED" in str(data)


@pytest.mark.asyncio
async def test_download_nonexistent_recording(client: AsyncClient):
    """Test downloading a non-existent recording."""
    response = await client.get("/api/recordings/nonexistent-id/download")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_delete_recording(client: AsyncClient, db_session: AsyncSession):
    """Test deleting a recording."""
    recording = await setup_device_with_recording(db_session)

    response = await client.delete(f"/api/recordings/{recording.id}")
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True

    # Verify deleted
    response = await client.get(f"/api/recordings/{recording.id}")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_delete_nonexistent_recording(client: AsyncClient):
    """Test deleting a non-existent recording."""
    response = await client.delete("/api/recordings/nonexistent-id")
    assert response.status_code == 404
