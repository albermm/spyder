"""Tests for WebSocket functionality."""

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.device_manager import DeviceManager, device_manager
from app.models.device import DeviceStatusUpdate


class TestDeviceManager:
    """Tests for DeviceManager."""

    def setup_method(self):
        """Set up a fresh DeviceManager for each test."""
        self.manager = DeviceManager()

    def test_register_device(self):
        """Test device registration."""
        device = self.manager.register_device("device-1", "socket-1")
        assert device.device_id == "device-1"
        assert device.socket_id == "socket-1"
        assert self.manager.is_device_online("device-1")

    def test_unregister_device(self):
        """Test device unregistration."""
        self.manager.register_device("device-1", "socket-1")
        device_id = self.manager.unregister_device("socket-1")
        assert device_id == "device-1"
        assert not self.manager.is_device_online("device-1")

    def test_get_device(self):
        """Test getting a device by ID."""
        self.manager.register_device("device-1", "socket-1")
        device = self.manager.get_device("device-1")
        assert device is not None
        assert device.device_id == "device-1"

    def test_get_device_by_socket(self):
        """Test getting a device by socket ID."""
        self.manager.register_device("device-1", "socket-1")
        device = self.manager.get_device_by_socket("socket-1")
        assert device is not None
        assert device.device_id == "device-1"

    def test_update_device_status(self):
        """Test updating device status."""
        self.manager.register_device("device-1", "socket-1")
        status = DeviceStatusUpdate(
            battery=85,
            charging=False,
            network_type="wifi",
            signal_strength=4,
            camera_active=True,
            audio_active=False,
            location_enabled=True,
        )
        self.manager.update_device_status("device-1", status)
        device = self.manager.get_device("device-1")
        assert device.status == status
        assert device.camera_active is True

    def test_register_controller(self):
        """Test controller registration."""
        controller = self.manager.register_controller(
            "controller-1", "socket-2", "device-1"
        )
        assert controller.controller_id == "controller-1"
        assert controller.target_device_id == "device-1"

    def test_get_controllers_for_device(self):
        """Test getting controllers for a device."""
        self.manager.register_controller("controller-1", "socket-2", "device-1")
        self.manager.register_controller("controller-2", "socket-3", "device-1")
        self.manager.register_controller("controller-3", "socket-4", "device-2")

        controllers = self.manager.get_controllers_for_device("device-1")
        assert len(controllers) == 2
        controller_ids = [c.controller_id for c in controllers]
        assert "controller-1" in controller_ids
        assert "controller-2" in controller_ids

    def test_get_device_socket_id(self):
        """Test getting socket ID for a device."""
        self.manager.register_device("device-1", "socket-1")
        socket_id = self.manager.get_device_socket_id("device-1")
        assert socket_id == "socket-1"

    def test_get_online_device_ids(self):
        """Test getting list of online devices."""
        self.manager.register_device("device-1", "socket-1")
        self.manager.register_device("device-2", "socket-2")
        device_ids = self.manager.get_online_device_ids()
        assert len(device_ids) == 2
        assert "device-1" in device_ids
        assert "device-2" in device_ids

    def test_get_stats(self):
        """Test getting connection statistics."""
        self.manager.register_device("device-1", "socket-1")
        self.manager.register_controller("controller-1", "socket-2", "device-1")

        stats = self.manager.get_stats()
        assert stats["devices_online"] == 1
        assert stats["controllers_online"] == 1
        assert "device-1" in stats["devices"]


@pytest.mark.asyncio
async def test_command_queue_offline_device(db_session: AsyncSession):
    """Test command queuing for offline device."""
    from app.db import crud
    from app.services.auth import AuthService
    from app.services.command_queue import CommandQueue
    from app.models.device import DeviceSettings
    from app.models.command import CommandAction

    # Create a device
    await crud.create_device(
        db=db_session,
        device_id="test-device-1",
        name="Test iPhone",
        secret_hash=AuthService.hash_password("secret"),
        device_info={},
        settings_dict=DeviceSettings().model_dump(),
    )
    await db_session.commit()

    # Queue a command (device is offline)
    response, was_delivered = await CommandQueue.queue_command(
        db_session,
        "test-device-1",
        CommandAction.START_CAMERA,
        {"quality": "medium"},
    )
    await db_session.commit()

    assert not was_delivered  # Device is offline
    assert response.status.value == "queued"

    # Get pending commands
    pending = await CommandQueue.get_pending_commands(db_session, "test-device-1")
    assert len(pending) == 1
    assert pending[0].id == response.id
