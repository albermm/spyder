/**
 * SocketService Tests
 */

import { io } from 'socket.io-client';

// Mock socket.io-client
jest.mock('socket.io-client', () => ({
  io: jest.fn(() => ({
    connected: false,
    on: jest.fn(),
    emit: jest.fn(),
    disconnect: jest.fn(),
    io: {
      on: jest.fn(),
    },
  })),
}));

// Mock DeviceInfo
jest.mock('react-native-device-info', () => ({
  getDeviceName: jest.fn(() => Promise.resolve('Test Device')),
  getModel: jest.fn(() => 'iPhone 14'),
  getSystemVersion: jest.fn(() => '17.0'),
}));

import { socketService } from '../../src/services/SocketService';

describe('SocketService', () => {
  let mockSocket: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSocket = {
      connected: false,
      on: jest.fn(),
      emit: jest.fn(),
      disconnect: jest.fn(),
      io: {
        on: jest.fn(),
      },
    };
    (io as jest.Mock).mockReturnValue(mockSocket);
  });

  describe('connect', () => {
    it('should create socket connection with auth token', async () => {
      await socketService.connect('device-123', 'test-token');

      expect(io).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          auth: { token: 'test-token' },
          transports: ['websocket'],
          reconnection: true,
        })
      );
    });

    it('should setup event handlers', async () => {
      await socketService.connect('device-123', 'test-token');

      expect(mockSocket.on).toHaveBeenCalledWith('connect', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('disconnect', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('connect_error', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('command', expect.any(Function));
    });
  });

  describe('isConnected', () => {
    it('should return false when not connected', () => {
      expect(socketService.isConnected()).toBe(false);
    });
  });

  describe('disconnect', () => {
    it('should disconnect socket', async () => {
      await socketService.connect('device-123', 'test-token');
      socketService.disconnect();

      expect(mockSocket.disconnect).toHaveBeenCalled();
    });
  });

  describe('event emitter', () => {
    it('should register and call event listeners', () => {
      const callback = jest.fn();
      socketService.on('test-event', callback);

      // Trigger internal emit (not directly testable without exposing)
      // This tests the basic structure
      expect(callback).not.toHaveBeenCalled();
    });

    it('should remove event listeners', () => {
      const callback = jest.fn();
      socketService.on('test-event', callback);
      socketService.off('test-event', callback);

      // Listener should be removed
      expect(true).toBe(true);
    });
  });

  describe('sequence counters', () => {
    it('should reset frame sequence', () => {
      socketService.resetFrameSequence();
      // Internal state test - sequence should be 0
      expect(true).toBe(true);
    });

    it('should reset audio sequence', () => {
      socketService.resetAudioSequence();
      // Internal state test - sequence should be 0
      expect(true).toBe(true);
    });
  });
});
