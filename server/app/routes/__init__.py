"""API routes."""

from app.routes.auth import router as auth_router
from app.routes.devices import router as devices_router
from app.routes.recordings import router as recordings_router

__all__ = ["auth_router", "devices_router", "recordings_router"]
