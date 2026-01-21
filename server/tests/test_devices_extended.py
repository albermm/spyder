"""Extended tests for device endpoints to improve coverage."""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import crud
from app.services.auth import AuthService
from app.models.device import DeviceSettings


@pytest.mark.asyncio
async def test_update_device_with_settings(client: AsyncClient, db_session: AsyncSession):
    """Test updating device settings."""
    await crud.create_device(
        db=db_session,
        device_id="test-device-settings",
        name="Test iPhone",
        secret_hash=AuthService.hash_password("secret"),
        device_info={},
        settings_dict=DeviceSettings().model_dump(),
    )
    await db_session.commit()

    # Update with settings
    response = await client.patch(
        "/api/devices/test-device-settings",
        params={"settings": '{"soundDetection": true}'},
    )
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_update_nonexistent_device(client: AsyncClient):
    """Test updating a non-existent device fails."""
    response = await client.patch(
        "/api/devices/nonexistent",
        params={"name": "New Name"},
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_delete_nonexistent_device(client: AsyncClient):
    """Test deleting a non-existent device fails."""
    response = await client.delete("/api/devices/nonexistent")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_get_command_history_nonexistent_device(client: AsyncClient):
    """Test getting command history for non-existent device fails."""
    response = await client.get("/api/devices/nonexistent/commands")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_get_command_history_with_status_filter(
    client: AsyncClient, db_session: AsyncSession
):
    """Test getting command history with status filter."""
    await crud.create_device(
        db=db_session,
        device_id="test-device-cmd-filter",
        name="Test iPhone",
        secret_hash=AuthService.hash_password("secret"),
        device_info={},
        settings_dict=DeviceSettings().model_dump(),
    )
    await db_session.commit()

    # Create some commands
    await client.post(
        "/api/devices/test-device-cmd-filter/commands",
        json={"action": "start_camera"},
    )

    # Get with status filter
    response = await client.get(
        "/api/devices/test-device-cmd-filter/commands?status=pending"
    )
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_get_command_history_with_invalid_status_filter(
    client: AsyncClient, db_session: AsyncSession
):
    """Test getting command history with invalid status filter is handled gracefully."""
    await crud.create_device(
        db=db_session,
        device_id="test-device-invalid-status",
        name="Test iPhone",
        secret_hash=AuthService.hash_password("secret"),
        device_info={},
        settings_dict=DeviceSettings().model_dump(),
    )
    await db_session.commit()

    # Get with invalid status filter - should return all (ignoring invalid status)
    response = await client.get(
        "/api/devices/test-device-invalid-status/commands?status=invalid_status"
    )
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_get_command_history_pagination(
    client: AsyncClient, db_session: AsyncSession
):
    """Test command history pagination."""
    await crud.create_device(
        db=db_session,
        device_id="test-device-pagination",
        name="Test iPhone",
        secret_hash=AuthService.hash_password("secret"),
        device_info={},
        settings_dict=DeviceSettings().model_dump(),
    )
    await db_session.commit()

    # Create multiple commands
    for i in range(5):
        await client.post(
            "/api/devices/test-device-pagination/commands",
            json={"action": "start_camera"},
        )

    # Get first page
    response = await client.get(
        "/api/devices/test-device-pagination/commands?limit=2&offset=0"
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data["commands"]) == 2
    assert data["pagination"]["limit"] == 2


@pytest.mark.asyncio
async def test_create_command_with_params(client: AsyncClient, db_session: AsyncSession):
    """Test creating a command with parameters."""
    await crud.create_device(
        db=db_session,
        device_id="test-device-params",
        name="Test iPhone",
        secret_hash=AuthService.hash_password("secret"),
        device_info={},
        settings_dict=DeviceSettings().model_dump(),
    )
    await db_session.commit()

    response = await client.post(
        "/api/devices/test-device-params/commands",
        json={
            "action": "start_audio",
            "params": {"duration": 60, "quality": "high"},
        },
    )
    assert response.status_code == 202
    data = response.json()
    assert data["success"] is True
    assert "commandId" in data


@pytest.mark.asyncio
async def test_create_command_different_actions(client: AsyncClient, db_session: AsyncSession):
    """Test creating commands with different action types."""
    await crud.create_device(
        db=db_session,
        device_id="test-device-actions",
        name="Test iPhone",
        secret_hash=AuthService.hash_password("secret"),
        device_info={},
        settings_dict=DeviceSettings().model_dump(),
    )
    await db_session.commit()

    actions = ["start_camera", "stop_camera", "start_audio", "stop_audio", "capture_photo"]

    for action in actions:
        response = await client.post(
            "/api/devices/test-device-actions/commands",
            json={"action": action},
        )
        assert response.status_code == 202


@pytest.mark.asyncio
async def test_get_device_with_current_status(client: AsyncClient, db_session: AsyncSession):
    """Test getting device that has current_status data."""
    from app.db.models import DeviceStatusEnum

    device = await crud.create_device(
        db=db_session,
        device_id="test-device-with-status",
        name="Test iPhone",
        secret_hash=AuthService.hash_password("secret"),
        device_info={"model": "iPhone 14", "osVersion": "17.0"},
        settings_dict=DeviceSettings().model_dump(),
    )
    await db_session.commit()

    # Update device with current_status
    await crud.update_device_status(
        db=db_session,
        device_id="test-device-with-status",
        status=DeviceStatusEnum.ONLINE,
        current_status={"battery": 85, "isCharging": True},
    )
    await db_session.commit()

    response = await client.get("/api/devices/test-device-with-status")
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["device"]["deviceInfo"]["model"] == "iPhone 14"
