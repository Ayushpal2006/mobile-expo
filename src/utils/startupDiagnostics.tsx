/**
 * Apka Bill Mobile POS - Controlled Startup Diagnostics & Phase Isolation
 *
 * Provides deterministic tracking and visibility into the 6 application startup phases:
 * Phase 1: React root successfully rendered [STARTUP-P1]
 * Phase 2: Root providers successfully rendered [STARTUP-P2]
 * Phase 3: Auth/session initialization begins [STARTUP-P3]
 * Phase 4: Auth/session initialization completes [STARTUP-P4]
 * Phase 5: Navigation & screen shell rendered [STARTUP-P5]
 * Phase 6: Feature services available [STARTUP-P6]
 *
 * PRODUCTION-SAFE ISOLATION:
 * Diagnostics HUD is strictly a development/debug tool and is completely disabled in production builds.
 * State notifications NEVER run synchronously during component render.
 */

import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView } from 'react-native';

export type StartupPhaseId = 'P1' | 'P2' | 'P3' | 'P4' | 'P5' | 'P6';

export interface PhaseRecord {
  id: StartupPhaseId;
  name: string;
  timestampMs: number;
  elapsedMs: number;
  status: 'STARTED' | 'SUCCESS' | 'ERROR';
  details?: string;
}

const PHASE_NAMES: Record<StartupPhaseId, string> = {
  P1: 'Phase 1: React Root Mount',
  P2: 'Phase 2: Root Providers Render',
  P3: 'Phase 3: Session Restore Begin',
  P4: 'Phase 4: Session Restore Complete',
  P5: 'Phase 5: Main Navigation Shell',
  P6: 'Phase 6: Feature Services Ready',
};

const startTime = Date.now();
let lastPhase: StartupPhaseId = 'P1';
let phaseHistory: PhaseRecord[] = [];
let listeners: Array<() => void> = [];

export const isStartupDiagnosticsEnabled = (): boolean => {
  // Strictly isolated to development environments with explicit flag enabled
  return typeof __DEV__ !== 'undefined' && __DEV__ && process.env.EXPO_PUBLIC_STARTUP_DIAGNOSTICS === 'true';
};

export const subscribeStartupDiagnostics = (listener: () => void): (() => void) => {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
};

export const recordStartupPhase = (
  id: StartupPhaseId,
  status: 'STARTED' | 'SUCCESS' | 'ERROR' = 'SUCCESS',
  details?: string
): void => {
  const now = Date.now();
  const elapsedMs = now - startTime;
  lastPhase = id;

  const record: PhaseRecord = {
    id,
    name: PHASE_NAMES[id] || id,
    timestampMs: now,
    elapsedMs,
    status,
    details,
  };

  phaseHistory = [...phaseHistory, record];

  // High-visibility console log for ADB Logcat / EAS diagnostics
  const tag = `[STARTUP-${id}]`;
  const detailStr = details ? ` - ${details}` : '';
  if (status === 'ERROR') {
    console.error(`${tag} ${record.name} (${status}) +${elapsedMs}ms${detailStr}`);
  } else {
    console.log(`${tag} ${record.name} (${status}) +${elapsedMs}ms${detailStr}`);
  }

  // Defer listener notifications to the next event loop tick to NEVER trigger setState during render
  if (listeners.length > 0) {
    setTimeout(() => {
      listeners.forEach((l) => {
        try {
          l();
        } catch {}
      });
    }, 0);
  }
};

export const getLastStartupPhase = (): { id: StartupPhaseId; name: string } => {
  return { id: lastPhase, name: PHASE_NAMES[lastPhase] || lastPhase };
};

export const getStartupHistory = (): PhaseRecord[] => {
  return [...phaseHistory];
};

/**
 * Development-only Startup Diagnostic HUD
 * Completely omitted in production builds to prevent any overhead or render-phase collisions.
 */
export const StartupDiagnosticHUD: React.FC = () => {
  const [history, setHistory] = useState<PhaseRecord[]>([]);
  const [expanded, setExpanded] = useState<boolean>(false);
  const isEnabled = isStartupDiagnosticsEnabled();

  useEffect(() => {
    if (!isEnabled) return;

    setHistory(getStartupHistory());
    const unsubscribe = subscribeStartupDiagnostics(() => {
      setHistory(getStartupHistory());
    });
    return unsubscribe;
  }, [isEnabled]);

  if (!isEnabled) {
    return null;
  }

  const latest = history[history.length - 1];

  return (
    <View style={styles.container} pointerEvents="box-none">
      <TouchableOpacity
        style={styles.pill}
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.85}
      >
        <Text style={styles.pillText}>
          ⚡ {latest ? `[${latest.id}] ${latest.name}` : 'Startup Diagnostic'} ({latest?.elapsedMs ?? 0}ms)
        </Text>
      </TouchableOpacity>

      {expanded && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Apka Bill Startup Phase Telemetry</Text>
          <ScrollView style={styles.historyList} nestedScrollEnabled>
            {history.map((item, idx) => (
              <View key={idx} style={styles.row}>
                <Text style={styles.tag}>[{item.id}]</Text>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.time}>+{item.elapsedMs}ms</Text>
              </View>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 36,
    left: 12,
    right: 12,
    zIndex: 99999,
  },
  pill: {
    backgroundColor: '#0F172A',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#38BDF8',
    alignSelf: 'flex-start',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 8,
  },
  pillText: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '700',
  },
  card: {
    backgroundColor: '#0F172AEF',
    marginTop: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    maxHeight: 220,
  },
  cardTitle: {
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
  },
  historyList: {
    maxHeight: 160,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 3,
  },
  tag: {
    color: '#38BDF8',
    fontWeight: '700',
    fontSize: 11,
    width: 36,
  },
  name: {
    color: '#E2E8F0',
    fontSize: 11,
    flex: 1,
  },
  time: {
    color: '#94A3B8',
    fontSize: 10,
    marginLeft: 8,
  },
});

export default recordStartupPhase;
