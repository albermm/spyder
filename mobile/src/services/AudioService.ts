/**
 * RemoteEye Mobile - Audio Service
 * Handles audio recording and sound level detection
 */

import AudioRecorderPlayer from 'react-native-audio-recorder-player';
import { Platform, PermissionsAndroid } from 'react-native';
import { CONFIG } from '../config';
import { socketService } from './SocketService';
import type { SoundDetectionSettings, AudioChunk, SoundDetection, RecordingInfo } from '../types';

class AudioService {
  private audioRecorderPlayer: AudioRecorderPlayer;
  private isRecording: boolean = false;
  private isMonitoring: boolean = false;
  private soundDetectionSettings: SoundDetectionSettings = {
    enabled: true,
    threshold: CONFIG.SOUND_THRESHOLD_DEFAULT,
    recordDuration: CONFIG.SOUND_RECORD_DURATION_DEFAULT,
  };
  private recordingPath: string = '';
  private recordingStartTime: number = 0;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private autoRecordTimeout: NodeJS.Timeout | null = null;
  private currentRecordingId: string | null = null;

  constructor() {
    this.audioRecorderPlayer = new AudioRecorderPlayer();
  }

  // Permission handling
  async requestPermissions(): Promise<boolean> {
    if (Platform.OS === 'android') {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        {
          title: 'Microphone Permission',
          message: 'RemoteEye needs access to your microphone for audio monitoring.',
          buttonNeutral: 'Ask Me Later',
          buttonNegative: 'Cancel',
          buttonPositive: 'OK',
        }
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    }
    return true; // iOS handles permissions via Info.plist
  }

  // Settings
  setSettings(settings: Partial<SoundDetectionSettings>): void {
    this.soundDetectionSettings = { ...this.soundDetectionSettings, ...settings };
  }

  getSettings(): SoundDetectionSettings {
    return { ...this.soundDetectionSettings };
  }

  // Recording control
  async startRecording(triggeredBy: 'sound_detection' | 'manual' = 'manual'): Promise<void> {
    if (this.isRecording) {
      console.log('[Audio] Already recording');
      return;
    }

    try {
      this.currentRecordingId = this.generateRecordingId();
      this.recordingPath = `${Platform.OS === 'android' ? '' : 'file://'}recording_${this.currentRecordingId}.m4a`;
      this.recordingStartTime = Date.now();
      this.isRecording = true;

      socketService.resetAudioSequence();

      await this.audioRecorderPlayer.startRecorder(this.recordingPath);

      // Set up metering for audio chunks
      this.audioRecorderPlayer.addRecordBackListener((e) => {
        if (this.isRecording) {
          this.handleRecordingProgress(e);
        }
      });

      console.log(`[Audio] Recording started: ${this.currentRecordingId}`);

      // If triggered by sound detection, auto-stop after configured duration
      if (triggeredBy === 'sound_detection') {
        this.autoRecordTimeout = setTimeout(() => {
          this.stopRecording('sound_detection');
        }, this.soundDetectionSettings.recordDuration * 1000);
      }
    } catch (error) {
      this.isRecording = false;
      console.error('[Audio] Failed to start recording:', error);
      throw error;
    }
  }

  async stopRecording(triggeredBy: 'sound_detection' | 'manual' = 'manual'): Promise<void> {
    if (!this.isRecording) return;

    try {
      if (this.autoRecordTimeout) {
        clearTimeout(this.autoRecordTimeout);
        this.autoRecordTimeout = null;
      }

      const result = await this.audioRecorderPlayer.stopRecorder();
      this.audioRecorderPlayer.removeRecordBackListener();

      const duration = Math.floor((Date.now() - this.recordingStartTime) / 1000);

      // Notify server that recording is complete
      if (this.currentRecordingId) {
        const recordingInfo: RecordingInfo = {
          id: this.currentRecordingId,
          type: 'audio',
          duration,
          size: 0, // Would need to get file size
          triggeredBy,
        };
        socketService.sendRecordingComplete(recordingInfo);
      }

      console.log(`[Audio] Recording stopped: ${result}`);
    } catch (error) {
      console.error('[Audio] Failed to stop recording:', error);
    } finally {
      this.isRecording = false;
      this.currentRecordingId = null;
    }
  }

  isCurrentlyRecording(): boolean {
    return this.isRecording;
  }

  // Sound level monitoring
  async startMonitoring(): Promise<void> {
    if (this.isMonitoring) return;

    this.isMonitoring = true;
    console.log('[Audio] Sound monitoring started');

    // Start a silent recording to monitor levels
    // This is a simplified approach - in production, use a native module
    // for more efficient audio level monitoring
    this.monitoringInterval = setInterval(() => {
      this.checkSoundLevel();
    }, 100); // Check every 100ms
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

    // In a real implementation, get the actual audio level
    // This would typically use a native module or the recorder's metering
    const currentLevel = await this.getCurrentAudioLevel();

    if (currentLevel >= this.soundDetectionSettings.threshold) {
      const detection: SoundDetection = {
        level: currentLevel,
        threshold: this.soundDetectionSettings.threshold,
        recordingStarted: false,
      };

      // Start recording if not already recording
      if (!this.isRecording) {
        detection.recordingStarted = true;
        this.startRecording('sound_detection');
      }

      socketService.sendSoundDetected(detection);
    }
  }

  private async getCurrentAudioLevel(): Promise<number> {
    // Placeholder - in production, implement actual audio level metering
    // This would use the audio recorder's metering callback or native module
    // Return value in dB (typically -160 to 0)
    return -60; // Placeholder value
  }

  private handleRecordingProgress(data: { currentPosition: number; currentMetering?: number }): void {
    // Send audio chunk data if needed for real-time streaming
    // Note: For MJPEG-style audio, we'd send chunks periodically
    // This is a simplified implementation

    if (data.currentMetering !== undefined) {
      // Metering data available
    }
  }

  // Audio streaming (for live audio to dashboard)
  async startAudioStreaming(): Promise<void> {
    if (this.isRecording) {
      console.log('[Audio] Cannot stream while recording');
      return;
    }

    // Start recording to capture audio for streaming
    await this.startRecording('manual');
  }

  stopAudioStreaming(): void {
    this.stopRecording('manual');
  }

  private generateRecordingId(): string {
    return `rec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Cleanup
  destroy(): void {
    this.stopMonitoring();
    this.stopRecording();
  }
}

export const audioService = new AudioService();
