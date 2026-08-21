/**
 * Orion POS Mobile Expo - Local Customer Repository
 */

import getDatabaseAsync from '../db';
import { DBCustomer, DBSale, DBSaleItem } from '../models';
import { Customer, SaleInvoice } from '../../types';
import { SaleRepository } from './sale.repository';

export const CustomerRepository = {
  mapToDomain(dbC: DBCustomer): Customer {
    return {
      id: dbC.id,
      server_id: dbC.server_id || undefined,
      store_id: dbC.store_id || 1,
      name: dbC.name,
      phone: dbC.phone || undefined,
      email: dbC.email || undefined,
      address: dbC.address || undefined,
      notes: dbC.notes || undefined,
      gstin: dbC.gstin || undefined,
      total_purchases: dbC.total_purchases || 0,
      total_spent: Number(dbC.total_spent || 0) / 100, // Paise to Rupees
      last_visit: dbC.last_visit || undefined,
      sync_status: dbC.sync_status as any,
      created_at: dbC.created_at,
      updated_at: dbC.updated_at,
    };
  },

  async getAll(storeId: number = 1): Promise<Customer[]> {
    const db = await getDatabaseAsync();
    const rows = await db.getAllAsync<DBCustomer>(
      'SELECT * FROM customers WHERE store_id = ? ORDER BY name ASC;',
      storeId
    );
    return rows.map(CustomerRepository.mapToDomain);
  },

  async getById(id: number, storeId: number = 1): Promise<Customer | null> {
    const db = await getDatabaseAsync();
    const row = await db.getFirstAsync<DBCustomer>(
      'SELECT * FROM customers WHERE id = ? AND store_id = ? LIMIT 1;',
      id,
      storeId
    );
    return row ? CustomerRepository.mapToDomain(row) : null;
  },

  async search(query: string, storeId: number = 1): Promise<Customer[]> {
    const db = await getDatabaseAsync();
    const q = `%${query.trim().toLowerCase()}%`;
    const rows = await db.getAllAsync<DBCustomer>(
      `SELECT * FROM customers 
       WHERE store_id = ?
         AND (LOWER(name) LIKE ? OR phone LIKE ? OR LOWER(email) LIKE ?) 
       ORDER BY name ASC;`,
      storeId,
      q,
      q,
      q
    );
    return rows.map(CustomerRepository.mapToDomain);
  },

  async getByPhone(phone: string, storeId: number = 1): Promise<Customer | null> {
    const db = await getDatabaseAsync();
    const cleanPhone = phone.trim();
    const row = await db.getFirstAsync<DBCustomer>(
      'SELECT * FROM customers WHERE phone = ? AND store_id = ? LIMIT 1;',
      cleanPhone,
      storeId
    );
    return row ? CustomerRepository.mapToDomain(row) : null;
  },

  async getCustomerPurchaseHistory(identifier: string | number, storeId: number = 1): Promise<SaleInvoice[]> {
    const db = await getDatabaseAsync();
    const query = 'SELECT * FROM sales WHERE (customer_id = ? OR customer_phone = ? OR customer_name = ?) AND store_id = ? ORDER BY id DESC;';
    const dbSales = await db.getAllAsync<DBSale>(query, identifier, String(identifier), String(identifier), storeId);
    const result: SaleInvoice[] = [];
    for (const s of dbSales) {
      const items = await db.getAllAsync<DBSaleItem>('SELECT * FROM sale_items WHERE sale_id = ? ORDER BY id ASC;', s.id);
      result.push(SaleRepository.mapToDomain(s, items));
    }
    return result;
  },

  /**
   * Atomic local customer creation / update + Outbox enqueueing
   */
  async upsert(c: Partial<Customer> | any, storeId: number = 1): Promise<Customer> {
    const db = await getDatabaseAsync();
    const now = new Date().toISOString();
    const effectiveStoreId = c.store_id || storeId || 1;
    const serverId = c.server_id || c.id || null;

    // Handle server lifetime_value (in paise) vs domain total_spent (in rupees)
    let totalSpentPaise: number;
    if (c.lifetime_value !== undefined && c.lifetime_value !== null) {
      totalSpentPaise = Math.round(Number(c.lifetime_value));
    } else if (c.total_spent !== undefined && c.total_spent !== null) {
      totalSpentPaise = Math.round(Number(c.total_spent) * 100);
    } else {
      totalSpentPaise = 0;
    }

    const totalOrders = c.total_orders !== undefined ? c.total_orders : (c.total_purchases || 0);

    let id = c.id;
    if (!id && c.phone) {
      const existing = await db.getFirstAsync<DBCustomer>(
        'SELECT id FROM customers WHERE phone = ? AND store_id = ?;',
        c.phone,
        effectiveStoreId
      );
      if (existing) id = existing.id;
    }

    if (!id && serverId) {
      const existingServer = await db.getFirstAsync<DBCustomer>(
        'SELECT id FROM customers WHERE server_id = ? AND store_id = ?;',
        serverId,
        effectiveStoreId
      );
      if (existingServer) id = existingServer.id;
    }

    await db.withTransactionAsync(async () => {
      if (id) {
        await db.runAsync(
          `UPDATE customers SET 
            store_id = ?, server_id = COALESCE(?, server_id), name = ?, email = ?, address = ?, notes = ?, gstin = ?, 
            total_purchases = ?, total_spent = ?, last_visit = ?, updated_at = ?
           WHERE id = ? AND store_id = ?;`,
          effectiveStoreId,
          serverId,
          c.name || 'Walk-in Customer',
          c.email || null,
          c.address || null,
          c.notes || null,
          c.gstin || null,
          totalOrders,
          totalSpentPaise,
          c.last_visit || null,
          now,
          id,
          effectiveStoreId
        );
      } else {
        const isPending = !serverId;
        const syncStatusStr = isPending ? 'pending' : 'synced';

        const res = await db.runAsync(
          `INSERT INTO customers 
            (server_id, store_id, name, phone, email, address, notes, gstin, total_purchases, total_spent, last_visit, sync_status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
          serverId,
          effectiveStoreId,
          c.name || 'Walk-in Customer',
          c.phone || null,
          c.email || null,
          c.address || null,
          c.notes || null,
          c.gstin || null,
          totalOrders,
          totalSpentPaise,
          c.last_visit || null,
          syncStatusStr,
          c.created_at || now,
          now
        );
        id = res.lastInsertRowId;

        // Enqueue Outbox Event if pending
        if (isPending) {
          await db.runAsync(
            `INSERT INTO outbox 
              (entity_type, entity_id, operation, payload, status, attempt_count, created_at, store_id)
             VALUES ('customer', ?, 'CREATE', ?, 'PENDING', 0, ?, ?);`,
            String(id),
            JSON.stringify({
              store_id: effectiveStoreId,
              name: c.name || 'Walk-in Customer',
              phone: c.phone || null,
              email: c.email || null,
              address: c.address || null,
              notes: c.notes || null,
              gstin: c.gstin || null,
            }),
            now,
            effectiveStoreId
          );
        }
      }
    });

    const updated = await db.getFirstAsync<DBCustomer>('SELECT * FROM customers WHERE id = ?;', id || 0);
    return CustomerRepository.mapToDomain(updated!);
  },
};

export default CustomerRepository;
