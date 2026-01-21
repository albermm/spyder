"""Device state management service."""

from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional

from app.models.device import DeviceStatusUpdate
from app.utils.logger import get_logger

logger = get_logger(__name__)


@dataclass
class ConnectedDevice:
    """Represents a connected device's state."""

    device_id: str
    socket_id: str
    connected_at: datetime = field(default_factory=datetime.utcnow)
    last_heartbeat: datetime = field(default_factory=datetime.utcnow)
    status: Optional[DeviceStatusUpdate] = None
    camera_active: bool = False
    audio_active: bool = False


@dataclass
class ConnectedController:
    """Represents a connected controller's state."""

    controller_id: str
    socket_id: str
    target_device_id: str
    connected_at: datetime = field(default_factory=datetime.utcnow)


class DeviceManager:
    """Manages connected devices and controllers in memory."""

    def __init__(self) -> None:
        self._devices: dict[str, ConnectedDevice] = {}
        self._controllers: dict[str, ConnectedController] = {}
        self._socket_to_device: dict[str, str] = {}
        self._socket_to_controller: dict[str, str] = {}

    def register_device(self, device_id: str, socket_id: str) -> ConnectedDevice:
        """Register a device connection."""
        device = ConnectedDevice(device_id=device_id, socket_id=socket_id)
        self._devices[device_id] = device
        self._socket_to_device[socket_id] = device_id
        logger.info(f"Device registered: {device_id} (socket: {socket_id})")
        return device

    def unregister_device(self, socket_id: str) -> Optional[str]:
        """Unregister a device by socket ID."""
        device_id = self._socket_to_device.pop(socket_id, None)
        if device_id:
            self._devices.pop(device_id, None)
            logger.info(f"Device unregistered: {device_id}")
        return device_id

    def get_device(self, device_id: str) -> Optional[ConnectedDevice]:
        """Get a connected device by ID."""
        return self._devices.get(device_id)

    def get_device_by_socket(self, socket_id: str) -> Optional[ConnectedDevice]:
        """Get a connected device by socket ID."""
        device_id = self._socket_to_device.get(socket_id)
        if device_id:
            return self._devices.get(device_id)
        return None

    def is_device_online(self, device_id: str) -> bool:
        """Check if a device is currently connected."""
        return device_id in self._devices

    def update_device_status(
        self, device_id: str, status: DeviceStatusUpdate
    ) -> None:
        """Update a device's status."""
        device = self._devices.get(device_id)
        if device:
            device.status = status
            device.last_heartbeat = datetime.utcnow()
            device.camera_active = status.camera_active
            device.audio_active = status.audio_active

    def update_heartbeat(self, device_id: str) -> None:
        """Update device heartbeat timestamp."""
        device = self._devices.get(device_id)
        if device:
            device.last_heartbeat = datetime.utcnow()

    def register_controller(
        self, controller_id: str, socket_id: str, target_device_id: str
    ) -> ConnectedController:
        """Register a controller connection."""
        controller = ConnectedController(
            controller_id=controller_id,
            socket_id=socket_id,
            target_device_id=target_device_id,
        )
        self._controllers[controller_id] = controller
        self._socket_to_controller[socket_id] = controller_id
        logger.info(
            f"Controller registered: {controller_id} targeting {target_device_id}"
        )
        return controller

    def unregister_controller(self, socket_id: str) -> Optional[str]:
        """Unregister a controller by socket ID."""
        controller_id = self._socket_to_controller.pop(socket_id, None)
        if controller_id:
            self._controllers.pop(controller_id, None)
            logger.info(f"Controller unregistered: {controller_id}")
        return controller_id

    def get_controller(self, controller_id: str) -> Optional[ConnectedController]:
        """Get a connected controller by ID."""
        return self._controllers.get(controller_id)

    def get_controller_by_socket(
        self, socket_id: str
    ) -> Optional[ConnectedController]:
        """Get a connected controller by socket ID."""
        controller_id = self._socket_to_controller.get(socket_id)
        if controller_id:
            return self._controllers.get(controller_id)
        return None

    def get_controllers_for_device(self, device_id: str) -> list[ConnectedController]:
        """Get all controllers watching a specific device."""
        return [
            c for c in self._controllers.values() if c.target_device_id == device_id
        ]

    def get_device_socket_id(self, device_id: str) -> Optional[str]:
        """Get the socket ID for a device."""
        device = self._devices.get(device_id)
        return device.socket_id if device else None

    def get_online_device_ids(self) -> list[str]:
        """Get list of all online device IDs."""
        return list(self._devices.keys())

    def get_stats(self) -> dict:
        """Get connection statistics."""
        return {
            "devices_online": len(self._devices),
            "controllers_online": len(self._controllers),
            "devices": list(self._devices.keys()),
        }


# Singleton instance
device_manager = DeviceManager()
