"""Tests for authentication endpoints."""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import crud
from app.services.auth import AuthService
from app.models.auth import ClientType


@pytest.mark.asyncio
async def test_create_pairing_code(client: AsyncClient):
    """Test pairing code generation."""
    response = await client.post("/api/auth/pair")
    assert response.status_code == 201
    data = response.json()
    assert data["success"] is True
    assert "pairing_code" in data
    assert len(data["pairing_code"]) == 6
    assert "expires_at" in data


@pytest.mark.asyncio
async def test_register_device_with_valid_pairing_code(
    client: AsyncClient, db_session: AsyncSession
):
    """Test device registration with valid pairing code."""
    # Create a pairing code first
    pairing = await crud.create_pairing_code(db_session)
    await db_session.commit()

    # Register device
    response = await client.post(
        "/api/auth/register",
        json={
            "type": "device",
            "pairing_code": pairing.code,
            "name": "Test iPhone",
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["success"] is True
    assert "token" in data
    assert "refresh_token" in data
    assert "device_id" in data
    assert "expires_in" in data


@pytest.mark.asyncio
async def test_register_device_with_invalid_pairing_code(client: AsyncClient):
    """Test device registration with invalid pairing code."""
    response = await client.post(
        "/api/auth/register",
        json={
            "type": "device",
            "pairing_code": "INVALD",
            "name": "Test iPhone",
        },
    )
    assert response.status_code == 400
    data = response.json()
    assert "PAIRING_CODE_INVALID" in str(data)


@pytest.mark.asyncio
async def test_register_device_without_pairing_code(client: AsyncClient):
    """Test device registration without pairing code."""
    response = await client.post(
        "/api/auth/register",
        json={
            "type": "device",
            "name": "Test iPhone",
        },
    )
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_register_controller(
    client: AsyncClient, db_session: AsyncSession
):
    """Test controller registration."""
    # Create a device first
    pairing = await crud.create_pairing_code(db_session)
    await db_session.commit()

    # Register device
    device_response = await client.post(
        "/api/auth/register",
        json={
            "type": "device",
            "pairing_code": pairing.code,
            "name": "Test iPhone",
        },
    )
    device_id = device_response.json()["device_id"]

    # Register controller
    response = await client.post(
        "/api/auth/register",
        json={
            "type": "controller",
            "device_id": device_id,
            "name": "Test Dashboard",
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["success"] is True
    assert "token" in data
    assert "refresh_token" in data


@pytest.mark.asyncio
async def test_register_controller_for_nonexistent_device(client: AsyncClient):
    """Test controller registration for non-existent device."""
    response = await client.post(
        "/api/auth/register",
        json={
            "type": "controller",
            "device_id": "nonexistent-device",
            "name": "Test Dashboard",
        },
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_refresh_token(client: AsyncClient, db_session: AsyncSession):
    """Test token refresh."""
    # Create a device first
    pairing = await crud.create_pairing_code(db_session)
    await db_session.commit()

    # Register device
    device_response = await client.post(
        "/api/auth/register",
        json={
            "type": "device",
            "pairing_code": pairing.code,
            "name": "Test iPhone",
        },
    )
    refresh_token = device_response.json()["refresh_token"]

    # Refresh token
    response = await client.post(
        "/api/auth/refresh",
        json={"refresh_token": refresh_token},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert "token" in data
    assert "expires_in" in data


@pytest.mark.asyncio
async def test_refresh_with_invalid_token(client: AsyncClient):
    """Test token refresh with invalid token."""
    response = await client.post(
        "/api/auth/refresh",
        json={"refresh_token": "invalid-token"},
    )
    assert response.status_code == 401


class TestAuthService:
    """Tests for AuthService."""

    def test_hash_and_verify_password(self):
        """Test password hashing and verification."""
        password = "test-password-123"
        hashed = AuthService.hash_password(password)
        assert AuthService.verify_password(password, hashed)
        assert not AuthService.verify_password("wrong-password", hashed)

    def test_create_and_decode_token(self):
        """Test JWT token creation and decoding."""
        subject = "test-device-id"
        token = AuthService.create_access_token(subject, ClientType.DEVICE)
        payload = AuthService.decode_token(token)
        assert payload is not None
        assert payload.sub == subject
        assert payload.type == ClientType.DEVICE

    def test_create_refresh_token(self):
        """Test refresh token creation."""
        subject = "test-device-id"
        token = AuthService.create_refresh_token(subject, ClientType.DEVICE)
        assert AuthService.is_refresh_token(token)

    def test_access_token_is_not_refresh_token(self):
        """Test that access token is not identified as refresh token."""
        subject = "test-device-id"
        token = AuthService.create_access_token(subject, ClientType.DEVICE)
        assert not AuthService.is_refresh_token(token)
