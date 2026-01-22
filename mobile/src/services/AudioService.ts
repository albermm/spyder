/**
 * RemoteEye Mobile - Audio Service
 * Handles audio streaming and recording to R2.
 */

import LiveAudioStream from 'react-native-live-audio-stream';
import { AppState, Platform, PermissionsAndroid } from 'react-native';
import RNFS from 'react-native-fs';
import { CONFIG } from '../config';
import { socketService } from './SocketService';
import type { SoundDetectionSettings, RecordingInfo } from '../types';
import { NativeModules } from 'react-native';

// Audio configuration
const SAMPLE_RATE = 44100;
const CHANNELS = 1;
const BITS_PER_SAMPLE = 16;
const BUFFER_SIZE = 4096;

// R2 UPLOAD: Type for the server's presigned URL response
interface PresignedUrlResponse {
  url: string;
  key: string; // The file path/key in the R2 bucket
}

class AudioService {
  private isStreaming: boolean = false;
  private isMonitoring: boolean = false;
  private soundDetectionSettings: SoundDetectionSettings = {
    enabled: true,
    threshold: CONFIG.SOUND_THRESHOLD_DEFAULT,
    recordDuration: CONFIG.SOUND_RECORD_DURATION_DEFAULT,
  };
  private recordingStartTime: number = 0;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private currentRecordingId: string | null = null;
  
  // Background task properties
  private appStateSubscription: any;
  private backgroundTaskID: any = null;

  // R2 UPLOAD: Properties for local file and upload status
  private localRecordingPath: string | null = null;
  private isUploading: boolean = false;

  constructor() {
    this.initializeLiveAudioStream();
    this.setupAppStateHandling();
  }

  private setupAppStateHandling() {
    this.appStateSubscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'background' && this.isStreaming) {
        console.log('[Audio] App entered background, starting background task.');
        if (Platform.OS === 'ios' && NativeModules.BackgroundTaskManager) {
          this.backgroundTaskID = NativeModules.BackgroundTaskManager.startBackgroundTask();
        }
      } else if (nextAppState === 'active') {
        console.log('[Audio] App became active.');
        if (Platform.OS === 'ios' && this.backgroundTaskID && NativeModules.BackgroundTaskManager) {
          console.log('[Audio] Ending background task.');
          NativeModules.BackgroundTaskManager.endBackgroundTask(this.backgroundTaskID);
          this.backgroundTaskID = null;
        }
      }
    });
  }

  private initializeLiveAudioStream(): void {
    if (Platform.OS === 'ios' && NativeModules.AudioSessionManager) {
      NativeModules.AudioSessionManager.setCategory('playAndRecord', {
        mixWithOthers: false,
        allowBluetooth: true,
        allowAirPlay: true,
        duckOthers: true,
      });
    }

    // R2 UPLOAD: Define a unique path for the recording file
    const recordingId = this.generateRecordingId();
    const baseDir = Platform.OS === 'ios' ? RNFS.DocumentDirectoryPath : RNFS.CachesDirectoryPath;
    this.localRecordingPath = `${baseDir}/${recordingId}.wav`;

    LiveAudioStream.init({
      sampleRate: SAMPLE_RATE,
      channels: CHANNELS,
      bitsPerSample: BITS_PER_SAMPLE,
      audioSource: 6,
      bufferSize: BUFFER_SIZE,
      wavFile: this.localRecordingPath, // R2 UPLOAD: Tell the library to save the WAV file here
    });

    LiveAudioStream.on('data', (data: string) => {
      if (this.isStreaming) {
        const duration = BUFFER_SIZE / (SAMPLE_RATE * CHANNELS * (BITS_PER_SAMPLE / 8));
        socketService.sendAudioChunk({
          data: data,
          sampleRate: SAMPLE_RATE,
          channels: CHANNELS,
          duration: duration,
        });
      }
    });

    console.log('[Audio] LiveAudioStream initialized');
  }

  async requestPermissions(): Promise<boolean> {
    try {
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      }
      return true;
    } catch (error) {
      console.error('[Audio] Permission request failed:', error);
      return false;
    }
  }

  setSettings(settings: Partial<SoundDetectionSettings>): void {
    this.soundDetectionSettings = { ...this.soundDetectionSettings, ...settings };
  }

  getSettings(): SoundDetectionSettings {
    return { ...this.soundDetectionSettings };
  }

  async startAudioStreaming(): Promise<void> {
    if (this.isStreaming) return;

    const hasPermission = await this.requestPermissions();
    if (!hasPermission) throw new Error('Microphone permission not granted');

    try {
      // R2 UPLOAD: Re-initialize to get a new unique file path for each recording
      this.initializeLiveAudioStream();

      this.currentRecordingId = this.generateRecordingId();
      this.recordingStartTime = Date.now();
      console.log(`[Audio] Starting audio streaming: ${this.currentRecordingId}`);

      socketService.resetAudioSequence();
      LiveAudioStream.start();
      this.isStreaming = true;

      console.log('[Audio] Audio streaming started');

      // Report status to server
      socketService.reportStatus('recording', { recordingId: this.currentRecordingId });
    } catch (error) {
      this.isStreaming = false;
      this.currentRecordingId = null;
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error('[Audio] Failed to start audio streaming:', errorMsg);
      throw new Error(`Audio streaming failed: ${errorMsg}`);
    }
  }

  async stopAudioStreaming(): Promise<void> {
    if (!this.isStreaming) return;

    try {
      await LiveAudioStream.stop();
      const duration = Math.floor((Date.now() - this.recordingStartTime) / 1000);
      console.log(`[Audio] Audio streaming stopped. Duration: ${duration}s`);

      // R2 UPLOAD: Trigger the upload after the file is finalized
      if (this.localRecordingPath) {
        console.log(`[Audio] Local recording saved at: ${this.localRecordingPath}`);
        // We run the upload in the background without blocking the stop process
        this.uploadToR2(this.localRecordingPath).catch(err => 
          console.error("[Audio] R2 Upload failed in background:", err)
        );
      }

      if (this.currentRecordingId) {
        const recordingInfo: RecordingInfo = {
          id: this.currentRecordingId,
          type: 'audio',
          duration,
          size: 0, // R2 UPLOAD: You could get the file size here if needed
          triggeredBy: 'manual',
        };
        socketService.sendRecordingComplete(recordingInfo);
      }
    } catch (error) {
      console.error('[Audio] Failed to stop audio streaming:', error);
    } finally {
      this.isStreaming = false;
      this.currentRecordingId = null;

      // Report status back to online
      socketService.reportStatus('online');
    }
  }

  // R2 UPLOAD: New method to handle the upload process
  private async uploadToR2(localFilePath: string): Promise<void> {
    if (!this.currentRecordingId) {
      console.error('[Audio] Cannot upload: No recording ID.');
      return;
    }

    this.isUploading = true;
    console.log(`[Audio] Starting upload for ${this.currentRecordingId}.wav`);

    try {
      // 1. Get a presigned URL from your server
      const fileName = `${this.currentRecordingId}.wav`;
      const response = await fetch(`${CONFIG.SERVER_URL}/api/r2/presigned-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName, contentType: 'audio/wav' }),
      });

      if (!response.ok) {
        throw new Error(`Server returned ${response.status} for presigned URL.`);
      }

      const { url, key }: PresignedUrlResponse = await response.json();
      console.log(`[Audio] Received presigned URL for key: ${key}`);

      // 2. Read the local file as a base64 string
      const base64Data = await RNFS.readFile(localFilePath, 'base64');

      // 3. Convert base64 to a Blob for the upload
      const audioBlob = await fetch(`data:audio/wav;base64,${base64Data}`).then(res => res.blob());

      // 4. Upload the file to R2 using the presigned URL
      const uploadResponse = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'audio/wav' },
        body: audioBlob,
      });

      if (!uploadResponse.ok) {
        throw new Error(`R2 upload failed with status: ${uploadResponse.status}`);
      }

      console.log(`[Audio] Successfully uploaded ${fileName} to R2.`);
      // Optional: Notify your server that the upload is complete
      // await fetch(`${CONFIG.API_ENDPOINT}/api/r2/upload-complete`, { ... });

    } catch (error) {
      console.error('[Audio] R2 Upload Error:', error);
    } finally {
      this.isUploading = false;
      // Optional: Clean up the local file after successful upload
      // await RNFS.unlink(localFilePath);
    }
  }

  // Recording control (aliases for streaming)
  async startRecording(triggeredBy: 'sound_detection' | 'manual' = 'manual'): Promise<void> {
    await this.startAudioStreaming();
  }

  async stopRecording(triggeredBy: 'sound_detection' | 'manual' = 'manual'): Promise<void> {
    await this.stopAudioStreaming();
  }

  isCurrentlyRecording(): boolean {
    return this.isStreaming;
  }

  isCurrentlyStreaming(): boolean {
    return this.isStreaming;
  }

  // R2 UPLOAD: New status checker
  isCurrentlyUploading(): boolean {
    return this.isUploading;
  }

  // Sound level monitoring
  async startMonitoring(): Promise<void> {
    if (this.isMonitoring) return;
    this.isMonitoring = true;
    this.monitoringInterval = setInterval(() => this.checkSoundLevel(), 100);
    console.log('[Audio] Sound monitoring started');
  }

  stopMonitoring(): void {
    if (!this.isMonitoring) return;
    this.isMonitoring = false;
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    console.log('[Audio] Sound monitoring stopped');
  }

  isCurrentlyMonitoring(): boolean {
    return this.isMonitoring;
  }

  private async checkSoundLevel(): Promise<void> {
    if (!this.soundDetectionSettings.enabled) return;
  }

  private generateRecordingId(): string {
    return `rec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async destroy(): Promise<void> {
    console.log('[Audio] Destroying service...');
    this.stopMonitoring();
    if (this.isStreaming) {
      await this.stopAudioStreaming();
    }
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }
    if (this.backgroundTaskID && Platform.OS === 'ios' && NativeModules.BackgroundTaskManager) {
      NativeModules.BackgroundTaskManager.endBackgroundTask(this.backgroundTaskID);
      this.backgroundTaskID = null;
    }
    console.log('[Audio] Service destroyed.');
  }
}

export const audioService = new AudioService();