/**
 * Orion POS Mobile Expo - Purchase Domain Service (Local-First SQLite)
 */

import { PurchaseRepository } from '../../database/repositories/purchase.repository';
import { apiClient, extractApiPayload } from './client';
import { SyncEngine } from './sync.service';
import { Purchase } from '../../types';

export const PurchaseService = {
  async getPurchases(storeId: number = 1): Promise<Purchase[]> {
    const local = await PurchaseRepository.getAll(storeId);
    if (local.length > 0) {
      return local;
    }

    try {
      const res = await apiClient.get<any>('/api/purchases');
      const payload = extractApiPayload(res);
      const list = Array.isArray(payload) ? payload : (Array.isArray(payload?.purchases) ? payload.purchases : []);
      if (list.length > 0) {
        await PurchaseRepository.insertBatch(list, storeId);
        return await PurchaseRepository.getAll(storeId);
      }
    } catch {
      // fallback
    }

    return local;
  },

  async createPurchase(
    supplierName: string,
    invoiceNumber: string | undefined,
    items: Array<{ productId?: number; productName: string; quantity: number; costPrice: number }>,
    totalAmount: number,
    supplierId?: number,
    storeId: number = 1
  ): Promise<Purchase> {
    const created = await PurchaseRepository.createPurchaseTransaction(
      supplierName,
      invoiceNumber,
      items,
      totalAmount,
      supplierId,
      storeId
    );
    SyncEngine.syncNow(storeId).catch(() => {});
    return created;
  },
};

export default PurchaseService;
