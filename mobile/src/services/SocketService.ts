/**
 * RemoteEye Mobile - Socket.IO Service
 * Handles WebSocket connection with auto-reconnect
 */

import { io, Socket } from 'socket.io-client';
import DeviceInfo from 'react-native-device-info';
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
