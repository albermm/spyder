/**
 * AudioService Tests
 */

import AudioRecorderPlayer from 'react-native-audio-recorder-player';
import { PermissionsAndroid, Platform } from 'react-native';

// Mock AudioRecorderPlayer
jest.mock('react-native-audio-recorder-player', () => {
  return jest.fn().mockImplementation(() => ({
    startRecorder: jest.fn(() => Promise.resolve('file://recording.m4a')),
    stopRecorder: jest.fn(() => Promise.resolve('file://recording.m4a')),
    addRecordBackListener: jest.fn(),
    removeRecordBackListener: jest.fn(),
  }));
});

// Mock React Native
jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
  PermissionsAndroid: {
    request: jest.fn(() => Promise.resolve('granted')),
    PERMISSIONS: {
      RECORD_AUDIO: 'android.permission.RECORD_AUDIO',
    },
    RESULTS: {
      GRANTED: 'granted',
    },
  },
}));

// Mock socketService
jest.mock('../../src/services/SocketService', () => ({
  socketService: {
    sendSoundDetected: jest.fn(),
    sendRecordingComplete: jest.fn(),
    resetAudioSequence: jest.fn(),
  },
}));

import { audioService } from '../../src/services/AudioService';
import { socketService } from '../../src/services/SocketService';

describe('AudioService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('requestPermissions', () => {
    it('should return true on iOS', async () => {
      const result = await audioService.requestPermissions();
      expect(result).toBe(true);
    });
  });

  describe('setSettings', () => {
    it('should update sound detection settings', () => {
      audioService.setSettings({
        enabled: false,
        threshold: -40,
        recordDuration: 60,
      });

      const settings = audioService.getSettings();
      expect(settings.enabled).toBe(false);
      expect(settings.threshold).toBe(-40);
      expect(settings.recordDuration).toBe(60);
    });

    it('should partially update settings', () => {
      audioService.setSettings({ threshold: -25 });

      const settings = audioService.getSettings();
      expect(settings.threshold).toBe(-25);
    });
  });

  describe('startRecording', () => {
    it('should start recording and reset audio sequence', async () => {
      await audioService.startRecording('manual');

      expect(socketService.resetAudioSequence).toHaveBeenCalled();
      expect(audioService.isCurrentlyRecording()).toBe(true);
    });

    it('should not start if already recording', async () => {
      await audioService.startRecording('manual');
      const consoleSpy = jest.spyOn(console, 'log');

      await audioService.startRecording('manual');

      expect(consoleSpy).toHaveBeenCalledWith('[Audio] Already recording');
    });
  });

  describe('stopRecording', () => {
    it('should stop recording and send completion notification', async () => {
      await audioService.startRecording('manual');
      await audioService.stopRecording('manual');

      expect(socketService.sendRecordingComplete).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'audio',
          triggeredBy: 'manual',
        })
      );
      expect(audioService.isCurrentlyRecording()).toBe(false);
    });
  });

  describe('startMonitoring', () => {
    it('should start sound level monitoring', async () => {
      await audioService.startMonitoring();
      expect(audioService.isCurrentlyMonitoring()).toBe(true);
    });
  });

  describe('stopMonitoring', () => {
    it('should stop sound level monitoring', async () => {
      await audioService.startMonitoring();
      audioService.stopMonitoring();
      expect(audioService.isCurrentlyMonitoring()).toBe(false);
    });
  });

  describe('destroy', () => {
    it('should cleanup monitoring and recording', async () => {
      await audioService.startMonitoring();
      await audioService.startRecording('manual');

      audioService.destroy();

      expect(audioService.isCurrentlyMonitoring()).toBe(false);
      expect(audioService.isCurrentlyRecording()).toBe(false);
    });
  });
});
