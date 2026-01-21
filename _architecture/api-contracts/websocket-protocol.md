# WebSocket Protocol Specification

## Overview

All real-time communication uses Socket.IO over WebSocket (WSS in production). The protocol defines message types for commands, media streaming, and status updates.

---

## Connection

### Endpoint
```
Development: ws://localhost:3001
Production:  wss://your-server.onrender.com
```

### Authentication
Connect with JWT token in auth handshake:

```typescript
const socket = io(SERVER_URL, {
  auth: {
    token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
  },
  transports: ['websocket'],
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 30000
});
```

### Connection Events
```typescript
// Client-side
socket.on('connect', () => {});
socket.on('disconnect', (reason) => {});
socket.on('connect_error', (error) => {});

// Server-side
io.on('connection', (socket) => {});
```

---

## Message Types

### Base Message Format
```typescript
interface BaseMessage {
  type: string;
  timestamp: string; // ISO 8601
  messageId?: string; // For acknowledgment tracking
}
```

---

## Device Messages (iPhone → Server)

### 1. Device Registration
Sent immediately after connection.

```typescript
interface DeviceRegisterMessage extends BaseMessage {
  type: 'device:register';
  deviceId: string;
  deviceInfo: {
    name: string;
    model: string;
    osVersion: string;
    appVersion: string;
  };
}

// Example
{
  "type": "device:register",
  "timestamp": "2024-01-20T10:30:00Z",
  "deviceId": "iphone-abc123",
  "deviceInfo": {
    "name": "John's iPhone",
    "model": "iPhone 14",
    "osVersion": "17.2",
    "appVersion": "1.0.0"
  }
}
```

### 2. Status Update
Sent periodically and on status change.

```typescript
interface DeviceStatusMessage extends BaseMessage {
  type: 'device:status';
  deviceId: string;
  status: {
    battery: number; // 0-100
    charging: boolean;
    networkType: 'wifi' | 'cellular' | 'none';
    signalStrength: number; // 0-4
    cameraActive: boolean;
    audioActive: boolean;
    locationEnabled: boolean;
  };
}
```

### 3. Camera Frame
Sent when camera is streaming.

```typescript
interface CameraFrameMessage extends BaseMessage {
  type: 'device:frame';
  deviceId: string;
  frame: {
    data: string; // Base64 encoded JPEG
    width: number;
    height: number;
    quality: number; // 0-1
    sequence: number; // Frame sequence number
  };
}
```

### 4. Audio Chunk
Sent when audio is streaming.

```typescript
interface AudioChunkMessage extends BaseMessage {
  type: 'device:audio';
  deviceId: string;
  audio: {
    data: string; // Base64 encoded PCM/AAC
    sampleRate: number;
    channels: number;
    duration: number; // milliseconds
    sequence: number;
  };
}
```

### 5. Photo Captured
Sent after photo capture command.

```typescript
interface PhotoCapturedMessage extends BaseMessage {
  type: 'device:photo';
  deviceId: string;
  photo: {
    data: string; // Base64 encoded JPEG
    width: number;
    height: number;
    filename: string;
  };
}
```

### 6. Location Update
Sent periodically.

```typescript
interface LocationUpdateMessage extends BaseMessage {
  type: 'device:location';
  deviceId: string;
  location: {
    latitude: number;
    longitude: number;
    altitude: number;
    accuracy: number; // meters
    speed: number; // m/s
    heading: number; // degrees
  };
}
```

### 7. Sound Detection Alert
Sent when sound threshold exceeded.

```typescript
interface SoundDetectedMessage extends BaseMessage {
  type: 'device:sound_detected';
  deviceId: string;
  detection: {
    level: number; // dB
    threshold: number; // configured threshold
    recordingStarted: boolean;
  };
}
```

### 8. Recording Complete
Sent when auto-recording finishes.

```typescript
interface RecordingCompleteMessage extends BaseMessage {
  type: 'device:recording_complete';
  deviceId: string;
  recording: {
    id: string;
    type: 'audio';
    duration: number; // seconds
    size: number; // bytes
    triggeredBy: 'sound_detection' | 'manual';
  };
}
```

### 9. Command Acknowledgment
Sent after receiving command.

```typescript
interface CommandAckMessage extends BaseMessage {
  type: 'device:command_ack';
  deviceId: string;
  commandId: string;
  status: 'received' | 'executing' | 'completed' | 'failed';
  error?: string;
}
```

---

## Controller Messages (Dashboard → Server)

### 1. Controller Registration
Sent immediately after connection.

```typescript
interface ControllerRegisterMessage extends BaseMessage {
  type: 'controller:register';
  controllerId: string;
  targetDeviceId: string; // Which device to control
}
```

### 2. Command Messages
Sent to control the device.

```typescript
interface CommandMessage extends BaseMessage {
  type: 'controller:command';
  commandId: string; // UUID for tracking
  targetDeviceId: string;
  action: CommandAction;
  params?: Record<string, any>;
}

type CommandAction =
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
```

**Command Examples**:

```typescript
// Start camera
{
  "type": "controller:command",
  "timestamp": "2024-01-20T10:30:00Z",
  "commandId": "cmd-uuid-123",
  "targetDeviceId": "iphone-abc123",
  "action": "start_camera",
  "params": {
    "quality": "medium", // low, medium, high
    "fps": 10
  }
}

// Set sound threshold
{
  "type": "controller:command",
  "timestamp": "2024-01-20T10:31:00Z",
  "commandId": "cmd-uuid-456",
  "targetDeviceId": "iphone-abc123",
  "action": "set_sound_threshold",
  "params": {
    "threshold": -30, // dB
    "duration": 30 // record for 30 seconds
  }
}
```

---

## Server Messages (Server → Clients)

### 1. Device Status Broadcast
Sent to controllers when device status changes.

```typescript
interface DeviceStatusBroadcast extends BaseMessage {
  type: 'server:device_status';
  deviceId: string;
  online: boolean;
  lastSeen: string;
  status?: DeviceStatus; // Full status if online
}
```

### 2. Command Queued
Sent to controller when device is offline.

```typescript
interface CommandQueuedMessage extends BaseMessage {
  type: 'server:command_queued';
  commandId: string;
  position: number; // Position in queue
  reason: 'device_offline';
}
```

### 3. Error Message
Sent when an error occurs.

```typescript
interface ErrorMessage extends BaseMessage {
  type: 'server:error';
  code: string;
  message: string;
  details?: any;
}
```

**Error Codes**:
| Code | Description |
|------|-------------|
| `AUTH_FAILED` | Invalid or expired token |
| `DEVICE_NOT_FOUND` | Target device doesn't exist |
| `INVALID_COMMAND` | Unknown command action |
| `PERMISSION_DENIED` | Not authorized for action |
| `RATE_LIMITED` | Too many requests |

---

## Socket.IO Events Summary

### Device Events (Emitted by Device)
| Event | Payload Type | Description |
|-------|--------------|-------------|
| `device:register` | DeviceRegisterMessage | Initial registration |
| `device:status` | DeviceStatusMessage | Status update |
| `device:frame` | CameraFrameMessage | Camera frame |
| `device:audio` | AudioChunkMessage | Audio chunk |
| `device:photo` | PhotoCapturedMessage | Captured photo |
| `device:location` | LocationUpdateMessage | Location update |
| `device:sound_detected` | SoundDetectedMessage | Sound alert |
| `device:recording_complete` | RecordingCompleteMessage | Recording done |
| `device:command_ack` | CommandAckMessage | Command acknowledgment |

### Controller Events (Emitted by Controller)
| Event | Payload Type | Description |
|-------|--------------|-------------|
| `controller:register` | ControllerRegisterMessage | Initial registration |
| `controller:command` | CommandMessage | Send command |

### Server Events (Emitted by Server)
| Event | Payload Type | Description |
|-------|--------------|-------------|
| `server:device_status` | DeviceStatusBroadcast | Device status change |
| `server:command_queued` | CommandQueuedMessage | Command queued |
| `server:error` | ErrorMessage | Error notification |

---

## Rooms Structure

Socket.IO rooms for efficient message routing:

```
device:{deviceId}      - The device itself
controllers:{deviceId} - All controllers watching this device
```

**Routing Logic**:
- Device frames → broadcast to `controllers:{deviceId}`
- Controller commands → send to `device:{deviceId}`
- Status updates → broadcast to `controllers:{deviceId}`

---

## Heartbeat / Keep-Alive

Socket.IO handles ping/pong automatically. Additional application-level heartbeat:

```typescript
// Device sends every 30 seconds
{
  "type": "device:heartbeat",
  "timestamp": "2024-01-20T10:30:00Z",
  "deviceId": "iphone-abc123"
}

// Server responds
{
  "type": "server:heartbeat_ack",
  "timestamp": "2024-01-20T10:30:00Z"
}
```

---

## Reconnection Protocol

1. Client detects disconnection
2. Socket.IO attempts reconnection with exponential backoff
3. On reconnect, client re-sends registration message
4. Server restores state and delivers queued commands
5. Device resumes streaming if previously active
