/**
 * Orion POS Mobile Expo - Customer Domain Service
 */

import { CustomerRepository } from '../../database/repositories/customer.repository';
import { apiClient } from './client';
import { SyncEngine } from './sync.service';
import { Customer, SaleInvoice } from '../../types';
import logger from '../../utils/logger';

export const CustomerService = {
  async getCustomers(searchQuery?: string, storeId: number = 1): Promise<Customer[]> {
    if (searchQuery && searchQuery.trim().length > 0) {
      return CustomerRepository.search(searchQuery, storeId);
    }

    const localCustomers = await CustomerRepository.getAll(storeId);
    if (localCustomers.length > 0) {
      return localCustomers;
    }

    try {
      const response = await apiClient.get<any>('/api/customers');
      const rawList = response.data?.data || response.data?.customers || response.data || [];
      const list = Array.isArray(rawList) ? rawList : [];
      if (list.length > 0) {
        for (const c of list) {
          if (!c || typeof c !== 'object') continue;
          try {
            await CustomerRepository.upsert(c, storeId);
          } catch (upsertErr: any) {
            logger.warn('[CustomerService] Skipping invalid customer record:', upsertErr.message);
          }
        }
        return await CustomerRepository.getAll(storeId);
      }
    } catch (err: any) {
      logger.warn('[CustomerService] Server fetch failed, returning empty local list:', err.message);
    }
    return [];
  },

  async createCustomer(customer: Partial<Customer>, storeId: number = 1): Promise<Customer> {
    const savedLocal = await CustomerRepository.upsert(customer, storeId);
    SyncEngine.syncNow(storeId).catch(() => {});
    return savedLocal;
  },

  async getCustomerInvoices(customerId: number, storeId: number = 1): Promise<SaleInvoice[]> {
    const local = await CustomerRepository.getCustomerPurchaseHistory(customerId, storeId);
    if (local.length > 0) {
      return local;
    }

    try {
      const response = await apiClient.get<any>(`/api/customers/${customerId}/invoices`);
      const raw = response.data?.data || response.data?.invoices || response.data || [];
      return Array.isArray(raw) ? raw : [];
    } catch {
      return local;
    }
  },
};

export default CustomerService;

