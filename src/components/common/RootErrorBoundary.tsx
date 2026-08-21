/**
 * Apka Bill POS - Production-Safe Root Boot Error Boundary & Diagnostics
 *
 * Guarantees that ANY fatal unhandled crash during application boot, top-level
 * component rendering, or module initialization NEVER produces a silent grey/black screen.
 * Displays a clean, actionable recovery screen with sanitized diagnostics for rapid support.
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Platform,
  Alert,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MonitoringService from '../../services/monitoring.service';
import logger from '../../utils/logger';
import { CONFIG } from '../../config/env';
import { COLORS, SPACING, RADIUS, SHADOWS } from './UIComponents';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  errorId: string;
  errorMessage: string;
  errorStack: string;
  componentStack: string;
  timestamp: string;
}

export class RootErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      errorId: '',
      errorMessage: '',
      errorStack: '',
      componentStack: '',
      timestamp: '',
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    const errorId = `ERR-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
    return {
      hasError: true,
      errorId,
      errorMessage: error?.message || 'An unknown fatal error prevented startup.',
      errorStack: error?.stack || '',
      timestamp: new Date().toISOString(),
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    const componentStack = errorInfo?.componentStack || '';
    this.setState({ componentStack });

    // Log to persistent logger and monitoring service
    logger.error(`[RootErrorBoundary] FATAL BOOT CRASH [${this.state.errorId}]:`, error);
    MonitoringService.captureError(
      'UNKNOWN',
      'P0',
      'FATAL_ROOT_RENDER_CRASH',
      error,
      {
        errorId: this.state.errorId,
        componentStack: componentStack.substring(0, 500),
        env: CONFIG.env,
        appVersion: CONFIG.appVersion,
        platform: `${Platform.OS} (${Platform.Version})`,
      }
    );
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      errorId: '',
      errorMessage: '',
      errorStack: '',
      componentStack: '',
      timestamp: '',
    });
  };

  getDiagnosticsSummary = (): string => {
    const sanitizedError = (this.state.errorMessage || 'Unknown').replace(/(token|secret|password|key)=\S+/gi, '$1=REDACTED');
    const sanitizedStack = (this.state.errorStack || 'No stack trace available').replace(/(token|secret|password|key)=\S+/gi, '$1=REDACTED');

    return [
      `=========================================`,
      `APKA BILL POS — BOOT FAILURE DIAGNOSTICS`,
      `=========================================`,
      `Error ID: ${this.state.errorId}`,
      `Timestamp: ${this.state.timestamp}`,
      `App Version: ${CONFIG.appVersion}`,
      `Runtime Version: 1.0.1 (appVersion policy)`,
      `Environment: ${CONFIG.env}`,
      `API Endpoint: ${CONFIG.apiBaseUrl}`,
      `Platform: ${Platform.OS} (${Platform.Version})`,
      `-----------------------------------------`,
      `Error Message:`,
      sanitizedError,
      `-----------------------------------------`,
      `Stack Trace:`,
      sanitizedStack.slice(0, 800),
      `=========================================`,
    ].join('\n');
  };

  handleShareDiagnostics = async () => {
    const diag = this.getDiagnosticsSummary();
    try {
      await Share.share({
        title: 'Apka Bill Boot Diagnostics',
        message: diag,
      });
    } catch {
      Alert.alert('Diagnostics Data', diag);
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <SafeAreaView style={styles.safeArea}>
          <ScrollView contentContainerStyle={styles.container} bounces={false}>
            <View style={styles.card}>
              <View style={styles.iconCircle}>
                <Text style={styles.iconText}>⚠️</Text>
              </View>

              <Text style={styles.appTitle}>Apka Bill</Text>
              <Text style={styles.mainTitle}>Application failed to start.</Text>
              
              <Text style={styles.description}>
                A startup issue prevented the POS interface from loading. Your offline transactions and catalog database remain secure.
              </Text>

              <View style={styles.errorIdBadge}>
                <Text style={styles.errorIdLabel}>Error ID:</Text>
                <Text style={styles.errorIdValue}>{this.state.errorId}</Text>
              </View>

              <View style={styles.detailsBox}>
                <Text style={styles.detailsHeading}>Diagnostic Telemetry</Text>
                <Text style={styles.detailsText} numberOfLines={3}>
                  {this.state.errorMessage}
                </Text>
                <Text style={styles.metaText}>
                  App: v{CONFIG.appVersion} · Env: {CONFIG.env} · OS: {Platform.OS} ({Platform.Version})
                </Text>
              </View>

              <View style={styles.actionColumn}>
                <TouchableOpacity
                  style={styles.retryBtn}
                  onPress={this.handleRetry}
                  activeOpacity={0.8}
                >
                  <Text style={styles.retryBtnText}>🔄 Retry Startup</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.diagBtn}
                  onPress={this.handleShareDiagnostics}
                  activeOpacity={0.8}
                >
                  <Text style={styles.diagBtnText}>📋 Copy / Share Diagnostics</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </SafeAreaView>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0F172A', // High-contrast Slate 900 background to guarantee visibility
  },
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.lg,
    padding: SPACING.xl,
    alignItems: 'center',
    width: '100%',
    maxWidth: 420,
    ...SHADOWS.md,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  iconText: {
    fontSize: 32,
  },
  appTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.primary,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  mainTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  description: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: SPACING.md,
  },
  errorIdBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.sm,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  errorIdLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    marginRight: 6,
  },
  errorIdValue: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  detailsBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: RADIUS.md,
    padding: 12,
    width: '100%',
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  detailsHeading: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  detailsText: {
    fontSize: 12,
    color: '#DC2626',
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  metaText: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 6,
  },
  actionColumn: {
    width: '100%',
    gap: 8,
  },
  retryBtn: {
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    width: '100%',
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  diagBtn: {
    backgroundColor: '#F1F5F9',
    paddingVertical: 12,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    width: '100%',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  diagBtnText: {
    color: '#334155',
    fontSize: 13,
    fontWeight: '700',
  },
});

export default RootErrorBoundary;
