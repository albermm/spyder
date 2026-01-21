"""Command queue service for offline device handling."""

from datetime import datetime
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.db import crud
from app.db.models import CommandStatusEnum
from app.models.command import CommandAction, CommandResponse, CommandStatus
from app.services.device_manager import device_manager
from app.utils.logger import get_logger

logger = get_logger(__name__)


class CommandQueue:
    """Manages command queuing and delivery."""

    @staticmethod
    async def queue_command(
        db: AsyncSession,
        device_id: str,
        action: CommandAction,
        params: Optional[dict] = None,
    ) -> tuple[CommandResponse, bool]:
        """
        Queue a command for a device.

        Returns:
            Tuple of (CommandResponse, was_delivered_immediately)
        """
        is_online = device_manager.is_device_online(device_id)

        # Determine initial status
        if is_online:
            status = CommandStatusEnum.DELIVERED
        else:
            status = CommandStatusEnum.QUEUED

        # Create command in database
        command = await crud.create_command(
            db=db,
            device_id=device_id,
            action=action.value,
            params=params,
            status=status,
        )

        logger.info(
            f"Command queued: {command.id} ({action.value}) for device {device_id} "
            f"- Status: {status.value}"
        )

        response = CommandResponse(
            id=command.id,
            device_id=command.device_id,
            action=CommandAction(command.action),
            params=command.params,
            status=CommandStatus(command.status.value),
            created_at=command.created_at,
            delivered_at=command.delivered_at,
        )

        return response, is_online

    @staticmethod
    async def get_pending_commands(
        db: AsyncSession, device_id: str
    ) -> list[CommandResponse]:
        """Get all pending/queued commands for a device."""
        commands = await crud.get_pending_commands(db, device_id)
        return [
            CommandResponse(
                id=cmd.id,
                device_id=cmd.device_id,
                action=CommandAction(cmd.action),
                params=cmd.params,
                status=CommandStatus(cmd.status.value),
                created_at=cmd.created_at,
                delivered_at=cmd.delivered_at,
            )
            for cmd in commands
        ]

    @staticmethod
    async def mark_delivered(db: AsyncSession, command_id: str) -> None:
        """Mark a command as delivered to device."""
        await crud.update_command_status(
            db, command_id, CommandStatusEnum.DELIVERED
        )
        logger.debug(f"Command {command_id} marked as delivered")

    @staticmethod
    async def mark_completed(
        db: AsyncSession, command_id: str, error: Optional[str] = None
    ) -> None:
        """Mark a command as completed (success or failure)."""
        status = CommandStatusEnum.FAILED if error else CommandStatusEnum.COMPLETED
        await crud.update_command_status(db, command_id, status, error=error)
        logger.debug(f"Command {command_id} marked as {status.value}")

    @staticmethod
    async def get_queue_position(db: AsyncSession, command_id: str) -> Optional[int]:
        """Get the position of a command in the queue."""
        command = await crud.get_command(db, command_id)
        if not command or command.status not in [
            CommandStatusEnum.PENDING,
            CommandStatusEnum.QUEUED,
        ]:
            return None

        pending = await crud.get_pending_commands(db, command.device_id)
        for i, cmd in enumerate(pending, 1):
            if cmd.id == command_id:
                return i
        return None

    @staticmethod
    async def deliver_queued_commands(
        db: AsyncSession, device_id: str
    ) -> list[CommandResponse]:
        """
        Get and mark queued commands as delivered when device comes online.

        Returns list of commands to send to the device.
        """
        commands = await crud.get_pending_commands(db, device_id)
        delivered = []

        for cmd in commands:
            await crud.update_command_status(
                db, cmd.id, CommandStatusEnum.DELIVERED
            )
            delivered.append(
                CommandResponse(
                    id=cmd.id,
                    device_id=cmd.device_id,
                    action=CommandAction(cmd.action),
                    params=cmd.params,
                    status=CommandStatus.DELIVERED,
                    created_at=cmd.created_at,
                    delivered_at=datetime.utcnow(),
                )
            )

        if delivered:
            logger.info(
                f"Delivered {len(delivered)} queued commands to device {device_id}"
            )

        return delivered
