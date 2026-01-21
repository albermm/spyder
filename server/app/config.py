"""Application configuration using Pydantic Settings."""

from functools import lru_cache
from typing import List

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # Server
    port: int = Field(default=8000, description="Server port")
    host: str = Field(default="0.0.0.0", description="Server host")

    # Security
    secret_key: str = Field(
        default="change-me-in-production",
        description="Secret key for JWT signing",
    )
    jwt_algorithm: str = Field(default="HS256", description="JWT algorithm")
    access_token_expire_minutes: int = Field(
        default=60, description="Access token expiration in minutes"
    )
    refresh_token_expire_days: int = Field(
        default=7, description="Refresh token expiration in days"
    )

    # Database
    database_url: str = Field(
        default="sqlite+aiosqlite:///./data/remoteeye.db",
        description="Database connection URL",
    )

    # CORS
    cors_origins: List[str] = Field(
        default=["*"],
        description="Allowed CORS origins (use '*' to allow all for mobile apps)",
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


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
