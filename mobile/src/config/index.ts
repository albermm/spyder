/**
 * RemoteEye Mobile - Configuration
 */

// Server configuration
// TODO: Replace with your deployed server URL (e.g., Render, Railway, VPS)
// This should be a publicly accessible URL so the iPhone can connect from anywhere
const SERVER_URL = 'https://remoteeye-server.onrender.com';

export const CONFIG = {
  // Server URL - single source of truth
  SERVER_URL,

  // App info
  APP_VERSION: '1.0.0',

  // Socket.IO settings
  SOCKET_RECONNECTION_ATTEMPTS: Infinity,
  SOCKET_RECONNECTION_DELAY: 1000,
  SOCKET_RECONNECTION_DELAY_MAX: 30000,

  // Camera settings
  CAMERA_DEFAULT_QUALITY: 'medium' as const,
  CAMERA_DEFAULT_FPS: 10,
  CAMERA_QUALITY_MAP: {
    low: { width: 320, height: 240, quality: 0.5 },
    medium: { width: 640, height: 480, quality: 0.7 },
    high: { width: 1280, height: 720, quality: 0.85 },
  },

  // Audio settings
  AUDIO_SAMPLE_RATE: 44100,
  AUDIO_CHANNELS: 1,
  AUDIO_CHUNK_DURATION: 500, // ms

  // Sound detection
  SOUND_THRESHOLD_DEFAULT: -30, // dB
  SOUND_RECORD_DURATION_DEFAULT: 30, // seconds

  // Location
  LOCATION_UPDATE_INTERVAL: 300, // seconds (5 minutes)
  LOCATION_DISTANCE_FILTER: 10, // meters

  // Heartbeat
  HEARTBEAT_INTERVAL: 30000, // ms

  // Status update interval
  STATUS_UPDATE_INTERVAL: 60000, // ms

  // Storage keys
  STORAGE_KEYS: {
    DEVICE_ID: '@remoteeye:device_id',
    TOKEN: '@remoteeye:token',
    REFRESH_TOKEN: '@remoteeye:refresh_token',
    SETTINGS: '@remoteeye:settings',
  },
};

// Get the server URL - always use the configured URL
// No dev/prod distinction - the server should always be publicly accessible
export const getServerUrl = (): string => {
  return CONFIG.SERVER_URL;
};

// Default device settings
export const DEFAULT_SETTINGS = {
  camera: {
    quality: CONFIG.CAMERA_DEFAULT_QUALITY,
    fps: CONFIG.CAMERA_DEFAULT_FPS,
  },
  soundDetection: {
    enabled: true,
    threshold: CONFIG.SOUND_THRESHOLD_DEFAULT,
    recordDuration: CONFIG.SOUND_RECORD_DURATION_DEFAULT,
  },
  locationUpdateInterval: CONFIG.LOCATION_UPDATE_INTERVAL,
};
