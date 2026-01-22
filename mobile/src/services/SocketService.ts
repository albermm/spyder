/**
 * RemoteEye Mobile - Socket.IO Service
 * Handles WebSocket connection with auto-reconnect and self-healing token refresh.
 *
 * This service is designed for headless operation:
 * - Automatically refreshes expired tokens before connecting
 * - Retries connection with refreshed tokens on 401 errors
 * - Clears credentials and enters "unpaired" state if refresh fails
 */

import { io, Socket } from 'socket.io-client';
import DeviceInfo from 'react-native-device-info';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CONFIG, getServerUrl } from '../config';
import type {
  ConnectionState,
  DeviceInfo as DeviceInfoType,
  DeviceStatus,
  CameraFrame,
  AudioChunk,
  PhotoData,
  LocationData,
  SoundDetection,
  RecordingInfo,
  Command,
  CommandStatus,
} from '../types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type EventCallback = (...args: any[]) => void;

class SocketService {
  private socket: Socket | null = null;
  private deviceId: string | null = null;
  private token: string | null = null;
  private connectionState: ConnectionState = 'disconnected';
  private eventListeners: Map<string, Set<EventCallback>> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private frameSequence: number = 0;
  private audioSequence: number = 0;
  private isRefreshingToken: boolean = false;

  // Event emitter methods
  on(event: string, callback: EventCallback): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(callback);
  }

  off(event: string, callback: EventCallback): void {
    this.eventListeners.get(event)?.delete(callback);
  }

  private emit(event: string, ...args: unknown[]): void {
    this.eventListeners.get(event)?.forEach((cb) => cb(...args));
  }

  // Connection management
  async connect(deviceId: string, token: string): Promise<void> {
    this.deviceId = deviceId;
    this.token = token;

    if (this.socket?.connected) {
      console.log('[Socket] Already connected');
      return;
    }

    this.setConnectionState('connecting');

    const serverUrl = getServerUrl();
    console.log(`[Socket] Connecting to ${serverUrl}`);

    this.socket = io(serverUrl, {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: CONFIG.SOCKET_RECONNECTION_ATTEMPTS,
      reconnectionDelay: CONFIG.SOCKET_RECONNECTION_DELAY,
      reconnectionDelayMax: CONFIG.SOCKET_RECONNECTION_DELAY_MAX,
    });

    this.setupEventHandlers();
  }

  /**
   * Self-healing connection method for headless operation.
   * Retrieves credentials from storage, refreshes token if needed,
   * and handles authentication failures gracefully.
   */
  async connectWithAutoRefresh(): Promise<void> {
    console.log('[Socket] Connecting with auto-refresh...');

    try {
      // Step 1: Retrieve credentials from storage
      const [token, refreshToken, deviceId] = await Promise.all([
        AsyncStorage.getItem(CONFIG.STORAGE_KEYS.TOKEN),
        AsyncStorage.getItem(CONFIG.STORAGE_KEYS.REFRESH_TOKEN),
        AsyncStorage.getItem(CONFIG.STORAGE_KEYS.DEVICE_ID),
      ]);

      if (!token || !deviceId) {
        console.error('[Socket] No credentials found. Device not paired.');
        this.emit('authError', { code: 'NOT_PAIRED', message: 'Device not paired' });
        return;
      }

      this.deviceId = deviceId;
      this.token = token;

      // Step 2: Attempt connection
      await this.attemptConnection(token);

    } catch (error) {
      console.error('[Socket] Connection with auto-refresh failed:', error);
      this.emit('error', { code: 'CONNECTION_FAILED', message: String(error) });
    }
  }

  /**
   * Attempt WebSocket connection with error handling for 401.
   */
  private async attemptConnection(token: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.socket?.connected) {
        console.log('[Socket] Already connected');
        resolve();
        return;
      }

      this.setConnectionState('connecting');

      const serverUrl = getServerUrl();
      console.log(`[Socket] Attempting connection to ${serverUrl}`);

      this.socket = io(serverUrl, {
        auth: { token },
        transports: ['websocket'],
        reconnection: true,
        reconnectionAttempts: CONFIG.SOCKET_RECONNECTION_ATTEMPTS,
        reconnectionDelay: CONFIG.SOCKET_RECONNECTION_DELAY,
        reconnectionDelayMax: CONFIG.SOCKET_RECONNECTION_DELAY_MAX,
      });

      // Handle successful connection
      const onConnect = () => {
        console.log('[Socket] Connected successfully');
        this.setConnectionState('connected');
        this.registerDevice();
        this.startHeartbeat();
        cleanup();
        resolve();
      };

      // Handle connection error (including 401)
      const onConnectError = async (error: Error) => {
        console.error('[Socket] Connection error:', error.message);

        // Check if it's an authentication error (401)
        if (error.message.includes('401') || error.message.includes('unauthorized') || error.message.includes('Unauthorized')) {
          console.log('[Socket] Authentication error detected. Attempting token refresh...');
          cleanup();

          // Try to refresh token and reconnect
          const refreshed = await this.handleTokenRefresh();
          if (refreshed) {
            resolve(); // Token refreshed and reconnected
          } else {
            reject(new Error('Token refresh failed'));
          }
        } else {
          // Non-auth error, let socket.io handle reconnection
          this.emit('error', { code: 'CONNECTION_ERROR', message: error.message });
        }
      };

      const cleanup = () => {
        this.socket?.off('connect', onConnect);
        this.socket?.off('connect_error', onConnectError);
      };

      this.socket.once('connect', onConnect);
      this.socket.once('connect_error', onConnectError);

      // Setup remaining event handlers
      this.setupEventHandlers();
    });
  }

  /**
   * Handle token refresh when authentication fails.
   * Returns true if refresh and reconnection succeeded.
   */
  private async handleTokenRefresh(): Promise<boolean> {
    if (this.isRefreshingToken) {
      console.log('[Socket] Token refresh already in progress...');
      return false;
    }

    this.isRefreshingToken = true;

    try {
      // Disconnect existing socket
      this.socket?.disconnect();
      this.socket = null;

      // Get refresh token
      const refreshToken = await AsyncStorage.getItem(CONFIG.STORAGE_KEYS.REFRESH_TOKEN);
      if (!refreshToken) {
        console.error('[Socket] No refresh token available');
        await this.handleAuthFailure();
        return false;
      }

      // Attempt token refresh
      console.log('[Socket] Refreshing access token...');
      const serverUrl = getServerUrl();
      const response = await fetch(`${serverUrl}/api/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      if (!response.ok) {
        console.error('[Socket] Token refresh failed with status:', response.status);
        if (response.status === 401) {
          // Refresh token is also invalid
          await this.handleAuthFailure();
        }
        return false;
      }

      const data = await response.json();
      console.log('[Socket] Token refreshed successfully');

      // Store new tokens
      this.token = data.token;
      await AsyncStorage.setItem(CONFIG.STORAGE_KEYS.TOKEN, data.token);

      if (data.refresh_token) {
        await AsyncStorage.setItem(CONFIG.STORAGE_KEYS.REFRESH_TOKEN, data.refresh_token);
      }

      // Reconnect with new token
      console.log('[Socket] Reconnecting with new token...');
      await this.attemptConnection(data.token);
      return true;

    } catch (error) {
      console.error('[Socket] Token refresh error:', error);
      return false;
    } finally {
      this.isRefreshingToken = false;
    }
  }

  /**
   * Handle complete authentication failure.
   * Clears all credentials and puts app in "unpaired" state.
   */
  private async handleAuthFailure(): Promise<void> {
    console.error('[Socket] Authentication failed completely. Clearing credentials.');

    // Clear all stored credentials
    await Promise.all([
      AsyncStorage.removeItem(CONFIG.STORAGE_KEYS.TOKEN),
      AsyncStorage.removeItem(CONFIG.STORAGE_KEYS.REFRESH_TOKEN),
      AsyncStorage.removeItem(CONFIG.STORAGE_KEYS.DEVICE_ID),
    ]);

    this.token = null;
    this.deviceId = null;
    this.setConnectionState('disconnected');

    // Emit event so app can handle this (e.g., show error, wait for setup mode)
    this.emit('authError', {
      code: 'AUTH_FAILED',
      message: 'Authentication failed. Device needs to be re-paired. Please enter setup mode.',
    });
  }

  private setupEventHandlers(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('[Socket] Connected');
      this.setConnectionState('connected');
      this.registerDevice();
      this.startHeartbeat();
    });

    this.socket.on('disconnect', (reason) => {
      console.log(`[Socket] Disconnected: ${reason}`);
      this.setConnectionState('disconnected');
      this.stopHeartbeat();
    });

    this.socket.on('connect_error', (error) => {
      console.error(`[Socket] Connection error:`, error.message);
      this.emit('error', { code: 'CONNECTION_ERROR', message: error.message });
    });

    this.socket.io.on('reconnect_attempt', (attempt) => {
      console.log(`[Socket] Reconnection attempt ${attempt}`);
      this.setConnectionState('reconnecting');
    });

    this.socket.io.on('reconnect', () => {
      console.log('[Socket] Reconnected');
      this.setConnectionState('connected');
      this.registerDevice();
      this.startHeartbeat();
    });

    // Server events
    this.socket.on('server:error', (data) => {
      console.error('[Socket] Server error:', data);
      this.emit('error', data);
    });

    this.socket.on('server:heartbeat_ack', () => {
      // Heartbeat acknowledged
    });

    // Command from server (forwarded from controller)
    this.socket.on('controller:command', (data: Command) => {
      console.log('[Socket] Received command:', data.action);
      this.emit('command', data);
      this.sendCommandAck(data.commandId, 'received');
    });
  }

  private setConnectionState(state: ConnectionState): void {
    this.connectionState = state;
    this.emit('connectionStateChange', state);
  }

  getConnectionState(): ConnectionState {
    return this.connectionState;
  }

  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }

  disconnect(): void {
    this.stopHeartbeat();
    this.socket?.disconnect();
    this.socket = null;
    this.setConnectionState('disconnected');
  }

  // Device registration
  private async registerDevice(): Promise<void> {
    if (!this.socket || !this.deviceId) return;

    const deviceInfo: DeviceInfoType = {
      name: await DeviceInfo.getDeviceName(),
      model: DeviceInfo.getModel(),
      osVersion: DeviceInfo.getSystemVersion(),
      appVersion: CONFIG.APP_VERSION,
    };

    const message = {
      type: 'device:register',
      timestamp: new Date().toISOString(),
      deviceId: this.deviceId,
      deviceInfo,
    };

    this.socket.emit('device:register', message);
    console.log('[Socket] Device registered');
  }

  // Heartbeat
  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatInterval = setInterval(() => {
      if (this.socket?.connected && this.deviceId) {
        this.socket.emit('device:heartbeat', {
          type: 'device:heartbeat',
          timestamp: new Date().toISOString(),
          deviceId: this.deviceId,
        });
      }
    }, CONFIG.HEARTBEAT_INTERVAL);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  // Public heartbeat method (for push notification wake-up)
  sendHeartbeat(): void {
    if (this.socket?.connected && this.deviceId) {
      this.socket.emit('device:heartbeat', {
        type: 'device:heartbeat',
        timestamp: new Date().toISOString(),
        deviceId: this.deviceId,
      });
      console.log('[Socket] Heartbeat sent');
    }
  }

  // Report device status proactively
  reportStatus(status: string, details?: Record<string, unknown>): void {
    if (this.socket?.connected && this.deviceId) {
      this.socket.emit('device_status', {
        deviceId: this.deviceId,
        status, // e.g., 'online', 'recording', 'streaming', 'error'
        details, // e.g., { batteryLevel: 0.85, storage: '2.3GB' }
        timestamp: new Date().toISOString(),
      });
      console.log(`[Socket] Status reported: ${status}`);
    }
  }

  // Send methods
  sendStatus(status: DeviceStatus): void {
    if (!this.socket?.connected || !this.deviceId) return;

    this.socket.emit('device:status', {
      type: 'device:status',
      timestamp: new Date().toISOString(),
      deviceId: this.deviceId,
      status,
    });
  }

  sendFrame(frame: Omit<CameraFrame, 'sequence'>): void {
    if (!this.socket?.connected || !this.deviceId) return;

    this.socket.emit('device:frame', {
      type: 'device:frame',
      timestamp: new Date().toISOString(),
      deviceId: this.deviceId,
      frame: {
        ...frame,
        sequence: this.frameSequence++,
      },
    });
  }

  sendAudioChunk(audio: Omit<AudioChunk, 'sequence'>): void {
    if (!this.socket?.connected || !this.deviceId) return;

    this.socket.emit('device:audio', {
      type: 'device:audio',
      timestamp: new Date().toISOString(),
      deviceId: this.deviceId,
      audio: {
        ...audio,
        sequence: this.audioSequence++,
      },
    });
  }

  sendPhoto(photo: PhotoData): void {
    if (!this.socket?.connected || !this.deviceId) return;

    this.socket.emit('device:photo', {
      type: 'device:photo',
      timestamp: new Date().toISOString(),
      deviceId: this.deviceId,
      photo,
    });
  }

  sendLocation(location: LocationData): void {
    if (!this.socket?.connected || !this.deviceId) return;

    this.socket.emit('device:location', {
      type: 'device:location',
      timestamp: new Date().toISOString(),
      deviceId: this.deviceId,
      location,
    });
  }

  sendSoundDetected(detection: SoundDetection): void {
    if (!this.socket?.connected || !this.deviceId) return;

    this.socket.emit('device:sound_detected', {
      type: 'device:sound_detected',
      timestamp: new Date().toISOString(),
      deviceId: this.deviceId,
      detection,
    });
  }

  sendRecordingComplete(recording: RecordingInfo): void {
    if (!this.socket?.connected || !this.deviceId) return;

    this.socket.emit('device:recording_complete', {
      type: 'device:recording_complete',
      timestamp: new Date().toISOString(),
      deviceId: this.deviceId,
      recording,
    });
  }

  /**
   * Notify server that a media upload to R2 failed.
   * This closes the reliability gap where uploads could fail silently.
   */
  sendUploadFailed(data: {
    recordingId: string;
    mediaType: 'audio' | 'photo';
    error: string;
    filename?: string;
  }): void {
    if (!this.socket?.connected || !this.deviceId) return;

    this.socket.emit('device:upload_failed', {
      type: 'device:upload_failed',
      timestamp: new Date().toISOString(),
      deviceId: this.deviceId,
      ...data,
    });
    console.log(`[Socket] Upload failure reported: ${data.mediaType} - ${data.recordingId}`);
  }

  /**
   * Notify server that a photo was successfully uploaded to R2.
   * Used for direct client-to-R2 photo uploads (unified flow with audio).
   */
  sendPhotoComplete(data: {
    recordingId: string;
    storageKey: string;
    filename: string;
    size: number;
    width?: number;
    height?: number;
  }): void {
    if (!this.socket?.connected || !this.deviceId) return;

    this.socket.emit('device:photo_complete', {
      type: 'device:photo_complete',
      timestamp: new Date().toISOString(),
      deviceId: this.deviceId,
      ...data,
    });
    console.log(`[Socket] Photo upload complete: ${data.storageKey}`);
  }

  /**
   * Notify server that an audio recording was successfully uploaded to R2.
   * This replaces the old sendRecordingComplete for audio uploads.
   */
  sendAudioUploadComplete(data: {
    recordingId: string;
    storageKey: string;
    filename: string;
    size: number;
    duration: number;
    triggeredBy: 'manual' | 'sound_detection';
  }): void {
    if (!this.socket?.connected || !this.deviceId) return;

    this.socket.emit('device:audio_complete', {
      type: 'device:audio_complete',
      timestamp: new Date().toISOString(),
      deviceId: this.deviceId,
      ...data,
    });
    console.log(`[Socket] Audio upload complete: ${data.storageKey}`);
  }

  sendCommandAck(commandId: string, status: CommandStatus, error?: string): void {
    if (!this.socket?.connected || !this.deviceId) return;

    this.socket.emit('device:command_ack', {
      type: 'device:command_ack',
      timestamp: new Date().toISOString(),
      deviceId: this.deviceId,
      commandId,
      status,
      error,
    });
  }

  // Reset sequences (for new streaming sessions)
  resetFrameSequence(): void {
    this.frameSequence = 0;
  }

  resetAudioSequence(): void {
    this.audioSequence = 0;
  }
}

// Export singleton instance
export const socketService = new SocketService();
