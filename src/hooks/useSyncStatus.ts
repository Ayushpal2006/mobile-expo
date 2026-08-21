/**
 * Orion POS Mobile Expo - Sync Status & Progress Listener Hook
 */

import { useState, useEffect } from 'react';
import SyncEngine, { SyncProgressState } from '../services/api/sync.service';
import { SyncStatus } from '../types';

export function useSyncStatus() {
  const [syncProgress, setSyncProgress] = useState<SyncProgressState>(SyncEngine.getSyncProgress());

  useEffect(() => {
    const unsubscribe = SyncEngine.subscribe((state) => {
      setSyncProgress(state);
    });
    return unsubscribe;
  }, []);

  const triggerSync = async (storeId: number = 1) => {
    return await SyncEngine.syncNow(storeId);
  };

  const retryFailed = async (storeId: number = 1) => {
    return await SyncEngine.retryFailed(storeId);
  };

  // Convert to legacy status string for backward compatibility
  let legacyStatus: SyncStatus = 'SYNCED';
  if (!syncProgress.isOnline) legacyStatus = 'OFFLINE';
  else if (syncProgress.status === 'syncing') legacyStatus = 'SYNCING';
  else if (syncProgress.status === 'error') legacyStatus = 'FAILED';
  else if (syncProgress.totalPending > 0) legacyStatus = 'PENDING';
  else legacyStatus = 'SYNCED';

  return {
    syncStatus: legacyStatus,
    pendingCount: syncProgress.totalPending,
    syncProgress,
    triggerSync,
    retryFailed,
  };
}

export default useSyncStatus;
