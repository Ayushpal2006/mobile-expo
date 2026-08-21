/**
 * Apka Bill Mobile Expo - Production Observability & Diagnostics Service
 *
 * Lightweight, Low-overhead, Privacy-Aware Error & Health Tracker:
 * - Structured Error Categorization & Severity classification
 * - Bounded Rolling Ring Buffer (Last 100 sanitized diagnostic events)
 * - Safe Non-blocking Telemetry execution (never interferes with cashier operations)
 * - Zero PII/JWT/Password logging
 * - One-touch Support Diagnostic Generator
 */

import { Platform } from 'react-native';
import { CONFIG } from '../config/env';
import logger from '../utils/logger';

export type ErrorCategory =
  | 'AUTH'
  | 'API'
  | 'NETWORK'
  | 'DATABASE'
  | 'MIGRATION'
  | 'SYNC'
  | 'OUTBOX'
  | 'BILLING'
  | 'PAYMENT'
  | 'PRINTER'
  | 'UPI'
  | 'IMAGE'
  | 'PERMISSION'
  | 'UNKNOWN';

export type ErrorSeverity = 'P0' | 'P1' | 'P2' | 'P3';

export interface DiagnosticEvent {
  id: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  operation: string;
  message: string;
  correlationId?: string;
  metadata?: Record<string, any>;
  appVersion: string;
  platform: string;
  timestamp: string;
}

const MAX_EVENT_BUFFER_SIZE = 100;

class MonitoringServiceManager {
  private eventRingBuffer: DiagnosticEvent[] = [];
  private isOffline: boolean = false;

  constructor() {
    this.eventRingBuffer = [];
  }

  public setNetworkState(isOffline: boolean) {
    if (this.isOffline !== isOffline) {
      this.isOffline = isOffline;
      this.captureEvent({
        category: 'NETWORK',
        severity: 'P3',
        operation: 'NETWORK_TRANSITION',
        message: isOffline ? 'Device went OFFLINE' : 'Device came ONLINE',
      });
    }
  }

  public captureError(
    category: ErrorCategory,
    severity: ErrorSeverity,
    operation: string,
    error: Error | string | any,
    metadata?: Record<string, any>,
    correlationId?: string
  ): DiagnosticEvent {
    const message = error instanceof Error ? error.message : String(error || 'Unknown error');
    
    // Log to console through sanitized logger
    logger.error(`[${category}][${severity}] ${operation}: ${message}`, metadata);

    return this.captureEvent({
      category,
      severity,
      operation,
      message,
      metadata,
      correlationId,
    });
  }

  public captureEvent(event: {
    category: ErrorCategory;
    severity: ErrorSeverity;
    operation: string;
    message: string;
    metadata?: Record<string, any>;
    correlationId?: string;
  }): DiagnosticEvent {
    try {
      const diagnosticEvent: DiagnosticEvent = {
        id: `EVT-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        category: event.category,
        severity: event.severity,
        operation: event.operation,
        message: event.message,
        correlationId: event.correlationId,
        metadata: this.sanitizeMetadata(event.metadata),
        appVersion: CONFIG.appVersion,
        platform: `${Platform.OS} (${Platform.Version})`,
        timestamp: new Date().toISOString(),
      };

      // Push to bounded rolling ring buffer
      this.eventRingBuffer.push(diagnosticEvent);
      if (this.eventRingBuffer.length > MAX_EVENT_BUFFER_SIZE) {
        this.eventRingBuffer.shift(); // Evict oldest log
      }

      return diagnosticEvent;
    } catch {
      // Non-blocking fail-safe: monitoring errors never crash app
      return {} as any;
    }
  }

  public getRecentEvents(limit: number = 50): DiagnosticEvent[] {
    return [...this.eventRingBuffer].reverse().slice(0, limit);
  }

  public getEventsByCategory(category: ErrorCategory): DiagnosticEvent[] {
    return this.eventRingBuffer.filter((e) => e.category === category);
  }

  public clearDiagnostics(): void {
    this.eventRingBuffer = [];
  }

  public generateSupportDiagnosticsPayload(additionalContext?: Record<string, any>): string {
    const summary = {
      app: CONFIG.appName,
      version: CONFIG.appVersion,
      platform: `${Platform.OS} ${Platform.Version}`,
      apiBaseUrl: CONFIG.apiBaseUrl,
      isOffline: this.isOffline,
      totalEventsLogged: this.eventRingBuffer.length,
      p0ErrorCount: this.eventRingBuffer.filter((e) => e.severity === 'P0').length,
      p1ErrorCount: this.eventRingBuffer.filter((e) => e.severity === 'P1').length,
      recentErrors: this.eventRingBuffer.slice(-10).map((e) => ({
        timestamp: e.timestamp,
        category: e.category,
        severity: e.severity,
        operation: e.operation,
        message: e.message,
      })),
      context: additionalContext || {},
    };

    return JSON.stringify(summary, null, 2);
  }

  private sanitizeMetadata(data?: Record<string, any>): Record<string, any> | undefined {
    if (!data) return undefined;
    const SENSITIVE_KEYS = ['password', 'token', 'authorization', 'secret', 'phone', 'email', 'name', 'gstin'];
    const clean: Record<string, any> = {};

    for (const [key, value] of Object.entries(data)) {
      const isSensitive = SENSITIVE_KEYS.some((s) => key.toLowerCase().includes(s));
      clean[key] = isSensitive ? '[REDACTED]' : value;
    }

    return clean;
  }
}

export const MonitoringService = new MonitoringServiceManager();
export default MonitoringService;
