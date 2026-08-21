/**
 * Orion POS Mobile Expo - Purchase Repository
 *
 * Production-Hardened Purchase Inward Data Layer:
 * - Server purchase ingestion preserving integer paise values without double multiplication
 * - Domain mapping accurately converting paise to rupees
 * - Transactional creation with automated stock incrementation and Outbox synchronization
 */

import getDatabaseAsync from '../db';
import { Purchase, PurchaseItem } from '../../types';

export interface DBPurchase {
  id: number;
  server_id: number | null;
  store_id: number;
  supplier_name: string;
  invoice_number: string | null;
  total_amount: number;
  status: string;
  sync_status: string;
  created_at: string;
  updated_at: string;
}

export interface DBPurchaseItem {
  id: number;
  purchase_id: number;
  product_id: number | null;
  product_name: string;
  quantity: number;
  cost_price: number;
  created_at: string;
}

export const PurchaseRepository = {
  mapToDomain(dbP: DBPurchase, items: DBPurchaseItem[] = []): Purchase {
    const totalRupees = Number(dbP.total_amount || 0) / 100;

    return {
      id: dbP.id,
      supplier_name: dbP.supplier_name,
      supplierName: dbP.supplier_name,
      invoice_number: dbP.invoice_number || undefined,
      invoiceNumber: dbP.invoice_number || undefined,
      total_amount: totalRupees,
      totalAmount: totalRupees,
      status: dbP.status,
      created_at: dbP.created_at,
      createdAt: dbP.created_at,
      items: items.map((i) => {
        const costRupees = Number(i.cost_price || 0) / 100;
        return {
          id: i.id,
          product_id: i.product_id || undefined,
          productId: i.product_id || undefined,
          product_name: i.product_name,
          productName: i.product_name,
          quantity: i.quantity,
          cost_price: costRupees,
          costPrice: costRupees,
        };
      }),
    };
  },

  async getAll(storeId: number = 1): Promise<Purchase[]> {
    const db = await getDatabaseAsync();
    const rows = await db.getAllAsync<DBPurchase>(
      'SELECT * FROM purchases WHERE store_id = ? ORDER BY id DESC;',
      storeId
    );

    const result: Purchase[] = [];
    for (const p of rows) {
      const items = await db.getAllAsync<DBPurchaseItem>(
        'SELECT * FROM purchase_items WHERE purchase_id = ?;',
        p.id
      );
      result.push(PurchaseRepository.mapToDomain(p, items));
    }
    return result;
  },

  async getById(id: number, storeId: number = 1): Promise<Purchase | null> {
    const db = await getDatabaseAsync();
    const row = await db.getFirstAsync<DBPurchase>(
      'SELECT * FROM purchases WHERE id = ? AND store_id = ? LIMIT 1;',
      id,
      storeId
    );
    if (!row) return null;
    const items = await db.getAllAsync<DBPurchaseItem>(
      'SELECT * FROM purchase_items WHERE purchase_id = ?;',
      row.id
    );
    return PurchaseRepository.mapToDomain(row, items);
  },

  async insertBatch(purchasesList: any[], storeId: number = 1): Promise<void> {
    const db = await getDatabaseAsync();
    const now = new Date().toISOString();

    await db.withTransactionAsync(async () => {
      for (const p of purchasesList) {
        if (!p.id && !p.supplier_name && !p.supplierName) continue;
        const sName = p.supplier_name || p.supplierName || 'General Supplier';
        const invNum = p.invoice_number || p.supplier_invoice_number || p.invoiceNumber || null;
        const effectiveStoreId = p.store_id || storeId || 1;
        const serverId = p.id || null;

        // In backend postgres, grand_total / total_amount are in paise
        let totalPaise: number;
        if (p.grand_total !== undefined && p.grand_total !== null) {
          totalPaise = Math.round(Number(p.grand_total));
        } else if (p.total_amount !== undefined && p.total_amount !== null) {
          totalPaise = Math.round(Number(p.total_amount));
        } else if (p.totalAmount !== undefined && p.totalAmount !== null) {
          totalPaise = Math.round(Number(p.totalAmount) * 100);
        } else {
          totalPaise = 0;
        }

        const existing = serverId
          ? await db.getFirstAsync<DBPurchase>(
              'SELECT id FROM purchases WHERE server_id = ? AND store_id = ?;',
              serverId,
              effectiveStoreId
            )
          : null;

        let purchaseId: number;

        if (existing) {
          await db.runAsync(
            `UPDATE purchases SET 
              supplier_name = ?, invoice_number = ?, total_amount = ?, status = ?, updated_at = ?
             WHERE id = ?;`,
            sName,
            invNum,
            totalPaise,
            p.status || 'completed',
            now,
            existing.id
          );
          purchaseId = existing.id;
          await db.runAsync('DELETE FROM purchase_items WHERE purchase_id = ?;', purchaseId);
        } else {
          const res = await db.runAsync(
            `INSERT INTO purchases 
              (server_id, store_id, supplier_name, invoice_number, total_amount, status, sync_status, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, 'synced', ?, ?);`,
            serverId,
            effectiveStoreId,
            sName,
            invNum,
            totalPaise,
            p.status || 'completed',
            p.created_at || p.createdAt || now,
            now
          );
          purchaseId = res.lastInsertRowId;
        }

        if (p.items && Array.isArray(p.items)) {
          for (const item of p.items) {
            let costPaise: number;
            if (item.unit_cost !== undefined && item.unit_cost !== null) {
              costPaise = Math.round(Number(item.unit_cost));
            } else if (item.cost_price !== undefined && item.cost_price !== null) {
              costPaise = Math.round(Number(item.cost_price));
            } else if (item.purchase_price !== undefined && item.purchase_price !== null) {
              costPaise = Math.round(Number(item.purchase_price));
            } else if (item.costPrice !== undefined && item.costPrice !== null) {
              costPaise = Math.round(Number(item.costPrice) * 100);
            } else {
              costPaise = 0;
            }

            await db.runAsync(
              `INSERT INTO purchase_items 
                (purchase_id, product_id, product_name, quantity, cost_price, created_at)
               VALUES (?, ?, ?, ?, ?, ?);`,
              purchaseId,
              item.product_id || item.productId || null,
              item.product_name || item.productName || item.name || 'Purchase Item',
              item.quantity || 1,
              costPaise,
              now
            );
          }
        }
      }
    });
  },

  async createPurchaseTransaction(
    supplierName: string,
    invoiceNumber: string | undefined,
    items: Array<{ productId?: number; productName: string; quantity: number; costPrice: number; sellingPrice?: number }>,
    totalAmount: number,
    supplierId?: number,
    storeId: number = 1
  ): Promise<Purchase> {
    const db = await getDatabaseAsync();
    const now = new Date().toISOString();
    const totalPaise = Math.round(totalAmount * 100);

    let purchaseId: number = 0;

    await db.withTransactionAsync(async () => {
      // 1. Insert Purchase
      const res = await db.runAsync(
        `INSERT INTO purchases (server_id, store_id, supplier_name, invoice_number, total_amount, status, sync_status, created_at, updated_at)
         VALUES (NULL, ?, ?, ?, ?, 'completed', 'pending', ?, ?);`,
        storeId,
        supplierName.trim() || 'General Supplier',
        invoiceNumber?.trim() || `PUR-${Date.now().toString().slice(-6)}`,
        totalPaise,
        now,
        now
      );
      purchaseId = res.lastInsertRowId;

      // 2. Insert items and increment product stock
      for (const itm of items) {
        const itemCostPaise = Math.round(itm.costPrice * 100);
        await db.runAsync(
          `INSERT INTO purchase_items (purchase_id, product_id, product_name, quantity, cost_price, created_at)
           VALUES (?, ?, ?, ?, ?, ?);`,
          purchaseId,
          itm.productId || null,
          itm.productName,
          itm.quantity,
          itemCostPaise,
          now
        );

        if (itm.productId) {
          // Increment stock and update cost_price (and selling_price if specified)
          if (itm.sellingPrice) {
            const sellingPaise = Math.round(itm.sellingPrice * 100);
            await db.runAsync(
              `UPDATE products SET stock = stock + ?, cost_price = ?, selling_price = ?, updated_at = ? WHERE id = ?;`,
              itm.quantity,
              itemCostPaise,
              sellingPaise,
              now,
              itm.productId
            );
          } else {
            await db.runAsync(
              `UPDATE products SET stock = stock + ?, cost_price = ?, updated_at = ? WHERE id = ?;`,
              itm.quantity,
              itemCostPaise,
              now,
              itm.productId
            );
          }
        }
      }

      // 3. Update supplier's purchase total if supplierId is provided
      if (supplierId) {
        await db.runAsync(
          `UPDATE suppliers SET total_purchases = total_purchases + ?, updated_at = ? WHERE id = ?;`,
          totalPaise,
          now,
          supplierId
        );
      }

      // 4. Enqueue Outbox Event
      const payload = JSON.stringify({
        store_id: storeId,
        supplier_name: supplierName,
        supplier_id: supplierId,
        invoice_number: invoiceNumber,
        purchase_date: now,
        discount: 0,
        gst: 0,
        tax: 0,
        payment_status: 'Paid',
        payment_method: 'Cash',
        items: items.map((i) => ({
          product_id: i.productId,
          product_name: i.productName,
          quantity: i.quantity,
          purchase_price: i.costPrice, // in rupees for backend API
          cost_price: i.costPrice,
          selling_price: i.sellingPrice || undefined,
        })),
      });

      await db.runAsync(
        `INSERT INTO outbox (entity_type, entity_id, operation, payload, status, attempt_count, created_at, store_id)
         VALUES ('purchase', ?, 'CREATE', ?, 'PENDING', 0, ?, ?);`,
        String(purchaseId),
        payload,
        now,
        storeId
      );
    });

    const dbP = await db.getFirstAsync<DBPurchase>('SELECT * FROM purchases WHERE id = ?;', purchaseId);
    const dbItems = await db.getAllAsync<DBPurchaseItem>('SELECT * FROM purchase_items WHERE purchase_id = ?;', purchaseId);
    return PurchaseRepository.mapToDomain(dbP!, dbItems);
  },
};

export default PurchaseRepository;
