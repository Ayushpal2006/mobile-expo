/**
 * Orion POS Mobile Expo - Local Sale Repository & Transactional Checkout Engine
 *
 * Production-Hardened Sales Data Layer:
 * - Server sale ingestion preserving integer paise values without 100x multiplication
 * - Domain mapping accurately converting paise to rupees
 * - Atomic local checkout transaction with stock deduction and Outbox enqueueing
 * - Full store scoping and void mutation lifecycle
 */

import getDatabaseAsync from '../db';
import { DBSale, DBSaleItem, DBProduct } from '../models';
import { CheckoutPayload, SaleInvoice, SaleInvoiceItem } from '../../types';
import logger from '../../utils/logger';

let offlineSeq = 1;

export const SaleRepository = {
  mapToDomain(dbS: DBSale, items: DBSaleItem[] = []): SaleInvoice {
    const subtotalRupees = Number(dbS.subtotal || 0) / 100;
    const discountRupees = Number(dbS.discount || 0) / 100;
    const taxRupees = Number(dbS.tax || 0) / 100;
    const roundOffRupees = dbS.round_off ? Number(dbS.round_off) / 100 : 0;
    const totalRupees = Number(dbS.total_amount || 0) / 100;
    const paidRupees = dbS.paid_amount !== null && dbS.paid_amount !== undefined ? Number(dbS.paid_amount) / 100 : totalRupees;
    const balanceRupees = dbS.balance !== null && dbS.balance !== undefined ? Number(dbS.balance) / 100 : 0;

    return {
      id: dbS.id,
      server_id: dbS.server_id || undefined,
      store_id: dbS.store_id || 1,
      local_id: dbS.local_id,
      invoice_number: dbS.invoice_number,
      invoiceNumber: dbS.invoice_number,
      customer_id: dbS.customer_id || undefined,
      customer_name: dbS.customer_name || 'Walk-in Customer',
      customerName: dbS.customer_name || 'Walk-in Customer',
      customer_phone: dbS.customer_phone || undefined,
      customerPhone: dbS.customer_phone || undefined,
      subtotal: subtotalRupees,
      discount: discountRupees,
      tax: taxRupees,
      gst: taxRupees,
      round_off: roundOffRupees,
      roundOff: roundOffRupees,
      total_amount: totalRupees,
      grandTotal: totalRupees,
      paid_amount: paidRupees,
      balance: balanceRupees,
      payment_method: dbS.payment_method,
      paymentMethod: dbS.payment_method,
      payment_details: dbS.payment_details || undefined,
      notes: dbS.notes || undefined,
      cashier_name: dbS.cashier_name || 'Cashier',
      cashierName: dbS.cashier_name || 'Cashier',
      status: (dbS.status as any) || 'completed',
      void_reason: dbS.void_reason || undefined,
      voided_at: dbS.voided_at || undefined,
      voided_by: dbS.voided_by || undefined,
      public_token: dbS.public_token || undefined,
      client_mutation_id: dbS.client_mutation_id || undefined,
      sync_status: dbS.sync_status as any,
      created_at: dbS.created_at,
      createdAt: dbS.created_at,
      updated_at: dbS.updated_at,
      items: items.map((i) => {
        const unitPriceRupees = Number(i.unit_price || 0) / 100;
        const lineTotalRupees = Number(i.subtotal || 0) / 100;
        return {
          id: i.id,
          product_id: i.product_id || undefined,
          productId: i.product_id || undefined,
          product_name: i.product_name,
          productName: i.product_name,
          quantity: i.quantity,
          unit_price: unitPriceRupees,
          price: unitPriceRupees,
          selling_price: unitPriceRupees,
          discount: i.discount || 0,
          subtotal: lineTotalRupees,
          lineTotal: lineTotalRupees,
        };
      }),
    };
  },

  /**
   * Atomic POS Checkout Transaction with Idempotency & Safety:
   * 1. Idempotency check via client_mutation_id to prevent double checkouts
   * 2. Calculates line discounts, cart discount, GST, and round-off
   * 3. Inserts sale record into `sales`
   * 4. Inserts line items into `sale_items`
   * 5. Deducts inventory stock in `products`
   * 6. Enqueues outbox event into `outbox`
   */
  async createSaleTransaction(payload: CheckoutPayload, storeId: number = 1): Promise<SaleInvoice> {
    const db = await getDatabaseAsync();
    const now = new Date().toISOString();
    const effectiveStoreId = payload.storeId || storeId || 1;
    const clientMutationId = payload.clientMutationId || payload.client_mutation_id || null;

    // Idempotency check
    if (clientMutationId) {
      const existing = await db.getFirstAsync<DBSale>(
        'SELECT * FROM sales WHERE client_mutation_id = ?;',
        clientMutationId
      );
      if (existing) {
        logger.info(`[SaleRepository] Idempotent duplicate checkout detected for mutation ${clientMutationId}. Returning existing sale.`);
        const items = await db.getAllAsync<DBSaleItem>('SELECT * FROM sale_items WHERE sale_id = ?;', existing.id);
        return SaleRepository.mapToDomain(existing, items);
      }
    }

    const localId = payload.offlineIdentifier || `OFFLINE-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const seqStr = String(offlineSeq++).padStart(4, '0');
    const invoiceNum = `INV-OFFLINE-${Date.now().toString().slice(-6)}-${seqStr}`;

    let insertedSaleId = 0;
    const saleItemsResult: DBSaleItem[] = [];

    await db.withTransactionAsync(async () => {
      let calculatedSubtotalPaise = 0;
      let calculatedItemDiscountPaise = 0;
      let calculatedGstPaise = 0;

      const processedItems: Array<{
        productId: number | null;
        name: string;
        quantity: number;
        unitPricePaise: number;
        lineDiscountPct: number;
        itemDiscountPaise: number;
        subtotalPaise: number;
        gstRate: number;
      }> = [];

      for (const item of payload.items) {
        const prodId = item.productId || item.product_id || null;
        let pName = item.name || 'POS Product';
        let unitPricePaise = (item.unitPrice !== undefined || item.selling_price !== undefined)
          ? Math.round((item.unitPrice || item.selling_price || 0) * 100)
          : 0;
        let gstRate = 18;

        if (prodId) {
          const prod = await db.getFirstAsync<DBProduct>(
            'SELECT * FROM products WHERE id = ? AND store_id = ?;',
            prodId,
            effectiveStoreId
          );
          if (prod) {
            pName = prod.name;
            if (unitPricePaise === 0) unitPricePaise = prod.selling_price;
            gstRate = prod.gst !== undefined && prod.gst !== null ? prod.gst : 18;

            // Deduct stock in SQLite locally
            const newStock = Math.max(0, prod.stock - item.quantity);
            await db.runAsync(
              'UPDATE products SET stock = ?, updated_at = ? WHERE id = ? AND store_id = ?;',
              newStock,
              now,
              prod.id,
              effectiveStoreId
            );
          }
        }

        const lineGrossPaise = unitPricePaise * item.quantity;
        const lineDiscPct = item.discount || 0;
        const lineDiscPaise = Math.round((lineGrossPaise * lineDiscPct) / 100);
        const lineTaxablePaise = lineGrossPaise - lineDiscPaise;
        const lineTaxPaise = Math.round((lineTaxablePaise * gstRate) / 100);

        calculatedSubtotalPaise += lineGrossPaise;
        calculatedItemDiscountPaise += lineDiscPaise;
        calculatedGstPaise += lineTaxPaise;

        processedItems.push({
          productId: prodId,
          name: pName,
          quantity: item.quantity,
          unitPricePaise,
          lineDiscountPct: lineDiscPct,
          itemDiscountPaise: lineDiscPaise,
          subtotalPaise: lineGrossPaise - lineDiscPaise,
          gstRate,
        });
      }

      const cartDiscountPaise = payload.discount ? Math.round(payload.discount * 100) : 0;
      const totalDiscountPaise = calculatedItemDiscountPaise + cartDiscountPaise;
      const totalTaxPaise = calculatedGstPaise;
      const unroundedGrandTotalPaise = calculatedSubtotalPaise - totalDiscountPaise + totalTaxPaise;

      let roundOffPaise = 0;
      let finalGrandTotalPaise = unroundedGrandTotalPaise;
      if (payload.roundOff) {
        roundOffPaise = Math.round(payload.roundOff * 100);
        finalGrandTotalPaise = unroundedGrandTotalPaise + roundOffPaise;
      }

      // 1. Insert into sales table
      const saleResult = await db.runAsync(
        `INSERT INTO sales 
          (store_id, local_id, invoice_number, customer_id, customer_name, customer_phone, subtotal, discount, tax, total_amount, paid_amount, balance, round_off, payment_method, notes, cashier_name, status, client_mutation_id, sync_status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Cashier', 'completed', ?, 'pending', ?, ?);`,
        effectiveStoreId,
        localId,
        invoiceNum,
        payload.customerId || null,
        payload.customerName || 'Walk-in Customer',
        payload.customerPhone || null,
        calculatedSubtotalPaise,
        totalDiscountPaise,
        totalTaxPaise,
        finalGrandTotalPaise,
        finalGrandTotalPaise,
        0,
        roundOffPaise,
        payload.paymentMethod || 'Cash',
        payload.notes || null,
        clientMutationId,
        now,
        now
      );

      insertedSaleId = saleResult.lastInsertRowId;

      // 2. Insert into sale_items table
      for (const itm of processedItems) {
        const itemRes = await db.runAsync(
          `INSERT INTO sale_items 
            (sale_id, product_id, product_name, quantity, unit_price, discount, subtotal, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
          insertedSaleId,
          itm.productId,
          itm.name,
          itm.quantity,
          itm.unitPricePaise,
          itm.lineDiscountPct,
          itm.subtotalPaise,
          now
        );

        saleItemsResult.push({
          id: itemRes.lastInsertRowId,
          sale_id: insertedSaleId,
          product_id: itm.productId,
          product_name: itm.name,
          quantity: itm.quantity,
          unit_price: itm.unitPricePaise,
          discount: itm.lineDiscountPct,
          subtotal: itm.subtotalPaise,
          created_at: now,
        });
      }

      // 3. Enqueue into Outbox for background sync
      const outboxPayload = JSON.stringify({
        offlineId: localId,
        invoice_number: invoiceNum,
        customer_id: payload.customerId || null,
        customer_name: payload.customerName || 'Walk-in Customer',
        customer_phone: payload.customerPhone || null,
        customerPhone: payload.customerPhone || '0000000000',
        customerName: payload.customerName || 'Walk-in Customer',
        paymentMethod: payload.paymentMethod || 'Cash',
        payment_method: payload.paymentMethod || 'Cash',
        cashierName: 'Cashier',
        subtotal: calculatedSubtotalPaise / 100,
        discount: totalDiscountPaise / 100,
        tax: totalTaxPaise / 100,
        total_amount: finalGrandTotalPaise / 100,
        grandTotal: finalGrandTotalPaise / 100,
        amount_paid: finalGrandTotalPaise / 100,
        round_off: roundOffPaise / 100,
        notes: payload.notes || null,
        clientMutationId,
        store_id: effectiveStoreId,
        items: processedItems.map((pi) => ({
          productId: pi.productId,
          product_id: pi.productId,
          name: pi.name,
          productName: pi.name,
          quantity: pi.quantity,
          unit_price: pi.unitPricePaise / 100,
          unitPrice: pi.unitPricePaise / 100,
          discount: pi.lineDiscountPct,
          subtotal: pi.subtotalPaise / 100,
        })),
        created_at: now,
      });

      await db.runAsync(
        `INSERT INTO outbox 
          (entity_type, entity_id, operation, payload, status, attempt_count, created_at, store_id)
         VALUES ('sale', ?, 'CREATE', ?, 'PENDING', 0, ?, ?);`,
        localId,
        outboxPayload,
        now,
        effectiveStoreId
      );
    });

    const insertedSale = await db.getFirstAsync<DBSale>('SELECT * FROM sales WHERE id = ?;', insertedSaleId);
    return SaleRepository.mapToDomain(insertedSale!, saleItemsResult);
  },

  /**
   * Voids an invoice locally, restores inventory stock, and enqueues Outbox VOID event
   */
  async voidSale(identifier: string | number, reason: string = 'Voided by cashier', voidedBy: string = 'Cashier', storeId: number = 1): Promise<SaleInvoice> {
    const db = await getDatabaseAsync();
    const now = new Date().toISOString();
    const strId = String(identifier);

    const dbSale = await db.getFirstAsync<DBSale>(
      'SELECT * FROM sales WHERE (local_id = ? OR invoice_number = ? OR id = ?) AND store_id = ? LIMIT 1;',
      strId,
      strId,
      isNaN(Number(strId)) ? -1 : Number(strId),
      storeId
    );

    if (!dbSale) {
      throw new Error(`Sale with identifier "${identifier}" not found in local database.`);
    }

    if (dbSale.status === 'voided' || dbSale.status === 'VOID') {
      throw new Error(`Invoice ${dbSale.invoice_number} is already voided.`);
    }

    const saleItems = await db.getAllAsync<DBSaleItem>('SELECT * FROM sale_items WHERE sale_id = ?;', dbSale.id);

    await db.withTransactionAsync(async () => {
      // 1. Mark sale as voided
      await db.runAsync(
        "UPDATE sales SET status = 'voided', void_reason = ?, voided_at = ?, voided_by = ?, updated_at = ? WHERE id = ? AND store_id = ?;",
        reason,
        now,
        voidedBy,
        now,
        dbSale.id,
        storeId
      );

      // 2. Restore inventory stock
      for (const item of saleItems) {
        if (item.product_id) {
          await db.runAsync(
            'UPDATE products SET stock = stock + ?, updated_at = ? WHERE id = ? AND store_id = ?;',
            item.quantity,
            now,
            item.product_id,
            storeId
          );
        }
      }

      // 3. Enqueue Outbox VOID event
      const voidPayload = JSON.stringify({
        invoice_number: dbSale.invoice_number,
        server_id: dbSale.server_id,
        local_id: dbSale.local_id,
        store_id: storeId,
        reason,
        voided_by: voidedBy,
        voided_at: now,
      });

      await db.runAsync(
        `INSERT INTO outbox 
          (entity_type, entity_id, operation, payload, status, attempt_count, created_at, store_id)
         VALUES ('sale', ?, 'VOID', ?, 'PENDING', 0, ?, ?);`,
        dbSale.local_id,
        voidPayload,
        now,
        storeId
      );
    });

    const updatedSale = await db.getFirstAsync<DBSale>('SELECT * FROM sales WHERE id = ? AND store_id = ?;', dbSale.id, storeId);
    return SaleRepository.mapToDomain(updatedSale!, saleItems);
  },

  voidSaleTransaction: (identifier: string | number, reason: string = 'Voided by cashier', voidedBy: string = 'Cashier', storeId: number = 1) => {
    return SaleRepository.voidSale(identifier, reason, voidedBy, storeId);
  },

  async getAllSales(storeId: number = 1, limit = 100, status?: string): Promise<SaleInvoice[]> {
    const db = await getDatabaseAsync();
    let query = 'SELECT * FROM sales WHERE store_id = ?';
    const params: any[] = [storeId];

    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }

    query += ' ORDER BY id DESC LIMIT ?;';
    params.push(limit);

    const dbSales = await db.getAllAsync<DBSale>(query, ...params);

    const result: SaleInvoice[] = [];
    for (const s of dbSales) {
      const items = await db.getAllAsync<DBSaleItem>(
        'SELECT * FROM sale_items WHERE sale_id = ? ORDER BY id ASC;',
        s.id
      );
      result.push(SaleRepository.mapToDomain(s, items));
    }
    return result;
  },

  async getSaleByInvoiceOrLocalId(identifier: string, storeId: number = 1): Promise<SaleInvoice | null> {
    const db = await getDatabaseAsync();
    const dbSale = await db.getFirstAsync<DBSale>(
      'SELECT * FROM sales WHERE (local_id = ? OR invoice_number = ?) AND store_id = ? LIMIT 1;',
      identifier,
      identifier,
      storeId
    );

    if (!dbSale) return null;

    const items = await db.getAllAsync<DBSaleItem>(
      'SELECT * FROM sale_items WHERE sale_id = ? ORDER BY id ASC;',
      dbSale.id
    );

    return SaleRepository.mapToDomain(dbSale, items);
  },

  async markSynced(localId: string, serverId?: number): Promise<void> {
    const db = await getDatabaseAsync();
    const now = new Date().toISOString();
    await db.runAsync(
      "UPDATE sales SET sync_status = 'synced', server_id = ?, updated_at = ? WHERE local_id = ?;",
      serverId || null,
      now,
      localId
    );
  },

  /**
   * Batch ingestion of server sales during initial sync and background delta pulls
   */
  async insertServerSalesBatch(salesList: any[], storeId: number = 1): Promise<void> {
    const db = await getDatabaseAsync();
    const now = new Date().toISOString();

    await db.withTransactionAsync(async () => {
      for (const s of salesList) {
        if (!s.invoice_number && !s.invoiceNumber) continue;
        const invNum = s.invoice_number || s.invoiceNumber;
        const serverId = s.id || null;
        const sStoreId = s.store_id || s.storeId || storeId || 1;
        const localId = s.local_id || `SERVER-${invNum}`;

        // In backend postgres, subtotal, discount, tax, grand_total are already in paise
        const subtotalPaise = Math.round(Number(s.subtotal || 0));
        const discountPaise = Math.round(Number(s.discount || 0));
        const gstPaise = Math.round(Number(s.gst !== undefined ? s.gst : (s.tax || 0)));
        const grandTotalPaise = Math.round(Number(s.grand_total !== undefined ? s.grand_total : (s.total_amount || 0)));
        const paidPaise = s.paid_amount !== undefined && s.paid_amount !== null ? Math.round(Number(s.paid_amount)) : grandTotalPaise;
        const balancePaise = s.balance !== undefined && s.balance !== null ? Math.round(Number(s.balance)) : 0;
        const status = (s.status === 'VOID' || s.status === 'voided') ? 'voided' : 'completed';

        const existing = await db.getFirstAsync<DBSale>(
          'SELECT id FROM sales WHERE (invoice_number = ? OR (server_id = ? AND server_id IS NOT NULL)) AND store_id = ?;',
          invNum,
          serverId,
          sStoreId
        );

        let saleId: number;

        if (existing) {
          await db.runAsync(
            `UPDATE sales SET 
              server_id = ?, store_id = ?, customer_name = ?, customer_phone = ?, subtotal = ?, discount = ?, tax = ?, 
              total_amount = ?, paid_amount = ?, balance = ?, payment_method = ?, status = ?, sync_status = 'synced', updated_at = ?
             WHERE id = ?;`,
            serverId,
            sStoreId,
            s.customer_name || s.customerName || 'Walk-in',
            s.customer_phone || s.customerPhone || null,
            subtotalPaise,
            discountPaise,
            gstPaise,
            grandTotalPaise,
            paidPaise,
            balancePaise,
            s.payment_method || s.paymentMethod || 'Cash',
            status,
            now,
            existing.id
          );
          saleId = existing.id;
          await db.runAsync('DELETE FROM sale_items WHERE sale_id = ?;', saleId);
        } else {
          const res = await db.runAsync(
            `INSERT INTO sales 
              (server_id, store_id, local_id, invoice_number, customer_id, customer_name, customer_phone, subtotal, discount, tax, total_amount, paid_amount, balance, payment_method, cashier_name, status, sync_status, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced', ?, ?);`,
            serverId,
            sStoreId,
            localId,
            invNum,
            s.customer_id || s.customerId || null,
            s.customer_name || s.customerName || 'Walk-in',
            s.customer_phone || s.customerPhone || null,
            subtotalPaise,
            discountPaise,
            gstPaise,
            grandTotalPaise,
            paidPaise,
            balancePaise,
            s.payment_method || s.paymentMethod || 'Cash',
            s.cashier_name || s.cashierName || 'Cashier',
            status,
            s.created_at || s.createdAt || now,
            now
          );
          saleId = res.lastInsertRowId;
        }

        if (s.items && Array.isArray(s.items)) {
          for (const item of s.items) {
            const unitPricePaise = Math.round(Number(item.selling_price !== undefined ? item.selling_price : (item.unit_price || item.price || 0)));
            const subPaise = Math.round(Number(item.line_total !== undefined ? item.line_total : (item.subtotal || unitPricePaise * (item.quantity || 1))));
            const itemDisc = item.discount || 0;

            await db.runAsync(
              `INSERT INTO sale_items 
                (sale_id, product_id, product_name, quantity, unit_price, discount, subtotal, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
              saleId,
              item.product_id || item.productId || null,
              item.product_name || item.productName || item.name || 'Item',
              item.quantity || 1,
              unitPricePaise,
              itemDisc,
              subPaise,
              s.created_at || s.createdAt || now
            );
          }
        }
      }
    });
  },
};

export default SaleRepository;
