/**
 * RemoteEye Mobile App
 * Remote iPhone monitoring client
 *
 * This app supports two modes:
 * 1. SETUP MODE (isSetupMode=true in AppDelegate): Shows UI for pairing
 * 2. HEADLESS MODE (isSetupMode=false): Runs background services only
 *
 * The app automatically detects its mode based on whether UI is available.
 * In headless mode, if credentials exist, it starts services silently.
 * If credentials don't exist in headless mode, it idles and waits for setup.
 */

import React, { useState, useEffect, useRef } from 'react';
import { StatusBar, View, StyleSheet, ActivityIndicator, Text, AppState as RNAppState } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { authService, socketService, pushNotificationService, backgroundService, commandHandler } from './src/services';
import { PairingScreen, MainScreen } from './src/screens';

type AppMode = 'loading' | 'unpaired' | 'paired_ui' | 'paired_headless';

/**
 * Check if we should run in minimal UI mode.
 * In production, this would be controlled by a native module flag.
 * For now, we show minimal UI when paired and not in active foreground use.
 */
const HEADLESS_MODE = false; // Set to true for headless builds (no visible UI)

function App(): React.JSX.Element | null {
  const [appMode, setAppMode] = useState<AppMode>('loading');
  const servicesInitialized = useRef(false);

  useEffect(() => {
    initializeApp();
  }, []);

  /**
   * Authentication State Machine
   * Decides what to do on launch based on stored credentials and UI availability.
   */
  const initializeApp = async () => {
    console.log('[App] Initializing...');
    console.log('[App] Current app state:', RNAppState.currentState);

    try {
      // Step 1: Check for stored credentials
      const isAuthenticated = await authService.initialize();
      console.log('[App] Credentials found:', isAuthenticated);

      if (isAuthenticated) {
        // Credentials exist - device is paired
        console.log('[App] Headless mode:', HEADLESS_MODE);

        // Start background services (works in both UI and headless modes)
        await startBackgroundServices();

        if (HEADLESS_MODE) {
          // Headless mode: minimal UI, just run services
          setAppMode('paired_headless');
          console.log('[App] Running in headless mode with active services.');
        } else {
          // Setup mode with UI: show main screen
          setAppMode('paired_ui');
          console.log('[App] Running in UI mode.');
        }
      } else {
        // No credentials - device is unpaired
        if (HEADLESS_MODE) {
          // Headless + unpaired: can't do anything, idle and wait
          setAppMode('unpaired');
          console.log('[App] ERROR: Device not paired. Please enter setup mode.');
        } else {
          // UI mode + unpaired: show pairing screen
          setAppMode('unpaired');
          console.log('[App] Showing pairing screen.');
        }
      }
    } catch (error) {
      console.error('[App] Initialization failed:', error);
      setAppMode('unpaired');
    }
  };

  /**
   * Start background services (WebSocket, Push Notifications).
   * This is called when credentials exist, regardless of UI/headless mode.
   */
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
      // Connect to WebSocket with self-healing (token refresh handled by SocketService)
      await socketService.connectWithAutoRefresh();

      // Initialize command handler to process incoming commands
      commandHandler.initialize();

      // Initialize push notification service
      await pushNotificationService.initialize();

      // Initialize background fetch service (keeps app alive periodically)
      await backgroundService.initialize();
      await backgroundService.start();

      servicesInitialized.current = true;
      console.log('[App] Background services started successfully.');
    } catch (error) {
      console.error('[App] Failed to start background services:', error);
    }
  };

  const handlePaired = async () => {
    console.log('[App] Pairing complete, starting services...');
    await startBackgroundServices();
    setAppMode('paired_ui');
  };

  const handleLogout = async () => {
    console.log('[App] Logging out...');
    socketService.disconnect();
    await authService.clearCredentials();
    servicesInitialized.current = false;
    setAppMode('unpaired');
  };

  // Headless mode: render minimal black screen (required to keep app alive)
  if (appMode === 'paired_headless') {
    console.log('[App] Headless mode active - minimal UI, services running.');
    return (
      <View style={styles.headlessContainer}>
        <StatusBar barStyle="light-content" backgroundColor="#000000" hidden={true} />
      </View>
    );
  }

  // Loading state
  if (appMode === 'loading') {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  // UI mode: render appropriate screen
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
      {appMode === 'unpaired' ? (
        <PairingScreen onPaired={handlePaired} />
      ) : (
        <MainScreen onLogout={handleLogout} />
      )}
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#94a3b8',
    marginTop: 16,
    fontSize: 16,
  },
  headlessContainer: {
    flex: 1,
    backgroundColor: '#000000',
  },
});

export default App;
