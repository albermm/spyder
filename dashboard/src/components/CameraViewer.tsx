/**
 * RemoteEye Dashboard - Camera Viewer Component
 * Displays MJPEG stream from device
 */

import { useState, useEffect, useRef } from 'react';
import { socketService } from '../services/SocketService';
import type { CameraFrame } from '../types';

interface CameraViewerProps {
  deviceId: string | null;
  className?: string;
}

export function CameraViewer({ deviceId, className = '' }: CameraViewerProps) {
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentFrame, setCurrentFrame] = useState<string | null>(null);
  const [fps, setFps] = useState(0);
  const [quality, setQuality] = useState<'low' | 'medium' | 'high'>('medium');
  const frameCountRef = useRef(0);
  const lastFrameTimeRef = useRef(Date.now());

  useEffect(() => {
    const handleFrame = (frame: CameraFrame) => {
      setCurrentFrame(`data:image/jpeg;base64,${frame.data}`);
      frameCountRef.current++;

      // Calculate FPS every second
      const now = Date.now();
      if (now - lastFrameTimeRef.current >= 1000) {
        setFps(frameCountRef.current);
        frameCountRef.current = 0;
        lastFrameTimeRef.current = now;
      }
    };

    socketService.on('frame', handleFrame);

    return () => {
      socketService.off('frame', handleFrame);
    };
  }, []);

  const startStream = () => {
    if (!deviceId) return;
    socketService.startCamera(quality);
    setIsStreaming(true);
  };

  const stopStream = () => {
    socketService.stopCamera();
    setIsStreaming(false);
    setCurrentFrame(null);
    setFps(0);
  };

  const capturePhoto = () => {
    socketService.capturePhoto();
  };

  return (
    <div className={`bg-slate-800 rounded-xl p-4 ${className}`}>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-white">Live Camera</h3>
        <div className="flex items-center gap-2 text-sm text-slate-400">
          {isStreaming && (
            <>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                LIVE
              </span>
              <span>{fps} FPS</span>
            </>
          )}
        </div>
      </div>

      {/* Video display */}
      <div className="relative aspect-video bg-slate-900 rounded-lg overflow-hidden mb-4">
        {currentFrame ? (
          <img
            src={currentFrame}
            alt="Camera stream"
            className="w-full h-full object-contain"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-slate-500">
            {deviceId ? 'Click Start to begin streaming' : 'Select a device'}
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-3">
        {/* Quality selector */}
        <select
          value={quality}
          onChange={(e) => setQuality(e.target.value as 'low' | 'medium' | 'high')}
          className="bg-slate-700 text-white px-3 py-2 rounded-lg text-sm"
          disabled={isStreaming}
        >
          <option value="low">Low (320p)</option>
          <option value="medium">Medium (480p)</option>
          <option value="high">High (720p)</option>
        </select>

        {/* Stream controls */}
        {!isStreaming ? (
          <button
            onClick={startStream}
            disabled={!deviceId}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-medium transition"
          >
            Start Stream
          </button>
        ) : (
          <button
            onClick={stopStream}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
          >
            Stop Stream
          </button>
        )}

        {/* Capture photo */}
        <button
          onClick={capturePhoto}
          disabled={!deviceId}
          className="bg-slate-600 hover:bg-slate-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-medium transition"
        >
          Capture Photo
        </button>
      </div>
    </div>
  );
}
