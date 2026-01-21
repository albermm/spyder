/**
 * AuthService Tests
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { CONFIG } from '../../src/config';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

// Mock fetch
global.fetch = jest.fn();

// Import after mocks
import { authService } from '../../src/services/AuthService';

describe('AuthService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
    (AsyncStorage.removeItem as jest.Mock).mockResolvedValue(undefined);
  });

  describe('initialize', () => {
    it('should return false when no stored credentials', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

      const result = await authService.initialize();

      expect(result).toBe(false);
      expect(AsyncStorage.getItem).toHaveBeenCalledWith(CONFIG.STORAGE_KEYS.TOKEN);
      expect(AsyncStorage.getItem).toHaveBeenCalledWith(CONFIG.STORAGE_KEYS.REFRESH_TOKEN);
      expect(AsyncStorage.getItem).toHaveBeenCalledWith(CONFIG.STORAGE_KEYS.DEVICE_ID);
    });

    it('should return true when all credentials exist', async () => {
      (AsyncStorage.getItem as jest.Mock)
        .mockResolvedValueOnce('test-token')
        .mockResolvedValueOnce('test-refresh-token')
        .mockResolvedValueOnce('test-device-id');

      const result = await authService.initialize();

      expect(result).toBe(true);
    });
  });

  describe('requestPairingCode', () => {
    it('should return pairing code on success', async () => {
      const mockResponse = {
        success: true,
        pairing_code: 'ABC123',
        expires_at: '2026-01-21T12:00:00Z',
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await authService.requestPairingCode();

      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/auth/pair'),
        expect.objectContaining({ method: 'POST' })
      );
    });

    it('should throw error on failure', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({
          error: { message: 'Server error' },
        }),
      });

      await expect(authService.requestPairingCode()).rejects.toThrow('Server error');
    });
  });

  describe('registerDevice', () => {
    it('should store credentials on successful registration', async () => {
      const mockResponse = {
        success: true,
        token: 'new-token',
        refresh_token: 'new-refresh-token',
        expires_in: 3600,
        device_id: 'new-device-id',
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await authService.registerDevice('ABC123', 'My iPhone');

      expect(result).toEqual(mockResponse);
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        CONFIG.STORAGE_KEYS.DEVICE_ID,
        'new-device-id'
      );
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        CONFIG.STORAGE_KEYS.TOKEN,
        'new-token'
      );
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        CONFIG.STORAGE_KEYS.REFRESH_TOKEN,
        'new-refresh-token'
      );
    });
  });

  describe('isAuthenticated', () => {
    it('should return false when not authenticated', () => {
      expect(authService.isAuthenticated()).toBe(false);
    });
  });

  describe('clearCredentials', () => {
    it('should remove all stored credentials', async () => {
      await authService.clearCredentials();

      expect(AsyncStorage.removeItem).toHaveBeenCalledWith(CONFIG.STORAGE_KEYS.DEVICE_ID);
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith(CONFIG.STORAGE_KEYS.TOKEN);
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith(CONFIG.STORAGE_KEYS.REFRESH_TOKEN);
    });
  });
});
