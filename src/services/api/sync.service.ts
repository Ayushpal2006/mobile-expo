/**
 * Apka Bill POS Mobile Expo - Real-Time Offline-First Sync Engine
 *
 * Core Sync Architecture:
 * 1. Outbox Queue processor with confirmed server receipt
 * 2. Real-time Progress Tracking (0-100%, totalPending, syncedCount, failedCount)
 * 3. Delta Download Synchronization with local transactional consistency
 * 4. Automatic Network Reconnection Sync & Stale State Recovery
 * 5. Idempotent upload payloads preventing duplicate transactions
 */

import { OutboxRepository } from '../../database/repositories/outbox.repository';
import { SaleRepository } from '../../database/repositories/sale.repository';
import { ProductRepository } from '../../database/repositories/product.repository';
import { CustomerRepository } from '../../database/repositories/customer.repository';
import { PurchaseRepository } from '../../database/repositories/purchase.repository';
import { SettingsRepository } from '../../database/repositories/settings.repository';
import { ExpenseRepository } from '../../database/repositories/expense.repository';
import { SupplierRepository } from '../../database/repositories/supplier.repository';
import getDatabaseAsync from '../../database/db';
import { apiClient } from './client';
import { SyncStatus } from '../../types';
import logger from '../../utils/logger';

export type SyncStatusType = 'offline' | 'idle' | 'syncing' | 'success' | 'error';

export interface SyncProgressState {
  status: SyncStatusType;
  totalPending: number;
  totalToSync: number;
  syncedCount: number;
  failedCount: number;
  currentProgress: number; // 0 to 100
  lastSyncedAt: string | null;
  lastError: string | null;
  isOnline: boolean;
}

let isSyncRunning = false;
let activeSyncPromise: Promise<{ uploadedCount: number; downloadedCount: number }> | null = null;

let currentProgressState: SyncProgressState = {
  status: 'idle',
  totalPending: 0,
  totalToSync: 0,
  syncedCount: 0,
  failedCount: 0,
  currentProgress: 100,
  lastSyncedAt: null,
  lastError: null,
  isOnline: true,
};

type SyncListener = (state: SyncProgressState) => void;
let syncListeners: SyncListener[] = [];

export const SyncEngine = {
  /**
   * Returns current snapshot of sync telemetry
   */
  getSyncProgress(): SyncProgressState {
    return { ...currentProgressState };
  },

  /**
   * Legacy status getter for backward compatibility
   */
  getSyncState(): SyncStatus {
    switch (currentProgressState.status) {
      case 'syncing':
        return 'SYNCING';
      case 'offline':
        return 'OFFLINE';
      case 'error':
        return 'FAILED';
      case 'success':
        return 'SYNCED';
      case 'idle':
      default:
        return currentProgressState.totalPending > 0 ? 'PENDING' : 'SYNCED';
    }
  },

  /**
   * Subscribe to live sync state updates
   */
  subscribe(listener: SyncListener): () => void {
    syncListeners.push(listener);
    listener({ ...currentProgressState });
    return () => {
      syncListeners = syncListeners.filter((l) => l !== listener);
    };
  },

  /**
   * Legacy subscriber for backward compatibility
   */
  subscribeStatus(listener: (status: SyncStatus, count: number, error?: string) => void): () => void {
    const wrapped: SyncListener = (state) => {
      let legacyStatus: SyncStatus = 'SYNCED';
      if (!state.isOnline) legacyStatus = 'OFFLINE';
      else if (state.status === 'syncing') legacyStatus = 'SYNCING';
      else if (state.status === 'error') legacyStatus = 'FAILED';
      else if (state.totalPending > 0) legacyStatus = 'PENDING';
      else legacyStatus = 'SYNCED';

      listener(legacyStatus, state.totalPending, state.lastError || undefined);
    };
    return SyncEngine.subscribe(wrapped);
  },

  notifyListeners(updates: Partial<SyncProgressState>) {
    currentProgressState = {
      ...currentProgressState,
      ...updates,
    };
    syncListeners.forEach((listener) => {
      try {
        listener({ ...currentProgressState });
      } catch (err: any) {
        logger.warn('[SyncEngine] Listener callback error:', err.message);
      }
    });
  },

  setOnlineStatus(online: boolean) {
    if (currentProgressState.isOnline !== online) {
      SyncEngine.notifyListeners({
        isOnline: online,
        status: !online ? 'offline' : currentProgressState.totalPending > 0 ? 'idle' : 'success',
      });
    }
  },

  /**
   * App Startup Recovery: Resets stale SYNCING events back to PENDING and checks queue
   */
  async initOnStartup(storeId: number = 1): Promise<void> {
    try {
      const recovered = await OutboxRepository.recoverStaleSyncingEvents();
      if (recovered > 0) {
        logger.info(`[SyncEngine] Recovered ${recovered} interrupted outbox events to PENDING.`);
      }
      const pendingCount = await OutboxRepository.getPendingCount(storeId);
      const failedCount = await OutboxRepository.getFailedCount(storeId);
      const lastSync = await SettingsRepository.getLastSyncTime('delta_sync', storeId);

      SyncEngine.notifyListeners({
        totalPending: pendingCount,
        failedCount,
        status: pendingCount > 0 ? (failedCount > 0 ? 'error' : 'idle') : 'success',
        lastSyncedAt: lastSync || null,
        currentProgress: pendingCount === 0 ? 100 : 0,
      });
    } catch (err: any) {
      logger.warn('[SyncEngine] Startup recovery error:', err.message);
    }
  },

  /**
   * Full Initial Sync on login or bootstrap
   */
  async initialSync(storeId: number = 1): Promise<void> {
    try {
      await SyncEngine.syncNow(storeId);
    } catch (err: any) {
      logger.warn('[SyncEngine] initialSync warning:', err.message);
    }
  },

  /**
   * Transaction-safe Delta Download Pull
   */
  async pullDelta(storeId: number = 1): Promise<number> {
    let downloadedCount = 0;
    try {
      const lastSyncTime = await SettingsRepository.getLastSyncTime('delta_sync', storeId);
      const endpoint = lastSyncTime
        ? `/api/sync/download?lastSyncTime=${encodeURIComponent(lastSyncTime)}`
        : '/api/sync/download';

      logger.info(`[SyncEngine] Pulling delta updates from endpoint: ${endpoint}`);
      const dlRes = await apiClient.get<{
        success: boolean;
        data: {
          products: any[];
          customers: any[];
          settings: any[];
          syncTime: string;
        };
      }>(endpoint);

      if (dlRes.data && dlRes.data.success && dlRes.data.data) {
        const { products, customers, settings, syncTime } = dlRes.data.data;
        const db = await getDatabaseAsync();

        await db.withTransactionAsync(async () => {
          if (Array.isArray(products) && products.length > 0) {
            await ProductRepository.insertBatch(products, storeId);
            downloadedCount += products.length;
          }

          if (Array.isArray(customers) && customers.length > 0) {
            for (const c of customers) {
              await CustomerRepository.upsert(c, storeId);
            }
            downloadedCount += customers.length;
          }

          if (Array.isArray(settings) && settings.length > 0) {
            for (const s of settings) {
              if (s.key && s.value) {
                await SettingsRepository.setSetting(s.key, s.value, storeId);
              }
            }
          }

          if (syncTime) {
            await SettingsRepository.setLastSyncTime('delta_sync', syncTime, storeId);
          }
        });

        logger.info(`[SyncEngine] Delta pull committed ${downloadedCount} entities locally.`);
      }
    } catch (err: any) {
      logger.warn('[SyncEngine] Delta download pull warning:', err.message);
    }
    return downloadedCount;
  },

  /**
   * Push Pending Outbox Events + Delta Pull with confirmed backend verification
   */
  async syncNow(storeId: number = 1): Promise<{ uploadedCount: number; downloadedCount: number }> {
    if (activeSyncPromise) {
      logger.info('[SyncEngine] Sync already in flight, returning existing promise.');
      return activeSyncPromise;
    }

    activeSyncPromise = (async () => {
      isSyncRunning = true;
      let uploadedCount = 0;
      let downloadedCount = 0;

      try {
        const pendingEvents = await OutboxRepository.getPendingEvents(100, storeId);
        const totalToSync = pendingEvents.length;

        SyncEngine.notifyListeners({
          status: totalToSync > 0 ? 'syncing' : 'idle',
          totalPending: totalToSync,
          totalToSync,
          syncedCount: 0,
          currentProgress: totalToSync === 0 ? 100 : 0,
          lastError: null,
        });

        if (totalToSync > 0) {
          logger.info(`[SyncEngine] Starting upload of ${totalToSync} queued items for Store ${storeId}...`);

          for (let i = 0; i < pendingEvents.length; i++) {
            const e = pendingEvents[i];

            // Exponential backoff check
            if (e.attempt_count >= 3 && e.last_attempt_at) {
              const lastAttempt = new Date(e.last_attempt_at).getTime();
              const backoffMs = Math.min(60000, Math.pow(2, e.attempt_count) * 1000);
              if (Date.now() - lastAttempt < backoffMs) {
                continue;
              }
            }

            await OutboxRepository.markStatus(e.id, 'SYNCING');

            try {
              if (e.entity_type === 'sale' && e.operation === 'CREATE') {
                const saleData = JSON.parse(e.payload);
                const uploadPayload = {
                  sales: [
                    {
                      ...saleData,
                      grand_total: saleData.grandTotal || saleData.total_amount,
                      gst: saleData.gst || saleData.tax,
                      items: (saleData.items || []).map((i: any) => ({
                        product_id: i.productId || i.product_id,
                        quantity: i.quantity,
                        selling_price: i.selling_price || i.unit_price || i.unitPrice,
                        discount: i.discount || 0,
                        line_total: i.line_total || i.subtotal,
                      })),
                    },
                  ],
                  customers: [],
                };

                logger.info(`[SyncEngine] Sending sale to /api/sync/upload: invoice ${saleData.invoice_number}`);
                const res = await apiClient.post<{ success: boolean }>('/api/sync/upload', uploadPayload, {
                  headers: { 'X-Offline-Id': e.entity_id, 'offline-id': e.entity_id },
                });

                if (res.data?.success || (res as any).status === 200) {
                  await OutboxRepository.markBatchSynced([e.id]);
                  await SaleRepository.markSynced(e.entity_id);
                  uploadedCount++;
                } else {
                  throw new Error(`Upload returned unsuccessful: ${(res.data as any)?.error || res.error || 'Unknown error'}`);
                }
              } else if (e.entity_type === 'sale' && e.operation === 'VOID') {
                const voidData = JSON.parse(e.payload);
                const targetId = voidData.invoice_number || voidData.server_id || e.entity_id;
                await apiClient.post(`/api/sales/${encodeURIComponent(targetId)}/void`, {
                  reason: voidData.reason || 'Voided on mobile POS',
                });
                await OutboxRepository.markStatus(e.id, 'SYNCED');
                uploadedCount++;
              } else if (e.entity_type === 'customer') {
                const custData = JSON.parse(e.payload);
                const res = await apiClient.post<any>('/api/customers', custData);
                if (res.data) {
                  await OutboxRepository.markStatus(e.id, 'SYNCED');
                  uploadedCount++;
                }
              } else if (e.entity_type === 'product') {
                const productPayload = JSON.parse(e.payload);
                const res = await apiClient.post<any>('/api/products', productPayload);
                if (res.data) {
                  const serverProd = res.data.data || res.data;
                  if (serverProd?.id) {
                    await ProductRepository.upsert({
                      id: Number(e.entity_id),
                      server_id: serverProd.id,
                      sync_status: 'synced' as any,
                    }, storeId);
                  }
                  await OutboxRepository.markStatus(e.id, 'SYNCED');
                  uploadedCount++;
                }
              } else if (e.entity_type === 'purchase') {
                const purchasePayload = JSON.parse(e.payload);
                await apiClient.post<any>('/api/purchases', purchasePayload);
                await OutboxRepository.markStatus(e.id, 'SYNCED');
                uploadedCount++;
              } else if (e.entity_type === 'expense') {
                const expensePayload = JSON.parse(e.payload);
                if (e.operation === 'DELETE') {
                  await apiClient.delete(`/api/expenses/${encodeURIComponent(e.entity_id)}`);
                } else {
                  await apiClient.post<any>('/api/expenses', expensePayload);
                }
                await OutboxRepository.markStatus(e.id, 'SYNCED');
                uploadedCount++;
              } else if (e.entity_type === 'supplier') {
                const supplierPayload = JSON.parse(e.payload);
                await apiClient.post<any>('/api/suppliers', supplierPayload);
                await OutboxRepository.markStatus(e.id, 'SYNCED');
                uploadedCount++;
              } else if (e.entity_type === 'stock_adjustment') {
                const adjPayload = JSON.parse(e.payload);
                await apiClient.post<any>('/api/inventory/adjust', adjPayload);
                await OutboxRepository.markStatus(e.id, 'SYNCED');
                uploadedCount++;
              } else if (e.entity_type === 'settings') {
                const settingsPayload = JSON.parse(e.payload);
                await apiClient.put('/api/settings', settingsPayload);
                await OutboxRepository.markStatus(e.id, 'SYNCED');
                uploadedCount++;
              }

              // Update progress incrementally
              const progressPct = Math.round(((i + 1) / totalToSync) * 100);
              SyncEngine.notifyListeners({
                syncedCount: uploadedCount,
                currentProgress: progressPct,
              });
            } catch (err: any) {
              logger.warn(`[SyncEngine] Upload failed for ${e.entity_type} ID ${e.entity_id}:`, err.message);
              if (err.statusCode === 401) {
                SyncEngine.notifyListeners({
                  status: 'error',
                  lastError: 'Authentication Expired. Please log in again.',
                });
                await OutboxRepository.markStatus(e.id, 'AUTH_REQUIRED', 'Authentication Expired');
                return { uploadedCount, downloadedCount };
              } else if (err.statusCode && err.statusCode >= 400 && err.statusCode < 500 && err.statusCode !== 429 && err.statusCode !== 408) {
                // Client error (400 validation error) -> mark FAILED so it does not block the queue
                await OutboxRepository.markStatus(e.id, 'FAILED', err.message);
              } else {
                // Transient server error / network dropped -> keep PENDING for retry
                await OutboxRepository.markStatus(e.id, 'PENDING', err.message);
              }
            }
          }
        }

        // 2. Pull Delta Changes
        downloadedCount = await SyncEngine.pullDelta(storeId);

        // 3. Final Queue Recount
        const remainingPending = await OutboxRepository.getPendingCount(storeId);
        const failedCount = await OutboxRepository.getFailedCount(storeId);
        const now = new Date().toISOString();

        SyncEngine.notifyListeners({
          totalPending: remainingPending,
          failedCount,
          status: remainingPending > 0 ? (failedCount > 0 ? 'error' : 'idle') : 'success',
          lastSyncedAt: now,
          currentProgress: 100,
          lastError: failedCount > 0 ? `${failedCount} item(s) failed to sync` : null,
        });

        logger.info(`[SyncEngine] Sync cycle completed successfully. Uploaded: ${uploadedCount}, Downloaded: ${downloadedCount}, Remaining Pending: ${remainingPending}`);
      } catch (globalErr: any) {
        logger.error('[SyncEngine] Global sync pass error:', globalErr);
        const remaining = await OutboxRepository.getPendingCount(storeId);
        SyncEngine.notifyListeners({
          status: 'error',
          totalPending: remaining,
          lastError: globalErr.message || 'Sync failed',
        });
      } finally {
        isSyncRunning = false;
        activeSyncPromise = null;
      }

      return { uploadedCount, downloadedCount };
    })();

    return activeSyncPromise;
  },

  /**
   * Retry all failed outbox items
   */
  async retryFailed(storeId: number = 1): Promise<void> {
    const retried = await OutboxRepository.retryFailedEvents(storeId);
    logger.info(`[SyncEngine] Retrying ${retried} failed events...`);
    await SyncEngine.syncNow(storeId);
  },
};

export default SyncEngine;
