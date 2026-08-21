/**
 * Orion POS Mobile Expo - Network Status & Sync Queue Hook
 */

import { useState, useEffect, useRef } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { OutboxRepository } from '../database/repositories/outbox.repository';
import { SyncEngine } from '../services/api/sync.service';

export interface NetworkStatus {
  isConnected: boolean;
  pendingQueueCount: number;
  syncNow: () => Promise<void>;
}

export function useNetworkStatus(storeId: number = 1): NetworkStatus {
  const [isConnected, setIsConnected] = useState<boolean>(true);
  const [pendingQueueCount, setPendingQueueCount] = useState<number>(0);
  const wasOffline = useRef(false);

  const checkQueueCount = async () => {
    try {
      const pending = await OutboxRepository.getPendingCount(storeId);
      setPendingQueueCount(pending);
    } catch {
      // ignore db check errors while initializing
    }
  };

  useEffect(() => {
    checkQueueCount();

    const unsubscribe = NetInfo.addEventListener((state) => {
      const online = !!state.isConnected && state.isInternetReachable !== false;
      setIsConnected(online);
      SyncEngine.setOnlineStatus(online);

      // Trigger automatic sync on network reconnect (OFFLINE -> ONLINE transition)
      if (online && wasOffline.current) {
        wasOffline.current = false;
        SyncEngine.syncNow(storeId).catch(() => {});
      } else if (!online) {
        wasOffline.current = true;
      }

      checkQueueCount();
    });

    const interval = setInterval(checkQueueCount, 4000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, [storeId]);

  const syncNow = async () => {
    if (isConnected) {
      await SyncEngine.syncNow(storeId);
      await checkQueueCount();
    }
  };

  return { isConnected, pendingQueueCount, syncNow };
}

export default useNetworkStatus;
