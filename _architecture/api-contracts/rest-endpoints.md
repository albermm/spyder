# REST API Specification

## Base URL
```
Development: http://localhost:3001/api
Production:  https://your-server.onrender.com/api
```

## Authentication
All endpoints except `/auth/*` require JWT Bearer token:
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## Endpoints

### Authentication

#### POST /auth/register
Register a new device or controller.

**Request**:
```typescript
interface RegisterRequest {
  type: 'device' | 'controller';
  pairingCode?: string; // Required for device
  deviceId?: string; // For controller, specify which device to control
  name: string;
}
```

**Response** (201 Created):
```typescript
interface RegisterResponse {
  success: true;
  token: string; // JWT access token
  refreshToken: string;
  expiresIn: number; // seconds
  deviceId?: string; // Generated ID for new device
}
```

**Errors**:
- 400: Invalid pairing code
- 409: Device already registered

---

#### POST /auth/login
Login existing device/controller.

**Request**:
```typescript
interface LoginRequest {
  deviceId: string;
  secret: string; // Device-specific secret
}
```

**Response** (200 OK):
```typescript
interface LoginResponse {
  success: true;
  token: string;
  refreshToken: string;
  expiresIn: number;
}
```

---

#### POST /auth/refresh
Refresh access token.

**Request**:
```typescript
interface RefreshRequest {
  refreshToken: string;
}
```

**Response** (200 OK):
```typescript
interface RefreshResponse {
  success: true;
  token: string;
  expiresIn: number;
}
```

---

#### POST /auth/pair
Generate a new pairing code (called from dashboard to pair a new device).

**Request**: None (uses authenticated controller)

**Response** (201 Created):
```typescript
interface PairResponse {
  success: true;
  pairingCode: string; // 6-character code
  expiresAt: string; // ISO 8601, valid for 10 minutes
}
```

---

### Devices

#### GET /devices
List all paired devices (for controller).

**Response** (200 OK):
```typescript
interface DevicesListResponse {
  success: true;
  devices: Array<{
    id: string;
    name: string;
    status: 'online' | 'offline';
    lastSeen: string;
    batteryLevel?: number;
    settings: DeviceSettings;
  }>;
}
```

---

#### GET /devices/:deviceId
Get device details.

**Response** (200 OK):
```typescript
interface DeviceDetailResponse {
  success: true;
  device: {
    id: string;
    name: string;
    status: 'online' | 'offline';
    lastSeen: string;
    deviceInfo: {
      model: string;
      osVersion: string;
      appVersion: string;
    };
    currentStatus: {
      battery: number;
      charging: boolean;
      networkType: string;
      cameraActive: boolean;
      audioActive: boolean;
      lastLocation?: {
        latitude: number;
        longitude: number;
        timestamp: string;
      };
    };
    settings: DeviceSettings;
  };
}

interface DeviceSettings {
  soundDetection: {
    enabled: boolean;
    threshold: number; // dB
    recordDuration: number; // seconds
  };
  camera: {
    quality: 'low' | 'medium' | 'high';
    fps: number;
  };
  location: {
    trackingEnabled: boolean;
    updateInterval: number; // seconds
  };
}
```

---

#### PATCH /devices/:deviceId
Update device settings.

**Request**:
```typescript
interface UpdateDeviceRequest {
  name?: string;
  settings?: Partial<DeviceSettings>;
}
```

**Response** (200 OK):
```typescript
interface UpdateDeviceResponse {
  success: true;
  device: DeviceDetailResponse['device'];
}
```

---

#### DELETE /devices/:deviceId
Unpair a device.

**Response** (200 OK):
```typescript
interface DeleteDeviceResponse {
  success: true;
  message: string;
}
```

---

### Commands

#### POST /devices/:deviceId/commands
Queue a command (alternative to WebSocket).

**Request**:
```typescript
interface CommandRequest {
  action: CommandAction;
  params?: Record<string, any>;
}
```

**Response** (202 Accepted):
```typescript
interface CommandResponse {
  success: true;
  commandId: string;
  status: 'queued' | 'delivered';
  queuePosition?: number; // If device offline
}
```

---

#### GET /devices/:deviceId/commands
Get command history.

**Query Parameters**:
- `status`: Filter by status (pending, delivered, completed, failed)
- `limit`: Number of results (default 50)
- `offset`: Pagination offset

**Response** (200 OK):
```typescript
interface CommandHistoryResponse {
  success: true;
  commands: Array<{
    id: string;
    action: string;
    params: any;
    status: string;
    createdAt: string;
    deliveredAt?: string;
    completedAt?: string;
    error?: string;
  }>;
  pagination: {
    total: number;
    limit: number;
    offset: number;
  };
}
```

---

### Recordings

#### GET /recordings
List all recordings.

**Query Parameters**:
- `deviceId`: Filter by device
- `type`: Filter by type (audio, photo)
- `triggeredBy`: Filter by trigger (manual, sound_detection)
- `startDate`: Filter by date range start
- `endDate`: Filter by date range end
- `limit`: Number of results (default 50)
- `offset`: Pagination offset

**Response** (200 OK):
```typescript
interface RecordingsListResponse {
  success: true;
  recordings: Array<{
    id: string;
    deviceId: string;
    type: 'audio' | 'photo';
    filename: string;
    duration?: number; // seconds, for audio
    size: number; // bytes
    triggeredBy: 'manual' | 'sound_detection';
    createdAt: string;
    thumbnailUrl?: string; // For photos
  }>;
  pagination: {
    total: number;
    limit: number;
    offset: number;
  };
}
```

---

#### GET /recordings/:recordingId
Get recording details.

**Response** (200 OK):
```typescript
interface RecordingDetailResponse {
  success: true;
  recording: {
    id: string;
    deviceId: string;
    type: 'audio' | 'photo';
    filename: string;
    duration?: number;
    size: number;
    triggeredBy: string;
    createdAt: string;
    downloadUrl: string; // Signed URL, valid for 1 hour
    metadata?: {
      soundLevel?: number;
      location?: { latitude: number; longitude: number };
    };
  };
}
```

---

#### GET /recordings/:recordingId/download
Download recording file.

**Response**: Binary file with appropriate Content-Type
- `audio/aac` for audio
- `image/jpeg` for photos

---

#### DELETE /recordings/:recordingId
Delete a recording.

**Response** (200 OK):
```typescript
interface DeleteRecordingResponse {
  success: true;
  message: string;
}
```

---

### Health

#### GET /health
Health check endpoint.

**Response** (200 OK):
```typescript
interface HealthResponse {
  status: 'healthy';
  timestamp: string;
  version: string;
  uptime: number; // seconds
}
```

---

## Error Responses

All errors follow this format:

```typescript
interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
  };
}
```

**HTTP Status Codes**:
| Code | Meaning |
|------|---------|
| 400 | Bad Request - Invalid input |
| 401 | Unauthorized - Missing/invalid token |
| 403 | Forbidden - No permission |
| 404 | Not Found |
| 409 | Conflict - Resource already exists |
| 422 | Unprocessable Entity - Validation failed |
| 429 | Too Many Requests - Rate limited |
| 500 | Internal Server Error |

**Error Codes**:
| Code | Description |
|------|-------------|
| `INVALID_INPUT` | Request body validation failed |
| `AUTH_REQUIRED` | No auth token provided |
| `TOKEN_EXPIRED` | JWT has expired |
| `TOKEN_INVALID` | JWT is malformed or invalid |
| `DEVICE_NOT_FOUND` | Device ID doesn't exist |
| `RECORDING_NOT_FOUND` | Recording ID doesn't exist |
| `PAIRING_CODE_INVALID` | Pairing code wrong or expired |
| `PAIRING_CODE_EXPIRED` | Pairing code has expired |
| `ALREADY_PAIRED` | Device already registered |
| `RATE_LIMITED` | Too many requests |

---

## Rate Limiting

| Endpoint | Limit |
|----------|-------|
| `/auth/*` | 10 req/min |
| `/devices/*` | 60 req/min |
| `/commands/*` | 30 req/min |
| `/recordings/*` | 60 req/min |

Rate limit headers:
```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1705750800
```

---

## TypeScript Types Export

```typescript
// shared/types/api.ts

export type CommandAction =
  | 'start_camera'
  | 'stop_camera'
  | 'start_audio'
  | 'stop_audio'
  | 'capture_photo'
  | 'start_recording'
  | 'stop_recording'
  | 'get_location'
  | 'get_status'
  | 'set_sound_threshold'
  | 'enable_sound_detection'
  | 'disable_sound_detection';

export interface DeviceSettings {
  soundDetection: {
    enabled: boolean;
    threshold: number;
    recordDuration: number;
  };
  camera: {
    quality: 'low' | 'medium' | 'high';
    fps: number;
  };
  location: {
    trackingEnabled: boolean;
    updateInterval: number;
  };
}

export interface Device {
  id: string;
  name: string;
  status: 'online' | 'offline';
  lastSeen: string;
  batteryLevel?: number;
  settings: DeviceSettings;
}

export interface Recording {
  id: string;
  deviceId: string;
  type: 'audio' | 'photo';
  filename: string;
  duration?: number;
  size: number;
  triggeredBy: 'manual' | 'sound_detection';
  createdAt: string;
}
```
