"""Media upload API routes - presigned URLs for direct R2 uploads."""

from datetime import datetime
from typing import Literal
from uuid import uuid4

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

from app.services.storage import storage_service
from app.utils.logger import get_logger

logger = get_logger(__name__)
router = APIRouter()


class PresignedUrlRequest(BaseModel):
    """Request body for presigned URL generation."""
    device_id: str
    file_name: str
    content_type: Literal["audio/wav", "audio/mp3", "image/jpeg", "image/png"]
    media_type: Literal["audio", "photo"]


class PresignedUrlResponse(BaseModel):
    """Response with presigned URL for direct upload."""
    url: str
    key: str
    expires_in: int = 3600  # seconds


@router.post("/presigned-url", response_model=PresignedUrlResponse)
async def get_presigned_upload_url(request: PresignedUrlRequest) -> PresignedUrlResponse:
    """
    Generate a presigned URL for direct client-to-R2 upload.

    This allows mobile devices to upload media directly to R2 storage
    without going through the server, reducing bandwidth and latency.
    """
    if not storage_service.is_configured:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"code": "STORAGE_NOT_CONFIGURED", "message": "R2 storage not configured"},
        )

    # Generate storage key
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    unique_id = uuid4().hex[:8]

    # Determine file extension from content type
    ext_map = {
        "audio/wav": "wav",
        "audio/mp3": "mp3",
        "image/jpeg": "jpg",
        "image/png": "png",
    }
    extension = ext_map.get(request.content_type, "bin")

    # Build storage key: spyder-media/{type}/{device_id}/{filename}
    filename = f"{request.media_type}_{timestamp}_{unique_id}.{extension}"
    key = f"spyder-media/{request.media_type}s/{request.device_id}/{filename}"

    # Generate presigned URL for PUT operation
    try:
        presigned_url = await storage_service.get_upload_url(
            key=key,
            content_type=request.content_type,
            expires_in=3600,
        )

        if not presigned_url:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail={"code": "URL_GENERATION_FAILED", "message": "Failed to generate presigned URL"},
            )

        logger.info(f"Generated presigned upload URL for {key}")

        return PresignedUrlResponse(
            url=presigned_url,
            key=key,
            expires_in=3600,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to generate presigned URL: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"code": "URL_GENERATION_FAILED", "message": str(e)},
        )
