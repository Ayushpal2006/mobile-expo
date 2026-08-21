/**
 * Orion POS Mobile Expo - Printer Profile Repository
 */

import getDatabaseAsync from '../db';
import { PrinterType } from '../../native/types';

export interface DBPrinterProfile {
  id: number;
  store_id: number;
  name: string;
  type: PrinterType;
  address: string | null;
  paper_width: number;
  is_default: number;
  enabled: number;
  created_at: string;
  updated_at: string;
}

export const PrinterRepository = {
  async getProfiles(storeId: number = 1): Promise<DBPrinterProfile[]> {
    const db = await getDatabaseAsync();
    return db.getAllAsync<DBPrinterProfile>(
      'SELECT * FROM printer_profiles WHERE store_id = ? AND enabled = 1 ORDER BY is_default DESC, id DESC;',
      storeId
    );
  },

  async getDefaultProfile(storeId: number = 1): Promise<DBPrinterProfile | null> {
    const db = await getDatabaseAsync();
    return db.getFirstAsync<DBPrinterProfile>(
      'SELECT * FROM printer_profiles WHERE store_id = ? AND is_default = 1 AND enabled = 1 LIMIT 1;',
      storeId
    );
  },

  async saveProfile(profile: Partial<DBPrinterProfile> & { store_id?: number; name: string; type: PrinterType }): Promise<DBPrinterProfile> {
    const db = await getDatabaseAsync();
    const now = new Date().toISOString();
    const storeId = profile.store_id || 1;
    const isDefault = profile.is_default ? 1 : 0;

    let profileId = profile.id;

    await db.withTransactionAsync(async () => {
      if (isDefault === 1) {
        // Reset previous default for store
        await db.runAsync('UPDATE printer_profiles SET is_default = 0 WHERE store_id = ?;', storeId);
      }

      if (profileId) {
        await db.runAsync(
          `UPDATE printer_profiles SET 
            name = ?, type = ?, address = ?, paper_width = ?, is_default = ?, enabled = ?, updated_at = ?
           WHERE id = ?;`,
          profile.name,
          profile.type,
          profile.address || null,
          profile.paper_width || 58,
          isDefault,
          profile.enabled !== undefined ? (profile.enabled ? 1 : 0) : 1,
          now,
          profileId
        );
      } else {
        const res = await db.runAsync(
          `INSERT INTO printer_profiles 
            (store_id, name, type, address, paper_width, is_default, enabled, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?);`,
          storeId,
          profile.name,
          profile.type,
          profile.address || null,
          profile.paper_width || 58,
          isDefault,
          now,
          now
        );
        profileId = res.lastInsertRowId;
      }
    });

    const dbRow = await db.getFirstAsync<DBPrinterProfile>('SELECT * FROM printer_profiles WHERE id = ?;', profileId || 0);
    return dbRow!;
  },

  async setDefaultProfile(id: number, storeId: number = 1): Promise<void> {
    const db = await getDatabaseAsync();
    await db.withTransactionAsync(async () => {
      await db.runAsync('UPDATE printer_profiles SET is_default = 0 WHERE store_id = ?;', storeId);
      await db.runAsync('UPDATE printer_profiles SET is_default = 1 WHERE id = ?;', id);
    });
  },

  async deleteProfile(id: number, storeId: number = 1): Promise<void> {
    const db = await getDatabaseAsync();
    await db.runAsync('DELETE FROM printer_profiles WHERE id = ? AND store_id = ?;', id, storeId);
  },
};

export default PrinterRepository;
