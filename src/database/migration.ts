import { SQLiteDatabase } from 'expo-sqlite';
import { SCHEMA_V1, SCHEMA_V2, SCHEMA_V3, SCHEMA_V4, SCHEMA_V5_STATEMENTS, SCHEMA_V6_STATEMENTS, SCHEMA_V7_STATEMENTS } from './schema';
import logger from '../utils/logger';

export class MigrationEngine {
  static async runMigrations(db: SQLiteDatabase): Promise<void> {
    try {
      // Ensure schema_migrations table exists
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
          version INTEGER PRIMARY KEY,
          name TEXT NOT NULL,
          applied_at TEXT NOT NULL
        );
      `);

      // Check current applied migrations
      const result = await db.getAllAsync<{ version: number }>(
        'SELECT version FROM schema_migrations ORDER BY version ASC;'
      );

      const appliedVersions = new Set(result.map((r) => r.version));

      // Migration 001: Initial POS Schema & Outbox
      if (!appliedVersions.has(1)) {
        logger.info('[MigrationEngine] Applying Migration 001_initial_schema...');
        await db.execAsync(SCHEMA_V1);
        await db.runAsync(
          'INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?);',
          1,
          '001_initial_schema',
          new Date().toISOString()
        );
        logger.info('[MigrationEngine] Migration 001 applied successfully!');
      }

      // Migration 002: Printer Profiles Table
      if (!appliedVersions.has(2)) {
        logger.info('[MigrationEngine] Applying Migration 002_printer_profiles...');
        await db.execAsync(SCHEMA_V2);
        await db.runAsync(
          'INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?);',
          2,
          '002_printer_profiles',
          new Date().toISOString()
        );
        logger.info('[MigrationEngine] Migration 002 applied successfully!');
      }

      // Migration 003: Purchases & Sync Metadata Tables
      if (!appliedVersions.has(3)) {
        logger.info('[MigrationEngine] Applying Migration 003_purchases_and_sync_metadata...');
        await db.execAsync(SCHEMA_V3);
        await db.runAsync(
          'INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?);',
          3,
          '003_purchases_and_sync_metadata',
          new Date().toISOString()
        );
        logger.info('[MigrationEngine] Migration 003 applied successfully!');
      }

      // Migration 004: Product image_url Column
      if (!appliedVersions.has(4)) {
        logger.info('[MigrationEngine] Applying Migration 004_product_image_url...');
        try {
          await db.execAsync(SCHEMA_V4);
        } catch (alterErr: any) {
          logger.warn('[MigrationEngine] Column image_url might already exist:', alterErr.message);
        }
        await db.runAsync(
          'INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?);',
          4,
          '004_product_image_url',
          new Date().toISOString()
        );
        logger.info('[MigrationEngine] Migration 004 applied successfully!');
      }

      // Migration 005: Sales Status, Tenant Isolation, Void tracking & Indexes
      if (!appliedVersions.has(5)) {
        logger.info('[MigrationEngine] Applying Migration 005_tenant_void_and_status...');
        for (const statement of SCHEMA_V5_STATEMENTS) {
          try {
            await db.execAsync(statement);
          } catch (alterErr: any) {
            logger.warn(`[MigrationEngine] Statement skipped or already applied: ${statement.slice(0, 40)}...`, alterErr.message);
          }
        }
        await db.runAsync(
          'INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?);',
          5,
          '005_tenant_void_and_status',
          new Date().toISOString()
        );
        logger.info('[MigrationEngine] Migration 005 applied successfully!');
      }

      // Migration 006: Expenses, Suppliers, Stock Adjustments, Held Carts & Enhancements
      if (!appliedVersions.has(6)) {
        logger.info('[MigrationEngine] Applying Migration 006_p1_operational_features...');
        for (const statement of SCHEMA_V6_STATEMENTS) {
          try {
            await db.execAsync(statement);
          } catch (alterErr: any) {
            logger.warn(`[MigrationEngine] Statement skipped or already applied: ${statement.slice(0, 40)}...`, alterErr.message);
          }
        }
        await db.runAsync(
          'INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?);',
          6,
          '006_p1_operational_features',
          new Date().toISOString()
        );
        logger.info('[MigrationEngine] Migration 006 applied successfully!');
      }

      // Migration 007: Multi-Tenant organization_id & Store Scoped Indexing
      if (!appliedVersions.has(7)) {
        logger.info('[MigrationEngine] Applying Migration 007_tenant_isolation_indexes...');
        for (const statement of SCHEMA_V7_STATEMENTS) {
          try {
            await db.execAsync(statement);
          } catch (alterErr: any) {
            logger.warn(`[MigrationEngine] Statement skipped or already applied: ${statement.slice(0, 40)}...`, alterErr.message);
          }
        }
        await db.runAsync(
          'INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?);',
          7,
          '007_tenant_isolation_indexes',
          new Date().toISOString()
        );
        logger.info('[MigrationEngine] Migration 007 applied successfully!');
      }

      logger.info('[MigrationEngine] All database migrations up to date.');
    } catch (error: any) {
      logger.error('[MigrationEngine] Migration failed:', error);
      throw error;
    }
  }
}

export default MigrationEngine;


