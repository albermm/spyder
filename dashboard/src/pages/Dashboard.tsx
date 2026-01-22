/**
 * RemoteEye Dashboard - Main Dashboard Page
 */

import { useState, useEffect } from 'react';
import { authService } from '../services/AuthService';
import { socketService } from '../services/SocketService';
import { DeviceCard } from '../components/DeviceCard';
import { CameraViewer } from '../components/CameraViewer';
import { LocationMap } from '../components/LocationMap';
import { AudioPlayer } from '../components/AudioPlayer';
import type { Device, ConnectionState, DeviceStatus } from '../types';

export function Dashboard() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    initialize();
    return () => {
      socketService.disconnect();
    };
  }, []);

  const initialize = async () => {
    try {
      // Load devices
      const deviceList = await authService.getDevices();
      setDevices(deviceList);

      // Connect to socket
      const token = authService.getToken();
      const controllerId = authService.getControllerId();

      if (token && controllerId) {
        setupSocketListeners();
        await socketService.connect(controllerId, token);
      }
    } catch (error) {
      console.error('Failed to initialize:', error);
    } finally {
      setLoading(false);
    }
  };

  const setupSocketListeners = () => {
    socketService.on('connectionStateChange', (state: ConnectionState) => {
      setConnectionState(state);
    });

    socketService.on('deviceStatus', (data: { deviceId: string; online: boolean; status?: DeviceStatus }) => {
      setDevices((prev) =>
        prev.map((d) =>
          d.id === data.deviceId
            ? { ...d, status: data.online ? 'online' : 'offline', currentStatus: data.status }
            : d
        )
      );
    });
  };

  const selectDevice = (device: Device) => {
    setSelectedDevice(device);
    socketService.selectDevice(device.id);
  };

  const handleLogout = () => {
    authService.clearCredentials();
    window.location.reload();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header */}
      <header className="bg-slate-900 border-b border-slate-800 px-6 py-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold text-white">RemoteEye</h1>
            <span
              className={`px-2 py-1 rounded-full text-xs font-medium ${
                connectionState === 'connected'
                  ? 'bg-green-500/20 text-green-400'
                  : connectionState === 'connecting' || connectionState === 'reconnecting'
                  ? 'bg-yellow-500/20 text-yellow-400'
                  : 'bg-red-500/20 text-red-400'
              }`}
            >
              {connectionState}
            </span>
          </div>
          <button
            onClick={handleLogout}
            className="text-slate-400 hover:text-white text-sm transition"
          >
            Logout
          </button>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar - Device List */}
        <aside className="w-80 bg-slate-900 border-r border-slate-800 p-4 min-h-[calc(100vh-73px)]">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">
            Devices ({devices.length})
          </h2>
          <div className="space-y-3">
            {devices.map((device) => (
              <DeviceCard
                key={device.id}
                device={device}
                isSelected={selectedDevice?.id === device.id}
                onSelect={() => selectDevice(device)}
              />
            ))}
            {devices.length === 0 && (
              <p className="text-slate-500 text-sm text-center py-8">
                No devices registered yet.
                <br />
                Pair a device using the mobile app.
              </p>
            )}
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-6">
          {selectedDevice ? (
            <div className="space-y-6">
              {/* Device header */}
              <div className="bg-slate-800 rounded-xl p-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h2 className="text-xl font-semibold text-white">
                      {selectedDevice.name}
                    </h2>
                    <p className="text-slate-400 text-sm">
                      {selectedDevice.deviceInfo?.model} • iOS {selectedDevice.deviceInfo?.osVersion}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => socketService.getStatus()}
                      className="bg-slate-600 hover:bg-slate-500 text-white px-4 py-2 rounded-lg text-sm transition"
                    >
                      Refresh Status
                    </button>
                  </div>
                </div>
              </div>

              {/* Camera and Location */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <CameraViewer deviceId={selectedDevice.id} />
                <LocationMap deviceId={selectedDevice.id} />
              </div>

              {/* Audio Controls */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <AudioPlayer deviceId={selectedDevice.id} />

                {/* Sound Detection Controls */}
                <div className="bg-slate-800 rounded-xl p-4">
                  <h3 className="text-lg font-semibold text-white mb-4">Sound Detection</h3>
                  <p className="text-slate-400 text-sm mb-4">
                    When enabled, the device will automatically start recording when it detects sounds above the threshold.
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={() => socketService.enableSoundDetection()}
                      className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
                    >
                      Enable Detection
                    </button>
                    <button
                      onClick={() => socketService.disableSoundDetection()}
                      className="bg-slate-600 hover:bg-slate-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
                    >
                      Disable Detection
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-96 text-slate-500">
              Select a device from the sidebar to view controls
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
