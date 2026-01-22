"""Authentication service with JWT handling."""

import uuid
from datetime import datetime, timedelta
from typing import Optional

import bcrypt
from jose import JWTError, jwt

from app.config import get_settings
from app.models.auth import ClientType, JWTPayload
from app.utils.logger import get_logger

settings = get_settings()
logger = get_logger(__name__)


class AuthService:
    """Service for authentication operations."""

    @staticmethod
    def hash_password(password: str) -> str:
        """Hash a password using bcrypt."""
        password_bytes = password.encode("utf-8")
        salt = bcrypt.gensalt()
        return bcrypt.hashpw(password_bytes, salt).decode("utf-8")

    @staticmethod
    def verify_password(plain_password: str, hashed_password: str) -> bool:
        """Verify a password against a hash."""
        try:
            return bcrypt.checkpw(
                plain_password.encode("utf-8"),
                hashed_password.encode("utf-8"),
            )
        except Exception:
            return False

    @staticmethod
    def generate_device_secret() -> str:
        """Generate a random device secret."""
        return uuid.uuid4().hex

    @staticmethod
    def create_access_token(
        subject: str,
        client_type: ClientType,
        expires_delta: Optional[timedelta] = None,
    ) -> str:
        """Create a JWT access token."""
        if expires_delta:
            expire = datetime.utcnow() + expires_delta
        else:
            expire = datetime.utcnow() + timedelta(
                minutes=settings.access_token_expire_minutes
            )

        payload = {
            "sub": subject,
            "type": client_type.value,
            "iat": datetime.utcnow(),
            "exp": expire,
        }
        return jwt.encode(payload, settings.secret_key, algorithm=settings.jwt_algorithm)

    @staticmethod
    def create_refresh_token(
        subject: str,
        client_type: ClientType,
    ) -> str:
        """Create a JWT refresh token.

        For trusted first-party device-to-server communication,
        refresh tokens have no expiration by default. This allows
        headless devices to maintain authentication indefinitely
        without requiring re-pairing.
        """
        payload = {
            "sub": subject,
            "type": client_type.value,
            "iat": datetime.utcnow(),
            "refresh": True,
        }

        # Only add expiration if configured (None = no expiration)
        if settings.refresh_token_expire_days is not None:
            expire = datetime.utcnow() + timedelta(days=settings.refresh_token_expire_days)
            payload["exp"] = expire

        return jwt.encode(payload, settings.secret_key, algorithm=settings.jwt_algorithm)

    @staticmethod
    def decode_token(token: str) -> Optional[JWTPayload]:
        """Decode and validate a JWT token.

        Handles both tokens with and without expiration.
        Refresh tokens may have no expiration for long-lived device auth.
        """
        try:
            # Disable exp verification for tokens that may not have it
            payload = jwt.decode(
                token,
                settings.secret_key,
                algorithms=[settings.jwt_algorithm],
                options={"verify_exp": False},  # We'll check manually
            )

            # Parse expiration if present
            exp = None
            if "exp" in payload:
                exp = datetime.fromtimestamp(payload["exp"])
                # Check if expired (only if exp is present)
                if exp < datetime.utcnow():
                    logger.warning("Token has expired")
                    return None

            return JWTPayload(
                sub=payload["sub"],
                type=ClientType(payload["type"]),
                iat=datetime.fromtimestamp(payload["iat"]),
                exp=exp,
            )
        except JWTError as e:
            logger.warning(f"JWT decode error: {e}")
            return None

    @staticmethod
    def is_refresh_token(token: str) -> bool:
        """Check if a token is a refresh token."""
        try:
            payload = jwt.decode(
                token,
                settings.secret_key,
                algorithms=[settings.jwt_algorithm],
            )
            return payload.get("refresh", False)
        except JWTError:
            return False

    @staticmethod
    def get_token_expiry_seconds() -> int:
        """Get access token expiry in seconds."""
        return settings.access_token_expire_minutes * 60
