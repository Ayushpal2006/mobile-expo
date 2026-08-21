/**
 * Orion POS Mobile Expo - Purchase Domain Service (Local-First SQLite)
 */

import { PurchaseRepository } from '../../database/repositories/purchase.repository';
import { Purchase } from '../../types';

export const PurchaseService = {
  async getPurchases(storeId: number = 1): Promise<Purchase[]> {
    return PurchaseRepository.getAll(storeId);
  },

  async createPurchase(
    supplierName: string,
    invoiceNumber: string | undefined,
    items: Array<{ productId?: number; productName: string; quantity: number; costPrice: number }>,
    totalAmount: number,
    supplierId?: number,
    storeId: number = 1
  ): Promise<Purchase> {
    return PurchaseRepository.createPurchaseTransaction(
      supplierName,
      invoiceNumber,
      items,
      totalAmount,
      supplierId,
      storeId
    );
  },
};

export default PurchaseService;

