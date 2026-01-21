"""Tests for device endpoints."""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import crud
from app.models.device import DeviceSettings


@pytest.mark.asyncio
async def test_list_devices_empty(client: AsyncClient):
    """Test listing devices when none exist."""
    response = await client.get("/api/devices")
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["devices"] == []


@pytest.mark.asyncio
async def test_list_devices(client: AsyncClient, db_session: AsyncSession):
    """Test listing devices."""
    # Create a device
    from app.services.auth import AuthService

    await crud.create_device(
        db=db_session,
        device_id="test-device-1",
        name="Test iPhone",
        secret_hash=AuthService.hash_password("secret"),
        device_info={"model": "iPhone 14", "osVersion": "17.0"},
        settings_dict=DeviceSettings().model_dump(),
    )
    await db_session.commit()

    response = await client.get("/api/devices")
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert len(data["devices"]) == 1
    assert data["devices"][0]["id"] == "test-device-1"
    assert data["devices"][0]["name"] == "Test iPhone"


@pytest.mark.asyncio
async def test_get_device(client: AsyncClient, db_session: AsyncSession):
    """Test getting a specific device."""
    from app.services.auth import AuthService

    await crud.create_device(
        db=db_session,
        device_id="test-device-1",
        name="Test iPhone",
        secret_hash=AuthService.hash_password("secret"),
        device_info={"model": "iPhone 14"},
        settings_dict=DeviceSettings().model_dump(),
    )
    await db_session.commit()

    response = await client.get("/api/devices/test-device-1")
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["device"]["id"] == "test-device-1"
    assert data["device"]["name"] == "Test iPhone"


@pytest.mark.asyncio
async def test_get_nonexistent_device(client: AsyncClient):
    """Test getting a non-existent device."""
    response = await client.get("/api/devices/nonexistent")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_update_device(client: AsyncClient, db_session: AsyncSession):
    """Test updating a device."""
    from app.services.auth import AuthService

    await crud.create_device(
        db=db_session,
        device_id="test-device-1",
        name="Test iPhone",
        secret_hash=AuthService.hash_password("secret"),
        device_info={},
        settings_dict=DeviceSettings().model_dump(),
    )
    await db_session.commit()

    response = await client.patch(
        "/api/devices/test-device-1",
        params={"name": "Updated iPhone"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["device"]["name"] == "Updated iPhone"


@pytest.mark.asyncio
async def test_delete_device(client: AsyncClient, db_session: AsyncSession):
    """Test deleting a device."""
    from app.services.auth import AuthService

    await crud.create_device(
        db=db_session,
        device_id="test-device-1",
        name="Test iPhone",
        secret_hash=AuthService.hash_password("secret"),
        device_info={},
        settings_dict=DeviceSettings().model_dump(),
    )
    await db_session.commit()

    response = await client.delete("/api/devices/test-device-1")
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True

    # Verify device is deleted
    response = await client.get("/api/devices/test-device-1")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_create_command(client: AsyncClient, db_session: AsyncSession):
    """Test creating a command for a device."""
    from app.services.auth import AuthService

    await crud.create_device(
        db=db_session,
        device_id="test-device-1",
        name="Test iPhone",
        secret_hash=AuthService.hash_password("secret"),
        device_info={},
        settings_dict=DeviceSettings().model_dump(),
    )
    await db_session.commit()

    response = await client.post(
        "/api/devices/test-device-1/commands",
        json={
            "action": "start_camera",
            "params": {"quality": "medium", "fps": 10},
        },
    )
    assert response.status_code == 202
    data = response.json()
    assert data["success"] is True
    assert "commandId" in data
    assert data["status"] in ["delivered", "queued"]


@pytest.mark.asyncio
async def test_create_command_for_nonexistent_device(client: AsyncClient):
    """Test creating a command for non-existent device."""
    response = await client.post(
        "/api/devices/nonexistent/commands",
        json={"action": "start_camera"},
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_get_command_history(client: AsyncClient, db_session: AsyncSession):
    """Test getting command history."""
    from app.services.auth import AuthService

    await crud.create_device(
        db=db_session,
        device_id="test-device-1",
        name="Test iPhone",
        secret_hash=AuthService.hash_password("secret"),
        device_info={},
        settings_dict=DeviceSettings().model_dump(),
    )
    await db_session.commit()

    # Create some commands
    await client.post(
        "/api/devices/test-device-1/commands",
        json={"action": "start_camera"},
    )
    await client.post(
        "/api/devices/test-device-1/commands",
        json={"action": "stop_camera"},
    )

    response = await client.get("/api/devices/test-device-1/commands")
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert len(data["commands"]) == 2
    assert "pagination" in data
