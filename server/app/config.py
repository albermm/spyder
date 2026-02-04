"""Application configuration using Pydantic Settings."""

from functools import lru_cache
from typing import List, Optional

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        populate_by_name=True,
    )

    # Server
    port: int = Field(default=8000, description="Server port")
    host: str = Field(default="0.0.0.0", description="Server host")

    # Security
    secret_key: str = Field(
        default="change-me-in-production",
        alias="JWT_SECRET",
        description="Secret key for JWT signing",
    )
    jwt_algorithm: str = Field(default="HS256", description="JWT algorithm")
    access_token_expire_minutes: int = Field(
        default=60, description="Access token expiration in minutes"
    )
    refresh_token_expire_days: Optional[int] = Field(
        default=None,
        description="Refresh token expiration in days (None = no expiration)",
    )

    # Database
    database_url: str = Field(
        default="sqlite+aiosqlite:////tmp/remoteeye.db",
        alias="DATABASE_URL",
        description="Database connection URL",
    )

    # CORS - specific origins for dashboard access
    cors_origins: List[str] = Field(
        default=[
            "https://spyder-ipch.onrender.com",
            "http://localhost:5173",
            "http://localhost:3000",
        ],
        description="Allowed CORS origins",
    )

    # Pairing
    pairing_code_expire_minutes: int = Field(
        default=10, description="Pairing code expiration in minutes"
    )

    # Rate limiting
    rate_limit_per_minute: int = Field(
        default=60, description="Rate limit per minute"
    )

    # Logging
    log_level: str = Field(default="INFO", description="Logging level")

    # Cloudflare R2 Storage
    r2_endpoint: Optional[str] = Field(
        default=None,
        alias="CLOUDFLARE_R2_ENDPOINT",
        description="Cloudflare R2 endpoint URL",
    )
    r2_access_key_id: Optional[str] = Field(
        default=None,
        alias="CLOUDFLARE_R2_ACCESS_KEY_ID",
        description="Cloudflare R2 access key ID",
    )
    r2_secret_access_key: Optional[str] = Field(
        default=None,
        alias="CLOUDFLARE_R2_SECRET_ACCESS_KEY",
        description="Cloudflare R2 secret access key",
    )
    r2_bucket_name: str = Field(
        default="spyder-media",
        alias="CLOUDFLARE_R2_BUCKET_NAME",
        description="Cloudflare R2 bucket name",
    )

    @property
    def r2_configured(self) -> bool:
        """Check if R2 storage is configured."""
        return all([self.r2_endpoint, self.r2_access_key_id, self.r2_secret_access_key])

    # Firebase Cloud Messaging
    firebase_service_account_json: Optional[str] = Field(
        default=None,
        alias="FIREBASE_SERVICE_ACCOUNT_JSON",
        description="Firebase service account JSON (as string)",
    )

    @property
    def fcm_configured(self) -> bool:
        """Check if FCM is configured."""
        return self.firebase_service_account_json is not None


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
