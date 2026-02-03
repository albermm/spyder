/**
 * RemoteEye Mobile - Main Screen
 * Passive device display - controlled remotely from dashboard
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Camera, useCameraDevice } from 'react-native-vision-camera';
import {
  socketService,
  authService,
  cameraService,
  audioService,
  locationService,
  statusService,
  commandHandler,
  pushNotificationService,
} from '../services';
import type { ConnectionState, DeviceStatus, CameraPosition } from '../types';

interface MainScreenProps {
  onLogout: () => void;
}

export const MainScreen: React.FC<MainScreenProps> = ({ onLogout }) => {
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [deviceStatus, setDeviceStatus] = useState<DeviceStatus | null>(null);
  const [activeFeatures, setActiveFeatures] = useState({
    camera: false,
    audio: false,
    location: false,
  });
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraPosition, setCameraPosition] = useState<CameraPosition>('back');

  const backDevice = useCameraDevice('back');
  const frontDevice = useCameraDevice('front');
  const device = cameraPosition === 'back' ? backDevice : frontDevice;
  const cameraRef = useRef<Camera>(null);
  const [cameraReady, setCameraReady] = useState(false);

  // Log on every render to diagnose camera issues
  console.log('[MainScreen] RENDER - backDevice:', !!backDevice, 'frontDevice:', !!frontDevice, 'selected:', cameraPosition, 'cameraReady:', cameraReady);

  useEffect(() => {
    initialize();
    return () => cleanup();
  }, []);

  // Update camera ref in service when it changes
  useEffect(() => {
    if (cameraRef.current && cameraReady) {
      console.log('[MainScreen] Camera initialized and ready, setting ref in service');
      cameraService.setCameraRef(cameraRef.current);
    }
    return () => {
      cameraService.setCameraRef(null);
    };
  }, [cameraReady, device]);

  // Camera initialized callback
  const onCameraInitialized = React.useCallback(() => {
    console.log('[MainScreen] *** Camera onInitialized called! Setting ref...');
    setCameraReady(true);
    if (cameraRef.current) {
      console.log('[MainScreen] *** Camera ref exists, setting in service');
      cameraService.setCameraRef(cameraRef.current);
    } else {
      console.log('[MainScreen] *** WARNING: Camera ref is still null after onInitialized');
    }
  }, []);

  // Listen for camera state changes to activate/deactivate camera component
  useEffect(() => {
    const handleCameraStateChange = (isActive: boolean) => {
      console.log('[MainScreen] Camera state changed:', isActive);
      setCameraActive(isActive);
    };

    cameraService.onStateChange(handleCameraStateChange);
    return () => cameraService.offStateChange(handleCameraStateChange);
  }, []);

  // Listen for camera position changes
  useEffect(() => {
    const handlePositionChange = (position: CameraPosition) => {
      console.log('[MainScreen] Camera position changed:', position);
      setCameraReady(false); // Reset ready state when switching cameras
      setCameraPosition(position);
    };

    cameraService.onPositionChange(handlePositionChange);
    return () => cameraService.offPositionChange(handlePositionChange);
  }, []);

  // Track active features for display
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveFeatures({
        camera: cameraService.isCurrentlyStreaming(),
        audio: audioService.isCurrentlyMonitoring(),
        location: locationService.isCurrentlyTracking(),
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const initialize = async () => {
    // Set up socket listeners
    socketService.on('connectionStateChange', handleConnectionChange);

    // Set initial connection state from socket service
    setConnectionState(socketService.getConnectionState());

    // Request permissions upfront
    await requestAllPermissions();

    // Initialize command handler (listens for remote commands)
    commandHandler.initialize();

    // NOTE: Connection is handled by App.tsx via connectWithAutoRefresh()
    // We just need to report status when connected and set up listeners
    if (socketService.isConnected()) {
      socketService.reportStatus('online');
    }

    // Report online status when connection state changes to connected
    socketService.on('connectionStateChange', (state: ConnectionState) => {
      if (state === 'connected') {
        socketService.reportStatus('online');
      }
    });

    // Start status service (reports battery, network, etc.)
    await statusService.start();

    // Update local status display
    setDeviceStatus(statusService.getStatus());
  };

  const requestAllPermissions = async () => {
    // Request all permissions upfront so they're ready when commands come
    await cameraService.requestPermissions();
    await audioService.requestPermissions();
    await locationService.requestPermissions();
  };

  const cleanup = () => {
    socketService.off('connectionStateChange', handleConnectionChange);
    // NOTE: Don't disconnect socket here - App.tsx manages the connection
    statusService.stop();
    cameraService.stopStreaming();
    audioService.destroy();
    locationService.destroy();
  };

  const handleConnectionChange = (state: ConnectionState) => {
    setConnectionState(state);
  };

  const handleLogout = async () => {
    Alert.alert(
      'Disconnect Device',
      'Are you sure you want to disconnect this device?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: async () => {
            cleanup();
            await authService.clearCredentials();
            onLogout();
          },
        },
      ]
    );
  };

  const getConnectionColor = () => {
    switch (connectionState) {
      case 'connected':
        return '#22c55e';
      case 'connecting':
      case 'reconnecting':
        return '#f59e0b';
      default:
        return '#ef4444';
    }
  };

  // Log whether camera will render
  if (!device) {
    console.log('[MainScreen] *** Camera NOT rendering - device is null/undefined');
  }

  return (
    <View style={styles.container}>
      {/* Camera (hidden but always active so it's ready for commands) */}
      {device && (
        <Camera
          ref={cameraRef}
          style={styles.hiddenCamera}
          device={device}
          isActive={true}
          photo={true}
          onInitialized={onCameraInitialized}
          onError={(error) => console.log('[MainScreen] Camera error:', error.message)}
        />
      )}

      <ScrollView contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>RemoteEye</Text>
          <View style={[styles.statusDot, { backgroundColor: getConnectionColor() }]} />
        </View>

        {/* Connection Status */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Connection</Text>
          <Text style={[styles.statusText, { color: getConnectionColor() }]}>
            {connectionState.toUpperCase()}
          </Text>
          <Text style={styles.deviceId}>
            Device: {authService.getDeviceId()?.slice(0, 8)}...
          </Text>
        </View>

        {/* Remote Control Status */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Remote Control Status</Text>
          <Text style={styles.infoText}>
            This device is controlled remotely from the dashboard.
          </Text>

          <View style={styles.featureList}>
            <View style={styles.featureItem}>
              <Text style={styles.featureIcon}>{activeFeatures.camera ? '📹' : '📷'}</Text>
              <Text style={styles.featureLabel}>Camera</Text>
              <View style={[styles.featureStatus, activeFeatures.camera && styles.featureActive]}>
                <Text style={styles.featureStatusText}>
                  {activeFeatures.camera ? 'STREAMING' : 'STANDBY'}
                </Text>
              </View>
            </View>

            <View style={styles.featureItem}>
              <Text style={styles.featureIcon}>{activeFeatures.audio ? '🔊' : '🔇'}</Text>
              <Text style={styles.featureLabel}>Audio</Text>
              <View style={[styles.featureStatus, activeFeatures.audio && styles.featureActive]}>
                <Text style={styles.featureStatusText}>
                  {activeFeatures.audio ? 'MONITORING' : 'STANDBY'}
                </Text>
              </View>
            </View>

            <View style={styles.featureItem}>
              <Text style={styles.featureIcon}>{activeFeatures.location ? '📍' : '📌'}</Text>
              <Text style={styles.featureLabel}>Location</Text>
              <View style={[styles.featureStatus, activeFeatures.location && styles.featureActive]}>
                <Text style={styles.featureStatusText}>
                  {activeFeatures.location ? 'TRACKING' : 'STANDBY'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Device Status */}
        {deviceStatus && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Device Status</Text>
            <View style={styles.statusGrid}>
              <View style={styles.statusItem}>
                <Text style={styles.statusLabel}>Battery</Text>
                <Text style={styles.statusValue}>
                  {deviceStatus.battery}%{deviceStatus.charging ? ' ⚡' : ''}
                </Text>
              </View>
              <View style={styles.statusItem}>
                <Text style={styles.statusLabel}>Network</Text>
                <Text style={styles.statusValue}>
                  {deviceStatus.networkType.toUpperCase()}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Logout */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutText}>Disconnect Device</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  hiddenCamera: {
    width: 1,
    height: 1,
    position: 'absolute',
    opacity: 0,
  },
  content: {
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    paddingTop: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 14,
    color: '#94a3b8',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  statusText: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  deviceId: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#94a3b8',
    marginBottom: 16,
  },
  featureList: {
    gap: 12,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#334155',
    borderRadius: 12,
    padding: 16,
  },
  featureIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  featureLabel: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
    flex: 1,
  },
  featureStatus: {
    backgroundColor: '#475569',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  featureActive: {
    backgroundColor: '#22c55e',
  },
  featureStatusText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '600',
  },
  statusGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  statusItem: {
    width: '50%',
    marginBottom: 12,
  },
  statusLabel: {
    fontSize: 12,
    color: '#64748b',
  },
  statusValue: {
    fontSize: 18,
    color: '#fff',
    fontWeight: '600',
    marginTop: 4,
  },
  logoutButton: {
    backgroundColor: '#7f1d1d',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 20,
  },
  logoutText: {
    color: '#fca5a5',
    fontSize: 16,
    fontWeight: '600',
  },
});
