/**
 * Apka Bill Mobile Expo - Official Login Screen
 *
 * Production Mobile Cashier Authentication:
 * - Official Apka Bill Web brand identity & canonical logo
 * - Robust error and validation states
 * - Offline-first session restoration
 */

import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { Button, Input, Card, ErrorAlert, COLORS, SPACING } from '../components/common/UIComponents';
import CONFIG from '../config/env';

export const LoginScreen: React.FC = () => {
  const { login, isLoading, loginError, clearError } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleLogin = async () => {
    if (isLoading) return;
    setValidationError(null);
    clearError();

    if (!email.trim()) {
      setValidationError('Please enter your email address.');
      return;
    }
    if (!password) {
      setValidationError('Please enter your password.');
      return;
    }

    try {
      await login(email.trim(), password);
    } catch {
      // Error handled via AuthContext loginError
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.brandHeader}>
            <Image
              source={require('../../assets/logo.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
            <Text style={styles.brandTitle}>Apka Bill</Text>
            <Text style={styles.brandSubtitle}>Retail POS Platform</Text>
          </View>

          <Card style={styles.formCard}>
            <Text style={styles.formTitle}>Sign In to Store</Text>

            {validationError ? (
              <ErrorAlert message={validationError} onDismiss={() => setValidationError(null)} />
            ) : null}

            {loginError ? (
              <ErrorAlert message={loginError} onDismiss={clearError} />
            ) : null}

            <Input
              label="Email Address"
              value={email}
              onChangeText={setEmail}
              placeholder="e.g. cashier@store.com"
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <Input
              label="Password"
              value={password}
              onChangeText={setPassword}
              placeholder="Enter your password"
              secureTextEntry
            />

            <Button
              title="Sign In"
              onPress={handleLogin}
              loading={isLoading}
              style={{ marginTop: SPACING.sm }}
            />
          </Card>

          <View style={styles.footerInfo}>
            <Text style={styles.footerText}>Apka Bill POS Client • v1.0.0</Text>
            <Text style={styles.apiDiagnosticText}>API: {CONFIG.apiBaseUrl}</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: SPACING.md,
  },
  brandHeader: {
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  logoImage: {
    width: 64,
    height: 64,
    borderRadius: 16,
    marginBottom: SPACING.xs,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  brandTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: COLORS.text,
    letterSpacing: -0.5,
  },
  brandSubtitle: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  formCard: {
    padding: SPACING.lg,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  footerInfo: {
    alignItems: 'center',
    marginTop: SPACING.lg,
  },
  footerText: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  apiDiagnosticText: {
    fontSize: 10,
    color: COLORS.textMuted,
    marginTop: 4,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
});

export default LoginScreen;
