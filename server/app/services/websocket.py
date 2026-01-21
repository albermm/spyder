"""WebSocket (Socket.IO) event handlers."""

from datetime import datetime
from typing import Any, Optional

import socketio
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import AsyncSessionLocal
from app.db import crud
from app.db.models import DeviceStatusEnum
from app.models.device import DeviceStatusUpdate
from app.models.command import CommandAction
from app.services.auth import AuthService
from app.services.device_manager import device_manager
from app.services.command_queue import CommandQueue
from app.utils.logger import get_logger

logger = get_logger(__name__)


async def get_db_session() -> AsyncSession:
    """Get a database session for WebSocket handlers."""
    async with AsyncSessionLocal() as session:
        yield session


def setup_socketio_handlers(sio: socketio.AsyncServer) -> None:
    """Set up Socket.IO event handlers."""

    @sio.event
    async def connect(sid: str, environ: dict, auth: Optional[dict] = None) -> bool:
        """Handle new WebSocket connection."""
        logger.info(f"Connection attempt: {sid}")

        if not auth or "token" not in auth:
            logger.warning(f"Connection rejected (no auth): {sid}")
            return False

        # Validate JWT token
        payload = AuthService.decode_token(auth["token"])
        if not payload:
            logger.warning(f"Connection rejected (invalid token): {sid}")
            return False

        logger.info(f"Connection authenticated: {sid} ({payload.type}: {payload.sub})")
        return True

    @sio.event
    async def disconnect(sid: str) -> None:
        """Handle WebSocket disconnection."""
        # Check if it was a device
        device_id = device_manager.unregister_device(sid)
        if device_id:
            # Update database status
            async with AsyncSessionLocal() as db:
                await crud.update_device_status(db, device_id, DeviceStatusEnum.OFFLINE)
                await db.commit()

            # Notify controllers
            await sio.emit(
                "server:device_status",
                {
                    "type": "server:device_status",
                    "timestamp": datetime.utcnow().isoformat(),
                    "deviceId": device_id,
                    "online": False,
                    "lastSeen": datetime.utcnow().isoformat(),
                },
                room=f"controllers:{device_id}",
            )
            logger.info(f"Device disconnected: {device_id}")
            return

        # Check if it was a controller
        controller_id = device_manager.unregister_controller(sid)
        if controller_id:
            logger.info(f"Controller disconnected: {controller_id}")

    # ============= Device Events =============

    @sio.on("device:register")
    async def handle_device_register(sid: str, data: dict) -> dict:
        """Handle device registration after connection."""
        device_id = data.get("deviceId")
        if not device_id:
            return {"success": False, "error": "Missing deviceId"}

        # Register in memory
        device_manager.register_device(device_id, sid)

        # Join device room
        await sio.enter_room(sid, f"device:{device_id}")

        # Update database status
        async with AsyncSessionLocal() as db:
            await crud.update_device_status(db, device_id, DeviceStatusEnum.ONLINE)
            await db.commit()

            # Deliver any queued commands
            queued_commands = await CommandQueue.deliver_queued_commands(db, device_id)
            await db.commit()

        # Notify controllers
        await sio.emit(
            "server:device_status",
            {
                "type": "server:device_status",
                "timestamp": datetime.utcnow().isoformat(),
                "deviceId": device_id,
                "online": True,
                "lastSeen": datetime.utcnow().isoformat(),
            },
            room=f"controllers:{device_id}",
        )

        # Send queued commands to device
        for cmd in queued_commands:
            await sio.emit(
                "controller:command",
                {
                    "type": "controller:command",
                    "timestamp": datetime.utcnow().isoformat(),
                    "commandId": cmd.id,
                    "targetDeviceId": device_id,
                    "action": cmd.action.value,
                    "params": cmd.params,
                },
                room=f"device:{device_id}",
            )

        return {"success": True, "queuedCommands": len(queued_commands)}

    @sio.on("device:status")
    async def handle_device_status(sid: str, data: dict) -> None:
        """Handle device status update."""
        device_id = data.get("deviceId")
        status_data = data.get("status", {})

        if not device_id:
            return

        try:
            status = DeviceStatusUpdate(**status_data)
            device_manager.update_device_status(device_id, status)

            # Update in database
            async with AsyncSessionLocal() as db:
                await crud.update_device_status(
                    db, device_id, DeviceStatusEnum.ONLINE, status_data
                )
                await db.commit()

            # Forward to controllers
            await sio.emit(
                "server:device_status",
                {
                    "type": "server:device_status",
                    "timestamp": datetime.utcnow().isoformat(),
                    "deviceId": device_id,
                    "online": True,
                    "status": status_data,
                },
                room=f"controllers:{device_id}",
            )
        except Exception as e:
            logger.error(f"Error handling device status: {e}")

    @sio.on("device:frame")
    async def handle_device_frame(sid: str, data: dict) -> None:
        """Handle camera frame from device - forward to controllers."""
        device_id = data.get("deviceId")
        if device_id:
            await sio.emit(
                "device:frame",
                data,
                room=f"controllers:{device_id}",
            )

    @sio.on("device:audio")
    async def handle_device_audio(sid: str, data: dict) -> None:
        """Handle audio chunk from device - forward to controllers."""
        device_id = data.get("deviceId")
        if device_id:
            await sio.emit(
                "device:audio",
                data,
                room=f"controllers:{device_id}",
            )

    @sio.on("device:photo")
    async def handle_device_photo(sid: str, data: dict) -> None:
        """Handle captured photo from device."""
        device_id = data.get("deviceId")
        photo_data = data.get("photo", {})

        if not device_id:
            return

        # Store recording in database
        async with AsyncSessionLocal() as db:
            await crud.create_recording(
                db=db,
                device_id=device_id,
                recording_type="photo",
                filename=photo_data.get("filename", f"photo_{datetime.utcnow().timestamp()}.jpg"),
                size=len(photo_data.get("data", "")),
                triggered_by="manual",
            )
            await db.commit()

        # Forward to controllers
        await sio.emit(
            "device:photo",
            data,
            room=f"controllers:{device_id}",
        )

    @sio.on("device:location")
    async def handle_device_location(sid: str, data: dict) -> None:
        """Handle location update from device."""
        device_id = data.get("deviceId")
        if device_id:
            # Forward to controllers
            await sio.emit(
                "device:location",
                data,
                room=f"controllers:{device_id}",
            )

    @sio.on("device:sound_detected")
    async def handle_sound_detected(sid: str, data: dict) -> None:
        """Handle sound detection alert from device."""
        device_id = data.get("deviceId")
        if device_id:
            await sio.emit(
                "device:sound_detected",
                data,
                room=f"controllers:{device_id}",
            )

    @sio.on("device:recording_complete")
    async def handle_recording_complete(sid: str, data: dict) -> None:
        """Handle recording completion notification."""
        device_id = data.get("deviceId")
        recording_data = data.get("recording", {})

        if not device_id:
            return

        # Store in database
        async with AsyncSessionLocal() as db:
            await crud.create_recording(
                db=db,
                device_id=device_id,
                recording_type=recording_data.get("type", "audio"),
                filename=f"recording_{recording_data.get('id', datetime.utcnow().timestamp())}",
                size=recording_data.get("size", 0),
                duration=recording_data.get("duration"),
                triggered_by=recording_data.get("triggeredBy", "manual"),
            )
            await db.commit()

        # Forward to controllers
        await sio.emit(
            "device:recording_complete",
            data,
            room=f"controllers:{device_id}",
        )

    @sio.on("device:command_ack")
    async def handle_command_ack(sid: str, data: dict) -> None:
        """Handle command acknowledgment from device."""
        command_id = data.get("commandId")
        status = data.get("status")
        error = data.get("error")

        if not command_id:
            return

        async with AsyncSessionLocal() as db:
            if status == "completed":
                await CommandQueue.mark_completed(db, command_id)
            elif status == "failed":
                await CommandQueue.mark_completed(db, command_id, error=error)
            await db.commit()

        # Forward ack to controllers
        device = device_manager.get_device_by_socket(sid)
        if device:
            await sio.emit(
                "device:command_ack",
                data,
                room=f"controllers:{device.device_id}",
            )

    @sio.on("device:heartbeat")
    async def handle_device_heartbeat(sid: str, data: dict) -> None:
        """Handle device heartbeat."""
        device_id = data.get("deviceId")
        if device_id:
            device_manager.update_heartbeat(device_id)
            await sio.emit(
                "server:heartbeat_ack",
                {
                    "type": "server:heartbeat_ack",
                    "timestamp": datetime.utcnow().isoformat(),
                },
                to=sid,
            )

    # ============= Controller Events =============

    @sio.on("controller:register")
    async def handle_controller_register(sid: str, data: dict) -> dict:
        """Handle controller registration after connection."""
        controller_id = data.get("controllerId")
        target_device_id = data.get("targetDeviceId")

        if not controller_id or not target_device_id:
            return {"success": False, "error": "Missing controllerId or targetDeviceId"}

        # Register in memory
        device_manager.register_controller(controller_id, sid, target_device_id)

        # Join controller room for this device
        await sio.enter_room(sid, f"controllers:{target_device_id}")

        # Get current device status
        device = device_manager.get_device(target_device_id)
        is_online = device is not None

        return {
            "success": True,
            "deviceOnline": is_online,
            "deviceStatus": device.status.__dict__ if device and device.status else None,
        }

    @sio.on("controller:command")
    async def handle_controller_command(sid: str, data: dict) -> dict:
        """Handle command from controller to device."""
        command_id = data.get("commandId")
        target_device_id = data.get("targetDeviceId")
        action = data.get("action")
        params = data.get("params")

        if not target_device_id or not action:
            return {"success": False, "error": "Missing targetDeviceId or action"}

        try:
            action_enum = CommandAction(action)
        except ValueError:
            return {"success": False, "error": f"Invalid action: {action}"}

        # Queue command
        async with AsyncSessionLocal() as db:
            response, was_delivered = await CommandQueue.queue_command(
                db, target_device_id, action_enum, params
            )
            await db.commit()

        if was_delivered:
            # Send to device immediately
            device_socket = device_manager.get_device_socket_id(target_device_id)
            if device_socket:
                await sio.emit(
                    "controller:command",
                    {
                        "type": "controller:command",
                        "timestamp": datetime.utcnow().isoformat(),
                        "commandId": response.id,
                        "targetDeviceId": target_device_id,
                        "action": action,
                        "params": params,
                    },
                    to=device_socket,
                )
                return {"success": True, "commandId": response.id, "status": "delivered"}
        else:
            # Device offline, command queued
            async with AsyncSessionLocal() as db:
                queue_position = await CommandQueue.get_queue_position(db, response.id)

            await sio.emit(
                "server:command_queued",
                {
                    "type": "server:command_queued",
                    "timestamp": datetime.utcnow().isoformat(),
                    "commandId": response.id,
                    "position": queue_position,
                    "reason": "device_offline",
                },
                to=sid,
            )
            return {
                "success": True,
                "commandId": response.id,
                "status": "queued",
                "queuePosition": queue_position,
            }

        return {"success": True, "commandId": response.id}
