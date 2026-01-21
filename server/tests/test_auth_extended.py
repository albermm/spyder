"""Extended tests for authentication endpoints to improve coverage."""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import crud
from app.services.auth import AuthService
from app.models.auth import ClientType
from app.models.device import DeviceSettings


@pytest.mark.asyncio
async def test_register_controller_without_device_id(client: AsyncClient):
    """Test controller registration without device_id fails."""
    response = await client.post(
        "/api/auth/register",
        json={
            "type": "controller",
            "name": "Test Dashboard",
        },
    )
    assert response.status_code == 400
    data = response.json()
    assert "INVALID_INPUT" in str(data)


@pytest.mark.asyncio
async def test_login_success(client: AsyncClient, db_session: AsyncSession):
    """Test successful device login."""
    # Create a device with known credentials
    device_id = "test-login-device"
    secret = "test-secret-123"
    secret_hash = AuthService.hash_password(secret)

    await crud.create_device(
        db=db_session,
        device_id=device_id,
        name="Test iPhone",
        secret_hash=secret_hash,
        device_info={"model": "iPhone 14"},
        settings_dict=DeviceSettings().model_dump(),
    )
    await db_session.commit()

    # Login with correct credentials
    response = await client.post(
        "/api/auth/login",
        json={
            "device_id": device_id,
            "secret": secret,
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert "token" in data
    assert "refresh_token" in data


@pytest.mark.asyncio
async def test_login_nonexistent_device(client: AsyncClient):
    """Test login with non-existent device fails."""
    response = await client.post(
        "/api/auth/login",
        json={
            "device_id": "nonexistent",
            "secret": "any-secret",
        },
    )
    assert response.status_code == 401
    data = response.json()
    assert "AUTH_FAILED" in str(data)


@pytest.mark.asyncio
async def test_login_wrong_password(client: AsyncClient, db_session: AsyncSession):
    """Test login with wrong password fails."""
    # Create a device
    device_id = "test-wrong-pwd-device"
    secret_hash = AuthService.hash_password("correct-secret")

    await crud.create_device(
        db=db_session,
        device_id=device_id,
        name="Test iPhone",
        secret_hash=secret_hash,
        device_info={},
        settings_dict=DeviceSettings().model_dump(),
    )
    await db_session.commit()

    # Login with wrong password
    response = await client.post(
        "/api/auth/login",
        json={
            "device_id": device_id,
            "secret": "wrong-secret",
        },
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_refresh_with_access_token_fails(client: AsyncClient, db_session: AsyncSession):
    """Test that refreshing with an access token (not refresh token) fails."""
    # Create a device and get tokens
    pairing = await crud.create_pairing_code(db_session)
    await db_session.commit()

    device_response = await client.post(
        "/api/auth/register",
        json={
            "type": "device",
            "pairing_code": pairing.code,
            "name": "Test iPhone",
        },
    )
    access_token = device_response.json()["token"]

    # Try to refresh with access token (should fail)
    response = await client.post(
        "/api/auth/refresh",
        json={"refresh_token": access_token},
    )
    assert response.status_code == 401
    data = response.json()
    assert "TOKEN_INVALID" in str(data)


@pytest.mark.asyncio
async def test_register_device_with_expired_pairing_code(
    client: AsyncClient, db_session: AsyncSession
):
    """Test device registration with expired pairing code fails."""
    from datetime import datetime, timedelta

    # Create an expired pairing code directly
    from app.db.models import PairingCode

    expired_code = PairingCode(
        code="EXPIRD",
        created_at=datetime.utcnow() - timedelta(hours=2),
        expires_at=datetime.utcnow() - timedelta(hours=1),
        used=0,
    )
    db_session.add(expired_code)
    await db_session.commit()

    # Try to register with expired code
    response = await client.post(
        "/api/auth/register",
        json={
            "type": "device",
            "pairing_code": "EXPIRD",
            "name": "Test iPhone",
        },
    )
    assert response.status_code == 400
    data = response.json()
    assert "PAIRING_CODE_INVALID" in str(data)


@pytest.mark.asyncio
async def test_register_device_with_used_pairing_code(
    client: AsyncClient, db_session: AsyncSession
):
    """Test device registration with already-used pairing code fails."""
    from datetime import datetime, timedelta
    from app.db.models import PairingCode

    # Create a used pairing code
    used_code = PairingCode(
        code="USEDCD",
        created_at=datetime.utcnow(),
        expires_at=datetime.utcnow() + timedelta(hours=1),
        used=1,
        device_id="some-device",
    )
    db_session.add(used_code)
    await db_session.commit()

    # Try to register with used code
    response = await client.post(
        "/api/auth/register",
        json={
            "type": "device",
            "pairing_code": "USEDCD",
            "name": "Test iPhone",
        },
    )
    assert response.status_code == 400


class TestAuthServiceExtended:
    """Extended tests for AuthService to improve coverage."""

    def test_decode_invalid_token(self):
        """Test decoding an invalid token returns None."""
        result = AuthService.decode_token("invalid-token")
        assert result is None

    def test_decode_expired_token(self):
        """Test decoding an expired token returns None."""
        from datetime import timedelta

        # Create a token that's already expired
        subject = "test-device"
        token = AuthService.create_access_token(
            subject,
            ClientType.DEVICE,
            expires_delta=timedelta(seconds=-10)  # Already expired
        )
        result = AuthService.decode_token(token)
        assert result is None

    def test_is_refresh_token_with_invalid_token(self):
        """Test is_refresh_token with invalid token returns False."""
        result = AuthService.is_refresh_token("invalid-token")
        assert result is False

    def test_verify_password_with_invalid_hash(self):
        """Test verify_password with malformed hash returns False."""
        result = AuthService.verify_password("password", "not-a-valid-hash")
        assert result is False

    def test_generate_device_secret(self):
        """Test device secret generation produces valid hex strings."""
        secret1 = AuthService.generate_device_secret()
        secret2 = AuthService.generate_device_secret()

        # Should be 32 hex characters (uuid4.hex)
        assert len(secret1) == 32
        assert len(secret2) == 32
        # Should be unique
        assert secret1 != secret2
        # Should be valid hex
        int(secret1, 16)
        int(secret2, 16)

    def test_get_token_expiry_seconds(self):
        """Test token expiry calculation."""
        expiry = AuthService.get_token_expiry_seconds()
        # Should be a positive integer
        assert isinstance(expiry, int)
        assert expiry > 0
