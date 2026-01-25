/**
 * RemoteEye Dashboard - Device Card Component
 */

import { useState } from 'react';
import type { Device } from '../types';

interface DeviceCardProps {
  device: Device;
  isSelected: boolean;
  onSelect: () => void;
  onDelete?: (deviceId: string) => void;
}

export function DeviceCard({ device, isSelected, onSelect, onDelete }: DeviceCardProps) {
  const status = device.currentStatus;
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete?.(device.id);
    setShowDeleteConfirm(false);
  };

  const handleCancelDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowDeleteConfirm(false);
  };

  return (
    <div
      onClick={onSelect}
      className={`p-4 rounded-xl cursor-pointer transition-all relative ${
        isSelected
          ? 'bg-blue-600/20 border-2 border-blue-500'
          : 'bg-slate-800 border-2 border-transparent hover:border-slate-600'
      }`}
    >
      {/* Delete confirmation overlay */}
      {showDeleteConfirm && (
        <div className="absolute inset-0 bg-slate-900/95 rounded-xl flex flex-col items-center justify-center z-10 p-4">
          <p className="text-white text-sm mb-3 text-center">Delete this device?</p>
          <div className="flex gap-2">
            <button
              onClick={handleCancelDelete}
              className="px-3 py-1 text-sm bg-slate-600 text-white rounded hover:bg-slate-500"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmDelete}
              className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-500"
            >
              Delete
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-start mb-3">
        <div>
          <h3 className="text-white font-semibold">{device.name}</h3>
          <p className="text-slate-400 text-sm">
            {device.deviceInfo?.model || 'Unknown device'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`px-2 py-1 rounded-full text-xs font-medium ${
              device.status === 'online'
                ? 'bg-green-500/20 text-green-400'
                : 'bg-slate-600/20 text-slate-400'
            }`}
          >
            {device.status === 'online' ? 'Online' : 'Offline'}
          </span>
          {onDelete && (
            <button
              onClick={handleDeleteClick}
              className="p-1 text-slate-500 hover:text-red-400 transition-colors"
              title="Delete device"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Status indicators */}
      {status && (
        <div className="grid grid-cols-3 gap-2">
          <StatusItem
            icon="🔋"
            label="Battery"
            value={`${status.battery}%`}
            active={status.charging}
          />
          <StatusItem
            icon="📶"
            label="Network"
            value={status.networkType}
          />
          <StatusItem
            icon="📹"
            label="Camera"
            value={status.cameraActive ? 'Active' : 'Off'}
            active={status.cameraActive}
          />
        </div>
      )}

      {/* Last seen */}
      <p className="text-slate-500 text-xs mt-3">
        Last seen: {new Date(device.lastSeen).toLocaleString()}
      </p>
    </div>
  );
}

interface StatusItemProps {
  icon: string;
  label: string;
  value: string;
  active?: boolean;
}

function StatusItem({ icon, value, active }: StatusItemProps) {
  return (
    <div className="text-center">
      <div className="text-lg">{icon}</div>
      <div className={`text-xs ${active ? 'text-green-400' : 'text-slate-400'}`}>
        {value}
      </div>
    </div>
  );
}
