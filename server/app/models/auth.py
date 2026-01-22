"""Authentication-related Pydantic models."""

from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class ClientType(str, Enum):
    """Type of client connecting."""

    DEVICE = "device"
    CONTROLLER = "controller"


class RegisterRequest(BaseModel):
    """Request model for registration."""

    type: ClientType
    pairing_code: Optional[str] = Field(
        None, min_length=6, max_length=6, description="Required for device registration"
    )
    device_id: Optional[str] = Field(
        None, description="For controller, specify which device to control"
    )
    name: str = Field(..., min_length=1, max_length=100)


class LoginRequest(BaseModel):
    """Request model for login."""

    device_id: str
    secret: str = Field(..., min_length=1)


class TokenResponse(BaseModel):
    """Response model for authentication tokens."""

    success: bool = True
    token: str
    refresh_token: str
    expires_in: int = Field(..., description="Token expiration in seconds")
    device_id: Optional[str] = Field(
        None, description="Generated device ID for new device"
    )


class RefreshRequest(BaseModel):
    """Request model for token refresh."""

    refresh_token: str


class RefreshResponse(BaseModel):
    """Response model for token refresh."""

    success: bool = True
    token: str
    expires_in: int


class PairingResponse(BaseModel):
    """Response model for pairing code generation."""

    success: bool = True
    pairing_code: str = Field(..., min_length=6, max_length=6)
    expires_at: datetime


class JWTPayload(BaseModel):
    """JWT token payload structure.

    Note: exp is Optional because refresh tokens for trusted
    first-party devices may have no expiration.
    """

    sub: str  # device_id or controller_id
    type: ClientType
    iat: datetime
    exp: Optional[datetime] = None  # None = no expiration (for refresh tokens)
