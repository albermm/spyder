/**
 * RemoteEye Dashboard - Type Definitions
 */

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

// Device info
export interface DeviceInfo {
  name: string;
  model: string;
  osVersion: string;
  appVersion: string;
}

// Device
export interface Device {
  id: string;
  name: string;
  status: 'online' | 'offline';
  lastSeen: string;
  deviceInfo?: DeviceInfo;
  currentStatus?: DeviceStatus;
}

// Location data
export interface LocationData {
  latitude: number;
  longitude: number;
  altitude: number;
  accuracy: number;
  speed: number;
  heading: number;
  timestamp?: string;
}

// Camera frame
export interface CameraFrame {
  data: string;
  width: number;
  height: number;
  quality: number;
  sequence: number;
  timestamp: string;
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

// Command
export interface Command {
  commandId: string;
  action: CommandAction;
  params?: Record<string, unknown>;
}

// Command acknowledgment
export interface CommandAck {
  commandId: string;
  status: 'received' | 'executing' | 'completed' | 'failed';
  error?: string;
}

// Recording status
export type RecordingStatus = 'completed' | 'upload_failed';

// Recording info
export interface Recording {
  id: string;
  deviceId: string;
  type: 'audio' | 'photo';
  filename: string;
  duration?: number;
  size: number;
  createdAt: string;
  triggeredBy: 'sound_detection' | 'manual';
  storageKey?: string | null;
  status?: RecordingStatus;
  metadata?: {
    status?: string;
    error?: string;
    dimensions?: { width: number; height: number };
  };
}

// Photo data
export interface Photo {
  id: string;
  deviceId: string;
  data: string;
  width: number;
  height: number;
  timestamp: string;
}

// Audio chunk for live streaming
export interface AudioChunk {
  data: string; // base64 encoded PCM audio
  sampleRate: number;
  channels: number;
  duration: number;
  sequence: number;
}

// Connection state
export type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'reconnecting';

// Auth response
export interface AuthResponse {
  success: boolean;
  token: string;
  refresh_token: string;
  expires_in: number;
  controller_id?: string;
}

// Pairing response
export interface PairingResponse {
  success: boolean;
  pairing_code: string;
  expires_at: string;
}
