/**
 * RemoteEye Dashboard - Socket.IO Service
 * Handles WebSocket connection for controller
 */

import { io, Socket } from 'socket.io-client';
import { CONFIG, getServerUrl } from '../config';
import type {
  ConnectionState,
  DeviceStatus,
  CameraFrame,
  LocationData,
  CommandAction,
  CommandAck,
  Photo,
  AudioChunk,
} from '../types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type EventCallback = (data: any) => void;

class SocketService {
  private socket: Socket | null = null;
  private controllerId: string | null = null;
  private connectionState: ConnectionState = 'disconnected';
  private eventListeners: Map<string, Set<EventCallback>> = new Map();
  private selectedDeviceId: string | null = null;

  // Event emitter
  on(event: string, callback: EventCallback): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(callback);
  }

  off(event: string, callback: EventCallback): void {
    this.eventListeners.get(event)?.delete(callback);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private emit(event: string, data?: any): void {
    this.eventListeners.get(event)?.forEach((cb) => cb(data));
  }

  // Connection management
  async connect(controllerId: string, token: string): Promise<void> {
    this.controllerId = controllerId;

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

  private setupEventHandlers(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('[Socket] Connected');
      this.setConnectionState('connected');
      this.registerController();
    });

    this.socket.on('disconnect', (reason) => {
      console.log(`[Socket] Disconnected: ${reason}`);
      this.setConnectionState('disconnected');
    });

    this.socket.on('connect_error', (error) => {
      console.error('[Socket] Connection error:', error.message);
      this.emit('error', { code: 'CONNECTION_ERROR', message: error.message });
    });

    this.socket.io.on('reconnect_attempt', (attempt) => {
      console.log(`[Socket] Reconnection attempt ${attempt}`);
      this.setConnectionState('reconnecting');
    });

    this.socket.io.on('reconnect', () => {
      console.log('[Socket] Reconnected');
      this.setConnectionState('connected');
      this.registerController();
    });

    // Server events
    this.socket.on('server:device_status', (data: { deviceId: string; online: boolean; status?: DeviceStatus }) => {
      this.emit('deviceStatus', data);
    });

    this.socket.on('server:error', (data) => {
      console.error('[Socket] Server error:', data);
      this.emit('error', data);
    });

    // Device events (forwarded from devices)
    this.socket.on('device:frame', (data: { deviceId: string; frame: CameraFrame }) => {
      if (data.deviceId === this.selectedDeviceId) {
        this.emit('frame', data.frame);
      }
    });

    this.socket.on('device:location', (data: { deviceId: string; location: LocationData }) => {
      this.emit('location', { deviceId: data.deviceId, location: data.location });
    });

    this.socket.on('device:photo', (data: { deviceId: string; photo: Photo }) => {
      this.emit('photo', { deviceId: data.deviceId, photo: data.photo });
    });

    this.socket.on('device:audio', (data: { deviceId: string; audio: AudioChunk }) => {
      if (data.deviceId === this.selectedDeviceId) {
        this.emit('audio', data.audio);
      }
    });

    this.socket.on('device:command_ack', (data: CommandAck) => {
      this.emit('commandAck', data);
    });

    this.socket.on('device:sound_detected', (data) => {
      this.emit('soundDetected', data);
    });

    this.socket.on('device:recording_complete', (data) => {
      this.emit('recordingComplete', data);
    });

    this.socket.on('device:upload_failed', (data) => {
      console.warn('[Socket] Upload failed:', data);
      this.emit('uploadFailed', data);
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
    this.socket?.disconnect();
    this.socket = null;
    this.setConnectionState('disconnected');
  }

  // Controller registration
  private registerController(): void {
    if (!this.socket || !this.controllerId) return;

    const message = {
      type: 'controller:register',
      timestamp: new Date().toISOString(),
      controllerId: this.controllerId,
      targetDeviceId: this.selectedDeviceId,
    };

    this.socket.emit('controller:register', message);
    console.log('[Socket] Controller registered');
  }

  // Device selection
  selectDevice(deviceId: string | null): void {
    this.selectedDeviceId = deviceId;

    if (this.socket?.connected && deviceId) {
      // Re-register with new target device
      this.registerController();
    }
  }

  getSelectedDeviceId(): string | null {
    return this.selectedDeviceId;
  }

  // Send commands
  sendCommand(action: CommandAction, params?: Record<string, unknown>): string {
    if (!this.socket?.connected || !this.selectedDeviceId) {
      throw new Error('Not connected or no device selected');
    }

    const commandId = `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    this.socket.emit('controller:command', {
      type: 'controller:command',
      timestamp: new Date().toISOString(),
      commandId,
      targetDeviceId: this.selectedDeviceId,
      action,
      params,
    });

    console.log(`[Socket] Command sent: ${action}`);
    return commandId;
  }

  // Convenience methods for common commands
  startCamera(quality?: 'low' | 'medium' | 'high', fps?: number): string {
    return this.sendCommand('start_camera', { quality, fps });
  }

  stopCamera(): string {
    return this.sendCommand('stop_camera');
  }

  switchCamera(position?: 'front' | 'back'): string {
    return this.sendCommand('switch_camera', position ? { position } : undefined);
  }

  capturePhoto(): string {
    return this.sendCommand('capture_photo');
  }

  startAudio(): string {
    return this.sendCommand('start_audio');
  }

  stopAudio(): string {
    return this.sendCommand('stop_audio');
  }

  getLocation(): string {
    return this.sendCommand('get_location');
  }

  getStatus(): string {
    return this.sendCommand('get_status');
  }

  enableSoundDetection(): string {
    return this.sendCommand('enable_sound_detection');
  }

  disableSoundDetection(): string {
    return this.sendCommand('disable_sound_detection');
  }

  setSoundThreshold(threshold: number, duration?: number): string {
    return this.sendCommand('set_sound_threshold', { threshold, duration });
  }

  // Send a high-level command to a device via the HTTP API (silent push)
  async sendCommandToDevice(
    deviceId: string,
    action: string,
    params?: Record<string, unknown>,
  ): Promise<{ success: boolean; status?: string; message?: string }> {
    const serverUrl = getServerUrl();
    try {
      const response = await fetch(`${serverUrl}/api/devices/${deviceId}/command`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action, params }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('[Socket] Command failed:', data);
        return {
          success: false,
          status: data.status ?? 'error',
          message: data.message ?? 'Failed to send command',
        };
      }

      console.log(`[Socket] Command '${action}' sent. Server response:`, data);
      return { success: true, status: data.status, message: data.message };
    } catch (error) {
      console.error(`[Socket] Failed to send command '${action}':`, error);
      return {
        success: false,
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // Ping device via silent push notification (for waking up offline devices)
  async pingDevice(deviceId: string): Promise<{ success: boolean; status?: string; message?: string }> {
    const serverUrl = getServerUrl();
    try {
      const response = await fetch(`${serverUrl}/api/devices/${deviceId}/ping`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('[Socket] Ping failed:', data);
        return {
          success: false,
          status: data.status ?? 'error',
          message: data.detail ?? data.message ?? 'Failed to ping device',
        };
      }

      console.log('[Socket] Ping sent. Server response:', data);
      return { success: true, status: data.status, message: data.message };
    } catch (error) {
      console.error('[Socket] Failed to ping device:', error);
      return {
        success: false,
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

}

export const socketService = new SocketService();
