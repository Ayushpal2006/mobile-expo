/**
 * Orion POS Mobile Expo - Expense Repository
 */

import getDatabaseAsync from '../db';
import { DBExpense } from '../models';
import { Expense } from '../../types';

export const ExpenseRepository = {
  mapToDomain(dbE: DBExpense): Expense {
    return {
      id: dbE.id,
      server_id: dbE.server_id || undefined,
      store_id: dbE.store_id || 1,
      category: dbE.category,
      amount: Number(dbE.amount || 0) / 100, // Paise to Rupees
      date: dbE.date,
      payment_mode: dbE.payment_mode || 'Cash',
      notes: dbE.notes || undefined,
      sync_status: dbE.sync_status as any,
      created_at: dbE.created_at,
      updated_at: dbE.updated_at,
    };
  },

  async getAll(storeId: number = 1): Promise<Expense[]> {
    const db = await getDatabaseAsync();
    const rows = await db.getAllAsync<DBExpense>(
      'SELECT * FROM expenses WHERE store_id = ? ORDER BY date DESC, id DESC;',
      storeId
    );
    return rows.map(ExpenseRepository.mapToDomain);
  },

  async getByDateRange(startDate: string, endDate: string, storeId: number = 1): Promise<Expense[]> {
    const db = await getDatabaseAsync();
    const rows = await db.getAllAsync<DBExpense>(
      'SELECT * FROM expenses WHERE store_id = ? AND date >= ? AND date <= ? ORDER BY date DESC;',
      storeId,
      startDate,
      endDate
    );
    return rows.map(ExpenseRepository.mapToDomain);
  },

  async create(e: Partial<Expense>, storeId: number = 1): Promise<Expense> {
    const db = await getDatabaseAsync();
    const now = new Date().toISOString();
    const amountPaise = Math.round((e.amount || 0) * 100);
    const dateStr = e.date || now.split('T')[0];
    const category = e.category || 'General';
    const paymentMode = e.payment_mode || 'Cash';
    const notes = e.notes || null;

    let id: number = 0;
    await db.withTransactionAsync(async () => {
      const res = await db.runAsync(
        `INSERT INTO expenses (server_id, store_id, category, amount, date, payment_mode, notes, sync_status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?);`,
        e.server_id || null,
        storeId,
        category,
        amountPaise,
        dateStr,
        paymentMode,
        notes,
        now,
        now
      );
      id = res.lastInsertRowId;

      // Enqueue to Outbox (send amount in paise or rupees per API contract)
      const payload = JSON.stringify({
        store_id: storeId,
        category,
        amount: amountPaise,
        date: dateStr,
        payment_mode: paymentMode,
        paymentMethod: paymentMode,
        notes,
      });

      await db.runAsync(
        `INSERT INTO outbox (entity_type, entity_id, operation, payload, status, attempt_count, created_at, store_id)
         VALUES ('expense', ?, 'CREATE', ?, 'PENDING', 0, ?, ?);`,
        String(id),
        payload,
        now,
        storeId
      );
    });

    const row = await db.getFirstAsync<DBExpense>('SELECT * FROM expenses WHERE id = ? AND store_id = ?;', id, storeId);
    return ExpenseRepository.mapToDomain(row!);
  },

  async delete(id: number, storeId: number = 1): Promise<void> {
    const db = await getDatabaseAsync();
    const now = new Date().toISOString();
    const existing = await db.getFirstAsync<DBExpense>('SELECT * FROM expenses WHERE id = ? AND store_id = ?;', id, storeId);
    if (!existing) return;

    await db.withTransactionAsync(async () => {
      await db.runAsync('DELETE FROM expenses WHERE id = ? AND store_id = ?;', id, storeId);

      if (existing.server_id) {
        await db.runAsync(
          `INSERT INTO outbox (entity_type, entity_id, operation, payload, status, attempt_count, created_at, store_id)
           VALUES ('expense', ?, 'DELETE', ?, 'PENDING', 0, ?, ?);`,
          String(existing.server_id),
          JSON.stringify({ id: existing.server_id, store_id: storeId }),
          now,
          storeId
        );
      }
    });
  },

  async insertServerBatch(list: any[], storeId: number = 1): Promise<void> {
    if (!Array.isArray(list) || list.length === 0) return;
    const db = await getDatabaseAsync();
    const now = new Date().toISOString();

    await db.withTransactionAsync(async () => {
      for (const item of list) {
        const serverId = item.id || item.server_id;
        if (!serverId) continue;
        const amountPaise = Math.round(Number(item.amount || 0));
        const dateStr = item.date ? item.date.split('T')[0] : now.split('T')[0];
        const category = item.category_name || item.category || 'General';

        const existing = await db.getFirstAsync<DBExpense>(
          'SELECT id FROM expenses WHERE server_id = ? AND store_id = ?;',
          serverId,
          storeId
        );
        if (existing) {
          await db.runAsync(
            `UPDATE expenses SET store_id = ?, category = ?, amount = ?, date = ?, payment_mode = ?, notes = ?, sync_status = 'synced', updated_at = ?
             WHERE id = ?;`,
            storeId,
            category,
            amountPaise,
            dateStr,
            item.payment_method || item.payment_mode || item.paymentMode || 'Cash',
            item.description || item.notes || null,
            now,
            existing.id
          );
        } else {
          await db.runAsync(
            `INSERT INTO expenses (server_id, store_id, category, amount, date, payment_mode, notes, sync_status, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, 'synced', ?, ?);`,
            serverId,
            storeId,
            category,
            amountPaise,
            dateStr,
            item.payment_method || item.payment_mode || item.paymentMode || 'Cash',
            item.description || item.notes || null,
            item.created_at || now,
            now
          );
        }
      }
    });
  },
};

export default ExpenseRepository;
