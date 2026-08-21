/**
 * Orion POS Mobile Expo - Stock Adjustment Repository
 */

import getDatabaseAsync from '../db';
import { DBStockAdjustment, DBProduct } from '../models';
import { StockAdjustment } from '../../types';

export const StockAdjustmentRepository = {
  mapToDomain(dbA: DBStockAdjustment): StockAdjustment {
    return {
      id: dbA.id,
      server_id: dbA.server_id || undefined,
      store_id: dbA.store_id || 1,
      product_id: dbA.product_id,
      product_name: dbA.product_name,
      adjustment_type: dbA.adjustment_type,
      quantity: dbA.quantity,
      previous_stock: dbA.previous_stock,
      new_stock: dbA.new_stock,
      reason: dbA.reason as any,
      notes: dbA.notes || undefined,
      adjusted_by: dbA.adjusted_by || undefined,
      sync_status: dbA.sync_status as any,
      created_at: dbA.created_at,
    };
  },

  async getAll(storeId: number = 1): Promise<StockAdjustment[]> {
    const db = await getDatabaseAsync();
    const rows = await db.getAllAsync<DBStockAdjustment>(
      'SELECT * FROM stock_adjustments WHERE store_id = ? ORDER BY id DESC LIMIT 100;',
      storeId
    );
    return rows.map(StockAdjustmentRepository.mapToDomain);
  },

  async getByProductId(productId: number, storeId: number = 1): Promise<StockAdjustment[]> {
    const db = await getDatabaseAsync();
    const rows = await db.getAllAsync<DBStockAdjustment>(
      'SELECT * FROM stock_adjustments WHERE store_id = ? AND product_id = ? ORDER BY id DESC;',
      storeId,
      productId
    );
    return rows.map(StockAdjustmentRepository.mapToDomain);
  },

  /**
   * Atomically adjusts product stock and logs audit trail
   */
  async createAdjustment(
    productId: number,
    type: 'INCREASE' | 'DECREASE' | 'SET',
    quantity: number,
    reason: 'DAMAGED' | 'SPOILED' | 'RESTOCKED' | 'CORRECTION' | 'THEFT' | 'AUDIT' | 'OTHER',
    notes?: string,
    adjustedBy: string = 'Cashier',
    storeId: number = 1
  ): Promise<StockAdjustment> {
    const db = await getDatabaseAsync();
    const now = new Date().toISOString();

    let insertedId: number = 0;

    await db.withTransactionAsync(async () => {
      // 1. Get current product stock
      const product = await db.getFirstAsync<DBProduct>(
        'SELECT * FROM products WHERE id = ? AND store_id = ?;',
        productId,
        storeId
      );

      if (!product) {
        throw new Error(`Product with ID ${productId} not found.`);
      }

      const prevStock = product.stock;
      let newStock = prevStock;

      if (type === 'INCREASE') {
        newStock = prevStock + quantity;
      } else if (type === 'DECREASE') {
        newStock = Math.max(0, prevStock - quantity);
      } else if (type === 'SET') {
        newStock = Math.max(0, quantity);
      }

      // 2. Update product stock
      await db.runAsync(
        'UPDATE products SET stock = ?, updated_at = ? WHERE id = ? AND store_id = ?;',
        newStock,
        now,
        productId,
        storeId
      );

      // 3. Log stock adjustment record
      const res = await db.runAsync(
        `INSERT INTO stock_adjustments (
          store_id, product_id, product_name, adjustment_type, quantity,
          previous_stock, new_stock, reason, notes, adjusted_by, sync_status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?);`,
        storeId,
        productId,
        product.name,
        type,
        quantity,
        prevStock,
        newStock,
        reason,
        notes || null,
        adjustedBy,
        now
      );
      insertedId = res.lastInsertRowId;

      // 4. Enqueue Outbox Event
      const payload = JSON.stringify({
        store_id: storeId,
        product_id: product.server_id || productId,
        product_local_id: productId,
        type,
        quantity,
        previous_stock: prevStock,
        new_stock: newStock,
        reason,
        notes,
        adjusted_by: adjustedBy,
      });

      await db.runAsync(
        `INSERT INTO outbox (entity_type, entity_id, operation, payload, status, attempt_count, created_at, store_id)
         VALUES ('stock_adjustment', ?, 'CREATE', ?, 'PENDING', 0, ?, ?);`,
        String(insertedId),
        payload,
        now,
        storeId
      );
    });

    const row = await db.getFirstAsync<DBStockAdjustment>('SELECT * FROM stock_adjustments WHERE id = ? AND store_id = ?;', insertedId, storeId);
    return StockAdjustmentRepository.mapToDomain(row!);
  },
};

export default StockAdjustmentRepository;
