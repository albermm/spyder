"""Recording-related Pydantic models."""

from datetime import datetime
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field


class RecordingType(str, Enum):
    """Type of recording."""

    AUDIO = "audio"
    PHOTO = "photo"


class TriggerType(str, Enum):
    """What triggered the recording."""

    MANUAL = "manual"
    SOUND_DETECTION = "sound_detection"


class RecordingCreate(BaseModel):
    """Internal model for creating a recording."""

    device_id: str
    type: RecordingType
    filename: str
    duration: Optional[int] = Field(None, ge=0, description="Duration in seconds")
    size: int = Field(..., ge=0, description="File size in bytes")
    triggered_by: TriggerType
    metadata: Optional[dict[str, Any]] = None


class RecordingResponse(BaseModel):
    """Response model for recording details."""

    id: str
    device_id: str
    type: RecordingType
    filename: str
    duration: Optional[int] = None
    size: int
    triggered_by: TriggerType
    created_at: datetime
    thumbnail_url: Optional[str] = None
    download_url: Optional[str] = None
    metadata: Optional[dict[str, Any]] = None

    model_config = {"from_attributes": True}


class RecordingListResponse(BaseModel):
    """Response for recording listing."""

    success: bool = True
    recordings: list[RecordingResponse]
    pagination: dict[str, int] = Field(
        default_factory=lambda: {"total": 0, "limit": 50, "offset": 0}
    )
