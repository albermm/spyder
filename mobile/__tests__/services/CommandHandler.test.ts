/**
 * CommandHandler Tests
 */

// Mock all services
jest.mock('../../src/services/SocketService', () => ({
  socketService: {
    on: jest.fn(),
    off: jest.fn(),
    sendCommandAck: jest.fn(),
    sendPhoto: jest.fn(),
  },
}));

jest.mock('../../src/services/CameraService', () => ({
  cameraService: {
    setSettings: jest.fn(),
    startStreaming: jest.fn(() => Promise.resolve()),
    stopStreaming: jest.fn(),
    capturePhoto: jest.fn(() =>
      Promise.resolve({ data: 'base64data', width: 640, height: 480 })
    ),
  },
}));

jest.mock('../../src/services/AudioService', () => ({
  audioService: {
    setSettings: jest.fn(),
    startAudioStreaming: jest.fn(() => Promise.resolve()),
    stopAudioStreaming: jest.fn(),
    startRecording: jest.fn(() => Promise.resolve()),
    stopRecording: jest.fn(() => Promise.resolve()),
    startMonitoring: jest.fn(() => Promise.resolve()),
    stopMonitoring: jest.fn(),
  },
}));

jest.mock('../../src/services/LocationService', () => ({
  locationService: {
    getCurrentLocation: jest.fn(() =>
      Promise.resolve({
        latitude: 37.7749,
        longitude: -122.4194,
        altitude: 10,
        accuracy: 5,
        speed: 0,
        heading: 0,
      })
    ),
  },
}));

jest.mock('../../src/services/StatusService', () => ({
  statusService: {
    sendStatus: jest.fn(() => Promise.resolve()),
  },
}));

import { commandHandler } from '../../src/services/CommandHandler';
import { socketService } from '../../src/services/SocketService';
import { cameraService } from '../../src/services/CameraService';
import { audioService } from '../../src/services/AudioService';
import { locationService } from '../../src/services/LocationService';
import { statusService } from '../../src/services/StatusService';

describe('CommandHandler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('initialize', () => {
    it('should register command listener', () => {
      commandHandler.initialize();

      expect(socketService.on).toHaveBeenCalledWith('command', expect.any(Function));
    });
  });

  describe('command handling', () => {
    let commandCallback: Function;

    beforeEach(() => {
      commandHandler.initialize();
      commandCallback = (socketService.on as jest.Mock).mock.calls.find(
        (call) => call[0] === 'command'
      )?.[1];
    });

    it('should handle start_camera command', async () => {
      await commandCallback({
        commandId: 'cmd-1',
        action: 'start_camera',
        params: { quality: 'high', fps: 15 },
      });

      expect(socketService.sendCommandAck).toHaveBeenCalledWith('cmd-1', 'executing');
      expect(cameraService.setSettings).toHaveBeenCalledWith({ quality: 'high', fps: 15 });
      expect(cameraService.startStreaming).toHaveBeenCalled();
      expect(socketService.sendCommandAck).toHaveBeenCalledWith('cmd-1', 'completed');
    });

    it('should handle stop_camera command', async () => {
      await commandCallback({
        commandId: 'cmd-2',
        action: 'stop_camera',
      });

      expect(cameraService.stopStreaming).toHaveBeenCalled();
      expect(socketService.sendCommandAck).toHaveBeenCalledWith('cmd-2', 'completed');
    });

    it('should handle capture_photo command', async () => {
      await commandCallback({
        commandId: 'cmd-3',
        action: 'capture_photo',
      });

      expect(cameraService.capturePhoto).toHaveBeenCalled();
      expect(socketService.sendPhoto).toHaveBeenCalledWith(
        expect.objectContaining({
          data: 'base64data',
          width: 640,
          height: 480,
        })
      );
    });

    it('should handle start_audio command', async () => {
      await commandCallback({
        commandId: 'cmd-4',
        action: 'start_audio',
      });

      expect(audioService.startAudioStreaming).toHaveBeenCalled();
      expect(socketService.sendCommandAck).toHaveBeenCalledWith('cmd-4', 'completed');
    });

    it('should handle stop_audio command', async () => {
      await commandCallback({
        commandId: 'cmd-5',
        action: 'stop_audio',
      });

      expect(audioService.stopAudioStreaming).toHaveBeenCalled();
    });

    it('should handle get_location command', async () => {
      await commandCallback({
        commandId: 'cmd-6',
        action: 'get_location',
      });

      expect(locationService.getCurrentLocation).toHaveBeenCalled();
      expect(socketService.sendCommandAck).toHaveBeenCalledWith('cmd-6', 'completed');
    });

    it('should handle get_status command', async () => {
      await commandCallback({
        commandId: 'cmd-7',
        action: 'get_status',
      });

      expect(statusService.sendStatus).toHaveBeenCalled();
      expect(socketService.sendCommandAck).toHaveBeenCalledWith('cmd-7', 'completed');
    });

    it('should handle set_sound_threshold command', async () => {
      await commandCallback({
        commandId: 'cmd-8',
        action: 'set_sound_threshold',
        params: { threshold: -35, duration: 45 },
      });

      expect(audioService.setSettings).toHaveBeenCalledWith({
        threshold: -35,
        recordDuration: 45,
      });
    });

    it('should handle enable_sound_detection command', async () => {
      await commandCallback({
        commandId: 'cmd-9',
        action: 'enable_sound_detection',
      });

      expect(audioService.setSettings).toHaveBeenCalledWith({ enabled: true });
      expect(audioService.startMonitoring).toHaveBeenCalled();
    });

    it('should handle disable_sound_detection command', async () => {
      await commandCallback({
        commandId: 'cmd-10',
        action: 'disable_sound_detection',
      });

      expect(audioService.setSettings).toHaveBeenCalledWith({ enabled: false });
      expect(audioService.stopMonitoring).toHaveBeenCalled();
    });

    it('should handle unknown command with error', async () => {
      await commandCallback({
        commandId: 'cmd-11',
        action: 'unknown_action',
      });

      expect(socketService.sendCommandAck).toHaveBeenCalledWith(
        'cmd-11',
        'failed',
        'Unknown action: unknown_action'
      );
    });

    it('should handle command failure', async () => {
      (cameraService.startStreaming as jest.Mock).mockRejectedValueOnce(
        new Error('Camera not available')
      );

      await commandCallback({
        commandId: 'cmd-12',
        action: 'start_camera',
      });

      expect(socketService.sendCommandAck).toHaveBeenCalledWith(
        'cmd-12',
        'failed',
        'Camera not available'
      );
    });
  });

  describe('destroy', () => {
    it('should unregister command listener', () => {
      commandHandler.destroy();

      expect(socketService.off).toHaveBeenCalledWith('command', expect.any(Function));
    });
  });
});
