/**
 * Orion POS Mobile Expo - Local Product Repository
 *
 * Production-Hardened Product Data Layer:
 * - Direct ingestion of server products (paise integer values preserved without 100x inflation)
 * - Domain mapping accurately converting paise to rupees
 * - Complete store scoping and indexed lookup by name, SKU, and barcode
 * - Safe atomic local mutations with Outbox synchronization
 */

import getDatabaseAsync from '../db';
import { DBProduct } from '../models';
import { Product } from '../../types';

export const ProductRepository = {
  /**
   * Converts local DBProduct to domain Product interface
   */
  mapToDomain(dbP: DBProduct): Product {
    const sellingRupees = Number(dbP.selling_price || 0) / 100;
    const costRupees = dbP.cost_price !== null && dbP.cost_price !== undefined ? Number(dbP.cost_price) / 100 : 0;

    return {
      id: dbP.id,
      server_id: dbP.server_id || undefined,
      store_id: dbP.store_id || 1,
      name: dbP.name,
      sku: dbP.sku || undefined,
      barcode: dbP.barcode || undefined,
      selling_price: sellingRupees,
      price: sellingRupees,
      cost_price: costRupees,
      stock: dbP.stock,
      gst: dbP.gst !== null && dbP.gst !== undefined ? dbP.gst : 18,
      category: dbP.category || 'General',
      unit: dbP.unit || 'pcs',
      image_url: dbP.image_url || undefined,
      imageUrl: dbP.image_url || undefined,
      min_stock_level: dbP.min_stock_level !== null && dbP.min_stock_level !== undefined ? dbP.min_stock_level : 5,
      is_archived: dbP.is_archived === 1,
      is_active: dbP.is_active === 1 && dbP.is_archived !== 1,
      sync_status: dbP.sync_status as any,
      created_at: dbP.created_at,
      updated_at: dbP.updated_at,
    };
  },

  async getAll(storeId: number = 1, includeArchived: boolean = false): Promise<Product[]> {
    const db = await getDatabaseAsync();
    const query = includeArchived
      ? 'SELECT * FROM products WHERE store_id = ? ORDER BY name ASC;'
      : 'SELECT * FROM products WHERE (is_archived = 0 OR is_archived IS NULL) AND is_active = 1 AND store_id = ? ORDER BY name ASC;';

    const rows = await db.getAllAsync<DBProduct>(query, storeId);
    return rows.map(ProductRepository.mapToDomain);
  },

  async getById(id: number, storeId: number = 1): Promise<Product | null> {
    const db = await getDatabaseAsync();
    const row = await db.getFirstAsync<DBProduct>(
      'SELECT * FROM products WHERE id = ? AND store_id = ? LIMIT 1;',
      id,
      storeId
    );
    return row ? ProductRepository.mapToDomain(row) : null;
  },

  async search(query: string, storeId: number = 1): Promise<Product[]> {
    const db = await getDatabaseAsync();
    const q = `%${query.trim().toLowerCase()}%`;
    const rows = await db.getAllAsync<DBProduct>(
      `SELECT * FROM products 
       WHERE (is_archived = 0 OR is_archived IS NULL) 
         AND is_active = 1 
         AND store_id = ?
         AND (LOWER(name) LIKE ? OR LOWER(sku) LIKE ? OR barcode LIKE ?) 
       ORDER BY name ASC;`,
      storeId,
      q,
      q,
      query.trim()
    );
    return rows.map(ProductRepository.mapToDomain);
  },

  async getByBarcode(code: string, storeId: number = 1): Promise<Product | null> {
    const db = await getDatabaseAsync();
    const cleanCode = code.trim();
    const row = await db.getFirstAsync<DBProduct>(
      `SELECT * FROM products 
       WHERE (is_archived = 0 OR is_archived IS NULL)
         AND is_active = 1 
         AND store_id = ?
         AND (barcode = ? OR sku = ?) 
       LIMIT 1;`,
      storeId,
      cleanCode,
      cleanCode
    );
    return row ? ProductRepository.mapToDomain(row) : null;
  },

  async archiveProduct(id: number, storeId: number = 1): Promise<void> {
    const db = await getDatabaseAsync();
    const now = new Date().toISOString();
    await db.withTransactionAsync(async () => {
      await db.runAsync('UPDATE products SET is_archived = 1, updated_at = ? WHERE id = ? AND store_id = ?;', now, id, storeId);
      await db.runAsync(
        `INSERT INTO outbox (entity_type, entity_id, operation, payload, status, attempt_count, created_at, store_id)
         VALUES ('product', ?, 'DELETE', ?, 'PENDING', 0, ?, ?);`,
        String(id),
        JSON.stringify({ id, store_id: storeId, is_archived: true }),
        now,
        storeId
      );
    });
  },

  async restoreProduct(id: number, storeId: number = 1): Promise<void> {
    const db = await getDatabaseAsync();
    const now = new Date().toISOString();
    await db.withTransactionAsync(async () => {
      await db.runAsync('UPDATE products SET is_archived = 0, is_active = 1, updated_at = ? WHERE id = ? AND store_id = ?;', now, id, storeId);
      await db.runAsync(
        `INSERT INTO outbox (entity_type, entity_id, operation, payload, status, attempt_count, created_at, store_id)
         VALUES ('product', ?, 'UPDATE', ?, 'PENDING', 0, ?, ?);`,
        String(id),
        JSON.stringify({ id, store_id: storeId, is_archived: false, is_active: true }),
        now,
        storeId
      );
    });
  },

  /**
   * Batch ingestion of server products during initial sync and background delta pulls
   */
  async insertBatch(productList: any[], storeId: number = 1): Promise<void> {
    const db = await getDatabaseAsync();
    const now = new Date().toISOString();

    await db.withTransactionAsync(async () => {
      for (const p of productList) {
        if (!p.name) continue;
        const serverId = p.server_id || p.id || null;
        const effectiveStoreId = p.store_id || storeId || 1;
        const imgUrl = p.image_url || p.imageUrl || null;
        const minStock = p.minimum_stock !== undefined ? p.minimum_stock : (p.min_stock_level !== undefined ? p.min_stock_level : 5);
        const isArchived = p.is_archived === true || p.is_archived === 1 ? 1 : 0;
        const isActive = p.is_active === false || p.is_active === 0 ? 0 : 1;

        // In backend postgres, selling_price and purchase_price are already in paise
        // If coming from domain model (with price in rupees), normalize correctly
        let sellingPaise: number;
        if (p.selling_price !== undefined && p.selling_price !== null) {
          sellingPaise = Math.round(Number(p.selling_price));
        } else if (p.price !== undefined && p.price !== null) {
          sellingPaise = Math.round(Number(p.price) * 100);
        } else {
          sellingPaise = 0;
        }

        let costPaise: number;
        if (p.purchase_price !== undefined && p.purchase_price !== null) {
          costPaise = Math.round(Number(p.purchase_price));
        } else if (p.cost_price !== undefined && p.cost_price !== null) {
          costPaise = Math.round(Number(p.cost_price) * 100);
        } else {
          costPaise = 0;
        }

        const existing = serverId
          ? await db.getFirstAsync<DBProduct>(
              'SELECT id FROM products WHERE server_id = ? AND store_id = ?;',
              serverId,
              effectiveStoreId
            )
          : null;

        if (existing) {
          await db.runAsync(
            `UPDATE products SET 
              store_id = ?, name = ?, sku = ?, barcode = ?, selling_price = ?, cost_price = ?, 
              stock = ?, gst = ?, category = ?, unit = ?, image_url = ?, min_stock_level = ?, is_archived = ?, is_active = ?, sync_status = 'synced', updated_at = ?
             WHERE id = ?;`,
            effectiveStoreId,
            p.name,
            p.sku || null,
            p.barcode || null,
            sellingPaise,
            costPaise,
            p.stock !== undefined ? p.stock : 0,
            p.gst !== undefined ? p.gst : 18,
            p.category || 'General',
            p.unit || 'pcs',
            imgUrl,
            minStock,
            isArchived,
            isActive,
            now,
            existing.id
          );
        } else {
          await db.runAsync(
            `INSERT INTO products 
              (server_id, store_id, name, sku, barcode, selling_price, cost_price, stock, gst, category, unit, image_url, min_stock_level, is_archived, is_active, sync_status, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced', ?, ?);`,
            serverId,
            effectiveStoreId,
            p.name,
            p.sku || null,
            p.barcode || null,
            sellingPaise,
            costPaise,
            p.stock !== undefined ? p.stock : 0,
            p.gst !== undefined ? p.gst : 18,
            p.category || 'General',
            p.unit || 'pcs',
            imgUrl,
            minStock,
            isArchived,
            isActive,
            p.created_at || now,
            p.updated_at || now
          );
        }
      }
    });
  },

  /**
   * Atomic local product creation / update + Outbox enqueueing
   */
  async upsert(p: Partial<Product>, storeId: number = 1): Promise<Product> {
    const db = await getDatabaseAsync();
    const now = new Date().toISOString();
    const effectiveStoreId = p.store_id || storeId || 1;
    const sellingPaise = Math.round((p.selling_price || p.price || 0) * 100);
    const costPaise = p.cost_price ? Math.round(p.cost_price * 100) : 0;
    const imgUrl = p.image_url || p.imageUrl || null;
    const minStock = p.min_stock_level !== undefined ? p.min_stock_level : 5;
    const isArchived = p.is_archived ? 1 : 0;

    let id = p.id;
    if (!id && p.server_id) {
      const existing = await db.getFirstAsync<DBProduct>(
        'SELECT id FROM products WHERE server_id = ? AND store_id = ?;',
        p.server_id,
        effectiveStoreId
      );
      if (existing) id = existing.id;
    }
    if (!id && p.sku) {
      const existingSku = await db.getFirstAsync<DBProduct>(
        'SELECT id FROM products WHERE sku = ? AND store_id = ?;',
        p.sku,
        effectiveStoreId
      );
      if (existingSku) id = existingSku.id;
    }

    await db.withTransactionAsync(async () => {
      if (id) {
        await db.runAsync(
          `UPDATE products SET 
            store_id = ?, name = ?, sku = ?, barcode = ?, selling_price = ?, cost_price = ?, 
            stock = ?, gst = ?, category = ?, unit = ?, image_url = ?, min_stock_level = ?, is_archived = ?, updated_at = ?
           WHERE id = ?;`,
          effectiveStoreId,
          p.name || 'Unnamed Product',
          p.sku || null,
          p.barcode || null,
          sellingPaise,
          costPaise,
          p.stock ?? 0,
          p.gst ?? 18,
          p.category || 'General',
          p.unit || 'pcs',
          imgUrl,
          minStock,
          isArchived,
          now,
          id
        );

        // Enqueue update event
        await db.runAsync(
          `INSERT INTO outbox (entity_type, entity_id, operation, payload, status, attempt_count, created_at)
           VALUES ('product', ?, 'UPDATE', ?, 'PENDING', 0, ?);`,
          String(id),
          JSON.stringify({
            id: p.server_id || id,
            store_id: effectiveStoreId,
            name: p.name,
            sku: p.sku,
            barcode: p.barcode,
            selling_price: sellingPaise, // in paise for backend API
            purchase_price: costPaise,   // in paise for backend API
            stock: p.stock ?? 0,
            gst: p.gst ?? 18,
            category: p.category || 'General',
            unit: p.unit || 'pcs',
            image_url: imgUrl,
            minimum_stock: minStock,
          }),
          now
        );
      } else {
        const isPending = !p.server_id;
        const syncStatusStr = isPending ? 'pending' : 'synced';

        const res = await db.runAsync(
          `INSERT INTO products 
            (server_id, store_id, name, sku, barcode, selling_price, cost_price, stock, gst, category, unit, image_url, min_stock_level, is_archived, is_active, sync_status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?);`,
          p.server_id || null,
          effectiveStoreId,
          p.name || 'Unnamed Product',
          p.sku || null,
          p.barcode || null,
          sellingPaise,
          costPaise,
          p.stock ?? 0,
          p.gst ?? 18,
          p.category || 'General',
          p.unit || 'pcs',
          imgUrl,
          minStock,
          isArchived,
          syncStatusStr,
          now,
          now
        );
        id = res.lastInsertRowId;

        // If created locally without server_id, enqueue to outbox
        if (isPending) {
          const payload = JSON.stringify({
            store_id: effectiveStoreId,
            name: p.name,
            sku: p.sku,
            barcode: p.barcode,
            selling_price: sellingPaise,
            purchase_price: costPaise,
            stock: p.stock ?? 0,
            gst: p.gst ?? 18,
            category: p.category || 'General',
            unit: p.unit || 'pcs',
            image_url: imgUrl,
            minimum_stock: minStock,
          });

          await db.runAsync(
            `INSERT INTO outbox (entity_type, entity_id, operation, payload, status, attempt_count, created_at)
             VALUES ('product', ?, 'CREATE', ?, 'PENDING', 0, ?);`,
            String(id),
            payload,
            now
          );
        }
      }
    });

    const updatedRow = await db.getFirstAsync<DBProduct>('SELECT * FROM products WHERE id = ?;', id || 0);
    return ProductRepository.mapToDomain(updatedRow!);
  },
};

export default ProductRepository;
