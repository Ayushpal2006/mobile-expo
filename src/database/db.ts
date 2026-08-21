/**
 * Orion POS Mobile Expo - Database Connection Singleton & WAL Mode Manager
 */

import * as SQLite from 'expo-sqlite';
import MigrationEngine from './migration';
import logger from '../utils/logger';

let dbInstance: SQLite.SQLiteDatabase | null = null;
let initPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export const getDatabaseAsync = async (): Promise<SQLite.SQLiteDatabase> => {
  if (dbInstance) {
    return dbInstance;
  }

  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    try {
      logger.info('[Database] Opening SQLite database orion_pos.db...');
      const db = await SQLite.openDatabaseAsync('orion_pos.db');

      // Enable WAL journal mode, Foreign Keys, and execute checkpoint to preserve data safety
      await db.execAsync(`
        PRAGMA journal_mode = WAL;
        PRAGMA foreign_keys = ON;
        PRAGMA wal_checkpoint(FULL);
      `);

      // Run schema migrations
      await MigrationEngine.runMigrations(db);

      dbInstance = db;
      return db;
    } catch (error: any) {
      logger.error('[Database] Connection failed:', error);
      initPromise = null;
      throw error;
    }
  })();

  return initPromise;
};

export default getDatabaseAsync;
