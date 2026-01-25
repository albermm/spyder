"""Device management API routes."""

from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import crud
from app.db.database import get_db
from app.models.device import DeviceDetailResponse, DeviceResponse, DeviceSettings, DeviceStatus
from app.models.command import (
    CommandAction,
    CommandCreate,
    CommandHistoryResponse,
    CommandQueueResponse,
    CommandResponse,
    CommandStatus,
)
from app.services.command_queue import CommandQueue
from app.services.device_manager import device_manager
from app.services.push_notification import push_service
from app.utils.logger import get_logger
from pydantic import BaseModel

logger = get_logger(__name__)
router = APIRouter()


@router.get("", response_model=dict)
async def list_devices(
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """List all paired devices."""
    devices = await crud.get_all_devices(db)

    return {
        "success": True,
        "devices": [
            {
                "id": d.id,
                "name": d.name,
                "status": d.status.value,
                "lastSeen": d.last_seen.isoformat() if d.last_seen else None,
                "batteryLevel": d.current_status.get("battery") if d.current_status else None,
                "deviceInfo": d.device_info,
                "settings": d.settings,
            }
            for d in devices
        ],
    }


@router.get("/{device_id}", response_model=dict)
async def get_device(
    device_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Get device details."""
    device = await crud.get_device(db, device_id)
    if not device:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "DEVICE_NOT_FOUND", "message": "Device not found"},
        )

    # Check if device is online in memory
    is_online = device_manager.is_device_online(device_id)
    connected_device = device_manager.get_device(device_id)

    return {
        "success": True,
        "device": {
            "id": device.id,
            "name": device.name,
            "status": "online" if is_online else "offline",
            "lastSeen": device.last_seen.isoformat() if device.last_seen else None,
            "deviceInfo": device.device_info,
            "currentStatus": connected_device.status.__dict__ if connected_device and connected_device.status else device.current_status,
            "settings": device.settings,
        },
    }


@router.patch("/{device_id}", response_model=dict)
async def update_device(
    device_id: str,
    name: Optional[str] = None,
    settings: Optional[dict] = None,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Update device name and/or settings."""
    device = await crud.get_device(db, device_id)
    if not device:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "DEVICE_NOT_FOUND", "message": "Device not found"},
        )

    # Merge settings if provided
    if settings:
        current_settings = device.settings or {}
        current_settings.update(settings)
        settings = current_settings

    updated = await crud.update_device_settings(db, device_id, name=name, settings_dict=settings)

    return {
        "success": True,
        "device": {
            "id": updated.id,
            "name": updated.name,
            "status": updated.status.value,
            "lastSeen": updated.last_seen.isoformat() if updated.last_seen else None,
            "settings": updated.settings,
        },
    }


@router.delete("/{device_id}", response_model=dict)
async def delete_device(
    device_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Unpair and delete a device."""
    device = await crud.get_device(db, device_id)
    if not device:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "DEVICE_NOT_FOUND", "message": "Device not found"},
        )

    await crud.delete_device(db, device_id)
    logger.info(f"Device deleted: {device_id}")

    return {
        "success": True,
        "message": f"Device {device_id} unpaired successfully",
    }


# ============= Commands =============


@router.post("/{device_id}/commands", response_model=dict, status_code=status.HTTP_202_ACCEPTED)
async def create_command(
    device_id: str,
    command: CommandCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Queue a command for a device."""
    device = await crud.get_device(db, device_id)
    if not device:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "DEVICE_NOT_FOUND", "message": "Device not found"},
        )

    response, was_delivered = await CommandQueue.queue_command(
        db, device_id, command.action, command.params
    )

    result = {
        "success": True,
        "commandId": response.id,
        "status": "delivered" if was_delivered else "queued",
    }

    if not was_delivered:
        queue_position = await CommandQueue.get_queue_position(db, response.id)
        result["queuePosition"] = queue_position

    return result


@router.get("/{device_id}/commands", response_model=CommandHistoryResponse)
async def get_command_history(
    device_id: str,
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by status"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
) -> CommandHistoryResponse:
    """Get command history for a device."""
    device = await crud.get_device(db, device_id)
    if not device:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "DEVICE_NOT_FOUND", "message": "Device not found"},
        )

    status_enum = None
    if status_filter:
        try:
            from app.db.models import CommandStatusEnum
            status_enum = CommandStatusEnum(status_filter)
        except ValueError:
            pass

    commands, total = await crud.get_commands_by_device(
        db, device_id, status=status_enum, limit=limit, offset=offset
    )

    return CommandHistoryResponse(
        commands=[
            CommandResponse(
                id=cmd.id,
                device_id=cmd.device_id,
                action=CommandAction(cmd.action),
                params=cmd.params,
                status=CommandStatus(cmd.status.value),
                created_at=cmd.created_at,
                delivered_at=cmd.delivered_at,
                completed_at=cmd.completed_at,
                error=cmd.error,
            )
            for cmd in commands
        ],
        pagination={"total": total, "limit": limit, "offset": offset},
    )


# ============= Push Notifications =============


class PushTokenRequest(BaseModel):
    """Request model for registering a push token."""
    token: str
    platform: str  # 'ios' or 'android'


class DeviceCommandRequest(BaseModel):
    """Request model for sending a command to a device via push."""

    action: str
    params: Optional[dict] = None


@router.post("/{device_id}/push-token", response_model=dict)
async def register_push_token(
    device_id: str,
    request: PushTokenRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Register a push notification token for the device."""
    device = await crud.get_device(db, device_id)
    if not device:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "DEVICE_NOT_FOUND", "message": "Device not found"},
        )

    # Update push token in database
    await crud.update_device_push_token(db, device_id, request.token, request.platform)
    logger.info(f"Push token registered for device {device_id}")

    return {
        "success": True,
        "message": "Push token registered successfully",
    }


@router.post("/{device_id}/command", response_model=dict)
async def send_command_to_device(
    device_id: str,
    command: DeviceCommandRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Send a command to a device via a silent push notification.

    The mobile client expects the command in the `action` field of the data
    payload, e.g. `{ "action": "START_RECORDING" }`.
    """

    device = await crud.get_device(db, device_id)
    if not device or not device.push_token:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": "DEVICE_NOT_FOUND",
                "message": "Device not found or no push token registered",
            },
        )

    sent = await push_service.send_command_notification(
        fcm_token=device.push_token,
        device_id=device_id,
        command=command.action,
        params=command.params,
    )

    if not sent:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "code": "PUSH_FAILED",
                "message": "Failed to send command notification",
            },
        )

    return {
        "success": True,
        "status": "command_sent",
        "message": f"Command '{command.action}' sent to device {device_id}",
    }


@router.post("/{device_id}/ping", response_model=dict)
async def ping_device(
    device_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """
    Send a silent push notification to wake up the device.

    This is used to check if the device is alive and trigger
    it to reconnect to the WebSocket if needed.
    """
    device = await crud.get_device(db, device_id)
    if not device:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "DEVICE_NOT_FOUND", "message": "Device not found"},
        )

    # Check if device is already online via WebSocket
    is_online = device_manager.is_device_online(device_id)

    if is_online:
        return {
            "success": True,
            "status": "already_online",
            "message": "Device is already connected via WebSocket",
        }

    # Check if device has a push token
    if not device.push_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "NO_PUSH_TOKEN",
                "message": "Device has no registered push token",
            },
        )

    # Send silent push notification
    sent = await push_service.send_silent_ping(device.push_token, device_id)

    if sent:
        return {
            "success": True,
            "status": "ping_sent",
            "message": "Silent push notification sent to device",
        }
    else:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "code": "PUSH_FAILED",
                "message": "Failed to send push notification",
            },
        )
