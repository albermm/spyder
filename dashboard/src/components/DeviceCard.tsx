/**
 * RemoteEye Dashboard - Device Card Component
 */

import type { Device } from '../types';

interface DeviceCardProps {
  device: Device;
  isSelected: boolean;
  onSelect: () => void;
}

export function DeviceCard({ device, isSelected, onSelect }: DeviceCardProps) {
  const status = device.currentStatus;

  return (
    <div
      onClick={onSelect}
      className={`p-4 rounded-xl cursor-pointer transition-all ${
        isSelected
          ? 'bg-blue-600/20 border-2 border-blue-500'
          : 'bg-slate-800 border-2 border-transparent hover:border-slate-600'
      }`}
    >
      {/* Header */}
      <div className="flex justify-between items-start mb-3">
        <div>
          <h3 className="text-white font-semibold">{device.name}</h3>
          <p className="text-slate-400 text-sm">
            {device.deviceInfo?.model || 'Unknown device'}
          </p>
        </div>
        <span
          className={`px-2 py-1 rounded-full text-xs font-medium ${
            device.status === 'online'
              ? 'bg-green-500/20 text-green-400'
              : 'bg-slate-600/20 text-slate-400'
          }`}
        >
          {device.status === 'online' ? 'Online' : 'Offline'}
        </span>
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
