/**
 * RemoteEye Mobile - Status Service
 * Monitors and reports device status
 */

import DeviceInfo from 'react-native-device-info';
import { Platform, NativeModules } from 'react-native';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { CONFIG } from '../config';
import { socketService } from './SocketService';
import { cameraService } from './CameraService';
import { audioService } from './AudioService';
import { locationService } from './LocationService';
import type { DeviceStatus } from '../types';

class StatusService {
  private statusInterval: NodeJS.Timeout | null = null;
  private currentStatus: DeviceStatus | null = null;
  private netInfoUnsubscribe: (() => void) | null = null;

  async start(): Promise<void> {
    // Subscribe to network changes
    this.netInfoUnsubscribe = NetInfo.addEventListener(this.handleNetworkChange.bind(this));

    // Send initial status
    await this.sendStatus();

    // Start periodic status updates
    this.statusInterval = setInterval(() => {
      this.sendStatus();
    }, CONFIG.STATUS_UPDATE_INTERVAL);

    console.log('[Status] Service started');
  }

  stop(): void {
    if (this.statusInterval) {
      clearInterval(this.statusInterval);
      this.statusInterval = null;
    }

    if (this.netInfoUnsubscribe) {
      this.netInfoUnsubscribe();
      this.netInfoUnsubscribe = null;
    }

    console.log('[Status] Service stopped');
  }

  async sendStatus(): Promise<void> {
    const status = await this.gatherStatus();
    this.currentStatus = status;
    socketService.sendStatus(status);
  }

  getStatus(): DeviceStatus | null {
    return this.currentStatus;
  }

  private async gatherStatus(): Promise<DeviceStatus> {
    const [batteryLevel, isCharging, netInfo] = await Promise.all([
      this.getBatteryLevel(),
      this.isCharging(),
      NetInfo.fetch(),
    ]);

    return {
      battery: batteryLevel,
      charging: isCharging,
      networkType: this.getNetworkType(netInfo),
      signalStrength: this.getSignalStrength(netInfo),
      cameraActive: cameraService.isCurrentlyStreaming(),
      audioActive: audioService.isCurrentlyRecording() || audioService.isCurrentlyMonitoring(),
      locationEnabled: locationService.isCurrentlyTracking(),
    };
  }

  private async getBatteryLevel(): Promise<number> {
    try {
      const level = await DeviceInfo.getBatteryLevel();
      return Math.round(level * 100);
    } catch {
      return -1;
    }
  }

  private async isCharging(): Promise<boolean> {
    try {
      return await DeviceInfo.isBatteryCharging();
    } catch {
      return false;
    }
  }

  private getNetworkType(netInfo: NetInfoState): 'wifi' | 'cellular' | 'none' {
    if (!netInfo.isConnected) return 'none';
    if (netInfo.type === 'wifi') return 'wifi';
    if (netInfo.type === 'cellular') return 'cellular';
    return 'none';
  }

  private getSignalStrength(netInfo: NetInfoState): number {
    // Signal strength isn't directly available from NetInfo
    // Return a rough estimate based on connection quality
    if (!netInfo.isConnected) return 0;
    if (netInfo.isInternetReachable === false) return 1;
    if (netInfo.type === 'wifi') return 4;
    if (netInfo.type === 'cellular') {
      // Could potentially use netInfo.details for more info
      return 3;
    }
    return 2;
  }

  private handleNetworkChange(state: NetInfoState): void {
    console.log(`[Status] Network changed: ${state.type}, connected: ${state.isConnected}`);
    // Send immediate status update on network change
    this.sendStatus();
  }
}

export const statusService = new StatusService();
