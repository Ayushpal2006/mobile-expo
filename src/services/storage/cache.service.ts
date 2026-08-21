/**
 * Orion POS Mobile Expo - Persistent Cache & Offline Queue Manager
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Product, Customer, CheckoutPayload, SaleInvoice } from '../../types';
import logger from '../../utils/logger';

const PRODUCTS_CACHE_KEY = 'orion_cache_products';
const CUSTOMERS_CACHE_KEY = 'orion_cache_customers';
const OFFLINE_QUEUE_KEY = 'orion_offline_sales_queue';

export interface PendingOfflineSale {
  offlineIdentifier: string;
  payload: CheckoutPayload;
  timestamp: string;
  invoiceNumber: string;
}

export const CacheService = {
  // Products Cache
  async setProductsCache(products: Product[]): Promise<void> {
    try {
      await AsyncStorage.setItem(PRODUCTS_CACHE_KEY, JSON.stringify({ data: products, timestamp: Date.now() }));
    } catch (err: any) {
      logger.warn('Failed to save products cache:', err.message);
    }
  },

  async getProductsCache(): Promise<Product[] | null> {
    try {
      const raw = await AsyncStorage.getItem(PRODUCTS_CACHE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed?.data || null;
    } catch {
      return null;
    }
  },

  // Customers Cache
  async setCustomersCache(customers: Customer[]): Promise<void> {
    try {
      await AsyncStorage.setItem(CUSTOMERS_CACHE_KEY, JSON.stringify({ data: customers, timestamp: Date.now() }));
    } catch (err: any) {
      logger.warn('Failed to save customers cache:', err.message);
    }
  },

  async getCustomersCache(): Promise<Customer[] | null> {
    try {
      const raw = await AsyncStorage.getItem(CUSTOMERS_CACHE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed?.data || null;
    } catch {
      return null;
    }
  },

  // Offline Sales Queue
  async queueOfflineSale(payload: CheckoutPayload, offlineIdentifier: string, invoiceNumber: string): Promise<PendingOfflineSale> {
    const saleItem: PendingOfflineSale = {
      offlineIdentifier,
      payload,
      timestamp: new Date().toISOString(),
      invoiceNumber,
    };

    try {
      const queue = await this.getOfflineQueue();
      queue.push(saleItem);
      await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
      logger.info(`[CacheService] Queued offline sale "${invoiceNumber}" (ID: ${offlineIdentifier})`);
    } catch (err: any) {
      logger.error('Failed to queue offline sale:', err.message);
    }

    return saleItem;
  },

  async getOfflineQueue(): Promise<PendingOfflineSale[]> {
    try {
      const raw = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  },

  async removeOfflineSale(offlineIdentifier: string): Promise<void> {
    try {
      const queue = await this.getOfflineQueue();
      const updated = queue.filter((item) => item.offlineIdentifier !== offlineIdentifier);
      await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(updated));
      logger.info(`[CacheService] Removed synced offline sale ${offlineIdentifier}`);
    } catch (err: any) {
      logger.error('Failed to remove offline sale:', err.message);
    }
  },

  async clearOfflineQueue(): Promise<void> {
    try {
      await AsyncStorage.removeItem(OFFLINE_QUEUE_KEY);
    } catch {}
  },
};

export default CacheService;
