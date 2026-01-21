# RemoteEye - System Architecture

## Overview

RemoteEye is a three-tier remote monitoring system enabling real-time camera, audio, and location access from an iPhone to a Mac dashboard via a cloud relay server.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              INTERNET                                        │
│                                                                              │
│  ┌──────────────┐         ┌──────────────────┐         ┌──────────────┐    │
│  │              │   WSS   │                  │   WSS   │              │    │
│  │   iPhone     │◄───────►│   Relay Server   │◄───────►│   Mac        │    │
│  │   (Mobile)   │         │   (Python)       │         │  (Dashboard) │    │
│  │              │         │                  │         │              │    │
│  └──────────────┘         └──────────────────┘         └──────────────┘    │
│                                    │                                         │
│                                    │ HTTPS                                   │
│                                    ▼                                         │
│                           ┌──────────────────┐                              │
│                           │    Database      │                              │
│                           │   (SQLite/PG)    │                              │
│                           └──────────────────┘                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Component Architecture

### 1. Relay Server (Python + FastAPI)

```
server/
├── app/
│   ├── __init__.py
│   ├── main.py               # FastAPI app + Socket.IO mount
│   ├── config.py             # Pydantic Settings
│   ├── models/               # Pydantic & SQLAlchemy models
│   │   ├── __init__.py
│   │   ├── device.py         # Device schemas
│   │   ├── command.py        # Command schemas
│   │   └── recording.py      # Recording schemas
│   ├── routes/               # REST API endpoints
│   │   ├── __init__.py
│   │   ├── auth.py           # Authentication
│   │   ├── devices.py        # Device management
│   │   └── recordings.py     # Recording retrieval
│   ├── services/             # Business logic
│   │   ├── __init__.py
│   │   ├── websocket.py      # python-socketio handlers
│   │   ├── device_manager.py # Device state management
│   │   ├── command_queue.py  # Offline command queue
│   │   ├── auth.py           # JWT/auth logic
│   │   └── storage.py        # File storage
│   ├── db/
│   │   ├── __init__.py
│   │   ├── database.py       # SQLAlchemy async setup
│   │   ├── models.py         # ORM models
│   │   └── crud.py           # Database operations
│   └── utils/
│       ├── __init__.py
│       └── logger.py         # Logging config
├── tests/
│   ├── __init__.py
│   ├── conftest.py           # Pytest fixtures
│   ├── test_auth.py
│   ├── test_devices.py
│   └── test_websocket.py
├── pyproject.toml
└── Dockerfile
```

**Key Technologies**:
- **FastAPI**: Async REST API framework
- **python-socketio**: WebSocket with Socket.IO protocol
- **SQLAlchemy 2.0**: Async ORM
- **Pydantic v2**: Data validation
- **python-jose**: JWT handling
- **passlib**: Password hashing

**Key Responsibilities**:
- Authenticate devices and controllers
- Maintain WebSocket connections
- Route commands from controller to device
- Stream media from device to controller
- Queue commands for offline devices
- Store and serve recordings

---

### 2. Mobile App (React Native CLI - iOS Only)

```
mobile/
├── ios/                      # Xcode project
│   ├── RemoteEye/
│   │   ├── AppDelegate.mm
│   │   ├── Info.plist        # Permissions config
│   │   └── ...
│   └── RemoteEye.xcworkspace
├── src/
│   ├── App.tsx               # Entry point
│   ├── screens/
│   │   ├── HomeScreen.tsx    # Status display
│   │   └── SetupScreen.tsx   # Initial pairing
│   ├── services/
│   │   ├── WebSocketService.ts    # Server communication
│   │   ├── CameraService.ts       # react-native-camera/vision-camera
│   │   ├── AudioService.ts        # react-native-audio-recorder-player
│   │   ├── LocationService.ts     # @react-native-community/geolocation
│   │   └── BackgroundService.ts   # react-native-background-fetch
│   ├── hooks/
│   │   ├── useWebSocket.ts
│   │   ├── useCamera.ts
│   │   └── useLocation.ts
│   ├── components/
│   │   ├── StatusIndicator.tsx
│   │   └── ConnectionStatus.tsx
│   └── utils/
│       ├── storage.ts        # AsyncStorage helpers
│       └── permissions.ts    # Permission requests
├── package.json
├── tsconfig.json
├── metro.config.js
├── babel.config.js
└── react-native.config.js
```

**Key Responsibilities**:
- Maintain persistent server connection
- Capture and stream camera frames
- Record and stream audio
- Detect sound and auto-record
- Track location periodically
- Execute commands from server
- Survive background/sleep states

---

### 3. Dashboard (React + Vite)

```
dashboard/
├── src/
│   ├── App.tsx               # Entry point, routing
│   ├── pages/
│   │   ├── Dashboard.tsx     # Main control panel
│   │   ├── Camera.tsx        # Live camera view
│   │   ├── Audio.tsx         # Audio monitoring
│   │   ├── Gallery.tsx       # Photo gallery
│   │   ├── Location.tsx      # Map view
│   │   └── Settings.tsx      # Configuration
│   ├── components/
│   │   ├── DeviceStatus.tsx
│   │   ├── VideoPlayer.tsx   # MJPEG viewer
│   │   ├── AudioPlayer.tsx
│   │   ├── PhotoGrid.tsx
│   │   ├── MapView.tsx
│   │   └── Navbar.tsx
│   ├── services/
│   │   ├── WebSocketService.ts
│   │   ├── ApiService.ts
│   │   └── NotificationService.ts
│   ├── hooks/
│   │   ├── useWebSocket.ts
│   │   └── useDevice.ts
│   └── store/
│       └── deviceStore.ts    # Zustand state
└── index.html
```

**Key Responsibilities**:
- Display device status
- Render live camera feed
- Play audio streams
- Display photo gallery
- Show location on map
- Send commands to device
- Configure monitoring settings

---

## Data Flow

### Command Flow (Controller → Device)

```
1. User clicks "Start Camera" on Dashboard
2. Dashboard sends command via WebSocket:
   { type: "command", action: "start_camera", params: { quality: "medium" } }
3. Server receives command
4. IF device online:
   → Forward to device immediately
   ELSE:
   → Queue command in database
5. Device receives command
6. Device starts camera, sends acknowledgment
7. Device begins streaming frames
```

### Media Flow (Device → Controller)

```
1. Device captures camera frame (JPEG)
2. Device sends via WebSocket:
   { type: "frame", data: base64EncodedJPEG, timestamp: ISO8601 }
3. Server receives frame
4. Server forwards to all connected controllers for this device
5. Dashboard receives frame
6. Dashboard decodes and displays in <img> or <canvas>
```

### Reconnection Flow

```
1. Device loses connection (power outage)
2. Server marks device as "offline"
3. Server notifies controllers: { type: "status", device: "offline" }
4. User sends command while device offline
5. Server queues command
6. Device power restored, app launches
7. Device connects to server
8. Server marks device "online", notifies controllers
9. Server delivers queued commands
10. Device executes commands, resumes streaming
```

---

## Security Architecture

### Authentication Flow

```
┌──────────┐                    ┌──────────┐
│  Client  │                    │  Server  │
└────┬─────┘                    └────┬─────┘
     │                               │
     │  POST /api/auth/register      │
     │  { deviceId, pairingCode }    │
     │──────────────────────────────►│
     │                               │ Validate pairing code
     │  { token, refreshToken }      │ Generate JWT
     │◄──────────────────────────────│
     │                               │
     │  WSS /socket.io/?token=JWT    │
     │──────────────────────────────►│
     │                               │ Verify JWT
     │  Connection established       │
     │◄──────────────────────────────│
```

### Token Structure (Python)

```python
from pydantic import BaseModel
from datetime import datetime
from typing import Literal

class JWTPayload(BaseModel):
    sub: str  # device_id or controller_id
    type: Literal["device", "controller"]
    iat: datetime
    exp: datetime
```

---

## Database Schema (SQLAlchemy Models)

### Device Model
```python
from sqlalchemy import Column, String, DateTime, JSON, Enum
from sqlalchemy.orm import declarative_base
from datetime import datetime
import enum

Base = declarative_base()

class DeviceStatusEnum(str, enum.Enum):
    ONLINE = "online"
    OFFLINE = "offline"

class Device(Base):
    __tablename__ = "devices"

    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    secret_hash = Column(String, nullable=False)
    pairing_code = Column(String, unique=True, nullable=True)
    paired_at = Column(DateTime, nullable=True)
    last_seen = Column(DateTime, default=datetime.utcnow)
    status = Column(Enum(DeviceStatusEnum), default=DeviceStatusEnum.OFFLINE)
    device_info = Column(JSON, nullable=True)
    current_status = Column(JSON, nullable=True)
    settings = Column(JSON, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
```

### Command Model
```python
class CommandStatusEnum(str, enum.Enum):
    PENDING = "pending"
    DELIVERED = "delivered"
    EXECUTING = "executing"
    COMPLETED = "completed"
    FAILED = "failed"

class Command(Base):
    __tablename__ = "commands"

    id = Column(String, primary_key=True)
    device_id = Column(String, ForeignKey("devices.id"), nullable=False)
    action = Column(String, nullable=False)
    params = Column(JSON, nullable=True)
    status = Column(Enum(CommandStatusEnum), default=CommandStatusEnum.PENDING)
    created_at = Column(DateTime, default=datetime.utcnow)
    delivered_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    error = Column(String, nullable=True)
```

### Recording Model
```python
class RecordingTypeEnum(str, enum.Enum):
    AUDIO = "audio"
    PHOTO = "photo"

class Recording(Base):
    __tablename__ = "recordings"

    id = Column(String, primary_key=True)
    device_id = Column(String, ForeignKey("devices.id"), nullable=False)
    type = Column(Enum(RecordingTypeEnum), nullable=False)
    filename = Column(String, nullable=False)
    duration = Column(Integer, nullable=True)  # seconds for audio
    size = Column(Integer, nullable=False)  # bytes
    triggered_by = Column(String, nullable=False)  # 'manual', 'sound_detection'
    metadata = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
```

---

## Performance Considerations

### Video Streaming
- **Format**: MJPEG (Motion JPEG)
- **Resolution**: 640x480 default, adjustable
- **Frame Rate**: 5-10 FPS target
- **Quality**: JPEG quality 0.5-0.8, adjustable
- **Bandwidth**: ~100-300 KB/s estimated

### Audio Streaming
- **Format**: PCM or AAC
- **Sample Rate**: 16kHz mono
- **Bit Depth**: 16-bit
- **Bandwidth**: ~32 KB/s

### Latency Targets
- Video: <2 seconds end-to-end
- Audio: <1 second end-to-end
- Commands: <500ms acknowledgment

---

## Python Server Entry Point Example

```python
# app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import socketio
from contextlib import asynccontextmanager

from app.config import settings
from app.routes import auth, devices, recordings
from app.services.websocket import setup_socketio_handlers
from app.db.database import init_db

# Create Socket.IO server
sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins=settings.cors_origins,
)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await init_db()
    yield
    # Shutdown
    pass

# Create FastAPI app
app = FastAPI(
    title="RemoteEye API",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routes
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(devices.router, prefix="/api/devices", tags=["devices"])
app.include_router(recordings.router, prefix="/api/recordings", tags=["recordings"])

# Health check
@app.get("/health")
async def health():
    return {"status": "healthy", "version": "1.0.0"}

# Setup Socket.IO handlers
setup_socketio_handlers(sio)

# Mount Socket.IO
socket_app = socketio.ASGIApp(sio, app)
```

---

## Scalability Notes

Current design supports:
- 1 device (the iPhone)
- 1-3 controllers (Mac, iPad, etc.)

For future scaling:
- Add Redis for pub/sub across server instances
- Use S3 for recording storage
- Add CDN for media delivery
- Deploy with Gunicorn + Uvicorn workers
