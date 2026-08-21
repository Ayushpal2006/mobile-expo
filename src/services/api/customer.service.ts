/**
 * Orion POS Mobile Expo - Customer Domain Service
 */

import { CustomerRepository } from '../../database/repositories/customer.repository';
import { apiClient } from './client';
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
      const response = await apiClient.get<Customer[]>('/api/customers');
      const list = Array.isArray(response.data) ? response.data : [];
      if (list.length > 0) {
        for (const c of list) {
          await CustomerRepository.upsert(c, storeId);
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
    try {
      const response = await apiClient.post<Customer>('/api/customers', { ...customer, store_id: storeId });
      if (response.data && response.data.id) {
        await CustomerRepository.upsert({ ...savedLocal, server_id: response.data.id, sync_status: 'synced' }, storeId);
      }
    } catch (err: any) {
      logger.warn('[CustomerService] Network customer creation failed, saved locally:', err.message);
    }
    return savedLocal;
  },

  async getCustomerInvoices(customerId: number): Promise<SaleInvoice[]> {
    try {
      const response = await apiClient.get<SaleInvoice[]>(`/api/customers/${customerId}/invoices`);
      return Array.isArray(response.data) ? response.data : [];
    } catch {
      return [];
    }
  },
};

export default CustomerService;

