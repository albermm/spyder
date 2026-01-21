"""Authentication API routes."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import crud
from app.db.database import get_db
from app.models.auth import (
    ClientType,
    LoginRequest,
    PairingResponse,
    RefreshRequest,
    RefreshResponse,
    RegisterRequest,
    TokenResponse,
)
from app.models.device import DeviceSettings
from app.services.auth import AuthService
from app.utils.logger import get_logger

logger = get_logger(__name__)
router = APIRouter()


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(
    request: RegisterRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> TokenResponse:
    """Register a new device or controller."""
    if request.type == ClientType.DEVICE:
        # Device registration requires pairing code
        if not request.pairing_code:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": "INVALID_INPUT", "message": "Pairing code required for device registration"},
            )

        # Validate pairing code
        is_valid = await crud.validate_pairing_code(db, request.pairing_code)
        if not is_valid:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": "PAIRING_CODE_INVALID", "message": "Invalid or expired pairing code"},
            )

        # Create device
        device_id = str(uuid.uuid4())
        secret = AuthService.generate_device_secret()
        secret_hash = AuthService.hash_password(secret)

        device_settings = DeviceSettings()

        await crud.create_device(
            db=db,
            device_id=device_id,
            name=request.name,
            secret_hash=secret_hash,
            device_info={},  # Will be updated on WebSocket connect
            settings_dict=device_settings.model_dump(),
        )

        # Mark pairing code as used
        await crud.use_pairing_code(db, request.pairing_code, device_id)

        # Generate tokens
        token = AuthService.create_access_token(device_id, ClientType.DEVICE)
        refresh_token = AuthService.create_refresh_token(device_id, ClientType.DEVICE)

        logger.info(f"Device registered: {device_id} ({request.name})")

        return TokenResponse(
            token=token,
            refresh_token=refresh_token,
            expires_in=AuthService.get_token_expiry_seconds(),
            device_id=device_id,
        )

    else:
        # Controller registration
        if not request.device_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": "INVALID_INPUT", "message": "Device ID required for controller registration"},
            )

        # Verify device exists
        device = await crud.get_device(db, request.device_id)
        if not device:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"code": "DEVICE_NOT_FOUND", "message": "Device not found"},
            )

        controller_id = str(uuid.uuid4())
        token = AuthService.create_access_token(controller_id, ClientType.CONTROLLER)
        refresh_token = AuthService.create_refresh_token(controller_id, ClientType.CONTROLLER)

        logger.info(f"Controller registered: {controller_id} for device {request.device_id}")

        return TokenResponse(
            token=token,
            refresh_token=refresh_token,
            expires_in=AuthService.get_token_expiry_seconds(),
        )


@router.post("/login", response_model=TokenResponse)
async def login(
    request: LoginRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> TokenResponse:
    """Login existing device."""
    device = await crud.get_device(db, request.device_id)
    if not device:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "AUTH_FAILED", "message": "Invalid credentials"},
        )

    if not AuthService.verify_password(request.secret, device.secret_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "AUTH_FAILED", "message": "Invalid credentials"},
        )

    token = AuthService.create_access_token(device.id, ClientType.DEVICE)
    refresh_token = AuthService.create_refresh_token(device.id, ClientType.DEVICE)

    logger.info(f"Device logged in: {device.id}")

    return TokenResponse(
        token=token,
        refresh_token=refresh_token,
        expires_in=AuthService.get_token_expiry_seconds(),
    )


@router.post("/refresh", response_model=RefreshResponse)
async def refresh_token(request: RefreshRequest) -> RefreshResponse:
    """Refresh an access token."""
    if not AuthService.is_refresh_token(request.refresh_token):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "TOKEN_INVALID", "message": "Invalid refresh token"},
        )

    payload = AuthService.decode_token(request.refresh_token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "TOKEN_EXPIRED", "message": "Refresh token expired"},
        )

    new_token = AuthService.create_access_token(payload.sub, payload.type)

    return RefreshResponse(
        token=new_token,
        expires_in=AuthService.get_token_expiry_seconds(),
    )


@router.post("/pair", response_model=PairingResponse, status_code=status.HTTP_201_CREATED)
async def create_pairing_code(
    db: Annotated[AsyncSession, Depends(get_db)],
) -> PairingResponse:
    """Generate a new pairing code for device registration."""
    # Clean up expired codes first
    await crud.cleanup_expired_pairing_codes(db)

    pairing = await crud.create_pairing_code(db)

    logger.info(f"Pairing code created: {pairing.code}")

    return PairingResponse(
        pairing_code=pairing.code,
        expires_at=pairing.expires_at,
    )


@router.get("/lookup-pairing/{code}")
async def lookup_pairing_code(
    code: str,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Look up device_id from a used pairing code."""
    pairing = await crud.get_pairing_code(db, code.upper())

    if not pairing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "PAIRING_NOT_FOUND", "message": "Pairing code not found"},
        )

    if not pairing.device_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "DEVICE_NOT_REGISTERED", "message": "Device has not registered yet"},
        )

    return {"device_id": pairing.device_id, "code": pairing.code}
