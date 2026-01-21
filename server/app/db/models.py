"""SQLAlchemy ORM models."""

import enum
from datetime import datetime
from typing import Optional

from sqlalchemy import (
    Column,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    JSON,
    String,
    Text,
)
from sqlalchemy.orm import DeclarativeBase, relationship


class Base(DeclarativeBase):
    """Base class for all models."""

    pass


class DeviceStatusEnum(str, enum.Enum):
    """Device connection status."""

    ONLINE = "online"
    OFFLINE = "offline"


class CommandStatusEnum(str, enum.Enum):
    """Command execution status."""

    PENDING = "pending"
    QUEUED = "queued"
    DELIVERED = "delivered"
    EXECUTING = "executing"
    COMPLETED = "completed"
    FAILED = "failed"


class RecordingTypeEnum(str, enum.Enum):
    """Recording type."""

    AUDIO = "audio"
    PHOTO = "photo"


class Device(Base):
    """Device model representing a paired iPhone."""

    __tablename__ = "devices"

    id = Column(String(36), primary_key=True)
    name = Column(String(100), nullable=False)
    secret_hash = Column(String(255), nullable=False)
    status = Column(
        Enum(DeviceStatusEnum),
        default=DeviceStatusEnum.OFFLINE,
        nullable=False,
    )
    last_seen = Column(DateTime, default=datetime.utcnow)
    device_info = Column(JSON, nullable=True)
    current_status = Column(JSON, nullable=True)
    settings = Column(JSON, nullable=False, default=dict)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    commands = relationship("Command", back_populates="device", cascade="all, delete")
    recordings = relationship(
        "Recording", back_populates="device", cascade="all, delete"
    )


class Command(Base):
    """Command model for device instructions."""

    __tablename__ = "commands"

    id = Column(String(36), primary_key=True)
    device_id = Column(String(36), ForeignKey("devices.id"), nullable=False)
    action = Column(String(50), nullable=False)
    params = Column(JSON, nullable=True)
    status = Column(
        Enum(CommandStatusEnum),
        default=CommandStatusEnum.PENDING,
        nullable=False,
    )
    created_at = Column(DateTime, default=datetime.utcnow)
    delivered_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    error = Column(Text, nullable=True)

    # Relationships
    device = relationship("Device", back_populates="commands")


class Recording(Base):
    """Recording model for audio/photo captures."""

    __tablename__ = "recordings"

    id = Column(String(36), primary_key=True)
    device_id = Column(String(36), ForeignKey("devices.id"), nullable=False)
    type = Column(Enum(RecordingTypeEnum), nullable=False)
    filename = Column(String(255), nullable=False)
    duration = Column(Integer, nullable=True)  # seconds for audio
    size = Column(Integer, nullable=False)  # bytes
    triggered_by = Column(String(50), nullable=False)  # 'manual', 'sound_detection'
    extra_data = Column(JSON, nullable=True)  # renamed from metadata (reserved)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    device = relationship("Device", back_populates="recordings")


class PairingCode(Base):
    """Temporary pairing codes for device registration."""

    __tablename__ = "pairing_codes"

    code = Column(String(6), primary_key=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=False)
    used = Column(Integer, default=0)  # 0 = unused, 1 = used
    device_id = Column(String(36), nullable=True)  # Set when used
