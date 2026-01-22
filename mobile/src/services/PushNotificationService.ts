/**
 * RemoteEye Mobile - Push Notification Service
 * Handles FCM registration and silent push notifications for device wake-up
 */

import messaging, { FirebaseMessagingTypes } from '@react-native-firebase/messaging';
import { Platform, AppState } from 'react-native';
import { socketService } from './SocketService';
import { authService } from './AuthService';
import { audioService } from './AudioService';
import { cameraService } from './CameraService';
import { CONFIG } from '../config';

class PushNotificationService {
  private fcmToken: string | null = null;
  private isInitialized: boolean = false;
  private appStateSubscription: any = null;

  /**
   * Initialize the push notification service
   * Should be called after user authentication
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log('[Push] Already initialized');
      return;
    }

    try {
      // Request permission (required for iOS)
      const authStatus = await messaging().requestPermission();
      const enabled =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;

      if (!enabled) {
        console.log('[Push] Permission not granted');
        return;
      }

      console.log('[Push] Permission granted:', authStatus);

      // Get FCM token
      await this.getAndRegisterToken();

      // Listen for token refresh
      messaging().onTokenRefresh(async (token) => {
        console.log('[Push] Token refreshed');
        this.fcmToken = token;
        await this.registerTokenWithServer(token);
      });

      // Handle foreground messages
      messaging().onMessage(async (remoteMessage) => {
        console.log('[Push] Foreground message received:', remoteMessage);
        await this.handleMessage(remoteMessage);
      });

      // Handle background messages (when app is in background)
      messaging().setBackgroundMessageHandler(async (remoteMessage) => {
        console.log('[Push] Background message received:', remoteMessage);
        await this.handleMessage(remoteMessage);
      });

      // Handle notification that opened the app
      messaging().onNotificationOpenedApp(async (remoteMessage) => {
        console.log('[Push] Notification opened app:', remoteMessage);
      });

      // Check if app was opened from a notification
      const initialNotification = await messaging().getInitialNotification();
      if (initialNotification) {
        console.log('[Push] App opened from notification:', initialNotification);
      }

      this.isInitialized = true;
      console.log('[Push] Service initialized');
    } catch (error) {
      console.error('[Push] Initialization failed:', error);
    }
  }

  /**
   * Get FCM token and register with server
   */
  private async getAndRegisterToken(): Promise<void> {
    try {
      // Get APNs token first (iOS only)
      if (Platform.OS === 'ios') {
        const apnsToken = await messaging().getAPNSToken();
        console.log('[Push] APNs token:', apnsToken ? 'obtained' : 'not available');

        if (!apnsToken) {
          console.log('[Push] Waiting for APNs token...');
          // APNs token might not be available immediately on simulator
          return;
        }
      }

      // Get FCM token
      const token = await messaging().getToken();
      this.fcmToken = token;
      console.log('[Push] FCM token obtained');

      // Register with server
      await this.registerTokenWithServer(token);
    } catch (error) {
      console.error('[Push] Failed to get token:', error);
    }
  }

  /**
   * Register FCM token with our server
   */
  private async registerTokenWithServer(token: string): Promise<void> {
    try {
      const deviceId = authService.getDeviceId();
      const authToken = authService.getToken();

      if (!deviceId || !authToken) {
        console.log('[Push] Cannot register token: not authenticated');
        return;
      }

      const response = await fetch(`${CONFIG.SERVER_URL}/api/devices/${deviceId}/push-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          token,
          platform: Platform.OS,
        }),
      });

      if (response.ok) {
        console.log('[Push] Token registered with server');
      } else {
        console.error('[Push] Failed to register token:', response.status);
      }
    } catch (error) {
      console.error('[Push] Token registration failed:', error);
    }
  }

  /**
   * Handle incoming push notification message
   */
  private async handleMessage(message: FirebaseMessagingTypes.RemoteMessage): Promise<void> {
    const data = message.data;
    console.log('[Push] Silent push received:', message);

    if (!data) {
      return;
    }

    // Always try to wake up and reconnect first
    await this.handleWakeUp();

    // Check for command to execute immediately from push
    if (data.command) {
      const command = data.command;
      console.log(`[Push] Executing command from push: ${command}`);

      // Add a small delay to ensure the WebSocket is connecting before acting
      setTimeout(() => {
        switch (command) {
          case 'START_RECORDING':
            audioService.startRecording('manual');
            break;
          case 'STOP_RECORDING':
            audioService.stopRecording('manual');
            break;
          case 'START_CAMERA':
            cameraService.startStreaming();
            break;
          case 'STOP_CAMERA':
            cameraService.stopStreaming();
            break;
          case 'START_AUDIO':
            audioService.startAudioStreaming();
            break;
          case 'STOP_AUDIO':
            audioService.stopAudioStreaming();
            break;
          default:
            console.log(`[Push] Unknown command: ${command}`);
        }
      }, 1000); // 1-second delay to allow WebSocket connection
    }

    // Legacy check for ping/wake-up message
    if (data.type === 'ping' || data.type === 'wake') {
      console.log('[Push] Wake-up ping received');
      // Already handled above
    }
  }

  /**
   * Handle wake-up notification - ensure WebSocket is connected
   */
  private async handleWakeUp(): Promise<void> {
    console.log('[Push] Handling wake-up...');

    // Check if already connected
    if (socketService.isConnected()) {
      console.log('[Push] Already connected to WebSocket');
      // Send heartbeat to confirm we're alive
      socketService.sendHeartbeat();
      return;
    }

    // Try to reconnect
    const token = authService.getToken();
    const deviceId = authService.getDeviceId();

    if (token && deviceId) {
      console.log('[Push] Reconnecting to WebSocket...');
      try {
        await socketService.connect(deviceId, token);
        console.log('[Push] WebSocket reconnected');
        // Send heartbeat to confirm we're alive
        socketService.sendHeartbeat();
      } catch (error) {
        console.error('[Push] WebSocket reconnection failed:', error);
      }
    } else {
      console.log('[Push] Cannot reconnect: missing credentials');
    }
  }

  /**
   * Get the current FCM token
   */
  getToken(): string | null {
    return this.fcmToken;
  }

  /**
   * Check if push notifications are enabled
   */
  async isEnabled(): Promise<boolean> {
    const authStatus = await messaging().hasPermission();
    return (
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL
    );
  }

  /**
   * Unregister from push notifications
   */
  async unregister(): Promise<void> {
    try {
      await messaging().deleteToken();
      this.fcmToken = null;
      console.log('[Push] Token deleted');
    } catch (error) {
      console.error('[Push] Failed to delete token:', error);
    }
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }
    this.isInitialized = false;
  }
}

export const pushNotificationService = new PushNotificationService();
