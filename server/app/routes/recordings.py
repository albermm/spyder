"""Recordings API routes."""

from datetime import datetime
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import crud
from app.db.database import get_db
from app.models.recording import RecordingListResponse, RecordingResponse, RecordingType, TriggerType
from app.utils.logger import get_logger

logger = get_logger(__name__)
router = APIRouter()


@router.get("", response_model=RecordingListResponse)
async def list_recordings(
    device_id: Optional[str] = Query(None, description="Filter by device ID"),
    type: Optional[str] = Query(None, description="Filter by type (audio, photo)"),
    triggered_by: Optional[str] = Query(None, description="Filter by trigger (manual, sound_detection)"),
    start_date: Optional[str] = Query(None, description="Filter by start date (ISO 8601)"),
    end_date: Optional[str] = Query(None, description="Filter by end date (ISO 8601)"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
) -> RecordingListResponse:
    """List recordings with optional filters."""
    # Parse dates if provided
    start_dt = datetime.fromisoformat(start_date) if start_date else None
    end_dt = datetime.fromisoformat(end_date) if end_date else None

    recordings, total = await crud.get_recordings(
        db=db,
        device_id=device_id,
        recording_type=type,
        triggered_by=triggered_by,
        start_date=start_dt,
        end_date=end_dt,
        limit=limit,
        offset=offset,
    )

    return RecordingListResponse(
        recordings=[
            RecordingResponse(
                id=r.id,
                device_id=r.device_id,
                type=RecordingType(r.type.value),
                filename=r.filename,
                duration=r.duration,
                size=r.size,
                triggered_by=TriggerType(r.triggered_by),
                created_at=r.created_at,
                metadata=r.extra_data,
            )
            for r in recordings
        ],
        pagination={"total": total, "limit": limit, "offset": offset},
    )


@router.get("/{recording_id}", response_model=dict)
async def get_recording(
    recording_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Get recording details."""
    recording = await crud.get_recording(db, recording_id)
    if not recording:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "RECORDING_NOT_FOUND", "message": "Recording not found"},
        )

    return {
        "success": True,
        "recording": {
            "id": recording.id,
            "deviceId": recording.device_id,
            "type": recording.type.value,
            "filename": recording.filename,
            "duration": recording.duration,
            "size": recording.size,
            "triggeredBy": recording.triggered_by,
            "createdAt": recording.created_at.isoformat(),
            "downloadUrl": f"/api/recordings/{recording.id}/download",
            "metadata": recording.extra_data,
        },
    }


@router.get("/{recording_id}/download")
async def download_recording(
    recording_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Download recording file."""
    recording = await crud.get_recording(db, recording_id)
    if not recording:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "RECORDING_NOT_FOUND", "message": "Recording not found"},
        )

    # For now, return a placeholder response
    # In production, this would serve the actual file from storage
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail={"code": "NOT_IMPLEMENTED", "message": "File storage not yet implemented"},
    )


@router.delete("/{recording_id}", response_model=dict)
async def delete_recording(
    recording_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Delete a recording."""
    recording = await crud.get_recording(db, recording_id)
    if not recording:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "RECORDING_NOT_FOUND", "message": "Recording not found"},
        )

    await crud.delete_recording(db, recording_id)
    logger.info(f"Recording deleted: {recording_id}")

    return {
        "success": True,
        "message": "Recording deleted successfully",
    }
