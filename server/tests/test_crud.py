"""Tests for CRUD operations to improve coverage."""

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import crud
from app.db.models import CommandStatusEnum, DeviceStatusEnum
from app.services.auth import AuthService
from app.models.device import DeviceSettings


@pytest.mark.asyncio
async def test_get_all_devices(db_session: AsyncSession):
    """Test getting all devices."""
    # Create multiple devices
    for i in range(3):
        await crud.create_device(
            db=db_session,
            device_id=f"device-{i}",
            name=f"iPhone {i}",
            secret_hash=AuthService.hash_password("secret"),
            device_info={},
            settings_dict=DeviceSettings().model_dump(),
        )
    await db_session.commit()

    devices = await crud.get_all_devices(db_session)
    assert len(devices) == 3


@pytest.mark.asyncio
async def test_update_device_status(db_session: AsyncSession):
    """Test updating device status."""
    await crud.create_device(
        db=db_session,
        device_id="status-device",
        name="Test iPhone",
        secret_hash=AuthService.hash_password("secret"),
        device_info={},
        settings_dict=DeviceSettings().model_dump(),
    )
    await db_session.commit()

    # Update to online with current status
    updated = await crud.update_device_status(
        db=db_session,
        device_id="status-device",
        status=DeviceStatusEnum.ONLINE,
        current_status={"battery": 90, "isCharging": False},
    )
    await db_session.commit()

    assert updated is not None
    assert updated.status == DeviceStatusEnum.ONLINE
    assert updated.current_status["battery"] == 90


@pytest.mark.asyncio
async def test_update_device_status_without_current_status(db_session: AsyncSession):
    """Test updating device status without current_status."""
    await crud.create_device(
        db=db_session,
        device_id="status-device-2",
        name="Test iPhone",
        secret_hash=AuthService.hash_password("secret"),
        device_info={},
        settings_dict=DeviceSettings().model_dump(),
    )
    await db_session.commit()

    updated = await crud.update_device_status(
        db=db_session,
        device_id="status-device-2",
        status=DeviceStatusEnum.OFFLINE,
    )
    await db_session.commit()

    assert updated is not None
    assert updated.status == DeviceStatusEnum.OFFLINE


@pytest.mark.asyncio
async def test_update_device_settings_name_only(db_session: AsyncSession):
    """Test updating device with name only."""
    await crud.create_device(
        db=db_session,
        device_id="settings-device-name",
        name="Original Name",
        secret_hash=AuthService.hash_password("secret"),
        device_info={},
        settings_dict=DeviceSettings().model_dump(),
    )
    await db_session.commit()

    updated = await crud.update_device_settings(
        db=db_session,
        device_id="settings-device-name",
        name="New Name",
    )
    await db_session.commit()

    assert updated is not None
    assert updated.name == "New Name"


@pytest.mark.asyncio
async def test_update_device_settings_dict_only(db_session: AsyncSession):
    """Test updating device with settings only."""
    await crud.create_device(
        db=db_session,
        device_id="settings-device-dict",
        name="Test iPhone",
        secret_hash=AuthService.hash_password("secret"),
        device_info={},
        settings_dict=DeviceSettings().model_dump(),
    )
    await db_session.commit()

    updated = await crud.update_device_settings(
        db=db_session,
        device_id="settings-device-dict",
        settings_dict={"soundDetection": True},
    )
    await db_session.commit()

    assert updated is not None
    assert updated.settings["soundDetection"] is True


@pytest.mark.asyncio
async def test_update_device_settings_nothing(db_session: AsyncSession):
    """Test updating device with no changes."""
    await crud.create_device(
        db=db_session,
        device_id="settings-device-nothing",
        name="Test iPhone",
        secret_hash=AuthService.hash_password("secret"),
        device_info={},
        settings_dict=DeviceSettings().model_dump(),
    )
    await db_session.commit()

    updated = await crud.update_device_settings(
        db=db_session,
        device_id="settings-device-nothing",
    )
    await db_session.commit()

    assert updated is not None


@pytest.mark.asyncio
async def test_delete_device(db_session: AsyncSession):
    """Test deleting a device."""
    await crud.create_device(
        db=db_session,
        device_id="delete-device",
        name="Test iPhone",
        secret_hash=AuthService.hash_password("secret"),
        device_info={},
        settings_dict=DeviceSettings().model_dump(),
    )
    await db_session.commit()

    result = await crud.delete_device(db_session, "delete-device")
    await db_session.commit()

    assert result is True

    # Verify it's gone
    device = await crud.get_device(db_session, "delete-device")
    assert device is None


@pytest.mark.asyncio
async def test_delete_nonexistent_device(db_session: AsyncSession):
    """Test deleting a non-existent device."""
    result = await crud.delete_device(db_session, "nonexistent")
    assert result is False


@pytest.mark.asyncio
async def test_create_command(db_session: AsyncSession):
    """Test creating a command."""
    await crud.create_device(
        db=db_session,
        device_id="cmd-device",
        name="Test iPhone",
        secret_hash=AuthService.hash_password("secret"),
        device_info={},
        settings_dict=DeviceSettings().model_dump(),
    )
    await db_session.commit()

    command = await crud.create_command(
        db=db_session,
        device_id="cmd-device",
        action="start_camera",
        params={"quality": "high"},
    )
    await db_session.commit()

    assert command is not None
    assert command.action == "start_camera"
    assert command.params == {"quality": "high"}
    assert command.status == CommandStatusEnum.PENDING


@pytest.mark.asyncio
async def test_get_pending_commands(db_session: AsyncSession):
    """Test getting pending commands for a device."""
    await crud.create_device(
        db=db_session,
        device_id="pending-cmd-device",
        name="Test iPhone",
        secret_hash=AuthService.hash_password("secret"),
        device_info={},
        settings_dict=DeviceSettings().model_dump(),
    )

    # Create pending commands
    await crud.create_command(
        db=db_session,
        device_id="pending-cmd-device",
        action="start_camera",
        status=CommandStatusEnum.PENDING,
    )
    await crud.create_command(
        db=db_session,
        device_id="pending-cmd-device",
        action="start_audio",
        status=CommandStatusEnum.QUEUED,
    )
    # Create a completed command (should not be returned)
    await crud.create_command(
        db=db_session,
        device_id="pending-cmd-device",
        action="take_photo",
        status=CommandStatusEnum.COMPLETED,
    )
    await db_session.commit()

    pending = await crud.get_pending_commands(db_session, "pending-cmd-device")
    assert len(pending) == 2


@pytest.mark.asyncio
async def test_update_command_status_delivered(db_session: AsyncSession):
    """Test updating command status to delivered."""
    await crud.create_device(
        db=db_session,
        device_id="upd-cmd-device",
        name="Test iPhone",
        secret_hash=AuthService.hash_password("secret"),
        device_info={},
        settings_dict=DeviceSettings().model_dump(),
    )

    command = await crud.create_command(
        db=db_session,
        device_id="upd-cmd-device",
        action="start_camera",
    )
    await db_session.commit()

    updated = await crud.update_command_status(
        db=db_session,
        command_id=command.id,
        status=CommandStatusEnum.DELIVERED,
    )
    await db_session.commit()

    assert updated is not None
    assert updated.status == CommandStatusEnum.DELIVERED
    assert updated.delivered_at is not None


@pytest.mark.asyncio
async def test_update_command_status_completed(db_session: AsyncSession):
    """Test updating command status to completed."""
    await crud.create_device(
        db=db_session,
        device_id="complete-cmd-device",
        name="Test iPhone",
        secret_hash=AuthService.hash_password("secret"),
        device_info={},
        settings_dict=DeviceSettings().model_dump(),
    )

    command = await crud.create_command(
        db=db_session,
        device_id="complete-cmd-device",
        action="start_camera",
    )
    await db_session.commit()

    updated = await crud.update_command_status(
        db=db_session,
        command_id=command.id,
        status=CommandStatusEnum.COMPLETED,
    )
    await db_session.commit()

    assert updated is not None
    assert updated.status == CommandStatusEnum.COMPLETED
    assert updated.completed_at is not None


@pytest.mark.asyncio
async def test_update_command_status_failed(db_session: AsyncSession):
    """Test updating command status to failed with error."""
    await crud.create_device(
        db=db_session,
        device_id="fail-cmd-device",
        name="Test iPhone",
        secret_hash=AuthService.hash_password("secret"),
        device_info={},
        settings_dict=DeviceSettings().model_dump(),
    )

    command = await crud.create_command(
        db=db_session,
        device_id="fail-cmd-device",
        action="start_camera",
    )
    await db_session.commit()

    updated = await crud.update_command_status(
        db=db_session,
        command_id=command.id,
        status=CommandStatusEnum.FAILED,
        error="Camera permission denied",
    )
    await db_session.commit()

    assert updated is not None
    assert updated.status == CommandStatusEnum.FAILED
    assert updated.error == "Camera permission denied"
    assert updated.completed_at is not None


@pytest.mark.asyncio
async def test_get_pairing_code(db_session: AsyncSession):
    """Test getting a pairing code."""
    pairing = await crud.create_pairing_code(db_session)
    await db_session.commit()

    retrieved = await crud.get_pairing_code(db_session, pairing.code)
    assert retrieved is not None
    assert retrieved.code == pairing.code


@pytest.mark.asyncio
async def test_get_nonexistent_pairing_code(db_session: AsyncSession):
    """Test getting a non-existent pairing code."""
    retrieved = await crud.get_pairing_code(db_session, "NOCODE")
    assert retrieved is None


@pytest.mark.asyncio
async def test_validate_pairing_code(db_session: AsyncSession):
    """Test validating a pairing code."""
    pairing = await crud.create_pairing_code(db_session)
    await db_session.commit()

    is_valid = await crud.validate_pairing_code(db_session, pairing.code)
    assert is_valid is True


@pytest.mark.asyncio
async def test_validate_nonexistent_pairing_code(db_session: AsyncSession):
    """Test validating a non-existent pairing code."""
    is_valid = await crud.validate_pairing_code(db_session, "NOCODE")
    assert is_valid is False


@pytest.mark.asyncio
async def test_use_pairing_code(db_session: AsyncSession):
    """Test marking a pairing code as used."""
    pairing = await crud.create_pairing_code(db_session)
    await db_session.commit()

    result = await crud.use_pairing_code(db_session, pairing.code, "test-device-id")
    await db_session.commit()

    assert result is True

    # Verify it's marked as used
    updated = await crud.get_pairing_code(db_session, pairing.code)
    assert updated.used == 1
    assert updated.device_id == "test-device-id"


@pytest.mark.asyncio
async def test_cleanup_expired_pairing_codes(db_session: AsyncSession):
    """Test cleaning up expired pairing codes."""
    from datetime import datetime, timedelta
    from app.db.models import PairingCode

    # Create an expired pairing code
    expired = PairingCode(
        code="EXPRD1",
        created_at=datetime.utcnow() - timedelta(hours=2),
        expires_at=datetime.utcnow() - timedelta(hours=1),
    )
    db_session.add(expired)

    # Create a valid pairing code
    valid = await crud.create_pairing_code(db_session)
    await db_session.commit()

    # Cleanup
    deleted_count = await crud.cleanup_expired_pairing_codes(db_session)
    await db_session.commit()

    assert deleted_count >= 1

    # Verify expired is gone but valid remains
    expired_check = await crud.get_pairing_code(db_session, "EXPRD1")
    valid_check = await crud.get_pairing_code(db_session, valid.code)

    assert expired_check is None
    assert valid_check is not None


@pytest.mark.asyncio
async def test_get_recordings_with_all_filters(db_session: AsyncSession):
    """Test getting recordings with all filter types."""
    from datetime import datetime, timedelta

    await crud.create_device(
        db=db_session,
        device_id="rec-filter-device",
        name="Test iPhone",
        secret_hash=AuthService.hash_password("secret"),
        device_info={},
        settings_dict=DeviceSettings().model_dump(),
    )

    await crud.create_recording(
        db=db_session,
        device_id="rec-filter-device",
        recording_type="audio",
        filename="test.m4a",
        size=1000,
        triggered_by="manual",
    )
    await db_session.commit()

    recordings, total = await crud.get_recordings(
        db=db_session,
        device_id="rec-filter-device",
        recording_type="audio",
        triggered_by="manual",
        start_date=datetime.utcnow() - timedelta(hours=1),
        end_date=datetime.utcnow() + timedelta(hours=1),
    )

    assert len(recordings) == 1
    assert total >= 1


@pytest.mark.asyncio
async def test_delete_recording(db_session: AsyncSession):
    """Test deleting a recording."""
    await crud.create_device(
        db=db_session,
        device_id="del-rec-device",
        name="Test iPhone",
        secret_hash=AuthService.hash_password("secret"),
        device_info={},
        settings_dict=DeviceSettings().model_dump(),
    )

    recording = await crud.create_recording(
        db=db_session,
        device_id="del-rec-device",
        recording_type="audio",
        filename="test.m4a",
        size=1000,
        triggered_by="manual",
    )
    await db_session.commit()

    result = await crud.delete_recording(db_session, recording.id)
    await db_session.commit()

    assert result is True

    # Verify it's gone
    deleted = await crud.get_recording(db_session, recording.id)
    assert deleted is None


@pytest.mark.asyncio
async def test_delete_nonexistent_recording(db_session: AsyncSession):
    """Test deleting a non-existent recording."""
    result = await crud.delete_recording(db_session, "nonexistent")
    assert result is False
