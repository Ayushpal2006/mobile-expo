/**
 * Apka Bill Mobile Expo - Official App Shell Header Component
 *
 * Features:
 * - Safe-area aware header with Official Canonical Logo
 * - Real-Time Sync Indicator & Interactive Sync Details Modal
 * - Live Activity Stream, Accurate Progress Bar, and ETA
 * - Multi-Store context & quick cashier actions
 */

import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Platform,
  Image,
  StatusBar,
  Modal,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import useNetworkStatus from '../../hooks/useNetworkStatus';
import useSyncStatus from '../../hooks/useSyncStatus';
import { SPACING, COLORS, Button, RADIUS, SHADOWS } from './UIComponents';
import { CONFIG } from '../../config/env';

interface HeaderProps {
  onOpenDrawer?: () => void;
  onOpenSearch?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenDrawer }) => {
  const { user, store, organization, logout } = useAuth();
  const { isConnected } = useNetworkStatus();
  const { syncProgress, triggerSync, retryFailed } = useSyncStatus();
  const [syncModalVisible, setSyncModalVisible] = useState(false);
  const [isSyncingManual, setIsSyncingManual] = useState(false);

  const insets = useSafeAreaInsets();
  const topPadding = Math.max(insets.top, Platform.OS === 'android' ? StatusBar.currentHeight || 0 : 0);

  const storeName = store?.name || organization?.name || 'Main Store';
  const storeId = store?.id || 1;

  const handleManualSync = async () => {
    setIsSyncingManual(true);
    try {
      await triggerSync(storeId);
    } finally {
      setIsSyncingManual(false);
    }
  };

  const handleRetryFailed = async () => {
    setIsSyncingManual(true);
    try {
      await retryFailed(storeId);
    } finally {
      setIsSyncingManual(false);
    }
  };

  // Render Real-Time Sync Status Badge
  const renderSyncBadge = () => {
    const pending = syncProgress.remaining !== undefined ? syncProgress.remaining : syncProgress.totalPending;
    const failed = syncProgress.failed !== undefined ? syncProgress.failed : syncProgress.failedCount;

    if (!isConnected || !syncProgress.isOnline) {
      return (
        <TouchableOpacity
          style={[styles.badgeBtn, { backgroundColor: '#64748B' }]}
          onPress={() => setSyncModalVisible(true)}
          activeOpacity={0.7}
        >
          <Text style={styles.badgeText}>
            📡 Offline{pending > 0 ? ` • ${pending} pending` : ''}
          </Text>
        </TouchableOpacity>
      );
    }

    if (syncProgress.status === 'syncing') {
      const processed = syncProgress.processed || syncProgress.succeeded || 1;
      const total = syncProgress.initialPending || syncProgress.totalToSync || 1;
      const pct = syncProgress.progress || syncProgress.currentProgress || 0;
      return (
        <TouchableOpacity
          style={[styles.badgeBtn, { backgroundColor: '#2563EB' }]}
          onPress={() => setSyncModalVisible(true)}
          activeOpacity={0.7}
        >
          <Text style={styles.badgeText}>⚡ Syncing {processed}/{total} • {pct}%</Text>
        </TouchableOpacity>
      );
    }

    if (failed > 0 || syncProgress.status === 'error') {
      return (
        <TouchableOpacity
          style={[styles.badgeBtn, { backgroundColor: '#DC2626' }]}
          onPress={() => setSyncModalVisible(true)}
          activeOpacity={0.7}
        >
          <Text style={styles.badgeText}>⚠️ {failed} failed • Retry</Text>
        </TouchableOpacity>
      );
    }

    if (pending > 0) {
      return (
        <TouchableOpacity
          style={[styles.badgeBtn, { backgroundColor: '#D97706' }]}
          onPress={() => setSyncModalVisible(true)}
          activeOpacity={0.7}
        >
          <Text style={styles.badgeText}>⚡ {pending} pending</Text>
        </TouchableOpacity>
      );
    }

    return (
      <TouchableOpacity
        style={[styles.badgeBtn, { backgroundColor: '#059669' }]}
        onPress={() => setSyncModalVisible(true)}
        activeOpacity={0.7}
      >
        <Text style={styles.badgeText}>✓ All synced</Text>
      </TouchableOpacity>
    );
  };

  return (
    <>
      <View style={[styles.safeAreaContainer, { paddingTop: topPadding }]}>
        <View style={styles.headerContainer}>
          {/* Left: Hamburger & Brand with Official Logo */}
          <View style={styles.leftSection}>
            <TouchableOpacity style={styles.menuBtn} onPress={onOpenDrawer} activeOpacity={0.7}>
              <Text style={styles.menuIcon}>☰</Text>
            </TouchableOpacity>

            <Image
              source={require('../../../assets/logo.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />

            <View style={{ marginLeft: 6 }}>
              <Text style={styles.brandTitle}>Apka Bill</Text>
              <View style={styles.storeBadgeRow}>
                <Text style={styles.storeText} numberOfLines={1}>🏬 {storeName}</Text>
              </View>
            </View>
          </View>

          {/* Right: Sync Badge & Profile */}
          <View style={styles.rightSection}>
            {renderSyncBadge()}

            <TouchableOpacity style={styles.avatarBtn} onPress={logout} activeOpacity={0.7}>
              <Text style={styles.avatarText}>
                {user?.name ? user.name.slice(0, 2).toUpperCase() : 'CS'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Sync Health & Diagnostics Modal */}
      <Modal visible={syncModalVisible} animationType="fade" transparent onRequestClose={() => setSyncModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.xs }}>
              <Text style={styles.modalTitle}>Synchronization Health</Text>
              <TouchableOpacity onPress={() => setSyncModalVisible(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={{ fontSize: 18, color: COLORS.textMuted, fontWeight: '700' }}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
              {/* Status Summary Banner */}
              <View style={[
                styles.statusBanner,
                !isConnected ? { backgroundColor: '#F1F5F9', borderColor: '#CBD5E1' } :
                syncProgress.status === 'syncing' ? { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' } :
                syncProgress.failedCount > 0 ? { backgroundColor: '#FEF2F2', borderColor: '#FECACA' } :
                syncProgress.totalPending > 0 ? { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' } :
                { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }
              ]}>
                <Text style={[
                  styles.statusBannerTitle,
                  !isConnected ? { color: '#475569' } :
                  syncProgress.status === 'syncing' ? { color: '#2563EB' } :
                  syncProgress.failedCount > 0 ? { color: '#DC2626' } :
                  syncProgress.totalPending > 0 ? { color: '#D97706' } :
                  { color: '#059669' }
                ]}>
                  {!isConnected ? '📡 Device Offline' :
                   syncProgress.status === 'syncing' ? `🔄 Syncing (${syncProgress.syncedCount}/${syncProgress.totalToSync} records)` :
                   syncProgress.failedCount > 0 ? `⚠️ ${syncProgress.failedCount} Items Need Attention` :
                   syncProgress.totalPending > 0 ? `⚡ ${syncProgress.totalPending} Changes Pending Sync` :
                   '✓ All Data Synchronized'}
                </Text>
                <Text style={styles.statusBannerSub}>
                  {!isConnected ? 'Changes made offline are safely stored in local SQLite and will sync automatically when reconnected.' :
                   syncProgress.status === 'syncing' ? (syncProgress.estimatedRemainingText ? `Processing queue... ${syncProgress.estimatedRemainingText}` : `Uploaded ${syncProgress.syncedCount} of ${syncProgress.totalToSync} queued events.`) :
                   syncProgress.failedCount > 0 ? 'Some records encountered errors during server upload. Tap Retry below.' :
                   syncProgress.totalPending > 0 ? 'Offline sales or inventory adjustments are queued for cloud upload.' :
                   'All local sales, catalog updates, and transactions are confirmed with cloud backend.'}
                </Text>
              </View>

              {/* Progress Bar (Visible during sync or pending) */}
              {(syncProgress.status === 'syncing' || syncProgress.totalPending > 0) && (
                <View style={styles.progressBarContainer}>
                  <View style={[styles.progressBarFill, { width: `${Math.max(5, syncProgress.currentProgress)}%` }]} />
                </View>
              )}

              {/* Metrics Grid */}
              <View style={styles.metricsGrid}>
                <View style={styles.metricItem}>
                  <Text style={styles.metricLabel}>Pending</Text>
                  <Text style={[styles.metricValue, syncProgress.totalPending > 0 && { color: '#D97706' }]}>
                    {syncProgress.totalPending}
                  </Text>
                </View>
                <View style={styles.metricItem}>
                  <Text style={styles.metricLabel}>Synced</Text>
                  <Text style={[styles.metricValue, { color: '#059669' }]}>
                    {syncProgress.syncedCount}
                  </Text>
                </View>
                <View style={styles.metricItem}>
                  <Text style={styles.metricLabel}>Failed</Text>
                  <Text style={[styles.metricValue, syncProgress.failedCount > 0 && { color: '#DC2626' }]}>
                    {syncProgress.failedCount}
                  </Text>
                </View>
                <View style={styles.metricItem}>
                  <Text style={styles.metricLabel}>Progress</Text>
                  <Text style={styles.metricValue}>
                    {syncProgress.currentProgress}%
                  </Text>
                </View>
              </View>

              {/* Server Diagnostics & Target */}
              <View style={styles.diagBox}>
                <Text style={styles.diagText}>• Network: {isConnected ? '🟢 Online' : '🔴 Offline'}</Text>
                <Text style={styles.diagText}>• Backend: {syncProgress.backendConnected ? '🟢 Connected' : '🔴 Unreachable'}</Text>
                <Text style={styles.diagText} numberOfLines={1}>• Endpoint: {CONFIG.apiBaseUrl}</Text>
                <Text style={styles.diagText}>• Last Synced: {syncProgress.lastSyncedAt ? new Date(syncProgress.lastSyncedAt).toLocaleTimeString('en-IN') : 'Just now'}</Text>
              </View>

              {/* Live Activity Stream */}
              {syncProgress.activities && syncProgress.activities.length > 0 ? (
                <View style={styles.activitySection}>
                  <Text style={styles.activityHeader}>Recent Sync Activity</Text>
                  {syncProgress.activities.slice(0, 5).map((act) => (
                    <View key={act.id} style={styles.activityRow}>
                      <Text style={styles.activityIcon}>
                        {act.status === 'synced' ? '✓' : act.status === 'syncing' ? '⏳' : act.status === 'failed' ? '❌' : '○'}
                      </Text>
                      <Text style={styles.activityTitle} numberOfLines={1}>
                        {act.title}
                      </Text>
                      <Text style={[
                        styles.activityStatus,
                        act.status === 'synced' ? { color: '#059669' } :
                        act.status === 'failed' ? { color: '#DC2626' } :
                        { color: '#2563EB' }
                      ]}>
                        {act.status.toUpperCase()}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </ScrollView>

            {/* Action Buttons */}
            <View style={{ marginTop: SPACING.sm, gap: 6 }}>
              <Button
                title={isSyncingManual || syncProgress.status === 'syncing' ? 'Syncing...' : '🔄 Sync Now'}
                onPress={handleManualSync}
                loading={isSyncingManual || syncProgress.status === 'syncing'}
                variant="primary"
                disabled={!isConnected}
              />

              {syncProgress.failedCount > 0 && (
                <Button
                  title="⚠️ Retry Failed Items"
                  onPress={handleRetryFailed}
                  variant="outline"
                  loading={isSyncingManual}
                />
              )}

              <Button
                title="Close"
                variant="secondary"
                onPress={() => setSyncModalVisible(false)}
              />
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  safeAreaContainer: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerContainer: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.sm,
    backgroundColor: '#FFFFFF',
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  menuBtn: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: '#F8FAFC',
    marginRight: 6,
  },
  menuIcon: {
    fontSize: 18,
    color: COLORS.text,
  },
  logoImage: {
    width: 28,
    height: 28,
  },
  brandTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  storeBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  storeText: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
    maxWidth: 140,
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  badgeBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  avatarBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#2563EB',
    fontSize: 12,
    fontWeight: '800',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.md,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    width: '100%',
    maxWidth: 440,
    ...SHADOWS.md,
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  statusBanner: {
    padding: 10,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    marginBottom: SPACING.xs,
  },
  statusBannerTitle: {
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 2,
  },
  statusBannerSub: {
    fontSize: 11,
    color: '#475569',
    lineHeight: 15,
  },
  progressBarContainer: {
    height: 6,
    backgroundColor: '#E2E8F0',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 6,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#2563EB',
  },
  metricsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: RADIUS.md,
    padding: 8,
    marginVertical: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  metricItem: {
    alignItems: 'center',
    flex: 1,
  },
  metricLabel: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  metricValue: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0F172A',
    marginTop: 1,
  },
  diagBox: {
    backgroundColor: '#F1F5F9',
    borderRadius: RADIUS.sm,
    padding: 8,
    marginTop: 4,
  },
  diagText: {
    fontSize: 11,
    color: '#475569',
    marginVertical: 1,
  },
  activitySection: {
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingTop: 6,
  },
  activityHeader: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  activityIcon: {
    fontSize: 11,
    marginRight: 6,
  },
  activityTitle: {
    fontSize: 11,
    color: '#0F172A',
    flex: 1,
    fontWeight: '600',
  },
  activityStatus: {
    fontSize: 10,
    fontWeight: '700',
    marginLeft: 6,
  },
});

export default Header;
