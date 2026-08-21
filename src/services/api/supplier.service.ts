/**
 * Orion POS Mobile Expo - Supplier Service
 */

import SupplierRepository from '../../database/repositories/supplier.repository';
import { Supplier } from '../../types';

export const SupplierService = {
  async getSuppliers(storeId: number = 1): Promise<Supplier[]> {
    return SupplierRepository.getAll(storeId);
  },

  async searchSuppliers(query: string, storeId: number = 1): Promise<Supplier[]> {
    return SupplierRepository.search(query, storeId);
  },

  async createOrUpdateSupplier(supplierData: Partial<Supplier>, storeId: number = 1): Promise<Supplier> {
    return SupplierRepository.upsert(supplierData, storeId);
  },
};

export default SupplierService;
