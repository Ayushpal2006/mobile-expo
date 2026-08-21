/**
 * Orion POS Mobile Expo - Customer Domain Query Hook
 */

import { useState, useEffect, useCallback } from 'react';
import CustomerService from '../services/api/customer.service';
import { Customer, QueryState } from '../types';
import { useAuth } from '../context/AuthContext';
import logger from '../utils/logger';

export function useCustomers(searchQuery?: string): QueryState<Customer[]> & {
  createCustomer: (c: Partial<Customer>) => Promise<Customer>;
} {
  const { store } = useAuth();
  const storeId = store?.id || 1;

  const [data, setData] = useState<Customer[] | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCustomers = useCallback(async (options?: { force?: boolean }): Promise<Customer[] | null> => {
    if (options?.force) setIsRefreshing(true);
    else setIsLoading(true);

    setError(null);
    try {
      const list = await CustomerService.getCustomers(searchQuery, storeId);
      setData(list);
      return list;
    } catch (err: any) {
      logger.error('[useCustomers] Fetch error:', err);
      setError(err.message || 'Failed to load customers');
      return null;
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [searchQuery, storeId]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const createCustomer = async (customer: Partial<Customer>): Promise<Customer> => {
    const created = await CustomerService.createCustomer(customer, storeId);
    await fetchCustomers({ force: true });
    return created;
  };

  return {
    data,
    isLoading,
    isRefreshing,
    error,
    refetch: fetchCustomers,
    createCustomer,
  };
}

export default useCustomers;

