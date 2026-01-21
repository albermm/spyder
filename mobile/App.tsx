/**
 * RemoteEye Mobile App
 * Remote iPhone monitoring client
 */

import React, { useState, useEffect } from 'react';
import { StatusBar, View, StyleSheet, ActivityIndicator, Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { authService } from './src/services';
import { PairingScreen, MainScreen } from './src/screens';

type AppState = 'loading' | 'pairing' | 'main';

function App(): React.JSX.Element {
  const [appState, setAppState] = useState<AppState>('loading');

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const isAuthenticated = await authService.initialize();
      setAppState(isAuthenticated ? 'main' : 'pairing');
    } catch (error) {
      console.error('Auth check failed:', error);
      setAppState('pairing');
    }
  };

  const handlePaired = () => {
    setAppState('main');
  };

  const handleLogout = () => {
    setAppState('pairing');
  };

  if (appState === 'loading') {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
      {appState === 'pairing' ? (
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
});

export default App;
