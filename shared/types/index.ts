// RemoteEye - Shared Types
// Used by server, mobile, and dashboard

// ============================================
// Command Types
// ============================================

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

export interface Command {
  id: string;
  action: CommandAction;
  params?: Record<string, unknown>;
  status: 'pending' | 'delivered' | 'executing' | 'completed' | 'failed';
  createdAt: string;
  deliveredAt?: string;
  completedAt?: string;
  error?: string;
}

// ============================================
// Device Types
// ============================================

export interface DeviceInfo {
  name: string;
  model: string;
  osVersion: string;
  appVersion: string;
}

export interface DeviceStatus {
  battery: number;
  charging: boolean;
  networkType: 'wifi' | 'cellular' | 'none';
  signalStrength: number;
  cameraActive: boolean;
  audioActive: boolean;
  locationEnabled: boolean;
}

export interface DeviceSettings {
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

export interface Device {
  id: string;
  name: string;
  status: 'online' | 'offline';
  lastSeen: string;
  deviceInfo?: DeviceInfo;
  currentStatus?: DeviceStatus;
  settings: DeviceSettings;
}

// ============================================
// Location Types
// ============================================

export interface Location {
  latitude: number;
  longitude: number;
  altitude: number;
  accuracy: number;
  speed: number;
  heading: number;
  timestamp: string;
}

// ============================================
// Recording Types
// ============================================

export interface Recording {
  id: string;
  deviceId: string;
  type: 'audio' | 'photo';
  filename: string;
  duration?: number; // seconds, for audio
  size: number; // bytes
  triggeredBy: 'manual' | 'sound_detection';
  createdAt: string;
  thumbnailUrl?: string;
  downloadUrl?: string;
  metadata?: {
    soundLevel?: number;
    location?: { latitude: number; longitude: number };
  };
}

// ============================================
// WebSocket Message Types
// ============================================

export interface BaseMessage {
  type: string;
  timestamp: string;
  messageId?: string;
}

// Device → Server Messages
export interface DeviceRegisterMessage extends BaseMessage {
  type: 'device:register';
  deviceId: string;
  deviceInfo: DeviceInfo;
}

export interface DeviceStatusMessage extends BaseMessage {
  type: 'device:status';
  deviceId: string;
  status: DeviceStatus;
}

export interface CameraFrameMessage extends BaseMessage {
  type: 'device:frame';
  deviceId: string;
  frame: {
    data: string; // Base64 JPEG
    width: number;
    height: number;
    quality: number;
    sequence: number;
  };
}

export interface AudioChunkMessage extends BaseMessage {
  type: 'device:audio';
  deviceId: string;
  audio: {
    data: string; // Base64
    sampleRate: number;
    channels: number;
    duration: number;
    sequence: number;
  };
}

export interface PhotoCapturedMessage extends BaseMessage {
  type: 'device:photo';
  deviceId: string;
  photo: {
    data: string; // Base64 JPEG
    width: number;
    height: number;
    filename: string;
  };
}

export interface LocationUpdateMessage extends BaseMessage {
  type: 'device:location';
  deviceId: string;
  location: Omit<Location, 'timestamp'>;
}

export interface SoundDetectedMessage extends BaseMessage {
  type: 'device:sound_detected';
  deviceId: string;
  detection: {
    level: number;
    threshold: number;
    recordingStarted: boolean;
  };
}

export interface RecordingCompleteMessage extends BaseMessage {
  type: 'device:recording_complete';
  deviceId: string;
  recording: {
    id: string;
    type: 'audio';
    duration: number;
    size: number;
    triggeredBy: 'sound_detection' | 'manual';
  };
}

export interface CommandAckMessage extends BaseMessage {
  type: 'device:command_ack';
  deviceId: string;
  commandId: string;
  status: 'received' | 'executing' | 'completed' | 'failed';
  error?: string;
}

// Controller → Server Messages
export interface ControllerRegisterMessage extends BaseMessage {
  type: 'controller:register';
  controllerId: string;
  targetDeviceId: string;
}

export interface ControllerCommandMessage extends BaseMessage {
  type: 'controller:command';
  commandId: string;
  targetDeviceId: string;
  action: CommandAction;
  params?: Record<string, unknown>;
}

// Server → Client Messages
export interface DeviceStatusBroadcast extends BaseMessage {
  type: 'server:device_status';
  deviceId: string;
  online: boolean;
  lastSeen: string;
  status?: DeviceStatus;
}

export interface CommandQueuedMessage extends BaseMessage {
  type: 'server:command_queued';
  commandId: string;
  position: number;
  reason: 'device_offline';
}

export interface ServerErrorMessage extends BaseMessage {
  type: 'server:error';
  code: string;
  message: string;
  details?: unknown;
}

// Union type for all messages
export type DeviceMessage =
  | DeviceRegisterMessage
  | DeviceStatusMessage
  | CameraFrameMessage
  | AudioChunkMessage
  | PhotoCapturedMessage
  | LocationUpdateMessage
  | SoundDetectedMessage
  | RecordingCompleteMessage
  | CommandAckMessage;

export type ControllerMessage =
  | ControllerRegisterMessage
  | ControllerCommandMessage;

export type ServerMessage =
  | DeviceStatusBroadcast
  | CommandQueuedMessage
  | ServerErrorMessage;

export type WebSocketMessage = DeviceMessage | ControllerMessage | ServerMessage;

// ============================================
// API Response Types
// ============================================

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    total: number;
    limit: number;
    offset: number;
  };
}

// ============================================
// Auth Types
// ============================================

export interface AuthTokens {
  token: string;
  refreshToken: string;
  expiresIn: number;
}

export interface JWTPayload {
  sub: string; // deviceId or controllerId
  type: 'device' | 'controller';
  iat: number;
  exp: number;
}

// ============================================
// Default Settings
// ============================================

export const DEFAULT_DEVICE_SETTINGS: DeviceSettings = {
  soundDetection: {
    enabled: true,
    threshold: -30, // dB
    recordDuration: 30, // seconds
  },
  camera: {
    quality: 'medium',
    fps: 10,
  },
  location: {
    trackingEnabled: true,
    updateInterval: 300, // 5 minutes
  },
};

// ============================================
// Constants
// ============================================

export const SOCKET_EVENTS = {
  // Device events
  DEVICE_REGISTER: 'device:register',
  DEVICE_STATUS: 'device:status',
  DEVICE_FRAME: 'device:frame',
  DEVICE_AUDIO: 'device:audio',
  DEVICE_PHOTO: 'device:photo',
  DEVICE_LOCATION: 'device:location',
  DEVICE_SOUND_DETECTED: 'device:sound_detected',
  DEVICE_RECORDING_COMPLETE: 'device:recording_complete',
  DEVICE_COMMAND_ACK: 'device:command_ack',
  DEVICE_HEARTBEAT: 'device:heartbeat',

  // Controller events
  CONTROLLER_REGISTER: 'controller:register',
  CONTROLLER_COMMAND: 'controller:command',

  // Server events
  SERVER_DEVICE_STATUS: 'server:device_status',
  SERVER_COMMAND_QUEUED: 'server:command_queued',
  SERVER_ERROR: 'server:error',
  SERVER_HEARTBEAT_ACK: 'server:heartbeat_ack',
} as const;

export const API_ROUTES = {
  AUTH: {
    REGISTER: '/auth/register',
    LOGIN: '/auth/login',
    REFRESH: '/auth/refresh',
    PAIR: '/auth/pair',
  },
  DEVICES: {
    LIST: '/devices',
    GET: (id: string) => `/devices/${id}`,
    UPDATE: (id: string) => `/devices/${id}`,
    DELETE: (id: string) => `/devices/${id}`,
    COMMANDS: (id: string) => `/devices/${id}/commands`,
  },
  RECORDINGS: {
    LIST: '/recordings',
    GET: (id: string) => `/recordings/${id}`,
    DOWNLOAD: (id: string) => `/recordings/${id}/download`,
    DELETE: (id: string) => `/recordings/${id}`,
  },
  HEALTH: '/health',
} as const;
