/**
 * RemoteEye Mobile - Audio Service
 * Handles audio streaming and recording to R2.
 */

import LiveAudioStream from 'react-native-live-audio-stream';
import { AppState, Platform, PermissionsAndroid } from 'react-native';
import RNFS from 'react-native-fs';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CONFIG, getServerUrl } from '../config';
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

/**
 * Create a WAV file header for raw PCM audio data.
 * Returns a base64-encoded header that can be prepended to audio data.
 */
function createWavHeader(dataLength: number, sampleRate: number, channels: number, bitsPerSample: number): string {
  const byteRate = sampleRate * channels * (bitsPerSample / 8);
  const blockAlign = channels * (bitsPerSample / 8);
  const headerLength = 44;
  const fileSize = dataLength + headerLength - 8;

  const buffer = new ArrayBuffer(headerLength);
  const view = new DataView(buffer);

  // "RIFF" chunk descriptor
  view.setUint8(0, 0x52); // R
  view.setUint8(1, 0x49); // I
  view.setUint8(2, 0x46); // F
  view.setUint8(3, 0x46); // F
  view.setUint32(4, fileSize, true); // File size - 8
  view.setUint8(8, 0x57);  // W
  view.setUint8(9, 0x41);  // A
  view.setUint8(10, 0x56); // V
  view.setUint8(11, 0x45); // E

  // "fmt " sub-chunk
  view.setUint8(12, 0x66); // f
  view.setUint8(13, 0x6D); // m
  view.setUint8(14, 0x74); // t
  view.setUint8(15, 0x20); // (space)
  view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
  view.setUint16(20, 1, true);  // AudioFormat (1 for PCM)
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);

  // "data" sub-chunk
  view.setUint8(36, 0x64); // d
  view.setUint8(37, 0x61); // a
  view.setUint8(38, 0x74); // t
  view.setUint8(39, 0x61); // a
  view.setUint32(40, dataLength, true);

  // Convert to base64
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
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

  // Audio data accumulator - stores base64 chunks during recording
  private audioChunks: string[] = [];
  private totalAudioBytes: number = 0;

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

    // Initialize the audio stream (note: wavFile option is NOT supported on iOS)
    LiveAudioStream.init({
      sampleRate: SAMPLE_RATE,
      channels: CHANNELS,
      bitsPerSample: BITS_PER_SAMPLE,
      audioSource: 6,
      bufferSize: BUFFER_SIZE,
    });

    LiveAudioStream.on('data', (data: string) => {
      if (this.isStreaming) {
        // Accumulate audio chunks for WAV file creation
        this.audioChunks.push(data);
        // Calculate byte size from base64 (base64 is ~4/3 the size of raw data)
        this.totalAudioBytes += Math.floor((data.length * 3) / 4);

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
      // Generate a new recording ID and file path for this recording
      this.currentRecordingId = this.generateRecordingId();
      const baseDir = Platform.OS === 'ios' ? RNFS.DocumentDirectoryPath : RNFS.CachesDirectoryPath;
      this.localRecordingPath = `${baseDir}/${this.currentRecordingId}.wav`;

      // Clear accumulated audio data from any previous recording
      this.audioChunks = [];
      this.totalAudioBytes = 0;

      this.recordingStartTime = Date.now();
      console.log(`[Audio] Starting audio streaming: ${this.currentRecordingId}`);
      console.log(`[Audio] Will save to: ${this.localRecordingPath}`);

      socketService.resetAudioSequence();
      LiveAudioStream.start();
      this.isStreaming = true;

      console.log('[Audio] Audio streaming started');

      // Report status to server
      socketService.reportStatus('recording', { recordingId: this.currentRecordingId });
    } catch (error) {
      this.isStreaming = false;
      this.currentRecordingId = null;
      this.localRecordingPath = null;
      this.audioChunks = [];
      this.totalAudioBytes = 0;
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error('[Audio] Failed to start audio streaming:', errorMsg);
      throw new Error(`Audio streaming failed: ${errorMsg}`);
    }
  }

  async stopAudioStreaming(): Promise<void> {
    if (!this.isStreaming) return;

    // Capture these before resetting state
    const recordingId = this.currentRecordingId;
    const localPath = this.localRecordingPath;
    const audioChunks = [...this.audioChunks]; // Copy the chunks
    const totalBytes = this.totalAudioBytes;

    try {
      await LiveAudioStream.stop();
      const duration = Math.floor((Date.now() - this.recordingStartTime) / 1000);
      console.log(`[Audio] Audio streaming stopped. Duration: ${duration}s, Chunks: ${audioChunks.length}, Bytes: ${totalBytes}`);

      // Save accumulated audio data to WAV file, then upload
      if (localPath && recordingId && audioChunks.length > 0) {
        try {
          await this.saveAudioToWavFile(localPath, audioChunks, totalBytes);
          console.log(`[Audio] Local recording saved at: ${localPath}`);

          // Upload to R2 in background (don't block the stop process)
          this.uploadToR2(localPath, recordingId, duration, 'manual').catch(err =>
            console.error('[Audio] R2 Upload failed in background:', err)
          );
        } catch (saveError) {
          console.error('[Audio] Failed to save WAV file:', saveError);
          socketService.sendUploadFailed({
            recordingId: recordingId,
            mediaType: 'audio',
            error: `Failed to save WAV file: ${saveError}`,
            filename: `${recordingId}.wav`,
          });
        }
      } else if (recordingId) {
        console.warn('[Audio] No audio data to save');
        socketService.sendUploadFailed({
          recordingId: recordingId,
          mediaType: 'audio',
          error: 'No audio data captured',
          filename: `${recordingId}.wav`,
        });
      }

    } catch (error) {
      console.error('[Audio] Failed to stop audio streaming:', error);
    } finally {
      this.isStreaming = false;
      this.currentRecordingId = null;
      this.localRecordingPath = null;
      this.audioChunks = [];
      this.totalAudioBytes = 0;

      // Report status back to online
      socketService.reportStatus('online');
    }
  }

  /**
   * Save accumulated audio chunks to a WAV file.
   * Creates a proper WAV header and writes all audio data.
   */
  private async saveAudioToWavFile(filePath: string, chunks: string[], totalBytes: number): Promise<void> {
    console.log(`[Audio] Saving ${chunks.length} chunks (${totalBytes} bytes) to WAV file`);

    // Create WAV header
    const wavHeader = createWavHeader(totalBytes, SAMPLE_RATE, CHANNELS, BITS_PER_SAMPLE);

    // Combine all base64 chunks into one
    // First decode all chunks, combine, then re-encode
    // This is memory-intensive but necessary for proper WAV file creation
    const allAudioData = chunks.join('');

    // Write header + audio data
    // Note: We write the header first, then append the audio data
    await RNFS.writeFile(filePath, wavHeader, 'base64');
    await RNFS.appendFile(filePath, allAudioData, 'base64');

    // Verify the file was created
    const exists = await RNFS.exists(filePath);
    if (!exists) {
      throw new Error('WAV file was not created');
    }

    const stat = await RNFS.stat(filePath);
    console.log(`[Audio] WAV file created: ${stat.size} bytes`);
  }

  /**
   * Upload recorded audio directly to R2 and notify server.
   * Reports failures to server to close the "silent failure" reliability gap.
   */
  private async uploadToR2(
    localFilePath: string,
    recordingId: string,
    duration: number,
    triggeredBy: 'manual' | 'sound_detection' = 'manual'
  ): Promise<void> {
    this.isUploading = true;
    const filename = `${recordingId}.wav`;
    console.log(`[Audio] Starting upload for ${filename}`);

    try {
      // 1. Get device ID from storage
      const deviceId = await AsyncStorage.getItem(CONFIG.STORAGE_KEYS.DEVICE_ID);
      if (!deviceId) {
        throw new Error('Device not registered');
      }

      // 2. Get presigned URL from server
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
          content_type: 'audio/wav',
          media_type: 'audio',
        }),
      });

      if (!presignedResponse.ok) {
        throw new Error(`Failed to get presigned URL: ${presignedResponse.status}`);
      }

      const { url, key }: PresignedUrlResponse = await presignedResponse.json();
      console.log(`[Audio] Got presigned URL for: ${key}`);

      // 3. Read the local file as base64
      const base64Data = await RNFS.readFile(localFilePath, 'base64');

      // 4. Convert base64 to Blob and upload directly to R2
      const audioBlob = await fetch(`data:audio/wav;base64,${base64Data}`).then(res => res.blob());
      const size = audioBlob.size;

      const uploadResponse = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'audio/wav' },
        body: audioBlob,
      });

      if (!uploadResponse.ok) {
        throw new Error(`R2 upload failed: ${uploadResponse.status}`);
      }

      console.log(`[Audio] Successfully uploaded ${filename} to R2`);

      // 5. Notify server that upload is complete (creates database record)
      socketService.sendAudioUploadComplete({
        recordingId,
        storageKey: key,
        filename,
        size,
        duration,
        triggeredBy,
      });

      // 6. Clean up local file after successful upload
      try {
        await RNFS.unlink(localFilePath);
        console.log(`[Audio] Cleaned up local file: ${localFilePath}`);
      } catch {
        // Ignore cleanup errors
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[Audio] R2 Upload Error: ${errorMessage}`);

      // CRITICAL: Report failure to server to close the reliability gap
      socketService.sendUploadFailed({
        recordingId,
        mediaType: 'audio',
        error: errorMessage,
        filename,
      });

    } finally {
      this.isUploading = false;
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