/**
 * Orion POS Mobile Expo - Inventory & Stock Adjustment Service
 */

import StockAdjustmentRepository from '../../database/repositories/stock_adjustment.repository';
import ProductRepository from '../../database/repositories/product.repository';
import { StockAdjustment, Product } from '../../types';

export const InventoryService = {
  async getStockAdjustments(storeId: number = 1): Promise<StockAdjustment[]> {
    return StockAdjustmentRepository.getAll(storeId);
  },

  async adjustStock(
    productId: number,
    type: 'INCREASE' | 'DECREASE' | 'SET',
    quantity: number,
    reason: 'DAMAGED' | 'SPOILED' | 'RESTOCKED' | 'CORRECTION' | 'THEFT' | 'AUDIT' | 'OTHER',
    notes?: string,
    adjustedBy: string = 'Cashier',
    storeId: number = 1
  ): Promise<StockAdjustment> {
    return StockAdjustmentRepository.createAdjustment(
      productId,
      type,
      quantity,
      reason,
      notes,
      adjustedBy,
      storeId
    );
  },

  async getLowStockProducts(storeId: number = 1): Promise<Product[]> {
    const all = await ProductRepository.getAll(storeId);
    return all.filter((p) => p.stock <= (p.min_stock_level || 5));
  },
};

export default InventoryService;
