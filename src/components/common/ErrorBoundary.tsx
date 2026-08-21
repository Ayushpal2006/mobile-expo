/**
 * Apka Bill Mobile Expo - Global Production Error Boundary
 *
 * Catches unhandled React rendering errors, logs sanitized diagnostics to MonitoringService,
 * and renders a safe, cashier-friendly recovery screen without raw stack traces.
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MonitoringService from '../../services/monitoring.service';
import { COLORS, SPACING } from './UIComponents';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, errorMessage: error.message || 'An unexpected error occurred.' };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    MonitoringService.captureError(
      'UNKNOWN',
      'P1',
      'REACT_RENDER_CRASH',
      error,
      { componentStack: errorInfo.componentStack?.substring(0, 300) }
    );
  }

  handleRetry = () => {
    this.setState({ hasError: false, errorMessage: '' });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      let lastPhaseStr = '';
      try {
        const { getLastStartupPhase } = require('../../utils/startupDiagnostics');
        const last = getLastStartupPhase();
        if (last) {
          lastPhaseStr = `Last Reached: [STARTUP-${last.id}] ${last.name}`;
        }
      } catch {}

      return (
        <SafeAreaView style={styles.container}>
          <View style={styles.card}>
            <Text style={styles.icon}>⚠️</Text>
            <Text style={styles.title}>Apka Bill could not finish starting.</Text>
            <Text style={styles.subtitle}>
              The application encountered an unexpected issue during startup. Your saved sales and database remain safe.
            </Text>

            {lastPhaseStr ? (
              <View style={{ backgroundColor: '#F1F5F9', padding: 8, borderRadius: 8, marginVertical: 12, width: '100%' }}>
                <Text style={{ fontSize: 11, color: '#475569', fontWeight: '600', textAlign: 'center' }}>
                  {lastPhaseStr}
                </Text>
                {this.state.errorMessage ? (
                  <Text style={{ fontSize: 10, color: '#DC2626', marginTop: 4, textAlign: 'center' }}>
                    {this.state.errorMessage}
                  </Text>
                ) : null}
              </View>
            ) : null}

            <TouchableOpacity style={styles.button} onPress={this.handleRetry} activeOpacity={0.8}>
              <Text style={styles.buttonText}>Tap to Retry</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: SPACING.xl,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    maxWidth: 400,
    width: '100%',
  },
  icon: {
    fontSize: 48,
    marginBottom: SPACING.md,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: SPACING.sm,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: SPACING.xl,
  },
  button: {
    backgroundColor: COLORS.primary || '#2563EB',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ErrorBoundary;
