/**
 * RemoteEye Mobile - Type Definitions
 */

// Base message interface for all Socket.IO messages
export interface BaseMessage {
  type: string;
  timestamp: string; // ISO 8601
  messageId?: string;
}

// Device info sent during registration
export interface DeviceInfo {
  name: string;
  model: string;
  osVersion: string;
  appVersion: string;
}

// Device status
export interface DeviceStatus {
  battery: number;
  charging: boolean;
  networkType: 'wifi' | 'cellular' | 'none';
  signalStrength: number;
  cameraActive: boolean;
  audioActive: boolean;
  locationEnabled: boolean;
}

// Location data
export interface LocationData {
  latitude: number;
  longitude: number;
  altitude: number;
  accuracy: number;
  speed: number;
  heading: number;
}

// Camera frame
export interface CameraFrame {
  data: string; // Base64 encoded JPEG
  width: number;
  height: number;
  quality: number;
  sequence: number;
}

// Audio chunk
export interface AudioChunk {
  data: string; // Base64 encoded
  sampleRate: number;
  channels: number;
  duration: number;
  sequence: number;
}

// Photo data
export interface PhotoData {
  data: string;
  width: number;
  height: number;
  filename: string;
}

// Sound detection
export interface SoundDetection {
  level: number;
  threshold: number;
  recordingStarted: boolean;
}

// Recording info
export interface RecordingInfo {
  id: string;
  type: 'audio';
  duration: number;
  size: number;
  triggeredBy: 'sound_detection' | 'manual';
}

// Command actions
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

// Command with params
export interface Command {
  commandId: string;
  action: CommandAction;
  params?: Record<string, unknown>;
}

// Command acknowledgment status
export type CommandStatus = 'received' | 'executing' | 'completed' | 'failed';

// Settings
export interface CameraSettings {
  quality: 'low' | 'medium' | 'high';
  fps: number;
}

export interface SoundDetectionSettings {
  enabled: boolean;
  threshold: number; // dB
  recordDuration: number; // seconds
}

export interface DeviceSettings {
  camera: CameraSettings;
  soundDetection: SoundDetectionSettings;
  locationUpdateInterval: number; // seconds
}

// Connection state
export type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'reconnecting';

// App state
export interface AppState {
  deviceId: string | null;
  token: string | null;
  refreshToken: string | null;
  serverUrl: string;
  isRegistered: boolean;
  connectionState: ConnectionState;
  deviceStatus: DeviceStatus | null;
  settings: DeviceSettings;
  lastError: string | null;
}

// Auth response
export interface AuthResponse {
  success: boolean;
  token: string;
  refresh_token: string;
  expires_in: number;
  device_id: string;
}

// Pairing response
export interface PairingResponse {
  success: boolean;
  pairing_code: string;
  expires_at: string;
}

// API error
export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
  };
}
