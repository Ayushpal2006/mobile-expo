/**
 * Apka Bill Mobile Expo - Official App Shell Header Component
 *
 * Features:
 * - Safe-area aware header with Official Canonical Logo
 * - Real-Time Sync Indicator & Interactive Sync Details Modal
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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import useNetworkStatus from '../../hooks/useNetworkStatus';
import useSyncStatus from '../../hooks/useSyncStatus';
import { SPACING, COLORS, Button, RADIUS, SHADOWS } from './UIComponents';

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
    if (!isConnected || !syncProgress.isOnline) {
      return (
        <TouchableOpacity
          style={[styles.badgeBtn, { backgroundColor: '#64748B' }]}
          onPress={() => setSyncModalVisible(true)}
          activeOpacity={0.7}
        >
          <Text style={styles.badgeText}>
            📡 Offline {syncProgress.totalPending > 0 ? `(${syncProgress.totalPending})` : ''}
          </Text>
        </TouchableOpacity>
      );
    }

    if (syncProgress.status === 'syncing') {
      return (
        <TouchableOpacity
          style={[styles.badgeBtn, { backgroundColor: '#2563EB' }]}
          onPress={() => setSyncModalVisible(true)}
          activeOpacity={0.7}
        >
          <Text style={styles.badgeText}>⚡ {syncProgress.currentProgress}%</Text>
        </TouchableOpacity>
      );
    }

    if (syncProgress.failedCount > 0 || syncProgress.status === 'error') {
      return (
        <TouchableOpacity
          style={[styles.badgeBtn, { backgroundColor: '#DC2626' }]}
          onPress={() => setSyncModalVisible(true)}
          activeOpacity={0.7}
        >
          <Text style={styles.badgeText}>⚠️ Sync ({syncProgress.failedCount})</Text>
        </TouchableOpacity>
      );
    }

    if (syncProgress.totalPending > 0) {
      return (
        <TouchableOpacity
          style={[styles.badgeBtn, { backgroundColor: '#D97706' }]}
          onPress={() => setSyncModalVisible(true)}
          activeOpacity={0.7}
        >
          <Text style={styles.badgeText}>⚡ Sync ({syncProgress.totalPending})</Text>
        </TouchableOpacity>
      );
    }

    return (
      <TouchableOpacity
        style={[styles.badgeBtn, { backgroundColor: '#059669' }]}
        onPress={() => setSyncModalVisible(true)}
        activeOpacity={0.7}
      >
        <Text style={styles.badgeText}>✓ Synced</Text>
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
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.sm }}>
              <Text style={styles.modalTitle}>Data Synchronization Health</Text>
              <TouchableOpacity onPress={() => setSyncModalVisible(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={{ fontSize: 18, color: COLORS.textMuted, fontWeight: '700' }}>✕</Text>
              </TouchableOpacity>
            </View>

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
                 syncProgress.status === 'syncing' ? `🔄 Syncing (${syncProgress.currentProgress}%)` :
                 syncProgress.failedCount > 0 ? `⚠️ ${syncProgress.failedCount} Items Need Attention` :
                 syncProgress.totalPending > 0 ? `⚡ ${syncProgress.totalPending} Changes Pending Sync` :
                 '✓ All Data Synchronized'}
              </Text>
              <Text style={styles.statusBannerSub}>
                {!isConnected ? 'Changes made offline are safely stored locally in SQLite and will sync automatically when back online.' :
                 syncProgress.status === 'syncing' ? `Uploaded ${syncProgress.syncedCount} of ${syncProgress.totalToSync} queued events.` :
                 syncProgress.failedCount > 0 ? 'Some records encountered errors during server upload. Tap Retry to resubmit.' :
                 syncProgress.totalPending > 0 ? 'Offline sales or stock adjustments are waiting to be confirmed by the cloud.' :
                 'All invoices, catalog items, and financial records are confirmed with cloud backend.'}
              </Text>
            </View>

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

            <Text style={styles.lastSyncText}>
              Last Synchronized: {syncProgress.lastSyncedAt ? new Date(syncProgress.lastSyncedAt).toLocaleString('en-IN') : 'Just now'}
            </Text>

            {/* Action Buttons */}
            <View style={{ marginTop: SPACING.md, gap: 8 }}>
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
    maxWidth: 420,
    ...SHADOWS.md,
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  statusBanner: {
    padding: 12,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    marginBottom: SPACING.sm,
  },
  statusBannerTitle: {
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 2,
  },
  statusBannerSub: {
    fontSize: 11,
    color: '#475569',
    lineHeight: 16,
  },
  metricsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    marginVertical: SPACING.xs,
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
    fontSize: 16,
    fontWeight: '900',
    color: '#0F172A',
    marginTop: 2,
  },
  lastSyncText: {
    fontSize: 11,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 6,
  },
});

export default Header;
