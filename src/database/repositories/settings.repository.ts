/**
 * Orion POS Mobile Expo - Store Settings Repository (Tenant & Store Isolated)
 */

import getDatabaseAsync from '../db';
import { DBSetting } from '../models';
import { StoreSettings } from '../../types';

export const SettingsRepository = {
  /**
   * Helper to construct tenant/store-isolated key
   */
  getScopedKey(key: string, storeId: number = 1): string {
    return `store_${storeId}_${key}`;
  },

  async getSetting(key: string, storeId: number = 1): Promise<string | null> {
    const db = await getDatabaseAsync();
    const scopedKey = SettingsRepository.getScopedKey(key, storeId);
    
    // First try scoped key
    let row = await db.getFirstAsync<DBSetting>(
      'SELECT value FROM store_settings WHERE key = ?;',
      scopedKey
    );

    // Fallback to legacy global key for migration compatibility
    if (!row) {
      row = await db.getFirstAsync<DBSetting>(
        'SELECT value FROM store_settings WHERE key = ?;',
        key
      );
    }

    return row ? row.value : null;
  },

  async setSetting(key: string, value: string, storeId: number = 1): Promise<void> {
    const db = await getDatabaseAsync();
    const now = new Date().toISOString();
    const scopedKey = SettingsRepository.getScopedKey(key, storeId);

    await db.runAsync(
      `INSERT INTO store_settings (key, value, updated_at) 
       VALUES (?, ?, ?) 
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at;`,
      scopedKey,
      value,
      now
    );
  },

  async getAllSettings(storeId: number = 1): Promise<StoreSettings> {
    const db = await getDatabaseAsync();
    const rows = await db.getAllAsync<DBSetting>('SELECT * FROM store_settings;');
    const result: StoreSettings = {};

    const prefix = `store_${storeId}_`;
    for (const r of rows) {
      let rawKey = r.key;
      if (r.key.startsWith(prefix)) {
        rawKey = r.key.substring(prefix.length);
      } else if (r.key.startsWith('store_')) {
        // Belongs to a different store -> skip for isolation!
        continue;
      }

      if (rawKey === 'storeName' || rawKey === 'shop_name' || rawKey === 'store_name') result.storeName = r.value;
      if (rawKey === 'address' || rawKey === 'shop_address' || rawKey === 'store_address') result.address = r.value;
      if (rawKey === 'phone' || rawKey === 'shop_phone' || rawKey === 'store_phone') result.phone = r.value;
      if (rawKey === 'email' || rawKey === 'shop_email' || rawKey === 'store_email') result.email = r.value;
      if (rawKey === 'gstin' || rawKey === 'shop_gstin') result.gstin = r.value;
      if (rawKey === 'pan') result.pan = r.value;
      if (rawKey === 'upiId' || rawKey === 'shop_upi_id' || rawKey === 'upi_id') result.upiId = r.value;
      if (rawKey === 'currencySymbol') result.currencySymbol = r.value;
      if (rawKey === 'organizationName') result.organizationName = r.value;
      if (rawKey === 'website') result.website = r.value;
      if (rawKey === 'stateProvince') result.stateProvince = r.value;
      if (rawKey === 'logoUrl' || rawKey === 'logo' || rawKey === 'logo_url') result.logoUrl = r.value;
      if (rawKey === 'tagline') result.tagline = r.value;
      if (rawKey === 'accentColor' || rawKey === 'primaryColor' || rawKey === 'primary_color') result.accentColor = r.value;
      if (rawKey === 'invoicePrefix' || rawKey === 'inv_prefix') result.invoicePrefix = r.value;
      if (rawKey === 'invoiceStartNumber') result.invoiceStartNumber = r.value;
      if (rawKey === 'allowNegativeStock') result.allowNegativeStock = r.value === 'true';
      if (rawKey === 'quickBillingMode') result.quickBillingMode = r.value === 'true';
      if (rawKey === 'autoPrintReceipt') result.autoPrintReceipt = r.value === 'true';
      if (rawKey === 'roundOffDefault') result.roundOffDefault = r.value === 'true';
      if (rawKey === 'invoiceHeader' || rawKey === 'invoice_header') result.invoiceHeader = r.value;
      if (rawKey === 'invoiceFooter' || rawKey === 'invoice_footer') result.invoiceFooter = r.value;
      if (rawKey === 'receiptHeader' || rawKey === 'receipt_header') result.receiptHeader = r.value;
      if (rawKey === 'receiptFooter' || rawKey === 'receipt_footer') result.receiptFooter = r.value;
      if (rawKey === 'termsAndConditions' || rawKey === 'terms_and_conditions') result.termsAndConditions = r.value;
      if (rawKey === 'purchasePrefix' || rawKey === 'po_prefix') result.purchasePrefix = r.value;
      if (rawKey === 'purchaseStartNumber') result.purchaseStartNumber = r.value;
      if (rawKey === 'autofillPurchaseCost') result.autofillPurchaseCost = r.value === 'true';
      if (rawKey === 'lowStockThreshold' || rawKey === 'low_stock_threshold') result.lowStockThreshold = parseInt(r.value, 10);
      if (rawKey === 'defaultHsnCode') result.defaultHsnCode = r.value;
      if (rawKey === 'paperWidth') result.paperWidth = r.value as any;
      if (rawKey === 'enableThermalPrint') result.enableThermalPrint = r.value === 'true';
      if (rawKey === 'activePrinterDriver') result.activePrinterDriver = r.value;
      if (rawKey === 'whatsappTemplate') result.whatsappTemplate = r.value;
      if (rawKey === 'taxRate' || rawKey === 'tax_rate') result.taxRate = parseFloat(r.value);
    }

    return result;
  },

  async saveAllSettings(settings: Partial<StoreSettings> | Record<string, any>, storeId: number = 1): Promise<void> {
    const db = await getDatabaseAsync();
    const now = new Date().toISOString();

    for (const [key, val] of Object.entries(settings)) {
      if (val !== undefined && val !== null) {
        await SettingsRepository.setSetting(key, String(val), storeId);
      }
    }

    // Enqueue outbox event for settings synchronization
    try {
      await db.runAsync(
        `INSERT INTO outbox (entity_type, entity_id, operation, payload, status, attempt_count, created_at, store_id)
         VALUES ('settings', ?, 'UPDATE', ?, 'PENDING', 0, ?, ?);`,
        String(storeId),
        JSON.stringify({ storeId, ...settings }),
        now,
        storeId
      );
    } catch {
      // safe fallback
    }
  },

  async getLastSyncTime(domain: string, storeId: number = 1): Promise<string | null> {
    return SettingsRepository.getSetting(`sync_checkpoint_${domain}`, storeId);
  },

  async setLastSyncTime(domain: string, isoTimestamp: string, storeId: number = 1): Promise<void> {
    await SettingsRepository.setSetting(`sync_checkpoint_${domain}`, isoTimestamp, storeId);
  },
};

export default SettingsRepository;

