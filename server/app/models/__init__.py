"""Pydantic models for API requests/responses."""

from app.models.device import (
    CameraQuality,
    CameraSettings,
    DeviceCreate,
    DeviceInfo,
    DeviceResponse,
    DeviceSettings,
    DeviceStatus,
    DeviceStatusUpdate,
    LocationSettings,
    SoundDetectionSettings,
)
from app.models.command import (
    CommandAction,
    CommandCreate,
    CommandResponse,
    CommandStatus,
)
from app.models.recording import (
    RecordingCreate,
    RecordingResponse,
    RecordingType,
    TriggerType,
)
from app.models.auth import (
    LoginRequest,
    RegisterRequest,
    TokenResponse,
    RefreshRequest,
    PairingResponse,
    ClientType,
)

__all__ = [
    # Device
    "DeviceStatus",
    "CameraQuality",
    "SoundDetectionSettings",
    "CameraSettings",
    "LocationSettings",
    "DeviceSettings",
    "DeviceInfo",
    "DeviceCreate",
    "DeviceResponse",
    "DeviceStatusUpdate",
    # Command
    "CommandAction",
    "CommandStatus",
    "CommandCreate",
    "CommandResponse",
    # Recording
    "RecordingType",
    "TriggerType",
    "RecordingCreate",
    "RecordingResponse",
    # Auth
    "ClientType",
    "LoginRequest",
    "RegisterRequest",
    "TokenResponse",
    "RefreshRequest",
    "PairingResponse",
]
