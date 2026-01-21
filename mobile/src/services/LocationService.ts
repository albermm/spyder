/**
 * RemoteEye Mobile - Location Service
 * Handles GPS location tracking
 */

import Geolocation, {
  GeolocationResponse,
  GeolocationError,
} from '@react-native-community/geolocation';
import { Platform, PermissionsAndroid } from 'react-native';
import { CONFIG } from '../config';
import { socketService } from './SocketService';
import type { LocationData } from '../types';

class LocationService {
  private isTracking: boolean = false;
  private watchId: number | null = null;
  private updateInterval: number = CONFIG.LOCATION_UPDATE_INTERVAL;
  private lastLocation: LocationData | null = null;
  private updateTimer: NodeJS.Timeout | null = null;

  // Permission handling
  async requestPermissions(): Promise<boolean> {
    if (Platform.OS === 'android') {
      const fineLocation = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        {
          title: 'Location Permission',
          message: 'RemoteEye needs access to your location for tracking.',
          buttonNeutral: 'Ask Me Later',
          buttonNegative: 'Cancel',
          buttonPositive: 'OK',
        }
      );

      if (fineLocation !== PermissionsAndroid.RESULTS.GRANTED) {
        return false;
      }

      // Also request background location for Android 10+
      if (Platform.Version >= 29) {
        const background = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION,
          {
            title: 'Background Location Permission',
            message: 'RemoteEye needs background location access for continuous tracking.',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          }
        );
        return background === PermissionsAndroid.RESULTS.GRANTED;
      }

      return true;
    }

    // iOS handles permissions via Info.plist
    return true;
  }

  // Settings
  setUpdateInterval(seconds: number): void {
    this.updateInterval = seconds;
    // Restart tracking if already active
    if (this.isTracking) {
      this.stopTracking();
      this.startTracking();
    }
  }

  getUpdateInterval(): number {
    return this.updateInterval;
  }

  // Tracking control
  async startTracking(): Promise<void> {
    if (this.isTracking) {
      console.log('[Location] Already tracking');
      return;
    }

    this.isTracking = true;
    console.log(`[Location] Starting tracking with ${this.updateInterval}s interval`);

    // Configure geolocation
    Geolocation.setRNConfiguration({
      skipPermissionRequests: false,
      authorizationLevel: 'always',
      locationProvider: 'auto',
    });

    // Get initial location
    await this.getCurrentLocation();

    // Set up periodic updates
    this.updateTimer = setInterval(() => {
      this.getCurrentLocation();
    }, this.updateInterval * 1000);

    // Also watch for significant location changes
    this.watchId = Geolocation.watchPosition(
      this.handleLocationUpdate.bind(this),
      this.handleLocationError.bind(this),
      {
        enableHighAccuracy: true,
        distanceFilter: CONFIG.LOCATION_DISTANCE_FILTER,
        interval: this.updateInterval * 1000,
        fastestInterval: 5000,
      }
    );
  }

  stopTracking(): void {
    if (!this.isTracking) return;

    this.isTracking = false;

    if (this.watchId !== null) {
      Geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }

    if (this.updateTimer) {
      clearInterval(this.updateTimer);
      this.updateTimer = null;
    }

    console.log('[Location] Tracking stopped');
  }

  isCurrentlyTracking(): boolean {
    return this.isTracking;
  }

  // Get current location
  async getCurrentLocation(): Promise<LocationData | null> {
    return new Promise((resolve) => {
      Geolocation.getCurrentPosition(
        (position) => {
          const location = this.positionToLocationData(position);
          this.lastLocation = location;
          socketService.sendLocation(location);
          resolve(location);
        },
        (error) => {
          console.error('[Location] Get current position error:', error);
          resolve(null);
        },
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 10000,
        }
      );
    });
  }

  getLastLocation(): LocationData | null {
    return this.lastLocation;
  }

  private handleLocationUpdate(position: GeolocationResponse): void {
    const location = this.positionToLocationData(position);
    this.lastLocation = location;
    socketService.sendLocation(location);
  }

  private handleLocationError(error: GeolocationError): void {
    console.error('[Location] Watch error:', error.message);
  }

  private positionToLocationData(position: GeolocationResponse): LocationData {
    return {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      altitude: position.coords.altitude ?? 0,
      accuracy: position.coords.accuracy,
      speed: position.coords.speed ?? 0,
      heading: position.coords.heading ?? 0,
    };
  }

  // Cleanup
  destroy(): void {
    this.stopTracking();
  }
}

export const locationService = new LocationService();
