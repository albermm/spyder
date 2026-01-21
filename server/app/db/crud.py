"""CRUD operations for database models."""

import secrets
import uuid
from datetime import datetime, timedelta
from typing import Optional, Sequence

from sqlalchemy import select, update, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import (
    Device,
    DeviceStatusEnum,
    Command,
    CommandStatusEnum,
    Recording,
    PairingCode,
)
from app.config import get_settings

settings = get_settings()


# ============= Device CRUD =============


async def create_device(
    db: AsyncSession,
    device_id: str,
    name: str,
    secret_hash: str,
    device_info: dict,
    settings_dict: dict,
) -> Device:
    """Create a new device."""
    device = Device(
        id=device_id,
        name=name,
        secret_hash=secret_hash,
        device_info=device_info,
        settings=settings_dict,
        status=DeviceStatusEnum.OFFLINE,
    )
    db.add(device)
    await db.flush()
    await db.refresh(device)
    return device


async def get_device(db: AsyncSession, device_id: str) -> Optional[Device]:
    """Get a device by ID."""
    result = await db.execute(select(Device).where(Device.id == device_id))
    return result.scalar_one_or_none()


async def get_all_devices(db: AsyncSession) -> Sequence[Device]:
    """Get all devices."""
    result = await db.execute(select(Device).order_by(Device.created_at.desc()))
    return result.scalars().all()


async def update_device_status(
    db: AsyncSession,
    device_id: str,
    status: DeviceStatusEnum,
    current_status: Optional[dict] = None,
) -> Optional[Device]:
    """Update device connection status."""
    update_data = {
        "status": status,
        "last_seen": datetime.utcnow(),
    }
    if current_status:
        update_data["current_status"] = current_status

    await db.execute(
        update(Device).where(Device.id == device_id).values(**update_data)
    )
    await db.flush()
    return await get_device(db, device_id)


async def update_device_settings(
    db: AsyncSession,
    device_id: str,
    name: Optional[str] = None,
    settings_dict: Optional[dict] = None,
) -> Optional[Device]:
    """Update device name and/or settings."""
    update_data = {}
    if name:
        update_data["name"] = name
    if settings_dict:
        update_data["settings"] = settings_dict

    if update_data:
        await db.execute(
            update(Device).where(Device.id == device_id).values(**update_data)
        )
        await db.flush()
    return await get_device(db, device_id)


async def delete_device(db: AsyncSession, device_id: str) -> bool:
    """Delete a device."""
    result = await db.execute(delete(Device).where(Device.id == device_id))
    await db.flush()
    return result.rowcount > 0


# ============= Command CRUD =============


async def create_command(
    db: AsyncSession,
    device_id: str,
    action: str,
    params: Optional[dict] = None,
    status: CommandStatusEnum = CommandStatusEnum.PENDING,
) -> Command:
    """Create a new command."""
    command = Command(
        id=str(uuid.uuid4()),
        device_id=device_id,
        action=action,
        params=params,
        status=status,
    )
    db.add(command)
    await db.flush()
    await db.refresh(command)
    return command


async def get_command(db: AsyncSession, command_id: str) -> Optional[Command]:
    """Get a command by ID."""
    result = await db.execute(select(Command).where(Command.id == command_id))
    return result.scalar_one_or_none()


async def get_pending_commands(
    db: AsyncSession, device_id: str
) -> Sequence[Command]:
    """Get pending/queued commands for a device."""
    result = await db.execute(
        select(Command)
        .where(Command.device_id == device_id)
        .where(Command.status.in_([CommandStatusEnum.PENDING, CommandStatusEnum.QUEUED]))
        .order_by(Command.created_at)
    )
    return result.scalars().all()


async def get_commands_by_device(
    db: AsyncSession,
    device_id: str,
    status: Optional[CommandStatusEnum] = None,
    limit: int = 50,
    offset: int = 0,
) -> tuple[Sequence[Command], int]:
    """Get commands for a device with pagination."""
    query = select(Command).where(Command.device_id == device_id)
    if status:
        query = query.where(Command.status == status)

    # Get total count
    count_result = await db.execute(
        select(Command.id).where(Command.device_id == device_id)
    )
    total = len(count_result.all())

    # Get paginated results
    query = query.order_by(Command.created_at.desc()).limit(limit).offset(offset)
    result = await db.execute(query)
    return result.scalars().all(), total


async def update_command_status(
    db: AsyncSession,
    command_id: str,
    status: CommandStatusEnum,
    error: Optional[str] = None,
) -> Optional[Command]:
    """Update command status."""
    update_data = {"status": status}
    if status == CommandStatusEnum.DELIVERED:
        update_data["delivered_at"] = datetime.utcnow()
    elif status in [CommandStatusEnum.COMPLETED, CommandStatusEnum.FAILED]:
        update_data["completed_at"] = datetime.utcnow()
    if error:
        update_data["error"] = error

    await db.execute(
        update(Command).where(Command.id == command_id).values(**update_data)
    )
    await db.flush()
    return await get_command(db, command_id)


# ============= Recording CRUD =============


async def create_recording(
    db: AsyncSession,
    device_id: str,
    recording_type: str,
    filename: str,
    size: int,
    triggered_by: str,
    duration: Optional[int] = None,
    extra_data: Optional[dict] = None,
) -> Recording:
    """Create a new recording."""
    recording = Recording(
        id=str(uuid.uuid4()),
        device_id=device_id,
        type=recording_type,
        filename=filename,
        size=size,
        duration=duration,
        triggered_by=triggered_by,
        extra_data=extra_data,
    )
    db.add(recording)
    await db.flush()
    await db.refresh(recording)
    return recording


async def get_recording(db: AsyncSession, recording_id: str) -> Optional[Recording]:
    """Get a recording by ID."""
    result = await db.execute(
        select(Recording).where(Recording.id == recording_id)
    )
    return result.scalar_one_or_none()


async def get_recordings(
    db: AsyncSession,
    device_id: Optional[str] = None,
    recording_type: Optional[str] = None,
    triggered_by: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    limit: int = 50,
    offset: int = 0,
) -> tuple[Sequence[Recording], int]:
    """Get recordings with filters and pagination."""
    query = select(Recording)

    if device_id:
        query = query.where(Recording.device_id == device_id)
    if recording_type:
        query = query.where(Recording.type == recording_type)
    if triggered_by:
        query = query.where(Recording.triggered_by == triggered_by)
    if start_date:
        query = query.where(Recording.created_at >= start_date)
    if end_date:
        query = query.where(Recording.created_at <= end_date)

    # Get total count (simplified)
    count_query = select(Recording.id)
    if device_id:
        count_query = count_query.where(Recording.device_id == device_id)
    count_result = await db.execute(count_query)
    total = len(count_result.all())

    # Get paginated results
    query = query.order_by(Recording.created_at.desc()).limit(limit).offset(offset)
    result = await db.execute(query)
    return result.scalars().all(), total


async def delete_recording(db: AsyncSession, recording_id: str) -> bool:
    """Delete a recording."""
    result = await db.execute(
        delete(Recording).where(Recording.id == recording_id)
    )
    await db.flush()
    return result.rowcount > 0


# ============= Pairing Code CRUD =============


async def create_pairing_code(db: AsyncSession) -> PairingCode:
    """Create a new pairing code."""
    code = "".join(secrets.choice("0123456789ABCDEF") for _ in range(6))
    expires_at = datetime.utcnow() + timedelta(
        minutes=settings.pairing_code_expire_minutes
    )

    pairing = PairingCode(
        code=code,
        expires_at=expires_at,
    )
    db.add(pairing)
    await db.flush()
    await db.refresh(pairing)
    return pairing


async def get_pairing_code(db: AsyncSession, code: str) -> Optional[PairingCode]:
    """Get a pairing code."""
    result = await db.execute(
        select(PairingCode).where(PairingCode.code == code)
    )
    return result.scalar_one_or_none()


async def validate_pairing_code(db: AsyncSession, code: str) -> bool:
    """Validate a pairing code (not used and not expired)."""
    pairing = await get_pairing_code(db, code)
    if not pairing:
        return False
    if pairing.used:
        return False
    if pairing.expires_at < datetime.utcnow():
        return False
    return True


async def use_pairing_code(
    db: AsyncSession, code: str, device_id: str
) -> bool:
    """Mark a pairing code as used."""
    await db.execute(
        update(PairingCode)
        .where(PairingCode.code == code)
        .values(used=1, device_id=device_id)
    )
    await db.flush()
    return True


async def cleanup_expired_pairing_codes(db: AsyncSession) -> int:
    """Delete expired pairing codes."""
    result = await db.execute(
        delete(PairingCode).where(PairingCode.expires_at < datetime.utcnow())
    )
    await db.flush()
    return result.rowcount
