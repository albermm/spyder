/**
 * RemoteEye Dashboard - Recordings List Component
 * Displays recording history with upload status indicators
 */

import { useState, useEffect, useCallback } from 'react';
import { authService } from '../services/AuthService';
import { socketService } from '../services/SocketService';
import type { Recording } from '../types';

interface RecordingsListProps {
  deviceId: string;
}

function formatDuration(seconds?: number): string {
  if (!seconds) return '-';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleString();
}

export function RecordingsList({ deviceId }: RecordingsListProps) {
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'audio' | 'photo'>('all');
  const [expandedError, setExpandedError] = useState<string | null>(null);

  const loadRecordings = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const typeFilter = filter === 'all' ? undefined : filter;
      const result = await authService.getRecordings(deviceId, {
        type: typeFilter,
        limit: 50,
      });

      setRecordings(result.recordings);
    } catch (err) {
      setError('Failed to load recordings');
      console.error('[RecordingsList] Error:', err);
    } finally {
      setLoading(false);
    }
  }, [deviceId, filter]);

  // Load recordings on mount and filter change
  useEffect(() => {
    loadRecordings();
  }, [loadRecordings]);

  // Listen for new recordings via WebSocket
  useEffect(() => {
    const handleRecordingComplete = () => {
      // Reload the list when a new recording is completed
      loadRecordings();
    };

    const handleUploadFailed = () => {
      // Reload the list when an upload fails
      loadRecordings();
    };

    socketService.on('recordingComplete', handleRecordingComplete);
    socketService.on('uploadFailed', handleUploadFailed);

    return () => {
      socketService.off('recordingComplete', handleRecordingComplete);
      socketService.off('uploadFailed', handleUploadFailed);
    };
  }, [loadRecordings]);

  const handleDownload = (recording: Recording) => {
    if (recording.status === 'upload_failed') {
      return; // Cannot download failed uploads
    }
    const url = authService.getDownloadUrl(recording.id);
    window.open(url, '_blank');
  };

  const toggleErrorDetails = (recordingId: string) => {
    setExpandedError(expandedError === recordingId ? null : recordingId);
  };

  const getStatusIcon = (recording: Recording) => {
    if (recording.status === 'upload_failed') {
      return (
        <div className="relative group">
          <svg
            className="w-5 h-5 text-red-500 cursor-pointer"
            fill="currentColor"
            viewBox="0 0 20 20"
            onClick={() => toggleErrorDetails(recording.id)}
          >
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
          <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 text-xs bg-slate-700 text-white rounded opacity-0 group-hover:opacity-100 transition whitespace-nowrap">
            Upload Failed - Click for details
          </span>
        </div>
      );
    }

    // Completed/success
    return (
      <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
        <path
          fillRule="evenodd"
          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
          clipRule="evenodd"
        />
      </svg>
    );
  };

  const getTypeIcon = (type: 'audio' | 'photo') => {
    if (type === 'audio') {
      return (
        <svg className="w-5 h-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z"
            clipRule="evenodd"
          />
        </svg>
      );
    }
    return (
      <svg className="w-5 h-5 text-purple-400" fill="currentColor" viewBox="0 0 20 20">
        <path
          fillRule="evenodd"
          d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z"
          clipRule="evenodd"
        />
      </svg>
    );
  };

  return (
    <div className="bg-slate-800 rounded-xl p-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-white">Recordings</h3>
        <div className="flex gap-2">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as 'all' | 'audio' | 'photo')}
            className="bg-slate-700 text-white text-sm rounded-lg px-3 py-1.5 border border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Types</option>
            <option value="audio">Audio Only</option>
            <option value="photo">Photos Only</option>
          </select>
          <button
            onClick={loadRecordings}
            className="bg-slate-700 hover:bg-slate-600 text-white px-3 py-1.5 rounded-lg text-sm transition"
          >
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3 mb-4">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="text-slate-400 text-center py-8">Loading recordings...</div>
      ) : recordings.length === 0 ? (
        <div className="text-slate-500 text-center py-8">
          No recordings found for this device.
        </div>
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {recordings.map((recording) => (
            <div key={recording.id}>
              <div
                className={`flex items-center gap-3 p-3 rounded-lg transition cursor-pointer ${
                  recording.status === 'upload_failed'
                    ? 'bg-red-900/20 hover:bg-red-900/30 border border-red-800/50'
                    : 'bg-slate-700/50 hover:bg-slate-700'
                }`}
                onClick={() => handleDownload(recording)}
              >
                {/* Type Icon */}
                <div className="flex-shrink-0">{getTypeIcon(recording.type)}</div>

                {/* Recording Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-white text-sm font-medium truncate">
                      {recording.filename}
                    </span>
                    {recording.triggeredBy === 'sound_detection' && (
                      <span className="bg-yellow-500/20 text-yellow-400 text-xs px-1.5 py-0.5 rounded">
                        Auto
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-slate-400 text-xs mt-0.5">
                    <span>{formatDate(recording.createdAt)}</span>
                    {recording.duration && <span>{formatDuration(recording.duration)}</span>}
                    <span>{formatSize(recording.size)}</span>
                  </div>
                </div>

                {/* Status Icon */}
                <div className="flex-shrink-0">{getStatusIcon(recording)}</div>

                {/* Download Button (if not failed) */}
                {recording.status !== 'upload_failed' && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDownload(recording);
                    }}
                    className="flex-shrink-0 bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-lg transition"
                    title="Download"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </button>
                )}
              </div>

              {/* Expanded Error Details */}
              {expandedError === recording.id && recording.status === 'upload_failed' && (
                <div className="mt-1 ml-8 p-3 bg-red-900/30 border border-red-800/50 rounded-lg">
                  <p className="text-red-400 text-sm font-medium mb-1">Upload Failed</p>
                  <p className="text-red-300/80 text-xs">
                    {recording.metadata?.error || 'Unknown error occurred during upload'}
                  </p>
                  <p className="text-slate-500 text-xs mt-2">
                    The recording was captured but failed to upload to storage. The file may be lost.
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
