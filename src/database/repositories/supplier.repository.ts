/**
 * Orion POS Mobile Expo - Supplier Repository
 */

import getDatabaseAsync from '../db';
import { DBSupplier } from '../models';
import { Supplier } from '../../types';

export const SupplierRepository = {
  mapToDomain(dbS: DBSupplier): Supplier {
    return {
      id: dbS.id,
      server_id: dbS.server_id || undefined,
      store_id: dbS.store_id || 1,
      name: dbS.name,
      contact_person: dbS.contact_person || undefined,
      phone: dbS.phone || undefined,
      email: dbS.email || undefined,
      address: dbS.address || undefined,
      gstin: dbS.gstin || undefined,
      total_purchases: dbS.total_purchases / 100, // Paise to Rupees
      sync_status: dbS.sync_status as any,
      created_at: dbS.created_at,
      updated_at: dbS.updated_at,
    };
  },

  async getAll(storeId: number = 1): Promise<Supplier[]> {
    const db = await getDatabaseAsync();
    const rows = await db.getAllAsync<DBSupplier>(
      'SELECT * FROM suppliers WHERE store_id = ? ORDER BY name ASC;',
      storeId
    );
    return rows.map(SupplierRepository.mapToDomain);
  },

  async getById(id: number, storeId: number = 1): Promise<Supplier | null> {
    const db = await getDatabaseAsync();
    const row = await db.getFirstAsync<DBSupplier>(
      'SELECT * FROM suppliers WHERE id = ? AND store_id = ? LIMIT 1;',
      id,
      storeId
    );
    return row ? SupplierRepository.mapToDomain(row) : null;
  },

  async search(query: string, storeId: number = 1): Promise<Supplier[]> {
    const db = await getDatabaseAsync();
    const q = `%${query.trim().toLowerCase()}%`;
    const rows = await db.getAllAsync<DBSupplier>(
      `SELECT * FROM suppliers 
       WHERE store_id = ? 
         AND (LOWER(name) LIKE ? OR phone LIKE ? OR LOWER(contact_person) LIKE ?)
       ORDER BY name ASC;`,
      storeId,
      q,
      q,
      q
    );
    return rows.map(SupplierRepository.mapToDomain);
  },

  async upsert(s: Partial<Supplier>, storeId: number = 1): Promise<Supplier> {
    const db = await getDatabaseAsync();
    const now = new Date().toISOString();
    const effectiveStoreId = s.store_id || storeId || 1;
    const totalPurchasesPaise = Math.round((s.total_purchases || 0) * 100);

    let id = s.id;
    if (!id && s.server_id) {
      const existing = await db.getFirstAsync<DBSupplier>(
        'SELECT id FROM suppliers WHERE server_id = ? AND store_id = ?;',
        s.server_id,
        effectiveStoreId
      );
      if (existing) id = existing.id;
    }

    await db.withTransactionAsync(async () => {
      if (id) {
        await db.runAsync(
          `UPDATE suppliers SET store_id = ?, name = ?, contact_person = ?, phone = ?, email = ?, address = ?, gstin = ?, updated_at = ?
           WHERE id = ? AND store_id = ?;`,
          effectiveStoreId,
          s.name || 'Unnamed Supplier',
          s.contact_person || null,
          s.phone || null,
          s.email || null,
          s.address || null,
          s.gstin || null,
          now,
          id,
          effectiveStoreId
        );
      } else {
        const isPending = !s.server_id;
        const res = await db.runAsync(
          `INSERT INTO suppliers (server_id, store_id, name, contact_person, phone, email, address, gstin, total_purchases, sync_status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
          s.server_id || null,
          effectiveStoreId,
          s.name || 'Unnamed Supplier',
          s.contact_person || null,
          s.phone || null,
          s.email || null,
          s.address || null,
          s.gstin || null,
          totalPurchasesPaise,
          isPending ? 'pending' : 'synced',
          now,
          now
        );
        id = res.lastInsertRowId;

        if (isPending) {
          await db.runAsync(
            `INSERT INTO outbox (entity_type, entity_id, operation, payload, status, attempt_count, created_at, store_id)
             VALUES ('supplier', ?, 'CREATE', ?, 'PENDING', 0, ?, ?);`,
            String(id),
            JSON.stringify({
              store_id: effectiveStoreId,
              name: s.name,
              contact_person: s.contact_person,
              phone: s.phone,
              email: s.email,
              address: s.address,
              gstin: s.gstin,
            }),
            now,
            effectiveStoreId
          );
        }
      }
    });

    const row = await db.getFirstAsync<DBSupplier>('SELECT * FROM suppliers WHERE id = ?;', id || 0);
    return SupplierRepository.mapToDomain(row!);
  },

  async insertServerBatch(list: any[], storeId: number = 1): Promise<void> {
    if (!Array.isArray(list) || list.length === 0) return;
    const db = await getDatabaseAsync();
    const now = new Date().toISOString();

    await db.withTransactionAsync(async () => {
      for (const item of list) {
        const serverId = item.id || item.server_id;
        if (!serverId) continue;
        const existing = await db.getFirstAsync<DBSupplier>(
          'SELECT id FROM suppliers WHERE server_id = ? AND store_id = ?;',
          serverId,
          storeId
        );
        if (existing) {
          await db.runAsync(
            `UPDATE suppliers SET store_id = ?, name = ?, contact_person = ?, phone = ?, email = ?, address = ?, gstin = ?, sync_status = 'synced', updated_at = ?
             WHERE id = ?;`,
            storeId,
            item.name || item.company_name || 'Supplier',
            item.contact_person || null,
            item.phone || null,
            item.email || null,
            item.address || null,
            item.gst_number || item.gstin || null,
            now,
            existing.id
          );
        } else {
          await db.runAsync(
            `INSERT INTO suppliers (server_id, store_id, name, contact_person, phone, email, address, gstin, total_purchases, sync_status, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 'synced', ?, ?);`,
            serverId,
            storeId,
            item.name || item.company_name || 'Supplier',
            item.contact_person || null,
            item.phone || null,
            item.email || null,
            item.address || null,
            item.gst_number || item.gstin || null,
            now,
            now
          );
        }
      }
    });
  },
};

export default SupplierRepository;
