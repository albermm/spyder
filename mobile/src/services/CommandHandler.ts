/**
 * RemoteEye Mobile - Command Handler
 * Processes commands received from the server/dashboard
 */

import { socketService } from './SocketService';
import { cameraService } from './CameraService';
import { audioService } from './AudioService';
import { locationService } from './LocationService';
import { statusService } from './StatusService';
import type { Command, CommandAction } from '../types';

type CommandHandler = (params?: Record<string, unknown>) => Promise<void>;

class CommandHandlerService {
  private handlers: Map<CommandAction, CommandHandler>;

  constructor() {
    this.handlers = new Map([
      ['start_camera', this.handleStartCamera.bind(this)],
      ['stop_camera', this.handleStopCamera.bind(this)],
      ['switch_camera', this.handleSwitchCamera.bind(this)],
      ['start_audio', this.handleStartAudio.bind(this)],
      ['stop_audio', this.handleStopAudio.bind(this)],
      ['capture_photo', this.handleCapturePhoto.bind(this)],
      ['start_recording', this.handleStartRecording.bind(this)],
      ['stop_recording', this.handleStopRecording.bind(this)],
      ['get_location', this.handleGetLocation.bind(this)],
      ['get_status', this.handleGetStatus.bind(this)],
      ['set_sound_threshold', this.handleSetSoundThreshold.bind(this)],
      ['enable_sound_detection', this.handleEnableSoundDetection.bind(this)],
      ['disable_sound_detection', this.handleDisableSoundDetection.bind(this)],
    ]);
  }

  initialize(): void {
    socketService.on('command', this.handleCommand.bind(this));
    console.log('[CommandHandler] Initialized');
  }

  private async handleCommand(command: Command): Promise<void> {
    const { commandId, action, params } = command;
    console.log(`[CommandHandler] Received command: ${action}`);

    const handler = this.handlers.get(action);
    if (!handler) {
      console.error(`[CommandHandler] Unknown action: ${action}`);
      socketService.sendCommandAck(commandId, 'failed', `Unknown action: ${action}`);
      return;
    }

    try {
      socketService.sendCommandAck(commandId, 'executing');
      await handler(params);
      socketService.sendCommandAck(commandId, 'completed');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[CommandHandler] Command failed:`, message);
      socketService.sendCommandAck(commandId, 'failed', message);
    }
  }

  // Camera commands
  private async handleStartCamera(params?: Record<string, unknown>): Promise<void> {
    if (params) {
      const quality = params.quality as 'low' | 'medium' | 'high' | undefined;
      const fps = params.fps as number | undefined;

      if (quality || fps) {
        cameraService.setSettings({
          ...(quality && { quality }),
          ...(fps && { fps }),
        });
      }
    }
    await cameraService.startStreaming();
  }

  private async handleStopCamera(): Promise<void> {
    cameraService.stopStreaming();
  }

  private async handleSwitchCamera(params?: Record<string, unknown>): Promise<void> {
    const previousPosition = cameraService.getCameraPosition();
    const wasStreaming = cameraService.isCurrentlyStreaming();

    console.log(`[CommandHandler] Switch camera requested. Current: ${previousPosition}, Streaming: ${wasStreaming}`);

    // Determine target position
    let targetPosition: 'front' | 'back';
    if (params?.position === 'front' || params?.position === 'back') {
      targetPosition = params.position;
    } else {
      targetPosition = previousPosition === 'back' ? 'front' : 'back';
    }

    console.log(`[CommandHandler] Switching camera from ${previousPosition} to ${targetPosition}`);

    // If already at target position, nothing to do
    if (previousPosition === targetPosition) {
      console.log(`[CommandHandler] Camera already at ${targetPosition}, no switch needed`);
      return;
    }

    try {
      // If streaming, we need to handle the transition carefully
      if (wasStreaming) {
        console.log('[CommandHandler] Stopping stream for camera switch...');
        cameraService.stopStreaming();

        // Wait for camera to fully stop
        await new Promise(resolve => setTimeout(resolve, 300));
      }

      // Switch the camera position
      cameraService.setCameraPosition(targetPosition);

      // Wait for the new camera device to be ready
      // This gives React time to re-render with the new device
      console.log('[CommandHandler] Waiting for camera ref to be ready...');
      const cameraReady = await cameraService.waitForCameraReady(2000);
      if (!cameraReady) {
        console.warn('[CommandHandler] Camera ref not ready after switch, continuing anyway...');
      }

      // Restart streaming if it was active
      if (wasStreaming) {
        console.log('[CommandHandler] Restarting stream with new camera...');
        await cameraService.startStreaming();
      }

      const newPosition = cameraService.getCameraPosition();
      console.log(`[CommandHandler] Camera switch complete. Now using: ${newPosition}`);

      // Verify the switch actually happened
      if (newPosition !== targetPosition) {
        throw new Error(`Camera switch failed: expected ${targetPosition}, got ${newPosition}`);
      }

    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[CommandHandler] Camera switch error: ${message}`);

      // Try to restore streaming if it was active
      if (wasStreaming && !cameraService.isCurrentlyStreaming()) {
        console.log('[CommandHandler] Attempting to restore streaming after switch failure...');
        try {
          await cameraService.startStreaming();
        } catch (restoreError) {
          console.error('[CommandHandler] Failed to restore streaming:', restoreError);
        }
      }

      throw error;
    }
  }

  private async handleCapturePhoto(): Promise<void> {
    // Use direct R2 upload - bypasses server bandwidth entirely
    await cameraService.captureAndUploadPhoto();
  }

  // Audio commands
  private async handleStartAudio(): Promise<void> {
    // Stop camera first - iOS may have audio session conflicts
    if (cameraService.isCurrentlyStreaming()) {
      console.log('[CommandHandler] Stopping camera before starting audio');
      cameraService.stopStreaming();
      // Give iOS time to release the audio session
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    console.log('[CommandHandler] Starting audio streaming...');
    await audioService.startAudioStreaming();
  }

  private async handleStopAudio(): Promise<void> {
    audioService.stopAudioStreaming();
  }

  private async handleStartRecording(): Promise<void> {
    await audioService.startRecording('manual');
  }

  private async handleStopRecording(): Promise<void> {
    await audioService.stopRecording('manual');
  }

  // Sound detection commands
  private async handleSetSoundThreshold(params?: Record<string, unknown>): Promise<void> {
    if (!params?.threshold) {
      throw new Error('Threshold parameter required');
    }

    const threshold = params.threshold as number;
    const duration = (params.duration as number) || undefined;

    audioService.setSettings({
      threshold,
      ...(duration && { recordDuration: duration }),
    });
  }

  private async handleEnableSoundDetection(): Promise<void> {
    audioService.setSettings({ enabled: true });
    await audioService.startMonitoring();
  }

  private async handleDisableSoundDetection(): Promise<void> {
    audioService.setSettings({ enabled: false });
    audioService.stopMonitoring();
  }

  // Location commands
  private async handleGetLocation(): Promise<void> {
    const location = await locationService.getCurrentLocation();
    if (!location) {
      throw new Error('Failed to get location');
    }
    // Location is automatically sent by locationService
  }

  // Status commands
  private async handleGetStatus(): Promise<void> {
    await statusService.sendStatus();
  }

  // Cleanup
  destroy(): void {
    socketService.off('command', this.handleCommand.bind(this));
  }
}

export const commandHandler = new CommandHandlerService();
