/**
 * RemoteEye Mobile - Authentication Service
 * Handles device registration and token management
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { CONFIG, getServerUrl } from '../config';
import type { AuthResponse, PairingResponse, ApiError } from '../types';

class AuthService {
  private token: string | null = null;
  private refreshToken: string | null = null;
  private deviceId: string | null = null;
  private tokenExpiry: number = 0;

  async initialize(): Promise<boolean> {
    try {
      const [token, refreshToken, deviceId] = await Promise.all([
        AsyncStorage.getItem(CONFIG.STORAGE_KEYS.TOKEN),
        AsyncStorage.getItem(CONFIG.STORAGE_KEYS.REFRESH_TOKEN),
        AsyncStorage.getItem(CONFIG.STORAGE_KEYS.DEVICE_ID),
      ]);

      if (token && refreshToken && deviceId) {
        this.token = token;
        this.refreshToken = refreshToken;
        this.deviceId = deviceId;
        return true;
      }
      return false;
    } catch (error) {
      console.error('[Auth] Failed to load stored credentials:', error);
      return false;
    }
  }

  async requestPairingCode(): Promise<PairingResponse> {
    const serverUrl = getServerUrl();
    const response = await fetch(`${serverUrl}/api/auth/pair`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      const error: ApiError = await response.json();
      throw new Error(error.error?.message || 'Failed to generate pairing code');
    }

    return response.json();
  }

  async registerDevice(pairingCode: string, deviceName: string): Promise<AuthResponse> {
    const serverUrl = getServerUrl();
    const response = await fetch(`${serverUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: deviceName,
        type: 'device',
        pairing_code: pairingCode,
      }),
    });

    if (!response.ok) {
      const error: ApiError = await response.json();
      throw new Error(error.error?.message || 'Failed to register device');
    }

    const data: AuthResponse = await response.json();

    // Store credentials
    await this.storeCredentials(data.device_id, data.token, data.refresh_token);
    this.tokenExpiry = Date.now() + data.expires_in * 1000;

    return data;
  }

  async refreshAccessToken(): Promise<boolean> {
    if (!this.refreshToken) {
      console.error('[Auth] No refresh token available');
      return false;
    }

    try {
      const serverUrl = getServerUrl();
      const response = await fetch(`${serverUrl}/api/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refresh_token: this.refreshToken }),
      });

      if (!response.ok) {
        console.error('[Auth] Token refresh failed');
        return false;
      }

      const data = await response.json();
      this.token = data.token;
      this.tokenExpiry = Date.now() + data.expires_in * 1000;

      await AsyncStorage.setItem(CONFIG.STORAGE_KEYS.TOKEN, data.token);

      if (data.refresh_token) {
        this.refreshToken = data.refresh_token;
        await AsyncStorage.setItem(CONFIG.STORAGE_KEYS.REFRESH_TOKEN, data.refresh_token);
      }

      return true;
    } catch (error) {
      console.error('[Auth] Token refresh error:', error);
      return false;
    }
  }

  private async storeCredentials(
    deviceId: string,
    token: string,
    refreshToken: string
  ): Promise<void> {
    this.deviceId = deviceId;
    this.token = token;
    this.refreshToken = refreshToken;

    await Promise.all([
      AsyncStorage.setItem(CONFIG.STORAGE_KEYS.DEVICE_ID, deviceId),
      AsyncStorage.setItem(CONFIG.STORAGE_KEYS.TOKEN, token),
      AsyncStorage.setItem(CONFIG.STORAGE_KEYS.REFRESH_TOKEN, refreshToken),
    ]);
  }

  async clearCredentials(): Promise<void> {
    this.deviceId = null;
    this.token = null;
    this.refreshToken = null;
    this.tokenExpiry = 0;

    await Promise.all([
      AsyncStorage.removeItem(CONFIG.STORAGE_KEYS.DEVICE_ID),
      AsyncStorage.removeItem(CONFIG.STORAGE_KEYS.TOKEN),
      AsyncStorage.removeItem(CONFIG.STORAGE_KEYS.REFRESH_TOKEN),
    ]);
  }

  getToken(): string | null {
    return this.token;
  }

  getDeviceId(): string | null {
    return this.deviceId;
  }

  isAuthenticated(): boolean {
    return this.token !== null && this.deviceId !== null;
  }

  isTokenExpired(): boolean {
    // Add 30 second buffer
    return Date.now() >= this.tokenExpiry - 30000;
  }

  async ensureValidToken(): Promise<string | null> {
    if (!this.token) return null;

    if (this.isTokenExpired()) {
      const refreshed = await this.refreshAccessToken();
      if (!refreshed) return null;
    }

    return this.token;
  }
}

export const authService = new AuthService();
