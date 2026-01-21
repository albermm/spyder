/**
 * RemoteEye Dashboard - Authentication Service
 */

import { CONFIG, getServerUrl } from '../config';
import type { AuthResponse, Device } from '../types';

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
