/**
 * LocationService Tests
 */

import Geolocation from '@react-native-community/geolocation';
import { PermissionsAndroid, Platform } from 'react-native';

// Mock Geolocation
jest.mock('@react-native-community/geolocation', () => ({
  setRNConfiguration: jest.fn(),
  getCurrentPosition: jest.fn(),
  watchPosition: jest.fn(() => 1),
  clearWatch: jest.fn(),
}));

// Mock PermissionsAndroid
jest.mock('react-native', () => ({
  Platform: { OS: 'ios', Version: 17 },
  PermissionsAndroid: {
    request: jest.fn(() => Promise.resolve('granted')),
    PERMISSIONS: {
      ACCESS_FINE_LOCATION: 'android.permission.ACCESS_FINE_LOCATION',
      ACCESS_BACKGROUND_LOCATION: 'android.permission.ACCESS_BACKGROUND_LOCATION',
    },
    RESULTS: {
      GRANTED: 'granted',
    },
  },
}));

// Mock socketService
jest.mock('../../src/services/SocketService', () => ({
  socketService: {
    sendLocation: jest.fn(),
  },
}));

import { locationService } from '../../src/services/LocationService';
import { socketService } from '../../src/services/SocketService';

describe('LocationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('requestPermissions', () => {
    it('should return true on iOS (handled by Info.plist)', async () => {
      const result = await locationService.requestPermissions();
      expect(result).toBe(true);
    });
  });

  describe('setUpdateInterval', () => {
    it('should update the interval', () => {
      locationService.setUpdateInterval(600);
      expect(locationService.getUpdateInterval()).toBe(600);
    });
  });

  describe('startTracking', () => {
    it('should configure geolocation and start watching', async () => {
      (Geolocation.getCurrentPosition as jest.Mock).mockImplementation((success) => {
        success({
          coords: {
            latitude: 37.7749,
            longitude: -122.4194,
            altitude: 10,
            accuracy: 5,
            speed: 0,
            heading: 0,
          },
        });
      });

      await locationService.startTracking();

      expect(Geolocation.setRNConfiguration).toHaveBeenCalled();
      expect(Geolocation.watchPosition).toHaveBeenCalled();
      expect(locationService.isCurrentlyTracking()).toBe(true);
    });
  });

  describe('stopTracking', () => {
    it('should stop tracking and clear watch', async () => {
      // Start tracking first
      (Geolocation.getCurrentPosition as jest.Mock).mockImplementation((success) => {
        success({
          coords: {
            latitude: 37.7749,
            longitude: -122.4194,
            altitude: 10,
            accuracy: 5,
            speed: 0,
            heading: 0,
          },
        });
      });

      await locationService.startTracking();
      locationService.stopTracking();

      expect(Geolocation.clearWatch).toHaveBeenCalled();
      expect(locationService.isCurrentlyTracking()).toBe(false);
    });
  });

  describe('getCurrentLocation', () => {
    it('should return location data and send via socket', async () => {
      const mockPosition = {
        coords: {
          latitude: 37.7749,
          longitude: -122.4194,
          altitude: 10,
          accuracy: 5,
          speed: 1.5,
          heading: 90,
        },
      };

      (Geolocation.getCurrentPosition as jest.Mock).mockImplementation((success) => {
        success(mockPosition);
      });

      const location = await locationService.getCurrentLocation();

      expect(location).toEqual({
        latitude: 37.7749,
        longitude: -122.4194,
        altitude: 10,
        accuracy: 5,
        speed: 1.5,
        heading: 90,
      });
      expect(socketService.sendLocation).toHaveBeenCalledWith(location);
    });

    it('should return null on error', async () => {
      (Geolocation.getCurrentPosition as jest.Mock).mockImplementation((_, error) => {
        error({ message: 'Location unavailable' });
      });

      const location = await locationService.getCurrentLocation();
      expect(location).toBeNull();
    });
  });

  describe('getLastLocation', () => {
    it('should return last known location', async () => {
      const mockPosition = {
        coords: {
          latitude: 40.7128,
          longitude: -74.006,
          altitude: 5,
          accuracy: 10,
          speed: 0,
          heading: 0,
        },
      };

      (Geolocation.getCurrentPosition as jest.Mock).mockImplementation((success) => {
        success(mockPosition);
      });

      await locationService.getCurrentLocation();
      const lastLocation = locationService.getLastLocation();

      expect(lastLocation).toEqual({
        latitude: 40.7128,
        longitude: -74.006,
        altitude: 5,
        accuracy: 10,
        speed: 0,
        heading: 0,
      });
    });
  });
});
