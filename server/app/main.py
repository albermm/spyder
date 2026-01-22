"""RemoteEye Server - Main application entry point."""

from contextlib import asynccontextmanager

import socketio
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import get_settings
from app.db.database import init_db
from app.routes import auth_router, devices_router, media_router, recordings_router
from app.services.websocket import setup_socketio_handlers
from app.utils.logger import setup_logging, get_logger

settings = get_settings()
setup_logging()
logger = get_logger(__name__)

# Create Socket.IO server
sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins="*",  # Allow all origins for mobile apps
    logger=settings.log_level == "DEBUG",
    engineio_logger=settings.log_level == "DEBUG",
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager."""
    # Startup
    logger.info("Starting RemoteEye server...")
    await init_db()
    logger.info("Database initialized")
    yield
    # Shutdown
    logger.info("Shutting down RemoteEye server...")


# Create FastAPI app
app = FastAPI(
    title="RemoteEye API",
    description="Remote iPhone monitoring relay server",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Handle uncaught exceptions."""
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "error": {
                "code": "INTERNAL_ERROR",
                "message": "An internal error occurred",
            },
        },
    )


# Include routers
app.include_router(auth_router, prefix="/api/auth", tags=["Authentication"])
app.include_router(devices_router, prefix="/api/devices", tags=["Devices"])
app.include_router(media_router, prefix="/api/media", tags=["Media"])
app.include_router(recordings_router, prefix="/api/recordings", tags=["Recordings"])


# Health check endpoint
@app.get("/health", tags=["Health"])
async def health_check():
    """Health check endpoint."""
    from app.services.device_manager import device_manager

    stats = device_manager.get_stats()
    return {
        "status": "healthy",
        "version": "1.0.0",
        "connections": stats,
    }


@app.get("/api/health", tags=["Health"])
async def api_health_check():
    """API health check endpoint."""
    return {"status": "healthy", "version": "1.0.0"}


# Setup Socket.IO handlers
setup_socketio_handlers(sio)

# Create combined ASGI app (Socket.IO wraps FastAPI)
socket_app = socketio.ASGIApp(sio, app)


# For running directly with uvicorn
if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:socket_app",
        host=settings.host,
        port=settings.port,
        reload=True,
    )
