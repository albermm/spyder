/**
 * RemoteEye Mobile - Camera Service
 * Handles camera capture and streaming with direct R2 uploads.
 */

import { Camera } from 'react-native-vision-camera';
import RNFS from 'react-native-fs';
import ImageResizer from 'react-native-image-resizer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CONFIG, getServerUrl } from '../config';
import { socketService } from './SocketService';
import type { CameraSettings, CameraFrame, CameraPosition } from '../types';

// R2 UPLOAD: Type for presigned URL response
interface PresignedUrlResponse {
  url: string;
  key: string;
  expires_in: number;
}

interface FrameCallback {
  (frame: CameraFrame): void;
}

// Event emitter for camera state changes
type StateCallback = (isActive: boolean) => void;
type PositionCallback = (position: CameraPosition) => void;

class CameraService {
  private _isStreaming: boolean = false;
  private _cameraPosition: CameraPosition = 'back';
  private settings: CameraSettings = {
    quality: CONFIG.CAMERA_DEFAULT_QUALITY,
    fps: CONFIG.CAMERA_DEFAULT_FPS,
  };
  private frameInterval: NodeJS.Timeout | null = null;
  private captureCallback: FrameCallback | null = null;
  private cameraRef: Camera | null = null;
  private stateCallbacks: Set<StateCallback> = new Set();
  private positionCallbacks: Set<PositionCallback> = new Set();
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
    const wasNull = this.cameraRef === null;
    this.cameraRef = ref;
    if (ref && wasNull) {
      console.log('[Camera] Ref set: valid (camera is now available)');
    } else if (!ref && !wasNull) {
      console.log('[Camera] Ref set: null (camera removed)');
    } else if (ref) {
      console.log('[Camera] Ref updated: valid');
    }
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

  // Camera position
  getCameraPosition(): CameraPosition {
    return this._cameraPosition;
  }

  setCameraPosition(position: CameraPosition): void {
    if (this._cameraPosition !== position) {
      this._cameraPosition = position;
      console.log(`[Camera] Position changed to: ${position}`);
      this.notifyPositionChange();
    }
  }

  switchCamera(): void {
    const newPosition = this._cameraPosition === 'back' ? 'front' : 'back';
    console.log(`[Camera] switchCamera() called, switching to: ${newPosition}`);
    this.setCameraPosition(newPosition);
  }

  /**
   * Wait for the camera ref to be set/updated.
   * Useful after changing camera position to wait for React re-render.
   */
  async waitForCameraReady(timeoutMs: number = 2000): Promise<boolean> {
    const startTime = Date.now();
    const checkInterval = 100;

    while (Date.now() - startTime < timeoutMs) {
      if (this.cameraRef) {
        console.log('[Camera] Camera ref is ready');
        return true;
      }
      await new Promise(resolve => setTimeout(resolve, checkInterval));
    }

    console.warn('[Camera] Timeout waiting for camera ref');
    return false;
  }

  /**
   * Check if camera ref is currently available.
   */
  hasCameraRef(): boolean {
    return this.cameraRef !== null;
  }

  onPositionChange(callback: PositionCallback): void {
    this.positionCallbacks.add(callback);
  }

  offPositionChange(callback: PositionCallback): void {
    this.positionCallbacks.delete(callback);
  }

  private notifyPositionChange(): void {
    this.positionCallbacks.forEach(cb => cb(this._cameraPosition));
  }

  // Streaming control
  async startStreaming(): Promise<void> {
    if (this._isStreaming) {
      console.log('[Camera] Already streaming');
      return;
    }

    // Check if permission is already granted
    let hasPermission = await this.checkPermissions();

    // If not, request it
    if (!hasPermission) {
      console.log('[Camera] Requesting camera permission...');
      hasPermission = await this.requestPermissions();

      if (!hasPermission) {
        throw new Error('Camera permission denied by user');
      }
    }

    this._isStreaming = true;
    this.notifyStateChange();
    socketService.resetFrameSequence();

    console.log(`[Camera] Starting stream at ${this.settings.fps} FPS`);

    // Wait for camera to be ready (ref to be set and component to activate)
    console.log('[Camera] Waiting for camera ref to be ready...');
    const isReady = await this.waitForCameraReady(3000);
    if (!isReady) {
      console.error('[Camera] Camera ref not available, stopping stream');
      this._isStreaming = false;
      this.notifyStateChange();
      throw new Error('Camera not ready');
    }

    console.log('[Camera] Camera ref is ready, starting frame capture');

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

  // Single photo capture (returns base64 for legacy compatibility)
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

  /**
   * Capture a photo and upload directly to R2.
   * This is the preferred method - bypasses server bandwidth entirely.
   */
  async captureAndUploadPhoto(): Promise<void> {
    if (!this.cameraRef) {
      throw new Error('Camera not initialized');
    }

    const recordingId = `photo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const filename = `${recordingId}.jpg`;

    console.log(`[Camera] Capturing photo for direct R2 upload: ${recordingId}`);

    // If camera is not streaming, we need to temporarily activate it
    const wasStreaming = this._isStreaming;
    if (!wasStreaming) {
      console.log('[Camera] Temporarily activating camera for photo capture...');
      this._isStreaming = true;
      this.notifyStateChange();
      // Wait for camera to initialize
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    try {
      // 1. Capture the photo
      const photo = await this.cameraRef.takePhoto({
        enableShutterSound: false,
      });

      // 2. Read and resize the photo
      const base64Data = await this.readPhotoAsBase64(
        photo.path,
        photo.width,
        photo.height,
        0.85
      );

      if (!base64Data) {
        throw new Error('Failed to read photo');
      }

      // Clean up original temp file
      try {
        await RNFS.unlink(photo.path);
      } catch {
        // Ignore cleanup errors
      }

      // 3. Get device ID from storage
      const deviceId = await AsyncStorage.getItem(CONFIG.STORAGE_KEYS.DEVICE_ID);
      if (!deviceId) {
        throw new Error('Device not registered');
      }

      // 4. Get presigned URL from server
      const serverUrl = getServerUrl();
      const token = await AsyncStorage.getItem(CONFIG.STORAGE_KEYS.TOKEN);

      const presignedResponse = await fetch(`${serverUrl}/api/media/presigned-url`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify({
          device_id: deviceId,
          file_name: filename,
          content_type: 'image/jpeg',
          media_type: 'photo',
        }),
      });

      if (!presignedResponse.ok) {
        throw new Error(`Failed to get presigned URL: ${presignedResponse.status}`);
      }

      const { url, key }: PresignedUrlResponse = await presignedResponse.json();
      console.log(`[Camera] Got presigned URL for: ${key}`);

      // 5. Convert base64 to blob and upload directly to R2
      const imageBlob = await fetch(`data:image/jpeg;base64,${base64Data}`).then(res => res.blob());
      const size = imageBlob.size;

      const uploadResponse = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'image/jpeg' },
        body: imageBlob,
      });

      if (!uploadResponse.ok) {
        throw new Error(`R2 upload failed: ${uploadResponse.status}`);
      }

      console.log(`[Camera] Photo uploaded to R2: ${key}`);

      // 6. Notify server that upload is complete
      socketService.sendPhotoComplete({
        recordingId,
        storageKey: key,
        filename,
        size,
        width: photo.width,
        height: photo.height,
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[Camera] Photo upload failed: ${errorMessage}`);

      // Report failure to server
      socketService.sendUploadFailed({
        recordingId,
        mediaType: 'photo',
        error: errorMessage,
        filename,
      });

      throw error;
    } finally {
      // Deactivate camera if it wasn't streaming before
      if (!wasStreaming) {
        console.log('[Camera] Deactivating camera after photo capture');
        this._isStreaming = false;
        this.notifyStateChange();
      }
    }
  }

  // Local frame callback (for preview)
  setFrameCallback(callback: FrameCallback | null): void {
    this.captureCallback = callback;
  }
}

export const cameraService = new CameraService();
