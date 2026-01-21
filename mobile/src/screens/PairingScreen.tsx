/**
 * RemoteEye Mobile - Pairing Screen
 * Shows pairing code for device registration
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  TextInput,
} from 'react-native';
import DeviceInfo from 'react-native-device-info';
import { authService } from '../services';

interface PairingScreenProps {
  onPaired: () => void;
}

export const PairingScreen: React.FC<PairingScreenProps> = ({ onPaired }) => {
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [deviceName, setDeviceName] = useState('');

  useEffect(() => {
    loadDeviceName();
  }, []);

  const loadDeviceName = async () => {
    const name = await DeviceInfo.getDeviceName();
    setDeviceName(name);
  };

  const requestPairingCode = async () => {
    setLoading(true);
    try {
      const response = await authService.requestPairingCode();
      setPairingCode(response.pairing_code);
      setExpiresAt(response.expires_at);
    } catch (error) {
      Alert.alert('Error', 'Failed to get pairing code. Check server connection.');
    } finally {
      setLoading(false);
    }
  };

  const registerWithCode = async () => {
    const code = manualCode || pairingCode;
    if (!code) {
      Alert.alert('Error', 'Please enter a pairing code');
      return;
    }

    setLoading(true);
    try {
      await authService.registerDevice(code, deviceName);
      onPaired();
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>RemoteEye</Text>
      <Text style={styles.subtitle}>Device Pairing</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Device Name</Text>
        <TextInput
          style={styles.input}
          value={deviceName}
          onChangeText={setDeviceName}
          placeholder="Enter device name"
        />

        {pairingCode ? (
          <View style={styles.codeContainer}>
            <Text style={styles.label}>Your Pairing Code</Text>
            <Text style={styles.pairingCode}>{pairingCode}</Text>
            <Text style={styles.expires}>
              Expires: {new Date(expiresAt!).toLocaleTimeString()}
            </Text>
          </View>
        ) : (
          <View style={styles.manualContainer}>
            <Text style={styles.label}>Enter Pairing Code</Text>
            <TextInput
              style={styles.codeInput}
              value={manualCode}
              onChangeText={setManualCode}
              placeholder="ABC123"
              autoCapitalize="characters"
              maxLength={6}
            />
          </View>
        )}

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.button, styles.secondaryButton]}
            onPress={requestPairingCode}
            disabled={loading}>
            <Text style={styles.secondaryButtonText}>Generate Code</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.primaryButton]}
            onPress={registerWithCode}
            disabled={loading || (!pairingCode && !manualCode)}>
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryButtonText}>Register Device</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <Text style={styles.instructions}>
        Generate a code or enter one from your dashboard to pair this device.
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    padding: 20,
    justifyContent: 'center',
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 18,
    color: '#94a3b8',
    textAlign: 'center',
    marginBottom: 40,
  },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 24,
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    color: '#94a3b8',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#334155',
    borderRadius: 8,
    padding: 12,
    color: '#fff',
    fontSize: 16,
    marginBottom: 20,
  },
  codeContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  pairingCode: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#22c55e',
    letterSpacing: 8,
    marginVertical: 16,
  },
  expires: {
    fontSize: 12,
    color: '#64748b',
  },
  manualContainer: {
    marginBottom: 20,
  },
  codeInput: {
    backgroundColor: '#334155',
    borderRadius: 8,
    padding: 16,
    color: '#fff',
    fontSize: 24,
    textAlign: 'center',
    letterSpacing: 4,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: '#3b82f6',
  },
  secondaryButton: {
    backgroundColor: '#334155',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButtonText: {
    color: '#94a3b8',
    fontSize: 16,
    fontWeight: '600',
  },
  instructions: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
});
