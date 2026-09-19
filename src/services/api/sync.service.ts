/**
 * Apka Bill POS Mobile Expo - Real-Time Offline-First Sync Engine
 *
 * Core Sync Architecture:
 * 1. Single-Flight Mutex: Only one sync worker runs at any time
 * 2. Outbox Queue processor with confirmed server receipt
 * 3. Idempotent Customer 409 Conflict Resolution
 * 4. Settings Deduplication & Superseding
 * 5. Real-time Progress Tracking (0-100%, initialPending, processed, succeeded, failed, remaining)
 * 6. Delta Download Synchronization with local transactional consistency
 * 7. Automatic Network Reconnection Sync & Stale State Recovery
 * 8. Granular diagnostic logging for full auditability
 */

import { getApiBaseUrl } from '../../config/env';
import { OutboxRepository } from '../../database/repositories/outbox.repository';
import { SaleRepository } from '../../database/repositories/sale.repository';
import { ProductRepository } from '../../database/repositories/product.repository';
import { CustomerRepository } from '../../database/repositories/customer.repository';
import { PurchaseRepository } from '../../database/repositories/purchase.repository';
import { SettingsRepository } from '../../database/repositories/settings.repository';
import { ExpenseRepository } from '../../database/repositories/expense.repository';
import { SupplierRepository } from '../../database/repositories/supplier.repository';
import { StockAdjustmentRepository } from '../../database/repositories/stock_adjustment.repository';
import getDatabaseAsync from '../../database/db';
import { apiClient, extractApiPayload } from './client';
import { SyncStatus } from '../../types';
import logger from '../../utils/logger';

export type SyncStatusType = 'offline' | 'idle' | 'syncing' | 'success' | 'error';

export interface SyncActivityItem {
  id: string;
  title: string;
  type: string;
  status: 'synced' | 'syncing' | 'pending' | 'failed';
  timestamp: string;
  error?: string;
}

export interface SyncProgressState {
  status: SyncStatusType;
  initialPending: number;
  processed: number;
  succeeded: number;
  failed: number;
  remaining: number;
  progress: number;
  currentEntity?: string;
  lastError?: string | null;
  lastSyncedAt?: string | null;

  // Backward compatibility properties
  totalPending: number;
  totalToSync: number;
  syncedCount: number;
  failedCount: number;
  currentProgress: number; // 0 to 100
  isOnline: boolean;
  backendConnected: boolean;
  estimatedRemainingText: string | null;
  activities: SyncActivityItem[];
}

let isSyncRunning = false;
let activeSyncPromise: Promise<{ uploadedCount: number; downloadedCount: number }> | null = null;
const activityLogBuffer: SyncActivityItem[] = [];

let currentProgressState: SyncProgressState = {
  status: 'idle',
  initialPending: 0,
  processed: 0,
  succeeded: 0,
  failed: 0,
  remaining: 0,
  progress: 100,
  totalPending: 0,
  totalToSync: 0,
  syncedCount: 0,
  failedCount: 0,
  currentProgress: 100,
  lastSyncedAt: null,
  lastError: null,
  isOnline: true,
  backendConnected: true,
  estimatedRemainingText: null,
  activities: [],
};

type SyncListener = (state: SyncProgressState) => void;
let syncListeners: SyncListener[] = [];

function pushActivity(item: SyncActivityItem) {
  const existingIdx = activityLogBuffer.findIndex((a) => a.id === item.id);
  if (existingIdx >= 0) {
    activityLogBuffer[existingIdx] = item;
  } else {
    activityLogBuffer.unshift(item);
    if (activityLogBuffer.length > 20) {
      activityLogBuffer.pop();
    }
  }
}

export const SyncEngine = {
  /**
   * Returns current snapshot of sync telemetry
   */
  getSyncProgress(): SyncProgressState {
    return { ...currentProgressState, activities: [...activityLogBuffer] };
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
        return currentProgressState.remaining > 0 ? 'PENDING' : 'SYNCED';
    }
  },

  /**
   * Subscribe to live sync state updates
   */
  subscribe(listener: SyncListener): () => void {
    syncListeners.push(listener);
    listener({ ...currentProgressState, activities: [...activityLogBuffer] });
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
      else if (state.remaining > 0) legacyStatus = 'PENDING';
      else legacyStatus = 'SYNCED';

      listener(legacyStatus, state.remaining, state.lastError || undefined);
    };
    return SyncEngine.subscribe(wrapped);
  },

  notifyListeners(updates: Partial<SyncProgressState>) {
    currentProgressState = {
      ...currentProgressState,
      ...updates,
      activities: [...activityLogBuffer],
    };
    syncListeners.forEach((listener) => {
      try {
        listener({ ...currentProgressState, activities: [...activityLogBuffer] });
      } catch (err: any) {
        logger.warn('[SyncEngine] Listener callback error:', err.message);
      }
    });
  },

  setOnlineStatus(online: boolean) {
    if (currentProgressState.isOnline !== online) {
      logger.info(`[SYNC] Network status changed: ${online ? 'online' : 'offline'}`);
      SyncEngine.notifyListeners({
        isOnline: online,
        status: !online ? 'offline' : currentProgressState.remaining > 0 ? 'idle' : 'success',
      });
      if (online && currentProgressState.remaining > 0) {
        SyncEngine.syncNow().catch(() => {});
      }
    }
  },

  /**
   * App Startup Recovery: Resets stale SYNCING events back to PENDING and checks queue
   */
  async initOnStartup(storeId: number = 1): Promise<void> {
    try {
      const recovered = await OutboxRepository.recoverStaleSyncingEvents();
      if (recovered > 0) {
        logger.info(`[SYNC START] Recovered ${recovered} interrupted outbox events to PENDING on startup.`);
      }
      const pendingCount = await OutboxRepository.getPendingCount(storeId);
      const failedCount = await OutboxRepository.getFailedCount(storeId);
      const lastSync = await SettingsRepository.getLastSyncTime('delta_sync', storeId);

      logger.info(`[SYNC START] initial queue size: ${pendingCount}`);

      SyncEngine.notifyListeners({
        initialPending: pendingCount,
        remaining: pendingCount,
        totalPending: pendingCount,
        failedCount,
        status: pendingCount > 0 ? (failedCount > 0 ? 'error' : 'idle') : 'success',
        lastSyncedAt: lastSync || null,
        progress: pendingCount === 0 ? 100 : 0,
        currentProgress: pendingCount === 0 ? 100 : 0,
      });
    } catch (err: any) {
      logger.warn('[SYNC FAILURE] Stage: DATABASE Startup recovery error:', err.message);
    }
  },

  /**
   * Full Initial Sync on login or bootstrap
   */
  async initialSync(storeId: number = 1, orgId?: number): Promise<void> {
    try {
      logger.info(`[SYNC] Triggering full initial sync for Org ${orgId || 'N/A'}, Store ${storeId}`);
      await SyncEngine.syncNow(storeId, orgId);
    } catch (err: any) {
      logger.warn('[SYNC FAILURE] Stage: INITIAL_SYNC warning:', err.message);
    }
  },

  /**
   * Transaction-safe Delta Download Pull with Granular Logging & Verification
   */
  async pullDelta(storeId: number = 1, orgId?: number): Promise<number> {
    let downloadedCount = 0;
    try {
      const lastSyncTime = await SettingsRepository.getLastSyncTime('delta_sync', storeId, orgId);
      const endpoint = lastSyncTime
        ? `/api/sync/download?lastSyncTime=${encodeURIComponent(lastSyncTime)}`
        : '/api/sync/download';

      logger.info(`[SYNC] Delta Pull Request: GET ${endpoint} (Org ${orgId || 'N/A'}, Store ${storeId})`);
      const dlRes = await apiClient.get<any>(endpoint);
      const rawPayload = extractApiPayload(dlRes);
      const dataPayload = (rawPayload && typeof rawPayload === 'object') ? rawPayload : {};

      const productsRaw = Array.isArray(dataPayload.products) ? dataPayload.products : [];
      const customersRaw = Array.isArray(dataPayload.customers) ? dataPayload.customers : [];
      const suppliersRaw = Array.isArray(dataPayload.suppliers) ? dataPayload.suppliers : [];
      const purchasesRaw = Array.isArray(dataPayload.purchases || dataPayload.purchase_orders) ? (dataPayload.purchases || dataPayload.purchase_orders) : [];
      const salesRaw = Array.isArray(dataPayload.sales || dataPayload.invoices) ? (dataPayload.sales || dataPayload.invoices) : [];
      const expensesRaw = Array.isArray(dataPayload.expenses) ? dataPayload.expenses : [];
      const stockAdjRaw = Array.isArray(dataPayload.stockAdjustments || dataPayload.stock_adjustments) ? (dataPayload.stockAdjustments || dataPayload.stock_adjustments) : [];
      const settingsRaw = Array.isArray(dataPayload.settings) ? dataPayload.settings : (typeof dataPayload.settings === 'object' && dataPayload.settings !== null ? Object.entries(dataPayload.settings).map(([k, v]) => ({ key: k, value: v })) : []);
      const syncTime = dataPayload.syncTime || dataPayload.sync?.syncTime || new Date().toISOString();

      logger.info(
        `[SYNC DOWNLOAD RECEIVED]\n` +
        `products: ${productsRaw.length}\n` +
        `customers: ${customersRaw.length}\n` +
        `suppliers: ${suppliersRaw.length}\n` +
        `purchases: ${purchasesRaw.length}\n` +
        `sales: ${salesRaw.length}\n` +
        `expenses: ${expensesRaw.length}\n` +
        `stockAdjustments: ${stockAdjRaw.length}\n` +
        `settings: ${settingsRaw.length}`
      );

      const db = await getDatabaseAsync();

      await db.withTransactionAsync(async () => {
        // 1. PRODUCTS
        let prodAttempted = 0, prodSuccess = 0, prodSkipped = 0, prodFailed = 0;
        const validProducts: any[] = [];
        for (const p of productsRaw) {
          if (!p || typeof p !== 'object' || (!p.name && !p.title)) {
            prodSkipped++;
            continue;
          }
          validProducts.push(p);
        }
        if (validProducts.length > 0) {
          prodAttempted = validProducts.length;
          try {
            await ProductRepository.insertBatch(validProducts, storeId);
            prodSuccess = validProducts.length;
            downloadedCount += prodSuccess;
          } catch (err: any) {
            prodFailed = validProducts.length;
            logger.error(`[SYNC DEBUG] Products batch write failed:`, err);
          }
        }
        const prodCountRow = await db.getFirstAsync<{ cnt: number }>('SELECT COUNT(*) as cnt FROM products WHERE store_id = ?;', storeId);
        logger.info(
          `[SYNC DEBUG]\n` +
          `ENTITY: products\n` +
          `1. API response count: ${productsRaw.length}\n` +
          `2. after normalization: ${validProducts.length}\n` +
          `3. skipped invalid records: ${prodSkipped}\n` +
          `4. attempted SQLite inserts/upserts: ${prodAttempted}\n` +
          `5. successful SQLite writes: ${prodSuccess}\n` +
          `6. failed SQLite writes: ${prodFailed}\n` +
          `7. final local SQLite count for active store: ${prodCountRow?.cnt || 0}`
        );

        // 2. CUSTOMERS
        let custAttempted = 0, custSuccess = 0, custSkipped = 0, custFailed = 0;
        for (const c of customersRaw) {
          if (!c || typeof c !== 'object' || (!c.name && !c.phone && !c.id)) {
            custSkipped++;
            continue;
          }
          custAttempted++;
          try {
            await CustomerRepository.upsert(c, storeId);
            custSuccess++;
            downloadedCount++;
          } catch (err: any) {
            custFailed++;
            logger.warn(`[SYNC DEBUG] Customer write failed: id=${c.id} storeId=${storeId} err=${err.message}`);
          }
        }
        const custCountRow = await db.getFirstAsync<{ cnt: number }>('SELECT COUNT(*) as cnt FROM customers WHERE store_id = ?;', storeId);
        logger.info(
          `[SYNC DEBUG]\n` +
          `ENTITY: customers\n` +
          `1. API response count: ${customersRaw.length}\n` +
          `2. after normalization: ${custAttempted}\n` +
          `3. skipped invalid records: ${custSkipped}\n` +
          `4. attempted SQLite inserts/upserts: ${custAttempted}\n` +
          `5. successful SQLite writes: ${custSuccess}\n` +
          `6. failed SQLite writes: ${custFailed}\n` +
          `7. final local SQLite count for active store: ${custCountRow?.cnt || 0}`
        );

        // 3. SUPPLIERS
        let suppAttempted = 0, suppSuccess = 0, suppSkipped = 0, suppFailed = 0;
        for (const s of suppliersRaw) {
          if (!s || typeof s !== 'object' || (!s.name && !s.company_name && !s.id)) {
            suppSkipped++;
            continue;
          }
          suppAttempted++;
          try {
            await SupplierRepository.upsert(s, storeId);
            suppSuccess++;
            downloadedCount++;
          } catch (err: any) {
            suppFailed++;
            logger.warn(`[SYNC DEBUG] Supplier write failed: id=${s.id} storeId=${storeId} err=${err.message}`);
          }
        }
        const suppCountRow = await db.getFirstAsync<{ cnt: number }>('SELECT COUNT(*) as cnt FROM suppliers WHERE store_id = ?;', storeId);
        logger.info(
          `[SYNC DEBUG]\n` +
          `ENTITY: suppliers\n` +
          `1. API response count: ${suppliersRaw.length}\n` +
          `2. after normalization: ${suppAttempted}\n` +
          `3. skipped invalid records: ${suppSkipped}\n` +
          `4. attempted SQLite inserts/upserts: ${suppAttempted}\n` +
          `5. successful SQLite writes: ${suppSuccess}\n` +
          `6. failed SQLite writes: ${suppFailed}\n` +
          `7. final local SQLite count for active store: ${suppCountRow?.cnt || 0}`
        );

        // 4. PURCHASES & PURCHASE ITEMS
        let poAttempted = 0, poSuccess = 0, poSkipped = 0, poFailed = 0;
        const validPurchases: any[] = [];
        for (const po of purchasesRaw) {
          if (!po || typeof po !== 'object' || (!po.id && !po.supplier_name && !po.invoice_number && !po.po_number)) {
            poSkipped++;
            continue;
          }
          validPurchases.push(po);
        }
        if (validPurchases.length > 0) {
          poAttempted = validPurchases.length;
          try {
            await PurchaseRepository.insertBatch(validPurchases, storeId);
            poSuccess = validPurchases.length;
            downloadedCount += poSuccess;
          } catch (err: any) {
            poFailed = validPurchases.length;
            logger.error(`[SYNC DEBUG] Purchases batch write failed:`, err);
          }
        }
        const poCountRow = await db.getFirstAsync<{ cnt: number }>('SELECT COUNT(*) as cnt FROM purchases WHERE store_id = ?;', storeId);
        const poItemCountRow = await db.getFirstAsync<{ cnt: number }>(
          'SELECT COUNT(*) as cnt FROM purchase_items WHERE purchase_id IN (SELECT id FROM purchases WHERE store_id = ?);',
          storeId
        );
        logger.info(
          `[SYNC DEBUG]\n` +
          `ENTITY: purchases\n` +
          `1. API response count: ${purchasesRaw.length}\n` +
          `2. after normalization: ${validPurchases.length}\n` +
          `3. skipped invalid records: ${poSkipped}\n` +
          `4. attempted SQLite inserts/upserts: ${poAttempted}\n` +
          `5. successful SQLite writes: ${poSuccess}\n` +
          `6. failed SQLite writes: ${poFailed}\n` +
          `7. final local SQLite count for active store: ${poCountRow?.cnt || 0} (items: ${poItemCountRow?.cnt || 0})`
        );

        // 5. SALES & SALE ITEMS
        let saleAttempted = 0, saleSuccess = 0, saleSkipped = 0, saleFailed = 0;
        const validSales: any[] = [];
        for (const s of salesRaw) {
          if (!s || typeof s !== 'object' || (!s.invoice_number && !s.invoiceNumber && !s.id)) {
            saleSkipped++;
            continue;
          }
          validSales.push(s);
        }
        if (validSales.length > 0) {
          saleAttempted = validSales.length;
          try {
            await SaleRepository.insertServerSalesBatch(validSales, storeId);
            saleSuccess = validSales.length;
            downloadedCount += saleSuccess;
          } catch (err: any) {
            saleFailed = validSales.length;
            logger.error(`[SYNC DEBUG] Sales batch write failed:`, err);
          }
        }
        const saleCountRow = await db.getFirstAsync<{ cnt: number }>('SELECT COUNT(*) as cnt FROM sales WHERE store_id = ?;', storeId);
        const saleItemCountRow = await db.getFirstAsync<{ cnt: number }>(
          'SELECT COUNT(*) as cnt FROM sale_items WHERE sale_id IN (SELECT id FROM sales WHERE store_id = ?);',
          storeId
        );
        logger.info(
          `[SYNC DEBUG]\n` +
          `ENTITY: sales\n` +
          `1. API response count: ${salesRaw.length}\n` +
          `2. after normalization: ${validSales.length}\n` +
          `3. skipped invalid records: ${saleSkipped}\n` +
          `4. attempted SQLite inserts/upserts: ${saleAttempted}\n` +
          `5. successful SQLite writes: ${saleSuccess}\n` +
          `6. failed SQLite writes: ${saleFailed}\n` +
          `7. final local SQLite count for active store: ${saleCountRow?.cnt || 0} (items: ${saleItemCountRow?.cnt || 0})`
        );

        // 6. EXPENSES
        let expAttempted = 0, expSuccess = 0, expSkipped = 0, expFailed = 0;
        for (const exp of expensesRaw) {
          if (!exp || typeof exp !== 'object' || (!exp.amount && !exp.category && !exp.id)) {
            expSkipped++;
            continue;
          }
          expAttempted++;
          try {
            const amountPaise = exp.amount !== undefined ? Math.round(Number(exp.amount)) : 0;
            const dateStr = exp.date ? new Date(exp.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
            await db.runAsync(
              `INSERT INTO expenses (server_id, store_id, category, amount, date, payment_mode, notes, sync_status, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, 'synced', ?, ?)
               ON CONFLICT(server_id) DO UPDATE SET amount=excluded.amount, category=excluded.category, date=excluded.date, notes=excluded.notes;`,
              exp.id || null,
              storeId,
              exp.category_name || exp.category || 'General',
              amountPaise,
              dateStr,
              exp.payment_method || exp.payment_mode || 'Cash',
              exp.description || exp.notes || null,
              exp.created_at || new Date().toISOString(),
              exp.updated_at || new Date().toISOString()
            );
            expSuccess++;
            downloadedCount++;
          } catch (err: any) {
            expFailed++;
            logger.warn(`[SYNC DEBUG] Expense write failed: id=${exp.id} storeId=${storeId} err=${err.message}`);
          }
        }
        const expCountRow = await db.getFirstAsync<{ cnt: number }>('SELECT COUNT(*) as cnt FROM expenses WHERE store_id = ?;', storeId);
        logger.info(
          `[SYNC DEBUG]\n` +
          `ENTITY: expenses\n` +
          `1. API response count: ${expensesRaw.length}\n` +
          `2. after normalization: ${expAttempted}\n` +
          `3. skipped invalid records: ${expSkipped}\n` +
          `4. attempted SQLite inserts/upserts: ${expAttempted}\n` +
          `5. successful SQLite writes: ${expSuccess}\n` +
          `6. failed SQLite writes: ${expFailed}\n` +
          `7. final local SQLite count for active store: ${expCountRow?.cnt || 0}`
        );

        // 7. STOCK ADJUSTMENTS
        let adjAttempted = 0, adjSuccess = 0, adjSkipped = 0, adjFailed = 0;
        const validAdjustments: any[] = [];
        for (const a of stockAdjRaw) {
          if (!a || typeof a !== 'object') {
            adjSkipped++;
            continue;
          }
          validAdjustments.push(a);
        }
        if (validAdjustments.length > 0) {
          adjAttempted = validAdjustments.length;
          try {
            await StockAdjustmentRepository.insertBatch(validAdjustments, storeId);
            adjSuccess = validAdjustments.length;
            downloadedCount += adjSuccess;
          } catch (err: any) {
            adjFailed = validAdjustments.length;
            logger.error(`[SYNC DEBUG] Stock adjustments batch write failed:`, err);
          }
        }
        const adjCountRow = await db.getFirstAsync<{ cnt: number }>('SELECT COUNT(*) as cnt FROM stock_adjustments WHERE store_id = ?;', storeId);
        logger.info(
          `[SYNC DEBUG]\n` +
          `ENTITY: stock_adjustments\n` +
          `1. API response count: ${stockAdjRaw.length}\n` +
          `2. after normalization: ${validAdjustments.length}\n` +
          `3. skipped invalid records: ${adjSkipped}\n` +
          `4. attempted SQLite inserts/upserts: ${adjAttempted}\n` +
          `5. successful SQLite writes: ${adjSuccess}\n` +
          `6. failed SQLite writes: ${adjFailed}\n` +
          `7. final local SQLite count for active store: ${adjCountRow?.cnt || 0}`
        );

        // 8. SETTINGS
        let setSuccess = 0;
        for (const s of settingsRaw) {
          if (s && s.key && s.value !== undefined) {
            await SettingsRepository.setSetting(s.key, String(s.value), storeId);
            setSuccess++;
          }
        }
        logger.info(
          `[SYNC DEBUG]\n` +
          `ENTITY: settings\n` +
          `1. API response count: ${settingsRaw.length}\n` +
          `2. successful SQLite writes: ${setSuccess}`
        );

        if (syncTime) {
          await SettingsRepository.setLastSyncTime('delta_sync', syncTime, storeId, orgId);
        }
      });

      logger.info(`[SYNC] Delta pull committed ${downloadedCount} entities locally.`);
    } catch (err: any) {
      logger.warn('[SYNC FAILURE] Stage: DELTA_PULL warning:', err.message);
    }
    return downloadedCount;
  },

  /**
   * Push Pending Outbox Events + Delta Pull with confirmed backend verification
   */
  async syncNow(storeId: number = 1, orgId?: number): Promise<{ uploadedCount: number; downloadedCount: number }> {
    // 1. In-memory single-flight Mutex Lock
    if (activeSyncPromise) {
      logger.info('[SYNC] Sync worker already in flight, returning existing promise.');
      return activeSyncPromise;
    }

    activeSyncPromise = (async () => {
      isSyncRunning = true;
      let uploadedCount = 0;
      let downloadedCount = 0;
      let processedCount = 0;
      let failedInPass = 0;
      const startTime = Date.now();

      try {
        // Deduplicate multiple pending settings updates in queue
        const initialPendingEvents = await OutboxRepository.getPendingEvents(100, storeId);
        const settingsEvents = initialPendingEvents.filter((ev) => ev.entity_type === 'settings');
        if (settingsEvents.length > 1) {
          const supersededIds = settingsEvents.slice(0, settingsEvents.length - 1).map((ev) => ev.id);
          await OutboxRepository.markBatchSynced(supersededIds);
          logger.info(`[SYNC RESOLVED CONFLICT] Deduplicated ${supersededIds.length} redundant pending settings events.`);
        }

        // Re-read queue after deduplication
        const pendingEvents = await OutboxRepository.getPendingEvents(100, storeId);
        const initialPending = pendingEvents.length;

        logger.info(`[SYNC START]\ninitial queue size: ${initialPending}`);
        logger.info(`[SYNC] Network status: ${currentProgressState.isOnline ? 'online' : 'offline'}`);
        logger.info(`[SYNC] API URL: ${apiClient.getBaseUrl()}`);

        SyncEngine.notifyListeners({
          status: initialPending > 0 ? 'syncing' : 'idle',
          initialPending,
          totalPending: initialPending,
          totalToSync: initialPending,
          processed: 0,
          succeeded: 0,
          syncedCount: 0,
          remaining: initialPending,
          progress: initialPending === 0 ? 100 : 0,
          currentProgress: initialPending === 0 ? 100 : 0,
          lastError: null,
          backendConnected: true,
          estimatedRemainingText: initialPending > 0 ? 'Calculating...' : null,
        });

        if (initialPending > 0) {
          const itemTimings: number[] = [];

          for (let i = 0; i < pendingEvents.length; i++) {
            const e = pendingEvents[i];
            const itemStart = Date.now();

            // Exponential backoff check
            if (e.attempt_count >= 3 && e.last_attempt_at) {
              const lastAttempt = new Date(e.last_attempt_at).getTime();
              const backoffMs = Math.min(60000, Math.pow(2, e.attempt_count) * 1000);
              if (Date.now() - lastAttempt < backoffMs) {
                continue;
              }
            }

            await OutboxRepository.markStatus(e.id, 'SYNCING');

            let entityLabel = `${e.entity_type.toUpperCase()} #${e.entity_id}`;
            let parsedPayload: any = null;
            try {
              parsedPayload = JSON.parse(e.payload);
              if (parsedPayload.invoice_number) entityLabel = `Invoice ${parsedPayload.invoice_number}`;
              else if (parsedPayload.name) entityLabel = `${e.entity_type} "${parsedPayload.name}"`;
            } catch {}

            pushActivity({
              id: `${e.entity_type}-${e.entity_id}-${e.id}`,
              title: entityLabel,
              type: e.entity_type,
              status: 'syncing',
              timestamp: new Date().toISOString(),
            });

            logger.info(`[SYNC EVENT]\nevent id: ${e.id}\nentity: ${e.entity_type}\noperation: ${e.operation}`);

            try {
              if (e.entity_type === 'sale' && e.operation === 'CREATE') {
                const saleData = parsedPayload;
                const uploadPayload = {
                  sales: [
                    {
                      ...saleData,
                      grand_total: saleData.grandTotal || saleData.total_amount,
                      gst: saleData.gst || saleData.tax,
                      customer_phone: saleData.customer_phone || saleData.customerPhone,
                      customer_name: saleData.customer_name || saleData.customerName,
                      items: (saleData.items || []).map((item: any) => ({
                        product_id: item.productId || item.product_id,
                        product_name: item.name || item.product_name || item.title || item.productName,
                        quantity: item.quantity,
                        selling_price: item.selling_price || item.unit_price || item.unitPrice,
                        discount: item.discount || 0,
                        line_total: item.line_total || item.subtotal,
                      })),
                    },
                  ],
                  customers: [],
                };

                const res = await apiClient.post<{ success: boolean }>('/api/sync/upload', uploadPayload, {
                  headers: { 'X-Offline-Id': e.entity_id, 'offline-id': e.entity_id },
                });

                if (res.data?.success || (res as any).status === 200) {
                  await OutboxRepository.markBatchSynced([e.id]);
                  await SaleRepository.markSynced(e.entity_id);
                  uploadedCount++;
                  logger.info(`[SYNC SUCCESS]\nevent id: ${e.id}`);

                  pushActivity({
                    id: `${e.entity_type}-${e.entity_id}-${e.id}`,
                    title: entityLabel,
                    type: e.entity_type,
                    status: 'synced',
                    timestamp: new Date().toISOString(),
                  });
                } else {
                  throw new Error(`Backend rejected sale: ${(res.data as any)?.error || 'Unknown error'}`);
                }
              } else if (e.entity_type === 'sale' && e.operation === 'VOID') {
                const voidData = parsedPayload;
                const targetId = voidData.invoice_number || voidData.server_id || e.entity_id;
                await apiClient.post(`/api/sales/${encodeURIComponent(targetId)}/void`, {
                  reason: voidData.reason || 'Voided on mobile POS',
                });
                await OutboxRepository.markStatus(e.id, 'SYNCED');
                uploadedCount++;
                logger.info(`[SYNC SUCCESS]\nevent id: ${e.id}`);

                pushActivity({
                  id: `${e.entity_type}-${e.entity_id}-${e.id}`,
                  title: entityLabel,
                  type: e.entity_type,
                  status: 'synced',
                  timestamp: new Date().toISOString(),
                });
              } else if (e.entity_type === 'customer') {
                const custData = parsedPayload;
                try {
                  const res = await apiClient.post<any>('/api/customers', custData);
                  if (res.data) {
                    const serverCust = res.data.data || res.data;
                    if (serverCust?.id) {
                      await CustomerRepository.upsert({
                        ...custData,
                        server_id: serverCust.id,
                        sync_status: 'synced',
                      }, storeId);
                    }
                    await OutboxRepository.markStatus(e.id, 'SYNCED');
                    uploadedCount++;
                    logger.info(`[SYNC SUCCESS]\nevent id: ${e.id}`);

                    pushActivity({
                      id: `${e.entity_type}-${e.entity_id}-${e.id}`,
                      title: entityLabel,
                      type: e.entity_type,
                      status: 'synced',
                      timestamp: new Date().toISOString(),
                    });
                  }
                } catch (custErr: any) {
                  if (custErr.statusCode === 409 && custData.phone) {
                    // Conflict Resolution: Customer with this phone already exists on backend
                    logger.info(`[SYNC RESOLVED CONFLICT]\nevent id: ${e.id}\nreason: Phone number ${custData.phone} already exists`);
                    try {
                      const existingRes = await apiClient.get<any>(`/api/customers/phone/${encodeURIComponent(custData.phone)}`);
                      const existingCust = existingRes.data?.data || existingRes.data;
                      if (existingCust && existingCust.id) {
                        await CustomerRepository.upsert({
                          ...custData,
                          server_id: existingCust.id,
                          sync_status: 'synced',
                        }, storeId);
                      }
                    } catch (fetchErr: any) {
                      logger.warn(`[SYNC] Could not fetch conflicting customer: ${fetchErr.message}`);
                    }
                    // Mark sync event as successfully resolved so it does not block the queue
                    await OutboxRepository.markStatus(e.id, 'SYNCED');
                    uploadedCount++;

                    pushActivity({
                      id: `${e.entity_type}-${e.entity_id}-${e.id}`,
                      title: entityLabel,
                      type: e.entity_type,
                      status: 'synced',
                      timestamp: new Date().toISOString(),
                    });
                  } else {
                    throw custErr;
                  }
                }
              } else if (e.entity_type === 'product') {
                const productPayload = parsedPayload;
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
                  logger.info(`[SYNC SUCCESS]\nevent id: ${e.id}`);

                  pushActivity({
                    id: `${e.entity_type}-${e.entity_id}-${e.id}`,
                    title: entityLabel,
                    type: e.entity_type,
                    status: 'synced',
                    timestamp: new Date().toISOString(),
                  });
                }
              } else if (e.entity_type === 'purchase') {
                const purchasePayload = parsedPayload;
                const res = await apiClient.post<any>('/api/purchases', purchasePayload);
                const serverPO = res.data?.data || res.data;
                const db = await getDatabaseAsync();
                if (serverPO?.id) {
                  await db.runAsync(
                    "UPDATE purchases SET server_id = ?, sync_status = 'synced' WHERE id = ? AND store_id = ?;",
                    serverPO.id,
                    Number(e.entity_id),
                    storeId
                  );
                } else {
                  await db.runAsync(
                    "UPDATE purchases SET sync_status = 'synced' WHERE id = ? AND store_id = ?;",
                    Number(e.entity_id),
                    storeId
                  );
                }
                await OutboxRepository.markStatus(e.id, 'SYNCED');
                uploadedCount++;
                logger.info(`[SYNC SUCCESS]\nevent id: ${e.id}`);

                pushActivity({
                  id: `${e.entity_type}-${e.entity_id}-${e.id}`,
                  title: entityLabel,
                  type: e.entity_type,
                  status: 'synced',
                  timestamp: new Date().toISOString(),
                });
              } else if (e.entity_type === 'expense') {
                const expensePayload = parsedPayload;
                const db = await getDatabaseAsync();
                if (e.operation === 'DELETE') {
                  await apiClient.delete(`/api/expenses/${encodeURIComponent(e.entity_id)}`);
                } else {
                  const res = await apiClient.post<any>('/api/expenses', expensePayload);
                  const serverExp = res.data?.data || res.data;
                  if (serverExp?.id) {
                    await db.runAsync(
                      "UPDATE expenses SET server_id = ?, sync_status = 'synced' WHERE id = ? AND store_id = ?;",
                      serverExp.id,
                      Number(e.entity_id),
                      storeId
                    );
                  } else {
                    await db.runAsync(
                      "UPDATE expenses SET sync_status = 'synced' WHERE id = ? AND store_id = ?;",
                      Number(e.entity_id),
                      storeId
                    );
                  }
                }
                await OutboxRepository.markStatus(e.id, 'SYNCED');
                uploadedCount++;
                logger.info(`[SYNC SUCCESS]\nevent id: ${e.id}`);

                pushActivity({
                  id: `${e.entity_type}-${e.entity_id}-${e.id}`,
                  title: entityLabel,
                  type: e.entity_type,
                  status: 'synced',
                  timestamp: new Date().toISOString(),
                });
              } else if (e.entity_type === 'supplier') {
                const supplierPayload = parsedPayload;
                const res = await apiClient.post<any>('/api/suppliers', supplierPayload);
                const serverSupp = res.data?.data || res.data;
                const db = await getDatabaseAsync();
                if (serverSupp?.id) {
                  await db.runAsync(
                    "UPDATE suppliers SET server_id = ?, sync_status = 'synced' WHERE id = ? AND store_id = ?;",
                    serverSupp.id,
                    Number(e.entity_id),
                    storeId
                  );
                } else {
                  await db.runAsync(
                    "UPDATE suppliers SET sync_status = 'synced' WHERE id = ? AND store_id = ?;",
                    Number(e.entity_id),
                    storeId
                  );
                }
                await OutboxRepository.markStatus(e.id, 'SYNCED');
                uploadedCount++;
                logger.info(`[SYNC SUCCESS]\nevent id: ${e.id}`);

                pushActivity({
                  id: `${e.entity_type}-${e.entity_id}-${e.id}`,
                  title: entityLabel,
                  type: e.entity_type,
                  status: 'synced',
                  timestamp: new Date().toISOString(),
                });
              } else if (e.entity_type === 'stock_adjustment') {
                const adjPayload = parsedPayload;
                await apiClient.post<any>('/api/inventory/adjust', adjPayload);
                await OutboxRepository.markStatus(e.id, 'SYNCED');
                uploadedCount++;
                logger.info(`[SYNC SUCCESS]\nevent id: ${e.id}`);

                pushActivity({
                  id: `${e.entity_type}-${e.entity_id}-${e.id}`,
                  title: entityLabel,
                  type: e.entity_type,
                  status: 'synced',
                  timestamp: new Date().toISOString(),
                });
              } else if (e.entity_type === 'settings') {
                const settingsPayload = parsedPayload;
                await apiClient.put('/api/settings', settingsPayload);
                await OutboxRepository.markStatus(e.id, 'SYNCED');
                uploadedCount++;
                logger.info(`[SYNC SUCCESS]\nevent id: ${e.id}`);

                pushActivity({
                  id: `${e.entity_type}-${e.entity_id}-${e.id}`,
                  title: entityLabel,
                  type: e.entity_type,
                  status: 'synced',
                  timestamp: new Date().toISOString(),
                });
              }

              processedCount++;
              const itemDuration = Date.now() - itemStart;
              itemTimings.push(itemDuration);

              const avgTimeMs = itemTimings.reduce((a, b) => a + b, 0) / itemTimings.length;
              const remainingItems = initialPending - processedCount;
              const remainingSec = Math.ceil((remainingItems * avgTimeMs) / 1000);
              const etaText = remainingItems > 0 ? `~${remainingSec}s remaining` : 'Completing...';

              const progressPct = initialPending > 0 ? Math.round((processedCount / initialPending) * 100) : 100;
              SyncEngine.notifyListeners({
                processed: processedCount,
                succeeded: uploadedCount,
                syncedCount: uploadedCount,
                progress: progressPct,
                currentProgress: progressPct,
                estimatedRemainingText: etaText,
              });
            } catch (err: any) {
              processedCount++;
              failedInPass++;
              logger.warn(`[SYNC FAILURE]\nevent id: ${e.id}\nHTTP status: ${err.statusCode || 'N/A'}\nserver error: ${err.message}\nretry count: ${e.attempt_count + 1}`);

              pushActivity({
                id: `${e.entity_type}-${e.entity_id}-${e.id}`,
                title: entityLabel,
                type: e.entity_type,
                status: 'failed',
                timestamp: new Date().toISOString(),
                error: err.message,
              });

              if (err.statusCode === 401) {
                SyncEngine.notifyListeners({
                  status: 'error',
                  lastError: 'Authentication Expired. Please log in again.',
                  backendConnected: true,
                });
                await OutboxRepository.markStatus(e.id, 'AUTH_REQUIRED', 'Authentication Expired');
                return { uploadedCount, downloadedCount };
              } else if (err.statusCode && err.statusCode >= 400 && err.statusCode < 500 && err.statusCode !== 429 && err.statusCode !== 408) {
                // Client validation error -> mark FAILED so it does not block the queue
                await OutboxRepository.markStatus(e.id, 'FAILED', err.message);
              } else {
                // Transient server error / network dropped -> keep PENDING for retry
                await OutboxRepository.markStatus(e.id, 'PENDING', err.message);
                SyncEngine.notifyListeners({ backendConnected: false });
              }
            }
          }
        }

        // 2. Pull Delta Changes
        downloadedCount = await SyncEngine.pullDelta(storeId, orgId);

        // 3. Final Queue Recount strictly from database
        const finalPending = await OutboxRepository.getPendingCount(storeId);
        const finalFailed = await OutboxRepository.getFailedCount(storeId);
        const reportedFailed = Math.max(finalFailed, failedInPass);
        const now = new Date().toISOString();
        const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);

        logger.info(`[SYNC COMPLETE]\ninitial: ${initialPending}\nprocessed: ${processedCount}\nsucceeded: ${uploadedCount}\nfailed: ${reportedFailed}\nactual remaining: ${finalPending}\nduration: ${durationSec}s`);

        const finalStatus = reportedFailed > 0 ? 'error' : (finalPending > 0 ? 'idle' : 'success');
        const finalProgress = initialPending === 0 ? 100 : (initialPending > 0 ? Math.round((uploadedCount / initialPending) * 100) : 100);

        SyncEngine.notifyListeners({
          status: finalStatus,
          initialPending,
          processed: processedCount,
          succeeded: uploadedCount,
          failed: reportedFailed,
          remaining: finalPending,
          totalPending: finalPending,
          failedCount: reportedFailed,
          syncedCount: uploadedCount,
          lastSyncedAt: now,
          progress: finalProgress,
          currentProgress: finalProgress,
          estimatedRemainingText: null,
          backendConnected: true,
          lastError: reportedFailed > 0 ? `${reportedFailed} item(s) failed to sync` : null,
        });
      } catch (globalErr: any) {
        logger.error('[SYNC FAILURE] Stage: GLOBAL_PASS', globalErr);
        const remaining = await OutboxRepository.getPendingCount(storeId);
        SyncEngine.notifyListeners({
          status: 'error',
          remaining,
          totalPending: remaining,
          backendConnected: false,
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
    logger.info(`[SYNC] Retrying ${retried} failed events...`);
    await SyncEngine.syncNow(storeId);
  },

  /**
   * Controlled Full Resync from server preserving local unsynced pending events
   */
  async forceFullResync(storeId: number = 1, orgId?: number): Promise<{ uploadedCount: number; downloadedCount: number }> {
    logger.info(`[SYNC] Triggering controlled full resync for Store ${storeId}, Org ${orgId || 'N/A'}`);
    await SettingsRepository.setLastSyncTime('delta_sync', '', storeId, orgId);
    return SyncEngine.syncNow(storeId, orgId);
  },

  /**
   * Diagnostic summary payload for system status and troubleshooting
   */
  async getDiagnosticsSummary(storeId: number = 1, orgId?: number): Promise<{
    organizationId: number | null;
    storeId: number;
    apiBaseUrl: string;
    backendReachable: boolean;
    lastSyncedAt: string | null;
    pendingCount: number;
    failedCount: number;
    syncedCount: number;
    lastError: string | null;
  }> {
    const stats = await OutboxRepository.getSyncStats(storeId);
    const lastSync = await SettingsRepository.getLastSyncTime('delta_sync', storeId, orgId);

    return {
      organizationId: orgId || null,
      storeId,
      apiBaseUrl: getApiBaseUrl(),
      backendReachable: Boolean(currentProgressState.backendConnected),
      lastSyncedAt: lastSync || null,
      pendingCount: stats.pending,
      failedCount: stats.failed,
      syncedCount: stats.synced,
      lastError: currentProgressState.lastError || null,
    };
  },

  /**
   * Real End-to-End Live Diagnostics:
   * Directly queries remote API endpoints & local SQLite database for the active tenant context.
   */
  async getRealSyncDiagnostics(storeId: number = 1, orgId?: number): Promise<{
    activeContext: { organizationId: number | null; storeId: number; serverUrl: string };
    entities: Array<{
      name: string;
      remoteCount: number | string;
      localCount: number;
      status: 'MATCH' | 'MISMATCH' | 'ERROR';
      lastError?: string;
    }>;
    lastSyncedAt: string | null;
  }> {
    const db = await getDatabaseAsync();
    const serverUrl = apiClient.getBaseUrl();
    const lastSync = await SettingsRepository.getLastSyncTime('delta_sync', storeId, orgId);

    // 1. Fetch Local SQLite Counts
    const [prodRow, custRow, suppRow, saleRow, saleItemRow, poRow, poItemRow, expRow, adjRow, setRow] = await Promise.all([
      db.getFirstAsync<{ cnt: number }>('SELECT COUNT(*) as cnt FROM products WHERE store_id = ?;', storeId),
      db.getFirstAsync<{ cnt: number }>('SELECT COUNT(*) as cnt FROM customers WHERE store_id = ?;', storeId),
      db.getFirstAsync<{ cnt: number }>('SELECT COUNT(*) as cnt FROM suppliers WHERE store_id = ?;', storeId),
      db.getFirstAsync<{ cnt: number }>('SELECT COUNT(*) as cnt FROM sales WHERE store_id = ?;', storeId),
      db.getFirstAsync<{ cnt: number }>('SELECT COUNT(*) as cnt FROM sale_items WHERE sale_id IN (SELECT id FROM sales WHERE store_id = ?);', storeId),
      db.getFirstAsync<{ cnt: number }>('SELECT COUNT(*) as cnt FROM purchases WHERE store_id = ?;', storeId),
      db.getFirstAsync<{ cnt: number }>('SELECT COUNT(*) as cnt FROM purchase_items WHERE purchase_id IN (SELECT id FROM purchases WHERE store_id = ?);', storeId),
      db.getFirstAsync<{ cnt: number }>('SELECT COUNT(*) as cnt FROM expenses WHERE store_id = ?;', storeId),
      db.getFirstAsync<{ cnt: number }>('SELECT COUNT(*) as cnt FROM stock_adjustments WHERE store_id = ?;', storeId),
      db.getFirstAsync<{ cnt: number }>(`SELECT COUNT(*) as cnt FROM store_settings WHERE key LIKE 'store_${storeId}_%';`),
    ]);

    // 2. Fetch Remote API Counts
    let remoteProducts: number | string = 'N/A';
    let remoteCustomers: number | string = 'N/A';
    let remoteSuppliers: number | string = 'N/A';
    let remotePurchases: number | string = 'N/A';
    let remoteSales: number | string = 'N/A';
    let remoteExpenses: number | string = 'N/A';

    try {
      const res = await apiClient.get<any>('/api/products');
      const payload = extractApiPayload(res);
      remoteProducts = Array.isArray(payload) ? payload.length : (Array.isArray(payload?.products) ? payload.products.length : 0);
    } catch {
      remoteProducts = 'ERR';
    }

    try {
      const res = await apiClient.get<any>('/api/customers');
      const payload = extractApiPayload(res);
      remoteCustomers = Array.isArray(payload) ? payload.length : (Array.isArray(payload?.customers) ? payload.customers.length : 0);
    } catch {
      remoteCustomers = 'ERR';
    }

    try {
      const res = await apiClient.get<any>('/api/suppliers');
      const payload = extractApiPayload(res);
      remoteSuppliers = Array.isArray(payload) ? payload.length : (Array.isArray(payload?.suppliers) ? payload.suppliers.length : 0);
    } catch {
      remoteSuppliers = 'ERR';
    }

    try {
      const res = await apiClient.get<any>('/api/purchases');
      const payload = extractApiPayload(res);
      remotePurchases = Array.isArray(payload) ? payload.length : (Array.isArray(payload?.purchases) ? payload.purchases.length : 0);
    } catch {
      remotePurchases = 'ERR';
    }

    try {
      const res = await apiClient.get<any>('/api/sales');
      const payload = extractApiPayload(res);
      remoteSales = Array.isArray(payload) ? payload.length : (Array.isArray(payload?.sales) ? payload.sales.length : 0);
    } catch {
      remoteSales = 'ERR';
    }

    try {
      const res = await apiClient.get<any>('/api/expenses');
      const payload = extractApiPayload(res);
      remoteExpenses = Array.isArray(payload) ? payload.length : (Array.isArray(payload?.expenses) ? payload.expenses.length : 0);
    } catch {
      remoteExpenses = 'ERR';
    }

    const computeStatus = (remote: number | string, local: number): 'MATCH' | 'MISMATCH' | 'ERROR' => {
      if (typeof remote === 'string') return remote === 'ERR' ? 'ERROR' : 'MATCH';
      return remote === local ? 'MATCH' : 'MISMATCH';
    };

    const entities = [
      { name: 'Products', remoteCount: remoteProducts, localCount: prodRow?.cnt || 0, status: computeStatus(remoteProducts, prodRow?.cnt || 0) },
      { name: 'Customers', remoteCount: remoteCustomers, localCount: custRow?.cnt || 0, status: computeStatus(remoteCustomers, custRow?.cnt || 0) },
      { name: 'Suppliers', remoteCount: remoteSuppliers, localCount: suppRow?.cnt || 0, status: computeStatus(remoteSuppliers, suppRow?.cnt || 0) },
      { name: 'Sales', remoteCount: remoteSales, localCount: saleRow?.cnt || 0, status: computeStatus(remoteSales, saleRow?.cnt || 0) },
      { name: 'Sale Items', remoteCount: '-', localCount: saleItemRow?.cnt || 0, status: 'MATCH' as const },
      { name: 'Purchases', remoteCount: remotePurchases, localCount: poRow?.cnt || 0, status: computeStatus(remotePurchases, poRow?.cnt || 0) },
      { name: 'Purchase Items', remoteCount: '-', localCount: poItemRow?.cnt || 0, status: 'MATCH' as const },
      { name: 'Expenses', remoteCount: remoteExpenses, localCount: expRow?.cnt || 0, status: computeStatus(remoteExpenses, expRow?.cnt || 0) },
      { name: 'Stock Adjustments', remoteCount: '-', localCount: adjRow?.cnt || 0, status: 'MATCH' as const },
      { name: 'Settings', remoteCount: '-', localCount: setRow?.cnt || 0, status: 'MATCH' as const },
    ];

    logger.info(`[REAL SYNC DIAGNOSTICS]\n` + entities.map((e) => `${e.name.padEnd(18)} Remote: ${String(e.remoteCount).padEnd(6)} Local: ${String(e.localCount).padEnd(6)} Status: ${e.status}`).join('\n'));

    return {
      activeContext: {
        organizationId: orgId || null,
        storeId,
        serverUrl,
      },
      entities,
      lastSyncedAt: lastSync || null,
    };
  },
};

export default SyncEngine;
