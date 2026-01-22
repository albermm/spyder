"""Command-related Pydantic models."""

from datetime import datetime
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field


class CommandAction(str, Enum):
    """Available command actions."""

    START_CAMERA = "start_camera"
    STOP_CAMERA = "stop_camera"
    SWITCH_CAMERA = "switch_camera"
    START_AUDIO = "start_audio"
    STOP_AUDIO = "stop_audio"
    CAPTURE_PHOTO = "capture_photo"
    START_RECORDING = "start_recording"
    STOP_RECORDING = "stop_recording"
    GET_LOCATION = "get_location"
    GET_STATUS = "get_status"
    SET_SOUND_THRESHOLD = "set_sound_threshold"
    ENABLE_SOUND_DETECTION = "enable_sound_detection"
    DISABLE_SOUND_DETECTION = "disable_sound_detection"


class CommandStatus(str, Enum):
    """Command execution status."""

    PENDING = "pending"
    QUEUED = "queued"
    DELIVERED = "delivered"
    EXECUTING = "executing"
    COMPLETED = "completed"
    FAILED = "failed"


class CommandCreate(BaseModel):
    """Request model for creating a command."""

    action: CommandAction
    params: Optional[dict[str, Any]] = None


class CommandResponse(BaseModel):
    """Response model for command details."""

    id: str
    device_id: str
    action: CommandAction
    params: Optional[dict[str, Any]] = None
    status: CommandStatus
    created_at: datetime
    delivered_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    error: Optional[str] = None

    model_config = {"from_attributes": True}


class CommandQueueResponse(BaseModel):
    """Response when command is queued for offline device."""

    success: bool = True
    command_id: str
    status: CommandStatus
    queue_position: Optional[int] = None


class CommandHistoryResponse(BaseModel):
    """Response for command history listing."""

    success: bool = True
    commands: list[CommandResponse]
    pagination: dict[str, int] = Field(
        default_factory=lambda: {"total": 0, "limit": 50, "offset": 0}
    )
