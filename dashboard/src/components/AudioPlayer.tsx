/**
 * RemoteEye Dashboard - Audio Player Component
 * Uses Web Audio API to play live audio from device
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { socketService } from '../services/SocketService';
import type { AudioChunk } from '../types';

interface AudioPlayerProps {
  deviceId: string;
}

// Audio configuration (must match mobile app)
const SAMPLE_RATE = 44100;
const CHANNELS = 1;

export function AudioPlayer({ deviceId }: AudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(1);
  const [audioLevel, setAudioLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const nextPlayTimeRef = useRef<number>(0);
  const bufferQueueRef = useRef<AudioBuffer[]>([]);
  const isProcessingRef = useRef(false);

  // Initialize Audio Context
  const initAudioContext = useCallback(() => {
    if (audioContextRef.current) return;

    try {
      audioContextRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)({
        sampleRate: SAMPLE_RATE,
      });

      gainNodeRef.current = audioContextRef.current.createGain();
      gainNodeRef.current.connect(audioContextRef.current.destination);
      gainNodeRef.current.gain.value = volume;

      nextPlayTimeRef.current = audioContextRef.current.currentTime;
      setError(null);
    } catch (err) {
      setError('Failed to initialize audio context');
      console.error('[AudioPlayer] Init error:', err);
    }
  }, [volume]);

  // Decode base64 PCM to AudioBuffer
  const decodeAudioChunk = useCallback(async (chunk: AudioChunk): Promise<AudioBuffer | null> => {
    if (!audioContextRef.current) return null;

    try {
      // Decode base64 to binary
      const binaryString = atob(chunk.data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Convert 16-bit PCM to Float32
      const int16Array = new Int16Array(bytes.buffer);
      const float32Array = new Float32Array(int16Array.length);

      let maxSample = 0;
      for (let i = 0; i < int16Array.length; i++) {
        float32Array[i] = int16Array[i] / 32768.0;
        maxSample = Math.max(maxSample, Math.abs(float32Array[i]));
      }

      // Update audio level meter
      setAudioLevel(maxSample);

      // Create AudioBuffer
      const sampleRate = chunk.sampleRate || SAMPLE_RATE;
      const channels = chunk.channels || CHANNELS;
      const audioBuffer = audioContextRef.current.createBuffer(
        channels,
        float32Array.length,
        sampleRate
      );
      audioBuffer.getChannelData(0).set(float32Array);

      return audioBuffer;
    } catch (err) {
      console.error('[AudioPlayer] Decode error:', err);
      return null;
    }
  }, []);

  // Schedule audio buffer for playback
  const scheduleBuffer = useCallback((buffer: AudioBuffer) => {
    if (!audioContextRef.current || !gainNodeRef.current) return;

    const source = audioContextRef.current.createBufferSource();
    source.buffer = buffer;
    source.connect(gainNodeRef.current);

    const currentTime = audioContextRef.current.currentTime;
    if (nextPlayTimeRef.current < currentTime) {
      nextPlayTimeRef.current = currentTime;
    }

    source.start(nextPlayTimeRef.current);
    nextPlayTimeRef.current += buffer.duration;
  }, []);

  // Process buffer queue
  const processQueue = useCallback(() => {
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;

    while (bufferQueueRef.current.length > 0) {
      const buffer = bufferQueueRef.current.shift();
      if (buffer) {
        scheduleBuffer(buffer);
      }
    }

    isProcessingRef.current = false;
  }, [scheduleBuffer]);

  // Handle incoming audio chunk
  const handleAudioChunk = useCallback(async (chunk: AudioChunk) => {
    if (!isPlaying) return;

    const buffer = await decodeAudioChunk(chunk);
    if (buffer) {
      bufferQueueRef.current.push(buffer);
      processQueue();
    }
  }, [isPlaying, decodeAudioChunk, processQueue]);

  // Start audio playback
  const startPlayback = useCallback(() => {
    initAudioContext();

    if (audioContextRef.current?.state === 'suspended') {
      audioContextRef.current.resume();
    }

    setIsPlaying(true);
    socketService.startAudio();
  }, [initAudioContext]);

  // Stop audio playback
  const stopPlayback = useCallback(() => {
    setIsPlaying(false);
    setAudioLevel(0);
    socketService.stopAudio();

    // Clear buffer queue
    bufferQueueRef.current = [];
    if (audioContextRef.current) {
      nextPlayTimeRef.current = audioContextRef.current.currentTime;
    }
  }, []);

  // Update volume
  useEffect(() => {
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = volume;
    }
  }, [volume]);

  // Subscribe to audio events
  useEffect(() => {
    socketService.on('audio', handleAudioChunk);
    return () => {
      socketService.off('audio', handleAudioChunk);
    };
  }, [handleAudioChunk]);

  // Cleanup on unmount or device change
  useEffect(() => {
    return () => {
      stopPlayback();
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
    };
  }, [deviceId, stopPlayback]);

  return (
    <div className="bg-slate-800 rounded-xl p-4">
      <h3 className="text-lg font-semibold text-white mb-4">Live Audio</h3>

      {error && (
        <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3 mb-4">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Audio Level Meter */}
      <div className="mb-4">
        <div className="h-3 bg-slate-700 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-75 ${
              audioLevel > 0.7 ? 'bg-red-500' : audioLevel > 0.4 ? 'bg-yellow-500' : 'bg-green-500'
            }`}
            style={{ width: `${Math.min(audioLevel * 100, 100)}%` }}
          />
        </div>
        <p className="text-slate-400 text-xs mt-1">Audio Level</p>
      </div>

      {/* Volume Control */}
      <div className="mb-4">
        <label className="text-slate-400 text-sm mb-2 block">
          Volume: {Math.round(volume * 100)}%
        </label>
        <input
          type="range"
          min="0"
          max="1"
          step="0.1"
          value={volume}
          onChange={(e) => setVolume(parseFloat(e.target.value))}
          className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
        />
      </div>

      {/* Play/Stop Button */}
      <button
        onClick={isPlaying ? stopPlayback : startPlayback}
        className={`w-full py-3 rounded-lg font-medium transition flex items-center justify-center gap-2 ${
          isPlaying
            ? 'bg-red-600 hover:bg-red-700 text-white'
            : 'bg-blue-600 hover:bg-blue-700 text-white'
        }`}
      >
        {isPlaying ? (
          <>
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <rect x="6" y="4" width="4" height="16" rx="1" />
              <rect x="14" y="4" width="4" height="16" rx="1" />
            </svg>
            Stop Listening
          </>
        ) : (
          <>
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
            Start Listening
          </>
        )}
      </button>

      {isPlaying && (
        <p className="text-green-400 text-xs text-center mt-2 animate-pulse">
          Receiving live audio...
        </p>
      )}
    </div>
  );
}
