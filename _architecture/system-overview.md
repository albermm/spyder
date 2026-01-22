# RemoteEye - System Architecture Overview

RemoteEye is a three-tier remote monitoring system that enables real-time camera, audio, and location access from an iPhone to a web dashboard via a cloud relay server.

## System Components

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                                                                  │
│   ┌──────────────────┐                                    ┌──────────────────┐  │
│   │                  │                                    │                  │  │
│   │   iPhone App     │◄──── Push Notifications ──────────│   Dashboard      │  │
│   │   (React Native) │                                    │   (React/Vite)   │  │
│   │                  │                                    │                  │  │
│   └────────┬─────────┘                                    └────────┬─────────┘  │
│            │                                                       │            │
│            │ WebSocket (wss://)                    WebSocket (wss://)           │
│            │                                                       │            │
│            └──────────────────────┬────────────────────────────────┘            │
│                                   │                                              │
│                                   ▼                                              │
│                    ┌──────────────────────────────┐                             │
│                    │                              │                             │
│                    │      Relay Server            │                             │
│                    │      (Python/FastAPI)        │                             │
│                    │                              │                             │
│                    │   ┌────────────────────┐    │                             │
│                    │   │  Socket.IO Server  │    │                             │
│                    │   └────────────────────┘    │                             │
│                    │                              │                             │
│                    │   ┌────────────────────┐    │                             │
│                    │   │  REST API          │    │                             │
│                    │   └────────────────────┘    │                             │
│                    │                              │                             │
│                    └──────────────┬───────────────┘                             │
│                                   │                                              │
│                    ┌──────────────┼───────────────┐                             │
│                    │              │               │                             │
│                    ▼              ▼               ▼                             │
│              ┌──────────┐  ┌──────────┐   ┌──────────────┐                     │
│              │ SQLite/  │  │ Firebase │   │ Cloudflare   │                     │
│              │ Postgres │  │   FCM    │   │     R2       │                     │
│              └──────────┘  └──────────┘   └──────────────┘                     │
│               Database      Push Svc      File Storage                          │
│                                                                                  │
│                              Render.com Hosting                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Component Details

### 1. Mobile App (iPhone)

**Technology Stack:**
- React Native CLI (no Expo)
- TypeScript
- Socket.IO client
- Firebase Cloud Messaging
- react-native-vision-camera
- react-native-audio-recorder-player

**Location:** `/mobile`

**Key Responsibilities:**
- Maintain persistent WebSocket connection to server
- Capture and stream camera frames (MJPEG)
- Record and stream audio
- Track device location
- Execute remote commands
- Handle push notification wake-ups
- Survive background/sleep states

**Operating Modes:**

| Mode | Description |
|------|-------------|
| Setup Mode | Full UI for initial pairing |
| Headless Mode | Background operation, no UI |

**Key Files:**
```
mobile/
├── ios/RemoteEyeMobile/
│   ├── AppDelegate.swift     # Setup/headless mode switch
│   └── Info.plist            # Permissions, background modes
├── App.tsx                   # Authentication state machine
└── src/services/
    ├── SocketService.ts      # WebSocket with self-healing auth
    ├── AuthService.ts        # Token management
    ├── PushNotificationService.ts
    ├── CameraService.ts
    ├── AudioService.ts
    └── LocationService.ts
```

---

### 2. Relay Server (Python)

**Technology Stack:**
- FastAPI (async REST API)
- python-socketio (WebSocket)
- SQLAlchemy 2.0 (async ORM)
- Pydantic v2 (validation)
- python-jose (JWT)
- boto3 (R2 storage)

**Location:** `/server`

**Hosting:** Render.com

**Key Responsibilities:**
- Authenticate devices and controllers
- Maintain WebSocket connections
- Route commands from dashboard to device
- Stream media from device to dashboard
- Queue commands for offline devices
- Store recordings in Cloudflare R2
- Send push notifications via FCM

**Key Files:**
```
server/
├── app/
│   ├── main.py               # FastAPI + Socket.IO
│   ├── config.py             # Environment settings
│   ├── routes/
│   │   ├── auth.py           # Pairing, registration, tokens
│   │   ├── devices.py        # Device management
│   │   ├── recordings.py     # Recording retrieval
│   │   └── command.py        # Push notification commands
│   ├── services/
│   │   ├── websocket.py      # Socket.IO event handlers
│   │   ├── device_manager.py # In-memory connection state
│   │   ├── command_queue.py  # Offline command queue
│   │   └── storage.py        # R2 file operations
│   └── db/
│       ├── models.py         # SQLAlchemy models
│       └── crud.py           # Database operations
└── tests/
```

**API Endpoints:**

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/pair` | POST | Generate pairing code |
| `/api/auth/register` | POST | Register device/controller |
| `/api/auth/refresh` | POST | Refresh access token |
| `/api/auth/lookup-pairing/{code}` | GET | Get device ID from code |
| `/api/devices/{id}` | GET | Get device info |
| `/api/devices/{id}/push-token` | POST | Register FCM token |
| `/api/devices/{id}/command` | POST | Send push notification command |
| `/api/recordings` | GET | List recordings |
| `/api/recordings/{id}` | GET | Download recording |

---

### 3. Dashboard (Web)

**Technology Stack:**
- React 18
- TypeScript
- Vite (build tool)
- Tailwind CSS
- Socket.IO client
- Zustand (state management)

**Location:** `/dashboard`

**Hosting:** Render.com (static site)

**Key Responsibilities:**
- Display device status (online/offline, battery, etc.)
- Render live camera feed
- Play audio streams
- Show device location on map
- Send commands to device
- View photo gallery and recordings
- Configure device settings

**Key Files:**
```
dashboard/
├── src/
│   ├── App.tsx
│   ├── pages/
│   │   ├── Login.tsx         # Pairing code entry
│   │   ├── Dashboard.tsx     # Main control panel
│   │   ├── Camera.tsx        # Live video view
│   │   ├── Audio.tsx         # Audio monitoring
│   │   ├── Location.tsx      # Map view
│   │   └── Gallery.tsx       # Photos & recordings
│   ├── components/
│   │   ├── DeviceStatus.tsx
│   │   ├── VideoPlayer.tsx
│   │   └── CommandPanel.tsx
│   └── services/
│       ├── SocketService.ts
│       └── ApiService.ts
└── index.html
```

---

## Data Flows

### 1. Device Pairing Flow

```
┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│   Mobile    │         │   Server    │         │  Dashboard  │
└──────┬──────┘         └──────┬──────┘         └──────┬──────┘
       │                       │                       │
       │  POST /auth/pair      │                       │
       │──────────────────────►│                       │
       │                       │                       │
       │  { code: "ABC123" }   │                       │
       │◄──────────────────────│                       │
       │                       │                       │
       │  [Display code]       │                       │
       │                       │                       │
       │                       │    [User enters code] │
       │                       │                       │
       │                       │  GET /lookup/ABC123   │
       │                       │◄──────────────────────│
       │                       │                       │
       │                       │  { device_id: null }  │
       │                       │──────────────────────►│
       │                       │                       │
       │  POST /auth/register  │                       │
       │  { code: "ABC123" }   │                       │
       │──────────────────────►│                       │
       │                       │                       │
       │  { tokens, device_id }│                       │
       │◄──────────────────────│                       │
       │                       │                       │
       │                       │  GET /lookup/ABC123   │
       │                       │◄──────────────────────│
       │                       │                       │
       │                       │  { device_id: uuid }  │
       │                       │──────────────────────►│
       │                       │                       │
       │                       │  POST /auth/register  │
       │                       │  { device_id: uuid }  │
       │                       │◄──────────────────────│
       │                       │                       │
       │                       │  { controller tokens }│
       │                       │──────────────────────►│
       │                       │                       │
       ╔═══════════════════════╧═══════════════════════╗
       ║         Both connect via WebSocket            ║
       ╚═══════════════════════════════════════════════╝
```

### 2. Command Flow (Dashboard → Device)

```
┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│  Dashboard  │         │   Server    │         │   Mobile    │
└──────┬──────┘         └──────┬──────┘         └──────┬──────┘
       │                       │                       │
       │  controller:command   │                       │
       │  { action: "start_   │                       │
       │    camera" }          │                       │
       │──────────────────────►│                       │
       │                       │                       │
       │                       │  [Device online?]     │
       │                       │                       │
       │                       │  controller:command   │
       │                       │──────────────────────►│
       │                       │                       │
       │                       │  device:command_ack   │
       │                       │  { status: "received"}│
       │                       │◄──────────────────────│
       │                       │                       │
       │  command_ack          │                       │
       │◄──────────────────────│                       │
       │                       │                       │
       │                       │  [Camera starts]      │
       │                       │                       │
       │                       │  device:frame         │
       │                       │  { base64: "..." }    │
       │                       │◄──────────────────────│
       │                       │                       │
       │  device:frame         │                       │
       │◄──────────────────────│                       │
       │                       │                       │
       │  [Display video]      │                       │
```

### 3. Wake-on-Demand Flow (Push Notification)

```
┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│  Dashboard  │         │   Server    │         │   Mobile    │
└──────┬──────┘         └──────┬──────┘         └──────┬──────┘
       │                       │                       │
       │  [Device offline]     │                 [App suspended]
       │                       │                       │
       │  POST /device/{id}/   │                       │
       │  command              │                       │
       │  { action: "wake" }   │                       │
       │──────────────────────►│                       │
       │                       │                       │
       │                       │  [Send FCM push]      │
       │                       │  { content-available: │
       │                       │    1, action: "wake" }│
       │                       │        ─ ─ ─ ─ ─ ─ ─ ►│
       │                       │                       │
       │                       │                 [iOS wakes app]
       │                       │                       │
       │                       │                 [handleWakeUp()]
       │                       │                       │
       │                       │  [WebSocket connect]  │
       │                       │◄──────────────────────│
       │                       │                       │
       │                       │  device:register      │
       │                       │◄──────────────────────│
       │                       │                       │
       │  server:device_status │                       │
       │  { online: true }     │                       │
       │◄──────────────────────│                       │
       │                       │                       │
       │  [Device now online,  │                       │
       │   ready for commands] │                       │
```

---

## Authentication & Security

### Token Types

| Token | Lifetime | Purpose |
|-------|----------|---------|
| Pairing Code | 10 min | One-time device registration |
| Access Token | 60 min | API/WebSocket authentication |
| Refresh Token | 7 days | Obtain new access tokens |

### JWT Structure

```json
{
  "sub": "device-uuid-here",
  "type": "device",  // or "controller"
  "iat": 1705123456,
  "exp": 1705127056
}
```

### Self-Healing Authentication

The mobile app automatically refreshes expired tokens:

1. Attempt WebSocket connection with stored access token
2. If 401 error, call `/api/auth/refresh` with refresh token
3. If refresh succeeds, store new tokens and retry connection
4. If refresh fails (expired), clear credentials and wait for re-pairing

---

## Database Schema

### Core Tables

```sql
-- Pairing codes for initial setup
CREATE TABLE pairing_codes (
    code VARCHAR(6) PRIMARY KEY,
    created_at TIMESTAMP,
    expires_at TIMESTAMP,
    used INTEGER DEFAULT 0,
    device_id VARCHAR(36)
);

-- Registered devices
CREATE TABLE devices (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(100),
    secret_hash VARCHAR(255),
    status VARCHAR(20) DEFAULT 'offline',
    last_seen TIMESTAMP,
    device_info JSON,
    current_status JSON,
    settings JSON,
    push_token VARCHAR(255),
    push_platform VARCHAR(20),
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);

-- Queued commands for offline devices
CREATE TABLE command_queue (
    id VARCHAR(36) PRIMARY KEY,
    device_id VARCHAR(36),
    action VARCHAR(50),
    params JSON,
    status VARCHAR(20),
    created_at TIMESTAMP,
    delivered_at TIMESTAMP,
    FOREIGN KEY (device_id) REFERENCES devices(id)
);

-- Saved recordings
CREATE TABLE recordings (
    id VARCHAR(36) PRIMARY KEY,
    device_id VARCHAR(36),
    type VARCHAR(20),
    filename VARCHAR(255),
    storage_key VARCHAR(255),
    duration INTEGER,
    size INTEGER,
    triggered_by VARCHAR(50),
    created_at TIMESTAMP,
    FOREIGN KEY (device_id) REFERENCES devices(id)
);
```

---

## External Services

### Firebase Cloud Messaging (FCM)

- **Purpose:** Wake the mobile app from suspended state
- **Payload:** Silent push with `content-available: 1`
- **Commands:** Can include action in data payload

### Cloudflare R2

- **Purpose:** Store audio recordings and photos
- **Access:** Pre-signed URLs for secure downloads
- **Cleanup:** Automatic expiration policies

### Render.com

- **Server:** Python FastAPI with WebSocket support
- **Dashboard:** Static React site with CDN
- **Database:** Managed PostgreSQL (production)

---

## Performance Targets

| Metric | Target |
|--------|--------|
| Video latency | < 2 seconds |
| Audio latency | < 1 second |
| Command acknowledgment | < 500ms |
| Push notification → App wake | < 5 seconds |
| Token refresh | < 1 second |

---

## Directory Structure

```
spyder/
├── _architecture/           # Documentation
│   ├── system-overview.md   # This file
│   ├── headless-setup-guide.md
│   ├── api-contracts/
│   │   ├── rest-endpoints.md
│   │   └── websocket-protocol.md
│   └── component-specs/
├── _management/
│   ├── milestones.md
│   ├── progress.md
│   └── backlog.md
├── server/                  # Python backend
├── mobile/                  # React Native iOS app
└── dashboard/               # React web dashboard
```
