/**
 * RemoteEye Mobile - Push Notification Service
 * Handles FCM registration and silent push notifications for device wake-up and remote commands.
 */

import messaging, { FirebaseMessagingTypes } from '@react-native-firebase/messaging';
import { Platform } from 'react-native';
import { socketService } from './SocketService';
import { authService } from './AuthService';
import { audioService } from './AudioService';
import { cameraService } from './CameraService';
import { CONFIG } from '../config';

class PushNotificationService {
  private fcmToken: string | null = null;
  private isInitialized: boolean = false;

  /**
   * Initialize the push notification service.
   * Should be called after user authentication.
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
        // You can handle navigation or other logic here if needed
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
   * Get FCM token and register with our server.
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
   * Register FCM token with our server.
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
   * Handles incoming push notification messages, both in foreground and background.
   * This is the main entry point for all remote commands.
   */
  private async handleMessage(message: FirebaseMessagingTypes.RemoteMessage): Promise<void> {
    console.log('[Push] Message received:', message);
    const { data } = message;

    if (!data) {
      console.log('[Push] Message received with no data payload.');
      return;
    }

    // 1. ALWAYS attempt to wake up and reconnect the WebSocket first.
    // This is non-negotiable for reliable background operation.
    await this.handleWakeUp();

    // 2. Check if a specific command was sent in the payload.
    // The server should send the command in the 'action' field.
    const command = data.action;

    if (typeof command === 'string') {
      console.log(`[Push] Command found in payload: ${command}`);
      await this.executeCommand(command, data);
    } else if (command) {
      console.warn('[Push] Command in payload is not a string:', command);
    } else {
      // If no command, it was a simple wake-up ping.
      console.log('[Push] No command in payload. This was a wake-up ping.');
    }
  }

  /**
   * Executes a specific command after a delay to allow services to initialize.
   * @param command The command string to execute.
   * @param data The full data payload from the push notification.
   */
  private async executeCommand(command: string, data: any): Promise<void> {
    console.log(`[Push] Preparing to execute command: ${command}`);
    
    // Add a delay to ensure the WebSocket is connecting and other services are ready.
    // 1.5 seconds is a safe starting point.
    await new Promise(resolve => setTimeout(resolve, 1500));

    try {
      switch (command) {
        case 'START_RECORDING':
          await audioService.startRecording('manual');
          break;
        case 'STOP_RECORDING':
          await audioService.stopRecording('manual');
          break;
        case 'START_CAMERA':
          await cameraService.startStreaming();
          break;
        case 'STOP_CAMERA':
          await cameraService.stopStreaming();
          break;
        // NOTE: We've consolidated 'START_AUDIO'/'STOP_AUDIO' into the 'RECORDING' commands
        // to avoid redundancy. If you need them, you can add them back here.
        default:
          console.warn(`[Push] Unknown command received: ${command}`);
          // Report the unknown command back to the server for debugging.
          socketService.reportStatus('error', { message: `Unknown command: ${command}` });
          return;
      }
      console.log(`[Push] Command '${command}' executed successfully.`);
    } catch (error) {
      console.error(`[Push] Failed to execute command '${command}':`, error);
      // Report the execution failure back to the server so the dashboard can show an error state.
      socketService.reportStatus('error', { 
        command, 
        message: error instanceof Error ? error.message : String(error) 
      });
    }
  }

  /**
   * Handles the wake-up logic: ensures the WebSocket is connected.
   */
  private async handleWakeUp(): Promise<void> {
    console.log('[Push] Handling wake-up...');

    // If already connected, just send a heartbeat to confirm we're alive.
    if (socketService.isConnected()) {
      console.log('[Push] Already connected to WebSocket. Sending heartbeat.');
      socketService.sendHeartbeat();
      return;
    }

    // If not connected, try to reconnect.
    const token = authService.getToken();
    const deviceId = authService.getDeviceId();

    if (token && deviceId) {
      console.log('[Push] Reconnecting to WebSocket...');
      try {
        await socketService.connect(deviceId, token);
        console.log('[Push] WebSocket reconnected successfully.');
        // Send heartbeat to confirm we're alive after reconnecting.
        socketService.sendHeartbeat();
      } catch (error) {
        console.error('[Push] WebSocket reconnection failed:', error);
      }
    } else {
      console.log('[Push] Cannot reconnect: missing authentication credentials.');
    }
  }

  /**
   * Get the current FCM token.
   */
  getToken(): string | null {
    return this.fcmToken;
  }

  /**
   * Check if push notifications are enabled.
   */
  async isEnabled(): Promise<boolean> {
    const authStatus = await messaging().hasPermission();
    return (
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL
    );
  }

  /**
   * Unregister from push notifications.
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
   * Clean up resources.
   */
  destroy(): void {
    // The appStateSubscription was removed as it wasn't being used.
    // If you add it back, ensure you clean it up here.
    this.isInitialized = false;
    console.log('[Push] Service destroyed.');
  }
}

export const pushNotificationService = new PushNotificationService();