/**
 * RemoteEye Mobile - Camera Service
 * Handles camera capture and streaming
 */

import { Camera } from 'react-native-vision-camera';
import RNFS from 'react-native-fs';
import ImageResizer from 'react-native-image-resizer';
import { CONFIG } from '../config';
import { socketService } from './SocketService';
import type { CameraSettings, CameraFrame } from '../types';

interface FrameCallback {
  (frame: CameraFrame): void;
}

// Event emitter for camera state changes
type StateCallback = (isActive: boolean) => void;

class CameraService {
  private _isStreaming: boolean = false;
  private settings: CameraSettings = {
    quality: CONFIG.CAMERA_DEFAULT_QUALITY,
    fps: CONFIG.CAMERA_DEFAULT_FPS,
  };
  private frameInterval: NodeJS.Timeout | null = null;
  private captureCallback: FrameCallback | null = null;
  private cameraRef: Camera | null = null;
  private stateCallbacks: Set<StateCallback> = new Set();
  private captureInProgress: boolean = false;

  // Permission handling
  async requestPermissions(): Promise<boolean> {
    const cameraPermission = await Camera.requestCameraPermission();
    return cameraPermission === 'granted';
  }

  async checkPermissions(): Promise<boolean> {
    const cameraPermission = await Camera.getCameraPermissionStatus();
    return cameraPermission === 'granted';
  }

  // Settings
  setSettings(settings: Partial<CameraSettings>): void {
    this.settings = { ...this.settings, ...settings };
  }

  getSettings(): CameraSettings {
    return { ...this.settings };
  }

  getQualityConfig(): { width: number; height: number; quality: number } {
    return CONFIG.CAMERA_QUALITY_MAP[this.settings.quality];
  }

  // Camera reference (set from component)
  setCameraRef(ref: Camera | null): void {
    this.cameraRef = ref;
    console.log('[Camera] Ref set:', ref ? 'valid' : 'null');
  }

  // State change notifications
  onStateChange(callback: StateCallback): void {
    this.stateCallbacks.add(callback);
  }

  offStateChange(callback: StateCallback): void {
    this.stateCallbacks.delete(callback);
  }

  private notifyStateChange(): void {
    this.stateCallbacks.forEach(cb => cb(this._isStreaming));
  }

  // Streaming control
  async startStreaming(): Promise<void> {
    if (this._isStreaming) {
      console.log('[Camera] Already streaming');
      return;
    }

    const hasPermission = await this.checkPermissions();
    if (!hasPermission) {
      throw new Error('Camera permission not granted');
    }

    this._isStreaming = true;
    this.notifyStateChange();
    socketService.resetFrameSequence();

    console.log(`[Camera] Starting stream at ${this.settings.fps} FPS`);

    // Wait a moment for camera to activate
    await new Promise(resolve => setTimeout(resolve, 500));

    // Start frame capture interval
    const intervalMs = Math.floor(1000 / this.settings.fps);
    this.frameInterval = setInterval(() => {
      this.captureAndSendFrame();
    }, intervalMs);
  }

  stopStreaming(): void {
    if (!this._isStreaming) return;

    this._isStreaming = false;
    this.notifyStateChange();

    if (this.frameInterval) {
      clearInterval(this.frameInterval);
      this.frameInterval = null;
    }

    console.log('[Camera] Streaming stopped');
  }

  isCurrentlyStreaming(): boolean {
    return this._isStreaming;
  }

  // Frame capture
  private async captureAndSendFrame(): Promise<void> {
    if (!this._isStreaming || !this.cameraRef || this.captureInProgress) return;

    this.captureInProgress = true;

    try {
      const qualityConfig = this.getQualityConfig();

      // Take a photo snapshot
      const photo = await this.cameraRef.takePhoto({
        enableShutterSound: false,
      });

      // Read and resize the photo
      const base64Data = await this.readPhotoAsBase64(
        photo.path,
        qualityConfig.width,
        qualityConfig.height,
        qualityConfig.quality
      );

      if (base64Data) {
        const frame: Omit<CameraFrame, 'sequence'> = {
          data: base64Data,
          width: qualityConfig.width,
          height: qualityConfig.height,
          quality: qualityConfig.quality,
        };

        // Send via socket
        socketService.sendFrame(frame);

        // Also call local callback if set
        this.captureCallback?.(frame as CameraFrame);
      }

      // Clean up temp photo file
      try {
        await RNFS.unlink(photo.path);
      } catch {
        // Ignore cleanup errors
      }
    } catch (error) {
      console.error('[Camera] Frame capture error:', error);
    } finally {
      this.captureInProgress = false;
    }
  }

  private async readPhotoAsBase64(
    path: string,
    targetWidth: number,
    targetHeight: number,
    quality: number
  ): Promise<string | null> {
    try {
      // Resize the image
      const resized = await ImageResizer.createResizedImage(
        path.startsWith('file://') ? path : `file://${path}`,
        targetWidth,
        targetHeight,
        'JPEG',
        Math.round(quality * 100),
        0, // rotation
        undefined, // outputPath (use temp)
        false, // keepMeta
        { mode: 'contain', onlyScaleDown: true }
      );

      // Read as base64
      const base64 = await RNFS.readFile(resized.uri, 'base64');

      // Clean up resized file
      try {
        await RNFS.unlink(resized.uri);
      } catch {
        // Ignore cleanup errors
      }

      return base64;
    } catch (error) {
      console.error('[Camera] readPhotoAsBase64 error:', error);
      return null;
    }
  }

  // Single photo capture
  async capturePhoto(): Promise<{ data: string; width: number; height: number }> {
    if (!this.cameraRef) {
      throw new Error('Camera not initialized');
    }

    const photo = await this.cameraRef.takePhoto({
      enableShutterSound: false,
    });

    const base64Data = await this.readPhotoAsBase64(
      photo.path,
      photo.width,
      photo.height,
      0.85
    );

    if (!base64Data) {
      throw new Error('Failed to read photo');
    }

    return {
      data: base64Data,
      width: photo.width,
      height: photo.height,
    };
  }

  // Local frame callback (for preview)
  setFrameCallback(callback: FrameCallback | null): void {
    this.captureCallback = callback;
  }
}

export const cameraService = new CameraService();
