/**
 * RemoteEye Dashboard - Location Map Component
 */

import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { socketService } from '../services/SocketService';
import { CONFIG } from '../config';
import type { LocationData } from '../types';

// Fix leaflet marker icon issue
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface LocationMapProps {
  deviceId: string | null;
  className?: string;
}

function MapUpdater({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [center, map]);
  return null;
}

export function LocationMap({ deviceId, className = '' }: LocationMapProps) {
  const [location, setLocation] = useState<LocationData | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  useEffect(() => {
    const handleLocation = (data: { deviceId: string; location: LocationData }) => {
      if (data.deviceId === deviceId) {
        setLocation(data.location);
        setLastUpdate(new Date());
      }
    };

    socketService.on('location', handleLocation);

    return () => {
      socketService.off('location', handleLocation);
    };
  }, [deviceId]);

  const requestLocation = () => {
    if (deviceId) {
      socketService.getLocation();
    }
  };

  const center: [number, number] = location
    ? [location.latitude, location.longitude]
    : CONFIG.MAP_CENTER;

  return (
    <div className={`bg-slate-800 rounded-xl p-4 ${className}`}>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-white">Location</h3>
        <button
          onClick={requestLocation}
          disabled={!deviceId}
          className="bg-slate-600 hover:bg-slate-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white px-3 py-1 rounded-lg text-sm transition"
        >
          Refresh
        </button>
      </div>

      {/* Map */}
      <div className="h-64 rounded-lg overflow-hidden mb-3">
        <MapContainer
          center={center}
          zoom={CONFIG.MAP_ZOOM}
          scrollWheelZoom={true}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {location && (
            <>
              <MapUpdater center={center} />
              <Marker position={center}>
                <Popup>
                  <div className="text-sm">
                    <p className="font-semibold">Device Location</p>
                    <p>Lat: {location.latitude.toFixed(6)}</p>
                    <p>Lng: {location.longitude.toFixed(6)}</p>
                    <p>Accuracy: {location.accuracy.toFixed(0)}m</p>
                  </div>
                </Popup>
              </Marker>
            </>
          )}
        </MapContainer>
      </div>

      {/* Location details */}
      {location ? (
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="text-slate-400">
            Coordinates:{' '}
            <span className="text-white">
              {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
            </span>
          </div>
          <div className="text-slate-400">
            Accuracy: <span className="text-white">{location.accuracy.toFixed(0)}m</span>
          </div>
          <div className="text-slate-400">
            Speed: <span className="text-white">{(location.speed * 3.6).toFixed(1)} km/h</span>
          </div>
          <div className="text-slate-400">
            Updated:{' '}
            <span className="text-white">
              {lastUpdate?.toLocaleTimeString() || 'Never'}
            </span>
          </div>
        </div>
      ) : (
        <p className="text-slate-500 text-sm text-center">
          {deviceId ? 'Click Refresh to get location' : 'Select a device'}
        </p>
      )}
    </div>
  );
}
