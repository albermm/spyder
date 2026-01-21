/**
 * RemoteEye Dashboard - Configuration
 */

// TODO: Replace with your deployed server URL (e.g., Render, Railway, VPS)
// For local development, you can use 'http://localhost:8765'
const SERVER_URL = 'http://localhost:8765';

export const CONFIG = {
  // Server URL - single source of truth
  SERVER_URL,

  // App info
  APP_VERSION: '1.0.0',

  // Socket.IO settings
  SOCKET_RECONNECTION_ATTEMPTS: 10,
  SOCKET_RECONNECTION_DELAY: 1000,
  SOCKET_RECONNECTION_DELAY_MAX: 30000,

  // Storage keys
  STORAGE_KEYS: {
    TOKEN: 'remoteeye:token',
    REFRESH_TOKEN: 'remoteeye:refresh_token',
    CONTROLLER_ID: 'remoteeye:controller_id',
    SELECTED_DEVICE: 'remoteeye:selected_device',
  },

  // Map defaults
  MAP_CENTER: [37.7749, -122.4194] as [number, number],
  MAP_ZOOM: 13,
};

export const getServerUrl = (): string => {
  return CONFIG.SERVER_URL;
};
