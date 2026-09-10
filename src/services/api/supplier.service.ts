/**
 * Orion POS Mobile Expo - Supplier Domain Service
 */

import SupplierRepository from '../../database/repositories/supplier.repository';
import { apiClient, extractApiPayload } from './client';
import { SyncEngine } from './sync.service';
import { Supplier } from '../../types';

export const SupplierService = {
  async getSuppliers(storeId: number = 1): Promise<Supplier[]> {
    const local = await SupplierRepository.getAll(storeId);
    if (local.length > 0) {
      return local;
    }

    try {
      const res = await apiClient.get<any>('/api/suppliers');
      const payload = extractApiPayload(res);
      const list = Array.isArray(payload) ? payload : (Array.isArray(payload?.suppliers) ? payload.suppliers : []);
      for (const s of list) {
        if (!s || typeof s !== 'object') continue;
        await SupplierRepository.upsert(s, storeId);
      }
      return await SupplierRepository.getAll(storeId);
    } catch {
      return local;
    }
  },

  async searchSuppliers(query: string, storeId: number = 1): Promise<Supplier[]> {
    return SupplierRepository.search(query, storeId);
  },

  async createOrUpdateSupplier(supplierData: Partial<Supplier>, storeId: number = 1): Promise<Supplier> {
    const saved = await SupplierRepository.upsert(supplierData, storeId);
    SyncEngine.syncNow(storeId).catch(() => {});
    return saved;
  },
};

export default SupplierService;
