/**
 * RemoteEye Mobile - Audio Service
 * Handles audio streaming using react-native-live-audio-stream
 * Includes support for background recording on iOS.
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

  constructor() {
    this.initializeLiveAudioStream();
    this.setupAppStateHandling(); // CRITICAL: Set up background handling
  }

  /**
   * Listens for app state changes (background/active) to manage background tasks.
   */
  private setupAppStateHandling() {
    this.appStateSubscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'background' && this.isStreaming) {
        console.log('[Audio] App entered background, starting background task.');
        // Start a background task to keep recording going
        if (Platform.OS === 'ios' && NativeModules.BackgroundTaskManager) {
          this.backgroundTaskID = NativeModules.BackgroundTaskManager.startBackgroundTask();
        }
      } else if (nextAppState === 'active') {
        console.log('[Audio] App became active.');
        // End the background task when app comes back to foreground
        if (Platform.OS === 'ios' && this.backgroundTaskID && NativeModules.BackgroundTaskManager) {
          console.log('[Audio] Ending background task.');
          NativeModules.BackgroundTaskManager.endBackgroundTask(this.backgroundTaskID);
          this.backgroundTaskID = null;
        }
      }
    });
  }

  private initializeLiveAudioStream(): void {
    // CRITICAL: Configure the audio session for background recording on iOS
    if (Platform.OS === 'ios' && NativeModules.AudioSessionManager) {
      NativeModules.AudioSessionManager.setCategory('playAndRecord', {
        mixWithOthers: false,
        allowBluetooth: true,
        allowAirPlay: true,
        duckOthers: true,
      });
    }

    const baseDir = Platform.OS === 'ios'
      ? RNFS.DocumentDirectoryPath
      : RNFS.CachesDirectoryPath;

    LiveAudioStream.init({
      sampleRate: SAMPLE_RATE,
      channels: CHANNELS,
      bitsPerSample: BITS_PER_SAMPLE,
      audioSource: 6, // VOICE_RECOGNITION for better quality
      bufferSize: BUFFER_SIZE,
      wavFile: `${baseDir}/live_audio.wav`, // Required by library
    });

    LiveAudioStream.on('data', (data: string) => {
      if (this.isStreaming) {
        // data is base64 encoded PCM audio
        // Calculate approximate duration based on buffer size and sample rate
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

  // Permission handling
  async requestPermissions(): Promise<boolean> {
    try {
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          {
            title: 'Microphone Permission',
            message: 'RemoteEye needs microphone access for audio streaming',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          }
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      }
      // iOS permissions are handled in Info.plist
      return true;
    } catch (error) {
      console.error('[Audio] Permission request failed:', error);
      return false;
    }
  }

  // Settings
  setSettings(settings: Partial<SoundDetectionSettings>): void {
    this.soundDetectionSettings = { ...this.soundDetectionSettings, ...settings };
  }

  getSettings(): SoundDetectionSettings {
    return { ...this.soundDetectionSettings };
  }

  // Audio streaming
  async startAudioStreaming(): Promise<void> {
    if (this.isStreaming) {
      console.log('[Audio] Already streaming');
      return;
    }

    const hasPermission = await this.requestPermissions();
    if (!hasPermission) {
      throw new Error('Microphone permission not granted');
    }

    try {
      this.currentRecordingId = this.generateRecordingId();
      this.recordingStartTime = Date.now();

      console.log(`[Audio] Starting audio streaming: ${this.currentRecordingId}`);

      socketService.resetAudioSequence();
      LiveAudioStream.start();
      this.isStreaming = true;

      console.log('[Audio] Audio streaming started');
    } catch (error) {
      this.isStreaming = false;
      this.currentRecordingId = null;
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error('[Audio] Failed to start audio streaming:', errorMsg);
      throw new Error(`Audio streaming failed: ${errorMsg}`);
    }
  }

  async stopAudioStreaming(): Promise<void> {
    if (!this.isStreaming) {
      console.log('[Audio] Not streaming');
      return;
    }

    try {
      await LiveAudioStream.stop();

      const duration = Math.floor((Date.now() - this.recordingStartTime) / 1000);

      console.log(`[Audio] Audio streaming stopped. Duration: ${duration}s`);

      if (this.currentRecordingId) {
        const recordingInfo: RecordingInfo = {
          id: this.currentRecordingId,
          type: 'audio',
          duration,
          size: 0,
          triggeredBy: 'manual',
        };
        socketService.sendRecordingComplete(recordingInfo);
      }
    } catch (error) {
      console.error('[Audio] Failed to stop audio streaming:', error);
    } finally {
      this.isStreaming = false;
      this.currentRecordingId = null;
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

  // Sound level monitoring
  async startMonitoring(): Promise<void> {
    if (this.isMonitoring) return;

    this.isMonitoring = true;
    console.log('[Audio] Sound monitoring started');

    this.monitoringInterval = setInterval(() => {
      this.checkSoundLevel();
    }, 100);
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
    // Sound level monitoring would need a separate implementation
    // For now, this is a placeholder
  }

  private generateRecordingId(): string {
    return `rec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Cleans up all resources, including background tasks and listeners.
   * CRITICAL: Must be called to prevent memory leaks and background task issues.
   */
  async destroy(): Promise<void> {
    console.log('[Audio] Destroying service...');
    this.stopMonitoring();
    if (this.isStreaming) {
      await this.stopAudioStreaming();
    }
    
    // Clean up app state subscription
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }
    
    // Clean up background task if still active
    if (this.backgroundTaskID && Platform.OS === 'ios' && NativeModules.BackgroundTaskManager) {
      console.log('[Audio] Ending background task on destroy.');
      NativeModules.BackgroundTaskManager.endBackgroundTask(this.backgroundTaskID);
      this.backgroundTaskID = null;
    }
    
    console.log('[Audio] Service destroyed.');
  }
}

export const audioService = new AudioService();