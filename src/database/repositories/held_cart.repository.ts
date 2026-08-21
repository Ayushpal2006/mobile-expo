/**
 * Orion POS Mobile Expo - Held Cart Repository (Cashier Draft / Parked Carts)
 */

import getDatabaseAsync from '../db';
import { DBHeldCart } from '../models';
import { HeldCart } from '../../types';

export const HeldCartRepository = {
  mapToDomain(dbH: DBHeldCart): HeldCart {
    return {
      id: dbH.id,
      store_id: dbH.store_id,
      cart_name: dbH.cart_name,
      customer_id: dbH.customer_id || undefined,
      customer_name: dbH.customer_name || undefined,
      cart_payload: dbH.cart_payload,
      total_amount: dbH.total_amount / 100, // Paise to Rupees
      created_at: dbH.created_at,
      updated_at: dbH.updated_at,
    };
  },

  async getAll(storeId: number = 1): Promise<HeldCart[]> {
    const db = await getDatabaseAsync();
    const rows = await db.getAllAsync<DBHeldCart>(
      'SELECT * FROM held_carts WHERE store_id = ? ORDER BY id DESC;',
      storeId
    );
    return rows.map(HeldCartRepository.mapToDomain);
  },

  async holdCart(
    cartName: string,
    cartItems: any[],
    totalAmount: number,
    customerId?: number,
    customerName?: string,
    storeId: number = 1
  ): Promise<HeldCart> {
    const db = await getDatabaseAsync();
    const now = new Date().toISOString();
    const totalPaise = Math.round(totalAmount * 100);
    const payloadStr = JSON.stringify(cartItems);

    const res = await db.runAsync(
      `INSERT INTO held_carts (store_id, cart_name, customer_id, customer_name, cart_payload, total_amount, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
      storeId,
      cartName.trim() || `Cart #${Date.now().toString().slice(-4)}`,
      customerId || null,
      customerName || null,
      payloadStr,
      totalPaise,
      now,
      now
    );

    const row = await db.getFirstAsync<DBHeldCart>('SELECT * FROM held_carts WHERE id = ?;', res.lastInsertRowId);
    return HeldCartRepository.mapToDomain(row!);
  },

  async deleteHeldCart(id: number, storeId: number = 1): Promise<void> {
    const db = await getDatabaseAsync();
    await db.runAsync('DELETE FROM held_carts WHERE id = ? AND store_id = ?;', id, storeId);
  },
};

export default HeldCartRepository;
