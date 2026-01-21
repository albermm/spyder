"""Device-related Pydantic models."""

from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class DeviceStatus(str, Enum):
    """Device connection status."""

    ONLINE = "online"
    OFFLINE = "offline"


class CameraQuality(str, Enum):
    """Camera quality levels."""

    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class SoundDetectionSettings(BaseModel):
    """Sound detection configuration."""

    enabled: bool = True
    threshold: float = Field(default=-30, ge=-60, le=0, description="Threshold in dB")
    record_duration: int = Field(
        default=30, ge=5, le=300, description="Recording duration in seconds"
    )


class CameraSettings(BaseModel):
    """Camera configuration."""

    quality: CameraQuality = CameraQuality.MEDIUM
    fps: int = Field(default=10, ge=1, le=30, description="Frames per second")


class LocationSettings(BaseModel):
    """Location tracking configuration."""

    tracking_enabled: bool = True
    update_interval: int = Field(
        default=300, ge=60, le=3600, description="Update interval in seconds"
    )


class DeviceSettings(BaseModel):
    """Combined device settings."""

    sound_detection: SoundDetectionSettings = Field(
        default_factory=SoundDetectionSettings
    )
    camera: CameraSettings = Field(default_factory=CameraSettings)
    location: LocationSettings = Field(default_factory=LocationSettings)


class DeviceInfo(BaseModel):
    """Device hardware/software information."""

    name: str = Field(..., min_length=1, max_length=100)
    model: str = Field(..., min_length=1, max_length=100)
    os_version: str = Field(..., min_length=1, max_length=50)
    app_version: str = Field(..., min_length=1, max_length=20)


class DeviceCreate(BaseModel):
    """Request model for device registration."""

    pairing_code: str = Field(..., min_length=6, max_length=6)
    name: str = Field(..., min_length=1, max_length=100)
    device_info: DeviceInfo


class DeviceResponse(BaseModel):
    """Response model for device details."""

    id: str
    name: str
    status: DeviceStatus
    last_seen: Optional[datetime] = None
    battery_level: Optional[int] = Field(None, ge=0, le=100)
    settings: DeviceSettings

    model_config = {"from_attributes": True}


class DeviceStatusUpdate(BaseModel):
    """Real-time device status update."""

    battery: int = Field(..., ge=0, le=100)
    charging: bool
    network_type: str = Field(..., pattern="^(wifi|cellular|none)$")
    signal_strength: int = Field(..., ge=0, le=4)
    camera_active: bool
    audio_active: bool
    location_enabled: bool


class DeviceDetailResponse(BaseModel):
    """Detailed device response including current status."""

    id: str
    name: str
    status: DeviceStatus
    last_seen: Optional[datetime] = None
    device_info: Optional[DeviceInfo] = None
    current_status: Optional[DeviceStatusUpdate] = None
    settings: DeviceSettings

    model_config = {"from_attributes": True}
