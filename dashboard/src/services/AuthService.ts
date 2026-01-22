/**
 * RemoteEye Dashboard - Authentication Service
 */

import { CONFIG, getServerUrl } from '../config';
import type { AuthResponse, Device, Recording } from '../types';

// API response types
interface RecordingsListResponse {
  recordings: Array<{
    id: string;
    device_id: string;
    type: 'audio' | 'photo';
    filename: string;
    duration?: number;
    size: number;
    triggered_by: string;
    created_at: string;
    metadata?: Record<string, unknown>;
  }>;
  pagination: {
    total: number;
    limit: number;
    offset: number;
  };
}

class AuthService {
  private token: string | null = null;
  private refreshToken: string | null = null;
  private controllerId: string | null = null;

  initialize(): boolean {
    this.token = localStorage.getItem(CONFIG.STORAGE_KEYS.TOKEN);
    this.refreshToken = localStorage.getItem(CONFIG.STORAGE_KEYS.REFRESH_TOKEN);
    this.controllerId = localStorage.getItem(CONFIG.STORAGE_KEYS.CONTROLLER_ID);
    return this.isAuthenticated();
  }

  async registerController(pairingCode: string, name: string): Promise<AuthResponse> {
    const serverUrl = getServerUrl();

    // First, look up the device_id from the pairing code
    const lookupResponse = await fetch(`${serverUrl}/api/auth/lookup-pairing/${pairingCode}`);

    if (!lookupResponse.ok) {
      const error = await lookupResponse.json();
      throw new Error(error.detail?.message || 'Invalid pairing code');
    }

    const lookupData = await lookupResponse.json();
    const deviceId = lookupData.device_id;

    if (!deviceId) {
      throw new Error('Device not registered yet. Please register the device first.');
    }

    // Now register the controller with the device_id
    const response = await fetch(`${serverUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        type: 'controller',
        device_id: deviceId,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail?.message || error.detail?.[0]?.msg || 'Registration failed');
    }

    const data: AuthResponse = await response.json();
    this.storeCredentials(data.controller_id || data.token, data.token, data.refresh_token);
    return data;
  }

  async loginWithToken(existingToken: string): Promise<boolean> {
    try {
      const serverUrl = getServerUrl();
      const response = await fetch(`${serverUrl}/api/health`, {
        headers: { Authorization: `Bearer ${existingToken}` },
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async refreshAccessToken(): Promise<boolean> {
    if (!this.refreshToken) return false;

    try {
      const serverUrl = getServerUrl();
      const response = await fetch(`${serverUrl}/api/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.refreshToken}`,
        },
      });

      if (!response.ok) return false;

      const data = await response.json();
      this.token = data.token;
      localStorage.setItem(CONFIG.STORAGE_KEYS.TOKEN, data.token);

      if (data.refresh_token) {
        this.refreshToken = data.refresh_token;
        localStorage.setItem(CONFIG.STORAGE_KEYS.REFRESH_TOKEN, data.refresh_token);
      }

      return true;
    } catch {
      return false;
    }
  }

  async getDevices(): Promise<Device[]> {
    const serverUrl = getServerUrl();
    const response = await fetch(`${serverUrl}/api/devices`, {
      headers: {
        Authorization: `Bearer ${this.token}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch devices');
    }

    const data = await response.json();
    return data.devices || [];
  }

  async getRecordings(deviceId: string, options?: {
    type?: 'audio' | 'photo';
    limit?: number;
    offset?: number;
  }): Promise<{ recordings: Recording[]; total: number }> {
    const serverUrl = getServerUrl();
    const params = new URLSearchParams({
      device_id: deviceId,
      limit: String(options?.limit ?? 20),
      offset: String(options?.offset ?? 0),
    });

    if (options?.type) {
      params.set('type', options.type);
    }

    const response = await fetch(`${serverUrl}/api/recordings?${params}`, {
      headers: {
        Authorization: `Bearer ${this.token}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch recordings');
    }

    const data: RecordingsListResponse = await response.json();

    // Transform API response to frontend Recording type
    const recordings: Recording[] = data.recordings.map((r) => {
      const metadata = r.metadata as Record<string, unknown> | undefined;
      const isUploadFailed = metadata?.status === 'upload_failed';

      return {
        id: r.id,
        deviceId: r.device_id,
        type: r.type,
        filename: r.filename,
        duration: r.duration,
        size: r.size,
        triggeredBy: r.triggered_by as 'sound_detection' | 'manual',
        createdAt: r.created_at,
        status: isUploadFailed ? 'upload_failed' : 'completed',
        metadata: metadata ? {
          status: metadata.status as string | undefined,
          error: metadata.error as string | undefined,
          dimensions: metadata.dimensions as { width: number; height: number } | undefined,
        } : undefined,
      };
    });

    return {
      recordings,
      total: data.pagination.total,
    };
  }

  getDownloadUrl(recordingId: string): string {
    const serverUrl = getServerUrl();
    return `${serverUrl}/api/recordings/${recordingId}/download`;
  }

  private storeCredentials(controllerId: string, token: string, refreshToken: string): void {
    this.controllerId = controllerId;
    this.token = token;
    this.refreshToken = refreshToken;

    localStorage.setItem(CONFIG.STORAGE_KEYS.CONTROLLER_ID, controllerId);
    localStorage.setItem(CONFIG.STORAGE_KEYS.TOKEN, token);
    localStorage.setItem(CONFIG.STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
  }

  clearCredentials(): void {
    this.controllerId = null;
    this.token = null;
    this.refreshToken = null;

    localStorage.removeItem(CONFIG.STORAGE_KEYS.CONTROLLER_ID);
    localStorage.removeItem(CONFIG.STORAGE_KEYS.TOKEN);
    localStorage.removeItem(CONFIG.STORAGE_KEYS.REFRESH_TOKEN);
  }

  getToken(): string | null {
    return this.token;
  }

  getControllerId(): string | null {
    return this.controllerId;
  }

  isAuthenticated(): boolean {
    return this.token !== null && this.controllerId !== null;
  }
}

export const authService = new AuthService();
