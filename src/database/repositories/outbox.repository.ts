/**
 * Orion POS Mobile Expo - Outbox Event Repository
 */

import getDatabaseAsync from '../db';
import { DBOutbox } from '../models';
import { OutboxEvent, OutboxStatus } from '../../types';

export const OutboxRepository = {
  mapToDomain(dbO: DBOutbox): OutboxEvent {
    return {
      id: dbO.id,
      entity_type: dbO.entity_type,
      entity_id: dbO.entity_id,
      operation: dbO.operation,
      payload: dbO.payload,
      status: dbO.status as any,
      attempt_count: dbO.attempt_count,
      last_attempt_at: dbO.last_attempt_at || undefined,
      last_error: dbO.last_error || undefined,
      created_at: dbO.created_at,
    };
  },

  async getPendingEvents(limit = 100, storeId?: number): Promise<OutboxEvent[]> {
    const db = await getDatabaseAsync();
    let query = "SELECT * FROM outbox WHERE status = 'PENDING'";
    const params: any[] = [];

    if (storeId) {
      query += ' AND store_id = ?';
      params.push(storeId);
    }

    query += ` ORDER BY 
      CASE entity_type
        WHEN 'customer' THEN 10
        WHEN 'supplier' THEN 20
        WHEN 'product' THEN 30
        WHEN 'purchase' THEN 40
        WHEN 'stock_adjustment' THEN 50
        WHEN 'adjustment' THEN 50
        WHEN 'expense' THEN 60
        WHEN 'sale' THEN 70
        ELSE 80
      END ASC,
      id ASC LIMIT ?;`;
    params.push(limit);

    const rows = await db.getAllAsync<DBOutbox>(query, ...params);
    return rows.map(OutboxRepository.mapToDomain);
  },

  async getPendingCount(storeId?: number): Promise<number> {
    const db = await getDatabaseAsync();
    let query = "SELECT COUNT(*) as count FROM outbox WHERE status = 'PENDING'";
    const params: any[] = [];
    if (storeId) {
      query += ' AND store_id = ?';
      params.push(storeId);
    }
    const row = await db.getFirstAsync<{ count: number }>(query, ...params);
    return row?.count || 0;
  },

  async getFailedCount(storeId?: number): Promise<number> {
    const db = await getDatabaseAsync();
    let query = "SELECT COUNT(*) as count FROM outbox WHERE status = 'FAILED'";
    const params: any[] = [];
    if (storeId) {
      query += ' AND store_id = ?';
      params.push(storeId);
    }
    const row = await db.getFirstAsync<{ count: number }>(query, ...params);
    return row?.count || 0;
  },

  async getSyncStats(storeId?: number): Promise<{ pending: number; synced: number; failed: number }> {
    const db = await getDatabaseAsync();
    let query = `SELECT 
      SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) as pending,
      SUM(CASE WHEN status = 'SYNCED' THEN 1 ELSE 0 END) as synced,
      SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) as failed
    FROM outbox`;
    const params: any[] = [];
    if (storeId) {
      query += ' WHERE store_id = ?';
      params.push(storeId);
    }
    const row = await db.getFirstAsync<{ pending: number; synced: number; failed: number }>(query, ...params);
    return {
      pending: row?.pending || 0,
      synced: row?.synced || 0,
      failed: row?.failed || 0,
    };
  },

  async retryFailedEvents(storeId?: number): Promise<number> {
    const db = await getDatabaseAsync();
    let query = "UPDATE outbox SET status = 'PENDING', attempt_count = 0, last_error = NULL WHERE status = 'FAILED'";
    const params: any[] = [];
    if (storeId) {
      query += ' AND store_id = ?';
      params.push(storeId);
    }
    const res = await db.runAsync(query, ...params);
    return res.changes;
  },

  async insertEvent(event: {
    entity_type: string;
    entity_id: string;
    operation: 'CREATE' | 'UPDATE' | 'DELETE';
    payload: string;
    store_id: number;
    organization_id?: number;
  }): Promise<number> {
    const db = await getDatabaseAsync();
    const now = new Date().toISOString();
    const result = await db.runAsync(
      `INSERT INTO outbox (entity_type, entity_id, operation, payload, status, attempt_count, created_at, store_id, organization_id)
       VALUES (?, ?, ?, ?, 'PENDING', 0, ?, ?, ?);`,
      event.entity_type,
      event.entity_id,
      event.operation,
      event.payload,
      now,
      event.store_id,
      event.organization_id || null
    );
    return result.lastInsertRowId;
  },

  async markStatus(id: number, status: OutboxStatus, errorMessage?: string): Promise<void> {
    const db = await getDatabaseAsync();
    const now = new Date().toISOString();
    await db.runAsync(
      `UPDATE outbox SET 
        status = ?, 
        attempt_count = attempt_count + 1, 
        last_attempt_at = ?, 
        last_error = ? 
       WHERE id = ?;`,
      status,
      now,
      errorMessage || null,
      id
    );
  },

  async markBatchSynced(ids: number[]): Promise<void> {
    if (ids.length === 0) return;
    const db = await getDatabaseAsync();
    const now = new Date().toISOString();
    const placeholders = ids.map(() => '?').join(',');
    await db.runAsync(
      `UPDATE outbox SET status = 'SYNCED', last_attempt_at = ? WHERE id IN (${placeholders});`,
      now,
      ...ids
    );
  },

  async recoverStaleSyncingEvents(): Promise<number> {
    const db = await getDatabaseAsync();
    const result = await db.runAsync(
      `UPDATE outbox SET status = 'PENDING' WHERE status = 'SYNCING';`
    );
    return result.changes;
  },
};

export default OutboxRepository;
