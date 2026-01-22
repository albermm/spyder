"""Storage service for R2/S3 file operations."""

import base64
import logging
from datetime import datetime
from typing import Optional
from uuid import uuid4

import aioboto3
from botocore.config import Config

from app.config import get_settings

logger = logging.getLogger(__name__)


class StorageService:
    """Handles file storage operations with Cloudflare R2."""

    def __init__(self):
        self.settings = get_settings()
        self._session: Optional[aioboto3.Session] = None

    @property
    def is_configured(self) -> bool:
        """Check if R2 storage is configured."""
        return self.settings.r2_configured

    def _get_session(self) -> aioboto3.Session:
        """Get or create aioboto3 session."""
        if self._session is None:
            self._session = aioboto3.Session()
        return self._session

    def _get_client_config(self) -> dict:
        """Get S3 client configuration for R2."""
        return {
            "service_name": "s3",
            "endpoint_url": self.settings.r2_endpoint,
            "aws_access_key_id": self.settings.r2_access_key_id,
            "aws_secret_access_key": self.settings.r2_secret_access_key,
            "config": Config(
                signature_version="s3v4",
                s3={"addressing_style": "path"},
            ),
        }

    async def upload_photo(
        self,
        data: str,
        device_id: str,
        filename: Optional[str] = None,
    ) -> dict:
        """
        Upload a photo to R2.

        Args:
            data: Base64 encoded image data
            device_id: Device ID for organizing files
            filename: Optional filename (generated if not provided)

        Returns:
            dict with key, url, and size
        """
        if not self.is_configured:
            logger.warning("R2 storage not configured, skipping upload")
            return {"key": None, "url": None, "size": 0}

        # Generate filename if not provided
        if not filename:
            timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
            filename = f"photo_{timestamp}_{uuid4().hex[:8]}.jpg"

        # Build the storage key
        key = f"photos/{device_id}/{filename}"

        # Decode base64 data
        try:
            image_bytes = base64.b64decode(data)
        except Exception as e:
            logger.error(f"Failed to decode base64 image: {e}")
            raise ValueError("Invalid base64 image data")

        # Upload to R2
        session = self._get_session()
        async with session.client(**self._get_client_config()) as s3:
            try:
                await s3.put_object(
                    Bucket=self.settings.r2_bucket_name,
                    Key=key,
                    Body=image_bytes,
                    ContentType="image/jpeg",
                )
                logger.info(f"Uploaded photo to R2: {key}")
            except Exception as e:
                logger.error(f"Failed to upload photo to R2: {e}")
                raise

        return {
            "key": key,
            "size": len(image_bytes),
        }

    async def upload_audio(
        self,
        data: bytes,
        device_id: str,
        filename: Optional[str] = None,
        content_type: str = "audio/wav",
    ) -> dict:
        """
        Upload an audio file to R2.

        Args:
            data: Audio file bytes
            device_id: Device ID for organizing files
            filename: Optional filename (generated if not provided)
            content_type: MIME type of the audio

        Returns:
            dict with key and size
        """
        if not self.is_configured:
            logger.warning("R2 storage not configured, skipping upload")
            return {"key": None, "size": 0}

        # Generate filename if not provided
        if not filename:
            timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
            ext = "wav" if "wav" in content_type else "mp3"
            filename = f"audio_{timestamp}_{uuid4().hex[:8]}.{ext}"

        # Build the storage key
        key = f"audio/{device_id}/{filename}"

        # Upload to R2
        session = self._get_session()
        async with session.client(**self._get_client_config()) as s3:
            try:
                await s3.put_object(
                    Bucket=self.settings.r2_bucket_name,
                    Key=key,
                    Body=data,
                    ContentType=content_type,
                )
                logger.info(f"Uploaded audio to R2: {key}")
            except Exception as e:
                logger.error(f"Failed to upload audio to R2: {e}")
                raise

        return {
            "key": key,
            "size": len(data),
        }

    async def get_download_url(
        self,
        key: str,
        expires_in: int = 3600,
    ) -> Optional[str]:
        """
        Generate a presigned URL for downloading a file.

        Args:
            key: The storage key
            expires_in: URL expiration time in seconds (default 1 hour)

        Returns:
            Presigned URL or None if not configured
        """
        if not self.is_configured or not key:
            return None

        session = self._get_session()
        async with session.client(**self._get_client_config()) as s3:
            try:
                url = await s3.generate_presigned_url(
                    "get_object",
                    Params={
                        "Bucket": self.settings.r2_bucket_name,
                        "Key": key,
                    },
                    ExpiresIn=expires_in,
                )
                return url
            except Exception as e:
                logger.error(f"Failed to generate presigned URL: {e}")
                return None

    async def delete_file(self, key: str) -> bool:
        """
        Delete a file from R2.

        Args:
            key: The storage key

        Returns:
            True if deleted, False otherwise
        """
        if not self.is_configured or not key:
            return False

        session = self._get_session()
        async with session.client(**self._get_client_config()) as s3:
            try:
                await s3.delete_object(
                    Bucket=self.settings.r2_bucket_name,
                    Key=key,
                )
                logger.info(f"Deleted file from R2: {key}")
                return True
            except Exception as e:
                logger.error(f"Failed to delete file from R2: {e}")
                return False

    async def file_exists(self, key: str) -> bool:
        """
        Check if a file exists in R2.

        Args:
            key: The storage key

        Returns:
            True if exists, False otherwise
        """
        if not self.is_configured or not key:
            return False

        session = self._get_session()
        async with session.client(**self._get_client_config()) as s3:
            try:
                await s3.head_object(
                    Bucket=self.settings.r2_bucket_name,
                    Key=key,
                )
                return True
            except Exception:
                return False

    async def ensure_bucket_exists(self) -> bool:
        """
        Ensure the R2 bucket exists, create if not.

        Returns:
            True if bucket exists or was created
        """
        if not self.is_configured:
            return False

        session = self._get_session()
        async with session.client(**self._get_client_config()) as s3:
            try:
                await s3.head_bucket(Bucket=self.settings.r2_bucket_name)
                logger.info(f"Bucket exists: {self.settings.r2_bucket_name}")
                return True
            except Exception:
                # Try to create the bucket
                try:
                    await s3.create_bucket(Bucket=self.settings.r2_bucket_name)
                    logger.info(f"Created bucket: {self.settings.r2_bucket_name}")
                    return True
                except Exception as e:
                    logger.error(f"Failed to create bucket: {e}")
                    return False


# Singleton instance
storage_service = StorageService()
