/**
 * RemoteEye Mobile - Background Service
 * Handles background task execution for persistent monitoring
 */

import BackgroundFetch from 'react-native-background-fetch';
import type { BackgroundFetchConfig } from 'react-native-background-fetch';
import { socketService } from './SocketService';
import { authService } from './AuthService';
import { locationService } from './LocationService';
import { statusService } from './StatusService';
import { audioService } from './AudioService';

class BackgroundService {
  private isInitialized: boolean = false;
  private taskId: string = 'com.remoteeye.background-fetch';

  async initialize(): Promise<number> {
    if (this.isInitialized) {
      console.log('[Background] Already initialized');
      return BackgroundFetch.STATUS_AVAILABLE;
    }

    const config: BackgroundFetchConfig = {
      minimumFetchInterval: 15, // Minimum interval in minutes (iOS minimum is 15)
      stopOnTerminate: false, // Android: Continue after app termination
      startOnBoot: true, // Android: Start on device boot
      enableHeadless: true, // Android: Enable headless mode
      requiresCharging: false,
      requiresDeviceIdle: false,
      requiresBatteryNotLow: false,
      requiresStorageNotLow: false,
      requiredNetworkType: BackgroundFetch.NETWORK_TYPE_ANY,
    };

    const status = await BackgroundFetch.configure(
      config,
      this.onBackgroundFetch.bind(this),
      this.onBackgroundTimeout.bind(this)
    );

    this.isInitialized = true;
    console.log(`[Background] Initialized with status: ${this.getStatusName(status)}`);

    // Register additional scheduled tasks
    await this.registerScheduledTasks();

    return status;
  }

  private async onBackgroundFetch(taskId: string): Promise<void> {
    console.log(`[Background] Task started: ${taskId}`);

    try {
      // Ensure we have valid credentials
      const token = await authService.ensureValidToken();
      const deviceId = authService.getDeviceId();

      if (!token || !deviceId) {
        console.log('[Background] Not authenticated, skipping');
        BackgroundFetch.finish(taskId);
        return;
      }

      // Reconnect socket if disconnected
      if (!socketService.isConnected()) {
        await socketService.connect(deviceId, token);
      }

      // Execute background tasks based on taskId
      switch (taskId) {
        case 'com.remoteeye.location-update':
          await this.performLocationUpdate();
          break;
        case 'com.remoteeye.status-update':
          await this.performStatusUpdate();
          break;
        case 'com.remoteeye.sound-check':
          await this.performSoundCheck();
          break;
        default:
          // Default background fetch - do all tasks
          await this.performAllTasks();
      }

      console.log(`[Background] Task completed: ${taskId}`);
    } catch (error) {
      console.error(`[Background] Task failed: ${taskId}`, error);
    }

    // Signal completion
    BackgroundFetch.finish(taskId);
  }

  private onBackgroundTimeout(taskId: string): void {
    console.warn(`[Background] Task timeout: ${taskId}`);
    BackgroundFetch.finish(taskId);
  }

  private async registerScheduledTasks(): Promise<void> {
    // Location update task - every 15 minutes
    await BackgroundFetch.scheduleTask({
      taskId: 'com.remoteeye.location-update',
      delay: 15 * 60 * 1000, // 15 minutes in ms
      periodic: true,
      enableHeadless: true,
      stopOnTerminate: false,
      startOnBoot: true,
    });

    // Status update task - every 15 minutes
    await BackgroundFetch.scheduleTask({
      taskId: 'com.remoteeye.status-update',
      delay: 15 * 60 * 1000,
      periodic: true,
      enableHeadless: true,
      stopOnTerminate: false,
      startOnBoot: true,
    });

    // Sound check task - every 15 minutes (minimum for iOS)
    await BackgroundFetch.scheduleTask({
      taskId: 'com.remoteeye.sound-check',
      delay: 15 * 60 * 1000,
      periodic: true,
      enableHeadless: true,
      stopOnTerminate: false,
      startOnBoot: true,
    });

    console.log('[Background] Scheduled tasks registered');
  }

  private async performAllTasks(): Promise<void> {
    await Promise.all([
      this.performLocationUpdate(),
      this.performStatusUpdate(),
      this.performSoundCheck(),
    ]);
  }

  private async performLocationUpdate(): Promise<void> {
    if (locationService.isCurrentlyTracking()) {
      const location = await locationService.getCurrentLocation();
      if (location) {
        console.log('[Background] Location sent');
      }
    }
  }

  private async performStatusUpdate(): Promise<void> {
    await statusService.sendStatus();
    console.log('[Background] Status sent');
  }

  private async performSoundCheck(): Promise<void> {
    const settings = audioService.getSettings();
    if (settings.enabled && !audioService.isCurrentlyMonitoring()) {
      // Brief monitoring check
      await audioService.startMonitoring();
      // Stop after a short check period
      setTimeout(() => {
        audioService.stopMonitoring();
      }, 5000);
    }
  }

  async start(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }
    await BackgroundFetch.start();
    console.log('[Background] Service started');
  }

  async stop(): Promise<void> {
    await BackgroundFetch.stop();
    console.log('[Background] Service stopped');
  }

  async getStatus(): Promise<number> {
    return BackgroundFetch.status();
  }

  private getStatusName(status: number): string {
    switch (status) {
      case BackgroundFetch.STATUS_RESTRICTED:
        return 'RESTRICTED';
      case BackgroundFetch.STATUS_DENIED:
        return 'DENIED';
      case BackgroundFetch.STATUS_AVAILABLE:
        return 'AVAILABLE';
      default:
        return 'UNKNOWN';
    }
  }

  // For Android headless task
  static async headlessTask(event: { taskId: string; timeout: boolean }): Promise<void> {
    const { taskId, timeout } = event;

    if (timeout) {
      console.log(`[Background] Headless timeout: ${taskId}`);
      BackgroundFetch.finish(taskId);
      return;
    }

    console.log(`[Background] Headless task: ${taskId}`);

    try {
      // Initialize auth if needed
      await authService.initialize();

      const token = await authService.ensureValidToken();
      const deviceId = authService.getDeviceId();

      if (token && deviceId) {
        await socketService.connect(deviceId, token);
        await statusService.sendStatus();

        if (locationService.isCurrentlyTracking()) {
          await locationService.getCurrentLocation();
        }
      }
    } catch (error) {
      console.error('[Background] Headless task error:', error);
    }

    BackgroundFetch.finish(taskId);
  }
}

export const backgroundService = new BackgroundService();

// Export headless task for Android registration
export const headlessTask = BackgroundService.headlessTask;
